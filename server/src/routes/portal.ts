import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { decodeAndValidateBillFile } from '../utils/billFile.js';
import { getCustomers, getLeads, users, addLead, addNotification } from '../services/dataStore.js';
import { AppNotification, Lead, UserProfile } from '../types.js';
import {
  MeterReadingInput,
  PortalBillRecord,
  PortalUtilityType,
  portalService,
} from '../services/portalService.js';
import { canActorAccessCustomer, isBrokerAssigned } from '../services/customerOwnership.js';
import { publicFunnelLimiter } from '../middleware/rateLimiter.js';

export const portalRouter = Router();

function optionalAuthenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return next();
  }
  authenticateToken(req, res, next);
}

type PortalActor =
  | { isStaff: true; customerId?: string }
  | { isStaff: false; customerId: string };

function httpError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function resolveActor(req: AuthRequest): PortalActor {
  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);
  if (!authUser || !profile) throw httpError('Profilo autenticato non trovato.', 403);

  if (['admin', 'operator', 'broker'].includes(authUser.role)) {
    return { isStaff: true };
  }
  if (authUser.role === 'call_center') {
    throw httpError('Il Call Center non è autorizzato ad accedere al portale clienti.', 403);
  }
  if (authUser.role !== 'customer' || !profile.customerId) {
    throw httpError('Il profilo non è associato a un cliente.', 403);
  }
  if (!getCustomers().some((customer) => customer.id === profile.customerId)) {
    throw httpError('Cliente associato non trovato.', 403);
  }
  return { isStaff: false, customerId: profile.customerId };
}

function resolveCustomer(req: AuthRequest, requestedCustomerId?: unknown) {
  const actor = resolveActor(req);
  if (!actor.isStaff && typeof requestedCustomerId === 'string' && requestedCustomerId.trim() && requestedCustomerId.trim() !== actor.customerId) {
    throw httpError('Accesso negato: non puoi operare per un altro cliente.', 403);
  }
  const customerId = actor.isStaff
    ? (typeof requestedCustomerId === 'string' ? requestedCustomerId.trim() : '')
    : actor.customerId;
  if (!customerId) throw httpError('Specificare un customerId valido.', 400);

  const customer = getCustomers().find((item) => item.id === customerId);
  if (!customer) throw httpError('Cliente non trovato.', 404);

  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);
  if (profile && !canActorAccessCustomer(customer, profile)) {
    throw httpError('Accesso negato alla clientela non assegnata.', 403);
  }

  return { actor, customer };
}

type AsyncPortalHandler = (req: AuthRequest, res: Response) => Promise<void>;

function formatUtmNote(utmSource?: unknown, utmCampaign?: unknown, utmMedium?: unknown): string | null {
  if (typeof utmSource !== 'string' || !utmSource.trim()) return null;
  return `Campagna ADV: ${utmSource.trim()}${utmCampaign ? ` (${String(utmCampaign).trim()})` : ''}${utmMedium ? ` [${String(utmMedium).trim()}]` : ''}`;
}

function resolveDefaultBrokerId(): string {
  const defaultBroker = users.find((u) => u.role === 'broker' || u.role === 'operator');
  return defaultBroker?.id || 'user-op-2';
}

function canBrokerAccessBill(bill: PortalBillRecord, profile: UserProfile): boolean {
  if (profile.role === 'admin') return true;
  if (bill.assignedBrokerId && bill.assignedBrokerId === profile.id) return true;
  if (bill.leadId) {
    const lead = getLeads().find((l) => l.id === bill.leadId);
    if (lead && (lead.assignedBrokerId === profile.id || lead.assignedAgent === profile.id)) {
      return true;
    }
  }
  const customer = getCustomers().find((c) => c.id === bill.customerId);
  if (customer && canActorAccessCustomer(customer, profile)) {
    return true;
  }
  return false;
}

async function safeAddNotification(notification: AppNotification): Promise<void> {
  try {
    await addNotification(notification);
  } catch (notifErr) {
    console.warn('[Portal] Notifica non inviata (lead salvato con successo):', notifErr);
  }
}

function extractIdempotencyKey(req: AuthRequest): string | undefined {
  const headerKey = req.headers['x-idempotency-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
  const bodyKey = req.body?.idempotencyKey;
  if (typeof bodyKey === 'string' && bodyKey.trim()) return bodyKey.trim();
  return undefined;
}

interface InFlightGuestLead {
  fingerprint: string;
  promise: Promise<{ lead: Lead; bill?: any }>;
}
const inFlightGuestLeads = new Map<string, InFlightGuestLead>();

function buildLeadFingerprint(source: Lead['source'], phone: string, marker: string): string {
  return `${source}|${phone}|${marker}`;
}

function assertIdempotencyFingerprint(lead: Lead, source: Lead['source'], phone: string, marker: string): void {
  if (lead.source !== source || lead.phone !== phone || !lead.notes.includes(marker)) {
    throw httpError('Chiave di idempotenza già utilizzata per una richiesta differente.', 409);
  }
}

function findIdempotentLead(idempotencyKey: string | undefined, phone: string, source: Lead['source'], marker: string): Lead | undefined {
  const existing = getLeads();
  if (idempotencyKey) {
    const byKey = existing.find((l) => l.idempotencyKey === idempotencyKey);
    if (byKey) {
      assertIdempotencyFingerprint(byKey, source, phone, marker);
      return byKey;
    }
  }
  const nowMs = Date.now();
  return existing.find((l) => {
    if (l.source !== source || l.phone !== phone) return false;
    if (!l.notes.includes(marker)) return false;
    if (!l.privacyConsentTimestamp) return false;
    const elapsedMs = nowMs - new Date(l.privacyConsentTimestamp).getTime();
    return elapsedMs >= 0 && elapsedMs < 60_000;
  });
}

function handlePortalRoute(fn: AsyncPortalHandler) {
  return async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await fn(req, res);
    } catch (err: any) {
      const status = typeof err.status === 'number' ? err.status : 500;
      res.status(status).json({
        success: false,
        message: err.message || 'Errore durante l\'elaborazione della richiesta portale.',
      });
    }
  };
}

portalRouter.post('/consultations', publicFunnelLimiter, optionalAuthenticateToken, handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  // 1. Authenticated customer flow (existing behavior)
  if (req.user) {
    const { customer } = resolveCustomer(req, req.body?.customerId);
    const { offerId, offerName, supplier, utilityType, annualConsumption, notes, preferredContact } = req.body || {};

    if (!offerId || typeof offerId !== 'string') {
      throw httpError('Identificativo offerta obbligatorio.', 400);
    }
    if (!utilityType || !['luce', 'gas'].includes(utilityType)) {
      throw httpError('Tipologia fornitura (luce o gas) obbligatoria.', 400);
    }

    const safeConsumption = typeof annualConsumption === 'number' && annualConsumption > 0 ? annualConsumption : undefined;
    const noteDetails = [
      `[PORTALE CLIENTI] Richiesta assistenza offerta: ${offerName || offerId} (${supplier || 'Fornitore Partner'})`,
      `Fornitura: ${utilityType.toUpperCase()}`,
      safeConsumption ? `Consumo indicato: ${safeConsumption} ${utilityType === 'luce' ? 'kWh' : 'Smc'}/anno` : null,
      preferredContact ? `Canale preferito: ${preferredContact}` : null,
      notes ? `Note cliente: ${String(notes).slice(0, 500)}` : null,
    ].filter(Boolean).join(' • ');

    const newLead: Lead = {
      id: `lead-portal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || `${customer.id}@cliente.volta.it`,
      city: customer.city || 'Italia',
      source: 'landing_page',
      status: 'new',
      notes: noteDetails,
      createdAt: new Date().toISOString().split('T')[0],
      estimatedConsumptionKwh: utilityType === 'luce' ? safeConsumption : undefined,
      estimatedConsumptionSmc: utilityType === 'gas' ? safeConsumption : undefined,
      assignedBrokerId: customer.assignedBrokerId,
    };

    await addLead(newLead);

    await safeAddNotification({
      id: `notif-consultation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'consultation_requested',
      title: 'Nuova Richiesta Consulenza dal Comparatore',
      message: `${customer.name} (${utilityType.toUpperCase()}) richiede assistenza per l'offerta ${offerName || offerId}.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'urgent',
      targetRole: 'call_center',
      actionTab: 'leads',
      meta: { leadId: newLead.id, phone: newLead.phone, customerName: customer.name }
    });

    res.status(201).json({
      success: true,
      leadId: newLead.id,
      message: 'Richiesta di consulenza registrata con successo nel CRM Volta Energia.',
      lead: newLead,
    });
    return;
  }

  // 2. Unauthenticated / Guest public funnel flow
  const body = req.body || {};
  const customerNameRaw = body.customerName ?? body.name;
  const hasGuestContact =
    body.isGuest === true ||
    typeof customerNameRaw === 'string' ||
    body.phone !== undefined ||
    body.privacyConsent !== undefined;

  if (!hasGuestContact) {
    throw httpError('Autenticazione richiesta.', 401);
  }

  const {
    phone,
    privacyConsent,
    privacyPolicyVersion,
    offerId,
    offerName,
    supplier,
    utilityType,
    annualConsumption,
    notes,
    preferredContact,
    preferredTime,
    email,
    city,
    utmSource,
    utmCampaign,
    utmMedium,
  } = body;

  if (privacyConsent !== true) {
    throw httpError('Il consenso alla privacy è obbligatorio per richiedere una consulenza.', 400);
  }

  const trimmedPhone = typeof phone === 'string' ? phone.trim() : '';
  const digitsOnly = trimmedPhone.replace(/\D/g, '');
  if (!trimmedPhone || digitsOnly.length < 8) {
    throw httpError('Recapito telefonico obbligatorio per essere ricontattato.', 400);
  }

  const customerName = typeof customerNameRaw === 'string' ? customerNameRaw.trim() : '';
  if (!customerName) {
    throw httpError('Nome obbligatorio.', 400);
  }

  if (!offerId || typeof offerId !== 'string') {
    throw httpError('Identificativo offerta obbligatorio.', 400);
  }
  if (!utilityType || !['luce', 'gas'].includes(utilityType)) {
    throw httpError('Tipologia fornitura (luce o gas) obbligatoria.', 400);
  }

  const marker = String(offerName || offerId);
  const idempotencyKey = extractIdempotencyKey(req);
  const fingerprint = buildLeadFingerprint('public_comparator', trimmedPhone, marker);
  const lockKey = idempotencyKey ? `key:${idempotencyKey}` : `win:public_comparator:${trimmedPhone}:${marker}`;

  const existingLead = findIdempotentLead(idempotencyKey, trimmedPhone, 'public_comparator', marker);
  if (existingLead) {
    res.status(200).json({
      success: true,
      idempotent: true,
      leadId: existingLead.id,
      message: 'Richiesta di consulenza già registrata nel CRM Volta Energia.',
      lead: existingLead,
    });
    return;
  }

  const inFlight = inFlightGuestLeads.get(lockKey);
  if (inFlight) {
    if (inFlight.fingerprint !== fingerprint) {
      throw httpError('Chiave di idempotenza già utilizzata per una richiesta differente.', 409);
    }
    const resolved = await inFlight.promise;
    res.status(200).json({
      success: true,
      idempotent: true,
      leadId: resolved.lead.id,
      message: 'Richiesta di consulenza già registrata nel CRM Volta Energia.',
      lead: resolved.lead,
    });
    return;
  }

  const creationPromise = (async () => {
    const parsedConsumption = Number(annualConsumption);
    const safeConsumption = Number.isFinite(parsedConsumption) && parsedConsumption > 0 ? parsedConsumption : undefined;
    const utmAdvNote = formatUtmNote(utmSource, utmCampaign, utmMedium);
    const consentTimestamp = new Date().toISOString();
    const resolvedPolicyVersion =
      typeof privacyPolicyVersion === 'string' && privacyPolicyVersion.trim() ? privacyPolicyVersion.trim() : '2026.10';
    const noteDetails = [
      `[COMPARATORE PUBBLICO] Richiesta assistenza offerta: ${offerName || offerId} (${supplier || 'Fornitore Partner'})`,
      `Fornitura: ${utilityType.toUpperCase()}`,
      safeConsumption ? `Consumo indicato: ${safeConsumption} ${utilityType === 'luce' ? 'kWh' : 'Smc'}/anno` : null,
      preferredContact ? `Canale preferito: ${preferredContact}` : null,
      preferredTime ? `Fascia oraria preferita: ${preferredTime}` : null,
      utmAdvNote,
      notes ? `Note visitatore: ${String(notes).slice(0, 500)}` : null,
      `Consenso GDPR v${resolvedPolicyVersion} (${consentTimestamp})`,
    ].filter(Boolean).join(' • ');

    const assignedBrokerId = resolveDefaultBrokerId();

    const candidateLead: Lead = {
      id: `lead-guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: customerName,
      phone: trimmedPhone,
      email: (email && typeof email === 'string' && email.trim()) || `${trimmedPhone.replace(/\s+/g, '')}@lead.volta.it`,
      city: (typeof city === 'string' && city.trim()) || 'Italia',
      source: 'public_comparator',
      status: 'new',
      notes: noteDetails,
      createdAt: consentTimestamp.split('T')[0],
      estimatedConsumptionKwh: utilityType === 'luce' ? safeConsumption : undefined,
      estimatedConsumptionSmc: utilityType === 'gas' ? safeConsumption : undefined,
      assignedBrokerId,
      privacyConsentAccepted: true,
      privacyConsentTimestamp: consentTimestamp,
      privacyPolicyVersion: resolvedPolicyVersion,
      idempotencyKey,
    };

    await addLead(candidateLead);

    if (idempotencyKey) {
      const persistedByKey = getLeads().find((l) => l.idempotencyKey === idempotencyKey);
      if (persistedByKey && persistedByKey.id !== candidateLead.id) {
        assertIdempotencyFingerprint(persistedByKey, 'public_comparator', trimmedPhone, marker);
        return { lead: persistedByKey };
      }
    }

    await safeAddNotification({
      id: `notif-consultation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'consultation_requested',
      title: 'Nuova Richiesta Consulenza dal Comparatore',
      message: `${customerName} (${utilityType.toUpperCase()}) richiede assistenza per l'offerta ${offerName || offerId}.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'urgent',
      targetRole: 'call_center',
      actionTab: 'leads',
      meta: { leadId: candidateLead.id, phone: candidateLead.phone, customerName }
    });

    return { lead: candidateLead };
  })();

  inFlightGuestLeads.set(lockKey, { fingerprint, promise: creationPromise });
  try {
    const { lead: newLead } = await creationPromise;
    res.status(201).json({
      success: true,
      leadId: newLead.id,
      message: 'Richiesta di consulenza registrata con successo nel CRM Volta Energia.',
      lead: newLead,
    });
  } finally {
    inFlightGuestLeads.delete(lockKey);
  }
}));

portalRouter.post('/bills', publicFunnelLimiter, optionalAuthenticateToken, handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  // 1. Authenticated customer flow
  if (req.user) {
    const { customer } = resolveCustomer(req, req.body?.customerId);
    const utilityType = req.body?.utilityType as PortalUtilityType;
    if (!['luce', 'gas'].includes(utilityType)) {
      throw httpError('Tipologia fornitura (luce o gas) obbligatoria.', 400);
    }

    const assignedBrokerId = customer.assignedBrokerId || 'user-op-2';
    const leadId = `lead-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const bill = await portalService.uploadBill({
      customerId: customer.id,
      customerName: customer.name,
      fileName: typeof req.body?.fileName === 'string' ? req.body.fileName : 'bolletta',
      mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : '',
      bytes: decodeAndValidateBillFile(req.body?.base64Data, req.body?.mimeType),
      utilityType,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : undefined,
      leadId,
      assignedBrokerId,
    });

    const newLead: Lead = {
      id: leadId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || `${customer.id}@cliente.volta.it`,
      city: customer.city || 'Italia',
      source: 'bill_upload',
      status: 'new',
      notes: `[BOLLETTA CARICATA] File: ${bill.fileName} (${bill.fileSizeKb} KB) • Fornitura: ${utilityType.toUpperCase()} • Cliente registrato: ${customer.id}${req.body?.notes ? ` • Note: ${String(req.body.notes).slice(0, 500)}` : ''}`,
      createdAt: new Date().toISOString().split('T')[0],
      assignedBrokerId,
      billId: bill.id,
    };
    await addLead(newLead);

    await safeAddNotification({
      id: `notif-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'bill_uploaded',
      title: 'Nuova Bolletta Caricata dal Comparatore',
      message: `${customer.name} ha caricato "${bill.fileName}" per ${utilityType.toUpperCase()}. Analisi richiesta.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'urgent',
      targetRole: 'call_center',
      actionTab: 'leads',
      meta: { leadId: newLead.id, billId: bill.id, fileName: bill.fileName, customerId: customer.id }
    });

    res.status(201).json({ success: true, bill, leadId: newLead.id, lead: newLead });
    return;
  }

  // 2. Unauthenticated / Guest public funnel flow
  const body = req.body || {};
  const customerNameRaw = body.customerName ?? body.name;
  const hasGuestContact =
    body.isGuest === true ||
    typeof customerNameRaw === 'string' ||
    body.phone !== undefined ||
    body.privacyConsent !== undefined;

  if (!hasGuestContact) {
    throw httpError('Autenticazione richiesta.', 401);
  }

  const { phone, privacyConsent, privacyPolicyVersion, preferredContact, notes, email, city, utmSource, utmCampaign, utmMedium } = body;
  const customerName = typeof customerNameRaw === 'string' ? customerNameRaw.trim() : '';
  if (!customerName) {
    throw httpError('Nome e cognome obbligatori per richiedere l\'analisi della bolletta.', 400);
  }
  if (typeof phone !== 'string' || !phone.trim()) {
    throw httpError('Numero di telefono obbligatorio per essere ricontattati dal consulente.', 400);
  }
  const trimmedPhone = phone.trim();
  const digitsOnly = trimmedPhone.replace(/\D/g, '');
  if (digitsOnly.length < 8) {
    throw httpError('Numero di telefono non valido (minimo 8 cifre).', 400);
  }
  if (privacyConsent !== true) {
    throw httpError('È necessario accettare l\'informativa sulla privacy per procedere.', 400);
  }

  const utilityType = body.utilityType as PortalUtilityType;
  if (!utilityType || !['luce', 'gas'].includes(utilityType)) {
    throw httpError('Tipologia fornitura (luce o gas) obbligatoria.', 400);
  }

  const rawFileName = typeof body.fileName === 'string' ? body.fileName : 'bolletta';
  const idempotencyKey = extractIdempotencyKey(req);
  const fingerprint = buildLeadFingerprint('bill_upload', trimmedPhone, rawFileName);
  const lockKey = idempotencyKey ? `key:${idempotencyKey}` : `win:bill_upload:${trimmedPhone}:${rawFileName}`;

  const existingLead = findIdempotentLead(idempotencyKey, trimmedPhone, 'bill_upload', rawFileName);
  if (existingLead && existingLead.billId) {
    const existingBill = await portalService.getBill(existingLead.billId);
    res.status(200).json({
      success: true,
      idempotent: true,
      bill: existingBill,
      leadId: existingLead.id,
      lead: existingLead,
      message: 'Bolletta già caricata e registrata nel CRM.',
    });
    return;
  }

  const inFlight = inFlightGuestLeads.get(lockKey);
  if (inFlight) {
    if (inFlight.fingerprint !== fingerprint) {
      throw httpError('Chiave di idempotenza già utilizzata per una richiesta differente.', 409);
    }
    const resolved = await inFlight.promise;
    const existingBill = resolved.bill || (resolved.lead.billId ? await portalService.getBill(resolved.lead.billId) : undefined);
    res.status(200).json({
      success: true,
      idempotent: true,
      bill: existingBill,
      leadId: resolved.lead.id,
      lead: resolved.lead,
      message: 'Bolletta già caricata e registrata nel CRM.',
    });
    return;
  }

  const bytes = decodeAndValidateBillFile(body.base64Data, body.mimeType);

  const creationPromise = (async () => {
    const assignedBrokerId = resolveDefaultBrokerId();
    const leadId = `lead-bill-guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const consentTimestamp = new Date().toISOString();
    const resolvedPolicyVersion =
      typeof privacyPolicyVersion === 'string' && privacyPolicyVersion.trim() ? privacyPolicyVersion.trim() : '2026.10';

    const bill = await portalService.uploadBill({
      customerId: `guest-${Date.now()}`,
      customerName,
      fileName: rawFileName,
      mimeType: typeof body.mimeType === 'string' ? body.mimeType : '',
      bytes,
      utilityType,
      notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
      leadId,
      assignedBrokerId,
    });

    const utmClause = formatUtmNote(utmSource, utmCampaign, utmMedium);
    const utmAdvNote = utmClause ? ` • ${utmClause}` : '';

    const candidateLead: Lead = {
      id: leadId,
      name: customerName,
      phone: trimmedPhone,
      email: (email && typeof email === 'string' && email.trim()) || `${trimmedPhone.replace(/\s+/g, '')}@lead.volta.it`,
      city: (typeof city === 'string' && city.trim()) || 'Italia',
      source: 'bill_upload',
      status: 'new',
      notes: `[BOLLETTA CARICATA] File: ${bill.fileName} (${bill.fileSizeKb} KB) • Fornitura: ${utilityType.toUpperCase()} • Richiesta analisi broker.${preferredContact ? ` • Orario preferito: ${preferredContact}` : ''}${utmAdvNote}${notes ? ` • Note: ${String(notes).slice(0, 500)}` : ''} • Consenso GDPR v${resolvedPolicyVersion} (${consentTimestamp})`,
      createdAt: consentTimestamp.split('T')[0],
      assignedBrokerId,
      billId: bill.id,
      privacyConsentAccepted: true,
      privacyConsentTimestamp: consentTimestamp,
      privacyPolicyVersion: resolvedPolicyVersion,
      idempotencyKey,
    };
    await addLead(candidateLead);

    if (idempotencyKey) {
      const persistedByKey = getLeads().find((l) => l.idempotencyKey === idempotencyKey);
      if (persistedByKey && persistedByKey.id !== candidateLead.id) {
        assertIdempotencyFingerprint(persistedByKey, 'bill_upload', trimmedPhone, rawFileName);
        const persistedBill = persistedByKey.billId ? await portalService.getBill(persistedByKey.billId) : bill;
        return { lead: persistedByKey, bill: persistedBill };
      }
    }

    await safeAddNotification({
      id: `notif-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'bill_uploaded',
      title: 'Nuova Bolletta Caricata dal Comparatore',
      message: `${customerName} ha caricato "${bill.fileName}" per ${utilityType.toUpperCase()}. Analisi richiesta.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'urgent',
      targetRole: 'call_center',
      actionTab: 'leads',
      meta: { leadId: candidateLead.id, billId: bill.id, fileName: bill.fileName }
    });

    return { lead: candidateLead, bill };
  })();

  inFlightGuestLeads.set(lockKey, { fingerprint, promise: creationPromise });
  try {
    const { lead: newLead, bill } = await creationPromise;
    res.status(201).json({
      success: true,
      bill,
      leadId: newLead.id,
      lead: newLead,
      message: 'Bolletta caricata e richiesta di analisi registrata nel CRM.',
    });
  } finally {
    inFlightGuestLeads.delete(lockKey);
  }
}));

portalRouter.use(authenticateToken);

portalRouter.get('/bills', handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  const requested = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : undefined;
  if (requested && !getCustomers().some((customer) => customer.id === requested)) {
    throw httpError('Cliente non trovato.', 404);
  }

  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);
  if (requested) {
    const customer = getCustomers().find((item) => item.id === requested);
    if (customer && profile && !canActorAccessCustomer(customer, profile)) {
      throw httpError('Accesso negato alla clientela non assegnata.', 403);
    }
  }

  const customerId = actor.isStaff ? requested : actor.customerId;
  let bills = await portalService.listBills(customerId);

  if (profile && (profile.role === 'broker' || profile.role === 'operator') && !requested) {
    bills = bills.filter((b) => canBrokerAccessBill(b, profile));
  }

  res.json({ success: true, bills });
}));

portalRouter.get('/bills/:id/download', handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  const bill = await portalService.getBill(req.params.id);
  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);

  if (!actor.isStaff && bill.customerId !== actor.customerId) {
    throw httpError('Accesso negato alla bolletta richiesta.', 403);
  }

  if (profile && (profile.role === 'broker' || profile.role === 'operator')) {
    if (!canBrokerAccessBill(bill, profile)) {
      throw httpError('Accesso negato alla bolletta del cliente non assegnato.', 403);
    }
  }

  const download = await portalService.getBillDownload(bill.id);
  res.setHeader('Cache-Control', 'private, no-store');
  if (download.kind === 'signed-url') {
    res.redirect(302, download.url);
    return;
  }
  res.setHeader('Content-Type', download.mimeType);
  res.setHeader('Content-Length', String(download.bytes.length));
  res.setHeader('Content-Disposition', 'attachment; filename="' + bill.fileName + '"');
  res.status(200).send(download.bytes);
}));

portalRouter.post('/bills/:id/analyze', handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  if (!actor.isStaff) throw httpError('Solo lo staff può analizzare le bollette.', 403);
  const bill = await portalService.getBill(req.params.id);
  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);

  if (profile && (profile.role === 'broker' || profile.role === 'operator')) {
    if (!canBrokerAccessBill(bill, profile)) {
      throw httpError('Accesso negato alla bolletta del cliente non assegnato.', 403);
    }
  }

  const analysis = await portalService.analyzeBill(req.params.id);
  res.status(200).json({ success: true, ...analysis });
}));

portalRouter.get('/readings', handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  const actor = resolveActor(req);
  const requested = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : undefined;
  if (requested && !getCustomers().some((customer) => customer.id === requested)) {
    throw httpError('Cliente non trovato.', 404);
  }

  const authUser = req.user;
  const profile = users.find((item) => item.id === authUser?.userId);
  if (requested) {
    const customer = getCustomers().find((item) => item.id === requested);
    if (customer && profile && !canActorAccessCustomer(customer, profile)) {
      throw httpError('Accesso negato alla clientela non assegnata.', 403);
    }
  }

  const customerId = actor.isStaff ? requested : actor.customerId;
  let readings = await portalService.listReadings(customerId);

  if (profile && (profile.role === 'broker' || profile.role === 'operator') && !requested) {
    const assignedCustIds = new Set(
      getCustomers()
        .filter((c) => isBrokerAssigned(c, profile))
        .map((c) => c.id)
    );
    readings = readings.filter((r) => assignedCustIds.has(r.customerId));
  }

  res.json({ success: true, readings });
}));

portalRouter.post('/readings', handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  const { customer } = resolveCustomer(req, req.body?.customerId);
  const input = req.body as MeterReadingInput;
  const point = customer.utilityPoints.find((item: any) => item.id === input.utilityPointId);
  if (!point || point.type !== input.utilityType) {
    throw httpError('Il punto di fornitura selezionato non appartiene al cliente.', 400);
  }

  const reading = await portalService.createReading(customer.id, {
    utilityPointId: input.utilityPointId,
    utilityType: input.utilityType,
    readings: input.readings,
  });
  res.status(201).json({ success: true, reading });
}));



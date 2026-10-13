import { Router, Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { decodeAndValidateBillFile } from '../utils/billFile.js';
import { getCustomers, users, addLead, addNotification } from '../services/dataStore.js';
import { Lead } from '../types.js';
import {
  MeterReadingInput,
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

    await addNotification({
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

  const safeConsumption = typeof annualConsumption === 'number' && annualConsumption > 0 ? annualConsumption : undefined;
  const utmAdvNote = typeof utmSource === 'string' && utmSource.trim()
    ? `Campagna ADV: ${utmSource.trim()}${utmCampaign ? ` (${String(utmCampaign).trim()})` : ''}${utmMedium ? ` [${String(utmMedium).trim()}]` : ''}`
    : null;
  const noteDetails = [
    `[COMPARATORE PUBBLICO] Richiesta assistenza offerta: ${offerName || offerId} (${supplier || 'Fornitore Partner'})`,
    `Fornitura: ${utilityType.toUpperCase()}`,
    safeConsumption ? `Consumo indicato: ${safeConsumption} ${utilityType === 'luce' ? 'kWh' : 'Smc'}/anno` : null,
    preferredContact ? `Canale preferito: ${preferredContact}` : null,
    preferredTime ? `Fascia oraria preferita: ${preferredTime}` : null,
    utmAdvNote,
    notes ? `Note visitatore: ${String(notes).slice(0, 500)}` : null,
  ].filter(Boolean).join(' • ');

  const defaultBroker = users.find((u) => u.role === 'broker' || u.role === 'operator');
  const assignedBrokerId = defaultBroker?.id || 'user-op-2';

  const newLead: Lead = {
    id: `lead-guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: customerName,
    phone: trimmedPhone,
    email: (email && typeof email === 'string' && email.trim()) || `${trimmedPhone.replace(/\s+/g, '')}@lead.volta.it`,
    city: (typeof city === 'string' && city.trim()) || 'Italia',
    source: 'public_comparator',
    status: 'new',
    notes: noteDetails,
    createdAt: new Date().toISOString().split('T')[0],
    estimatedConsumptionKwh: utilityType === 'luce' ? safeConsumption : undefined,
    estimatedConsumptionSmc: utilityType === 'gas' ? safeConsumption : undefined,
    assignedBrokerId,
  };

  await addLead(newLead);

  await addNotification({
    id: `notif-consultation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'consultation_requested',
    title: 'Nuova Richiesta Consulenza dal Comparatore',
    message: `${customerName} (${utilityType.toUpperCase()}) richiede assistenza per l'offerta ${offerName || offerId}.`,
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: 'urgent',
    targetRole: 'call_center',
    actionTab: 'leads',
    meta: { leadId: newLead.id, phone: newLead.phone, customerName }
  });

  res.status(201).json({
    success: true,
    leadId: newLead.id,
    message: 'Richiesta di consulenza registrata con successo nel CRM Volta Energia.',
    lead: newLead,
  });
}));

portalRouter.post('/bills', publicFunnelLimiter, optionalAuthenticateToken, handlePortalRoute(async (req: AuthRequest, res: Response): Promise<void> => {
  // 1. Authenticated customer flow
  if (req.user) {
    const { customer } = resolveCustomer(req, req.body?.customerId);
    const utilityType = req.body?.utilityType as PortalUtilityType;
    if (!['luce', 'gas'].includes(utilityType)) {
      throw httpError('Tipologia fornitura (luce o gas) obbligatoria.', 400);
    }

    const bill = await portalService.uploadBill({
      customerId: customer.id,
      customerName: customer.name,
      fileName: typeof req.body?.fileName === 'string' ? req.body.fileName : 'bolletta',
      mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : '',
      bytes: decodeAndValidateBillFile(req.body?.base64Data, req.body?.mimeType),
      utilityType,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : undefined,
    });

    const newLead: Lead = {
      id: `lead-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: customer.name,
      phone: customer.phone,
      email: customer.email || `${customer.id}@cliente.volta.it`,
      city: customer.city || 'Italia',
      source: 'bill_upload',
      status: 'new',
      notes: `[BOLLETTA CARICATA] File: ${bill.fileName} (${bill.fileSizeKb} KB) • Fornitura: ${utilityType.toUpperCase()} • Cliente registrato: ${customer.id}${req.body?.notes ? ` • Note: ${String(req.body.notes).slice(0, 500)}` : ''}`,
      createdAt: new Date().toISOString().split('T')[0],
      assignedBrokerId: customer.assignedBrokerId || 'user-op-2',
    };
    await addLead(newLead);

    await addNotification({
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

  const { phone, privacyConsent, preferredContact, notes, email, city, utmSource, utmCampaign, utmMedium } = body;
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

  const bytes = decodeAndValidateBillFile(body.base64Data, body.mimeType);
  const bill = await portalService.uploadBill({
    customerId: `guest-${Date.now()}`,
    customerName,
    fileName: typeof body.fileName === 'string' ? body.fileName : 'bolletta',
    mimeType: typeof body.mimeType === 'string' ? body.mimeType : '',
    bytes,
    utilityType,
    notes: typeof notes === 'string' ? notes.slice(0, 1000) : undefined,
  });

  const utmAdvNote = typeof utmSource === 'string' && utmSource.trim()
    ? ` • Campagna ADV: ${utmSource.trim()}${utmCampaign ? ` (${String(utmCampaign).trim()})` : ''}${utmMedium ? ` [${String(utmMedium).trim()}]` : ''}`
    : '';

  const defaultBroker = users.find((u) => u.role === 'broker' || u.role === 'operator');
  const assignedBrokerId = defaultBroker?.id || 'user-op-2';

  const newLead: Lead = {
    id: `lead-bill-guest-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: customerName,
    phone: trimmedPhone,
    email: (email && typeof email === 'string' && email.trim()) || `${trimmedPhone.replace(/\s+/g, '')}@lead.volta.it`,
    city: (typeof city === 'string' && city.trim()) || 'Italia',
    source: 'bill_upload',
    status: 'new',
    notes: `[BOLLETTA CARICATA] File: ${bill.fileName} (${bill.fileSizeKb} KB) • Fornitura: ${utilityType.toUpperCase()} • Richiesta analisi broker.${preferredContact ? ` • Orario preferito: ${preferredContact}` : ''}${utmAdvNote}${notes ? ` • Note: ${String(notes).slice(0, 500)}` : ''}`,
    createdAt: new Date().toISOString().split('T')[0],
    assignedBrokerId,
  };
  await addLead(newLead);

  await addNotification({
    id: `notif-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    type: 'bill_uploaded',
    title: 'Nuova Bolletta Caricata dal Comparatore',
    message: `${customerName} ha caricato "${bill.fileName}" per ${utilityType.toUpperCase()}. Analisi richiesta.`,
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: 'urgent',
    targetRole: 'call_center',
    actionTab: 'leads',
    meta: { leadId: newLead.id, billId: bill.id, fileName: bill.fileName }
  });

  res.status(201).json({
    success: true,
    bill,
    leadId: newLead.id,
    lead: newLead,
    message: 'Bolletta caricata e richiesta di analisi registrata nel CRM.',
  });
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
    const assignedCustIds = new Set(
      getCustomers()
        .filter((c) => isBrokerAssigned(c, profile))
        .map((c) => c.id)
    );
    bills = bills.filter((b) => assignedCustIds.has(b.customerId));
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
    const customer = getCustomers().find((c) => c.id === bill.customerId);
    if (!customer || !canActorAccessCustomer(customer, profile)) {
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
    const customer = getCustomers().find((c) => c.id === bill.customerId);
    if (!customer || !canActorAccessCustomer(customer, profile)) {
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



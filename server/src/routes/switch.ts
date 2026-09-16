import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { MARKET_OFFERS, runQuarterlyAudit } from '../services/energyEngine.js';
import { getCustomers, getSignatureLogs, addSignatureLog, users } from '../services/dataStore.js';
import { getLiveMarketIndices, refreshMarketIndices } from '../services/gmeFeedService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, signContractSchema } from '../middleware/validate.js';
import { verifyOtp } from '../services/messagingService.js';
import { Customer } from '../types.js';

export const switchRouter = Router();

// GET /api/switch/market-indices (Pubblico per comparatore tariffe con fasce F1/F2/F3 e trend)
switchRouter.get('/market-indices', async (_req: Request, res: Response): Promise<void> => {
  const marketIndex = await getLiveMarketIndices();
  res.json({
    success: true,
    marketIndex
  });
});

// POST /api/switch/refresh-indices (Sincronizzazione forzata con il feed live GME - riservata ad Admin)
switchRouter.post('/refresh-indices', authenticateToken, requireRole('admin'), async (_req: Request, res: Response): Promise<void> => {
  const marketIndex = await refreshMarketIndices(true);
  res.status(200).json({
    success: true,
    message: 'Indici di mercato GME sincronizzati in tempo reale.',
    marketIndex
  });
});

// GET /api/switch/offers (Pubblico per comparatore tariffe)
switchRouter.get('/offers', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    offers: MARKET_OFFERS
  });
});

// GET /api/switch/audit
switchRouter.get('/audit', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const isStaff = authUser && (authUser.role === 'admin' || authUser.role === 'call_center' || authUser.role === 'operator');
    
    let customerList: Customer[] = getCustomers();
    if (!isStaff) {
      const userProfile = users.find(u => u.id === authUser?.userId);
      const userCustId = userProfile?.customerId;
      customerList = customerList.filter(c => c.id === userCustId || c.id === authUser?.userId);
    }

    const liveIndex = await getLiveMarketIndices();
    const audits = runQuarterlyAudit(customerList, liveIndex);
    res.json({
      success: true,
      count: audits.length,
      audits
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/switch/sign (Digital Signature & Mandato Brokeraggio con validazione crittografica OTP e binding cliente)
switchRouter.post('/sign', authenticateToken, validate(signContractSchema), (req: Request, res: Response): void => {
  const authUser = (req as any).user;
  const isStaff = authUser && (authUser.role === 'admin' || authUser.role === 'call_center' || authUser.role === 'operator');

  const { customerId, customerName, signerFiscalCode, phone, otpCode, signatureType = 'otp', canvasDataUrl, offerId, supplier } = req.body;

  if (!customerName || !signerFiscalCode || !phone) {
    res.status(400).json({ success: false, message: 'Dati di firma incompleti (richiesti customerName, signerFiscalCode, phone).' });
    return;
  }

  // Prevenzione IDOR: se l'utente ha ruolo customer, può firmare esclusivamente per la propria anagrafica
  if (!isStaff) {
    const userProfile = users.find(u => u.id === authUser?.userId);
    const userCustId = userProfile?.customerId;
    if (customerId && customerId !== userCustId && customerId !== authUser?.userId) {
      res.status(403).json({
        success: false,
        message: 'Accesso negato. Non sei autorizzato a firmare contratti per conto di un altro cliente.'
      });
      return;
    }
  }

  // Verifica esistenza offerta nel catalogo MARKET_OFFERS
  const targetOffer = MARKET_OFFERS.find(o => o.id === offerId || (o.supplier === supplier && offerId === o.id));
  if (!targetOffer && offerId !== 'off-custom') {
    res.status(400).json({
      success: false,
      message: `Offerta selezionata non valida o non presente a catalogo (id: ${offerId || 'sconosciuto'}).`
    });
    return;
  }

  // Se customerId è fornito, verifica coerenza con l'anagrafica
  const existingCustomer = customerId ? getCustomers().find(c => c.id === customerId) : undefined;
  if (existingCustomer && existingCustomer.phone) {
    const cleanReqPhone = phone.replace(/[^\d]/g, '');
    const cleanCustPhone = existingCustomer.phone.replace(/[^\d]/g, '');
    if (!cleanReqPhone.endsWith(cleanCustPhone.slice(-8)) && !cleanCustPhone.endsWith(cleanReqPhone.slice(-8))) {
      res.status(400).json({
        success: false,
        message: 'Il numero di telefono indicato non corrisponde ai dati registrati per questa anagrafica.'
      });
      return;
    }
  }

  const effectiveCustomerId = customerId || (existingCustomer ? existingCustomer.id : `cust-${Date.now()}`);
  const effectiveFiscalCode = (signerFiscalCode || (existingCustomer ? existingCustomer.fiscalCode : 'CF-ND')).toUpperCase();
  const effectiveSupplier = targetOffer ? targetOffer.supplier : (supplier || 'Octopus Energy');
  const effectiveOfferName = targetOffer ? targetOffer.name : (offerId || 'Offerta Standard');
  const timestamp = new Date().toISOString();

  let rawDataToSeal = '';
  let canvasHash: string | undefined = undefined;

  if (signatureType === 'canvas') {
    if (!canvasDataUrl || typeof canvasDataUrl !== 'string' || !canvasDataUrl.startsWith('data:image/')) {
      res.status(400).json({
        success: false,
        message: 'Tratto grafico della firma su schermo (canvas) mancante o non valido.'
      });
      return;
    }
    canvasHash = crypto.createHash('sha256').update(canvasDataUrl).digest('hex');
    rawDataToSeal = `MANDATO_BROKERAGGIO_CANVAS|${effectiveCustomerId}|${effectiveFiscalCode}|${phone}|${effectiveSupplier}|${effectiveOfferName}|${timestamp}|${canvasHash}`;
  } else {
    // Validazione OTP
    if (!otpCode || typeof otpCode !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Codice OTP obbligatorio per la modalità di firma OTP.'
      });
      return;
    }

    const otpVerification = verifyOtp(phone, otpCode);
    if (!otpVerification.verified) {
      res.status(400).json({
        success: false,
        message: otpVerification.message || 'Codice OTP errato o scaduto. Firma non convalidata.'
      });
      return;
    }
    rawDataToSeal = `MANDATO_BROKERAGGIO_VOLTA|${effectiveCustomerId}|${effectiveFiscalCode}|${phone}|${effectiveSupplier}|${effectiveOfferName}|${timestamp}|${otpCode}`;
  }

  const signatureHash = `SHA256:${crypto.createHash('sha256').update(rawDataToSeal).digest('hex')}`;

  const log = {
    id: `sig-${Date.now()}`,
    customerId: effectiveCustomerId,
    customerName: customerName || (existingCustomer ? existingCustomer.name : 'Cliente Volta'),
    signerFiscalCode: effectiveFiscalCode,
    phone,
    signatureType,
    otpCode: signatureType === 'otp' ? '******' : undefined,
    canvasHash,
    offerId: offerId || (targetOffer ? targetOffer.id : 'off-default'),
    supplier: effectiveSupplier,
    timestamp,
    ipAddress: req.ip || '127.0.0.1',
    signatureHash
  };

  addSignatureLog(log);

  res.status(201).json({
    success: true,
    message: 'Contratto e Mandato di Brokeraggio firmati digitalmente con successo.',
    signatureReceipt: log
  });
});

// GET /api/switch/signatures (Filtrato per ruolo: i clienti vedono solo le proprie firme)
switchRouter.get('/signatures', authenticateToken, (req: Request, res: Response): void => {
  const authUser = (req as any).user;
  const isStaff = authUser && (authUser.role === 'admin' || authUser.role === 'call_center' || authUser.role === 'operator');
  
  let signatures = getSignatureLogs();
  if (!isStaff) {
    const userProfile = users.find(u => u.id === authUser?.userId);
    const userCustId = userProfile?.customerId;
    signatures = signatures.filter(s => s.customerId === userCustId || s.customerId === authUser?.userId);
  }

  res.json({
    success: true,
    signatures
  });
});

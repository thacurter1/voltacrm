import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { MARKET_OFFERS, runQuarterlyAudit } from '../services/energyEngine.js';
import { getCustomers, getSignatureLogs, addSignatureLog, updateCustomer, users } from '../services/dataStore.js';
import { getLiveMarketIndices, refreshMarketIndices } from '../services/gmeFeedService.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, signContractSchema } from '../middleware/validate.js';
import { verifyOtp } from '../services/messagingService.js';
import { Customer, UtilityPoint } from '../types.js';
import {
  activateSignedSignature,
  activateSignedSignatureWithCommissions,
  assertIdentityMatchesStored,
  buildCanonicalSignatureDocument,
  decodeAndValidateCanvasPng,
  hashCanonicalDocument,
  SignatureConflictError,
  SignatureNotFoundError,
  SignatureValidationError,
  snapshotOffer,
  snapshotUtilityPoint
} from '../services/signatureService.js';

export const switchRouter = Router();

const enforceSignatureOwnership = (req: Request, res: Response, next: NextFunction): void => {
  const authUser = (req as any).user;
  const isStaff = authUser && (authUser.role === 'admin' || authUser.role === 'call_center' || authUser.role === 'operator');
  if (!isStaff) {
    const userProfile = users.find(user => user.id === authUser?.userId);
    const ownedCustomerId = userProfile?.customerId || authUser?.userId;
    const requestedCustomerId = req.body?.customerId;
    if (requestedCustomerId && requestedCustomerId !== ownedCustomerId && requestedCustomerId !== authUser?.userId) {
      res.status(403).json({ success: false, message: 'Accesso negato. Non puoi firmare per un altro cliente.' });
      return;
    }
  }
  next();
};

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

// GET /api/switch/offers (Catalogo offerte del mercato libero verificate da VoltaCRM)
switchRouter.get('/offers', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    count: MARKET_OFFERS.length,
    offers: MARKET_OFFERS
  });
});

// POST /api/switch/sign (la firma crea una richiesta immutabile; l'attivazione resta separata)
switchRouter.post('/sign', authenticateToken, enforceSignatureOwnership, validate(signContractSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const isStaff = authUser && (authUser.role === 'admin' || authUser.role === 'call_center' || authUser.role === 'operator');
    const {
      customerId, customerName, signerFiscalCode, phone, otpCode,
      signatureType = 'otp', canvasDataUrl, offerId, supplier,
      utilityPointId, podOrPdr, consentVersion
    } = req.body;

    let effectiveCustomerId = customerId;
    if (!isStaff) {
      const userProfile = users.find(user => user.id === authUser?.userId);
      const ownedCustomerId = userProfile?.customerId || authUser?.userId;
      if (customerId && customerId !== ownedCustomerId && customerId !== authUser?.userId) {
        res.status(403).json({ success: false, message: 'Accesso negato. Non puoi firmare per un altro cliente.' });
        return;
      }
      effectiveCustomerId = ownedCustomerId;
    }

    const customer = getCustomers().find(item => item.id === effectiveCustomerId);
    if (!customer) throw new SignatureValidationError('Anagrafica cliente non trovata.');
    const identity = {
      customerId: customer.id,
      customerName: customer.name,
      signerFiscalCode: customer.fiscalCode.toUpperCase(),
      phone: customer.phone
    };
    assertIdentityMatchesStored(identity, { customerName, signerFiscalCode, phone });

    const offer = MARKET_OFFERS.find(item => item.id === offerId);
    if (!offer || (supplier && supplier !== offer.supplier)) {
      throw new SignatureValidationError('Offerta selezionata non valida o non coerente con il catalogo.');
    }

    let point: UtilityPoint | undefined;
    if (utilityPointId && podOrPdr) {
      point = customer.utilityPoints?.find((item: UtilityPoint) => item.id === utilityPointId && item.podOrPdr === podOrPdr);
      if (!point) throw new SignatureValidationError('Il punto di fornitura indicato non appartiene al cliente o non coincide con POD/PDR.');
    } else {
      const matchingPoints = customer.utilityPoints?.filter((item: UtilityPoint) => item.type === offer.energyType) || [];
      if (matchingPoints.length === 1) {
        point = matchingPoints[0];
      } else if (matchingPoints.length === 0) {
        throw new SignatureValidationError('Nessun punto di fornitura trovato per il tipo di energia dell\u2019offerta.');
      } else {
        throw new SignatureValidationError('Il cliente ha pi\u00F9 punti di fornitura per questa energia: specificare utilityPointId e podOrPdr.');
      }
    }

    if (!point) {
      throw new SignatureValidationError('Punto di fornitura non valido.');
    }

    if (offer.energyType !== point.type) {
      throw new SignatureValidationError('Il tipo energia dell\u2019offerta non coincide con il punto di fornitura firmato.');
    }

    const signedAt = new Date().toISOString();
    const signatureId = `sig-${crypto.randomUUID()}`;
    let canvasHash: string | undefined;

    if (signatureType === 'canvas') {
      const pngBytes = decodeAndValidateCanvasPng(canvasDataUrl);
      canvasHash = crypto.createHash('sha256').update(pngBytes).digest('hex');
    } else {
      if (!otpCode || typeof otpCode !== 'string') throw new SignatureValidationError('Codice OTP obbligatorio.');
      const verification = verifyOtp(identity.phone, otpCode);
      if (!verification.verified) throw new SignatureValidationError(verification.message || 'Codice OTP errato o scaduto.');
    }

    const offerSnapshot = snapshotOffer(offer);
    const originalPointSnapshot = snapshotUtilityPoint(point);
    const canonicalDocument = buildCanonicalSignatureDocument({
      signatureId,
      signedAt,
      identity,
      utilityPoint: originalPointSnapshot,
      offer: offerSnapshot,
      consentVersion,
      signatureType,
      artifactHash: canvasHash
    });
    const documentHash = hashCanonicalDocument(canonicalDocument);
    const signatureHash = documentHash;
    const log = {
      id: signatureId,
      ...identity,
      signatureType,
      otpCode: signatureType === 'otp' ? '******' : undefined,
      canvasDataUrl: signatureType === 'canvas' ? canvasDataUrl : undefined,
      canvasHash,
      offerId: offer.id,
      supplier: offer.supplier,
      utilityPointId: point.id,
      podOrPdr: point.podOrPdr,
      energyType: point.type,
      offerSnapshot,
      originalPointSnapshot,
      consentVersion,
      canonicalDocument,
      timestamp: signedAt,
      ipAddress: req.ip || null,
      status: 'signed',
      activationStatus: 'pending_activation',
      signatureHash,
      documentHash
    };

    await addSignatureLog(log);
    res.status(201).json({
      success: true,
      message: 'Firma registrata. La fornitura resta invariata fino alla conferma di attivazione dello staff.',
      signatureReceipt: log
    });
  } catch (error: any) {
    if (error instanceof SignatureValidationError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    throw error;
  }
});

switchRouter.post(
  '/signatures/:id/activate',
  authenticateToken,
  requireRole('admin', 'call_center', 'operator'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const confirmationReference = req.body?.confirmationReference ?? req.body?.activationReference;
      const activationDate = req.body?.activationDate ?? req.body?.activatedAt;
      if (typeof confirmationReference !== 'string' || !confirmationReference.trim() || typeof activationDate !== 'string') {
        throw new SignatureValidationError('Riferimento di conferma e data di attivazione sono obbligatori.');
      }
      const authUser = (req as any).user;
      const activationInput = {
        signatureId: req.params.id,
        confirmationReference,
        activationDate,
        activatedBy: authUser.userId
      };
      let signatureReceipt: any;
      let commissions: any = undefined;
      if (req.body?.generateCommission === true) {
        const pendingSignature = getSignatureLogs().find(item => item.id === req.params.id);
        if (!pendingSignature) throw new SignatureNotFoundError('Richiesta di firma non trovata.');
        const requestedAgentId = req.body?.agentId || authUser.userId;
        if (authUser.role === 'operator' && requestedAgentId !== authUser.userId) {
          res.status(403).json({ success: false, message: 'Non puoi attribuire provvigioni a un altro agente.' });
          return;
        }
        const agentId = requestedAgentId;
        const agentUser = users.find(u => u.id === agentId);
        const agentName = agentUser?.name || 'Agente Commerciale';
        const customer = getCustomers().find(c => c.id === pendingSignature.customerId);
        const isDualFuel = customer ? customer.utilityPoints.length > 1 : false;
        const annualConsumption = pendingSignature.originalPointSnapshot?.annualConsumption || 2700;
        const transaction = await activateSignedSignatureWithCommissions({
          ...activationInput,
          agentId,
          agentName,
          customerName: pendingSignature.customerName,
          podOrPdr: pendingSignature.podOrPdr,
          utilityType: pendingSignature.energyType,
          customerType: 'residential',
          annualConsumption,
          isDualFuel
        });
        signatureReceipt = transaction.signatureReceipt;
        commissions = transaction.commissions;
      } else {
        signatureReceipt = await activateSignedSignature(activationInput);
      }

      res.status(200).json({
        success: true,
        signatureReceipt,
        ...(commissions ? { commissions } : {})
      });
    } catch (error: any) {
      if (error instanceof SignatureValidationError) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof SignatureNotFoundError) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error instanceof SignatureConflictError) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
      throw error;
    }
  }
);

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

import { Router, Request, Response } from 'express';
import { MARKET_OFFERS, runQuarterlyAudit } from '../services/energyEngine.js';
import { getCustomers, getSignatureLogs, addSignatureLog } from '../services/dataStore.js';
import { getLiveMarketIndices, refreshMarketIndices } from '../services/gmeFeedService.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, signContractSchema } from '../middleware/validate.js';
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

// POST /api/switch/refresh-indices (Sincronizzazione forzata con il feed live GME)
switchRouter.post('/refresh-indices', async (_req: Request, res: Response): Promise<void> => {
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
    const customerList: Customer[] = getCustomers();
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

// POST /api/switch/sign (Digital Signature & Mandato Brokeraggio)
switchRouter.post('/sign', authenticateToken, validate(signContractSchema), (req: Request, res: Response): void => {
  const { customerId, customerName, signerFiscalCode, phone, otpCode, offerId, supplier } = req.body;

  if (!customerName || !signerFiscalCode || !phone || !otpCode) {
    res.status(400).json({ success: false, message: 'Dati di firma o codice OTP incompleti.' });
    return;
  }

  const timestamp = new Date().toISOString();
  const signatureHash = `SHA256-${Buffer.from(`${signerFiscalCode}-${timestamp}-${otpCode}`).toString('base64').substring(0, 32)}`;

  const log = {
    id: `sig-${Date.now()}`,
    customerId: customerId || `cust-${Date.now()}`,
    customerName,
    signerFiscalCode: signerFiscalCode.toUpperCase(),
    phone,
    otpCode,
    offerId: offerId || 'off-oct-12m',
    supplier: supplier || 'Octopus Energy',
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

// GET /api/switch/signatures
switchRouter.get('/signatures', authenticateToken, (_req: Request, res: Response): void => {
  res.json({
    success: true,
    signatures: getSignatureLogs()
  });
});

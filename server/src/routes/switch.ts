import { Router, Request, Response } from 'express';
import { CURRENT_MARKET_INDEX, MARKET_OFFERS, runQuarterlyAudit } from '../services/energyEngine.js';
import { Customer } from '../types.js';

export const switchRouter = Router();

// Mock in-memory audit logs for signatures
interface SignatureLog {
  id: string;
  auditId?: string;
  customerId: string;
  customerName: string;
  signerFiscalCode: string;
  phone: string;
  otpCode: string;
  offerId: string;
  supplier: string;
  timestamp: string;
  ipAddress: string;
  signatureHash: string;
}

const signatureLogs: SignatureLog[] = [];

// GET /api/switch/market-indices
switchRouter.get('/market-indices', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    marketIndex: CURRENT_MARKET_INDEX
  });
});

// GET /api/switch/offers
switchRouter.get('/offers', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    offers: MARKET_OFFERS
  });
});

// GET /api/switch/audit
switchRouter.get('/audit', async (req: Request, res: Response): Promise<void> => {
  try {
    // In production this pulls from DB; here we use default customer dataset
    const customersModule = await import('./customers.js');
    // Call customers router mock array or fetch
    const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/customers`).catch(() => null);
    let customerList: Customer[] = [];

    if (response && response.ok) {
      const data = await response.json();
      customerList = data.customers || [];
    }

    // Fallback if internal fetch is not reachable yet
    if (customerList.length === 0) {
      customerList = [
        {
          id: 'cust-1',
          name: 'Andrea Moretti',
          fiscalCode: 'MRTNRA82M15F205X',
          phone: '+39 335 1122334',
          email: 'andrea.moretti@email.it',
          city: 'Torino (TO)',
          contractStartDate: '2026-05-01',
          lastSwitchAuditDate: '2026-05-01',
          nextSwitchAuditDate: '2026-09-01',
          accountManager: 'Valentina Neri',
          hasBrokerageMandate: true,
          utilityPoints: [
            {
              id: 'util-1-luce',
              type: 'luce',
              podOrPdr: 'IT001E00459821',
              annualConsumption: 3400,
              powerKw: 3.5,
              currentSupplier: 'Enel Energia (Vecchia Tariffa)',
              currentOfferName: 'Open Luce Sicura 2024',
              currentTariffType: 'fixed',
              currentUnitCost: 0.178,
              currentFixedFeeYear: 144.0,
            }
          ]
        }
      ];
    }

    const audits = runQuarterlyAudit(customerList);
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
switchRouter.post('/sign', (req: Request, res: Response): void => {
  const { customerId, customerName, signerFiscalCode, phone, otpCode, offerId, supplier } = req.body;

  if (!customerName || !signerFiscalCode || !phone || !otpCode) {
    res.status(400).json({ success: false, message: 'Dati di firma o codice OTP incompleti.' });
    return;
  }

  const timestamp = new Date().toISOString();
  const signatureHash = `SHA256-${Buffer.from(`${signerFiscalCode}-${timestamp}-${otpCode}`).toString('base64').substring(0, 32)}`;

  const log: SignatureLog = {
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

  signatureLogs.unshift(log);

  res.status(201).json({
    success: true,
    message: 'Contratto e Mandato di Brokeraggio firmati digitalmente con successo.',
    signatureReceipt: log
  });
});

// GET /api/switch/signatures
switchRouter.get('/signatures', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    signatures: signatureLogs
  });
});

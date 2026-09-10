import { Router, Request, Response } from 'express';
import { 
  getCommissions, 
  getAgentSummaries, 
  getSettlementBatches, 
  generateContractCommissions, 
  settleCommissions,
  CommissionFilters,
  ContractCommissionInput,
  SettleCommissionInput
} from '../services/commissionService.js';
import { CommissionStatus, CommissionType } from '../types.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const commissionRouter = Router();

// Tutte le rotte provvigionali richiedono token JWT valido
commissionRouter.use(authenticateToken);

// GET /api/commissions/summaries - Riepiloghi aggregati e KPI per agente
commissionRouter.get('/summaries', (_req: Request, res: Response): void => {
  const summaries = getAgentSummaries();
  res.json({
    success: true,
    summaries
  });
});

// GET /api/commissions/batches - Elenco distinte di bonifico emesse
commissionRouter.get('/batches', (req: Request, res: Response): void => {
  const agentId = req.query.agentId as string | undefined;
  const batches = getSettlementBatches(agentId);
  res.json({
    success: true,
    batches
  });
});

// GET /api/commissions - Elenco completo provvigioni con filtri
commissionRouter.get('/', (req: Request, res: Response): void => {
  const filters: CommissionFilters = {
    agentId: req.query.agentId as string | undefined,
    status: req.query.status as CommissionStatus | undefined,
    period: req.query.period as string | undefined,
    type: req.query.type as CommissionType | undefined,
  };

  const commissions = getCommissions(filters);
  res.json({
    success: true,
    count: commissions.length,
    commissions
  });
});

// POST /api/commissions/generate - Calcolo automatico provvigione su nuovo contratto
commissionRouter.post('/generate', (req: Request, res: Response): void => {
  const body = req.body as ContractCommissionInput;

  if (!body.agentId || !body.customerName || !body.utilityType) {
    res.status(400).json({
      success: false,
      message: 'Campi obbligatori mancanti: agentId, customerName, utilityType.'
    });
    return;
  }

  const result = generateContractCommissions({
    agentId: body.agentId,
    agentName: body.agentName || 'Agente Commerciale',
    contractId: body.contractId || `cnt-${Date.now()}`,
    customerName: body.customerName,
    podOrPdr: body.podOrPdr || 'IT001EXXXXXXXX',
    utilityType: body.utilityType,
    customerType: body.customerType || 'residential',
    annualConsumption: Number(body.annualConsumption) || 3000,
    isDualFuel: Boolean(body.isDualFuel)
  });

  res.status(201).json({
    success: true,
    message: 'Provvigioni contrattuali registrate con successo.',
    records: result.records,
    totalEur: result.totalEur
  });
});

// POST /api/commissions/settle - Liquidazione distinte provvigionali (riservato amministratori)
commissionRouter.post('/settle', requireRole('admin'), (req: Request, res: Response): void => {
  const body = req.body as SettleCommissionInput;

  if (!body.agentId || !body.commissionIds || !Array.isArray(body.commissionIds) || body.commissionIds.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Specificare agentId e un array valido di commissionIds da liquidare.'
    });
    return;
  }

  const result = settleCommissions({
    agentId: body.agentId,
    commissionIds: body.commissionIds,
    paymentReference: body.paymentReference,
    notes: body.notes
  });

  res.status(200).json({
    success: true,
    message: `Distinta di liquidazione generata con successo per ${result.updatedCount} record.`,
    batch: result.batch,
    updatedCount: result.updatedCount
  });
});

import { Router, Request, Response, NextFunction } from 'express';
import {
  getCommissions,
  getAgentSummaries,
  getSettlementBatches,
  generateContractCommissions,
  settleCommissions,
  CommissionFilters,
  ContractCommissionInput,
  SettleCommissionInput,
  CommissionInputError
} from '../services/commissionService.js';
import { CommissionStatus, CommissionType } from '../types.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const commissionRouter = Router();

commissionRouter.use(authenticateToken);
commissionRouter.use(requireRole('admin', 'call_center', 'operator'));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function ownAgentScope(req: Request, requestedAgentId?: string): string | undefined {
  const authUser = (req as any).user;
  return authUser?.role === 'admin' ? requestedAgentId : authUser?.userId;
}

function sendInputError(res: Response, message: string): void {
  res.status(400).json({ success: false, message });
}

commissionRouter.get('/summaries', async (req: Request, res: Response): Promise<void> => {
  const requestedAgentId = isNonEmptyString(req.query.agentId) ? req.query.agentId : undefined;
  const summaries = await getAgentSummaries(ownAgentScope(req, requestedAgentId));
  res.json({ success: true, summaries });
});

commissionRouter.get('/batches', async (req: Request, res: Response): Promise<void> => {
  const requestedAgentId = isNonEmptyString(req.query.agentId) ? req.query.agentId : undefined;
  const batches = await getSettlementBatches(ownAgentScope(req, requestedAgentId));
  res.json({ success: true, batches });
});

commissionRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const requestedAgentId = isNonEmptyString(req.query.agentId) ? req.query.agentId : undefined;
  const filters: CommissionFilters = {
    agentId: ownAgentScope(req, requestedAgentId),
    status: req.query.status as CommissionStatus | undefined,
    period: req.query.period as string | undefined,
    type: req.query.type as CommissionType | undefined
  };
  const commissions = await getCommissions(filters);
  res.json({ success: true, count: commissions.length, commissions });
});

commissionRouter.post('/generate', requireRole('admin', 'call_center'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const body = req.body as Partial<ContractCommissionInput>;
  const missing = ['agentId', 'customerName', 'contractId', 'podOrPdr', 'utilityType']
    .filter(field => !isNonEmptyString((body as any)[field]));
  if (missing.length > 0) {
    sendInputError(res, `Campi obbligatori mancanti o vuoti: ${missing.join(', ')}.`);
    return;
  }
  if (body.utilityType !== 'luce' && body.utilityType !== 'gas') {
    sendInputError(res, 'utilityType deve essere luce o gas.');
    return;
  }
  if (body.customerType !== undefined && body.customerType !== 'residential' && body.customerType !== 'business') {
    sendInputError(res, 'customerType deve essere residential o business.');
    return;
  }
  if (typeof body.annualConsumption !== 'number' || !Number.isFinite(body.annualConsumption) || body.annualConsumption < 0) {
    sendInputError(res, 'annualConsumption deve essere un numero finito non negativo.');
    return;
  }
  if (body.isDualFuel !== undefined && typeof body.isDualFuel !== 'boolean') {
    sendInputError(res, 'isDualFuel deve essere un valore booleano.');
    return;
  }
  const authUser = (req as any).user;
  if (authUser?.role !== 'admin' && body.agentId !== authUser?.userId) {
    res.status(403).json({ success: false, message: 'Non puoi generare provvigioni per un altro agente.' });
    return;
  }

  try {
    const result = await generateContractCommissions({
      agentId: body.agentId!,
      agentName: isNonEmptyString(body.agentName) ? body.agentName : 'Agente Commerciale',
      contractId: body.contractId!,
      customerName: body.customerName!,
      podOrPdr: body.podOrPdr!,
      utilityType: body.utilityType,
      customerType: body.customerType ?? 'residential',
      annualConsumption: body.annualConsumption,
      isDualFuel: body.isDualFuel ?? false
    });
    res.status(201).json({
      success: true,
      message: 'Provvigioni contrattuali registrate con successo.',
      records: result.records,
      totalEur: result.totalEur
    });
  } catch (error) {
    if (error instanceof CommissionInputError) {
      sendInputError(res, error.message);
      return;
    }
    next(error);
  }
});

commissionRouter.post('/settle', requireRole('admin'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const body = req.body as Partial<SettleCommissionInput>;
  if (!isNonEmptyString(body.agentId) || !Array.isArray(body.commissionIds) || body.commissionIds.length === 0 || body.commissionIds.some(id => !isNonEmptyString(id))) {
    sendInputError(res, 'Specificare agentId e un array non vuoto di commissionIds validi.');
    return;
  }
  if (body.paymentReference !== undefined && !isNonEmptyString(body.paymentReference)) {
    sendInputError(res, 'paymentReference deve essere una stringa non vuota.');
    return;
  }
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    sendInputError(res, 'notes deve essere una stringa.');
    return;
  }

  try {
    const result = await settleCommissions({
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
  } catch (error) {
    if (error instanceof CommissionInputError) {
      sendInputError(res, error.message);
      return;
    }
    next(error);
  }
});

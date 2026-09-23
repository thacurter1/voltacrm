import { createHash } from 'node:crypto';
import { CommissionRecord, AgentCommissionSummary, SettlementBatch, CommissionType, CommissionStatus } from '../types.js';
import { supabase, isSupabaseConfigured } from './dbClient.js';

const DEMO_COMMISSIONS: CommissionRecord[] = [
  { id: 'comm-cb-101', agentId: 'user-op-2', agentName: 'Chiara Bianchi (Consulente Senior)', contractId: 'cnt-2026-8801', customerName: 'Giuseppe Verdi', podOrPdr: 'IT001E83748291', utilityType: 'luce', customerType: 'residential', annualConsumption: 3400, type: 'upfront', amountEur: 45, status: 'accrued', period: '2026-09', accrualDate: '2026-09-02', notes: 'Switch Octopus Fissa 12M' },
  { id: 'comm-cb-102', agentId: 'user-op-2', agentName: 'Chiara Bianchi (Consulente Senior)', contractId: 'cnt-2026-8801', customerName: 'Giuseppe Verdi', podOrPdr: 'IT001E83748291', utilityType: 'luce', customerType: 'residential', annualConsumption: 3400, type: 'recurring', amountEur: 8.5, status: 'accrued', period: '2026-09', accrualDate: '2026-09-02', notes: 'Canone mantenimento mensile' },
  { id: 'comm-cb-103', agentId: 'user-op-2', agentName: 'Chiara Bianchi (Consulente Senior)', contractId: 'cnt-2026-8802', customerName: 'Studio Legale Rossi & Partners', podOrPdr: 'IT001E99441122', utilityType: 'luce', customerType: 'business', annualConsumption: 18000, type: 'upfront', amountEur: 95, status: 'accrued', period: '2026-09', accrualDate: '2026-09-05', notes: 'Contratto Business A2A Easy Luce' },
  { id: 'comm-cb-104', agentId: 'user-op-2', agentName: 'Chiara Bianchi (Consulente Senior)', contractId: 'cnt-2026-8803', customerName: 'Marco Bellini', podOrPdr: '00882736192837', utilityType: 'gas', customerType: 'residential', annualConsumption: 1200, type: 'upfront', amountEur: 40, status: 'pending', period: '2026-09', accrualDate: '2026-09-08', notes: 'In attivazione presso distributore locale (Italgas)' },
  { id: 'comm-cb-100', agentId: 'user-op-2', agentName: 'Chiara Bianchi (Consulente Senior)', contractId: 'cnt-2026-7701', customerName: 'Laura Gatti', podOrPdr: 'IT001E77221199', utilityType: 'luce', customerType: 'residential', annualConsumption: 2800, type: 'upfront', amountEur: 45, status: 'settled', period: '2026-08', accrualDate: '2026-08-10', settlementDate: '2026-08-31', paymentReference: 'DIST-2026-08-CB-0042', notes: 'Liquidata con bonifico fine mese' },
  { id: 'comm-mr-201', agentId: 'user-admin-1', agentName: 'Matteo Riva (Broker Owner)', contractId: 'cnt-2026-9001', customerName: 'Officine Meccaniche Briantee SpA', podOrPdr: 'IT001E55443322', utilityType: 'luce', customerType: 'business', annualConsumption: 65000, type: 'upfront', amountEur: 150, status: 'accrued', period: '2026-09', accrualDate: '2026-09-03', notes: 'Grande Utenza Media Tensione' },
  { id: 'comm-mr-202', agentId: 'user-admin-1', agentName: 'Matteo Riva (Broker Owner)', contractId: 'cnt-2026-9001', customerName: 'Officine Meccaniche Briantee SpA', podOrPdr: 'IT001E55443322', utilityType: 'luce', customerType: 'business', annualConsumption: 65000, type: 'recurring', amountEur: 16.25, status: 'accrued', period: '2026-09', accrualDate: '2026-09-03', notes: 'Mantenimento portafoglio PMI' },
  { id: 'comm-mr-200', agentId: 'user-admin-1', agentName: 'Matteo Riva (Broker Owner)', contractId: 'cnt-2026-7901', customerName: 'Pasticceria Duomo', podOrPdr: 'IT001E66112233', utilityType: 'luce', customerType: 'business', annualConsumption: 22000, type: 'upfront', amountEur: 95, status: 'settled', period: '2026-08', accrualDate: '2026-08-15', settlementDate: '2026-08-31', paymentReference: 'DIST-2026-08-MR-0041', notes: 'Liquidata con bonifico' }
];

const DEMO_BATCHES: SettlementBatch[] = [
  { id: 'batch-2026-08-cb', agentId: 'user-op-2', agentName: 'Chiara Bianchi (Consulente Senior)', settlementDate: '2026-08-31', paymentReference: 'DIST-2026-08-CB-0042', period: '2026-08', totalAmountEur: 45, commissionCount: 1, notes: 'Liquidazione competenze Agosto 2026' },
  { id: 'batch-2026-08-mr', agentId: 'user-admin-1', agentName: 'Matteo Riva (Broker Owner)', settlementDate: '2026-08-31', paymentReference: 'DIST-2026-08-MR-0041', period: '2026-08', totalAmountEur: 95, commissionCount: 1, notes: 'Liquidazione competenze Agosto 2026' }
];

let commissions = DEMO_COMMISSIONS.map(record => ({ ...record }));
let settlementBatches = DEMO_BATCHES.map(batch => ({ ...batch }));

interface MemoryGeneration {
  agentId: string;
  fingerprint: string;
  recordIds: string[];
}

interface MemorySettlement {
  agentId: string;
  commissionIds: string[];
  batchId: string;
}

const memoryGenerations = new Map<string, MemoryGeneration>();
const memorySettlements = new Map<string, MemorySettlement>();

export class CommissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommissionInputError';
  }
}

export interface CommissionFilters {
  agentId?: string;
  status?: CommissionStatus;
  period?: string;
  type?: CommissionType;
}

export interface ContractCommissionInput {
  agentId: string;
  agentName: string;
  contractId: string;
  customerName: string;
  podOrPdr: string;
  utilityType: 'luce' | 'gas';
  customerType?: 'residential' | 'business';
  annualConsumption: number;
  isDualFuel?: boolean;
}

export interface SettleCommissionInput {
  agentId: string;
  commissionIds: string[];
  paymentReference?: string;
  notes?: string;
}

interface GenerationResult {
  records: CommissionRecord[];
  totalEur: number;
}

interface SettlementResult {
  batch: SettlementBatch;
  updatedCount: number;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CommissionInputError(`${field} is required.`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new CommissionInputError('Optional text values must be strings.');
  const normalized = value.trim();
  return normalized || undefined;
}

function stableHash(...values: string[]): string {
  return createHash('sha256').update(values.join('\u001f')).digest('hex');
}

function normalizeGenerationInput(input: ContractCommissionInput): Required<ContractCommissionInput> {
  const utilityType = requiredText(input.utilityType, 'utilityType');
  if (utilityType !== 'luce' && utilityType !== 'gas') {
    throw new CommissionInputError('utilityType must be either luce or gas.');
  }
  const customerType = input.customerType ?? 'residential';
  if (customerType !== 'residential' && customerType !== 'business') {
    throw new CommissionInputError('customerType must be either residential or business.');
  }
  const annualConsumption = input.annualConsumption;
  if (typeof annualConsumption !== 'number' || !Number.isFinite(annualConsumption) || annualConsumption < 0) {
    throw new CommissionInputError('annualConsumption must be a finite non-negative number.');
  }
  if (input.isDualFuel !== undefined && typeof input.isDualFuel !== 'boolean') {
    throw new CommissionInputError('isDualFuel must be a boolean.');
  }
  return {
    agentId: requiredText(input.agentId, 'agentId'),
    agentName: requiredText(input.agentName, 'agentName'),
    contractId: requiredText(input.contractId, 'contractId'),
    customerName: requiredText(input.customerName, 'customerName'),
    podOrPdr: requiredText(input.podOrPdr, 'podOrPdr'),
    utilityType,
    customerType,
    annualConsumption,
    isDualFuel: input.isDualFuel ?? false
  };
}

function normalizeSettlementInput(input: SettleCommissionInput): Required<SettleCommissionInput> {
  if (!Array.isArray(input.commissionIds)) throw new CommissionInputError('commissionIds must be an array.');
  const commissionIds = [...new Set(input.commissionIds.map(id => requiredText(id, 'commissionIds')))].sort();
  if (commissionIds.length === 0) throw new CommissionInputError('At least one commissionId is required.');
  return {
    agentId: requiredText(input.agentId, 'agentId'),
    commissionIds,
    paymentReference: optionalText(input.paymentReference) ?? '',
    notes: optionalText(input.notes) ?? ''
  };
}

function mapCommission(row: any): CommissionRecord {
  return {
    id: String(row.id), agentId: String(row.agent_id), agentName: String(row.agent_name),
    contractId: String(row.contract_id), customerName: String(row.customer_name),
    podOrPdr: String(row.pod_or_pdr), utilityType: row.utility_type,
    customerType: row.customer_type ?? undefined, annualConsumption: Number(row.annual_consumption),
    type: row.type, amountEur: Number(row.amount_eur), status: row.status, period: String(row.period),
    accrualDate: String(row.accrual_date), settlementDate: row.settlement_date ?? undefined,
    paymentReference: row.payment_reference ?? undefined, notes: row.notes ?? undefined
  };
}

function mapBatch(row: any): SettlementBatch {
  return {
    id: String(row.id), agentId: String(row.agent_id), agentName: String(row.agent_name),
    settlementDate: String(row.settlement_date), paymentReference: String(row.payment_reference),
    period: String(row.period), totalAmountEur: Number(row.total_amount_eur),
    commissionCount: Number(row.commission_count), notes: row.notes ?? undefined
  };
}

function throwDatabaseError(operation: string, error: any): never {
  const message = error?.message || 'Unknown database error';
  if (error?.code === 'P0001' || error?.code === '23505') throw new CommissionInputError(message);
  throw new Error(`${operation}: ${message}`);
}

function unwrapRpcPayload(data: any): any {
  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

export async function getCommissions(filters?: CommissionFilters): Promise<CommissionRecord[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('commissions').select('*').order('accrual_date', { ascending: false });
    if (filters?.agentId) query = query.eq('agent_id', filters.agentId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.period) query = query.eq('period', filters.period);
    if (filters?.type) query = query.eq('type', filters.type);
    const { data, error } = await query;
    if (error) throwDatabaseError('Unable to read commissions', error);
    return (data ?? []).map(mapCommission);
  }
  let result = [...commissions];
  if (filters?.agentId) result = result.filter(record => record.agentId === filters.agentId);
  if (filters?.status) result = result.filter(record => record.status === filters.status);
  if (filters?.period) result = result.filter(record => record.period === filters.period);
  if (filters?.type) result = result.filter(record => record.type === filters.type);
  return result.sort((a, b) => b.accrualDate.localeCompare(a.accrualDate));
}

export async function getAgentSummaries(agentId?: string): Promise<AgentCommissionSummary[]> {
  const records = await getCommissions(agentId ? { agentId } : undefined);
  const agents = new Map<string, { agentName: string; role: string }>();
  if (!isSupabaseConfigured) {
    agents.set('user-admin-1', { agentName: 'Matteo Riva (Broker Owner)', role: 'admin' });
    agents.set('user-op-2', { agentName: 'Chiara Bianchi (Consulente Senior)', role: 'operator' });
    agents.set('user-op-3', { agentName: 'Valentina Neri (Consulente Energetico)', role: 'operator' });
  }
  for (const record of records) {
    if (!agents.has(record.agentId)) agents.set(record.agentId, { agentName: record.agentName, role: 'operator' });
  }
  const summaries: AgentCommissionSummary[] = [];
  for (const [currentAgentId, info] of agents.entries()) {
    if (agentId && currentAgentId !== agentId) continue;
    const agentRecords = records.filter(record => record.agentId === currentAgentId);
    const pending = agentRecords.filter(record => record.status === 'pending');
    const accrued = agentRecords.filter(record => record.status === 'accrued');
    const settled = agentRecords.filter(record => record.status === 'settled');
    const amount = (items: CommissionRecord[]) => Number(items.reduce((sum, record) => sum + record.amountEur, 0).toFixed(2));
    const accruedAmountEur = amount(accrued);
    const settledAmountEur = amount(settled);
    summaries.push({
      agentId: currentAgentId, agentName: info.agentName, role: info.role,
      pendingCount: pending.length, pendingAmountEur: amount(pending),
      accruedCount: accrued.length, accruedAmountEur,
      settledCount: settled.length, settledAmountEur,
      totalEarnedEur: Number((accruedAmountEur + settledAmountEur).toFixed(2)),
      contractsCount: new Set(agentRecords.map(record => record.contractId)).size
    });
  }
  return summaries.sort((a, b) => b.totalEarnedEur - a.totalEarnedEur);
}

function buildMemoryRecords(input: Required<ContractCommissionInput>, period: string, today: string): CommissionRecord[] {
  const isBusiness = input.customerType === 'business' || input.annualConsumption > 6000;
  const common = {
    agentId: input.agentId, agentName: input.agentName, contractId: input.contractId,
    customerName: input.customerName, podOrPdr: input.podOrPdr, utilityType: input.utilityType,
    customerType: isBusiness ? 'business' as const : 'residential' as const,
    annualConsumption: input.annualConsumption, status: 'accrued' as const, period, accrualDate: today
  };
  const records: CommissionRecord[] = [];
  const add = (type: CommissionType, amountEur: number, notes: string) => records.push({
    ...common, id: `comm-${stableHash(input.contractId, input.podOrPdr, type, period).slice(0, 32)}`,
    type, amountEur, notes
  });
  const upfrontAmount = input.utilityType === 'luce' ? (isBusiness ? 95 : 45) : (isBusiness ? 85 : 40);
  add('upfront', upfrontAmount, `Gettone attivazione ${input.utilityType.toUpperCase()} (${isBusiness ? 'Business' : 'Residenziale'})`);
  if (input.isDualFuel) add('bonus', 25, 'Bonus promozionale Dual Fuel (Luce + Gas)');
  const rate = input.utilityType === 'luce' ? 0.0025 : 0.015;
  const monthlyRecurring = Number(((input.annualConsumption * rate) / 12).toFixed(2));
  if (monthlyRecurring > 0) add('recurring', Math.max(1, monthlyRecurring), `Mantenimento portafoglio mese (${input.annualConsumption} ${input.utilityType === 'luce' ? 'kWh' : 'Smc'}/anno)`);
  return records;
}

export async function generateContractCommissions(input: ContractCommissionInput): Promise<GenerationResult> {
  const normalized = normalizeGenerationInput(input);
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('generate_contract_commissions', {
      p_agent_id: normalized.agentId, p_agent_name: normalized.agentName,
      p_contract_id: normalized.contractId, p_customer_name: normalized.customerName,
      p_pod_or_pdr: normalized.podOrPdr, p_utility_type: normalized.utilityType,
      p_customer_type: normalized.customerType, p_annual_consumption: normalized.annualConsumption,
      p_is_dual_fuel: normalized.isDualFuel
    });
    if (error) throwDatabaseError('Unable to generate commissions', error);
    const payload = unwrapRpcPayload(data);
    if (!payload || !Array.isArray(payload.records)) throw new Error('Database returned an invalid commission generation result.');
    const records = payload.records.map(mapCommission);
    return { records, totalEur: Number(payload.totalEur ?? payload.total_eur ?? 0) };
  }

  const key = `${normalized.contractId}\u001f${normalized.podOrPdr}`;
  const fingerprint = stableHash(normalized.agentName, normalized.customerName, normalized.utilityType, normalized.customerType, String(normalized.annualConsumption), String(normalized.isDualFuel));
  const registered = memoryGenerations.get(key);
  if (registered) {
    if (registered.agentId !== normalized.agentId) throw new CommissionInputError('This contract and POD/PDR generation belongs to another agent.');
    if (registered.fingerprint !== fingerprint) throw new CommissionInputError('This generation retry does not match the original request.');
    const records = registered.recordIds.map(id => commissions.find(record => record.id === id)).filter(Boolean) as CommissionRecord[];
    return { records, totalEur: Number(records.reduce((sum, record) => sum + record.amountEur, 0).toFixed(2)) };
  }
  const existing = commissions.filter(record => record.contractId === normalized.contractId && record.podOrPdr === normalized.podOrPdr);
  if (existing.length > 0) {
    if (existing.some(record => record.agentId !== normalized.agentId)) throw new CommissionInputError('This contract and POD/PDR generation belongs to another agent.');
    memoryGenerations.set(key, { agentId: normalized.agentId, fingerprint, recordIds: existing.map(record => record.id) });
    return { records: existing, totalEur: Number(existing.reduce((sum, record) => sum + record.amountEur, 0).toFixed(2)) };
  }
  const now = new Date().toISOString();
  const generated = buildMemoryRecords(normalized, now.slice(0, 7), now.slice(0, 10));
  commissions = [...commissions, ...generated];
  memoryGenerations.set(key, { agentId: normalized.agentId, fingerprint, recordIds: generated.map(record => record.id) });
  return { records: generated, totalEur: Number(generated.reduce((sum, record) => sum + record.amountEur, 0).toFixed(2)) };
}

export async function settleCommissions(input: SettleCommissionInput): Promise<SettlementResult> {
  const normalized = normalizeSettlementInput(input);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const period = now.slice(0, 7);
  const batchId = `batch-${stableHash(normalized.agentId, ...normalized.commissionIds).slice(0, 32)}`;
  const paymentReference = normalized.paymentReference || `DIST-${stableHash(normalized.agentId, ...normalized.commissionIds).slice(0, 16).toUpperCase()}`;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('settle_commissions', {
      p_agent_id: normalized.agentId, p_commission_ids: normalized.commissionIds,
      p_batch_id: batchId, p_payment_reference: paymentReference, p_notes: normalized.notes || null
    });
    if (error) throwDatabaseError('Unable to settle commissions', error);
    const payload = unwrapRpcPayload(data);
    if (!payload?.batch) throw new Error('Database returned an invalid settlement result.');
    return { batch: mapBatch(payload.batch), updatedCount: Number(payload.updatedCount ?? payload.updated_count ?? 0) };
  }

  const prior = memorySettlements.get(batchId);
  if (prior) {
    const batch = settlementBatches.find(item => item.id === prior.batchId);
    if (!batch || prior.agentId !== normalized.agentId || prior.commissionIds.join('\u001f') !== normalized.commissionIds.join('\u001f')) throw new CommissionInputError('Settlement retry does not match the original batch.');
    if (normalized.paymentReference && normalized.paymentReference !== batch.paymentReference) throw new CommissionInputError('Settlement retry uses a different payment reference.');
    return { batch, updatedCount: batch.commissionCount };
  }
  if (settlementBatches.some(batch => batch.paymentReference === paymentReference)) throw new CommissionInputError('paymentReference is already used by another settlement batch.');
  const selected = normalized.commissionIds.map(id => commissions.find(record => record.id === id));
  if (selected.some(record => !record) || selected.some(record => record?.agentId !== normalized.agentId || record.status !== 'accrued')) {
    throw new CommissionInputError('All selected commissions must exist, belong to the agent, and be eligible accrued records.');
  }
  const eligible = selected as CommissionRecord[];
  const agentName = eligible[0].agentName;
  const totalAmountEur = Number(eligible.reduce((sum, record) => sum + record.amountEur, 0).toFixed(2));
  const batch: SettlementBatch = {
    id: batchId, agentId: normalized.agentId, agentName, settlementDate: today,
    paymentReference, period, totalAmountEur, commissionCount: eligible.length,
    notes: normalized.notes || `Liquidazione saldo provvigionale del ${today}`
  };
  const selectedSet = new Set(normalized.commissionIds);
  commissions = commissions.map(record => selectedSet.has(record.id) ? { ...record, status: 'settled', settlementDate: today, paymentReference } : record);
  settlementBatches = [batch, ...settlementBatches];
  memorySettlements.set(batchId, { agentId: normalized.agentId, commissionIds: normalized.commissionIds, batchId });
  return { batch, updatedCount: eligible.length };
}

export async function getSettlementBatches(agentId?: string): Promise<SettlementBatch[]> {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('settlement_batches').select('*').order('settlement_date', { ascending: false });
    if (agentId) query = query.eq('agent_id', agentId);
    const { data, error } = await query;
    if (error) throwDatabaseError('Unable to read settlement batches', error);
    return (data ?? []).map(mapBatch);
  }
  return settlementBatches.filter(batch => !agentId || batch.agentId === agentId).map(batch => ({ ...batch }));
}

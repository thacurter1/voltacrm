import { CommissionRecord, AgentCommissionSummary, SettlementBatch, CommissionType, CommissionStatus } from '../types.js';

// Dati in-memory per provvigioni e distinte
let COMMISSIONS: CommissionRecord[] = [
  // Chiara Bianchi (user-op-2)
  {
    id: 'comm-cb-101',
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId: 'cnt-2026-8801',
    customerName: 'Giuseppe Verdi',
    podOrPdr: 'IT001E83748291',
    utilityType: 'luce',
    customerType: 'residential',
    annualConsumption: 3400,
    type: 'upfront',
    amountEur: 45.00,
    status: 'accrued',
    period: '2026-09',
    accrualDate: '2026-09-02',
    notes: 'Switch Octopus Fissa 12M'
  },
  {
    id: 'comm-cb-102',
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId: 'cnt-2026-8801',
    customerName: 'Giuseppe Verdi',
    podOrPdr: 'IT001E83748291',
    utilityType: 'luce',
    customerType: 'residential',
    annualConsumption: 3400,
    type: 'recurring',
    amountEur: 8.50,
    status: 'accrued',
    period: '2026-09',
    accrualDate: '2026-09-02',
    notes: 'Canone mantenimento mensile (3400 kWh * 0.0025€)'
  },
  {
    id: 'comm-cb-103',
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId: 'cnt-2026-8802',
    customerName: 'Studio Legale Rossi & Partners',
    podOrPdr: 'IT001E99441122',
    utilityType: 'luce',
    customerType: 'business',
    annualConsumption: 18000,
    type: 'upfront',
    amountEur: 95.00,
    status: 'accrued',
    period: '2026-09',
    accrualDate: '2026-09-05',
    notes: 'Contratto Business A2A Easy Luce'
  },
  {
    id: 'comm-cb-104',
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId: 'cnt-2026-8803',
    customerName: 'Marco Bellini',
    podOrPdr: '00882736192837',
    utilityType: 'gas',
    customerType: 'residential',
    annualConsumption: 1200,
    type: 'upfront',
    amountEur: 40.00,
    status: 'pending',
    period: '2026-09',
    accrualDate: '2026-09-08',
    notes: 'In attivazione presso distributore locale (Italgas)'
  },
  {
    id: 'comm-cb-100',
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId: 'cnt-2026-7701',
    customerName: 'Laura Gatti',
    podOrPdr: 'IT001E77221199',
    utilityType: 'luce',
    customerType: 'residential',
    annualConsumption: 2800,
    type: 'upfront',
    amountEur: 45.00,
    status: 'settled',
    period: '2026-08',
    accrualDate: '2026-08-10',
    settlementDate: '2026-08-31',
    paymentReference: 'DIST-2026-08-CB-0042',
    notes: 'Liquidata con bonifico fine mese'
  },

  // Matteo Riva (user-admin-1)
  {
    id: 'comm-mr-201',
    agentId: 'user-admin-1',
    agentName: 'Matteo Riva (Broker Owner)',
    contractId: 'cnt-2026-9001',
    customerName: 'Officine Meccaniche Briantee SpA',
    podOrPdr: 'IT001E55443322',
    utilityType: 'luce',
    customerType: 'business',
    annualConsumption: 65000,
    type: 'upfront',
    amountEur: 150.00,
    status: 'accrued',
    period: '2026-09',
    accrualDate: '2026-09-03',
    notes: 'Grande Utenza Media Tensione'
  },
  {
    id: 'comm-mr-202',
    agentId: 'user-admin-1',
    agentName: 'Matteo Riva (Broker Owner)',
    contractId: 'cnt-2026-9001',
    customerName: 'Officine Meccaniche Briantee SpA',
    podOrPdr: 'IT001E55443322',
    utilityType: 'luce',
    customerType: 'business',
    annualConsumption: 65000,
    type: 'recurring',
    amountEur: 16.25,
    status: 'accrued',
    period: '2026-09',
    accrualDate: '2026-09-03',
    notes: 'Mantenimento portafoglio PMI (65.000 kWh * 0.003€ / 12)'
  },
  {
    id: 'comm-mr-200',
    agentId: 'user-admin-1',
    agentName: 'Matteo Riva (Broker Owner)',
    contractId: 'cnt-2026-7901',
    customerName: 'Pasticceria Duomo',
    podOrPdr: 'IT001E66112233',
    utilityType: 'luce',
    customerType: 'business',
    annualConsumption: 22000,
    type: 'upfront',
    amountEur: 95.00,
    status: 'settled',
    period: '2026-08',
    accrualDate: '2026-08-15',
    settlementDate: '2026-08-31',
    paymentReference: 'DIST-2026-08-MR-0041',
    notes: 'Liquidata con bonifico'
  }
];

let SETTLEMENT_BATCHES: SettlementBatch[] = [
  {
    id: 'batch-2026-08-cb',
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    settlementDate: '2026-08-31',
    paymentReference: 'DIST-2026-08-CB-0042',
    period: '2026-08',
    totalAmountEur: 45.00,
    commissionCount: 1,
    notes: 'Liquidazione competenze Agosto 2026'
  },
  {
    id: 'batch-2026-08-mr',
    agentId: 'user-admin-1',
    agentName: 'Matteo Riva (Broker Owner)',
    settlementDate: '2026-08-31',
    paymentReference: 'DIST-2026-08-MR-0041',
    period: '2026-08',
    totalAmountEur: 95.00,
    commissionCount: 1,
    notes: 'Liquidazione competenze Agosto 2026'
  }
];

export interface CommissionFilters {
  agentId?: string;
  status?: CommissionStatus;
  period?: string;
  type?: CommissionType;
}

/**
 * Ottiene l'elenco delle provvigioni filtrate
 */
export function getCommissions(filters?: CommissionFilters): CommissionRecord[] {
  let result = [...COMMISSIONS];

  if (filters?.agentId) {
    result = result.filter(c => c.agentId === filters.agentId);
  }
  if (filters?.status) {
    result = result.filter(c => c.status === filters.status);
  }
  if (filters?.period) {
    result = result.filter(c => c.period === filters.period);
  }
  if (filters?.type) {
    result = result.filter(c => c.type === filters.type);
  }

  // Ordina per data decrescente
  return result.sort((a, b) => new Date(b.accrualDate).getTime() - new Date(a.accrualDate).getTime());
}

/**
 * Calcola i riepiloghi e KPI per agente
 */
export function getAgentSummaries(): AgentCommissionSummary[] {
  const agentsMap = new Map<string, { agentName: string; role: string }>();

  // Raccogli gli agenti noti
  agentsMap.set('user-admin-1', { agentName: 'Matteo Riva (Broker Owner)', role: 'admin' });
  agentsMap.set('user-op-2', { agentName: 'Chiara Bianchi (Consulente Senior)', role: 'call_center' });
  agentsMap.set('user-op-3', { agentName: 'Marco Rossi (Junior Sales)', role: 'call_center' });

  // Raccogli anche agenti presenti nei record
  for (const c of COMMISSIONS) {
    if (!agentsMap.has(c.agentId)) {
      agentsMap.set(c.agentId, { agentName: c.agentName, role: 'call_center' });
    }
  }

  const summaries: AgentCommissionSummary[] = [];

  for (const [agentId, info] of agentsMap.entries()) {
    const agentRecords = COMMISSIONS.filter(c => c.agentId === agentId);
    
    const pendingRecords = agentRecords.filter(c => c.status === 'pending');
    const accruedRecords = agentRecords.filter(c => c.status === 'accrued');
    const settledRecords = agentRecords.filter(c => c.status === 'settled');

    const pendingAmountEur = pendingRecords.reduce((sum, r) => sum + r.amountEur, 0);
    const accruedAmountEur = accruedRecords.reduce((sum, r) => sum + r.amountEur, 0);
    const settledAmountEur = settledRecords.reduce((sum, r) => sum + r.amountEur, 0);

    // Contratti unici gestiti
    const contractsSet = new Set(agentRecords.map(r => r.contractId));

    summaries.push({
      agentId,
      agentName: info.agentName,
      role: info.role,
      pendingCount: pendingRecords.length,
      pendingAmountEur: Number(pendingAmountEur.toFixed(2)),
      accruedCount: accruedRecords.length,
      accruedAmountEur: Number(accruedAmountEur.toFixed(2)),
      settledCount: settledRecords.length,
      settledAmountEur: Number(settledAmountEur.toFixed(2)),
      totalEarnedEur: Number((accruedAmountEur + settledAmountEur).toFixed(2)),
      contractsCount: contractsSet.size
    });
  }

  return summaries.sort((a, b) => b.totalEarnedEur - a.totalEarnedEur);
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

/**
 * Calcola e genera le provvigioni spettanti per un nuovo contratto stipulato
 */
export function generateContractCommissions(input: ContractCommissionInput): { records: CommissionRecord[]; totalEur: number } {
  const isBusiness = input.customerType === 'business' || input.annualConsumption > 6000;
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const today = new Date().toISOString().split('T')[0];

  const generated: CommissionRecord[] = [];

  // 1. Gettone Upfront di Attivazione
  let upfrontAmount = 0;
  if (input.utilityType === 'luce') {
    upfrontAmount = isBusiness ? 95.00 : 45.00;
  } else {
    upfrontAmount = isBusiness ? 85.00 : 40.00;
  }

  const upfrontRecord: CommissionRecord = {
    id: `comm-${Date.now()}-upfront`,
    agentId: input.agentId,
    agentName: input.agentName,
    contractId: input.contractId,
    customerName: input.customerName,
    podOrPdr: input.podOrPdr,
    utilityType: input.utilityType,
    customerType: isBusiness ? 'business' : 'residential',
    annualConsumption: input.annualConsumption,
    type: 'upfront',
    amountEur: upfrontAmount,
    status: 'accrued',
    period,
    accrualDate: today,
    notes: `Gettone attivazione ${input.utilityType.toUpperCase()} (${isBusiness ? 'Business' : 'Residenziale'})`
  };
  generated.push(upfrontRecord);

  // 2. Bonus Dual Fuel se congiunto
  if (input.isDualFuel) {
    const bonusRecord: CommissionRecord = {
      id: `comm-${Date.now()}-bonus`,
      agentId: input.agentId,
      agentName: input.agentName,
      contractId: input.contractId,
      customerName: input.customerName,
      podOrPdr: input.podOrPdr,
      utilityType: input.utilityType,
      customerType: isBusiness ? 'business' : 'residential',
      annualConsumption: input.annualConsumption,
      type: 'bonus',
      amountEur: 25.00,
      status: 'accrued',
      period,
      accrualDate: today,
      notes: 'Bonus promozionale Dual Fuel (Luce + Gas)'
    };
    generated.push(bonusRecord);
  }

  // 3. Quota Ricorrente Mese 1 (Portfolio Trail Margin)
  const monthlyRecurringRate = input.utilityType === 'luce' ? 0.0025 : 0.0150;
  const monthlyRecurring = Number(((input.annualConsumption * monthlyRecurringRate) / 12).toFixed(2));
  
  if (monthlyRecurring > 0) {
    const recurringRecord: CommissionRecord = {
      id: `comm-${Date.now()}-rec`,
      agentId: input.agentId,
      agentName: input.agentName,
      contractId: input.contractId,
      customerName: input.customerName,
      podOrPdr: input.podOrPdr,
      utilityType: input.utilityType,
      customerType: isBusiness ? 'business' : 'residential',
      annualConsumption: input.annualConsumption,
      type: 'recurring',
      amountEur: Math.max(1.00, monthlyRecurring),
      status: 'accrued',
      period,
      accrualDate: today,
      notes: `Mantenimento portafoglio mese (${input.annualConsumption} ${input.utilityType === 'luce' ? 'kWh' : 'Smc'}/anno)`
    };
    generated.push(recurringRecord);
  }

  // Aggiungi a COMMISSIONS
  COMMISSIONS.push(...generated);

  const totalEur = Number(generated.reduce((s, r) => s + r.amountEur, 0).toFixed(2));
  return { records: generated, totalEur };
}

export interface SettleCommissionInput {
  agentId: string;
  commissionIds: string[];
  paymentReference?: string;
  notes?: string;
}

/**
 * Liquida le provvigioni selezionate per un agente, emettendo la distinta contabile
 */
export function settleCommissions(input: SettleCommissionInput): { batch: SettlementBatch; updatedCount: number } {
  const today = new Date().toISOString().split('T')[0];
  const period = new Date().toISOString().slice(0, 7);
  
  // Trova nome agente
  const sample = COMMISSIONS.find(c => c.agentId === input.agentId);
  const agentName = sample?.agentName || 'Agente Commerciale';

  // Genera protocollo distinta se non specificato (es. DIST-2026-09-CB-9821)
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const refCode = input.paymentReference || `DIST-${period}-${input.agentId.slice(-4).toUpperCase()}-${suffix}`;

  let totalAmount = 0;
  let updatedCount = 0;

  COMMISSIONS = COMMISSIONS.map(c => {
    if (input.commissionIds.includes(c.id) && c.agentId === input.agentId && c.status !== 'settled') {
      totalAmount += c.amountEur;
      updatedCount++;
      return {
        ...c,
        status: 'settled' as CommissionStatus,
        settlementDate: today,
        paymentReference: refCode
      };
    }
    return c;
  });

  const batch: SettlementBatch = {
    id: `batch-${Date.now()}`,
    agentId: input.agentId,
    agentName,
    settlementDate: today,
    paymentReference: refCode,
    period,
    totalAmountEur: Number(totalAmount.toFixed(2)),
    commissionCount: updatedCount,
    notes: input.notes || `Liquidazione saldo provvigionale del ${today}`
  };

  SETTLEMENT_BATCHES.unshift(batch);

  return { batch, updatedCount };
}

/**
 * Restituisce l'elenco delle distinte di liquidazione emesse
 */
export function getSettlementBatches(agentId?: string): SettlementBatch[] {
  if (agentId) {
    return SETTLEMENT_BATCHES.filter(b => b.agentId === agentId);
  }
  return [...SETTLEMENT_BATCHES];
}

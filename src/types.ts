export type LeadSource = 'facebook_ads' | 'google_ads' | 'landing_page' | 'referral' | 'totem_kiosk';

export type LeadStatus = 
  | 'new' 
  | 'call_center_queue' 
  | 'appointment_booked' 
  | 'in_negotiation' 
  | 'contract_signed' 
  | 'unreachable' 
  | 'lost';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  source: LeadSource;
  status: LeadStatus;
  notes: string;
  createdAt: string;
  assignedCallCenterAgent?: string;
  appointmentId?: string;
  estimatedConsumptionKwh?: number;
  estimatedConsumptionSmc?: number;
}

export type AppointmentType = 'phone_consultation' | 'field_visit' | 'video_call';
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  leadId: string;
  customerName: string;
  phone: string;
  city: string;
  agentName: string;
  scheduledAt: string; // ISO date string
  durationMinutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string;
}

export interface UtilityPoint {
  id: string;
  type: 'luce' | 'gas';
  podOrPdr: string;
  annualConsumption: number; // kWh for luce, Smc for gas
  powerKw?: number; // per luce
  f1Kwh?: number;
  f2Kwh?: number;
  f3Kwh?: number;
  currentSupplier: string;
  currentOfferName: string;
  currentTariffType: 'fixed' | 'indexed';
  currentUnitCost: number; // €/kWh o €/Smc (compreso spread/materia)
  currentFixedFeeYear: number; // CCV €/anno
}

export interface Customer {
  id: string;
  name: string;
  fiscalCode: string;
  phone: string;
  email: string;
  city: string;
  utilityPoints: UtilityPoint[];
  contractStartDate: string; // data inizio fornitura
  lastSwitchAuditDate: string; // ultima verifica quadrimestrale
  nextSwitchAuditDate: string; // prossima scadenza quadrimestrale (120gg)
  accountManager: string;
  hasBrokerageMandate: boolean; // delega per cambio offerta automatico
  notes?: string;
}

export interface MonthlyMarketIndex {
  month: string;
  punEurKwh: number;
  psvEurSmc: number;
}

export interface MarketIndex {
  punEurKwh: number;
  psvEurSmc: number;
  punF1?: number;
  punF2?: number;
  punF3?: number;
  punChangePercent?: number;
  psvChangePercent?: number;
  lastUpdated: string;
  punTrend: 'up' | 'down' | 'stable';
  psvTrend: 'up' | 'down' | 'stable';
  historical6m?: MonthlyMarketIndex[];
}

export interface SupplierOffer {
  id: string;
  supplier: string;
  name: string;
  energyType: 'luce' | 'gas';
  pricingType: 'fixed' | 'indexed_pun' | 'indexed_psv';
  unitPriceOrSpread: number; // se fissa è il costo totale materia (€/kWh o €/Smc), se indicizzata è lo Spread applicato al PUN/PSV
  fixedAnnualFee: number; // Quota fissa di commercializzazione CCV/PCV (€/anno)
  durationMonths: number;
  greenCertified: boolean;
  tag: 'Miglior Prezzo' | 'Prezzo Bloccato' | '100% Green' | 'Broker Choice';
}

export interface SwitchAudit {
  id: string;
  customerId: string;
  customerName: string;
  utilityType: 'luce' | 'gas';
  podOrPdr: string;
  currentSupplier: string;
  currentAnnualCost: number;
  bestOffer: SupplierOffer;
  bestOfferAnnualCost: number;
  annualSavings: number;
  savingsPercent: number;
  daysActive: number;
  status: 'audit_ready' | 'switch_recommended' | 'already_optimal' | 'proposal_sent' | 'switched';
  scheduledAuditDate: string;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  timestamp: number;
}

export interface BillOcrResult {
  fileName: string;
  utilityType: 'luce' | 'gas';
  podOrPdr: string;
  supplier: string;
  customerName: string;
  fiscalCode: string;
  annualConsumption: number;
  f1Kwh?: number;
  f2Kwh?: number;
  f3Kwh?: number;
  rawCostTotal: number;
  estimatedSavingEur: number;
  confidenceScore: number;
  powerKw?: number;
  currentUnitCost?: number;
  currentFixedFeeYear?: number;
  period?: string;
  notes?: string;
}

export type UserRole = 'call_center' | 'customer' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  whatsapp?: string;
  fiscalCode?: string;
  customerId?: string;
  assignedBrokerId?: string;
  assignedBrokerName?: string;
  avatar?: string;
  is2faEnabled?: boolean;
  onboardingStatus?: 'active' | 'invited' | 'pending_verification';
  createdAt?: string;
}

export interface AuthUser extends UserProfile {}

export interface CustomerBill {
  id: string;
  customerId: string;
  customerName: string;
  fileName: string;
  uploadDate: string;
  fileSizeKb: number;
  utilityType: 'luce' | 'gas';
  status: 'in_review' | 'analyzed' | 'archived';
  notes?: string;
  extractedSavingsEur?: number;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  eventType: 'login_2fa_success' | 'login_failed' | 'pod_decrypted' | 'switch_signed_otp' | 'rate_limit_triggered' | 'gdpr_consent_logged';
  userEmail: string;
  ipAddress: string;
  status: 'safe' | 'warning' | 'critical';
  details: string;
}

export interface SecurityCheckItem {
  id: string;
  category: 'GDPR' | 'Crittografia' | 'Autenticazione' | 'Infrastruttura';
  title: string;
  status: 'passed' | 'warning' | 'failed';
  score: number;
  description: string;
  remediation?: string;
}

export type NotificationType = 
  | 'switch_due'
  | 'totem_lead'
  | 'bill_uploaded'
  | 'signature_completed'
  | 'price_drop'
  | 'security_alert';

export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority: NotificationPriority;
  targetRole?: 'all' | 'call_center' | 'admin' | 'customer';
  actionTab?: string;
  meta?: {
    customerId?: string;
    leadId?: string;
    savingsEur?: number;
    phone?: string;
    auditId?: string;
  };
}

export type CommissionType = 'upfront' | 'recurring' | 'bonus' | 'clawback';
export type CommissionStatus = 'pending' | 'accrued' | 'settled' | 'clawback';

export interface CommissionRecord {
  id: string;
  agentId: string;
  agentName: string;
  contractId: string;
  customerName: string;
  podOrPdr: string;
  utilityType: 'luce' | 'gas';
  customerType?: 'residential' | 'business';
  annualConsumption: number;
  type: CommissionType;
  amountEur: number;
  status: CommissionStatus;
  period: string; // YYYY-MM
  accrualDate: string;
  settlementDate?: string;
  paymentReference?: string;
  notes?: string;
}

export interface AgentCommissionSummary {
  agentId: string;
  agentName: string;
  role: string;
  pendingCount: number;
  pendingAmountEur: number;
  accruedCount: number;
  accruedAmountEur: number;
  settledCount: number;
  settledAmountEur: number;
  totalEarnedEur: number;
  contractsCount: number;
}

export interface SettlementBatch {
  id: string;
  agentId: string;
  agentName: string;
  settlementDate: string;
  paymentReference: string;
  period: string;
  totalAmountEur: number;
  commissionCount: number;
  notes?: string;
}

export type OnboardingStage = 'bozza' | 'verifica_tecnica' | 'firma_mandato' | 'switch_programmato' | 'attivo';

export interface OnboardingRecord {
  id: string;
  customerName: string;
  fiscalCode: string;
  customerType: 'residential' | 'business';
  phone: string;
  email: string;
  city: string;
  stage: OnboardingStage;
  utilityTypes: ('luce' | 'gas')[];
  pod?: string;
  pdr?: string;
  annualConsumptionKwh?: number;
  annualConsumptionSmc?: number;
  estimatedAnnualSavingsEur?: number;
  supplier?: string;
  assignedAgent: string;
  mandateSigned: boolean;
  documentsUploaded: boolean;
  startedAt: string;
  updatedAt: string;
  notes?: string;
}


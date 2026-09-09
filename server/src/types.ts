export type UserRole = 'admin' | 'operator' | 'call_center' | 'customer';

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

export interface UtilityPoint {
  id: string;
  type: 'luce' | 'gas';
  podOrPdr: string;
  annualConsumption: number;
  powerKw?: number;
  currentSupplier: string;
  currentOfferName: string;
  currentTariffType: 'fixed' | 'indexed';
  currentUnitCost: number;
  currentFixedFeeYear: number;
}

export interface Customer {
  id: string;
  name: string;
  fiscalCode: string;
  phone: string;
  email: string;
  city: string;
  utilityPoints: UtilityPoint[];
  contractStartDate: string;
  lastSwitchAuditDate: string;
  nextSwitchAuditDate: string;
  accountManager: string;
  hasBrokerageMandate: boolean;
  notes?: string;
}

export interface MarketIndex {
  punEurKwh: number;
  psvEurSmc: number;
  lastUpdated: string;
  punTrend: 'up' | 'down' | 'stable';
  psvTrend: 'up' | 'down' | 'stable';
}

export interface SupplierOffer {
  id: string;
  supplier: string;
  name: string;
  energyType: 'luce' | 'gas';
  pricingType: 'fixed' | 'indexed_pun' | 'indexed_psv';
  unitPriceOrSpread: number;
  fixedAnnualFee: number;
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


import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Lead, Customer } from '../types.js';

const isDemo = process.env.VOLTA_DEMO_MODE === 'true';
const defaultAdminPass = process.env.ADMIN_INITIAL_PASSWORD || (isDemo ? 'admin123' : crypto.randomBytes(32).toString('hex'));
const defaultOpPass = process.env.OPERATOR_INITIAL_PASSWORD || (isDemo ? 'operator123' : crypto.randomBytes(32).toString('hex'));
const defaultCustPass = process.env.CUSTOMER_INITIAL_PASSWORD || (isDemo ? 'customer123' : crypto.randomBytes(32).toString('hex'));

if (!isDemo && !process.env.ADMIN_INITIAL_PASSWORD) {
  console.warn('[SECURITY] Account seed neutralizzati: VOLTA_DEMO_MODE non è attiva.');
}

export const users: any[] = [
  {
    id: 'user-admin-1',
    name: 'Matteo Riva (Broker Owner)',
    email: 'm.riva@voltagroup.it',
    password: bcrypt.hashSync(defaultAdminPass, 10),
    role: 'admin',
    phone: '+39 347 1122334',
    whatsapp: '+393471122334',
    avatar: 'MR',
    is2faEnabled: true,
    twoFactorSecret: process.env.ADMIN_2FA_SECRET || (isDemo ? 'VOLTA_ADMIN_SECRET_KEY_2FA_2026' : undefined),
    onboardingStatus: 'active',
    createdAt: '2026-01-15'
  },
  {
    id: 'user-op-2',
    name: 'Chiara Bianchi (Consulente Senior)',
    email: 'c.bianchi@voltagroup.it',
    password: bcrypt.hashSync(defaultOpPass, 10),
    role: 'call_center',
    phone: '+39 338 5566778',
    whatsapp: '+393385566778',
    avatar: 'CB',
    is2faEnabled: true,
    twoFactorSecret: process.env.OPERATOR_2FA_SECRET || (isDemo ? 'VOLTA_OPERATOR_SECRET_KEY_2FA_2026' : undefined),
    onboardingStatus: 'active',
    createdAt: '2026-02-10'
  },
  {
    id: 'user-op-3',
    name: 'Valentina Neri (Consulente Energetico)',
    email: 'v.neri@voltagroup.it',
    password: bcrypt.hashSync(defaultOpPass, 10),
    role: 'call_center',
    phone: '+39 334 1122990',
    whatsapp: '+393341122990',
    avatar: 'VN',
    is2faEnabled: true,
    twoFactorSecret: process.env.OPERATOR_2FA_SECRET || (isDemo ? 'VOLTA_OPERATOR_SECRET_KEY_2FA_2026' : undefined),
    onboardingStatus: 'active',
    createdAt: '2026-02-15'
  },
  {
    id: 'user-cust-1',
    name: 'Andrea Moretti',
    email: 'andrea.moretti@email.it',
    password: bcrypt.hashSync(defaultCustPass, 10),
    role: 'customer',
    phone: '+39 340 1234567',
    whatsapp: '+393401234567',
    fiscalCode: 'MRTNRA82M15F205X',
    customerId: 'cust-1',
    assignedBrokerId: 'user-admin-1',
    assignedBrokerName: 'Matteo Riva',
    avatar: 'AM',
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: '2026-03-01'
  },
  {
    id: 'user-cust-2',
    name: 'Ristorante La Terrazza Srl',
    email: 'amministrazione@laterrazzaroma.it',
    password: bcrypt.hashSync(defaultCustPass, 10),
    role: 'customer',
    phone: '+39 06 6543210',
    whatsapp: '+39066543210',
    fiscalCode: '09876540152',
    customerId: 'cust-2',
    assignedBrokerId: 'user-admin-1',
    assignedBrokerName: 'Matteo Riva',
    avatar: 'LT',
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: '2026-03-05'
  },
  {
    id: 'user-cust-3',
    name: 'Elena Fontana',
    email: 'elena.fontana@libero.it',
    password: bcrypt.hashSync(defaultCustPass, 10),
    role: 'customer',
    phone: '+39 340 7788990',
    whatsapp: '+393407788990',
    fiscalCode: 'FNTLNE88A41L219Z',
    customerId: 'cust-3',
    assignedBrokerId: 'user-op-3',
    assignedBrokerName: 'Valentina Neri',
    avatar: 'EF',
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: '2026-03-10'
  }
];

export let leads: any[] = [
  {
    id: 'lead-1',
    name: 'Marco Bellini',
    phone: '+39 347 1234567',
    email: 'm.bellini@gmail.com',
    city: 'Milano',
    source: 'facebook_ads',
    status: 'new',
    notes: 'Ha visto la sponsorizzata sul caro bollette Enel. Consumo annuo circa 2800 kWh.',
    createdAt: '2026-09-08',
    estimatedConsumptionKwh: 2800,
  },
  {
    id: 'lead-2',
    name: 'Elena Santoro (Pasticceria Alba)',
    phone: '+39 333 8976543',
    email: 'info@pasticceriaalba.it',
    city: 'Monza',
    source: 'google_ads',
    status: 'call_center_queue',
    notes: 'Piccola impresa B2B, spende circa 650€ al mese di luce per forni e frigoriferi.',
    createdAt: '2026-09-08',
    estimatedConsumptionKwh: 8500,
  }
];

export let customers: any[] = [
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
      },
      {
        id: 'util-1-gas',
        type: 'gas',
        podOrPdr: '02581100984321',
        annualConsumption: 1100,
        currentSupplier: 'Eni Plenitude',
        currentOfferName: 'Link Gas Basic',
        currentTariffType: 'fixed',
        currentUnitCost: 0.58,
        currentFixedFeeYear: 132.0,
      }
    ],
    notes: 'Cliente domestico fedele. Ha dato delega di brokeraggio continua per cambio ogni 4 mesi.'
  },
  {
    id: 'cust-2',
    name: 'Ristorante La Terrazza Srl',
    fiscalCode: '09876540152',
    phone: '+39 06 6543210',
    email: 'amministrazione@laterrazzaroma.it',
    city: 'Roma (RM)',
    contractStartDate: '2026-05-05',
    lastSwitchAuditDate: '2026-05-05',
    nextSwitchAuditDate: '2026-09-03',
    accountManager: 'Alessandro Mori',
    hasBrokerageMandate: true,
    utilityPoints: [
      {
        id: 'util-2-luce',
        type: 'luce',
        podOrPdr: 'IT001E88776655',
        annualConsumption: 18500,
        powerKw: 15.0,
        currentSupplier: 'Acea Energia',
        currentOfferName: 'Acea Business Fix',
        currentTariffType: 'fixed',
        currentUnitCost: 0.165,
        currentFixedFeeYear: 180.0,
      }
    ],
    notes: 'Ristorante con consumi cospicui: ogni centesimo di risparmio genera oltre 400€/anno.'
  },
  {
    id: 'cust-3',
    name: 'Elena Fontana',
    fiscalCode: 'FNTLNE88A41L219Z',
    phone: '+39 340 7788990',
    email: 'elena.fontana@libero.it',
    city: 'Firenze (FI)',
    contractStartDate: '2026-07-15',
    lastSwitchAuditDate: '2026-07-15',
    nextSwitchAuditDate: '2026-11-15',
    accountManager: 'Valentina Neri',
    hasBrokerageMandate: false,
    utilityPoints: [
      {
        id: 'util-3-luce',
        type: 'luce',
        podOrPdr: 'IT001E11223344',
        annualConsumption: 2600,
        powerKw: 3.0,
        currentSupplier: 'Octopus Energy',
        currentOfferName: 'Octopus Fissa 12M',
        currentTariffType: 'fixed',
        currentUnitCost: 0.118,
        currentFixedFeeYear: 96.0,
      }
    ],
    notes: 'Attualmente sull\'offerta più competitiva. Verifica programmata per Novembre.'
  }
];

export let notifications: any[] = [
  {
    id: 'notif-1',
    type: 'totem_lead',
    title: 'Nuovo Lead da Totem Kiosk',
    message: 'Acquisito visitatore al Totem Centro Commerciale Milano. Risparmio stimato a video: €340/anno.',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isRead: false,
    priority: 'urgent',
    targetRole: 'call_center',
    actionTab: 'leads',
    meta: {
      leadId: 'lead-1',
      phone: '+39 347 1234567',
      savingsEur: 340
    }
  },
  {
    id: 'notif-2',
    type: 'switch_due',
    title: 'Audit 120 Giorni Scaduto!',
    message: 'Il contratto di Andrea Moretti ha superato i 120 giorni. Risparmio annuo calcolato: €204,00 (-17.8%) con Octopus Energy.',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    isRead: false,
    priority: 'high',
    targetRole: 'call_center',
    actionTab: 'switch4m',
    meta: {
      customerId: 'cust-1',
      savingsEur: 204.0,
      auditId: 'audit-cust-1-util-1-luce'
    }
  },
  {
    id: 'notif-3',
    type: 'bill_uploaded',
    title: 'Nuova Bolletta da Analizzare',
    message: 'Ristorante La Terrazza Srl ha caricato la fattura "Bolletta_Acea_Business_Aprile2026.pdf". OCR pronto per convalida.',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    isRead: false,
    priority: 'normal',
    targetRole: 'call_center',
    actionTab: 'inbox_bills',
    meta: {
      customerId: 'cust-2'
    }
  },
  {
    id: 'notif-4',
    type: 'security_alert',
    title: 'Accesso 2FA Convalidato',
    message: 'Operatore Matteo Riva autenticato tramite RFC 6238 TOTP Authenticator con IP certificato.',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    isRead: true,
    priority: 'info',
    targetRole: 'admin',
    actionTab: 'security'
  }
];

export let signatureLogs: any[] = [];

import { supabase, isSupabaseConfigured } from './dbClient.js';


// In production the database is authoritative; caches publish only committed records.
function requireStorage(): void {
  if (process.env.VOLTA_DEMO_MODE !== 'true' && (!isSupabaseConfigured || !supabase)) {
    throw new Error('Database persistente obbligatorio fuori dalla modalità demo.');
  }
}
function check(error: any): void {
  if (error) throw Object.assign(new Error(error.message || 'Errore database.'), { status: error.code === '23505' ? 409 : 503 });
}
export const getLeads = () => leads;
export const getCustomers = () => customers;
export const getNotifications = () => notifications;
export const getSignatureLogs = () => signatureLogs;

export const customerToRow = (c: Customer) => ({
  id: c.id, name: c.name, fiscal_code: c.fiscalCode, phone: c.phone,
  email: c.email || null, city: c.city || '', contract_start_date: c.contractStartDate,
  last_switch_audit_date: c.lastSwitchAuditDate, next_switch_audit_date: c.nextSwitchAuditDate,
  has_brokerage_mandate: c.hasBrokerageMandate, account_manager: c.accountManager || '',
  notes: c.notes || null, utility_points: c.utilityPoints || []
});
const rowToCustomer = (c: any): Customer => ({
  id:c.id,name:c.name,fiscalCode:c.fiscal_code,phone:c.phone,email:c.email||'',city:c.city||'',
  contractStartDate:c.contract_start_date,lastSwitchAuditDate:c.last_switch_audit_date,
  nextSwitchAuditDate:c.next_switch_audit_date,hasBrokerageMandate:c.has_brokerage_mandate,
  accountManager:c.account_manager,notes:c.notes,utilityPoints:c.utility_points||[]
});
const leadToRow = (l: Lead) => ({id:l.id,name:l.name,phone:l.phone,email:l.email||null,
  city:l.city,source:l.source,status:l.status,notes:l.notes,
  estimated_consumption_kwh:l.estimatedConsumptionKwh??null,estimated_consumption_smc:l.estimatedConsumptionSmc??null,
  assigned_call_center_agent:l.assignedCallCenterAgent||null,appointment_id:l.appointmentId||null});
export async function addLead(lead: Lead): Promise<void> {
  if (!lead?.name || !lead?.phone) throw new Error('Nome e telefono lead obbligatori.');
  requireStorage();
  if (isSupabaseConfigured && supabase) check((await supabase.from('leads').insert(leadToRow(lead))).error);
  leads.unshift(structuredClone(lead));
}
export async function updateLead(lead: Lead): Promise<void> {
  requireStorage();
  if (isSupabaseConfigured && supabase) check((await supabase.from('leads').update(leadToRow(lead)).eq('id',lead.id)).error);
  leads = leads.map(l=>l.id===lead.id?structuredClone(lead):l);
}
export async function addCustomer(customer: Customer): Promise<void> {
  if (!customer?.name || !customer?.fiscalCode) throw new Error('Nome e codice fiscale obbligatori.');
  requireStorage();
  if (isSupabaseConfigured && supabase) check((await supabase.from('customers').upsert([customerToRow(customer)],{onConflict:'id'})).error);
  customers = [structuredClone(customer), ...customers.filter(c=>c.id!==customer.id)];
}
export async function updateCustomer(customer: Customer): Promise<void> {
  await addCustomer(customer);
}
export async function updateCustomerContact(customerId:string, actorId:string, contact:{phone:string;email:string;city:string}):Promise<Customer> {
  requireStorage();
  if(isSupabaseConfigured && supabase) {
    check((await supabase.rpc('update_customer_contact',{p_actor_id:actorId,p_customer_id:customerId,p_contact:contact})).error);
    await initDataStore();
    const persisted=customers.find(customer=>customer.id===customerId);
    if(!persisted) throw Object.assign(new Error('Cliente aggiornato non trovato.'),{status:503});
    return persisted;
  }
  const current=customers.find(customer=>customer.id===customerId);
  if(!current) throw Object.assign(new Error('Cliente non trovato.'),{status:404});
  const updated={...current,...contact,email:contact.email.trim().toLowerCase()};
  customers=customers.map(customer=>customer.id===customerId?updated:customer);
  for(const account of users.filter(user=>user.customerId===customerId)) {
    account.email=updated.email; account.phone=updated.phone;
  }
  return structuredClone(updated);
}
export async function addNotification(notification: any): Promise<void> {
  requireStorage();
  if (isSupabaseConfigured && supabase) check((await supabase.from('notifications').insert({
    id:notification.id,type:notification.type,title:notification.title,message:notification.message,
    timestamp:notification.timestamp,is_read:notification.isRead||false,priority:notification.priority||'normal',
    target_role:notification.targetRole||'all',action_tab:notification.actionTab||null,meta:notification.meta||null
  })).error);
  notifications.unshift(structuredClone(notification));
}
export async function markNotificationsRead(ids: string[]): Promise<void> {
  requireStorage();
  if (isSupabaseConfigured && supabase && ids.length) check((await supabase.from('notifications').update({is_read:true}).in('id',ids)).error);
  notifications = notifications.map(n=>ids.includes(n.id)?{...n,isRead:true}:n);
}

export const signatureToRow = (l:any) => ({
  id:l.id,customer_id:l.customerId,customer_name:l.customerName,signer_fiscal_code:l.signerFiscalCode,
  phone:l.phone,signature_type:l.signatureType||'otp',otp_code:'******',canvas_hash:l.canvasHash||null,
  canvas_data_url:l.canvasDataUrl||null,offer_id:l.offerId,supplier:l.supplier,ip_address:l.ipAddress||null,
  signature_hash:l.signatureHash,document_hash:l.documentHash||null,utility_point_id:l.utilityPointId,
  pod_or_pdr:l.podOrPdr,energy_type:l.energyType,offer_snapshot:l.offerSnapshot,original_point_snapshot:l.originalPointSnapshot,
  consent_version:l.consentVersion,canonical_document:l.canonicalDocument,status:l.status||'signed',
  activation_status:l.activationStatus||'pending_activation',activated_at:l.activatedAt||null,
  activation_reference:l.activationReference||null,activation_date:l.activationDate||null,activated_by:l.activatedBy||null,created_at:l.timestamp
});
export async function addSignatureLog(log: any): Promise<void> {
  requireStorage();
  if (isSupabaseConfigured && supabase) check((await supabase.from('signature_logs').insert(signatureToRow(log))).error);
  signatureLogs.push(structuredClone(log));
}
const rowToSignature = (s:any) => ({
  id:s.id,customerId:s.customer_id,customerName:s.customer_name,signerFiscalCode:s.signer_fiscal_code,
  phone:s.phone,signatureType:s.signature_type,otpCode:s.otp_code,canvasHash:s.canvas_hash,canvasDataUrl:s.canvas_data_url,
  offerId:s.offer_id,supplier:s.supplier,timestamp:s.created_at,signatureHash:s.signature_hash,documentHash:s.document_hash,
  utilityPointId:s.utility_point_id,podOrPdr:s.pod_or_pdr,energyType:s.energy_type,offerSnapshot:s.offer_snapshot,
  originalPointSnapshot:s.original_point_snapshot,consentVersion:s.consent_version,canonicalDocument:s.canonical_document,
  status:s.status,activationStatus:s.activation_status,activatedAt:s.activated_at,activationReference:s.activation_reference,
  ipAddress:s.ip_address,activationDate:s.activation_date,activatedBy:s.activated_by
});

export async function registerAccount(profile:any, customer:Customer):Promise<void> {
  requireStorage();
  if(users.some(u=>u.email.trim().toLowerCase()===profile.email.trim().toLowerCase())) {
    throw Object.assign(new Error('Email già registrata.'),{status:409});
  }
  if(isSupabaseConfigured && supabase) {
    check((await supabase.rpc('register_customer_account',{p_profile:profile,p_customer:customerToRow(customer)})).error);
  }
  users.unshift(structuredClone(profile)); customers.unshift(structuredClone(customer));
}

export async function initDataStore(): Promise<void> {
  requireStorage();
  if(!isSupabaseConfigured || !supabase) return;
  // Await every query and publish a complete snapshot only if all have succeeded.
  const database = supabase;
  const results = await Promise.all(['leads','customers','signature_logs','notifications','crm_accounts'].map(table=>database.from(table).select('*')));
  for(const result of results) check(result.error);
  const [ls,cs,ss,ns,us] = results.map(r=>r.data||[]);
  leads = ls.map((l:any)=>({id:l.id,name:l.name,phone:l.phone,email:l.email||'',city:l.city,source:l.source,
    status:l.status,notes:l.notes,createdAt:l.created_at?.split('T')[0],estimatedConsumptionKwh:l.estimated_consumption_kwh,
    estimatedConsumptionSmc:l.estimated_consumption_smc,assignedCallCenterAgent:l.assigned_call_center_agent,appointmentId:l.appointment_id}));
  customers = cs.map(rowToCustomer); signatureLogs = ss.map(rowToSignature);
  notifications = ns.map((n:any)=>({id:n.id,type:n.type,title:n.title,message:n.message,timestamp:n.timestamp,
    isRead:n.is_read,priority:n.priority,targetRole:n.target_role,actionTab:n.action_tab,meta:n.meta}));
  users.splice(0, users.length, ...us.map((u:any)=>({...u.profile,id:u.id,email:u.email,password:u.password_hash,
    role:u.role,customerId:u.customer_id,twoFactorSecret:u.two_factor_secret,is2faEnabled:u.is_2fa_enabled})));
}
export const refreshDataStore = initDataStore;

// Explicit one-time bootstrap; never restore demo accounts over existing persisted accounts.
export async function bootstrapAdmin(): Promise<void> {
  if(!isSupabaseConfigured || !supabase) return;
  if(users.some(u=>u.role==='admin')) return;
  const password=process.env.ADMIN_INITIAL_PASSWORD;
  const secret=process.env.ADMIN_2FA_SECRET;
  if(!password || password.length<12 || !secret || secret.length<20 || secret.includes('VOLTA_')) {
    throw new Error('Configurare ADMIN_INITIAL_PASSWORD (minimo 12 caratteri) e ADMIN_2FA_SECRET univoco per il primo avvio.');
  }
  const profile={id:crypto.randomUUID(),name:'Amministratore',email:(process.env.ADMIN_EMAIL||'m.riva@voltagroup.it').toLowerCase(),
    password:await bcrypt.hash(password,12),role:'admin',is2faEnabled:true,twoFactorSecret:secret,createdAt:new Date().toISOString()};
  check((await supabase.rpc('bootstrap_crm_admin',{p_profile:profile})).error);
  await initDataStore();
}

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Lead, Customer } from '../types.js';

const isProd = process.env.NODE_ENV === 'production';
const defaultAdminPass = process.env.ADMIN_INITIAL_PASSWORD || (isProd ? crypto.randomBytes(16).toString('hex') : 'admin123');
const defaultOpPass = process.env.OPERATOR_INITIAL_PASSWORD || (isProd ? crypto.randomBytes(16).toString('hex') : 'operator123');
const defaultCustPass = process.env.CUSTOMER_INITIAL_PASSWORD || (isProd ? crypto.randomBytes(16).toString('hex') : 'customer123');

if (isProd && !process.env.ADMIN_INITIAL_PASSWORD) {
  console.warn('[SECURITY WARNING] In ambiente di produzione ADMIN_INITIAL_PASSWORD non è impostata. Password di default neutralizzata.');
}

export const users = [
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
    twoFactorSecret: process.env.ADMIN_2FA_SECRET || 'VOLTA_ADMIN_SECRET_KEY_2FA_2026',
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
    twoFactorSecret: process.env.OPERATOR_2FA_SECRET || 'VOLTA_OPERATOR_SECRET_KEY_2FA_2026',
    onboardingStatus: 'active',
    createdAt: '2026-02-10'
  },
  {
    id: 'user-cust-1',
    name: 'Andrea Moretti',
    email: 'andrea.moretti@email.it',
    password: bcrypt.hashSync(defaultCustPass, 10),
    role: 'customer',
    phone: '+39 340 1234567',
    whatsapp: '+393401234567',
    fiscalCode: 'MRTNDR85M01H501Z',
    customerId: 'cust-1',
    assignedBrokerId: 'user-admin-1',
    assignedBrokerName: 'Matteo Riva',
    avatar: 'AM',
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: '2026-03-01'
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

export const getLeads = () => leads;

export const addLead = (lead: Lead) => {
  if (!lead || !lead.name || !lead.phone) {
    throw new Error('Validazione lead fallita: name e phone sono campi obbligatori.');
  }
  leads.unshift(lead);
  if (isSupabaseConfigured && supabase) {
    supabase.from('leads').insert([{
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || null,
      city: lead.city || 'Milano',
      source: lead.source || 'totem_kiosk',
      status: lead.status || 'new',
      notes: lead.notes || null,
      estimated_consumption_kwh: lead.estimatedConsumptionKwh || null,
      estimated_consumption_smc: lead.estimatedConsumptionSmc || null,
    }]).then(({ error }) => {
      if (error) console.warn('[Supabase Sync] Errore inserimento lead:', error.message);
      else console.log(`[Supabase Sync] Lead ${lead.id} persistito su PostgreSQL`);
    });
  }
};

export const getCustomers = () => customers;

export const addCustomer = (customer: Customer) => {
  if (!customer || !customer.name || !customer.fiscalCode) {
    throw new Error('Validazione cliente fallita: name e fiscalCode sono campi obbligatori.');
  }
  customers.unshift(customer);
  if (isSupabaseConfigured && supabase) {
    supabase.from('customers').upsert([{
      id: customer.id,
      name: customer.name,
      fiscal_code: customer.fiscalCode,
      phone: customer.phone,
      email: customer.email || null,
      city: customer.city || 'Milano',
      contract_start_date: customer.contractStartDate || new Date().toISOString().split('T')[0],
      has_brokerage_mandate: customer.hasBrokerageMandate ?? true,
      account_manager: customer.accountManager || 'Matteo Riva',
      notes: customer.notes || null,
      utility_points: customer.utilityPoints || []
    }], { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('[Supabase Sync] Errore inserimento cliente:', error.message);
      else console.log(`[Supabase Sync] Cliente ${customer.id} persistito su PostgreSQL (tabella customers)`);
    });
  }
};

export const getNotifications = () => notifications;

export const addNotification = (notification: any) => {
  notifications.unshift(notification);
  if (isSupabaseConfigured && supabase) {
    supabase.from('notifications').insert([{
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: notification.timestamp,
      is_read: notification.isRead || false,
      priority: notification.priority || 'normal',
      target_role: notification.targetRole || 'all',
      action_tab: notification.actionTab || null,
      meta: notification.meta || null
    }]).then(({ error }) => {
      if (error) console.warn('[Supabase Sync] Errore salvataggio notifica:', error.message);
    });
  }
};

export const getSignatureLogs = () => signatureLogs;

export const addSignatureLog = (log: any) => {
  signatureLogs.push(log);
  if (isSupabaseConfigured && supabase) {
    supabase.from('signature_logs').insert([{
      id: log.id,
      customer_id: log.customerId,
      customer_name: log.customerName,
      signer_fiscal_code: log.signerFiscalCode,
      phone: log.phone,
      otp_code: log.otpCode || '******',
      offer_id: log.offerId,
      supplier: log.supplier,
      signature_hash: log.signatureHash
    }]).then(({ error }) => {
      if (error) console.warn('[Supabase Sync] Errore salvataggio log di firma:', error.message);
      else console.log(`[Supabase Sync] Firma digitale ${log.id} registrata immutabilmente su DB`);
    });
  }
};

/**
 * Idratatore iniziale da Supabase su avvio server
 */
export async function initDataStore(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    console.log('📦 [Database Mode] Modalità in-memory attiva con demo data.');
    return;
  }

  try {
    // 1. Leads
    const { data: dbLeads, error: leadsErr } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!leadsErr && dbLeads && dbLeads.length > 0) {
      leads = [
        ...dbLeads.map((l: any) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          city: l.city,
          source: l.source,
          status: l.status,
          notes: l.notes,
          createdAt: l.created_at?.split('T')[0],
          estimatedConsumptionKwh: l.estimated_consumption_kwh,
          estimatedConsumptionSmc: l.estimated_consumption_smc
        }))
      ];
      console.log(`📦 [Database Sync] Caricati ${dbLeads.length} lead storici da Supabase PostgreSQL.`);
    }

    // 2. Customers
    const { data: dbCustomers, error: custErr } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (!custErr && dbCustomers && dbCustomers.length > 0) {
      customers = [
        ...dbCustomers.map((c: any) => ({
          id: c.id,
          name: c.name,
          fiscalCode: c.fiscal_code,
          phone: c.phone,
          email: c.email,
          city: c.city,
          contractStartDate: c.contract_start_date,
          lastSwitchAuditDate: c.last_switch_audit_date,
          nextSwitchAuditDate: c.next_switch_audit_date,
          hasBrokerageMandate: c.has_brokerage_mandate,
          accountManager: c.account_manager,
          notes: c.notes,
          utilityPoints: c.utility_points || []
        }))
      ];
      console.log(`📦 [Database Sync] Caricati ${dbCustomers.length} clienti storici da Supabase PostgreSQL.`);
    }

    // 3. Signature Logs
    const { data: dbSigs, error: sigsErr } = await supabase.from('signature_logs').select('*').order('created_at', { ascending: false });
    if (!sigsErr && dbSigs && dbSigs.length > 0) {
      signatureLogs = [
        ...dbSigs.map((s: any) => ({
          id: s.id,
          customerId: s.customer_id,
          customerName: s.customer_name,
          signerFiscalCode: s.signer_fiscal_code,
          phone: s.phone,
          signatureType: s.signature_type || 'otp',
          otpCode: s.otp_code,
          offerId: s.offer_id,
          supplier: s.supplier,
          timestamp: s.created_at,
          signatureHash: s.signature_hash
        }))
      ];
      console.log(`📦 [Database Sync] Caricati ${dbSigs.length} log firme da Supabase PostgreSQL.`);
    }
  } catch (err: any) {
    console.warn('[Database Sync] Avviso durante idratazione iniziale:', err.message);
  }
}


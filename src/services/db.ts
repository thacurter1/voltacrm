import { Appointment, AuthUser, Customer, CustomerBill, Lead, MarketIndex, SecurityAuditLog, SecurityCheckItem } from '../types';
import { INITIAL_APPOINTMENTS, INITIAL_CUSTOMERS, INITIAL_LEADS } from './mockData';
import { CURRENT_MARKET_INDEX } from './energyEngine';
import { cryptoService } from './cryptoService';

const STORAGE_KEY = 'VOLTA_ENERGY_CRM_DB_V3';

export const DEMO_USERS: AuthUser[] = [
  {
    id: 'user-cc-1',
    name: 'Matteo Riva (Call Center & Admin)',
    email: 'm.riva@voltagroup.it',
    role: 'call_center',
    avatar: 'MR',
    is2faEnabled: true
  },
  {
    id: 'user-cust-1',
    name: 'Andrea Moretti (Cliente Privato)',
    email: 'andrea.moretti@email.it',
    role: 'customer',
    customerId: 'cust-1',
    avatar: 'AM',
    is2faEnabled: false
  },
  {
    id: 'user-cust-2',
    name: 'Ristorante La Terrazza Srl (Cliente B2B)',
    email: 'amministrazione@laterrazzaroma.it',
    role: 'customer',
    customerId: 'cust-2',
    avatar: 'LT',
    is2faEnabled: true
  }
];

export const INITIAL_BILLS: CustomerBill[] = [
  {
    id: 'bill-1',
    customerId: 'cust-1',
    customerName: 'Andrea Moretti',
    fileName: 'Fattura_Enel_Luce_Maggio2026.pdf',
    uploadDate: '2026-05-10',
    fileSizeKb: 1420,
    utilityType: 'luce',
    status: 'analyzed',
    notes: 'Tariffa precedente cara (0.178 €/kWh). Proposta Octopus pronta.',
    extractedSavingsEur: 204.0
  },
  {
    id: 'bill-2',
    customerId: 'cust-2',
    customerName: 'Ristorante La Terrazza Srl',
    fileName: 'Bolletta_Acea_Business_Aprile2026.pdf',
    uploadDate: '2026-05-15',
    fileSizeKb: 2850,
    utilityType: 'luce',
    status: 'in_review',
    notes: 'Consumi elevati cucina e forni (18.500 kWh/anno).'
  },
  {
    id: 'bill-3',
    customerId: 'cust-1',
    customerName: 'Andrea Moretti',
    fileName: 'Fattura_Gas_EniPlenitude_Giugno2026.pdf',
    uploadDate: '2026-06-02',
    fileSizeKb: 1890,
    utilityType: 'gas',
    status: 'in_review',
    notes: 'Nuova bolletta caricata per verifica offerta gas estiva.'
  }
];

export const INITIAL_SECURITY_LOGS: SecurityAuditLog[] = [
  {
    id: 'sec-1',
    timestamp: '2026-09-08 16:40:12',
    eventType: 'login_2fa_success',
    userEmail: 'm.riva@voltagroup.it',
    ipAddress: '151.48.22.91 (Milano, IT)',
    status: 'safe',
    details: 'Accesso operatore convalidato tramite TOTP Authenticator (SHA-256).'
  },
  {
    id: 'sec-2',
    timestamp: '2026-09-08 15:12:04',
    eventType: 'switch_signed_otp',
    userEmail: 'andrea.moretti@email.it',
    ipAddress: '79.25.110.14 (Roma, IT)',
    status: 'safe',
    details: 'Firma digitale mandato switch perfezionata via SMS OTP a 6 cifre.'
  },
  {
    id: 'sec-3',
    timestamp: '2026-09-08 14:05:33',
    eventType: 'pod_decrypted',
    userEmail: 'm.riva@voltagroup.it',
    ipAddress: '151.48.22.91 (Milano, IT)',
    status: 'safe',
    details: 'Accesso autorizzato a dati sensibili fornitura POD IT001E00459821 con audit trail.'
  },
  {
    id: 'sec-4',
    timestamp: '2026-09-08 11:22:45',
    eventType: 'login_failed',
    userEmail: 'admin@voltagroup.it',
    ipAddress: '185.220.101.5 (Tor Exit Node)',
    status: 'warning',
    details: 'Tentativo fallito con credenziali errate. Rate limiting applicato (3 tentativi rimasti).'
  },
  {
    id: 'sec-5',
    timestamp: '2026-09-08 09:14:02',
    eventType: 'gdpr_consent_logged',
    userEmail: 'amministrazione@laterrazzaroma.it',
    ipAddress: '93.42.188.60 (Roma, IT)',
    status: 'safe',
    details: 'Consenso privacy marketing e delega rinegoziazione registrati con hash crittografico.'
  }
];

export const INITIAL_SECURITY_CHECKS: SecurityCheckItem[] = [
  {
    id: 'chk-1',
    category: 'Autenticazione',
    title: 'Autenticazione a Due Fattori (2FA / TOTP)',
    status: 'passed',
    score: 100,
    description: 'Tutti gli operatori call center e admin hanno 2FA obbligatorio con app authenticator o SMS OTP.'
  },
  {
    id: 'chk-2',
    category: 'Crittografia',
    title: 'Crittografia Dati Sensibili a Riposo (AES-256-GCM)',
    status: 'passed',
    score: 96,
    description: 'Codici POD, PDR, IBAN e Codici Fiscali cifrati con chiavi ruotate ogni 90 giorni.'
  },
  {
    id: 'chk-3',
    category: 'GDPR',
    title: 'Registro Consensi e Delega di Brokeraggio',
    status: 'passed',
    score: 95,
    description: 'I mandati per lo switch quadrimestrale sono firmati digitalmente e marcati con timestamp.'
  },
  {
    id: 'chk-4',
    category: 'Infrastruttura',
    title: 'Rate Limiting & Prevenzione Brute Force',
    status: 'passed',
    score: 90,
    description: 'Blocco IP automatico dopo 5 tentativi di login errati su portale e API.'
  },
  {
    id: 'chk-5',
    category: 'Crittografia',
    title: 'Trasporto Dati Sicuro (TLS 1.3 / HSTS)',
    status: 'passed',
    score: 100,
    description: 'Tutte le connessioni forzano TLS 1.3 con crittografia end-to-end su documenti e bollette.'
  }
];

interface DbState {
  customers: Customer[];
  leads: Lead[];
  appointments: Appointment[];
  bills: CustomerBill[];
  marketIndex: MarketIndex;
  currentUser: AuthUser;
  securityLogs: SecurityAuditLog[];
}

export const dbService = {
  load(): DbState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          customers: parsed.customers?.length ? parsed.customers : INITIAL_CUSTOMERS,
          leads: parsed.leads?.length ? parsed.leads : INITIAL_LEADS,
          appointments: parsed.appointments?.length ? parsed.appointments : INITIAL_APPOINTMENTS,
          bills: parsed.bills?.length ? parsed.bills : INITIAL_BILLS,
          marketIndex: parsed.marketIndex || CURRENT_MARKET_INDEX,
          currentUser: parsed.currentUser || DEMO_USERS[0],
          securityLogs: parsed.securityLogs?.length ? parsed.securityLogs : INITIAL_SECURITY_LOGS,
        };
      }
    } catch (e) {
      console.warn('Errore lettura database localStorage, uso dati iniziali', e);
    }

    const defaultState: DbState = {
      customers: INITIAL_CUSTOMERS,
      leads: INITIAL_LEADS,
      appointments: INITIAL_APPOINTMENTS,
      bills: INITIAL_BILLS,
      marketIndex: CURRENT_MARKET_INDEX,
      currentUser: DEMO_USERS[0],
      securityLogs: INITIAL_SECURITY_LOGS,
    };
    this.save(defaultState);
    return defaultState;
  },

  save(state: DbState): void {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, json);
      // Salva copia con crittografia WebCrypto AES-256-GCM
      cryptoService.encrypt(json).then((ciphertext) => {
        try {
          localStorage.setItem(STORAGE_KEY + '_ENCRYPTED_AES256', ciphertext);
        } catch {
          // ignore storage quota errors
        }
      });
    } catch (e) {
      console.error('Errore salvataggio database localStorage', e);
    }
  },

  reset(): DbState {
    localStorage.removeItem(STORAGE_KEY);
    return this.load();
  }
};

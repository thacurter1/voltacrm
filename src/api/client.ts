/**
 * VoltaCRM Unified API Client
 * Comunica con il backend standalone (Node.js/Express) o esegue fallback
 * automatico su storage locale se offline/deploy senza backend attivo.
 */

import { Customer, Lead, MarketIndex, SupplierOffer, SwitchAudit, CommissionRecord, AgentCommissionSummary, SettlementBatch, Appointment, AppointmentStatus, SecurityAuditLog, UserProfile } from '../types';
import { dbService } from '../services/db';
import { CURRENT_MARKET_INDEX, MARKET_OFFERS, runQuarterlyAudit } from '../services/energyEngine';
import { INITIAL_PROFILES, profileService } from '../services/supabaseClient';

// Rileva se l'app sta girando in locale (sviluppo) o su un dominio cloud pubblico (es. Vercel, Netlify)
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

// Determina in modo sicuro l'endpoint del backend:
// Su domini remoti (es. Vercel), se VITE_API_URL non è impostato oppure punta a localhost,
// impostiamo API_BASE_URL a null per EVITARE categoricamente che il browser tenti connessioni
// a localhost/127.0.0.1 scatenando il popup di Chrome "Accedere ad altri servizi e app su questo dispositivo" (Private Network Access).
function resolveApiBaseUrl(): string | null {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    if (!isLocalhost && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return null;
    }
    return envUrl.trim();
  }
  return isLocalhost ? 'http://localhost:5000/api' : null;
}

export const API_BASE_URL: string | null = resolveApiBaseUrl();
export const DEMO_MODE = (import.meta as any).env?.VITE_DEMO_MODE === 'true';
export const isStandaloneDemo = !API_BASE_URL || DEMO_MODE;

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('Servizio non configurato. Contatta un amministratore.');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('VOLTA_AUTH_TOKEN') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Errore HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // --- AUTHENTICATION ---
  auth: {
    async loginOperator(email: string, password: string, totpCode?: string): Promise<{
      success: boolean;
      token?: string;
      user?: UserProfile;
      require2FA?: boolean;
      message?: string;
    }> {
      if (API_BASE_URL) {
        try {
          const data = await request<{ success: boolean; token: string; user: any; require2FA?: boolean; message?: string }>('/auth/login-operator', {
            method: 'POST',
            body: JSON.stringify({ email, password, totpCode })
          });
          if (data.token && typeof window !== 'undefined') {
            localStorage.setItem('VOLTA_AUTH_TOKEN', data.token);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(data.user));
          }
          return data;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per loginOperator:', err);
        }
      }
      const normalizedEmail = (email || '').trim().toLowerCase();
      const operatorProfiles = INITIAL_PROFILES.filter(p => p.role !== 'customer');
      const profile = operatorProfiles.find(p => p.email.toLowerCase() === normalizedEmail) || operatorProfiles[0];

      const isValidPassword = password === 'admin123' || password === 'operator123' || password === 'password' || password.length >= 6;
      if (!isValidPassword) {
        throw new Error('Credenziali operatore non valide. Usa admin123 o operator123.');
      }

      if (profile.is2faEnabled && totpCode !== '123456' && (!totpCode || totpCode.length !== 6)) {
        return { success: false, require2FA: true, message: 'Inserisci il codice 2FA da Authenticator (es. 123456).' };
      }

      const mockToken = `mock-op-token-${profile.id}-${Date.now()}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('VOLTA_AUTH_TOKEN', mockToken);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(profile));
      }
      return { success: true, token: mockToken, user: profile };
    },

    async loginCustomer(identifier: string, password: string) {
      if (API_BASE_URL) {
        try {
          const data = await request<{ success: boolean; token: string; user: any }>('/auth/login-customer', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
          });
          if (data.token && typeof window !== 'undefined') {
            localStorage.setItem('VOLTA_AUTH_TOKEN', data.token);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(data.user));
          }
          return data;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per loginCustomer:', err);
        }
      }
      const query = (identifier || '').trim().toLowerCase();
      const state = dbService.load();
      const customers = state.customers || [];

      const matchedCustomer = customers.find(c => 
        (c.email && c.email.toLowerCase() === query) ||
        (c.fiscalCode && c.fiscalCode.toLowerCase() === query) ||
        (c.id && c.id.toLowerCase() === query)
      );

      const matchedProfile = INITIAL_PROFILES.find(p => 
        p.role === 'customer' && (
          (p.email && p.email.toLowerCase() === query) ||
          (p.fiscalCode && p.fiscalCode.toLowerCase() === query) ||
          (p.customerId && p.customerId.toLowerCase() === query)
        )
      );

      const isValidPassword = password === 'customer123' || password === 'password' || password.length >= 6;
      if (!isValidPassword) {
        throw new Error('Credenziali cliente non valide. Usa customer123.');
      }

      const targetCustomer = matchedCustomer || customers[0];
      const targetProfile = matchedProfile || (targetCustomer ? {
        id: `user-${targetCustomer.id}`,
        name: targetCustomer.name,
        email: targetCustomer.email || `${targetCustomer.id}@cliente.volta.it`,
        role: 'customer' as const,
        phone: targetCustomer.phone,
        fiscalCode: targetCustomer.fiscalCode,
        customerId: targetCustomer.id,
        avatar: targetCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        is2faEnabled: false,
        onboardingStatus: 'active' as const,
        createdAt: targetCustomer.contractStartDate || '2026-01-01'
      } : INITIAL_PROFILES.find(p => p.role === 'customer')!);

      const mockToken = `mock-cust-token-${targetProfile.id}-${Date.now()}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('VOLTA_AUTH_TOKEN', mockToken);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(targetProfile));
      }
      return { success: true, token: mockToken, user: targetProfile };
    },

    async registerCustomer(payload: { name: string; email: string; phone: string; fiscalCode: string; password: string }) {
      if (API_BASE_URL) {
        try {
          const data = await request<{ success: boolean; token: string; user: any }>('/auth/register-customer', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          if (data.token && typeof window !== 'undefined') {
            localStorage.setItem('VOLTA_AUTH_TOKEN', data.token);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(data.user));
          }
          return data;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per registerCustomer:', err);
        }
      }
      const state = dbService.load();
      const customerId = `cust-${Date.now()}`;
      const newCustomer: Customer = {
        id: customerId,
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        phone: payload.phone.trim(),
        fiscalCode: payload.fiscalCode.trim().toUpperCase(),
        city: '',
        utilityPoints: [],
        contractStartDate: new Date().toISOString().split('T')[0],
        lastSwitchAuditDate: new Date().toISOString().split('T')[0],
        nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
        accountManager: 'Account Manager',
        hasBrokerageMandate: true,
        notes: 'Registrato da portale clienti'
      };
      dbService.save({ ...state, customers: [newCustomer, ...state.customers] });

      const newProfile = {
        id: `user-${customerId}`,
        name: newCustomer.name,
        email: newCustomer.email,
        role: 'customer' as const,
        phone: newCustomer.phone,
        fiscalCode: newCustomer.fiscalCode,
        customerId: newCustomer.id,
        avatar: newCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        is2faEnabled: false,
        onboardingStatus: 'active' as const,
        createdAt: newCustomer.contractStartDate
      };
      const mockToken = `mock-cust-token-${newProfile.id}-${Date.now()}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('VOLTA_AUTH_TOKEN', mockToken);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(newProfile));
      }
      return { success: true, token: mockToken, user: newProfile };
    },

    async loginWithOAuth(
      provider: 'google' | 'apple', 
      role: 'customer' | 'operator' = 'customer',
      options?: { email?: string; name?: string; idToken?: string }
    ) {
      if (API_BASE_URL) {
        try {
          const data = await request<{ success: boolean; token: string; user: any; provider: string }>('/auth/oauth', {
            method: 'POST',
            body: JSON.stringify({ provider, role, ...(options || {}) })
          });
          if (data.token && typeof window !== 'undefined') {
            localStorage.setItem('VOLTA_AUTH_TOKEN', data.token);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(data.user));
          }
          return data;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per loginWithOAuth:', err);
        }
      }

      // Supabase / Demo fallback
      const profile = await profileService.signInWithOAuth(provider, role, options);
      const mockToken = `mock-oauth-${provider}-${profile.id}-${Date.now()}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('VOLTA_AUTH_TOKEN', mockToken);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(profile));
      }
      return { success: true, token: mockToken, user: profile, provider };
    },

    async me() {
      if (API_BASE_URL) {
        try {
          return await request<{ success: boolean; user: any }>('/auth/me');
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per me():', err);
        }
      }
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('VOLTA_CURRENT_USER');
        if (stored) {
          try {
            return { success: true, user: JSON.parse(stored) };
          } catch {}
        }
      }
      return { success: true, user: INITIAL_PROFILES[0] };
    },

    async profiles() {
      if (API_BASE_URL) {
        try {
          const data = await request<{ success: boolean; profiles: any[] }>('/auth/profiles');
          return data.profiles;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per profiles():', err);
        }
      }
      return INITIAL_PROFILES;
    },

    async ensureToken(): Promise<string | null> {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('VOLTA_AUTH_TOKEN');
    },

    logout() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('VOLTA_AUTH_TOKEN');
      }
    }
  },

  // --- HEALTH & STATUS ---
  async getHealth() {
    try {
      return await request<{ status: string; version: string; service: string }>('/health');
    } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
      return { status: 'offline-fallback', version: '1.0.0', service: 'Volta Local Engine' };
    }
  },

  // --- LEADS ---
  leads: {
    async getAll(): Promise<Lead[]> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; leads: Lead[] }>('/leads');
        return data.leads;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Backend offline, fallback a db locale per Leads:', err);
        return dbService.load().leads;
      }
    },

    async create(leadData: Partial<Lead>): Promise<Lead> {
      try {
        const data = await request<{ success: boolean; lead: Lead }>('/leads', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(['name','phone','email','city','source','status','notes','assignedCallCenterAgent','appointmentId','estimatedConsumptionKwh','estimatedConsumptionSmc'].filter(k=>(leadData as any)[k]!==undefined).map(k=>[k,(leadData as any)[k]])))
        });
        return data.lead;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback locale per creazione Lead:', err);
        const state = dbService.load();
        const newLead: Lead = {
          id: `lead-${Date.now()}`,
          name: leadData.name || 'Lead senza nome',
          phone: leadData.phone || '',
          email: leadData.email || '',
          city: leadData.city || 'Milano',
          source: leadData.source || 'landing_page',
          status: 'new',
          notes: leadData.notes || '',
          createdAt: new Date().toISOString().split('T')[0],
          estimatedConsumptionKwh: leadData.estimatedConsumptionKwh,
          estimatedConsumptionSmc: leadData.estimatedConsumptionSmc,
        };
        dbService.save({ ...state, leads: [newLead, ...state.leads] });
        return newLead;
      }
    },

    async bulkImport(importedLeads: any[]): Promise<Lead[]> {
      try {
        const data = await request<{ success: boolean; count: number; leads: Lead[] }>('/leads/bulk-import', {
          method: 'POST',
          body: JSON.stringify({ leads: importedLeads })
        });
        return data.leads || [];
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback locale per bulkImport Leads:', err);
        const state = dbService.load();
        const created: Lead[] = importedLeads.map((item, idx) => ({
          id: `lead-bulk-${Date.now()}-${idx}`,
          name: item.name || 'Lead',
          phone: item.phone || '',
          email: item.email || '',
          city: item.city || 'Italia',
          source: item.source || 'Import CSV Marketing',
          status: 'new',
          notes: item.notes || 'Importato massivamente da lista marketing.',
          createdAt: new Date().toISOString().split('T')[0],
          estimatedConsumptionKwh: item.estimatedConsumptionKwh,
          estimatedConsumptionSmc: item.estimatedConsumptionSmc,
        }));
        dbService.save({ ...state, leads: [...created, ...state.leads] });
        return created;
      }
    },

    async updateStatus(id: string, status: Lead['status'], note?: string): Promise<Lead | undefined> {
      try {
        const data = await request<{ success: boolean; lead: Lead }>(`/leads/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, note })
        });
        return data.lead;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback locale per updateStatus Lead:', err);
        const state = dbService.load();
        const updatedLeads = state.leads.map((l: Lead) => {
          if (l.id === id) {
            return {
              ...l,
              status,
              notes: note ? `${l.notes} | ${note}` : l.notes
            };
          }
          return l;
        });
        dbService.save({ ...state, leads: updatedLeads });
        return updatedLeads.find((l: Lead) => l.id === id);
      }
    }
  },

  // --- CUSTOMERS ---
  customers: {
    async getAll(): Promise<Customer[]> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; customers: Customer[] }>('/customers');
        return data.customers;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback a db locale per Clienti:', err);
        return dbService.load().customers;
      }
    },

    async getById(id: string): Promise<Customer | undefined> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; customer: Customer }>(`/customers/${id}`);
        return data.customer;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return dbService.load().customers.find((c: Customer) => c.id === id);
      }
    },

    async create(customerData: Partial<Customer>): Promise<Customer> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; customer: Customer }>('/customers', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(['name','fiscalCode','phone','email','city','utilityPoints','hasBrokerageMandate','accountManager','notes'].filter(k=>(customerData as any)[k]!==undefined).map(k=>[k,(customerData as any)[k]])))
        });
        return data.customer;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback locale per aggiunta Cliente:', err);
        const state = dbService.load();
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: customerData.name || 'Nuovo Cliente',
          fiscalCode: customerData.fiscalCode || 'CF0000000',
          phone: customerData.phone || '',
          email: customerData.email || '',
          city: customerData.city || '',
          utilityPoints: customerData.utilityPoints || [],
          contractStartDate: new Date().toISOString().split('T')[0],
          lastSwitchAuditDate: new Date().toISOString().split('T')[0],
          nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
          accountManager: customerData.accountManager || 'Account Manager',
          hasBrokerageMandate: customerData.hasBrokerageMandate ?? true,
          notes: customerData.notes || ''
        };
        dbService.save({ ...state, customers: [newCust, ...state.customers] });
        return newCust;
      }
    },

    async updateContact(id:string, contact:{phone:string;email:string;city:string}):Promise<Customer> {
      if (API_BASE_URL) {
        try {
          const data=await request<{success:boolean;customer:Customer;token?:string}>(`/customers/${id}`,{
            method:'PATCH',body:JSON.stringify(contact)
          });
          if(data.token && typeof window !== 'undefined') localStorage.setItem('VOLTA_AUTH_TOKEN',data.token);
          return data.customer;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per updateContact:', err);
        }
      }
      const state = dbService.load();
      let updatedCust: Customer | undefined;
      const updated = state.customers.map((c: Customer) => {
        if (c.id === id) {
          updatedCust = { ...c, ...contact };
          return updatedCust;
        }
        return c;
      });
      if (updatedCust) {
        dbService.save({ ...state, customers: updated });
        return updatedCust;
      }
      throw new Error(`Cliente ${id} non trovato`);
    }
  },

  // --- SWITCH ENGINE & ARERA ---
  switch: {
    async getMarketIndices(): Promise<MarketIndex> {
      try {
        const data = await request<{ success: boolean; marketIndex: MarketIndex }>('/switch/market-indices');
        return data.marketIndex;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return CURRENT_MARKET_INDEX;
      }
    },

    async refreshMarketIndices(): Promise<MarketIndex> {
      try {
        const data = await request<{ success: boolean; marketIndex: MarketIndex }>('/switch/refresh-indices', {
          method: 'POST'
        });
        return data.marketIndex;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return CURRENT_MARKET_INDEX;
      }
    },

    async getOffers(): Promise<SupplierOffer[]> {
      try {
        const data = await request<{ success: boolean; offers: SupplierOffer[] }>('/switch/offers');
        return data.offers;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return MARKET_OFFERS;
      }
    },

    async getAudits(): Promise<SwitchAudit[]> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; audits: SwitchAudit[] }>('/switch/audit');
        return data.audits;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback locale per Switch Audit:', err);
        return runQuarterlyAudit(dbService.load().customers, CURRENT_MARKET_INDEX);
      }
    },

    async getSignatures() {
      if (API_BASE_URL) {
        try {
          const data = await request<{success:boolean;signatures:any[]}>('/switch/signatures');
          return data.signatures;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per getSignatures:', err);
        }
      }
      try {
        const stored = localStorage.getItem('VOLTA_SIGNATURES');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    },
    async activateSignature(id:string, payload:{activationReference:string;activatedAt:string;generateCommission?:boolean;agentId?:string}) {
      if (API_BASE_URL) {
        try {
          return await request<{success:boolean;signatureReceipt:any;customer?:Customer;commissions?:any}>(`/switch/signatures/${encodeURIComponent(id)}/activate`,{method:'POST',body:JSON.stringify(payload)});
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per activateSignature:', err);
        }
      }
      try {
        const stored = localStorage.getItem('VOLTA_SIGNATURES');
        const list = stored ? JSON.parse(stored) : [];
        const target = list.find((s: any) => s.id === id);
        if (target) {
          target.status = 'activated';
          target.activationReference = payload.activationReference;
          target.activatedAt = payload.activatedAt;
          localStorage.setItem('VOLTA_SIGNATURES', JSON.stringify(list));
          return { success: true, signatureReceipt: target };
        }
      } catch {}
      return { success: true, signatureReceipt: { id, status: 'activated', ...payload } };
    },
    async signContract(payload: {
      customerId: string; customerName?: string; signerFiscalCode?: string; phone?: string;
      utilityPointId: string; podOrPdr: string; consentVersion: string;
      otpCode?: string; signatureType: 'otp'|'canvas'; canvasDataUrl?: string;
      offerId: string; supplier?: string;
    }) {
      if (API_BASE_URL) {
        try {
          return await request<{success:boolean;signatureReceipt:any}>('/switch/sign', {method:'POST',body:JSON.stringify(payload)});
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per signContract:', err);
        }
      }
      const receipt = {
        id: `sig-${Date.now()}`,
        customerId: payload.customerId,
        customerName: payload.customerName || 'Cliente Contraente',
        utilityPointId: payload.utilityPointId,
        podOrPdr: payload.podOrPdr,
        offerId: payload.offerId,
        supplier: payload.supplier || 'Fornitore Partner Selezionato',
        signatureType: payload.signatureType,
        signedAt: new Date().toISOString(),
        status: 'pending_activation',
        consentVersion: payload.consentVersion,
        cryptoSeal: `SHA256:DEMO:${Date.now().toString(16)}`
      };
      try {
        const stored = localStorage.getItem('VOLTA_SIGNATURES');
        const list = stored ? JSON.parse(stored) : [];
        localStorage.setItem('VOLTA_SIGNATURES', JSON.stringify([receipt, ...list]));
      } catch (e) {
        console.warn('[API Client] Errore salvataggio signature locale:', e);
      }
      return { success: true, signatureReceipt: receipt };
    }
  },

  // --- TOTEM KIOSK ---
  kiosk: {
    async submitLead(payload: {
      name?: string;
      phone: string;
      email?: string;
      supplyType: 'luce' | 'gas' | 'luce+gas';
      monthlyExpenseEur: number;
      totemId?: string;
      mallLocation?: string;
    }) {
      try {
        return await request<{
          success: boolean;
          leadId: string;
          estimatedSavingsAnnualEur: number;
          advice: string;
          capturedAt: string;
        }>('/kiosk/lead', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Backend non raggiungibile, salvataggio locale Kiosk:', err);
        const estSavings = Math.round(payload.monthlyExpenseEur * 12 * 0.28);
        const state = dbService.load();
        const localLead: Lead = {
          id: `totem-${Date.now()}`,
          name: payload.name || 'Visitatore Totem',
          phone: payload.phone,
          email: payload.email || '',
          city: payload.mallLocation || 'Totem Kiosk',
          source: 'totem_kiosk',
          status: 'new',
          notes: `Totem ${payload.totemId || 'K-01'}. Spesa: €${payload.monthlyExpenseEur}/m. Tipo: ${payload.supplyType}`,
          createdAt: new Date().toISOString().split('T')[0]
        };
        dbService.save({ ...state, leads: [localLead, ...state.leads] });

        return {
          success: true,
          leadId: localLead.id,
          estimatedSavingsAnnualEur: estSavings,
          advice: 'Riceverai un SMS o chiamata da un nostro consulente.',
          capturedAt: new Date().toISOString()
        };
      }
    }
  },

  // --- NOTIFICATIONS ---
  notifications: {
    async getAll(role?: string): Promise<{ notifications: any[]; unreadCount: number }> {
      try {
        const query = role ? `?role=${role}` : '';
        const data = await request<{ success: boolean; notifications: any[]; unreadCount: number }>(`/notifications${query}`);
        return { notifications: data.notifications, unreadCount: data.unreadCount };
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Fallback locale per Notifiche:', err);
        return {
          notifications: [
            {
              id: 'notif-local-1',
              type: 'totem_lead',
              title: 'Nuovo Lead da Totem Kiosk',
              message: 'Visitatore acquisito al Totem Centro Commerciale. Risparmio stimato: €340/anno.',
              timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              isRead: false,
              priority: 'urgent',
              targetRole: 'call_center',
              actionTab: 'leads'
            },
            {
              id: 'notif-local-2',
              type: 'switch_due',
              title: 'Audit 120 Giorni Scaduto!',
              message: 'Andrea Moretti ha superato i 120 giorni. Risparmio annuo: €204 con Octopus.',
              timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
              isRead: false,
              priority: 'high',
              targetRole: 'call_center',
              actionTab: 'switch4m'
            }
          ],
          unreadCount: 2
        };
      }
    },

    async markRead(id: string): Promise<boolean> {
      try {
        await request(`/notifications/${id}/read`, { method: 'PATCH' });
        return true;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return true;
      }
    },

    async markAllRead(): Promise<boolean> {
      try {
        await request(`/notifications/mark-all-read`, { method: 'POST' });
        return true;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return true;
      }
    },

    async trigger(notificationData: any): Promise<any> {
      try {
        return await request(`/notifications/trigger`, {
          method: 'POST',
          body: JSON.stringify(notificationData)
        });
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        return { success: true, notification: { id: `notif-${Date.now()}`, ...notificationData, isRead: false } };
      }
    }
  },

  // --- OCR & GEMINI DOCUMENT AI ---
  ocr: {
    async analyzeBill(payload: { fileName: string; mimeType: string; base64Data: string }) {
      try {
        const data = await request<{ success: boolean; result: any }>('/ocr/analyze-bill', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return data.result;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore chiamata OCR backend, attivo fallback locale:', err);
        const isGas = payload.fileName.toLowerCase().includes('gas');
        return {
          fileName: payload.fileName,
          utilityType: isGas ? 'gas' : 'luce',
          podOrPdr: isGas ? '02581900112233' : 'IT001E99882233',
          supplier: 'Enel Energia Mercato Libero',
          customerName: 'Cliente Rilevato da Documento',
          fiscalCode: 'RSSMRA80A01H501U',
          annualConsumption: isGas ? 1150 : 3200,
          f1Kwh: isGas ? undefined : 1200,
          f2Kwh: isGas ? undefined : 1100,
          f3Kwh: isGas ? undefined : 900,
          rawCostTotal: isGas ? 165.0 : 142.50,
          estimatedSavingEur: isGas ? 138 : 176,
          confidenceScore: 97.5,
          powerKw: isGas ? undefined : 3.0,
          currentUnitCost: isGas ? 0.54 : 0.168,
          currentFixedFeeYear: 144.0,
          period: 'Bimestre Recente'
        };
      }
    }
  },

  // --- MESSAGING (WHATSAPP & SMS) ---
  messaging: {
    async sendOtp(payload: { phone: string; channel?: 'sms' | 'whatsapp'; reason?: string }) {
      try {
        return await request<{
          success: boolean;
          messageId: string;
          expiresAt: string;
          channel: string;
          debugOtp?: string;
          sandboxMode: boolean;
        }>('/messaging/send-otp', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore sendOtp backend, attivo fallback locale:', err);
        return {
          success: true,
          messageId: `local-otp-${Date.now()}`,
          expiresAt: new Date(Date.now() + 300000).toISOString(),
          channel: payload.channel || 'sms',
          debugOtp: '849201',
          sandboxMode: true
        };
      }
    },

    async verifyOtp(payload: { phone: string; code: string }) {
      try {
        return await request<{ success: boolean; verified: boolean; message: string }>('/messaging/verify-otp', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore verifyOtp backend:', err);
        return {
          success: false,
          verified: false,
          message: err instanceof Error ? err.message : 'Verifica OTP non riuscita. Riprova.'
        };
      }
    },

    async sendOfferWhatsApp(payload: {
      phone: string;
      customerName: string;
      savingsEur: number;
      utilityType: string;
      offerName?: string;
    }) {
      try {
        return await request<{ success: boolean; messageId: string; deliveryChannel: string }>('/messaging/send-offer-whatsapp', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore sendOfferWhatsApp backend, fallback locale:', err);
        return {
          success: true,
          messageId: `local-wa-${Date.now()}`,
          deliveryChannel: 'local_fallback'
        };
      }
    }
  },

  operations: {
    async listAppointments(): Promise<Appointment[]> {
      if (API_BASE_URL) {
        try {
          await api.auth.ensureToken();
          const data = await request<{ success: boolean; appointments: Appointment[] }>('/operations/appointments');
          return data.appointments;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per listAppointments:', err);
        }
      }
      return dbService.load().appointments || [];
    },
    async saveAppointment(appointment: Appointment): Promise<Appointment> {
      if (API_BASE_URL) {
        try {
          await api.auth.ensureToken();
          const data = await request<{ success: boolean; appointment: Appointment }>('/operations/appointments', {
            method: 'POST', body: JSON.stringify(appointment),
          });
          return data.appointment;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per saveAppointment:', err);
        }
      }
      const state = dbService.load();
      const existing = (state.appointments || []).find(a => a.id === appointment.id);
      const updated = existing
        ? state.appointments.map(a => a.id === appointment.id ? appointment : a)
        : [appointment, ...(state.appointments || [])];
      dbService.save({ ...state, appointments: updated });
      return appointment;
    },
    async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
      if (API_BASE_URL) {
        try {
          await api.auth.ensureToken();
          const data = await request<{ success: boolean; appointment: Appointment }>(`/operations/appointments/${encodeURIComponent(id)}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
          });
          return data.appointment;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per updateAppointmentStatus:', err);
        }
      }
      const state = dbService.load();
      let updatedApp: Appointment | undefined;
      const updated = (state.appointments || []).map(a => {
        if (a.id === id) {
          updatedApp = { ...a, status };
          return updatedApp;
        }
        return a;
      });
      if (updatedApp) {
        dbService.save({ ...state, appointments: updated });
        return updatedApp;
      }
      throw new Error(`Appuntamento ${id} non trovato`);
    },
    async listSecurityLogs(): Promise<SecurityAuditLog[]> {
      if (API_BASE_URL) {
        try {
          await api.auth.ensureToken();
          const data = await request<{ success: boolean; logs: SecurityAuditLog[] }>('/operations/security-logs');
          return data.logs;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per listSecurityLogs:', err);
        }
      }
      return dbService.load().securityLogs || [];
    },
    async addSecurityLog(event: Pick<SecurityAuditLog, 'eventType' | 'status' | 'details'>): Promise<SecurityAuditLog> {
      if (API_BASE_URL) {
        try {
          await api.auth.ensureToken();
          const data = await request<{ success: boolean; log: SecurityAuditLog }>('/operations/security-logs', {
            method: 'POST', body: JSON.stringify(event),
          });
          return data.log;
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per addSecurityLog:', err);
        }
      }
      const state = dbService.load();
      const currentUser = state.currentUser || INITIAL_PROFILES[0];
      const newLog: SecurityAuditLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        eventType: event.eventType,
        userEmail: currentUser.email,
        ipAddress: '127.0.0.1 (local)',
        status: event.status,
        details: event.details
      };
      dbService.save({ ...state, securityLogs: [newLog, ...(state.securityLogs || [])] });
      return newLog;
    },
  },

  // --- COMMISSIONS & SETTLEMENTS ---
  commissions: {
    async getSummaries(): Promise<AgentCommissionSummary[]> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; summaries: AgentCommissionSummary[] }>('/commissions/summaries');
        return data.summaries;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore getSummaries commissions, uso fallback locale:', err);
        return [
          {
            agentId: 'user-admin-1',
            agentName: 'Matteo Riva (Broker Owner)',
            role: 'admin',
            pendingCount: 0,
            pendingAmountEur: 0,
            accruedCount: 2,
            accruedAmountEur: 166.25,
            settledCount: 1,
            settledAmountEur: 95.00,
            totalEarnedEur: 261.25,
            contractsCount: 2
          },
          {
            agentId: 'user-op-2',
            agentName: 'Chiara Bianchi (Consulente Senior)',
            role: 'call_center',
            pendingCount: 1,
            pendingAmountEur: 40.00,
            accruedCount: 3,
            accruedAmountEur: 148.50,
            settledCount: 1,
            settledAmountEur: 45.00,
            totalEarnedEur: 193.50,
            contractsCount: 4
          }
        ];
      }
    },

    async getAll(filters?: { agentId?: string; status?: string; period?: string; type?: string }): Promise<CommissionRecord[]> {
      try {
        await api.auth.ensureToken();
        const queryParams = new URLSearchParams();
        if (filters?.agentId) queryParams.append('agentId', filters.agentId);
        if (filters?.status) queryParams.append('status', filters.status);
        if (filters?.period) queryParams.append('period', filters.period);
        if (filters?.type) queryParams.append('type', filters.type);

        const qs = queryParams.toString();
        const data = await request<{ success: boolean; commissions: CommissionRecord[] }>(`/commissions${qs ? `?${qs}` : ''}`);
        return data.commissions;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore getAll commissions, uso fallback locale:', err);
        return [];
      }
    },

    async getBatches(agentId?: string): Promise<SettlementBatch[]> {
      try {
        await api.auth.ensureToken();
        const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
        const data = await request<{ success: boolean; batches: SettlementBatch[] }>(`/commissions/batches${qs}`);
        return data.batches;
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore getBatches commissions:', err);
        return [];
      }
    },

    async generate(payload: {
      agentId: string;
      agentName: string;
      contractId: string;
      customerName: string;
      podOrPdr: string;
      utilityType: 'luce' | 'gas';
      customerType?: 'residential' | 'business';
      annualConsumption?: number;
      isDualFuel?: boolean;
    }): Promise<{ records: CommissionRecord[]; totalEur: number }> {
      try {
        await api.auth.ensureToken();
        const data = await request<{ success: boolean; records: CommissionRecord[]; totalEur: number }>('/commissions/generate', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        return { records: data.records, totalEur: data.totalEur };
      } catch (err) {
        if (API_BASE_URL) throw err;
        if (!isStandaloneDemo) throw err;
        console.warn('[API Client] Errore generate commissions:', err);
        return { records: [], totalEur: 0 };
      }
    },

    async settle(payload: {
      agentId: string;
      commissionIds: string[];
      paymentReference?: string;
      notes?: string;
    }): Promise<{ batch: SettlementBatch; updatedCount: number }> {
      if (API_BASE_URL) {
        try {
          await api.auth.ensureToken();
          const data = await request<{ success: boolean; batch: SettlementBatch; updatedCount: number }>('/commissions/settle', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          return { batch: data.batch, updatedCount: data.updatedCount };
        } catch (err) {
          if (API_BASE_URL) throw err;
          if (!isStandaloneDemo) throw err;
          console.warn('[API Client] Fallback locale per settle commissions:', err);
        }
      }
      const dummyBatch: SettlementBatch = {
        id: `batch-${Date.now()}`,
        agentId: payload.agentId,
        agentName: 'Agente Liquidato',
        period: new Date().toISOString().slice(0, 7),
        totalAmountEur: 0,
        settlementDate: new Date().toISOString(),
        paymentReference: payload.paymentReference || `BON-${Date.now()}`,
        commissionCount: payload.commissionIds.length,
        notes: payload.notes
      };
      return { batch: dummyBatch, updatedCount: payload.commissionIds.length };
    }
  }
};


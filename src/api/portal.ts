import { request, API_BASE_URL, isDemoSessionActive } from './client';
import type { CustomerBill } from '../types';
import { dbService, DEMO_USERS } from '../services/db';

export interface MeterReadingValues {
  f1?: number;
  f2?: number;
  f3?: number;
  gas?: number;
}

export interface MeterReading {
  id: string;
  customerId: string;
  utilityPointId: string;
  utilityType: 'luce' | 'gas';
  readings: MeterReadingValues;
  recordedAt: string;
  createdAt: string;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export interface ConsultationRequestInput {
  customerId?: string;
  offerId: string;
  offerName: string;
  supplier: string;
  utilityType: 'luce' | 'gas';
  annualConsumption?: number;
  notes?: string;
  preferredContact?: string;
  // Guest fields
  customerName?: string;
  phone?: string;
  email?: string;
  privacyConsent?: boolean;
}

export const portalApi = {
  async listBills(customerId?: string): Promise<CustomerBill[]> {
    if (API_BASE_URL) {
      try {
        const query = customerId ? '?customerId=' + encodeURIComponent(customerId) : '';
        const response = await request<{ success: true; bills: CustomerBill[] }>('/portal/bills' + query);
        return response.bills;
      } catch (err) {
        if (!isDemoSessionActive()) throw err;
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per bollette:', err);
      }
    }
    if (!isDemoSessionActive()) throw new Error('Servizio bollette non configurato.');
    const allBills = dbService.load().bills || [];
    return customerId ? allBills.filter(b => b.customerId === customerId) : allBills;
  },

  async uploadBill(input: {
    customerId: string;
    file: File;
    fileName: string;
    utilityType: 'luce' | 'gas';
    notes?: string;
  }): Promise<CustomerBill> {
    if (API_BASE_URL) {
      try {
        const response = await request<{ success: true; bill: CustomerBill }>('/portal/bills', {
          method: 'POST',
          body: JSON.stringify({
            customerId: input.customerId,
            fileName: input.fileName,
            mimeType: input.file.type,
            base64Data: await fileToBase64(input.file),
            utilityType: input.utilityType,
            notes: input.notes,
          }),
        });
        return response.bill;
      } catch (err) {
        if (!isDemoSessionActive()) throw err;
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per upload bolletta:', err);
      }
    }
    if (!isDemoSessionActive()) throw new Error('Servizio bollette non configurato.');
    const state = dbService.load();
    const cust = (state.customers || []).find(c => c.id === input.customerId);
    const newBill: CustomerBill = {
      id: `bill-${Date.now()}`,
      customerId: input.customerId,
      customerName: cust?.name || 'Cliente Portale',
      fileName: input.fileName,
      uploadDate: new Date().toISOString().split('T')[0],
      fileSizeKb: Math.max(1, Math.round(input.file.size / 1024)),
      utilityType: input.utilityType,
      status: 'in_review',
      notes: input.notes || 'Caricata da interfaccia portale clienti'
    };
    dbService.save({ ...state, bills: [newBill, ...(state.bills || [])] });
    return newBill;
  },

  async analyzeBill(id: string): Promise<{ bill: CustomerBill; result: Record<string, unknown> }> {
    return request<{ success: true; bill: CustomerBill; result: Record<string, unknown> }>(
      '/portal/bills/' + encodeURIComponent(id) + '/analyze',
      { method: 'POST' },
    );
  },

  async listReadings(customerId?: string): Promise<MeterReading[]> {
    if (API_BASE_URL) {
      try {
        const query = customerId ? '?customerId=' + encodeURIComponent(customerId) : '';
        const response = await request<{ success: true; readings: MeterReading[] }>('/portal/readings' + query);
        return response.readings;
      } catch (err) {
        if (!isDemoSessionActive()) throw err;
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per letture:', err);
      }
    }
    if (!isDemoSessionActive()) throw new Error('Servizio autoletture non configurato.');
    try {
      const stored = localStorage.getItem('VOLTA_METER_READINGS');
      const parsed: MeterReading[] = stored ? JSON.parse(stored) : [];
      return customerId ? parsed.filter(r => r.customerId === customerId) : parsed;
    } catch {
      return [];
    }
  },

  async createReading(input: {
    customerId: string;
    utilityPointId: string;
    utilityType: 'luce' | 'gas';
    readings: MeterReadingValues;
  }): Promise<MeterReading> {
    if (API_BASE_URL) {
      try {
        const response = await request<{ success: true; reading: MeterReading }>('/portal/readings', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        return response.reading;
      } catch (err) {
        if (!isDemoSessionActive()) throw err;
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per invio lettura:', err);
      }
    }
    if (!isDemoSessionActive()) throw new Error('Servizio autoletture non configurato.');
    const newReading: MeterReading = {
      id: `read-${Date.now()}`,
      customerId: input.customerId,
      utilityPointId: input.utilityPointId,
      utilityType: input.utilityType,
      readings: input.readings,
      recordedAt: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    try {
      const stored = localStorage.getItem('VOLTA_METER_READINGS');
      const parsed: MeterReading[] = stored ? JSON.parse(stored) : [];
      localStorage.setItem('VOLTA_METER_READINGS', JSON.stringify([newReading, ...parsed]));
    } catch (e) {
      console.warn('[portalApi] Impossibile salvare lettura in localStorage:', e);
    }
    return newReading;
  },

  async requestConsultation(input: ConsultationRequestInput): Promise<{ success: boolean; leadId: string; message: string }> {
    const isGuest = !input.customerId || Boolean(input.customerName || input.phone);
    if (API_BASE_URL) {
      try {
        const response = await request<{ success: true; leadId: string; message: string }>('/portal/consultations', {
          method: 'POST',
          body: JSON.stringify(input),
          ...(isGuest ? { headers: { Authorization: '' } } : {}),
        });
        return response;
      } catch (err) {
        if (!isDemoSessionActive()) throw err;
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per richiesta consulenza:', err);
      }
    }
    if (!isDemoSessionActive()) throw new Error('Servizio consulenza non configurato.');
    const state = dbService.load();
    const cust = input.customerId ? (state.customers || []).find(c => c.id === input.customerId) : undefined;
    const leadId = isGuest ? `lead-guest-${Date.now()}` : `lead-portal-${Date.now()}`;
    const safeConsumption = typeof input.annualConsumption === 'number' && input.annualConsumption > 0 ? input.annualConsumption : undefined;
    const noteDetails = [
      isGuest
        ? `[COMPARATORE PUBBLICO] Richiesta assistenza per offerta: ${input.offerName || input.offerId} (${input.supplier || 'Partner'})`
        : `[PORTALE CLIENTI] Richiesta assistenza per offerta: ${input.offerName || input.offerId} (${input.supplier || 'Partner'})`,
      `Fornitura: ${input.utilityType.toUpperCase()}`,
      safeConsumption ? `Consumo: ${safeConsumption} ${input.utilityType === 'luce' ? 'kWh' : 'Smc'}/anno` : null,
      input.preferredContact ? `Contatto preferito: ${input.preferredContact}` : null,
      input.notes ? `Note: ${input.notes}` : null,
    ].filter(Boolean).join(' • ');

    const newLead: any = {
      id: leadId,
      name: isGuest ? (input.customerName || 'Visitatore Comparatore') : (cust?.name || 'Cliente Portale'),
      phone: isGuest ? (input.phone || '+39 300 0000000') : (cust?.phone || '+39 300 0000000'),
      email: isGuest
        ? (input.email || `${(input.phone || 'guest').replace(/\s+/g, '')}@lead.volta.it`)
        : (cust?.email || `${input.customerId}@cliente.volta.it`),
      city: isGuest ? 'Italia' : (cust?.city || 'Italia'),
      source: isGuest ? 'public_comparator' : 'landing_page',
      status: 'new',
      notes: noteDetails,
      createdAt: new Date().toISOString().split('T')[0],
      estimatedConsumptionKwh: input.utilityType === 'luce' ? safeConsumption : undefined,
      estimatedConsumptionSmc: input.utilityType === 'gas' ? safeConsumption : undefined,
      assignedBrokerId: isGuest
        ? (DEMO_USERS.find(u => u.role === 'broker' || u.role === 'operator')?.id || 'user-op-2')
        : cust?.assignedBrokerId,
    };
    dbService.save({ ...state, leads: [newLead, ...(state.leads || [])] });
    return {
      success: true,
      leadId,
      message: isGuest
        ? 'Richiesta di consulenza registrata con successo nel CRM (modalità demo attiva).'
        : 'Richiesta di consulenza registrata con successo (modalità demo attiva).'
    };
  },
};


import { request, API_BASE_URL, isDemoSessionActive } from './client';
import type { CustomerBill, Lead, AppNotification } from '../types';
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
  // Marketing UTM attribution
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
}

export interface BillUploadInput {
  customerId: string;
  file: File;
  fileName: string;
  utilityType: 'luce' | 'gas';
  notes?: string;
  isGuest?: boolean;
  customerName?: string;
  phone?: string;
  email?: string;
  privacyConsent?: boolean;
  preferredContact?: string;
  // Marketing UTM attribution
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
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

  async uploadBill(input: BillUploadInput): Promise<CustomerBill> {
    const isGuestCall = Boolean(input.isGuest || input.customerName || input.phone);
    if (API_BASE_URL) {
      try {
        const headers = isGuestCall && !localStorage.getItem('VOLTA_AUTH_TOKEN') ? { Authorization: '' } : undefined;
        const response = await request<{ success: true; bill: CustomerBill }>('/portal/bills', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customerId: input.customerId,
            fileName: input.fileName,
            mimeType: input.file.type,
            base64Data: await fileToBase64(input.file),
            utilityType: input.utilityType,
            notes: input.notes,
            isGuest: input.isGuest,
            customerName: input.customerName,
            phone: input.phone,
            email: input.email,
            privacyConsent: input.privacyConsent,
            preferredContact: input.preferredContact,
            utmSource: input.utmSource,
            utmCampaign: input.utmCampaign,
            utmMedium: input.utmMedium,
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
    const customerDisplayName = isGuestCall ? (input.customerName || 'Visitatore Portale') : (cust?.name || 'Cliente Portale');
    const newBill: CustomerBill = {
      id: `bill-${Date.now()}`,
      customerId: isGuestCall ? `guest-${Date.now()}` : input.customerId,
      customerName: customerDisplayName,
      fileName: input.fileName,
      uploadDate: new Date().toISOString().split('T')[0],
      fileSizeKb: Math.max(1, Math.round(input.file.size / 1024)),
      utilityType: input.utilityType,
      status: 'in_review',
      notes: input.notes || 'Caricata da interfaccia portale clienti'
    };

    // Generate direct CRM lead for Admin & Broker
    const assignedBroker = (DEMO_USERS || []).find(u => u.role === 'broker' || u.role === 'operator')?.id || 'user-op-2';
    const guestPhone = input.phone?.trim() || cust?.phone || '+39 347 0000000';
    const guestEmail = input.email?.trim() || cust?.email || `${guestPhone.replace(/\D/g, '')}@lead.volta.it`;
    const utmDetail = input.utmSource
      ? ` • Campagna ADV: ${input.utmSource}${input.utmCampaign ? ` (${input.utmCampaign})` : ''}${input.utmMedium ? ` [${input.utmMedium}]` : ''}`
      : '';
    const newLead: Lead = {
      id: `lead-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: customerDisplayName,
      phone: guestPhone,
      email: guestEmail,
      city: cust?.city || 'Italia',
      source: 'bill_upload',
      status: 'new',
      notes: `[BOLLETTA CARICATA] File: ${input.fileName} (${newBill.fileSizeKb} KB) • Fornitura: ${input.utilityType.toUpperCase()}${input.preferredContact ? ` • Orario preferito: ${input.preferredContact}` : ''}${input.notes ? ` • Note: ${input.notes}` : ''}${utmDetail}`,
      createdAt: new Date().toISOString().split('T')[0],
      assignedBrokerId: cust?.assignedBrokerId || assignedBroker,
    };

    const newNotif: AppNotification = {
      id: `notif-bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'bill_uploaded',
      title: 'Nuova Bolletta Caricata dal Comparatore',
      message: `${customerDisplayName} ha caricato "${newBill.fileName}" per ${input.utilityType.toUpperCase()}. Analisi richiesta.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'urgent',
      targetRole: 'call_center',
      actionTab: 'leads',
      meta: { leadId: newLead.id, billId: newBill.id, fileName: newBill.fileName }
    };

    dbService.save({
      ...state,
      bills: [newBill, ...(state.bills || [])],
      leads: [newLead, ...(state.leads || [])],
      notifications: [newNotif, ...(state.notifications || [])],
    });
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
    const utmDetail = input.utmSource
      ? `Campagna ADV: ${input.utmSource}${input.utmCampaign ? ` (${input.utmCampaign})` : ''}${input.utmMedium ? ` [${input.utmMedium}]` : ''}`
      : null;
    const noteDetails = [
      isGuest
        ? `[COMPARATORE PUBBLICO] Richiesta assistenza per offerta: ${input.offerName || input.offerId} (${input.supplier || 'Partner'})`
        : `[PORTALE CLIENTI] Richiesta assistenza per offerta: ${input.offerName || input.offerId} (${input.supplier || 'Partner'})`,
      `Fornitura: ${input.utilityType.toUpperCase()}`,
      safeConsumption ? `Consumo: ${safeConsumption} ${input.utilityType === 'luce' ? 'kWh' : 'Smc'}/anno` : null,
      input.preferredContact ? `Contatto preferito: ${input.preferredContact}` : null,
      utmDetail,
      input.notes ? `Note: ${input.notes}` : null,
    ].filter(Boolean).join(' • ');

    const newLead: Lead = {
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

    const newNotif: AppNotification = {
      id: `notif-consultation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'consultation_requested',
      title: 'Nuova Richiesta Consulenza dal Comparatore',
      message: `${newLead.name} (${input.utilityType.toUpperCase()}) richiede assistenza per l'offerta ${input.offerName || input.offerId}.`,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'urgent',
      targetRole: 'call_center',
      actionTab: 'leads',
      meta: { leadId: newLead.id, phone: newLead.phone, customerName: newLead.name }
    };

    dbService.save({
      ...state,
      leads: [newLead, ...(state.leads || [])],
      notifications: [newNotif, ...(state.notifications || [])],
    });
    return {
      success: true,
      leadId,
      message: isGuest
        ? 'Richiesta di consulenza registrata con successo nel CRM (modalità demo attiva).'
        : 'Richiesta di consulenza registrata con successo (modalità demo attiva).'
    };
  },
};


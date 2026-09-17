import { request, API_BASE_URL } from './client';
import type { CustomerBill } from '../types';
import { dbService } from '../services/db';

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

export const portalApi = {
  async listBills(customerId?: string): Promise<CustomerBill[]> {
    if (API_BASE_URL) {
      try {
        const query = customerId ? '?customerId=' + encodeURIComponent(customerId) : '';
        const response = await request<{ success: true; bills: CustomerBill[] }>('/portal/bills' + query);
        return response.bills;
      } catch (err) {
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per bollette:', err);
      }
    }
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
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per upload bolletta:', err);
      }
    }
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
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per letture:', err);
      }
    }
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
        console.warn('[portalApi] Backend non raggiungibile, fallback locale per invio lettura:', err);
      }
    }
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
};

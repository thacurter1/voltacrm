import { request } from './client';
import type { CustomerBill } from '../types';

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
    const query = customerId ? '?customerId=' + encodeURIComponent(customerId) : '';
    const response = await request<{ success: true; bills: CustomerBill[] }>('/portal/bills' + query);
    return response.bills;
  },

  async uploadBill(input: {
    customerId: string;
    file: File;
    fileName: string;
    utilityType: 'luce' | 'gas';
    notes?: string;
  }): Promise<CustomerBill> {
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
  },

  async analyzeBill(id: string): Promise<{ bill: CustomerBill; result: Record<string, unknown> }> {
    return request<{ success: true; bill: CustomerBill; result: Record<string, unknown> }>(
      '/portal/bills/' + encodeURIComponent(id) + '/analyze',
      { method: 'POST' },
    );
  },

  async listReadings(customerId?: string): Promise<MeterReading[]> {
    const query = customerId ? '?customerId=' + encodeURIComponent(customerId) : '';
    const response = await request<{ success: true; readings: MeterReading[] }>('/portal/readings' + query);
    return response.readings;
  },

  async createReading(input: {
    customerId: string;
    utilityPointId: string;
    utilityType: 'luce' | 'gas';
    readings: MeterReadingValues;
  }): Promise<MeterReading> {
    const response = await request<{ success: true; reading: MeterReading }>('/portal/readings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.reading;
  },
};

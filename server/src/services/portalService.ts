import { randomUUID } from 'crypto';
import { isSupabaseConfigured, supabase } from './dbClient.js';
import { analyzeBillWithGemini, ExtractedBillData } from './geminiOcrService.js';

export const PORTAL_BILL_BUCKET = 'customer-bills';
export const MAX_BILL_BYTES = 10 * 1024 * 1024;

export type PortalUtilityType = 'luce' | 'gas';
export type PortalBillStatus = 'in_review' | 'analyzed' | 'archived';

export interface PortalBillRecord {
  id: string;
  customerId: string;
  customerName: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSizeKb: number;
  utilityType: PortalUtilityType;
  status: PortalBillStatus;
  notes?: string;
  extractedSavingsEur?: number;
  uploadDate: string;
  createdAt: string;
  ocrResult?: ExtractedBillData;
}

export interface MeterReadingValues {
  f1?: number;
  f2?: number;
  f3?: number;
  gas?: number;
}

export interface MeterReadingRecord {
  id: string;
  customerId: string;
  utilityPointId: string;
  utilityType: PortalUtilityType;
  readings: MeterReadingValues;
  recordedAt: string;
  createdAt: string;
}

export type BillDownload =
  | { kind: 'bytes'; bytes: Buffer; mimeType: string }
  | { kind: 'signed-url'; url: string };

export interface PortalBackend {
  uploadBill(storagePath: string, bytes: Buffer, mimeType: string): Promise<void>;
  insertBill(record: PortalBillRecord): Promise<PortalBillRecord>;
  removeBill(storagePath: string): Promise<void>;
  listBills(customerId?: string): Promise<PortalBillRecord[]>;
  getBill(id: string): Promise<PortalBillRecord | null>;
  getBillDownload(record: PortalBillRecord): Promise<BillDownload>;
  getBillBytes(record: PortalBillRecord): Promise<{ bytes: Buffer; mimeType: string }>;
  updateBillAnalysis(id: string, analysis: { status: 'analyzed'; extractedSavingsEur: number; ocrResult: ExtractedBillData }): Promise<PortalBillRecord>;
  insertReading(record: MeterReadingRecord): Promise<MeterReadingRecord>;
  listReadings(customerId?: string): Promise<MeterReadingRecord[]>;
}

export interface UploadBillInput {
  customerId: string;
  customerName: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  utilityType: PortalUtilityType;
  notes?: string;
}

export interface MeterReadingInput {
  utilityPointId: string;
  utilityType: PortalUtilityType;
  readings: MeterReadingValues;
}

const MIME_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'application/pdf': (bytes) => bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/png': (bytes) =>
    bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (bytes) =>
    bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
};

function portalError(message: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

export function sanitizeBillFileName(fileName: string): string {
  const leaf = fileName.replace(/\\/g, '/').split('/').pop() || 'bolletta';
  const normalized = leaf
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 160);
  return normalized && normalized !== '.' && normalized !== '..' ? normalized : 'bolletta';
}

export function validateBillFile(bytes: Buffer, declaredMimeType: string): { mimeType: string } {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw portalError('Il file della bolletta è vuoto.');
  }
  if (bytes.length > MAX_BILL_BYTES) {
    throw portalError('La bolletta supera il limite massimo di 10 MB.', 413);
  }

  const mimeType = declaredMimeType.trim().toLowerCase();
  const signatureMatches = MIME_SIGNATURES[mimeType];
  if (!signatureMatches) {
    throw portalError('Formato non consentito. Carica un file PDF, PNG o JPEG.');
  }
  if (!signatureMatches(bytes)) {
    throw portalError('Il contenuto del file non corrisponde al tipo dichiarato.');
  }
  return { mimeType };
}

export function validateMeterReadingInput(input: MeterReadingInput): MeterReadingInput {
  if (!input || !input.utilityPointId?.trim()) {
    throw portalError('Seleziona un punto di fornitura valido.');
  }
  if (input.utilityType !== 'luce' && input.utilityType !== 'gas') {
    throw portalError('Tipo di fornitura non valido.');
  }

  const allowedKeys = input.utilityType === 'luce' ? ['f1', 'f2', 'f3'] as const : ['gas'] as const;
  const provided = Object.entries(input.readings || {}).filter(([, value]) => value !== undefined && value !== null);
  if (provided.length === 0) {
    throw portalError('Inserisci almeno una lettura.');
  }
  for (const [key, value] of provided) {
    if (!(allowedKeys as readonly string[]).includes(key)) {
      throw portalError('La lettura non è coerente con il tipo di fornitura selezionato.');
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw portalError('Il valore ' + key.toUpperCase() + ' deve essere un numero valido.');
    }
    if (value < 0) {
      throw portalError('I valori delle letture devono essere non negativi.');
    }
  }

  const readings: MeterReadingValues = {};
  for (const key of allowedKeys) {
    const value = input.readings[key];
    if (value !== undefined) readings[key] = value;
  }
  return {
    utilityPointId: input.utilityPointId.trim(),
    utilityType: input.utilityType,
    readings,
  };
}

function mapBill(row: any): PortalBillRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    fileSizeKb: Math.ceil(Number(row.file_size_bytes) / 1024),
    utilityType: row.utility_type,
    status: row.status,
    notes: row.notes || undefined,
    extractedSavingsEur: row.extracted_savings_eur == null ? undefined : Number(row.extracted_savings_eur),
    uploadDate: String(row.created_at).slice(0, 10),
    createdAt: row.created_at,
    ocrResult: row.ocr_result || undefined,
  };
}

function mapReading(row: any): MeterReadingRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    utilityPointId: row.utility_point_id,
    utilityType: row.utility_type,
    readings: row.readings,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function createSupabaseBackend(): PortalBackend {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase non configurato.');
  }
  const client = supabase;
  return {
    async uploadBill(storagePath, bytes, mimeType) {
      const { error } = await client.storage.from(PORTAL_BILL_BUCKET).upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });
      if (error) throw new Error('Caricamento file non riuscito: ' + error.message);
    },
    async insertBill(record) {
      const { data, error } = await client.from('portal_bills').insert({
        id: record.id,
        customer_id: record.customerId,
        customer_name: record.customerName,
        file_name: record.fileName,
        storage_path: record.storagePath,
        mime_type: record.mimeType,
        file_size_bytes: record.fileSizeBytes,
        utility_type: record.utilityType,
        status: record.status,
        notes: record.notes || null,
        extracted_savings_eur: record.extractedSavingsEur ?? null,
        created_at: record.createdAt,
      }).select('*').single();
      if (error) throw new Error('Metadati bolletta non salvati: ' + error.message);
      return mapBill(data);
    },
    async removeBill(storagePath) {
      const { error } = await client.storage.from(PORTAL_BILL_BUCKET).remove([storagePath]);
      if (error) throw new Error('Pulizia file incompleta: ' + error.message);
    },
    async listBills(customerId) {
      let query = client.from('portal_bills').select('*').order('created_at', { ascending: false });
      if (customerId) query = query.eq('customer_id', customerId);
      const { data, error } = await query;
      if (error) throw new Error('Storico bollette non disponibile: ' + error.message);
      return (data || []).map(mapBill);
    },
    async getBill(id) {
      const { data, error } = await client.from('portal_bills').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error('Bolletta non disponibile: ' + error.message);
      return data ? mapBill(data) : null;
    },
    async getBillDownload(record) {
      const { data, error } = await client.storage.from(PORTAL_BILL_BUCKET).createSignedUrl(record.storagePath, 60);
      if (error || !data?.signedUrl) throw new Error('Download non disponibile: ' + (error?.message || 'URL non generato'));
      return { kind: 'signed-url', url: data.signedUrl };
    },
    async getBillBytes(record) {
      const { data, error } = await client.storage.from(PORTAL_BILL_BUCKET).download(record.storagePath);
      if (error || !data) throw new Error('File della bolletta non disponibile: ' + (error?.message || 'download vuoto'));
      return { bytes: Buffer.from(await data.arrayBuffer()), mimeType: record.mimeType };
    },
    async updateBillAnalysis(id, analysis) {
      const { data, error } = await client.from('portal_bills').update({
        status: analysis.status,
        extracted_savings_eur: analysis.extractedSavingsEur,
        ocr_result: analysis.ocrResult,
      }).eq('id', id).select('*').single();
      if (error) throw new Error('Esito OCR non salvato: ' + error.message);
      return mapBill(data);
    },
    async insertReading(record) {
      const { data, error } = await client.from('meter_readings').insert({
        id: record.id,
        customer_id: record.customerId,
        utility_point_id: record.utilityPointId,
        utility_type: record.utilityType,
        readings: record.readings,
        recorded_at: record.recordedAt,
        created_at: record.createdAt,
      }).select('*').single();
      if (error) throw new Error('Autolettura non salvata: ' + error.message);
      return mapReading(data);
    },
    async listReadings(customerId) {
      let query = client.from('meter_readings').select('*').order('recorded_at', { ascending: false });
      if (customerId) query = query.eq('customer_id', customerId);
      const { data, error } = await query;
      if (error) throw new Error('Storico autoletture non disponibile: ' + error.message);
      return (data || []).map(mapReading);
    },
  };
}

function createMemoryBackend(): PortalBackend {
  const bills: PortalBillRecord[] = [];
  const readings: MeterReadingRecord[] = [];
  const files = new Map<string, { bytes: Buffer; mimeType: string }>();
  return {
    async uploadBill(storagePath, bytes, mimeType) {
      files.set(storagePath, { bytes: Buffer.from(bytes), mimeType });
    },
    async insertBill(record) {
      bills.unshift(record);
      return record;
    },
    async removeBill(storagePath) {
      files.delete(storagePath);
    },
    async listBills(customerId) {
      return bills.filter((record) => !customerId || record.customerId === customerId);
    },
    async getBill(id) {
      return bills.find((record) => record.id === id) || null;
    },
    async getBillDownload(record) {
      const file = files.get(record.storagePath);
      if (!file) throw portalError('File della bolletta non trovato.', 404);
      return { kind: 'bytes', bytes: Buffer.from(file.bytes), mimeType: file.mimeType };
    },
    async getBillBytes(record) {
      const file = files.get(record.storagePath);
      if (!file) throw portalError('File della bolletta non trovato.', 404);
      return { bytes: Buffer.from(file.bytes), mimeType: file.mimeType };
    },
    async updateBillAnalysis(id, analysis) {
      const index = bills.findIndex(record => record.id === id);
      if (index < 0) throw portalError('Bolletta non trovata.', 404);
      bills[index] = { ...bills[index], ...analysis };
      return bills[index];
    },
    async insertReading(record) {
      readings.unshift(record);
      return record;
    },
    async listReadings(customerId) {
      return readings.filter((record) => !customerId || record.customerId === customerId);
    },
  };
}

export function createPortalService(
  backend: PortalBackend,
  now = () => new Date(),
  analyze = analyzeBillWithGemini,
) {
  return {
    async uploadBill(input: UploadBillInput): Promise<PortalBillRecord> {
      const { mimeType } = validateBillFile(input.bytes, input.mimeType);
      if (input.utilityType !== 'luce' && input.utilityType !== 'gas') {
        throw portalError('Tipo di fornitura non valido.');
      }
      const safeName = sanitizeBillFileName(input.fileName);
      const id = 'bill-' + randomUUID();
      const storagePath = input.customerId + '/' + id + '-' + safeName;
      const createdAt = now().toISOString();
      const record: PortalBillRecord = {
        id,
        customerId: input.customerId,
        customerName: input.customerName,
        fileName: safeName,
        storagePath,
        mimeType,
        fileSizeBytes: input.bytes.length,
        fileSizeKb: Math.ceil(input.bytes.length / 1024),
        utilityType: input.utilityType,
        status: 'in_review',
        notes: input.notes?.trim() || undefined,
        uploadDate: createdAt.slice(0, 10),
        createdAt,
      };

      await backend.uploadBill(storagePath, input.bytes, mimeType);
      try {
        return await backend.insertBill(record);
      } catch (error) {
        try {
          await backend.removeBill(storagePath);
        } catch (cleanupError) {
          console.error('[Portal] Impossibile compensare il file senza metadati:', cleanupError);
        }
        throw error;
      }
    },
    listBills(customerId?: string) {
      return backend.listBills(customerId);
    },
    async getBill(id: string): Promise<PortalBillRecord> {
      const record = await backend.getBill(id);
      if (!record) throw portalError('Bolletta non trovata.', 404);
      return record;
    },
    async getBillDownload(id: string): Promise<BillDownload> {
      const record = await backend.getBill(id);
      if (!record) throw portalError('Bolletta non trovata.', 404);
      return backend.getBillDownload(record);
    },
    async analyzeBill(id: string): Promise<{ bill: PortalBillRecord; result: ExtractedBillData }> {
      const record = await backend.getBill(id);
      if (!record) throw portalError('Bolletta non trovata.', 404);
      const file = await backend.getBillBytes(record);
      const result = await analyze(record.fileName, file.mimeType, file.bytes.toString('base64'));
      if (result.utilityType !== record.utilityType) {
        throw portalError('Il tipo di fornitura rilevato non coincide con quello dichiarato.', 409);
      }
      const bill = await backend.updateBillAnalysis(record.id, {
        status: 'analyzed',
        extractedSavingsEur: result.estimatedSavingEur,
        ocrResult: result,
      });
      return { bill, result };
    },
    async createReading(customerId: string, input: MeterReadingInput): Promise<MeterReadingRecord> {
      const valid = validateMeterReadingInput(input);
      const createdAt = now().toISOString();
      return backend.insertReading({
        id: 'reading-' + randomUUID(),
        customerId,
        utilityPointId: valid.utilityPointId,
        utilityType: valid.utilityType,
        readings: valid.readings,
        recordedAt: createdAt,
        createdAt,
      });
    },
    listReadings(customerId?: string) {
      return backend.listReadings(customerId);
    },
  };
}

function createDefaultPortalService() {
  if (isSupabaseConfigured && supabase) return createPortalService(createSupabaseBackend());
  if (process.env.VOLTA_DEMO_MODE !== 'true') {
    const unavailable = (): never => {
      throw Object.assign(new Error('Persistenza portale non configurata in produzione.'), { status: 503 });
    };
    return createPortalService({
      uploadBill: async () => unavailable(),
      insertBill: async () => unavailable(),
      removeBill: async () => unavailable(),
      listBills: async () => unavailable(),
      getBill: async () => unavailable(),
      getBillDownload: async () => unavailable(),
      getBillBytes: async () => unavailable(),
      updateBillAnalysis: async () => unavailable(),
      insertReading: async () => unavailable(),
      listReadings: async () => unavailable(),
    });
  }
  return createPortalService(createMemoryBackend());
}

export const portalService = createDefaultPortalService();

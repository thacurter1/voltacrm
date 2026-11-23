import dotenv from 'dotenv';
import { z } from 'zod';
import { withDecryptedGeminiKey, redactSecretFromText } from './secretVault.js';
dotenv.config();

/**
 * Stable Gemini Flash model used when GEMINI_MODEL is not set.
 * gemini-2.0-flash was shut down on 2026-06-01; gemini-2.5-flash is deprecated (2026-12-01).
 * Override with GEMINI_MODEL (e.g. GEMINI_MODEL=gemini-3.6-flash) without a redeploy of code.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GEMINI_TIMEOUT_MS = 30_000;

/** Fields a reviewer needs to run a comparison; used to compute the completeness score. */
export const KEY_OCR_FIELDS = [
  'podOrPdr',
  'supplier',
  'customerName',
  'fiscalCode',
  'annualConsumption',
  'rawCostTotal',
  'currentUnitCost',
  'period',
] as const;

export interface ExtractedBillData {
  fileName: string;
  utilityType: 'luce' | 'gas';
  podOrPdr?: string;
  supplier?: string;
  customerName?: string;
  fiscalCode?: string;
  annualConsumption?: number;
  f1Kwh?: number;
  f2Kwh?: number;
  f3Kwh?: number;
  rawCostTotal?: number;
  /**
   * Never produced by the OCR provider: savings are computed by the comparison engine
   * against the real offer catalog, not guessed by the model.
   */
  estimatedSavingEur?: number;
  /** Share (0-100) of KEY_OCR_FIELDS actually read from the document. Not a model self-assessment. */
  confidenceScore: number;
  missingFields: string[];
  powerKw?: number;
  currentUnitCost?: number;
  currentFixedFeeYear?: number;
  period?: string;
  notes?: string;
  model: string;
}

export type OcrErrorCode =
  | 'OCR_NOT_CONFIGURED'
  | 'OCR_TIMEOUT'
  | 'OCR_PROVIDER_UNAVAILABLE'
  | 'OCR_PROVIDER_REJECTED'
  | 'OCR_UNREADABLE';

export class OcrError extends Error {
  readonly status: number;
  readonly code: OcrErrorCode;
  constructor(code: OcrErrorCode, status: number, message: string) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
    this.status = status;
  }
}

const nullableNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === '') return undefined;
    const compact = String(value).replace(/[\s€]/g, '');
    // Italian formatting ("1.234,56") only when a decimal comma is present; "0.168" stays 0.168.
    const n = typeof value === 'number' ? value : Number(compact.includes(',') ? compact.replace(/\./g, '').replace(',', '.') : compact);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: 'custom', message: 'numero non valido' });
      return z.NEVER;
    }
    return n;
  });

const nullableText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      const trimmed = typeof value === 'string' ? value.trim() : '';
      return trimmed && trimmed.length <= max ? trimmed : undefined;
    });

const POD_RE = /^IT\d{3}E[0-9A-Z]{7,9}$/i;
const PDR_RE = /^\d{14}$/;
const FISCAL_RE = /^(?:[A-Z0-9]{16}|\d{11})$/i;

export const providerBillSchema = z.object({
  utilityType: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(['luce', 'gas'])),
  podOrPdr: nullableText(24).transform((v) => (v ? v.replace(/\s/g, '').toUpperCase() : undefined)),
  supplier: nullableText(200),
  customerName: nullableText(200),
  fiscalCode: nullableText(16).transform((v) => (v ? v.replace(/\s/g, '').toUpperCase() : undefined)),
  annualConsumption: nullableNumber,
  f1Kwh: nullableNumber,
  f2Kwh: nullableNumber,
  f3Kwh: nullableNumber,
  powerKw: nullableNumber,
  rawCostTotal: nullableNumber,
  currentUnitCost: nullableNumber,
  currentFixedFeeYear: nullableNumber,
  period: nullableText(120),
});

const OCR_PROMPT = `Sei un estrattore di dati da bollette luce e gas italiane.
Leggi il documento e restituisci SOLO un oggetto JSON con queste chiavi:
{
  "utilityType": "luce" | "gas",
  "podOrPdr": string | null,          // POD (es. IT001E12345678) o PDR (14 cifre)
  "supplier": string | null,          // venditore indicato in bolletta
  "customerName": string | null,      // intestatario della fornitura
  "fiscalCode": string | null,        // codice fiscale o partita IVA dell'intestatario
  "annualConsumption": number | null, // consumo annuo (kWh luce, Smc gas) SOLO se stampato in bolletta
  "f1Kwh": number | null, "f2Kwh": number | null, "f3Kwh": number | null,
  "powerKw": number | null,           // potenza impegnata (solo luce)
  "rawCostTotal": number | null,      // totale da pagare in euro
  "currentUnitCost": number | null,   // prezzo materia energia in euro/kWh o euro/Smc se indicato
  "currentFixedFeeYear": number | null, // quota fissa di commercializzazione in euro/anno se indicata
  "period": string | null             // periodo di fatturazione
}
Regole: usa null per ogni dato non leggibile o non presente. Non stimare, non calcolare, non inventare valori.
Numeri con punto decimale, senza simbolo di valuta. Nessun testo fuori dal JSON.`;

export function resolveGeminiModel(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.GEMINI_MODEL || '').trim();
  return /^[a-z0-9][a-z0-9.-]{2,63}$/i.test(configured) ? configured : DEFAULT_GEMINI_MODEL;
}

export function resolveGeminiTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.GEMINI_OCR_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 2_000 && n <= 120_000 ? Math.round(n) : DEFAULT_GEMINI_TIMEOUT_MS;
}

/** Pulls the first JSON object out of a model reply (tolerates ```json fences or stray prose). */
export function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/^﻿/, '').replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end <= start) throw new OcrError('OCR_UNREADABLE', 422, 'Il provider OCR ha restituito una risposta non strutturata.');
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      throw new OcrError('OCR_UNREADABLE', 422, 'Il provider OCR ha restituito JSON non valido.');
    }
  }
}

export function normalizeProviderBill(fileName: string, model: string, raw: unknown): ExtractedBillData {
  const parsed = providerBillSchema.safeParse(raw);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || 'root'))].join(', ');
    throw new OcrError('OCR_UNREADABLE', 422, `Dati OCR non validi (${fields}). Inserisci i dati manualmente.`);
  }
  const bill = parsed.data;

  // Codes with the wrong shape are dropped (left for manual review), never "fixed".
  const podOrPdr = bill.podOrPdr && (bill.utilityType === 'luce' ? POD_RE : PDR_RE).test(bill.podOrPdr) ? bill.podOrPdr : undefined;
  const fiscalCode = bill.fiscalCode && FISCAL_RE.test(bill.fiscalCode) ? bill.fiscalCode : undefined;
  const isLuce = bill.utilityType === 'luce';

  const result: ExtractedBillData = {
    fileName,
    utilityType: bill.utilityType,
    podOrPdr,
    supplier: bill.supplier,
    customerName: bill.customerName,
    fiscalCode,
    annualConsumption: bill.annualConsumption && bill.annualConsumption > 0 ? bill.annualConsumption : undefined,
    f1Kwh: isLuce ? bill.f1Kwh : undefined,
    f2Kwh: isLuce ? bill.f2Kwh : undefined,
    f3Kwh: isLuce ? bill.f3Kwh : undefined,
    powerKw: isLuce && bill.powerKw && bill.powerKw > 0 ? bill.powerKw : undefined,
    rawCostTotal: bill.rawCostTotal,
    currentUnitCost: bill.currentUnitCost,
    currentFixedFeeYear: bill.currentFixedFeeYear,
    period: bill.period,
    confidenceScore: 0,
    missingFields: [],
    model,
  };

  const missing = KEY_OCR_FIELDS.filter((key) => result[key] === undefined);
  if (missing.length === KEY_OCR_FIELDS.length) {
    throw new OcrError('OCR_UNREADABLE', 422, 'Nessun dato leggibile nel documento. Prova con una foto più nitida o inserisci i dati manualmente.');
  }
  result.missingFields = missing;
  result.confidenceScore = Math.round(((KEY_OCR_FIELDS.length - missing.length) / KEY_OCR_FIELDS.length) * 100);
  result.notes = missing.length
    ? `Estratto con ${model}. Da completare manualmente: ${missing.join(', ')}.`
    : `Estratto con ${model}. Verifica i dati prima del confronto.`;
  return result;
}

export interface GeminiOcrDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  model?: string;
  logger?: Pick<Console, 'info' | 'warn'>;
}

/**
 * Analizza una bolletta (PDF o immagine) con Google Gemini.
 * Non produce mai dati di ripiego: in caso di errore lancia un OcrError con status e code espliciti.
 */
export async function analyzeBillWithGemini(
  fileName: string,
  mimeType: string,
  base64Data: string,
  deps: GeminiOcrDeps = {},
): Promise<ExtractedBillData> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? resolveGeminiTimeoutMs();
  const model = deps.model ?? resolveGeminiModel();
  const logger = deps.logger ?? console;

  try {
    return await withDecryptedGeminiKey(async (apiKey) => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      logger.info(`[Gemini OCR] Richiesta a ${model} (${mimeType || 'application/pdf'}, ${Math.ceil((base64Data.length * 3) / 4 / 1024)} KB).`);

      let res: Response;
      try {
        res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            contents: [{ parts: [{ text: OCR_PROMPT }, { inlineData: { mimeType: mimeType || 'application/pdf', data: base64Data } }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'TimeoutError' || name === 'AbortError') {
          throw new OcrError('OCR_TIMEOUT', 504, `Il provider OCR non ha risposto entro ${Math.round(timeoutMs / 1000)} secondi. Inserisci i dati manualmente o riprova.`);
        }
        throw new OcrError('OCR_PROVIDER_UNAVAILABLE', 503, 'Provider OCR non raggiungibile. Inserisci i dati manualmente o riprova più tardi.');
      }

      if (!res.ok) {
        const detail = redactSecretFromText((await res.text().catch(() => '')).slice(0, 300), apiKey);
        logger.warn(`[Gemini OCR] HTTP ${res.status} da ${model}: ${detail}`);
        if (res.status === 400 || res.status === 413 || res.status === 415) {
          throw new OcrError('OCR_PROVIDER_REJECTED', 422, 'Il documento non è stato accettato dal provider OCR. Inserisci i dati manualmente.');
        }
        throw new OcrError('OCR_PROVIDER_UNAVAILABLE', 503, `Provider OCR non disponibile (HTTP ${res.status}). Inserisci i dati manualmente o riprova più tardi.`);
      }

      const data: any = await res.json().catch(() => null);
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.map((part: { text?: string }) => part?.text || '').join('') || '';
      if (!text.trim()) {
        const reason = data?.promptFeedback?.blockReason || candidate?.finishReason || 'risposta vuota';
        throw new OcrError('OCR_UNREADABLE', 422, `Il provider OCR non ha restituito dati (${String(reason).slice(0, 40)}). Inserisci i dati manualmente.`);
      }

      const result = normalizeProviderBill(fileName, model, extractJsonObject(text));
      logger.info(`[Gemini OCR] Estrazione completata: ${KEY_OCR_FIELDS.length - result.missingFields.length}/${KEY_OCR_FIELDS.length} campi chiave.`);
      return result;
    });
  } catch (err) {
    // withDecryptedGeminiKey re-wraps errors (redacting secrets) preserving `status` and `code`.
    if (err instanceof OcrError) throw err;
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 503;
    const message = err instanceof Error ? redactSecretFromText(err.message) : 'OCR non disponibile.';
    const rawCode = (err as { code?: unknown })?.code;
    const code: OcrErrorCode = typeof rawCode === 'string' && rawCode.startsWith('OCR_')
      ? (rawCode as OcrErrorCode)
      : /non configurato/i.test(message) ? 'OCR_NOT_CONFIGURED' : 'OCR_PROVIDER_UNAVAILABLE';
    throw new OcrError(code, status, message);
  }
}

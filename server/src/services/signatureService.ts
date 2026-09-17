import crypto from 'crypto';
import { inflateSync } from 'zlib';
import { SupplierOffer, UtilityPoint } from '../types.js';
import { isSupabaseConfigured, supabase } from './dbClient.js';
import {
  getCustomers,
  getSignatureLogs,
  refreshDataStore,
  updateCustomer
} from './dataStore.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_PNG_BYTES = 2 * 1024 * 1024;
const MAX_PNG_DIMENSION = 2048;
const MAX_INFLATED_BYTES = 20 * 1024 * 1024;

export class SignatureValidationError extends Error {}
export class SignatureNotFoundError extends Error {}
export class SignatureConflictError extends Error {}

export interface StoredSignatureIdentity {
  customerId: string;
  customerName: string;
  signerFiscalCode: string;
  phone: string;
}

export interface OfferedPointSnapshot {
  id: string;
  supplier: string;
  name: string;
  energyType: 'luce' | 'gas';
  pricingType: 'fixed' | 'indexed_pun' | 'indexed_psv';
  unitPriceOrSpread: number;
  fixedAnnualFee: number;
  durationMonths: number;
  greenCertified: boolean;
  tag: string;
}

export function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeComparableText(value: string): string {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('it-IT');
}

export function assertIdentityMatchesStored(
  stored: StoredSignatureIdentity,
  submitted: { customerName?: string; signerFiscalCode?: string; phone?: string }
): void {
  const storedPhoneDigits = normalizePhone(stored.phone);
  if (storedPhoneDigits.length < 8) {
    throw new SignatureValidationError('Anagrafica cliente incompleta: numero di telefono mancante o troppo corto. Aggiornare prima di firmare.');
  }
  if (submitted.customerName !== undefined && normalizeComparableText(submitted.customerName) !== normalizeComparableText(stored.customerName)) {
    throw new SignatureValidationError('Il nome del firmatario non corrisponde all\u2019anagrafica registrata.');
  }
  if (submitted.signerFiscalCode !== undefined && normalizeComparableText(submitted.signerFiscalCode) !== normalizeComparableText(stored.signerFiscalCode)) {
    throw new SignatureValidationError('Il codice fiscale del firmatario non corrisponde all\u2019anagrafica registrata.');
  }
  if (submitted.phone !== undefined && normalizePhone(submitted.phone) !== storedPhoneDigits) {
    throw new SignatureValidationError('Il numero di telefono non corrisponde esattamente all\u2019anagrafica registrata.');
  }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bitsPerPixel(bitDepth: number, colorType: number): number {
  const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const count = channels[colorType];
  if (!count || ![1, 2, 4, 8, 16].includes(bitDepth)) {
    throw new SignatureValidationError('Formato colore PNG della firma non supportato.');
  }
  if ((colorType === 2 || colorType === 4 || colorType === 6) && bitDepth < 8) {
    throw new SignatureValidationError('Profondità colore PNG della firma non valida.');
  }
  return count * bitDepth;
}

export function decodeAndValidateCanvasPng(dataUrl: string): Buffer {
  if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new SignatureValidationError('La firma canvas deve essere un’immagine PNG Base64 valida.');
  }

  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > MAX_PNG_BYTES || bytes.toString('base64') !== encoded) {
    throw new SignatureValidationError('Dimensione o codifica PNG della firma non valida.');
  }
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new SignatureValidationError('I byte della firma non rappresentano un PNG valido.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let sawHeader = false;
  let sawEnd = false;
  const compressedParts: Buffer[] = [];

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new SignatureValidationError('Struttura PNG della firma troncata.');
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (length > MAX_PNG_BYTES || chunkEnd > bytes.length) throw new SignatureValidationError('Chunk PNG della firma non valido.');

    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const storedCrc = bytes.readUInt32BE(offset + 8 + length);
    const computedCrc = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    if (storedCrc !== computedCrc) throw new SignatureValidationError('Checksum PNG della firma non valido.');

    if (!sawHeader && type !== 'IHDR') throw new SignatureValidationError('Header PNG della firma mancante.');
    if (type === 'IHDR') {
      if (sawHeader || length !== 13) throw new SignatureValidationError('Header PNG della firma non valido.');
      sawHeader = true;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (!width || !height || width > MAX_PNG_DIMENSION || height > MAX_PNG_DIMENSION || width * height > 4_194_304) {
        throw new SignatureValidationError('Dimensioni PNG della firma non consentite.');
      }
      if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new SignatureValidationError('Compressione, filtro o interlacciamento PNG non supportato.');
      }
    } else if (type === 'IDAT') {
      compressedParts.push(data);
    } else if (type === 'IEND') {
      if (length !== 0) throw new SignatureValidationError('Chiusura PNG della firma non valida.');
      sawEnd = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  if (!sawHeader || !sawEnd || offset !== bytes.length || compressedParts.length === 0) {
    throw new SignatureValidationError('PNG della firma incompleto.');
  }

  const rowLength = 1 + Math.ceil((width * bitsPerPixel(bitDepth, colorType)) / 8);
  const expectedInflatedLength = rowLength * height;
  if (expectedInflatedLength > MAX_INFLATED_BYTES) throw new SignatureValidationError('PNG della firma troppo grande.');

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(compressedParts), { maxOutputLength: MAX_INFLATED_BYTES });
  } catch {
    throw new SignatureValidationError('Dati compressi PNG della firma non validi.');
  }
  if (inflated.length !== expectedInflatedLength) throw new SignatureValidationError('Contenuto PNG della firma non coerente con le dimensioni.');
  for (let row = 0; row < height; row += 1) {
    if (inflated[row * rowLength] > 4) throw new SignatureValidationError('Filtro PNG della firma non valido.');
  }

  return bytes;
}

export function snapshotOffer(offer: SupplierOffer): OfferedPointSnapshot {
  return {
    id: offer.id,
    supplier: offer.supplier,
    name: offer.name,
    energyType: offer.energyType,
    pricingType: offer.pricingType,
    unitPriceOrSpread: offer.unitPriceOrSpread,
    fixedAnnualFee: offer.fixedAnnualFee,
    durationMonths: offer.durationMonths,
    greenCertified: offer.greenCertified,
    tag: offer.tag
  };
}

export function snapshotUtilityPoint(point: UtilityPoint): UtilityPoint {
  return JSON.parse(JSON.stringify(point));
}

export function buildCanonicalSignatureDocument(input: {
  signatureId: string;
  signedAt: string;
  identity: StoredSignatureIdentity;
  utilityPoint: UtilityPoint;
  offer: OfferedPointSnapshot;
  consentVersion: string;
  signatureType: 'canvas' | 'otp';
  artifactHash?: string;
}) {
  return {
    documentType: 'VOLTA_BROKERAGE_AND_SWITCH_REQUEST',
    documentVersion: '1.0',
    signatureId: input.signatureId,
    signedAt: input.signedAt,
    customer: input.identity,
    utilityPoint: snapshotUtilityPoint(input.utilityPoint),
    offer: input.offer,
    consent: {
      version: input.consentVersion,
      accepted: true
    },
    signature: {
      type: input.signatureType,
      artifactHash: input.artifactHash || null,
      verifiedAt: input.signedAt
    },
    activation: {
      required: true,
      status: 'pending_activation'
    }
  };
}

function pointStillMatchesSnapshot(point: UtilityPoint, snapshot: UtilityPoint): boolean {
  const keys: Array<keyof UtilityPoint> = [
    'id', 'type', 'podOrPdr', 'currentSupplier', 'currentOfferName',
    'currentTariffType', 'currentUnitCost', 'currentFixedFeeYear'
  ];
  return keys.every(key => point[key] === snapshot[key]);
}

export async function activateSignedSignature(input: {
  signatureId: string;
  confirmationReference: string;
  activationDate: string;
  activatedBy: string;
}): Promise<any> {
  if (!input.confirmationReference.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.activationDate)) {
    throw new SignatureValidationError('Riferimento di conferma e data di attivazione sono obbligatori.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('activate_signed_signature', {
      p_signature_id: input.signatureId,
      p_confirmation_reference: input.confirmationReference.trim(),
      p_activation_date: input.activationDate,
      p_activated_by: input.activatedBy
    });
    if (error) {
      if (/not found/i.test(error.message)) throw new SignatureNotFoundError('Richiesta di firma non trovata.');
      if (/already|stale|conflict|pending/i.test(error.message)) throw new SignatureConflictError(error.message);
      throw new Error(`Attivazione persistente non riuscita: ${error.message}`);
    }
    await refreshDataStore();
    return getSignatureLogs().find((item: any) => item.id === input.signatureId) || data;
  }

  if (process.env.VOLTA_DEMO_MODE !== 'true') {
    throw new Error('Attivazione non disponibile senza database persistente configurato.');
  }

  const signature = getSignatureLogs().find((item: any) => item.id === input.signatureId);
  if (!signature) throw new SignatureNotFoundError('Richiesta di firma non trovata.');
  if (signature.status !== 'signed' || signature.activationStatus !== 'pending_activation') {
    throw new SignatureConflictError('La richiesta non è più in attesa di attivazione.');
  }

  const customer = getCustomers().find((item: any) => item.id === signature.customerId);
  if (!customer) throw new SignatureConflictError('Anagrafica associata alla firma non trovata.');
  const pointIndex = customer.utilityPoints.findIndex((point: UtilityPoint) =>
    point.id === signature.utilityPointId && point.podOrPdr === signature.podOrPdr
  );
  if (pointIndex < 0) throw new SignatureConflictError('Punto di fornitura firmato non più disponibile.');
  const currentPoint = customer.utilityPoints[pointIndex];
  if (!pointStillMatchesSnapshot(currentPoint, signature.originalPointSnapshot)) {
    throw new SignatureConflictError('Il punto di fornitura è cambiato dopo la firma; attivazione annullata per conflitto.');
  }

  const offer = signature.offerSnapshot as OfferedPointSnapshot;
  const updatedPoint: UtilityPoint = {
    ...currentPoint,
    currentSupplier: offer.supplier,
    currentOfferName: offer.name,
    currentTariffType: offer.pricingType === 'fixed' ? 'fixed' : 'indexed',
    currentUnitCost: offer.unitPriceOrSpread,
    currentFixedFeeYear: offer.fixedAnnualFee
  };
  const next120Days = new Date(new Date(input.activationDate).getTime() + 120 * 86400000).toISOString().split('T')[0];
  const updatedCustomer = {
    ...customer,
    lastSwitchAuditDate: input.activationDate,
    nextSwitchAuditDate: next120Days,
    hasBrokerageMandate: true,
    utilityPoints: customer.utilityPoints.map((point: UtilityPoint, index: number) => index === pointIndex ? updatedPoint : point)
  };
  await updateCustomer(updatedCustomer);

  signature.status = 'activated';
  signature.activationStatus = 'activated';
  signature.activationReference = input.confirmationReference.trim();
  signature.activationDate = input.activationDate;
  signature.activatedBy = input.activatedBy;
  signature.activatedAt = new Date().toISOString();
  return signature;
}

export async function activateSignedSignatureWithCommissions(input: {
  signatureId: string;
  confirmationReference: string;
  activationDate: string;
  activatedBy: string;
  agentId: string;
  agentName: string;
  customerName: string;
  podOrPdr: string;
  utilityType: 'luce' | 'gas';
  customerType: 'residential' | 'business';
  annualConsumption: number;
  isDualFuel: boolean;
}): Promise<{ signatureReceipt: any; commissions: any }> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('activate_signature_with_commissions', {
      p_signature_id: input.signatureId,
      p_confirmation_reference: input.confirmationReference.trim(),
      p_activation_date: input.activationDate,
      p_activated_by: input.activatedBy,
      p_agent_id: input.agentId,
      p_agent_name: input.agentName,
      p_customer_name: input.customerName,
      p_pod_or_pdr: input.podOrPdr,
      p_utility_type: input.utilityType,
      p_customer_type: input.customerType,
      p_annual_consumption: input.annualConsumption,
      p_is_dual_fuel: input.isDualFuel
    });
    if (error) {
      if (/not found/i.test(error.message)) throw new SignatureNotFoundError('Richiesta di firma non trovata.');
      if (/already|stale|conflict|pending/i.test(error.message)) throw new SignatureConflictError(error.message);
      throw new Error(`Attivazione e provvigioni non riuscite: ${error.message}`);
    }
    if (!data?.signatureReceipt || !data?.commissions) throw new Error('Risposta transazionale non valida.');
    return data;
  }

  const signatureReceipt = await activateSignedSignature(input);
  const { generateContractCommissions } = await import('./commissionService.js');
  const commissions = await generateContractCommissions({
    agentId: input.agentId,
    agentName: input.agentName,
    contractId: input.signatureId,
    customerName: input.customerName,
    podOrPdr: input.podOrPdr,
    utilityType: input.utilityType,
    customerType: input.customerType,
    annualConsumption: input.annualConsumption,
    isDualFuel: input.isDualFuel
  });
  return { signatureReceipt, commissions };
}

export function hashCanonicalDocument(document: unknown): string {
  return `SHA256:${crypto.createHash('sha256').update(JSON.stringify(document)).digest('hex')}`;
}

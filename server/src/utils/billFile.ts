export const MAX_BILL_BYTES = 10 * 1024 * 1024;

const MIME_SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'application/pdf': (bytes) => bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-',
  'image/png': (bytes) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (bytes) => bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
};

export function validateBillFile(bytes: Buffer, declaredMimeType: string): { mimeType: string } {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw Object.assign(new Error('Il file della bolletta è vuoto.'), { status: 400 });
  }
  if (bytes.length > MAX_BILL_BYTES) {
    throw Object.assign(new Error('La bolletta supera il limite massimo di 10 MB.'), { status: 413 });
  }

  const mimeType = typeof declaredMimeType === 'string' ? declaredMimeType.trim().toLowerCase() : '';
  const signatureMatches = MIME_SIGNATURES[mimeType];
  if (!signatureMatches) {
    throw Object.assign(new Error('Formato non consentito. Carica un file PDF, PNG o JPEG.'), { status: 400 });
  }
  if (!signatureMatches(bytes)) {
    throw Object.assign(new Error('Il contenuto del file non corrisponde al tipo dichiarato.'), { status: 400 });
  }
  return { mimeType };
}

export function sanitizeBillFileName(fileName: unknown): string {
  const rawName = typeof fileName === 'string' ? fileName : 'bolletta';
  const leaf = rawName.replace(/\\/g, '/').split('/').pop() || 'bolletta';
  const normalized = leaf.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 160);
  return normalized && normalized !== '.' && normalized !== '..' ? normalized : 'bolletta';
}

export function decodeAndValidateBillFile(value: unknown, declaredMimeType: unknown): Buffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw Object.assign(new Error('File bolletta mancante o non valido.'), { status: 400 });
  }
  const maxEncodedLength = Math.ceil(MAX_BILL_BYTES / 3) * 4;
  if (value.length > maxEncodedLength) {
    throw Object.assign(new Error('La bolletta supera il limite massimo di 10 MB.'), { status: 413 });
  }
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw Object.assign(new Error('Codifica Base64 del file non valida.'), { status: 400 });
  }

  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.toString('base64') !== value) {
    throw Object.assign(new Error('Codifica Base64 del file non canonica.'), { status: 400 });
  }
  validateBillFile(bytes, typeof declaredMimeType === 'string' ? declaredMimeType : '');
  return bytes;
}

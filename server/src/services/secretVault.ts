import crypto from 'node:crypto';

const ENVELOPE_PREFIX = 'enc:v1:';
const HKDF_INFO = Buffer.from('voltacrm-gemini-vault-v1', 'utf8');
const GCM_AAD = Buffer.from('voltacrm:gemini:v1', 'utf8');

function resolveMasterSecret(explicitMasterSecret?: string): string {
  const master =
    explicitMasterSecret ||
    process.env.GEMINI_VAULT_SECRET ||
    process.env.JWT_SECRET;
  if (!master || master.trim().length < 16) {
    throw new Error(
      'Segreto master per il vault (GEMINI_VAULT_SECRET o JWT_SECRET) mancante o troppo corto.'
    );
  }
  return master.trim();
}

function deriveVaultKey(masterSecret: string, salt: Buffer): Buffer {
  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(masterSecret, 'utf8'),
    salt,
    HKDF_INFO,
    32
  );
  return Buffer.from(derived);
}

/**
 * Cifra un segreto con HKDF-SHA256 + AES-256-GCM autenticato (con AAD).
 * Restituisce un envelope opaco: enc:v1:<saltHex>:<ivHex>:<authTagHex>:<ciphertextHex>
 */
export function encryptSecretEnvelope(
  plainText: string,
  explicitMasterSecret?: string
): string {
  if (!plainText || !plainText.trim()) {
    throw new Error('Impossibile cifrare un segreto vuoto.');
  }
  const master = resolveMasterSecret(explicitMasterSecret);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveVaultKey(master, salt);
  const plainBuf = Buffer.from(plainText.trim(), 'utf8');

  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: 16,
    });
    cipher.setAAD(GCM_AAD);
    const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
      'enc',
      'v1',
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  } finally {
    key.fill(0);
    plainBuf.fill(0);
  }
}

/**
 * Decifra un envelope enc:v1:... in un Buffer in memoria (che il chiamante deve azzerare con .fill(0)).
 */
export function decryptSecretEnvelopeToBuffer(
  envelope: string,
  explicitMasterSecret?: string
): Buffer {
  const trimmed = (envelope || '').trim();
  if (!trimmed.startsWith(ENVELOPE_PREFIX)) {
    throw new Error('Formato envelope cifrato non valido (atteso prefisso enc:v1:).');
  }

  const parts = trimmed.split(':');
  if (parts.length !== 6) {
    throw new Error('Struttura envelope cifrato non valida.');
  }

  const [, , saltHex, ivHex, authTagHex, cipherHex] = parts;
  if (
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{24}$/i.test(ivHex) ||
    !/^[0-9a-f]{32}$/i.test(authTagHex) ||
    !/^[0-9a-f]+$/i.test(cipherHex)
  ) {
    throw new Error('Parametri esadecimali envelope cifrato corrotti.');
  }

  const master = resolveMasterSecret(explicitMasterSecret);
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const key = deriveVaultKey(master, salt);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
      authTagLength: 16,
    });
    decipher.setAAD(GCM_AAD);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error(
      'Impossibile decifrare la chiave protetta: autenticazione AES-256-GCM fallita o segreto master non corrispondente.'
    );
  } finally {
    key.fill(0);
  }
}

/**
 * Rimuove qualsiasi occorrenza del segreto o di pattern AIza... da stringhe di log/errore.
 */
export function redactSecretFromText(text: string, secret?: string): string {
  if (!text) return '';
  let sanitized = text;
  if (secret && secret.length >= 8) {
    sanitized = sanitized.split(secret).join('[REDACTED_SECRET]');
  }
  sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{20,50}/g, '[REDACTED_SECRET]');
  return sanitized;
}

/**
 * Esegue un'operazione asincrona fornendo la chiave Gemini decifrata on-demand,
 * azzerando il Buffer in RAM al termine e sanitizzando eventuali errori.
 */
export async function withDecryptedGeminiKey<T>(
  operation: (apiKey: string) => Promise<T>
): Promise<T> {
  const rawEnv =
    process.env.GEMINI_API_KEY_ENCRYPTED ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!rawEnv || !rawEnv.trim()) {
    throw Object.assign(
      new Error('OCR Gemini non configurato: GEMINI_API_KEY_ENCRYPTED o GEMINI_API_KEY obbligatoria.'),
      { status: 503 }
    );
  }

  const trimmed = rawEnv.trim();
  let secretBuf: Buffer | null = null;
  let activeKey = '';

  try {
    if (trimmed.startsWith(ENVELOPE_PREFIX)) {
      secretBuf = decryptSecretEnvelopeToBuffer(trimmed);
      activeKey = secretBuf.toString('utf8');
    } else {
      secretBuf = Buffer.from(trimmed, 'utf8');
      activeKey = trimmed;
    }

    return await operation(activeKey);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const safeMsg = redactSecretFromText(rawMsg, activeKey);
    const wrapped = new Error(safeMsg) as Error & { status?: number };
    if (err && typeof err === 'object' && 'status' in err && typeof (err as { status?: unknown }).status === 'number') {
      wrapped.status = (err as { status: number }).status;
    }
    throw wrapped;
  } finally {
    if (secretBuf) {
      secretBuf.fill(0);
    }
    activeKey = '';
  }
}

/**
 * WebCrypto AES-GCM 256-bit Encryption & PII Masking Service
 * Standard NIST SP 800-38D compliant encryption for energy identifiers (POD/PDR) and Fiscal Codes.
 */

const ENCRYPTION_SALT = new Uint8Array([78, 142, 203, 44, 91, 12, 178, 55, 99, 10, 240, 18, 65, 87, 190, 33]);
const SECRET_PASSPHRASE = 'VOLTA_ENERGY_AES256_LOCAL_MASTER_KEY_V1';

let cachedKey: CryptoKey | null = null;

async function getDerivedKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_PASSPHRASE),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  cachedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCRYPTION_SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedKey;
}

export const cryptoService = {
  /**
   * Cifra una stringa o oggetto JSON con AES-256-GCM
   */
  async encrypt(data: string): Promise<string> {
    try {
      const key = await getDerivedKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
      const enc = new TextEncoder();
      const encodedData = enc.encode(data);

      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
      );

      // Concatenazione IV + Ciphertext in base64
      const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(cipherBuffer), iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch (err) {
      console.error('Errore durante crittografia AES-GCM:', err);
      return data;
    }
  },

  /**
   * Decifra una stringa cifrata con AES-256-GCM
   */
  async decrypt(encryptedBase64: string): Promise<string> {
    try {
      const key = await getDerivedKey();
      const rawString = atob(encryptedBase64);
      const combined = new Uint8Array(rawString.length);
      for (let i = 0; i < rawString.length; i++) {
        combined[i] = rawString.charCodeAt(i);
      }

      const iv = combined.slice(0, 12);
      const cipherText = combined.slice(12);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherText
      );

      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    } catch {
      // Se fallisce, potrebbe essere testo non cifrato (backward compatibility)
      return encryptedBase64;
    }
  },

  /**
   * Mascheramento PII per visualizzazione sicura
   */
  maskPodPdr(val: string): string {
    if (!val || val.length < 6) return '••••••••';
    return val.substring(0, 4) + '••••••••' + val.substring(val.length - 2);
  },

  maskFiscalCode(cf: string): string {
    if (!cf || cf.length < 8) return '••••••••';
    return cf.substring(0, 3) + '••••••••' + cf.substring(cf.length - 3);
  },

  maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '•••••••';
    return phone.substring(0, 6) + '••••' + phone.substring(phone.length - 2);
  }
};

/**
 * WebCrypto AES-GCM 256-bit Encryption & PII Masking Service
 * Standard NIST SP 800-38D compliant encryption for energy identifiers (POD/PDR) and Fiscal Codes.
 */

// Chiave di sessione effimera generata dinamicamente in memoria RAM (nessun segreto cablato nel client bundle)
let sessionKeyPromise: Promise<CryptoKey> | null = null;

async function getSessionKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('WebCrypto API non disponibile in questo ambiente');
  }
  if (!sessionKeyPromise) {
    sessionKeyPromise = window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non esportabile
      ['encrypt', 'decrypt']
    );
  }
  return sessionKeyPromise;
}

export const cryptoService = {
  /**
   * Cifra una stringa o oggetto JSON con AES-256-GCM
   */
  async encrypt(data: string): Promise<string> {
    try {
      const key = await getSessionKey();
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
      const key = await getSessionKey();
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

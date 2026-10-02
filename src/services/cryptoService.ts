/** Session-only AES-GCM helpers and display-only PII masking. These helpers do not provide encryption at rest. */

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
   * Encrypts data for use in the current page session only.
   * The key is intentionally ephemeral and must not be used for persisted data.
   */
  async encrypt(data: string): Promise<string> {
    const key = await getSessionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    return btoa(String.fromCharCode(...combined));
  },

  /**
   * Decrypts a value encrypted in this page session. Invalid ciphertext and
   * values from another session are rejected instead of being returned as text.
   */
  async decrypt(encryptedBase64: string): Promise<string> {
    if (typeof encryptedBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encryptedBase64)) {
      throw new Error('Formato Base64 AES-GCM non valido.');
    }

    const rawString = atob(encryptedBase64);
    if (btoa(rawString) !== encryptedBase64 || rawString.length < 28) {
      throw new Error('Ciphertext AES-GCM troncato o non canonico.');
    }
    const combined = Uint8Array.from(rawString, character => character.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const cipherText = combined.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await getSessionKey(),
      cipherText
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(decryptedBuffer);
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

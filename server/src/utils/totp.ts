import crypto from 'crypto';

/**
 * Utility crittografica standard RFC 6238 (TOTP: Time-Based One-Time Password Algorithm)
 * Utilizza HMAC-SHA1 con finestra temporale standard di 30 secondi.
 */

export function generateTotp(secret: string, stepOffset = 0, timeStep = 30): string {
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / timeStep) + stepOffset;
  
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));

  const keyBuffer = secret.startsWith('b32:')
    ? decodeBase32(secret.slice(4))
    : Buffer.from(secret, 'utf-8');
  const hmac = crypto.createHmac('sha1', keyBuffer);
  hmac.update(buf);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotp(code: string, secret: string, allowedStepsWindow = 1, timeStep = 30): boolean {
  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    return false;
  }

  const cleanCode = code.trim();

  // Verifica nella finestra [ -allowedStepsWindow ... +allowedStepsWindow ]
  for (let offset = -allowedStepsWindow; offset <= allowedStepsWindow; offset++) {
    const validCode = generateTotp(secret, offset, timeStep);
    if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(validCode))) {
      return true;
    }
  }

  return false;
}

export function generateTotpSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(20);
  let bits = 0;
  let value = 0;
  let encoded = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += alphabet[(value >>> (bits -= 5)) & 31];
    }
  }
  if (bits > 0) encoded += alphabet[(value << (5 - bits)) & 31];
  return `b32:${encoded}`;
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let bits = 0;
  let buffer = 0;
  for (const character of value.toUpperCase().replace(/=+$/, '')) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error('Segreto TOTP non valido.');
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits -= 8)) & 255);
    }
  }
  return Buffer.from(bytes);
}

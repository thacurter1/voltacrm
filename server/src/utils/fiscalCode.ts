const CF_ODD_VALUES: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const CF_EVEN_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CF_REGEX = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
const PIVA_REGEX = /^[0-9]{11}$/;

export interface FiscalValidationResult {
  valid: boolean;
  kind?: 'cf' | 'piva';
  normalized: string;
  reason?: string;
}

export function normalizeFiscalCode(value: string): string {
  return String(value || '').trim().toUpperCase();
}

export function shouldEnforceStrictFiscalChecksum(): boolean {
  return process.env.VOLTA_DEMO_MODE !== 'true';
}

export function validateItalianFiscalCodeOrVat(rawValue: string): FiscalValidationResult {
  const normalized = normalizeFiscalCode(rawValue);

  if (PIVA_REGEX.test(normalized)) {
    if (normalized === '00000000000') {
      return { valid: false, normalized, reason: 'Partita IVA non valida.' };
    }
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const digit = Number(normalized[i]);
      if (i % 2 === 0) {
        sum += digit;
      } else {
        const doubled = digit * 2;
        sum += doubled > 9 ? doubled - 9 : doubled;
      }
    }
    const expectedCheck = (10 - (sum % 10)) % 10;
    if (expectedCheck !== Number(normalized[10])) {
      return { valid: false, normalized, reason: 'Carattere di controllo Partita IVA non valido.' };
    }
    return { valid: true, kind: 'piva', normalized };
  }

  if (normalized.length === 16) {
    if (!CF_REGEX.test(normalized)) {
      return { valid: false, normalized, reason: 'Formato Codice Fiscale italiano non valido.' };
    }
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      const ch = normalized[i];
      const val = i % 2 === 0 ? CF_ODD_VALUES[ch] : CF_EVEN_VALUES[ch];
      if (val === undefined) {
        return { valid: false, normalized, reason: 'Carattere non ammesso nel Codice Fiscale.' };
      }
      sum += val;
    }
    const expectedChar = String.fromCharCode(65 + (sum % 26));
    if (expectedChar !== normalized[15]) {
      return { valid: false, normalized, reason: 'Carattere di controllo Codice Fiscale non valido.' };
    }
    return { valid: true, kind: 'cf', normalized };
  }

  return { valid: false, normalized, reason: 'Inserisci un Codice Fiscale di 16 caratteri o una Partita IVA di 11 cifre.' };
}

import { MarketIndex, SupplierOffer } from '../types';
import { calculateAnnualCost, CURRENT_MARKET_INDEX } from './energyEngine';

export const MAX_BILL_FILE_BYTES = 10 * 1024 * 1024; // 10 MB limit matching backend MAX_BILL_BYTES
export const ALLOWED_BILL_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ALLOWED_BILL_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'] as const;

export type UtilityType = 'luce' | 'gas';
export type ComparisonSource = 'account' | 'manual' | 'bill-reviewed';

export interface ComparisonInput {
  utilityType: UtilityType;
  annualConsumption: number;
  powerKw?: number;
  f1Kwh?: number;
  f2Kwh?: number;
  f3Kwh?: number;
  currentSupplier?: string;
  currentPricingType?: 'fixed' | 'indexed';
  currentUnitCost?: number;
  currentFixedFeeYear?: number;
  source: ComparisonSource;
  asOf?: string;
}

export interface ComparisonResult {
  offer: SupplierOffer;
  annualCost: number | null;
  currentAnnualCost: number | null;
  savingsEur: number | null;
  savingsPercent: number | null;
  reasonUnavailable?: string;
}

export function validateBillUploadFile(file: { name: string; size: number; type?: string } | null | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: 'Seleziona un file da caricare.' };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Il file selezionato è vuoto (0 byte).' };
  }
  if (file.size > MAX_BILL_FILE_BYTES) {
    return { valid: false, error: 'La dimensione del file supera il limite massimo consentito di 10 MB.' };
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (mime === 'image/webp' || ext === 'webp') {
    return { valid: false, error: 'Formato WebP non supportato dal sistema. Carica un file PDF, JPG o PNG.' };
  }

  const isAllowedMime = ALLOWED_BILL_MIME_TYPES.includes(mime as any);
  const isAllowedExt = ALLOWED_BILL_EXTENSIONS.includes(ext as any);

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: 'Formato non supportato. Sono ammessi esclusivamente documenti in formato PDF, JPG o PNG.',
    };
  }

  return { valid: true };
}

export function compareOffer(
  input: ComparisonInput,
  offer: SupplierOffer,
  marketIndex: MarketIndex = CURRENT_MARKET_INDEX
): ComparisonResult {
  if (offer.energyType !== input.utilityType) {
    return {
      offer,
      annualCost: null,
      currentAnnualCost: null,
      savingsEur: null,
      savingsPercent: null,
      reasonUnavailable: `L'offerta è per fornitura ${offer.energyType}, richiesta ${input.utilityType}.`,
    };
  }

  if (typeof input.annualConsumption !== 'number' || input.annualConsumption <= 0) {
    return {
      offer,
      annualCost: null,
      currentAnnualCost: null,
      savingsEur: null,
      savingsPercent: null,
      reasonUnavailable: 'Consumo annuo non specificato o pari a zero.',
    };
  }

  const utilityData = {
    type: input.utilityType,
    annualConsumption: input.annualConsumption,
    powerKw: input.powerKw || 3,
    f1Kwh: input.f1Kwh,
    f2Kwh: input.f2Kwh,
    f3Kwh: input.f3Kwh,
  };

  const proposedAnnualCost = calculateAnnualCost(
    utilityData,
    offer.pricingType,
    offer.unitPriceOrSpread,
    offer.fixedAnnualFee,
    marketIndex
  );

  const hasCurrentTariffData =
    typeof input.currentUnitCost === 'number' &&
    input.currentUnitCost > 0 &&
    Number.isFinite(input.currentUnitCost);

  if (!hasCurrentTariffData) {
    return {
      offer,
      annualCost: proposedAnnualCost,
      currentAnnualCost: null,
      savingsEur: null,
      savingsPercent: null,
      reasonUnavailable:
        'Costo tariffa attuale non disponibile. Inserisci il costo della materia prima o carica la bolletta per calcolare la differenza.',
    };
  }

  const currentAnnualCost = calculateAnnualCost(
    utilityData,
    input.currentPricingType || 'fixed',
    input.currentUnitCost!,
    input.currentFixedFeeYear || 0,
    marketIndex
  );

  // Calcolo matematico puro senza minimi artificiali (può essere positivo, zero o negativo)
  const savingsEur = Math.round((currentAnnualCost - proposedAnnualCost) * 100) / 100;
  const savingsPercent =
    currentAnnualCost > 0
      ? Math.round(((currentAnnualCost - proposedAnnualCost) / currentAnnualCost) * 1000) / 10
      : 0;

  return {
    offer,
    annualCost: proposedAnnualCost,
    currentAnnualCost,
    savingsEur,
    savingsPercent,
  };
}

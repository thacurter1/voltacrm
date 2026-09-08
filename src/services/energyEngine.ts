import { Customer, MarketIndex, SupplierOffer, SwitchAudit, UtilityPoint } from '../types';

export const CURRENT_MARKET_INDEX: MarketIndex = {
  punEurKwh: 0.1145, // PUN medio all'ingrosso
  psvEurSmc: 0.3820, // PSV medio gas all'ingrosso
  lastUpdated: 'Oggi (GME / Mercato Elettrico Italiano)',
  punTrend: 'down',
  psvTrend: 'stable',
};

// Catalogo offerte dei fornitori (mercato libero italiano)
export const MARKET_OFFERS: SupplierOffer[] = [
  // --- LUCE ---
  {
    id: 'off-luce-1',
    supplier: 'Octopus Energy',
    name: 'Octopus Fissa 12M',
    energyType: 'luce',
    pricingType: 'fixed',
    unitPriceOrSpread: 0.1180, // 0.118 €/kWh fissa
    fixedAnnualFee: 96.0, // 8€ al mese
    durationMonths: 12,
    greenCertified: true,
    tag: 'Miglior Prezzo',
  },
  {
    id: 'off-luce-2',
    supplier: 'A2A Energia',
    name: 'A2A Easy Luce Index',
    energyType: 'luce',
    pricingType: 'indexed_pun',
    unitPriceOrSpread: 0.0120, // PUN + 0.012 €/kWh spread
    fixedAnnualFee: 114.0, // 9.50€ al mese
    durationMonths: 12,
    greenCertified: true,
    tag: 'Broker Choice',
  },
  {
    id: 'off-luce-3',
    supplier: 'Enel Energia',
    name: 'Enel E-Light Relax 24M',
    energyType: 'luce',
    pricingType: 'fixed',
    unitPriceOrSpread: 0.1290,
    fixedAnnualFee: 120.0,
    durationMonths: 24,
    greenCertified: true,
    tag: 'Prezzo Bloccato',
  },
  {
    id: 'off-luce-4',
    supplier: 'Sorgenia',
    name: 'Next Energy Sunlight Luce',
    energyType: 'luce',
    pricingType: 'indexed_pun',
    unitPriceOrSpread: 0.0090, // PUN + 0.009 €/kWh
    fixedAnnualFee: 108.0,
    durationMonths: 12,
    greenCertified: true,
    tag: '100% Green',
  },

  // --- GAS ---
  {
    id: 'off-gas-1',
    supplier: 'Eni Plenitude',
    name: 'Plenitude Trend Casa Gas',
    energyType: 'gas',
    pricingType: 'indexed_psv',
    unitPriceOrSpread: 0.0450, // PSV + 0.045 €/Smc
    fixedAnnualFee: 108.0,
    durationMonths: 12,
    greenCertified: false,
    tag: 'Miglior Prezzo',
  },
  {
    id: 'off-gas-2',
    supplier: 'Edison Energia',
    name: 'Edison Dynamic Gas',
    energyType: 'gas',
    pricingType: 'indexed_psv',
    unitPriceOrSpread: 0.0520,
    fixedAnnualFee: 96.0,
    durationMonths: 12,
    greenCertified: false,
    tag: 'Broker Choice',
  },
  {
    id: 'off-gas-3',
    supplier: 'Hera Comm',
    name: 'Hera Impronta Zero Gas 12M',
    energyType: 'gas',
    pricingType: 'fixed',
    unitPriceOrSpread: 0.4450, // 0.445 €/Smc fissa
    fixedAnnualFee: 120.0,
    durationMonths: 12,
    greenCertified: true,
    tag: 'Prezzo Bloccato',
  }
];

// Calcolo spesa annuale per offerta / utenza
export function calculateAnnualCost(
  utility: Pick<UtilityPoint, 'type' | 'annualConsumption'>,
  pricingType: 'fixed' | 'indexed' | 'indexed_pun' | 'indexed_psv',
  unitPriceOrSpread: number,
  fixedAnnualFee: number,
  marketIndex = CURRENT_MARKET_INDEX
): number {
  let effectiveUnitCost = unitPriceOrSpread;

  if (utility.type === 'luce') {
    if (pricingType === 'indexed' || pricingType === 'indexed_pun') {
      effectiveUnitCost = marketIndex.punEurKwh + unitPriceOrSpread;
    }
  } else {
    if (pricingType === 'indexed' || pricingType === 'indexed_psv') {
      effectiveUnitCost = marketIndex.psvEurSmc + unitPriceOrSpread;
    }
  }

  // Costo materia prima + quota fissa di commercializzazione (CCV)
  const rawCost = (utility.annualConsumption * effectiveUnitCost) + fixedAnnualFee;
  
  // Stima oneri di sistema, trasporto e imposte (circa 35% del totale spesa nel mercato italiano)
  const estimatedTaxesAndNetwork = utility.type === 'luce' 
    ? (utility.annualConsumption * 0.075) + 60 
    : (utility.annualConsumption * 0.22) + 75;

  return Math.round((rawCost + estimatedTaxesAndNetwork) * 100) / 100;
}

// Analisi comparativa per un punto fornitura rispetto al mercato
export function findBestMarketOffer(
  utility: UtilityPoint, 
  offers: SupplierOffer[] = MARKET_OFFERS
): { bestOffer: SupplierOffer; currentCost: number; bestCost: number; savings: number; savingsPercent: number } {
  const currentCost = calculateAnnualCost(
    utility,
    utility.currentTariffType,
    utility.currentUnitCost,
    utility.currentFixedFeeYear
  );

  const eligibleOffers = offers.filter(o => o.energyType === utility.type);

  let bestOffer = eligibleOffers[0];
  let bestCost = Infinity;

  for (const offer of eligibleOffers) {
    const cost = calculateAnnualCost(
      utility,
      offer.pricingType,
      offer.unitPriceOrSpread,
      offer.fixedAnnualFee
    );
    if (cost < bestCost) {
      bestCost = cost;
      bestOffer = offer;
    }
  }

  const savings = Math.max(0, Math.round((currentCost - bestCost) * 100) / 100);
  const savingsPercent = currentCost > 0 ? Math.round((savings / currentCost) * 1000) / 10 : 0;

  return {
    bestOffer,
    currentCost,
    bestCost,
    savings,
    savingsPercent,
  };
}

// Esecuzione dell'Audit Quadrimestrale su tutti i contratti
export function runQuarterlyAudit(customers: Customer[]): SwitchAudit[] {
  const audits: SwitchAudit[] = [];

  for (const customer of customers) {
    for (const utility of customer.utilityPoints) {
      const comparison = findBestMarketOffer(utility);
      
      // Calcolo giorni di attività
      const start = new Date(customer.contractStartDate).getTime();
      const now = new Date().getTime();
      const daysActive = Math.floor((now - start) / (1000 * 60 * 60 * 24));

      // Se il risparmio supera 70€/anno o il 10%, è raccomandato lo switch
      const shouldSwitch = comparison.savings >= 70 && comparison.savingsPercent >= 8.0;

      audits.push({
        id: `audit-${customer.id}-${utility.id}`,
        customerId: customer.id,
        customerName: customer.name,
        utilityType: utility.type,
        podOrPdr: utility.podOrPdr,
        currentSupplier: utility.currentSupplier,
        currentAnnualCost: comparison.currentCost,
        bestOffer: comparison.bestOffer,
        bestOfferAnnualCost: comparison.bestCost,
        annualSavings: comparison.savings,
        savingsPercent: comparison.savingsPercent,
        daysActive,
        status: shouldSwitch ? 'switch_recommended' : 'already_optimal',
        scheduledAuditDate: customer.nextSwitchAuditDate,
      });
    }
  }

  return audits;
}

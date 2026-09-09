import { Customer, MarketIndex, SupplierOffer, SwitchAudit, UtilityPoint } from '../types.js';

export const CURRENT_MARKET_INDEX: MarketIndex = {
  punEurKwh: 0.1145, // Prezzo Unico Nazionale medio aggiornato
  psvEurSmc: 0.3850, // Punto di Scambio Virtuale gas
  lastUpdated: new Date().toISOString().split('T')[0],
  punTrend: 'down',
  psvTrend: 'stable',
};

export const MARKET_OFFERS: SupplierOffer[] = [
  {
    id: 'off-luce-1',
    supplier: 'Octopus Energy',
    name: 'Octopus Fissa 12M Green',
    energyType: 'luce',
    pricingType: 'fixed',
    unitPriceOrSpread: 0.1180,
    fixedAnnualFee: 96.0,
    durationMonths: 12,
    greenCertified: true,
    tag: 'Miglior Prezzo',
  },
  {
    id: 'off-luce-2',
    supplier: 'Dolomiti Energia',
    name: 'Dolomiti Mitica Web Luce',
    energyType: 'luce',
    pricingType: 'indexed_pun',
    unitPriceOrSpread: 0.0120,
    fixedAnnualFee: 114.0,
    durationMonths: 12,
    greenCertified: true,
    tag: 'Broker Choice',
  },
  {
    id: 'off-gas-1',
    supplier: 'Hera Comm',
    name: 'Hera Impronta Zero Gas',
    energyType: 'gas',
    pricingType: 'indexed_psv',
    unitPriceOrSpread: 0.0550,
    fixedAnnualFee: 108.0,
    durationMonths: 12,
    greenCertified: true,
    tag: 'Miglior Prezzo',
  },
];

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

  const rawCost = (utility.annualConsumption * effectiveUnitCost) + fixedAnnualFee;
  const estimatedTaxesAndNetwork = utility.type === 'luce' 
    ? (utility.annualConsumption * 0.075) + 60 
    : (utility.annualConsumption * 0.22) + 75;

  return Math.round((rawCost + estimatedTaxesAndNetwork) * 100) / 100;
}

export function findBestMarketOffer(
  utility: UtilityPoint, 
  offers: SupplierOffer[] = MARKET_OFFERS,
  marketIndex: MarketIndex = CURRENT_MARKET_INDEX
): { bestOffer: SupplierOffer; currentCost: number; bestCost: number; savings: number; savingsPercent: number } {
  const currentCost = calculateAnnualCost(
    utility,
    utility.currentTariffType,
    utility.currentUnitCost,
    utility.currentFixedFeeYear,
    marketIndex
  );

  const eligibleOffers = offers.filter(o => o.energyType === utility.type);
  let bestOffer = eligibleOffers[0];
  let bestCost = Infinity;

  for (const offer of eligibleOffers) {
    const cost = calculateAnnualCost(
      utility,
      offer.pricingType,
      offer.unitPriceOrSpread,
      offer.fixedAnnualFee,
      marketIndex
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

export function runQuarterlyAudit(
  customers: Customer[],
  marketIndex: MarketIndex = CURRENT_MARKET_INDEX
): SwitchAudit[] {
  const audits: SwitchAudit[] = [];

  for (const customer of customers) {
    for (const utility of customer.utilityPoints) {
      const comparison = findBestMarketOffer(utility, MARKET_OFFERS, marketIndex);
      const start = new Date(customer.contractStartDate).getTime();
      const now = new Date().getTime();
      const daysActive = Math.floor((now - start) / (1000 * 60 * 60 * 24));
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

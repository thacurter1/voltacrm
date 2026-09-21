import { Customer } from '../types';

export interface CustomerPortfolioForecast {
  customerId: string;
  customerName: string;
  accountManager: string;
  city: string;
  utilityCount: number;
  utilityTypes: ('luce' | 'gas')[];
  totalKwh: number;
  totalSmc: number;
  nextSwitchDate: string;
  daysUntilSwitch: number;
  projectedUpfrontEur: number;
  projectedMonthlyRecurringEur: number;
  projectedAnnualRecurringEur: number;
  isDualFuel: boolean;
  status: 'due_soon' | 'upcoming' | 'stable';
}

export interface ConsultantPortfolioSummary {
  consultantName: string;
  totalCustomers: number;
  totalUtilityPoints: number;
  totalLucePoints: number;
  totalGasPoints: number;
  totalKwh: number;
  totalSmc: number;
  projectedUpfrontSwitchEur: number;
  projectedMonthlyRecurringEur: number;
  projectedAnnualRecurringEur: number;
  switchesNext30Days: number;
  switchesNext60Days: number;
  switchesNext90Days: number;
  customers: CustomerPortfolioForecast[];
}

export interface GlobalPortfolioSummary {
  totalCustomers: number;
  totalUtilityPoints: number;
  totalLuceKwh: number;
  totalGasSmc: number;
  totalProjectedUpfrontEur: number;
  totalProjectedMonthlyRecurringEur: number;
  totalProjectedAnnualRecurringEur: number;
  switchesNext30Days: number;
  consultants: ConsultantPortfolioSummary[];
  allForecasts: CustomerPortfolioForecast[];
}

/**
 * Calcola la previsione di guadagno e gestione del portafoglio clienti.
 * - Upfront: Luce €45/€95, Gas €40/€85, Dual Fuel Bonus +€25
 * - Ricorrente: 0.0025 €/kWh e 0.015 €/Smc
 */
export function calculatePortfolioForecast(customers: Customer[]): GlobalPortfolioSummary {
  const allForecasts: CustomerPortfolioForecast[] = [];
  const consultantMap = new Map<string, Customer[]>();
  const now = new Date().getTime();

  // Group by consultant / account manager
  customers.forEach(customer => {
    const manager = customer.accountManager?.trim() || 'Broker Generale';
    if (!consultantMap.has(manager)) {
      consultantMap.set(manager, []);
    }
    consultantMap.get(manager)!.push(customer);

    const utilityTypes: ('luce' | 'gas')[] = [];
    let totalKwh = 0;
    let totalSmc = 0;
    let upfrontSum = 0;

    const isBusiness = 
      (Boolean(customer.fiscalCode) && customer.fiscalCode.trim().length === 11 && /^\d+$/.test(customer.fiscalCode.trim())) ||
      /\b(srl|spa|snc|sas|ditta|societ[aà]|ristorante|bar|officin[ae]|hotel|albergo)\b/i.test(customer.name);

    (customer.utilityPoints || []).forEach(point => {
      if (point.type === 'luce') {
        utilityTypes.push('luce');
        const kwh = point.annualConsumption || 2700;
        totalKwh += kwh;
        // B2B (P.IVA, ragione sociale business o > 5000 kWh) paga €95 upfront, Residenziale paga €45
        upfrontSum += (isBusiness || kwh > 5000) ? 95 : 45;
      } else if (point.type === 'gas') {
        utilityTypes.push('gas');
        const smc = point.annualConsumption || 1000;
        totalSmc += smc;
        // B2B (P.IVA, ragione sociale business o > 1500 Smc) paga €85 upfront, Residenziale paga €40
        upfrontSum += (isBusiness || smc > 1500) ? 85 : 40;
      }
    });

    const isDualFuel = utilityTypes.includes('luce') && utilityTypes.includes('gas');
    if (isDualFuel) {
      upfrontSum += 25; // Bonus Dual Fuel
    }

    // Ricorrente calcolato su volumi annui
    const annualKwhRecurring = totalKwh * 0.0025;
    const annualSmcRecurring = totalSmc * 0.015;
    const projectedAnnualRecurringEur = Math.round((annualKwhRecurring + annualSmcRecurring) * 100) / 100;
    const projectedMonthlyRecurringEur = Math.round((projectedAnnualRecurringEur / 12) * 100) / 100;

    // Days until next switch audit
    const switchDateStr = customer.nextSwitchAuditDate || customer.contractStartDate || new Date().toISOString().split('T')[0];
    const switchTime = new Date(switchDateStr).getTime();
    const daysUntilSwitch = Math.max(0, Math.ceil((switchTime - now) / (1000 * 60 * 60 * 24)));

    let status: 'due_soon' | 'upcoming' | 'stable' = 'stable';
    if (daysUntilSwitch <= 30) status = 'due_soon';
    else if (daysUntilSwitch <= 60) status = 'upcoming';

    allForecasts.push({
      customerId: customer.id,
      customerName: customer.name,
      accountManager: manager,
      city: customer.city || 'Italia',
      utilityCount: (customer.utilityPoints || []).length,
      utilityTypes,
      totalKwh,
      totalSmc,
      nextSwitchDate: switchDateStr,
      daysUntilSwitch,
      projectedUpfrontEur: upfrontSum,
      projectedMonthlyRecurringEur,
      projectedAnnualRecurringEur,
      isDualFuel,
      status
    });
  });

  // Calculate summaries per consultant
  const consultants: ConsultantPortfolioSummary[] = [];

  consultantMap.forEach((cList, manager) => {
    const managerForecasts = allForecasts.filter(f => f.accountManager === manager);
    let totalPoints = 0;
    let totalLuce = 0;
    let totalGas = 0;
    let totalKwh = 0;
    let totalSmc = 0;
    let totalUpfront = 0;
    let totalAnnualRec = 0;
    let next30 = 0;
    let next60 = 0;
    let next90 = 0;

    managerForecasts.forEach(f => {
      totalPoints += f.utilityCount;
      f.utilityTypes.forEach(t => {
        if (t === 'luce') totalLuce++;
        if (t === 'gas') totalGas++;
      });
      totalKwh += f.totalKwh;
      totalSmc += f.totalSmc;
      totalUpfront += f.projectedUpfrontEur;
      totalAnnualRec += f.projectedAnnualRecurringEur;

      if (f.daysUntilSwitch <= 30) next30++;
      if (f.daysUntilSwitch <= 60) next60++;
      if (f.daysUntilSwitch <= 90) next90++;
    });

    consultants.push({
      consultantName: manager,
      totalCustomers: cList.length,
      totalUtilityPoints: totalPoints,
      totalLucePoints: totalLuce,
      totalGasPoints: totalGas,
      totalKwh,
      totalSmc,
      projectedUpfrontSwitchEur: Math.round(totalUpfront * 100) / 100,
      projectedMonthlyRecurringEur: Math.round((totalAnnualRec / 12) * 100) / 100,
      projectedAnnualRecurringEur: Math.round(totalAnnualRec * 100) / 100,
      switchesNext30Days: next30,
      switchesNext60Days: next60,
      switchesNext90Days: next90,
      customers: managerForecasts
    });
  });

  // Global aggregate
  let globalLuceKwh = 0;
  let globalGasSmc = 0;
  let globalUpfront = 0;
  let globalAnnualRec = 0;
  let globalNext30 = 0;
  let globalPoints = 0;

  allForecasts.forEach(f => {
    globalPoints += f.utilityCount;
    globalLuceKwh += f.totalKwh;
    globalGasSmc += f.totalSmc;
    globalUpfront += f.projectedUpfrontEur;
    globalAnnualRec += f.projectedAnnualRecurringEur;
    if (f.daysUntilSwitch <= 30) globalNext30++;
  });

  return {
    totalCustomers: customers.length,
    totalUtilityPoints: globalPoints,
    totalLuceKwh: globalLuceKwh,
    totalGasSmc: globalGasSmc,
    totalProjectedUpfrontEur: Math.round(globalUpfront * 100) / 100,
    totalProjectedMonthlyRecurringEur: Math.round((globalAnnualRec / 12) * 100) / 100,
    totalProjectedAnnualRecurringEur: Math.round(globalAnnualRec * 100) / 100,
    switchesNext30Days: globalNext30,
    consultants: consultants.sort((a, b) => b.totalCustomers - a.totalCustomers),
    allForecasts: allForecasts.sort((a, b) => a.daysUntilSwitch - b.daysUntilSwitch)
  };
}

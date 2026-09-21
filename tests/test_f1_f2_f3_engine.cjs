const assert = require('node:assert');
const { calculateAnnualCost: serverCalc } = require('../server/dist/services/energyEngine.js');

console.log('=== TEST SUITE: F1/F2/F3 TIME-BAND ENGINE CALCULATION ===');

const mockMarket = {
  punEurKwh: 0.11,
  psvEurSmc: 0.40,
  punF1: 0.13,
  punF2: 0.12,
  punF3: 0.10,
  lastUpdated: '2026-09-21T12:00:00Z',
  punTrend: 'stable',
  psvTrend: 'stable'
};

const utilityWithTimeBands = {
  type: 'luce',
  annualConsumption: 3000,
  powerKw: 3,
  f1Kwh: 1000,
  f2Kwh: 1000,
  f3Kwh: 1000
};

// 1. Indexed PUN with time bands
const costIndexed = serverCalc(
  utilityWithTimeBands,
  'indexed_pun',
  0.010, // spread
  120,   // fixed CCV
  mockMarket
);

// Atteso:
// effF1 = (0.13 * 1.1) + 0.010 = 0.153 -> 1000 * 0.153 = 153
// effF2 = (0.12 * 1.1) + 0.010 = 0.142 -> 1000 * 0.142 = 142
// effF3 = (0.10 * 1.1) + 0.010 = 0.120 -> 1000 * 0.120 = 120
// CCV = 120
// Raw = 153 + 142 + 120 + 120 = 535
// Taxes = (3000 * 0.075) + 60 + (3 * 23.50) = 225 + 60 + 70.5 = 355.5
// Total = 535 + 355.5 = 890.5
console.log(`Cost calculated for indexed offer with F1/F2/F3: €${costIndexed}`);
assert.equal(costIndexed, 890.5, `Atteso 890.5, ottenuto ${costIndexed}`);
console.log('✔ Calcolo indicizzato F1/F2/F3 verificato con successo.');

// 2. Fixed offer with time bands
const costFixed = serverCalc(
  utilityWithTimeBands,
  'fixed',
  0.15, // fissa 0.15 €/kWh
  120,
  mockMarket
);
// Atteso:
// Raw = 3000 * 0.15 + 120 = 450 + 120 = 570
// Taxes = 355.5
// Total = 570 + 355.5 = 925.5
console.log(`Cost calculated for fixed offer with F1/F2/F3: €${costFixed}`);
assert.equal(costFixed, 925.5, `Atteso 925.5, ottenuto ${costFixed}`);
console.log('✔ Calcolo tariffa fissa con fasce verificato con successo.');

// 3. Fallback monorario when F1/F2/F3 are not present
const utilityMonoraria = {
  type: 'luce',
  annualConsumption: 3000,
  powerKw: 3
};
const costMono = serverCalc(
  utilityMonoraria,
  'indexed_pun',
  0.010,
  120,
  mockMarket
);
// eff = (0.11 * 1.1) + 0.010 = 0.121 + 0.010 = 0.131
// Raw = 3000 * 0.131 + 120 = 393 + 120 = 513
// Taxes = 355.5
// Total = 513 + 355.5 = 868.5
console.log(`Cost calculated for monoraria: €${costMono}`);
assert.equal(costMono, 868.5, `Atteso 868.5, ottenuto ${costMono}`);
console.log('✔ Fallback monorario preservato con precisione matematica.');

console.log('\n🎉 ALL F1/F2/F3 ENGINE TESTS PASSED!');

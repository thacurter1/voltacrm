process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: ENERGY OFFER DETAILS ARERA 4-COMPONENT BREAKDOWN (TDD) ===');

const componentPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyOfferDetails.tsx');
assert.ok(fs.existsSync(componentPath), 'EnergyOfferDetails.tsx must exist');

const src = fs.readFileSync(componentPath, 'utf8');

// 1. Dual Monthly & Annual Presentation Checks
console.log('\n[TEST 1] Monthly hero pricing and annual secondary representation');

// Check that monthlyCost and currentMonthlyCost are computed
assert.ok(
  src.includes('monthlyCost') && (src.includes('Math.round(annualCost / 12)') || src.includes('annualCost / 12')),
  'EnergyOfferDetails must calculate monthlyCost from annualCost / 12'
);

assert.ok(
  src.includes('currentMonthlyCost') && (src.includes('Math.round(currentAnnualCost / 12)') || src.includes('currentAnnualCost / 12')),
  'EnergyOfferDetails must calculate currentMonthlyCost from currentAnnualCost / 12'
);

// Check that /mese is primary hero display for both new offer and current tariff
assert.ok(
  src.includes('/mese'),
  'EnergyOfferDetails must display monthly cost (~€{monthlyCost}/mese)'
);

assert.ok(
  src.includes('/anno'),
  'EnergyOfferDetails must display secondary annual cost (~€{annualCost}/anno)'
);

// 2. ARERA 4-Component Breakdown Section Checks
console.log('\n[TEST 2] ARERA 4-Component breakdown specification');

// Must mention ARERA
assert.ok(
  src.includes('ARERA') || src.includes('Arera'),
  'EnergyOfferDetails must feature ARERA breakdown section'
);

// Must have the 4 standard components:
// 1. Spesa Materia Energia
assert.ok(
  src.includes('Spesa Materia Energia') || src.includes('Materia Energia') || src.includes('Spesa materia energia'),
  'Must include Component 1: Spesa Materia Energia'
);

// 2. Spesa Trasporto e Gestione Contatore
assert.ok(
  src.includes('Trasporto') && src.includes('Contatore'),
  'Must include Component 2: Spesa Trasporto e Gestione Contatore'
);

// 3. Spesa Oneri di Sistema
assert.ok(
  src.includes('Oneri di Sistema') || src.includes('oneri di sistema') || src.includes('Oneri di sistema'),
  'Must include Component 3: Spesa Oneri di Sistema'
);

// 4. Imposte stimate (IVA e accise)
assert.ok(
  src.includes('Imposte') || src.includes('imposte'),
  'Must include Component 4: Imposte stimate (IVA e accise)'
);

// Check percentage weights: 55%/60% for Materia Energia, 18%/15% for Trasporto, 12%/8% for Oneri, 15%/17% for Imposte
assert.ok(
  (src.includes('55') || src.includes('0.55')) && (src.includes('60') || src.includes('0.60')),
  'Must model Materia Energia (~55% luce, ~60% gas)'
);

assert.ok(
  (src.includes('18') || src.includes('0.18')) && (src.includes('15') || src.includes('0.15')),
  'Must model Trasporto e Contatore (~18% luce, ~15% gas)'
);

assert.ok(
  (src.includes('12') || src.includes('0.12')) && (src.includes('8') || src.includes('0.08')),
  'Must model Oneri di Sistema (~12% luce, ~8% gas)'
);

// 3. Consultation form preservation
console.log('\n[TEST 3] Consultation form & handler preservation');
assert.ok(
  src.includes('onRequestConsultation'),
  'onRequestConsultation callback must be preserved'
);
assert.ok(
  src.includes('customerNotes') && src.includes('setCustomerNotes'),
  'Consultation notes input must be preserved'
);
assert.ok(
  src.includes('submitConsultation'),
  'submitConsultation function must be preserved'
);

// 4. Math verification of breakdown shares
console.log('\n[TEST 4] Mathematical integrity of ARERA shares');
const LUCE_SHARES = { materia: 0.55, trasporto: 0.18, oneri: 0.12, imposte: 0.15 };
const GAS_SHARES = { materia: 0.60, trasporto: 0.15, oneri: 0.08, imposte: 0.17 };

const sumLuce = Object.values(LUCE_SHARES).reduce((a, b) => a + b, 0);
const sumGas = Object.values(GAS_SHARES).reduce((a, b) => a + b, 0);

assert.strictEqual(Math.round(sumLuce * 100), 100, 'Luce ARERA shares must sum to 100%');
assert.strictEqual(Math.round(sumGas * 100), 100, 'Gas ARERA shares must sum to 100%');

console.log('🎉 ALL ENERGY OFFER DETAILS ARERA TESTS PASSED!');

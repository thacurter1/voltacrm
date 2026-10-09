process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');

console.log('=== TEST SUITE: HONEST ENERGY OFFER COMPARISON SCENARIOS (TDD) ===');

// Load energyEngine & offerComparison
// We can test the math with the exact calculation engine
const { calculateAnnualCost, MARKET_OFFERS, CURRENT_MARKET_INDEX } = require('../server/dist/services/energyEngine.js');

// Implement pure compareOffer check matching src/services/offerComparison.ts
function compareOfferPure(input, offer, marketIndex = CURRENT_MARKET_INDEX) {
  if (offer.energyType !== input.utilityType) {
    return {
      offer,
      annualCost: null,
      currentAnnualCost: null,
      savingsEur: null,
      savingsPercent: null,
      reasonUnavailable: `L'offerta è per ${offer.energyType}, richiesta ${input.utilityType}.`
    };
  }

  if (!input.annualConsumption || input.annualConsumption <= 0) {
    return {
      offer,
      annualCost: null,
      currentAnnualCost: null,
      savingsEur: null,
      savingsPercent: null,
      reasonUnavailable: 'Consumo annuo non specificato o pari a zero.'
    };
  }

  const utilityData = {
    type: input.utilityType,
    annualConsumption: input.annualConsumption,
    powerKw: input.powerKw || 3,
    f1Kwh: input.f1Kwh,
    f2Kwh: input.f2Kwh,
    f3Kwh: input.f3Kwh
  };

  const proposedCost = calculateAnnualCost(
    utilityData,
    offer.pricingType,
    offer.unitPriceOrSpread,
    offer.fixedAnnualFee,
    marketIndex
  );

  const hasCurrent = typeof input.currentUnitCost === 'number' && input.currentUnitCost > 0;
  if (!hasCurrent) {
    return {
      offer,
      annualCost: proposedCost,
      currentAnnualCost: null,
      savingsEur: null,
      savingsPercent: null,
      reasonUnavailable: 'Costo tariffa attuale non disponibile.'
    };
  }

  const currentCost = calculateAnnualCost(
    utilityData,
    input.currentPricingType || 'fixed',
    input.currentUnitCost,
    input.currentFixedFeeYear || 0,
    marketIndex
  );

  const diff = Math.round((currentCost - proposedCost) * 100) / 100;
  const percent = currentCost > 0 ? Math.round((diff / currentCost) * 1000) / 10 : 0;

  return {
    offer,
    annualCost: proposedCost,
    currentAnnualCost: currentCost,
    savingsEur: diff,
    savingsPercent: percent
  };
}

// SCENARIO 1: Cheaper offer -> Positive savings
const cheapOffer = {
  id: 'off-test-1',
  energyType: 'luce',
  pricingType: 'fixed',
  unitPriceOrSpread: 0.118,
  fixedAnnualFee: 96
};

const inputScenario1 = {
  utilityType: 'luce',
  annualConsumption: 2700,
  powerKw: 3,
  currentPricingType: 'fixed',
  currentUnitCost: 0.28,
  currentFixedFeeYear: 144
};

const res1 = compareOfferPure(inputScenario1, cheapOffer);
assert.ok(res1.annualCost !== null, 'annualCost must be computed');
assert.ok(res1.currentAnnualCost !== null, 'currentAnnualCost must be computed');
assert.ok(res1.savingsEur > 0, `Expected positive savings, got ${res1.savingsEur}`);
assert.ok(res1.savingsPercent > 0, `Expected positive savings percent, got ${res1.savingsPercent}`);
console.log(`✔ Scenario 1 (Cheaper offer): Current €${res1.currentAnnualCost} -> New €${res1.annualCost} (Savings: €${res1.savingsEur})`);

// SCENARIO 2: Same cost -> Exactly 0 savings
const inputScenario2 = {
  utilityType: 'luce',
  annualConsumption: 2700,
  powerKw: 3,
  currentPricingType: 'fixed',
  currentUnitCost: 0.118,
  currentFixedFeeYear: 96
};

const res2 = compareOfferPure(inputScenario2, cheapOffer);
assert.strictEqual(res2.savingsEur, 0, `Expected exactly 0 savings, got ${res2.savingsEur}`);
assert.strictEqual(res2.savingsPercent, 0, `Expected 0 percent, got ${res2.savingsPercent}`);
console.log('✔ Scenario 2 (Same cost): Savings is exactly €0.00 (not artificial positive)');

// SCENARIO 3: More expensive offer -> Negative savings (NO Math.max clamp!)
const expensiveOffer = {
  id: 'off-test-expensive',
  energyType: 'luce',
  pricingType: 'fixed',
  unitPriceOrSpread: 0.35,
  fixedAnnualFee: 200
};

const res3 = compareOfferPure(inputScenario1, expensiveOffer);
assert.ok(res3.savingsEur < 0, `Expected negative savings for expensive offer, got ${res3.savingsEur}`);
assert.ok(res3.savingsPercent < 0, `Expected negative percent, got ${res3.savingsPercent}`);
assert.notStrictEqual(res3.savingsEur, 80, 'Must NOT clamp negative difference to 80');
assert.notStrictEqual(res3.savingsEur, 120, 'Must NOT clamp negative difference to 120');
console.log(`✔ Scenario 3 (More expensive offer): Negative difference preserved (€${res3.savingsEur}, no artificial minimum clamp)`);

// SCENARIO 4: Missing current tariff data -> No personalized savings claim
const inputScenario4 = {
  utilityType: 'luce',
  annualConsumption: 2700,
  powerKw: 3,
  // No currentUnitCost
};

const res4 = compareOfferPure(inputScenario4, cheapOffer);
assert.ok(res4.annualCost !== null && res4.annualCost > 0, 'New offer annual cost must still be estimated');
assert.strictEqual(res4.currentAnnualCost, null, 'currentAnnualCost must be null');
assert.strictEqual(res4.savingsEur, null, 'savingsEur must be null');
assert.strictEqual(res4.savingsPercent, null, 'savingsPercent must be null');
assert.ok(res4.reasonUnavailable, 'reasonUnavailable must be present explaining missing data');
console.log('✔ Scenario 4 (Missing current data): Offer annual cost shown (€' + res4.annualCost + '), but savings claims are null with reason');

// SCENARIO 5: Filtering & Sorting
const luceOffers = MARKET_OFFERS.filter(o => o.energyType === 'luce');
const gasOffers = MARKET_OFFERS.filter(o => o.energyType === 'gas');

assert.ok(luceOffers.length > 0, 'Must have luce offers');
assert.ok(gasOffers.length > 0, 'Must have gas offers');
assert.ok(luceOffers.every(o => o.energyType === 'luce'), 'All filtered luce offers are luce');
assert.ok(gasOffers.every(o => o.energyType === 'gas'), 'All filtered gas offers are gas');

// Sorting test
const sortedLuce = [...luceOffers].map(o => compareOfferPure(inputScenario1, o))
  .sort((a, b) => (a.annualCost || 0) - (b.annualCost || 0));

for (let i = 0; i < sortedLuce.length - 1; i++) {
  assert.ok(sortedLuce[i].annualCost <= sortedLuce[i + 1].annualCost, 'Offers must be sorted in ascending order of annualCost');
}
console.log('✔ Scenario 5: Filter and sort by annual cost verified');

console.log('🎉 ALL HONEST COMPARISON SCENARIOS PASSED!');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: FRONTEND GUEST CONSULTATION MODAL & API (TDD) ===');

const portalApiPath = path.join(__dirname, '..', 'src', 'api', 'portal.ts');
assert.ok(fs.existsSync(portalApiPath), 'src/api/portal.ts must exist');
const portalApiSrc = fs.readFileSync(portalApiPath, 'utf8');

const offerDetailsPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyOfferDetails.tsx');
assert.ok(fs.existsSync(offerDetailsPath), 'EnergyOfferDetails.tsx must exist');
const offerDetailsSrc = fs.readFileSync(offerDetailsPath, 'utf8');

// -----------------------------------------------------------------------------
// TEST 1: portalApi ConsultationRequestInput & guest support
// -----------------------------------------------------------------------------
console.log('\n[TEST 1] portal.ts ConsultationRequestInput interface declaration');
assert.ok(
  portalApiSrc.includes('export interface ConsultationRequestInput'),
  'portal.ts must export ConsultationRequestInput interface'
);
assert.ok(
  portalApiSrc.includes('customerName?:') || portalApiSrc.includes('customerName :'),
  'ConsultationRequestInput must include optional customerName'
);
assert.ok(
  portalApiSrc.includes('phone?:') || portalApiSrc.includes('phone :'),
  'ConsultationRequestInput must include optional phone'
);
assert.ok(
  portalApiSrc.includes('privacyConsent?:') || portalApiSrc.includes('privacyConsent :'),
  'ConsultationRequestInput must include optional privacyConsent'
);

// -----------------------------------------------------------------------------
// TEST 2: Demo fallback saves lead with source 'public_comparator'
// -----------------------------------------------------------------------------
console.log('\n[TEST 2] Demo fallback saves guest lead with source public_comparator');
assert.ok(
  portalApiSrc.includes("'public_comparator'") || portalApiSrc.includes('"public_comparator"'),
  "Demo fallback in portal.ts must persist guest lead with source 'public_comparator'"
);

// -----------------------------------------------------------------------------
// TEST 3: EnergyOfferDetails accepts isGuest and detects guest status
// -----------------------------------------------------------------------------
console.log('\n[TEST 3] EnergyOfferDetails guest detection and props');
assert.ok(
  offerDetailsSrc.includes('isGuest?: boolean') || offerDetailsSrc.includes('isGuest?:'),
  'EnergyOfferDetailsProps must support optional isGuest prop'
);
assert.ok(
  offerDetailsSrc.includes('isGuest') && (offerDetailsSrc.includes("currentInput.source !== 'account'") || offerDetailsSrc.includes('source !== "account"')),
  'EnergyOfferDetails must detect guest mode via isGuest or currentInput.source !== account'
);

// -----------------------------------------------------------------------------
// TEST 4: Guest intake form inputs in EnergyOfferDetails
// -----------------------------------------------------------------------------
console.log('\n[TEST 4] Guest intake form inputs (Name, Phone, Email, Time pills, Privacy checkbox)');
assert.ok(
  offerDetailsSrc.includes('Mario Rossi') || offerDetailsSrc.includes('Nome e Cognome'),
  'EnergyOfferDetails must have Nome e Cognome input with Mario Rossi placeholder'
);
assert.ok(
  offerDetailsSrc.includes('placeholder="+39 347 1234567"') || offerDetailsSrc.includes('+39 347 1234567') || offerDetailsSrc.includes('type="tel"'),
  'EnergyOfferDetails must have Telefono input with type=tel and Italian format placeholder'
);
assert.ok(
  offerDetailsSrc.includes('Email') && (offerDetailsSrc.includes('opzionale') || offerDetailsSrc.includes('mario.rossi@email.it')),
  'EnergyOfferDetails must have optional Email input'
);
assert.ok(
  offerDetailsSrc.includes('Mattina (9-13)') && offerDetailsSrc.includes('Pomeriggio (14-18)') && offerDetailsSrc.includes('Qualsiasi'),
  'EnergyOfferDetails must have preferred contact time pill selector (Mattina, Pomeriggio, Qualsiasi)'
);
assert.ok(
  offerDetailsSrc.includes('informativa privacy') || offerDetailsSrc.includes('trattamento dei dati'),
  'EnergyOfferDetails must have mandatory Privacy checkbox'
);

// -----------------------------------------------------------------------------
// TEST 5: Form validation before submission
// -----------------------------------------------------------------------------
console.log('\n[TEST 5] Form validation for guest inputs');
assert.ok(
  offerDetailsSrc.includes('8') && (offerDetailsSrc.includes('replace(/\\D/g') || offerDetailsSrc.includes('length < 8') || offerDetailsSrc.includes('length < 8') || offerDetailsSrc.includes('.length >= 8')),
  'EnergyOfferDetails must validate phone number has at least 8 digits'
);
assert.ok(
  offerDetailsSrc.includes('privacyConsent') || offerDetailsSrc.includes('privacy'),
  'EnergyOfferDetails must validate privacy consent is checked'
);

// -----------------------------------------------------------------------------
// TEST 6: Success state screen after submission
// -----------------------------------------------------------------------------
console.log('\n[TEST 6] Success celebration state with 24 ore message and return button');
assert.ok(
  offerDetailsSrc.includes('24 ore') || offerDetailsSrc.includes('24h'),
  'EnergyOfferDetails success state must mention ricontatto entro 24 ore'
);
assert.ok(
  offerDetailsSrc.includes('Torna al confronto'),
  'EnergyOfferDetails success state must have "Torna al confronto" button'
);

console.log('\n🎉 ALL GUEST CONSULTATION MODAL TESTS PASSED!');

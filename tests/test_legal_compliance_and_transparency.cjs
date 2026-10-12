process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: LEGAL COMPLIANCE, GDPR PRIVACY & ARERA TRANSPARENCY (TDD RED PHASE) ===');

// 1. Verify LegalFooter component exists and contains corporate & contact essentials
console.log('\n[TEST 1] LegalFooter component structure & corporate data');
const legalFooterPath = path.join(__dirname, '..', 'src', 'components', 'common', 'LegalFooter.tsx');
assert.ok(fs.existsSync(legalFooterPath), 'src/components/common/LegalFooter.tsx must exist');

const legalFooterSrc = fs.readFileSync(legalFooterPath, 'utf8');
assert.ok(legalFooterSrc.includes('Volta Energia S.r.l.'), 'Must include corporate name Volta Energia S.r.l.');
assert.ok(legalFooterSrc.includes('12948570155'), 'Must include P.IVA / CF 12948570155');
assert.ok(legalFooterSrc.includes('800 912 345'), 'Must include Numero Verde gratuito 800 912 345');
assert.ok(legalFooterSrc.includes('Monte Napoleone'), 'Must include registered office address');
assert.ok(legalFooterSrc.includes('ARERA'), 'Must include ARERA independent mediator disclaimer');
assert.ok(legalFooterSrc.includes('onOpenLegal') || legalFooterSrc.includes('onOpenModal'), 'Must expose callback to open legal modal tabs');
console.log('✔ LegalFooter contains complete institutional data and interactive triggers');

// 2. Verify LegalModal component structure & tabs (Privacy, ARERA, Terms)
console.log('\n[TEST 2] LegalModal component tabs, GDPR & ARERA content');
const legalModalPath = path.join(__dirname, '..', 'src', 'components', 'common', 'LegalModal.tsx');
assert.ok(fs.existsSync(legalModalPath), 'src/components/common/LegalModal.tsx must exist');

const legalModalSrc = fs.readFileSync(legalModalPath, 'utf8');
assert.ok(legalModalSrc.includes('privacy'), 'Must support privacy tab');
assert.ok(legalModalSrc.includes('arera'), 'Must support arera tab');
assert.ok(legalModalSrc.includes('terms'), 'Must support terms tab');
assert.ok(legalModalSrc.includes('Regolamento UE 2016/679') || legalModalSrc.includes('GDPR'), 'Must detail GDPR reference');
assert.ok(legalModalSrc.includes('telemarketing') || legalModalSrc.includes('cessione a terzi'), 'Must guarantee no third-party telemarketing sale');
assert.ok(legalModalSrc.includes('PUN') && legalModalSrc.includes('PSV'), 'ARERA tab must explain PUN and PSV market indices');
assert.ok(legalModalSrc.includes('role="dialog"') || legalModalSrc.includes("role='dialog'") || legalModalSrc.includes('aria-modal="true"'), 'Must have accessible dialog semantics');
console.log('✔ LegalModal provides accessible GDPR and ARERA transparency breakdown');

// 3. Verify CookieBanner component
console.log('\n[TEST 3] CookieBanner technical-only cookie transparency');
const cookieBannerPath = path.join(__dirname, '..', 'src', 'components', 'common', 'CookieBanner.tsx');
assert.ok(fs.existsSync(cookieBannerPath), 'src/components/common/CookieBanner.tsx must exist');

const cookieBannerSrc = fs.readFileSync(cookieBannerPath, 'utf8');
assert.ok(cookieBannerSrc.includes('cookie tecnici') || cookieBannerSrc.includes('tecnici essenziali'), 'Must state use of essential technical cookies only');
assert.ok(cookieBannerSrc.includes('localStorage'), 'Must persist user acknowledgment');
assert.ok(cookieBannerSrc.includes('Accetta') || cookieBannerSrc.includes('Ho capito'), 'Must have confirmation button');
console.log('✔ CookieBanner technical cookie consent verified');

// 4. Verify CustomerApp integrates LegalFooter and CookieBanner
console.log('\n[TEST 4] CustomerApp integration of LegalFooter and CookieBanner');
const customerAppPath = path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx');
const customerAppSrc = fs.readFileSync(customerAppPath, 'utf8');

assert.ok(customerAppSrc.includes('LegalFooter'), 'CustomerApp must import and render LegalFooter');
assert.ok(customerAppSrc.includes('CookieBanner'), 'CustomerApp must import and render CookieBanner');
assert.ok(customerAppSrc.includes('LegalModal'), 'CustomerApp must manage LegalModal state');
console.log('✔ CustomerApp properly embeds LegalFooter, CookieBanner and LegalModal');

// 5. Verify clickable privacy links in intake components
console.log('\n[TEST 5] Clickable privacy modal triggers in intake forms');
const offerDetailsPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyOfferDetails.tsx');
const offerDetailsSrc = fs.readFileSync(offerDetailsPath, 'utf8');
assert.ok(
  offerDetailsSrc.includes('onOpenPrivacy') || offerDetailsSrc.includes('onOpenLegal') || offerDetailsSrc.includes('underline'),
  'EnergyOfferDetails must render accessible interactive link to privacy policy'
);

const intakePath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyBillIntake.tsx');
const intakeSrc = fs.readFileSync(intakePath, 'utf8');
assert.ok(
  intakeSrc.includes('onOpenPrivacy') || intakeSrc.includes('onOpenLegal') || intakeSrc.includes('underline'),
  'EnergyBillIntake guest modal must render interactive link to privacy policy'
);
console.log('✔ Interactive privacy triggers verified in intake workflows');

console.log('\n🎉 ALL LEGAL COMPLIANCE TESTS PASSED!');

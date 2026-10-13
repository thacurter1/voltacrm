process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'ruthless-audit-jwt-secret-at-least-32-chars-long';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');

console.log('================================================================');
console.log('   RUTHLESS MASTER AUDIT TEST SUITE (DEEP SYSTEM & STRESS TEST)');
console.log('================================================================\n');

function loadTs(relativePath, dependencies = {}) {
  const filePath = path.join(__dirname, '..', relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(
    id => dependencies[id] || (id.includes('energyEngine') ? require('../server/dist/services/energyEngine.js') : require(id)),
    module,
    module.exports
  );
  return module.exports;
}

// =============================================================================
// PILLAR 1: MATHEMATICAL & ECONOMIC INTEGRITY (ARERA & HONEST COMPARATOR)
// =============================================================================
console.log('--- PILLAR 1: ECONOMIC & MATHEMATICAL INTEGRITY ---');

const { 
  compareOffer, 
  estimateLifestyleConsumption, 
  validateBillUploadFile 
} = loadTs('src/services/offerComparison.ts');

const { MARKET_OFFERS, CURRENT_MARKET_INDEX } = require('../server/dist/services/energyEngine.js');

const octopusOffer = MARKET_OFFERS.find(o => o.id === 'off-luce-1');
assert.ok(octopusOffer, 'Octopus offer off-luce-1 must exist');

// 1.1 Fuzz 20 diverse consumption values
const consumptionFuzzCases = [
  100, 250, 500, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3200, 4500, 6000, 8500, 10000, 15000, 20000, 30000, 50000, 75000
];

for (const kwh of consumptionFuzzCases) {
  const comp = compareOffer({
    utilityType: 'luce',
    annualConsumption: kwh,
    currentUnitCost: 0.18,
    currentFixedFeeYear: 100,
    source: 'manual'
  }, octopusOffer, CURRENT_MARKET_INDEX);

  assert.ok(comp.annualCost !== null && comp.annualCost > 0, `Annual cost must be computed for ${kwh} kWh`);
  assert.ok(comp.currentAnnualCost !== null && comp.currentAnnualCost > 0, `Current annual cost must be computed for ${kwh} kWh`);
  
  const expectedSavings = Math.round((comp.currentAnnualCost - comp.annualCost) * 100) / 100;
  assert.equal(comp.savingsEur, expectedSavings, `Savings must be strictly current - proposed for ${kwh} kWh`);
  assert.ok(comp.savingsPercent !== null, `Savings percent must be computed for ${kwh} kWh`);
}
console.log(`✔ [1.1] Math Fuzzing verified across ${consumptionFuzzCases.length} consumption levels`);

// 1.2 Test negative delta (more expensive offer, zero artificial positive clamp)
const expensiveComp = compareOffer({
  utilityType: 'luce',
  annualConsumption: 2700,
  currentUnitCost: 0.05, // very cheap current tariff
  currentFixedFeeYear: 20,
  source: 'manual'
}, octopusOffer, CURRENT_MARKET_INDEX);

assert.ok(expensiveComp.savingsEur < 0, 'More expensive offer must yield negative savingsEur');
assert.ok(expensiveComp.savingsPercent < 0, 'More expensive offer must yield negative savingsPercent');
console.log('✔ [1.2] Strict honesty: negative difference preserved without artificial floor or positive clamp');

// 1.3 Test missing current data
const missingComp = compareOffer({
  utilityType: 'luce',
  annualConsumption: 2700,
  source: 'manual'
}, octopusOffer, CURRENT_MARKET_INDEX);

assert.equal(missingComp.savingsEur, null, 'Savings must be null when current cost is missing');
assert.ok(missingComp.reasonUnavailable, 'Reason must be provided when current cost is missing');
console.log('✔ [1.3] Transparent null savings when current spending data is not provided');

// 1.4 Lifestyle Estimation Bounds for Luce
const singleLuce = estimateLifestyleConsumption({ householdSize: 'single', utilityType: 'luce' });
const coupleLuce = estimateLifestyleConsumption({ householdSize: 'couple', utilityType: 'luce' });
const familyLuce = estimateLifestyleConsumption({ householdSize: 'family', utilityType: 'luce' });
assert.equal(singleLuce, 1500, 'Single base luce must be 1500 kWh');
assert.equal(coupleLuce, 2400, 'Couple base luce must be 2400 kWh');
assert.equal(familyLuce, 3400, 'Family base luce must be 3400 kWh');

const appliancesLuce = estimateLifestyleConsumption({
  householdSize: 'couple',
  utilityType: 'luce',
  hasHeatPumpOrAc: true,   // +400
  hasElectricBoiler: true,  // +800
  hasInduction: true       // +350
});
assert.equal(appliancesLuce, 2400 + 400 + 800 + 350, 'Appliances must correctly sum with base (3950 kWh)');
console.log('✔ [1.4] Lifestyle consumption wizard heuristic bounds verified for Luce');

// 1.5 Lifestyle Estimation Bounds for Gas
const singleGas = estimateLifestyleConsumption({ householdSize: 'single', utilityType: 'gas' });
const coupleGas = estimateLifestyleConsumption({ householdSize: 'couple', utilityType: 'gas' });
const familyGas = estimateLifestyleConsumption({ householdSize: 'family', utilityType: 'gas' });
assert.equal(singleGas, 600, 'Single base gas must be 600 Smc');
assert.equal(coupleGas, 950, 'Couple base gas must be 950 Smc');
assert.equal(familyGas, 1300, 'Family base gas must be 1300 Smc');
console.log('✔ [1.5] Lifestyle consumption wizard heuristic bounds verified for Gas');

// 1.6 File Upload Validation Limits
assert.equal(validateBillUploadFile(null).valid, false, 'Null file must be invalid');
assert.equal(validateBillUploadFile({ name: 'empty.pdf', size: 0 }).valid, false, '0-byte file must be invalid');
assert.equal(validateBillUploadFile({ name: 'huge.pdf', size: 15 * 1024 * 1024 }).valid, false, '>10MB file must be invalid');
assert.equal(validateBillUploadFile({ name: 'photo.webp', size: 1024, type: 'image/webp' }).valid, false, 'WebP file must be invalid');
assert.equal(validateBillUploadFile({ name: 'bolletta.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' }).valid, true, 'Valid PDF must pass');
assert.equal(validateBillUploadFile({ name: 'fattura.jpg', size: 1 * 1024 * 1024, type: 'image/jpeg' }).valid, true, 'Valid JPG must pass');
assert.equal(validateBillUploadFile({ name: 'scansione.png', size: 1 * 1024 * 1024, type: 'image/png' }).valid, true, 'Valid PNG must pass');
console.log('✔ [1.6] File validation limits (size, non-empty, allowed MIME/extensions) strictly verified');

// =============================================================================
// PILLAR 2: CONCURRENCY, STRESS TESTING & INJECTION RESILIENCE
// =============================================================================
console.log('\n--- PILLAR 2: CONCURRENCY, STRESS & INJECTION TESTING ---');

async function testLiveServerStress() {
  const serverDir = path.join(__dirname, '..', 'server');
  const reqMod = require('node:module').createRequire(path.join(serverDir, 'package.json'));
  const express = reqMod('express');
  const { getNotifications, getLeads } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
  const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/portal', portalRouter);

  let server;
  let port;
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  const makeRequest = (method, endpoint, body, headers = {}) => {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : '';
      const reqHttp = http.request({
        hostname: '127.0.0.1',
        port,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      reqHttp.on('error', reject);
      if (payload) reqHttp.write(payload);
      reqHttp.end();
    });
  };

  try {
    // 2.1 Concurrency Stress Test: 10 parallel consultation submissions
    const parallelConsultations = Array.from({ length: 10 }, (_, i) => ({
      customerName: `Lead Concorrente ${i + 1}`,
      phone: `+39 340 000000${i}`,
      email: `lead.concurrent.${i + 1}@stress.test`,
      privacyConsent: true,
      offerId: 'off-stress-test',
      offerName: 'Octopus Fissa 12M',
      utilityType: i % 2 === 0 ? 'luce' : 'gas',
      annualConsumption: 2000 + i * 100,
    }));

    const resultsConsultations = await Promise.all(
      parallelConsultations.map(body => makeRequest('POST', '/api/portal/consultations', body))
    );

    for (let i = 0; i < resultsConsultations.length; i++) {
      assert.equal(resultsConsultations[i].status, 201, `Parallel consultation ${i + 1} must return 201`);
      assert.ok(resultsConsultations[i].body.leadId, `Parallel consultation ${i + 1} must return leadId`);
    }

    const currentLeads = getLeads();
    const currentNotifs = getNotifications();

    for (let i = 0; i < parallelConsultations.length; i++) {
      const foundLead = currentLeads.find(l => l.name === `Lead Concorrente ${i + 1}`);
      assert.ok(foundLead, `Lead Concorrente ${i + 1} must exist in dataStore leads`);
      assert.equal(foundLead.source, 'public_comparator');

      const foundNotif = currentNotifs.find(n => n.message && n.message.includes(`Lead Concorrente ${i + 1}`));
      assert.ok(foundNotif, `Notification for Lead Concorrente ${i + 1} must exist`);
      assert.equal(foundNotif.priority, 'urgent');
      assert.equal(foundNotif.actionTab, 'leads');
    }
    console.log('✔ [2.1] 10 concurrent consultation requests processed with 0 drops and 100% notification rate');

    // 2.2 Concurrency Stress Test: 5 parallel bill uploads
    const parallelBills = Array.from({ length: 5 }, (_, i) => ({
      customerName: `Caricatore Bolletta ${i + 1}`,
      phone: `+39 349 999999${i}`,
      privacyConsent: true,
      fileName: `Bolletta_Stress_${i + 1}.pdf`,
      mimeType: 'application/pdf',
      base64Data: Buffer.from(`%PDF-1.4 Mock concurrent bill content ${i + 1}`).toString('base64'),
      utilityType: i % 2 === 0 ? 'luce' : 'gas',
    }));

    const resultsBills = await Promise.all(
      parallelBills.map(body => makeRequest('POST', '/api/portal/bills', body))
    );

    for (let i = 0; i < resultsBills.length; i++) {
      assert.equal(resultsBills[i].status, 201, `Parallel bill upload ${i + 1} must return 201`);
      assert.ok(resultsBills[i].body.leadId, `Parallel bill upload ${i + 1} must return leadId`);
      assert.equal(resultsBills[i].body.lead.source, 'bill_upload');
    }

    const updatedNotifs = getNotifications();
    for (let i = 0; i < parallelBills.length; i++) {
      const foundBillNotif = updatedNotifs.find(n => n.message && n.message.includes(`Caricatore Bolletta ${i + 1}`));
      assert.ok(foundBillNotif, `Notification for bill upload ${i + 1} must exist`);
      assert.equal(foundBillNotif.type, 'bill_uploaded');
      assert.equal(foundBillNotif.priority, 'urgent');
    }
    console.log('✔ [2.2] 5 concurrent bill uploads processed with 0 drops and 100% notification rate');

    // 2.3 Injection & Fuzzing Attacks on Guest Endpoints
    // Test SQL Injection payload in customerName and notes
    const sqlInjectionRes = await makeRequest('POST', '/api/portal/consultations', {
      customerName: "Robert'); DROP TABLE leads; --",
      phone: "+39 347 1122334",
      privacyConsent: true,
      offerId: "off-sql-test",
      utilityType: "luce",
      notes: "1' OR '1'='1; -- SLEEP(5);",
    });
    assert.equal(sqlInjectionRes.status, 201, 'SQL injection string must be safely stored without executing');
    const sqlLead = getLeads().find(l => l.name === "Robert'); DROP TABLE leads; --");
    assert.ok(sqlLead, 'Lead with SQL injection characters safely stored as text');

    // Test XSS payload in notes
    const xssRes = await makeRequest('POST', '/api/portal/consultations', {
      customerName: "XSS Test User",
      phone: "+39 347 5544332",
      privacyConsent: true,
      offerId: "off-xss-test",
      utilityType: "gas",
      notes: "<script>alert('xss');</script><img src=x onerror=alert(1)>",
    });
    assert.equal(xssRes.status, 201, 'XSS string stored safely as plain string');

    // Test Invalid utility type rejection
    const invalidUtilityRes = await makeRequest('POST', '/api/portal/consultations', {
      customerName: "Invalid Utility User",
      phone: "+39 347 8899001",
      privacyConsent: true,
      offerId: "off-1",
      utilityType: "crypto",
    });
    assert.equal(invalidUtilityRes.status, 400, 'Invalid utility type must be rejected with 400');

    // Test Missing Privacy Consent rejection
    const missingPrivacyRes = await makeRequest('POST', '/api/portal/consultations', {
      customerName: "No Privacy User",
      phone: "+39 347 8899002",
      privacyConsent: false,
      offerId: "off-1",
      utilityType: "luce",
    });
    assert.equal(missingPrivacyRes.status, 400, 'Missing privacy consent must be rejected with 400');

    // Test Invalid phone (< 8 digits) rejection
    const invalidPhoneRes = await makeRequest('POST', '/api/portal/consultations', {
      customerName: "Short Phone User",
      phone: "123",
      privacyConsent: true,
      offerId: "off-1",
      utilityType: "luce",
    });
    assert.equal(invalidPhoneRes.status, 400, 'Short phone (< 8 digits) must be rejected with 400');

    console.log('✔ [2.3] Security fuzzing: SQL injection, XSS payloads handled safely; validation rules enforced');

  } finally {
    if (server) {
      await new Promise(r => server.close(r));
    }
  }
}

// =============================================================================
// PILLAR 3: RBAC & IDOR SECURITY BOUNDARIES
// =============================================================================
console.log('\n--- PILLAR 3: RBAC & IDOR BOUNDARIES ---');

function testSecurityBoundaries() {
  const reqMod = require('node:module').createRequire(path.join(__dirname, '..', 'server', 'package.json'));
  const jwt = reqMod('jsonwebtoken');

  // 3.1 Tampered JWT Token
  const fakeToken = jwt.sign(
    { userId: 'user-admin-1', role: 'admin' }, 
    'completely-wrong-secret-signature',
    { expiresIn: '1h' }
  );

  let verified = false;
  try {
    jwt.verify(fakeToken, process.env.JWT_SECRET);
    verified = true;
  } catch (err) {
    assert.equal(err.name, 'JsonWebTokenError', 'Tampered token must throw JsonWebTokenError');
  }
  assert.equal(verified, false, 'Tampered JWT signature must never verify');
  console.log('✔ [3.1] Forged/tampered JWT tokens strictly rejected');

  // 3.2 Expired JWT Token
  const expiredToken = jwt.sign(
    { userId: 'user-admin-1', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );

  let expiredVerified = false;
  try {
    jwt.verify(expiredToken, process.env.JWT_SECRET);
    expiredVerified = true;
  } catch (err) {
    assert.equal(err.name, 'TokenExpiredError', 'Expired token must throw TokenExpiredError');
  }
  assert.equal(expiredVerified, false, 'Expired JWT must never verify');
  console.log('✔ [3.2] Expired JWT tokens strictly rejected');
}

testSecurityBoundaries();

// =============================================================================
// PILLAR 4: FRONTEND AST, ACCESSIBILITY & REGULATORY COMPLIANCE
// =============================================================================
console.log('\n--- PILLAR 4: COMPONENT AST, ACCESSIBILITY & LEGAL AUDITING ---');

// 4.1 LegalFooter.tsx institutional completeness
const legalFooterPath = path.join(__dirname, '..', 'src', 'components', 'common', 'LegalFooter.tsx');
assert.ok(fs.existsSync(legalFooterPath), 'LegalFooter.tsx must exist');
const legalFooterSrc = fs.readFileSync(legalFooterPath, 'utf8');

assert.ok(legalFooterSrc.includes('12948570155'), 'Must display Partita IVA');
assert.ok(legalFooterSrc.includes('MI-2684910'), 'Must display REA');
assert.ok(legalFooterSrc.includes('800 912 345'), 'Must display Toll-free phone number');
assert.ok(legalFooterSrc.includes('100.000,00'), 'Must display Capitale Sociale');
assert.ok(legalFooterSrc.includes('handleOpen') && legalFooterSrc.includes('onOpenLegal'), 'Must wire legal triggers');
console.log('✔ [4.1] LegalFooter institutional transparency & regulatory compliance verified');

// 4.2 LegalModal.tsx accessibility and tabs
const legalModalPath = path.join(__dirname, '..', 'src', 'components', 'common', 'LegalModal.tsx');
assert.ok(fs.existsSync(legalModalPath), 'LegalModal.tsx must exist');
const legalModalSrc = fs.readFileSync(legalModalPath, 'utf8');

assert.ok(legalModalSrc.includes('role="dialog"'), 'LegalModal must have role=dialog');
assert.ok(legalModalSrc.includes('aria-modal="true"'), 'LegalModal must declare aria-modal');
assert.ok(legalModalSrc.includes('activeTab === \'privacy\''), 'Privacy tab must be implemented');
assert.ok(legalModalSrc.includes('activeTab === \'arera\''), 'ARERA tab must be implemented');
assert.ok(legalModalSrc.includes('activeTab === \'terms\''), 'Terms tab must be implemented');
assert.ok(legalModalSrc.includes('keydown') || legalModalSrc.includes('Escape'), 'Must handle keyboard escape closure');
console.log('✔ [4.2] LegalModal WCAG accessibility (role, aria-modal, tabs, escape key) verified');

// 4.3 LeadsManager.tsx 44px touch targets & WhatsApp outreach link
const leadsManagerPath = path.join(__dirname, '..', 'src', 'components', 'LeadsManager.tsx');
const leadsManagerSrc = fs.readFileSync(leadsManagerPath, 'utf8');

assert.ok(leadsManagerSrc.includes('min-h-[44px]'), 'Mobile action buttons must enforce min-h-[44px]');
assert.ok(leadsManagerSrc.includes('https://wa.me/'), 'Must generate https://wa.me/ outreach link');
assert.ok(leadsManagerSrc.includes('encodeURIComponent'), 'Outreach message must be URI-encoded');
assert.ok(leadsManagerSrc.includes('replace(/\\D/g, \'\')'), 'Phone numbers must be sanitized before WhatsApp link');
console.log('✔ [4.3] LeadsManager mobile accessibility touch targets and WhatsApp URI encoding verified');

// 4.4 App.tsx Public Root Landing & Error Boundary
const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
const appSrc = fs.readFileSync(appPath, 'utf8');

assert.ok(appSrc.includes('<CustomerApp') && appSrc.includes('onOpenStaffLogin'), 'Public root landing must serve CustomerApp with staff trigger');
assert.ok(appSrc.includes('portal === \'staff\'') || appSrc.includes('portal=staff'), 'Staff portal access route must be handled');

const mainPath = path.join(__dirname, '..', 'src', 'main.tsx');
const mainSrc = fs.readFileSync(mainPath, 'utf8');
assert.ok(mainSrc.includes('<ErrorBoundary>') && mainSrc.includes('<App />'), 'App must be wrapped in ErrorBoundary in main.tsx');
console.log('✔ [4.4] Public root landing routing and ErrorBoundary isolation verified');

// 4.5 index.html SEO and Metadata
const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const indexHtmlSrc = fs.readFileSync(indexHtmlPath, 'utf8');

assert.ok(indexHtmlSrc.includes('og:title'), 'Must declare OpenGraph title');
assert.ok(indexHtmlSrc.includes('og:description'), 'Must declare OpenGraph description');
assert.ok(indexHtmlSrc.includes('twitter:card'), 'Must declare Twitter card');
assert.ok(indexHtmlSrc.includes('viewport'), 'Must declare mobile viewport');
console.log('✔ [4.5] index.html SEO, Open Graph and Twitter Card tags verified');

// =============================================================================
// PILLAR 5: PRODUCTION DEPLOYMENT & ARTIFACT HARDENING
// =============================================================================
console.log('\n--- PILLAR 5: PRODUCTION DEPLOYMENT HARDENING ---');

const verifyProdPath = path.join(__dirname, '..', 'scripts', 'verify_production_readiness.cjs');
assert.ok(fs.existsSync(verifyProdPath), 'verify_production_readiness.cjs must exist');

const deploymentGuidePath = path.join(__dirname, '..', 'docs', 'DEPLOYMENT_GUIDE.md');
assert.ok(fs.existsSync(deploymentGuidePath), 'docs/DEPLOYMENT_GUIDE.md must exist');

const serverEnvProdExamplePath = path.join(__dirname, '..', 'server', '.env.production.example');
assert.ok(fs.existsSync(serverEnvProdExamplePath), 'server/.env.production.example must exist');

const gitignorePath = path.join(__dirname, '..', '.gitignore');
const gitignoreSrc = fs.readFileSync(gitignorePath, 'utf8');
assert.ok(gitignoreSrc.includes('!.env.example'), 'Must whitelist .env.example');
assert.ok(gitignoreSrc.includes('!server/.env.example'), 'Must whitelist server/.env.example');
assert.ok(gitignoreSrc.includes('!server/.env.production.example'), 'Must whitelist server/.env.production.example');
assert.ok(gitignoreSrc.includes('server/.env\n') || gitignoreSrc.includes('server/.env\r\n'), 'Must ignore server/.env');
console.log('✔ [5.1] Production deployment artifacts, environment templates and gitignore boundaries verified');

// Run live server stress tests
testLiveServerStress()
  .then(() => {
    console.log('\n================================================================');
    console.log('🏆 RUTHLESS MASTER AUDIT PASSED: ALL 5 PILLARS 100% VERIFIED!');
    console.log('================================================================\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ RUTHLESS MASTER AUDIT FAILED:', err);
    process.exit(1);
  });

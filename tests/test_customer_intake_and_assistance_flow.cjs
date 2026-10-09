process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'consultation-test-jwt-secret-at-least-32-chars-long';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: CUSTOMER INTAKE & REAL ASSISTANCE FLOW (TDD) ===');

// -----------------------------------------------------------------------------
// 1. Static & Data Model Checks: Honesty of Indexes and Catalog
// -----------------------------------------------------------------------------
const serverEnginePath = path.join(__dirname, '..', 'server', 'src', 'services', 'energyEngine.ts');
const serverEngineSrc = fs.readFileSync(serverEnginePath, 'utf8');

const clientEnginePath = path.join(__dirname, '..', 'src', 'services', 'energyEngine.ts');
const clientEngineSrc = fs.readFileSync(clientEnginePath, 'utf8');

console.log('\n[TEST 1] Honesty check: No fake dynamic "today" date or misleading "Miglior Prezzo" tags');

// RED CHECK 1.1: Server CURRENT_MARKET_INDEX must NOT use new Date() to fake a live daily index
assert.strictEqual(
  serverEngineSrc.includes("lastUpdated: new Date().toISOString()"),
  false,
  'Server CURRENT_MARKET_INDEX must NOT fake live date via new Date().toISOString()'
);

// RED CHECK 1.2: Client CURRENT_MARKET_INDEX must NOT claim "Oggi" when hardcoded
assert.strictEqual(
  clientEngineSrc.includes("lastUpdated: 'Oggi (GME / Mercato Elettrico Italiano)'"),
  false,
  'Client CURRENT_MARKET_INDEX must NOT claim "Oggi" for hardcoded sample fixtures'
);

// RED CHECK 1.3: Tag "Miglior Prezzo" must NOT be hardcoded without dynamic calculation
assert.strictEqual(
  serverEngineSrc.includes("tag: 'Miglior Prezzo'"),
  false,
  'Server catalog must not hardcode categorical "Miglior Prezzo" claim'
);
assert.strictEqual(
  clientEngineSrc.includes("tag: 'Miglior Prezzo'"),
  false,
  'Client catalog must not hardcode categorical "Miglior Prezzo" claim'
);

// -----------------------------------------------------------------------------
// 2. Server API Route: POST /api/portal/consultations
// -----------------------------------------------------------------------------
console.log('\n[TEST 2] Server API: Real Consultation Request Endpoint in Portal Router');

const portalRoutePath = path.join(__dirname, '..', 'server', 'src', 'routes', 'portal.ts');
const portalRouteSrc = fs.readFileSync(portalRoutePath, 'utf8');

// RED CHECK 2.1: portalRouter must expose POST /consultations
assert.ok(
  portalRouteSrc.includes("portalRouter.post('/consultations'") || portalRouteSrc.includes('portalRouter.post("/consultations"'),
  'portalRouter must implement POST /consultations for genuine assistance requests'
);

// -----------------------------------------------------------------------------
// 3. API Client: portalApi.requestConsultation
// -----------------------------------------------------------------------------
console.log('\n[TEST 3] Frontend API Client: portalApi.requestConsultation with demo fallback');

const portalClientPath = path.join(__dirname, '..', 'src', 'api', 'portal.ts');
const portalClientSrc = fs.readFileSync(portalClientPath, 'utf8');

// RED CHECK 3.1: portalApi must declare requestConsultation
assert.ok(
  portalClientSrc.includes('requestConsultation(') || portalClientSrc.includes('requestConsultation:'),
  'portalApi must declare requestConsultation'
);

// -----------------------------------------------------------------------------
// 4. CustomerApp: Facile.it intake-first flow and genuine consultation handling
// -----------------------------------------------------------------------------
console.log('\n[TEST 4] CustomerApp UX: Stepper intake precedes offer results & handles real consultation');

const customerAppPath = path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx');
const customerAppSrc = fs.readFileSync(customerAppPath, 'utf8');

// RED CHECK 4.1: CustomerApp must NOT default annualConsumption blindly to 2700 / 1000 without user confirmation
assert.strictEqual(
  customerAppSrc.includes("annualConsumption: defaultPoint?.annualConsumption || (defaultPoint?.type === 'gas' ? 1000 : 2700)"),
  false,
  'CustomerApp must not inject 2700 kWh / 1000 Smc default as if it were personal customer data before intake'
);

// RED CHECK 4.2: CustomerApp handleRequestConsultation must call portalApi.requestConsultation, not just addToast
assert.ok(
  customerAppSrc.includes('portalApi.requestConsultation') || customerAppSrc.includes('api.portal.requestConsultation'),
  'CustomerApp handleRequestConsultation must invoke portalApi.requestConsultation to persist request'
);

// RED CHECK 4.3: CustomerApp main container must have generous bottom padding for mobile (pb-28 or pb-32)
assert.ok(
  customerAppSrc.includes('pb-28') || customerAppSrc.includes('pb-32'),
  'CustomerApp main container must have pb-28 or pb-32 to prevent DemoRoleSwitcher overlap on mobile'
);

// -----------------------------------------------------------------------------
// 5. Mobile Polish: DemoRoleSwitcher starts minimized on mobile screens
// -----------------------------------------------------------------------------
console.log('\n[TEST 5] DemoRoleSwitcher: Responsiveness on mobile');

const switcherPath = path.join(__dirname, '..', 'src', 'components', 'DemoRoleSwitcher.tsx');
const switcherSrc = fs.readFileSync(switcherPath, 'utf8');

// RED CHECK 5.1: DemoRoleSwitcher must initialize isMinimized checking mobile width
assert.ok(
  switcherSrc.includes('window.innerWidth <') || switcherSrc.includes('window.matchMedia'),
  'DemoRoleSwitcher must check mobile viewport to start minimized on small screens'
);

// -----------------------------------------------------------------------------
// 6. Live Server Functional Test: POST /api/portal/consultations
// -----------------------------------------------------------------------------
const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users, getLeads } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));

async function runLiveServerTests() {
  console.log('\n[TEST 6] Live Express Server: POST /api/portal/consultations persistence and security');
  const app = express();
  app.use(express.json());
  app.use('/api/portal', portalRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/portal`;

  try {
    // 6.1: Reject unauthenticated
    const unauthRes = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: 'off-luce-1', utilityType: 'luce' })
    });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');

    // 6.2: Customer user token
    const customerUser = users.find(u => u.role === 'customer' && u.customerId === 'cust-1');
    assert.ok(customerUser, 'Customer user for cust-1 must exist');
    const customerToken = generateToken({ userId: customerUser.id, email: customerUser.email, role: 'customer' });

    // 6.3: Valid consultation submission
    const initialLeadsCount = getLeads().length;
    const validRes = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customerId: 'cust-1',
        offerId: 'off-luce-1',
        offerName: 'Octopus Fissa 12M',
        supplier: 'Octopus Energy',
        utilityType: 'luce',
        annualConsumption: 2700,
        notes: 'Chiedo chiarimenti su durata e quota fissa',
        preferredContact: 'phone'
      })
    });
    assert.strictEqual(validRes.status, 201, 'Valid consultation request must return 201');
    const validJson = await validRes.json();
    assert.strictEqual(validJson.success, true);
    assert.ok(validJson.leadId, 'Response must return created leadId');

    const updatedLeads = getLeads();
    assert.strictEqual(updatedLeads.length, initialLeadsCount + 1, 'Lead count in dataStore must increment by 1');
    const registeredLead = updatedLeads.find(l => l.id === validJson.leadId);
    assert.ok(registeredLead, 'Registered lead must exist in dataStore');
    assert.strictEqual(registeredLead.name, customerUser.name);
    assert.ok(registeredLead.notes.includes('Octopus Fissa 12M'));
    assert.ok(registeredLead.notes.includes('2700 kWh/anno'));

    // 6.4: IDOR check - customer cannot request for cust-2
    const idorRes = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        customerId: 'cust-2',
        offerId: 'off-luce-1',
        utilityType: 'luce'
      })
    });
    assert.strictEqual(idorRes.status, 403, 'Customer requesting for a different customerId must return 403');

    console.log('✅ Live consultation route verified: 201 created, persistence validated, IDOR protected.');
  } finally {
    server.close();
  }
}

runLiveServerTests().then(() => {
  console.log('\n🎉 ALL CUSTOMER INTAKE AND ASSISTANCE FLOW TESTS PASSED SUCCESSFULLY!');
}).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

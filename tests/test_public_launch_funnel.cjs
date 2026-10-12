process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'public-launch-funnel-jwt-secret-at-least-32-chars';

const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: PUBLIC LAUNCH FUNNEL & GUEST LEAD INTAKE (TDD) ===');

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users, getLeads } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/portal', portalRouter);

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/portal`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated POST /api/portal/consultations with valid guest payload
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Unauthenticated guest consultation submission (201 Created)');
    const initialLeadsCount = getLeads().length;

    const guestPayload = {
      customerName: 'Giulia Bianchi',
      phone: '+39 349 9876543',
      email: 'giulia.bianchi@test.it',
      privacyConsent: true,
      offerId: 'off-luce-1',
      offerName: 'Octopus Fissa 12M',
      supplier: 'Octopus Energy',
      utilityType: 'luce',
      annualConsumption: 2400,
      notes: 'Richiesta informazioni tariffa monoraria'
    };

    const res1 = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guestPayload)
    });

    assert.strictEqual(
      res1.status,
      201,
      `Expected status 201 for valid guest consultation, got ${res1.status}`
    );

    const json1 = await res1.json();
    assert.strictEqual(json1.success, true);
    assert.ok(json1.leadId, 'Response must include leadId');
    assert.ok(json1.lead, 'Response must include created lead object');
    assert.strictEqual(json1.lead.name, 'Giulia Bianchi');
    assert.strictEqual(json1.lead.source, 'public_comparator');
    assert.strictEqual(json1.lead.estimatedConsumptionKwh, 2400);

    const updatedLeads = getLeads();
    assert.strictEqual(
      updatedLeads.length,
      initialLeadsCount + 1,
      'Lead count in dataStore must increment by 1'
    );
    const persistedLead = updatedLeads.find((l) => l.id === json1.leadId);
    assert.ok(persistedLead, 'Lead must be found in dataStore');
    assert.strictEqual(persistedLead.name, 'Giulia Bianchi');
    assert.strictEqual(persistedLead.phone, '+39 349 9876543');
    assert.strictEqual(persistedLead.email, 'giulia.bianchi@test.it');
    assert.strictEqual(persistedLead.source, 'public_comparator');
    assert.strictEqual(persistedLead.status, 'new');
    assert.ok(persistedLead.notes.includes('Octopus Fissa 12M'));
    console.log('✅ Test 1 Passed: Guest consultation successfully created lead in CRM.');

    // -------------------------------------------------------------------------
    // TEST 2: Unauthenticated POST /api/portal/consultations without privacy consent
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Missing privacy consent rejected with 400 Bad Request');
    const res2 = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Marco Neri',
        phone: '+39 333 1122334',
        offerId: 'off-gas-1',
        utilityType: 'gas',
        privacyConsent: false
      })
    });

    assert.strictEqual(
      res2.status,
      400,
      `Expected status 400 when privacyConsent is false, got ${res2.status}`
    );
    const json2 = await res2.json();
    assert.strictEqual(json2.success, false);
    assert.strictEqual(
      json2.message,
      'Il consenso alla privacy è obbligatorio per richiedere una consulenza.'
    );
    console.log('✅ Test 2 Passed: Missing privacy consent correctly rejected.');

    // -------------------------------------------------------------------------
    // TEST 3: Unauthenticated POST /api/portal/consultations without phone
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Missing or invalid phone rejected with 400 Bad Request');
    const res3 = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Marco Neri',
        privacyConsent: true,
        offerId: 'off-gas-1',
        utilityType: 'gas'
      })
    });

    assert.strictEqual(
      res3.status,
      400,
      `Expected status 400 when phone is missing, got ${res3.status}`
    );
    const json3 = await res3.json();
    assert.strictEqual(json3.success, false);
    assert.strictEqual(
      json3.message,
      'Recapito telefonico obbligatorio per essere ricontattato.'
    );

    // Also verify missing customerName
    const res3b = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: '',
        phone: '+39 333 1122334',
        privacyConsent: true,
        offerId: 'off-gas-1',
        utilityType: 'gas'
      })
    });
    assert.strictEqual(res3b.status, 400);
    const json3b = await res3b.json();
    assert.strictEqual(json3b.message, 'Nome obbligatorio.');
    console.log('✅ Test 3 Passed: Missing phone and missing customerName correctly rejected.');

    // -------------------------------------------------------------------------
    // TEST 4: Authenticated request still links to customer profile (non-regression)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Authenticated consultation still links to registered customer');
    const customerUser = users.find((u) => u.role === 'customer' && u.customerId === 'cust-1');
    assert.ok(customerUser, 'Customer user for cust-1 must exist');
    const customerToken = generateToken({
      userId: customerUser.id,
      email: customerUser.email,
      role: 'customer'
    });

    const res4 = await fetch(`${baseUrl}/consultations`, {
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
        notes: 'Chiedo assistenza da area riservata'
      })
    });

    assert.strictEqual(res4.status, 201, `Expected status 201 for authenticated customer, got ${res4.status}`);
    const json4 = await res4.json();
    assert.strictEqual(json4.success, true);
    assert.ok(json4.leadId);

    const authLead = getLeads().find((l) => l.id === json4.leadId);
    assert.ok(authLead, 'Authenticated lead must be stored in dataStore');
    assert.strictEqual(authLead.name, customerUser.name);
    assert.strictEqual(authLead.source, 'landing_page');
    console.log('✅ Test 4 Passed: Authenticated customer consultation links to customer.');

    // -------------------------------------------------------------------------
    // TEST 5: Unauthenticated request without guest fields returns 401
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Unauthenticated request without guest contact info returns 401');
    const res5 = await fetch(`${baseUrl}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId: 'off-luce-1', utilityType: 'luce' })
    });
    assert.strictEqual(res5.status, 401, 'Unauthenticated request without guest details must return 401');
    console.log('✅ Test 5 Passed: Protected portal boundary preserved for non-guest requests.');

    console.log('\n🎉 ALL PUBLIC LAUNCH FUNNEL TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

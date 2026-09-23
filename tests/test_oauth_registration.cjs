const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

console.log('=== TEST SUITE: GOOGLE & APPLE OAUTH AUTHENTICATION (HARDENED) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'oauth-test-secret-at-least-32-characters-long';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');
const jwt = req('jsonwebtoken');

const { users, addCustomer, addLead } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { authRouter } = require(path.join(serverDir, 'dist', 'routes', 'auth.js'));
const { customersRouter } = require(path.join(serverDir, 'dist', 'routes', 'customers.js'));
const { leadsRouter } = require(path.join(serverDir, 'dist', 'routes', 'leads.js'));

function createSignedTestToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/leads', leadsRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // TEST 1: Google OAuth Customer Registration con token crittograficamente valido
    console.log('--- TEST 1: Google OAuth Customer Registration con token crittografico firmato ---');
    const validGoogleToken = createSignedTestToken({
      email: 'test.google.user@gmail.com',
      name: 'Mario Rossi (Google)',
      sub: 'google-sub-123456'
    });

    const googleRes = await fetch(`${baseUrl}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        idToken: validGoogleToken
      })
    });
    assert.equal(googleRes.status, 200, 'Google OAuth registration must return 200');
    const googleData = await googleRes.json();
    assert.equal(googleData.success, true);
    assert.ok(googleData.token, 'Must return a valid JWT token');
    assert.equal(googleData.user.email, 'test.google.user@gmail.com');
    assert.equal(googleData.user.role, 'customer', 'OAuth users must ALWAYS be created as customer');
    assert.ok(googleData.user.customerId, 'OAuth customer must have customerId');
    assert.equal(googleData.provider, 'google');
    console.log('✔ Google OAuth Customer Registrato con firma verificata:', googleData.user.name);

    // TEST 2: Existing Google OAuth User Login (Idempotent, no duplicate)
    console.log('--- TEST 2: Existing Google OAuth Login (Idempotency) ---');
    const initialUsersCount = users.filter(u => u.email === 'test.google.user@gmail.com').length;
    assert.equal(initialUsersCount, 1, 'Exactly 1 user with this email should exist');

    const repeatRes = await fetch(`${baseUrl}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        idToken: validGoogleToken
      })
    });
    assert.equal(repeatRes.status, 200);
    const repeatData = await repeatRes.json();
    assert.equal(repeatData.user.id, googleData.user.id, 'Must authenticate the same existing user');
    const afterUsersCount = users.filter(u => u.email === 'test.google.user@gmail.com').length;
    assert.equal(afterUsersCount, 1, 'No duplicate user should be created');
    console.log('✔ Idempotenza Google OAuth verificata con successo');

    // TEST 3: RIFIUTO CRITTOGRAFICO TOKEN CONTRAFFATTO (Firma falsa / token inventato)
    console.log('--- TEST 3: Rifiuto crittografico di token falsificato / non firmato ---');
    const fakeForgedToken = 'header.' + Buffer.from(JSON.stringify({
      email: 'hacker@victim.com',
      name: 'Forged Identity'
    })).toString('base64url') + '.fake_unverified_signature';

    const forgedRes = await fetch(`${baseUrl}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        idToken: fakeForgedToken
      })
    });
    assert.equal(forgedRes.status, 401, 'Forged token without valid cryptographic signature must return 401');
    const forgedData = await forgedRes.json();
    assert.equal(forgedData.success, false);
    console.log('✔ Token falsificato bloccato con 401 Unauthorized');

    // TEST 4: RIFIUTO LOGIN SENZA IDTOKEN (Tentativo di fornire solo email)
    console.log('--- TEST 4: Rifiuto credenziali solo-email senza idToken ---');
    const noTokenRes = await fetch(`${baseUrl}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        email: 'victim.admin@voltagroup.it'
      })
    });
    assert.equal(noTokenRes.status, 400, 'Requests without idToken must be rejected by Zod schema with 400');
    console.log('✔ Richiesta senza idToken respinta con 400 Bad Request');

    // TEST 5: RIFIUTO ELEZIONE RUOLI STAFF VIA OAUTH (Tentativo role: 'operator')
    console.log('--- TEST 5: Blocco auto-elezione ruoli staff via OAuth ---');
    const staffToken = createSignedTestToken({
      email: 'attempted.staff@voltagroup.it',
      name: 'Fake Operator'
    });
    const staffRes = await fetch(`${baseUrl}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'apple',
        role: 'operator',
        idToken: staffToken
      })
    });
    // Lo schema Zod rifiuta ruoli diversi da 'customer' con 400 Bad Request
    assert.equal(staffRes.status, 400, 'Staff role in OAuth registration must be rejected with 400');
    console.log('✔ Tentativo di elezione a ruolo staff bloccato dallo schema di validazione');

    // TEST 6: Apple OAuth Customer con token firmato
    console.log('--- TEST 6: Apple OAuth Customer con token firmato ---');
    const validAppleToken = createSignedTestToken({
      email: 'verified.apple.customer@icloud.com',
      name: 'Alessandro Apple User',
      sub: 'apple-sub-987654'
    });

    const appleRes = await fetch(`${baseUrl}/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'apple',
        idToken: validAppleToken
      })
    });
    assert.equal(appleRes.status, 200, 'Apple customer OAuth must return 200');
    const appleData = await appleRes.json();
    assert.equal(appleData.user.email, 'verified.apple.customer@icloud.com');
    assert.equal(appleData.user.role, 'customer');
    assert.ok(appleData.user.customerId, 'Apple customer must have customerId');
    console.log('✔ Apple OAuth Customer autenticato con successo:', appleData.user.email);

    // TEST 7: BLOCCO CALL CENTER SU AGGIUNTA PUNTI FORNITURA (POST /api/customers/:id/utility-point)
    console.log('--- TEST 7: Blocco Call Center su /api/customers/:id/utility-point ---');
    const callCenterUser = users.find(u => u.role === 'call_center');
    assert.ok(callCenterUser, 'Call center user must exist in dataStore');
    const ccAuthToken = jwt.sign(
      { userId: callCenterUser.id, email: callCenterUser.email, role: 'call_center' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Crea un cliente di prova
    const testCustId = `cust-test-${Date.now()}`;
    await addCustomer({
      id: testCustId,
      name: 'Cliente Test Utility',
      fiscalCode: 'TSTCLT80A01H501U',
      phone: '+39 340 1234567',
      email: 'test.utility@cliente.it',
      city: 'Milano',
      contractStartDate: '2026-01-01',
      lastSwitchAuditDate: '2026-01-01',
      nextSwitchAuditDate: '2026-05-01',
      hasBrokerageMandate: true,
      accountManager: 'Valentina Neri',
      assignedBrokerId: 'user-op-3',
      utilityPoints: []
    });

    const addPointRes = await fetch(`${baseUrl}/customers/${testCustId}/utility-point`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ccAuthToken}`
      },
      body: JSON.stringify({
        type: 'luce',
        podOrPdr: 'IT001E12345678',
        annualConsumption: 2700,
        currentSupplier: 'Enel Energia',
        currentOfferName: 'Open Luce',
        currentTariffType: 'fixed',
        currentUnitCost: 0.22
      })
    });
    assert.equal(addPointRes.status, 403, 'Call center must receive 403 Forbidden when adding utility points');
    console.log('✔ Call center correttamente bloccato (403 Forbidden) dall\'aggiunta punti fornitura');

    // TEST 8: SCOPING LEADS PER BROKER (GET /api/leads non deve mostrare lead di altri broker)
    console.log('--- TEST 8: Scoping dei Lead per Broker (GET /api/leads) ---');
    const brokerUser = users.find(u => u.role === 'broker' && u.id === 'user-op-3');
    assert.ok(brokerUser, 'Broker user-op-3 must exist');
    const brokerToken = jwt.sign(
      { userId: brokerUser.id, email: brokerUser.email, role: 'broker' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Aggiungiamo un lead assegnato a questo broker e uno assegnato ad un altro agente
    const leadBroker = {
      id: `lead-assigned-broker-${Date.now()}`,
      name: 'Lead Per Valentina Neri',
      phone: '+39 333 1112233',
      email: 'lead.broker@test.it',
      city: 'Roma',
      source: 'landing_page',
      status: 'new',
      notes: 'Lead assegnato al broker',
      createdAt: '2026-09-23',
      assignedBrokerId: 'user-op-3'
    };
    const leadUnassigned = {
      id: `lead-unassigned-${Date.now()}`,
      name: 'Lead Coda Generale',
      phone: '+39 333 4445566',
      email: 'lead.unassigned@test.it',
      city: 'Napoli',
      source: 'google_ads',
      status: 'call_center_queue',
      notes: 'Lead in coda call center non assegnato',
      createdAt: '2026-09-23'
    };
    await addLead(leadBroker);
    await addLead(leadUnassigned);

    const brokerLeadsRes = await fetch(`${baseUrl}/leads`, {
      headers: { 'Authorization': `Bearer ${brokerToken}` }
    });
    assert.equal(brokerLeadsRes.status, 200);
    const brokerLeadsData = await brokerLeadsRes.json();
    assert.equal(brokerLeadsData.success, true);

    const hasAssigned = brokerLeadsData.leads.some(l => l.id === leadBroker.id);
    const hasUnassigned = brokerLeadsData.leads.some(l => l.id === leadUnassigned.id);
    assert.ok(hasAssigned, 'Broker must see leads assigned to them');
    assert.ok(!hasUnassigned, 'Broker must NOT see leads that are not assigned to them');
    console.log('✔ Scoping lead per broker verificato: vede i propri lead e non quelli non assegnati');

    // TEST 9: Apple CSP and Apple ID SDK Integration
    console.log('--- TEST 9: Apple CSP and Apple ID SDK Integration ---');
    const appCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
    const portalGateCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'PortalGate.tsx'), 'utf8');
    const loginModalCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'LoginModal.tsx'), 'utf8');
    const oauthButtonsCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'OAuthButtons.tsx'), 'utf8');
    const indexHtmlCode = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

    assert.ok(appCode.includes('isMockOrMissing'), 'App.tsx must not overwrite valid JWT tokens');
    assert.ok(portalGateCode.includes('<OAuthButtons'), 'PortalGate must render OAuthButtons');
    assert.ok(loginModalCode.includes('<OAuthButtons'), 'LoginModal must render OAuthButtons');
    assert.ok(oauthButtonsCode.includes('Google') && oauthButtonsCode.includes('Apple'), 'OAuthButtons must support both Google and Apple');
    assert.ok(oauthButtonsCode.includes('activeModalProvider'), 'OAuthButtons must support interactive account selection modal');
    assert.ok(indexHtmlCode.includes('appleid.cdn-apple.com'), 'CSP must allow appleid.cdn-apple.com in script-src');
    assert.ok(indexHtmlCode.includes('appleid.apple.com'), 'CSP must allow appleid.apple.com in connect-src / frame-src');
    assert.ok(oauthButtonsCode.includes('AppleID') || oauthButtonsCode.includes('VITE_APPLE_CLIENT_ID'), 'OAuthButtons must support Apple ID SDK');
    console.log('✔ CSP Apple e Apple ID SDK verificati con successo');

    console.log('\n🎉 ALL HARDENED OAUTH, RBAC & LEADS SCOPING TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup inserted test users
    const idx1 = users.findIndex(u => u.email === 'test.google.user@gmail.com');
    if (idx1 !== -1) users.splice(idx1, 1);
    const idx2 = users.findIndex(u => u.email === 'verified.apple.customer@icloud.com');
    if (idx2 !== -1) users.splice(idx2, 1);

    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('❌ OAuth Test Failed:', err);
  process.exit(1);
});

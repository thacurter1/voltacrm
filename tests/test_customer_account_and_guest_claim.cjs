process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'test-portal-d-claim-export-secret-at-least-32-chars!!';

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');
const bcrypt = req('bcryptjs');

async function run() {
  console.log('=== TEST SUITE: GUEST CLAIM TOKEN, SUPPORT REQUESTS, EXPORT & CLOSURE (SECTION D) ===');

  const dataStore = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
  const signatureService = require(path.join(serverDir, 'dist', 'services', 'signatureService.js'));
  const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));
  const { generateToken, authenticateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/portal', portalRouter);
  app.get('/api/protected-check', authenticateToken, (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const guestEmail = `guestclaim.${Date.now()}@example.invalid`;
  const pdfBytes = Buffer.from('%PDF-1.4\n%Guest Claim Bill\n%%EOF\n').toString('base64');

  const cust1 = {
    id: 'cust-claim-1',
    name: 'Cliente Claim Uno',
    fiscalCode: 'RSSMRA80A01H501U',
    phone: '+39 340 5551111',
    email: guestEmail,
    city: 'Roma',
    utilityPoints: [],
    contractStartDate: '2026-11-17',
    lastSwitchAuditDate: '2026-11-17',
    nextSwitchAuditDate: '2027-03-17',
    accountManager: '',
    hasBrokerageMandate: false,
    notes: '',
  };
  const pass1 = 'ClosurePass2026!';
  const user1 = {
    id: 'user-claim-1',
    name: cust1.name,
    email: guestEmail,
    password: bcrypt.hashSync(pass1, 10),
    role: 'customer',
    customerId: cust1.id,
    onboardingStatus: 'active',
    emailVerified: true,
    tokenVersion: 1,
    privacyConsentAccepted: true,
    privacyConsentTimestamp: '2026-11-17T10:00:00.000Z',
    privacyPolicyVersion: 'bozza-2026-11',
    marketingConsent: false,
  };

  const cust2 = {
    ...cust1,
    id: 'cust-claim-2',
    name: 'Cliente Isolato Due',
    email: `other.${Date.now()}@example.invalid`,
  };
  const user2 = {
    id: 'user-claim-2',
    name: cust2.name,
    email: cust2.email,
    password: bcrypt.hashSync(pass1, 10),
    role: 'customer',
    customerId: cust2.id,
    onboardingStatus: 'active',
    emailVerified: true,
    tokenVersion: 1,
  };

  dataStore.getCustomers().push(cust1, cust2);
  dataStore.users.push(user1, user2);

  // Add contractual signature log for cust1 to verify closure preserves contractual docs
  const sigId = `sig-retention-${Date.now()}`;
  await dataStore.addSignatureLog({
    id: sigId,
    customerId: cust1.id,
    customerName: cust1.name,
    signerFiscalCode: cust1.fiscalCode,
    phone: cust1.phone,
    signatureType: 'otp',
    offerId: 'off-luce-1',
    supplier: 'Octopus Energy',
    timestamp: new Date().toISOString(),
    signatureHash: 'hash123',
    utilityPointId: 'u1',
    podOrPdr: 'IT001E00000001',
    energyType: 'luce',
    offerSnapshot: {},
    originalPointSnapshot: {},
    consentVersion: '1.0',
    canonicalDocument: {},
  });

  try {
    // 1. Guest uploads a bill providing same email/phone as cust1 -> must issue claimToken, NOT expose to cust1 automatically!
    const guestRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: cust1.name,
        phone: cust1.phone,
        email: guestEmail,
        privacyConsent: true,
        utilityType: 'luce',
        fileName: 'bolletta_guest.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfBytes,
      }),
    });
    assert.equal(guestRes.status, 201);
    const guestBody = await guestRes.json();
    assert.ok(guestBody.claimToken && guestBody.claimToken.length >= 24, 'Guest bill upload must return cryptographic claimToken');
    const guestBillId = guestBody.bill.id;

    const token1 = generateToken({ userId: user1.id, email: user1.email, role: 'customer', tokenVersion: user1.tokenVersion });
    const token2 = generateToken({ userId: user2.id, email: user2.email, role: 'customer', tokenVersion: user2.tokenVersion });

    // Without claiming, cust1 (even with matching email & phone!) MUST NOT see guest bill
    const preClaimList = await (await fetch(`${baseUrl}/api/portal/bills`, {
      headers: { Authorization: `Bearer ${token1}` },
    })).json();
    assert.ok(!preClaimList.bills.some((b) => b.id === guestBillId), 'Matching email/phone alone must NOT auto-attach guest bills');

    // Wrong claimToken fails
    const badClaim = await fetch(`${baseUrl}/api/portal/bills/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ claimToken: 'wrong-guessed-claim-token-value-123456' }),
    });
    assert.equal(badClaim.status, 404);

    // Valid claimToken by cust1 claims bill cleanly
    const validClaim = await fetch(`${baseUrl}/api/portal/bills/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ claimToken: guestBody.claimToken }),
    });
    assert.equal(validClaim.status, 200, `Valid claimToken must associate guest bill, got ${validClaim.status}`);

    // Single-use: Customer 2 replaying same claimToken must fail!
    const replayClaim = await fetch(`${baseUrl}/api/portal/bills/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ claimToken: guestBody.claimToken }),
    });
    assert.equal(replayClaim.status, 404, 'Reused claimToken by another customer must fail');

    // Customer 1 sees claimed bill, Customer 2 does not
    const postClaimList1 = await (await fetch(`${baseUrl}/api/portal/bills`, { headers: { Authorization: `Bearer ${token1}` } })).json();
    assert.ok(postClaimList1.bills.some((b) => b.id === guestBillId), 'Customer 1 must see claimed bill');
    const postClaimList2 = await (await fetch(`${baseUrl}/api/portal/bills`, { headers: { Authorization: `Bearer ${token2}` } })).json();
    assert.ok(!postClaimList2.bills.some((b) => b.id === guestBillId), 'Customer 2 must never see Customer 1 claimed bill');

    // 2. Support requests (create & list isolated per customer)
    const suppRes = await fetch(`${baseUrl}/api/portal/support-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ subject: 'Chiarimento POD', message: 'Vorrei verificare il cambio potenza sul mio POD.' }),
    });
    assert.equal(suppRes.status, 201);
    const suppList1 = await (await fetch(`${baseUrl}/api/portal/support-requests`, { headers: { Authorization: `Bearer ${token1}` } })).json();
    const suppList2 = await (await fetch(`${baseUrl}/api/portal/support-requests`, { headers: { Authorization: `Bearer ${token2}` } })).json();
    assert.equal(suppList1.requests.length, 1);
    assert.equal(suppList2.requests.length, 0, 'Support requests must be strictly isolated per customer');

    // 3. GDPR Account Data Export
    const exportRes = await fetch(`${baseUrl}/api/portal/account/export`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(exportRes.status, 200);
    const exportData = await exportRes.json();
    assert.equal(exportData.customer.id, cust1.id);
    assert.equal(exportData.bills.length, 1);
    assert.equal(exportData.bills[0].claimTokenHash, undefined, 'Export must never expose internal claimTokenHash');
    assert.equal(exportData.consents.privacyPolicyVersion, 'bozza-2026-11');
    assert.equal(exportData.supportRequests.length, 1);

    // 4. Account Closure: requires valid password, revokes tokens, preserves signatureLogs & portalBills
    const badClose = await fetch(`${baseUrl}/api/portal/account/closure-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ password: 'WrongPassword!', reason: 'Test' }),
    });
    assert.equal(badClose.status, 403);

    const validClose = await fetch(`${baseUrl}/api/portal/account/closure-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ password: pass1, reason: 'Chiusura volontaria test' }),
    });
    assert.equal(validClose.status, 200);

    // Token1 is immediately revoked
    const afterClosePing = await fetch(`${baseUrl}/api/protected-check`, {
      headers: { Authorization: `Bearer ${token1}` },
    });
    assert.equal(afterClosePing.status, 403, 'Closed account JWT must be rejected immediately');

    // Contractual signature logs & bills are preserved (not auto-deleted)
    assert.ok(dataStore.getSignatureLogs().some((s) => s.id === sigId), 'Contractual signature logs must be preserved on closure');
    assert.ok(typeof signatureService === 'object');

    console.log('✔ ALL GUEST CLAIM, SUPPORT, EXPORT & CLOSURE TESTS PASSED!');
  } finally {
    for (const id of [user1.id, user2.id]) {
      const idx = dataStore.users.findIndex((u) => u.id === id);
      if (idx >= 0) dataStore.users.splice(idx, 1);
    }
    for (const id of [cust1.id, cust2.id]) {
      const idx = dataStore.getCustomers().findIndex((c) => c.id === id);
      if (idx >= 0) dataStore.getCustomers().splice(idx, 1);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

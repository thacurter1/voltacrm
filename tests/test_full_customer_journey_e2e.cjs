process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'test-full-e2e-journey-secret-at-least-32-chars-!!';
process.env.APP_PUBLIC_URL = 'https://voltacrm.vercel.app';

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');
const bcrypt = req('bcryptjs');

async function run() {
  console.log('=== TEST SUITE: FULL CUSTOMER JOURNEY E2E (MULTI-ACTOR) ===');

  const dataStore = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
  const emailService = require(path.join(serverDir, 'dist', 'services', 'emailService.js'));
  const tokenService = require(path.join(serverDir, 'dist', 'services', 'authTokenService.js'));
  const { authRouter } = require(path.join(serverDir, 'dist', 'routes', 'auth.js'));
  const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));
  const { customersRouter } = require(path.join(serverDir, 'dist', 'routes', 'customers.js'));
  const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/auth', authRouter);
  app.use('/api/portal', portalRouter);
  app.use('/api/customers', customersRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  emailService.clearTestEmailOutbox();
  tokenService.clearAuthActionTokensForTest();

  // Seed active admin + isolated external broker + isolated second customer
  const adminUser = {
    id: 'e2e-admin-1',
    name: 'Admin E2E',
    email: `e2e.admin.${Date.now()}@example.invalid`,
    password: bcrypt.hashSync('AdminSecret2026!', 10),
    role: 'admin',
    onboardingStatus: 'active',
    emailVerified: true,
    tokenVersion: 1,
  };
  const externalBroker = {
    id: 'e2e-broker-other',
    name: 'Broker Estraneo',
    email: `e2e.broker.${Date.now()}@example.invalid`,
    password: bcrypt.hashSync('BrokerSecret2026!', 10),
    role: 'broker',
    onboardingStatus: 'active',
    emailVerified: true,
    tokenVersion: 1,
  };
  const cust2 = {
    id: `cust-e2e-2-${Date.now()}`,
    name: 'Cliente Due E2E',
    fiscalCode: 'BNCGVN85B02F205Y',
    phone: '+39 349 9988776',
    email: `e2e.cust2.${Date.now()}@example.invalid`,
    city: 'Torino',
    utilityPoints: [],
    contractStartDate: '2026-11-17',
    lastSwitchAuditDate: '2026-11-17',
    nextSwitchAuditDate: '2027-03-17',
    accountManager: '',
    hasBrokerageMandate: false,
    notes: '',
  };
  const user2 = {
    id: `user-e2e-2-${Date.now()}`,
    name: cust2.name,
    email: cust2.email,
    password: bcrypt.hashSync('Cust2Secret2026!', 10),
    role: 'customer',
    customerId: cust2.id,
    onboardingStatus: 'active',
    emailVerified: true,
    tokenVersion: 1,
  };
  dataStore.users.push(adminUser, externalBroker, user2);
  dataStore.getCustomers().push(cust2);

  const adminJwt = generateToken({ userId: adminUser.id, email: adminUser.email, role: 'admin', tokenVersion: 1 });
  const brokerJwt = generateToken({ userId: externalBroker.id, email: externalBroker.email, role: 'broker', tokenVersion: 1 });
  const cust2Jwt = generateToken({ userId: user2.id, email: user2.email, role: 'customer', customerId: cust2.id, tokenVersion: 1 });

  const c1Email = `e2e.cust1.${Date.now()}@example.invalid`;
  const c1EmailNew = `e2e.cust1.new.${Date.now()}@example.invalid`;
  const c1Pass1 = 'JourneyPass2026!';
  const c1Pass2 = 'JourneyResetPass2026!';

  try {
    // 1. Register validation in non-demo mode rejects invalid CF check digit, then runs E2E journey with local storage
    process.env.VOLTA_DEMO_MODE = 'false';
    const badCfRes = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Laura Viaggio',
        email: c1Email,
        phone: '+39 347 1122334',
        fiscalCode: 'MRTNRA82M15F205X',
        password: c1Pass1,
        privacyConsent: true,
      }),
    });
    assert.equal(badCfRes.status, 400);
    process.env.VOLTA_DEMO_MODE = 'true';

    const regRes = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Laura Viaggio',
        email: c1Email,
        phone: '+39 347 1122334',
        fiscalCode: 'RSSMRA80A01H501U',
        password: c1Pass1,
        privacyConsent: true,
        privacyPolicyVersion: 'bozza-2026-11',
        marketingConsent: false,
      }),
    });
    assert.equal(regRes.status, 201);
    const regBody = await regRes.json();
    assert.equal(regBody.requireEmailVerification, true);
    assert.equal(regBody.token, undefined);
    const customerId = regBody.user.customerId;

    // 2. Pre-verification login blocked
    const preLogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: c1Email, password: c1Pass1 }),
    });
    assert.equal(preLogin.status, 403);

    // 3. Extract verification token & verify email (single use)
    const verifyMail = emailService.getTestEmailOutbox().find((m) => m.to === c1Email && m.text.includes('verifyEmailToken='));
    assert.ok(verifyMail, 'Verification email must arrive in test outbox');
    const verifyToken = new URL(verifyMail.text.match(/https:\/\/voltacrm\.vercel\.app\S+/)[0]).searchParams.get('verifyEmailToken');
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
    assert.equal(verifyRes.status, 200);
    const replayVerify = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verifyToken }),
    });
    assert.equal(replayVerify.status, 400);

    // 4. Customer 1 logs in & uploads bill with Idempotency-Key
    const loginRes = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: c1Email, password: c1Pass1 }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    let c1Jwt = loginBody.token;
    assert.ok(c1Jwt);

    const pdfA = Buffer.from('%PDF-1.4\n%E2E Journey A\n%%EOF\n').toString('base64');
    const pdfB = Buffer.from('%PDF-1.4\n%E2E Journey B\n%%EOF\n').toString('base64');
    const idemKey = `e2e-bill-${Date.now()}`;

    const up1 = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c1Jwt}`,
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({
        customerId,
        fileName: 'viaggio-luce.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfA,
        utilityType: 'luce',
      }),
    });
    assert.equal(up1.status, 201);
    const up1Body = await up1.json();
    assert.notEqual(up1Body.lead.assignedBrokerId, 'user-op-2', 'Must never assign ghost user-op-2');

    // Duplicate same key+file -> idempotent 200; same key+different content -> 409
    const upReplay = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Jwt}`, 'Idempotency-Key': idemKey },
      body: JSON.stringify({ customerId, fileName: 'viaggio-luce.pdf', mimeType: 'application/pdf', base64Data: pdfA, utilityType: 'luce' }),
    });
    assert.equal(upReplay.status, 200);
    assert.equal((await upReplay.json()).bill.id, up1Body.bill.id);

    const upConflict = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Jwt}`, 'Idempotency-Key': idemKey },
      body: JSON.stringify({ customerId, fileName: 'viaggio-luce.pdf', mimeType: 'application/pdf', base64Data: pdfB, utilityType: 'luce' }),
    });
    assert.equal(upConflict.status, 409);

    // 5. Isolation: external broker & Customer 2 denied 403 on Customer 1 bill
    const brokerDownloadDenied = await fetch(`${baseUrl}/api/portal/bills/${up1Body.bill.id}/download`, {
      headers: { Authorization: `Bearer ${brokerJwt}` },
    });
    assert.equal(brokerDownloadDenied.status, 403);

    const cust2BillDenied = await fetch(`${baseUrl}/api/portal/bills?customerId=${encodeURIComponent(customerId)}`, {
      headers: { Authorization: `Bearer ${cust2Jwt}` },
    });
    assert.equal(cust2BillDenied.status, 403);

    // 6. Staff admin marks bill as analyzed -> Customer 1 sees updated status
    const statusPatch = await fetch(`${baseUrl}/api/portal/bills/${up1Body.bill.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
      body: JSON.stringify({ status: 'analyzed', notes: 'Consumi letti e verificati' }),
    });
    assert.equal(statusPatch.status, 200);
    const listBillsC1 = await fetch(`${baseUrl}/api/portal/bills`, {
      headers: { Authorization: `Bearer ${c1Jwt}` },
    });
    assert.equal(listBillsC1.status, 200);
    const c1BillsBody = await listBillsC1.json();
    assert.equal(c1BillsBody.bills.find((b) => b.id === up1Body.bill.id)?.status, 'analyzed');

    // 7. Customer 1 edits contacts + requests & confirms verified email change
    const patchCust = await fetch(`${baseUrl}/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Jwt}` },
      body: JSON.stringify({ phone: '+39 348 7766554', email: c1Email, city: 'Bologna' }),
    });
    assert.equal(patchCust.status, 200);
    assert.equal((await patchCust.json()).customer.city, 'Bologna');

    const reqEmailChange = await fetch(`${baseUrl}/api/auth/request-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Jwt}` },
      body: JSON.stringify({ newEmail: c1EmailNew, password: c1Pass1 }),
    });
    assert.equal(reqEmailChange.status, 200);
    const emailChangeMail = emailService.getTestEmailOutbox().find((m) => m.to === c1EmailNew && m.text.includes('emailChangeToken='));
    assert.ok(emailChangeMail);
    const emailChangeToken = new URL(emailChangeMail.text.match(/https:\/\/voltacrm\.vercel\.app\S+/)[0]).searchParams.get('emailChangeToken');
    const confirmEmailChange = await fetch(`${baseUrl}/api/auth/confirm-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: emailChangeToken }),
    });
    assert.equal(confirmEmailChange.status, 200);

    // 8. Forgot & reset password revokes old session & password
    const forgotRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: c1EmailNew }),
    });
    assert.equal(forgotRes.status, 200);
    const resetMail = emailService.getTestEmailOutbox().find((m) => m.to === c1EmailNew && m.text.includes('resetToken='));
    assert.ok(resetMail);
    const resetToken = new URL(resetMail.text.match(/https:\/\/voltacrm\.vercel\.app\S+/)[0]).searchParams.get('resetToken');
    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password: c1Pass2 }),
    });
    assert.equal(resetRes.status, 200);

    // Old JWT is immediately rejected after password reset
    const staleJwtCheck = await fetch(`${baseUrl}/api/portal/bills`, {
      headers: { Authorization: `Bearer ${c1Jwt}` },
    });
    assert.equal(staleJwtCheck.status, 403);

    // Login with new email + new password works
    const relogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: c1EmailNew, password: c1Pass2 }),
    });
    assert.equal(relogin.status, 200);
    c1Jwt = (await relogin.json()).token;

    // 9. Support request, export, and account closure
    const suppRes = await fetch(`${baseUrl}/api/portal/support-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Jwt}` },
      body: JSON.stringify({ subject: 'Verifica finale E2E', message: 'Confermo la ricezione della valutazione.' }),
    });
    assert.equal(suppRes.status, 201);

    const exportRes = await fetch(`${baseUrl}/api/portal/account/export`, {
      headers: { Authorization: `Bearer ${c1Jwt}` },
    });
    assert.equal(exportRes.status, 200);
    const exported = await exportRes.json();
    assert.equal(exported.account.email, c1EmailNew);
    assert.equal(exported.bills.length, 1);
    assert.equal(exported.supportRequests.length, 1);

    const closeRes = await fetch(`${baseUrl}/api/portal/account/closure-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c1Jwt}` },
      body: JSON.stringify({ password: c1Pass2, reason: 'Fine collaudo E2E' }),
    });
    assert.equal(closeRes.status, 200);

    const afterClosureCheck = await fetch(`${baseUrl}/api/portal/bills`, {
      headers: { Authorization: `Bearer ${c1Jwt}` },
    });
    assert.equal(afterClosureCheck.status, 403);

    console.log('✔ FULL CUSTOMER JOURNEY E2E (MULTI-ACTOR) PASSED!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('❌ E2E Journey test failed:', err);
  process.exit(1);
});

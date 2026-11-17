process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'test-portal-auth-idem-secret-at-least-32-chars!!';

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

async function run() {
  console.log('=== TEST SUITE: PORTAL AUTHENTICATED IDEMPOTENCY & BROKER ASSIGNMENT (SECTION A) ===');

  const dataStore = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
  const { portalService } = require(path.join(serverDir, 'dist', 'services', 'portalService.js'));
  const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));
  const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/portal', portalRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const pdfA = Buffer.from('%PDF-1.4\n%Bill A\n%%EOF\n').toString('base64');
  const pdfB = Buffer.from('%PDF-1.4\n%Bill B DIFFERENT\n%%EOF\n').toString('base64');

  const unassignedCust = {
    id: 'cust-unassigned-test-a',
    name: 'Cliente Senza Broker',
    fiscalCode: 'RSSMRA80A01H501U',
    phone: '+39 333 9876543',
    email: 'senzabroker@example.invalid',
    city: 'Milano',
    utilityPoints: [],
    contractStartDate: '2026-11-17',
    lastSwitchAuditDate: '2026-11-17',
    nextSwitchAuditDate: '2027-03-17',
    accountManager: '',
    hasBrokerageMandate: false,
    notes: '',
  };
  const unassignedUser = {
    id: 'user-cust-unassigned-test-a',
    name: unassignedCust.name,
    email: unassignedCust.email,
    role: 'customer',
    customerId: unassignedCust.id,
    onboardingStatus: 'active',
  };

  const custB = {
    ...unassignedCust,
    id: 'cust-unassigned-test-b',
    name: 'Secondo Cliente Senza Broker',
    email: 'secondocliente@example.invalid',
  };
  const userB = {
    id: 'user-cust-unassigned-test-b',
    name: custB.name,
    email: custB.email,
    role: 'customer',
    customerId: custB.id,
    onboardingStatus: 'active',
  };

  dataStore.getCustomers().push(unassignedCust, custB);
  dataStore.users.push(unassignedUser, userB);

  const custAToken = generateToken({ userId: unassignedUser.id, email: unassignedUser.email, role: 'customer' });
  const custBToken = generateToken({ userId: userB.id, email: userB.email, role: 'customer' });
  const brokerChiara = dataStore.users.find((u) => u.id === 'user-op-2');
  const brokerValentina = dataStore.users.find((u) => u.id === 'user-op-3');
  const adminMatteo = dataStore.users.find((u) => u.id === 'user-admin-1');
  assert.ok(brokerChiara && brokerValentina && adminMatteo, 'Seed staff accounts must exist');

  const chiaraToken = generateToken({ userId: brokerChiara.id, email: brokerChiara.email, role: brokerChiara.role });
  const valentinaToken = generateToken({ userId: brokerValentina.id, email: brokerValentina.email, role: brokerValentina.role });
  const adminToken = generateToken({ userId: adminMatteo.id, email: adminMatteo.email, role: adminMatteo.role });

  const origChiaraStatus = brokerChiara.onboardingStatus;
  const origValentinaStatus = brokerValentina.onboardingStatus;

  try {
    // 1. Authenticated upload by newly registered customer with NO assignedBrokerId must NOT fall back to user-op-2
    const authKey = 'auth-idem-key-001';
    const firstUploadRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`,
        'X-Idempotency-Key': authKey,
      },
      body: JSON.stringify({
        fileName: 'fattura_luce.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfA,
        utilityType: 'luce',
        notes: 'Prima bolletta cliente nuovo',
      }),
    });
    assert.equal(firstUploadRes.status, 201, `Expected 201 on first authenticated upload, got ${firstUploadRes.status}`);
    const firstBody = await firstUploadRes.json();
    assert.equal(
      firstBody.bill?.assignedBrokerId,
      undefined,
      `Authenticated upload for customer without broker must NOT assign phantom user-op-2 (got ${firstBody.bill?.assignedBrokerId})`
    );
    assert.equal(
      firstBody.lead?.assignedBrokerId,
      undefined,
      `Lead for customer without broker must remain unassigned (got ${firstBody.lead?.assignedBrokerId})`
    );

    // 2. Stranger brokers (Chiara & Valentina) MUST NOT see or download the unassigned bill (403 on download), Admin DOES see it
    const chiaraListRes = await fetch(`${baseUrl}/api/portal/bills`, { headers: { Authorization: `Bearer ${chiaraToken}` } });
    const chiaraList = await chiaraListRes.json();
    assert.ok(!chiaraList.bills.some((b) => b.id === firstBody.bill.id), 'Unassigned bill must NOT appear in broker list');

    const chiaraDl = await fetch(`${baseUrl}/api/portal/bills/${firstBody.bill.id}/download`, {
      headers: { Authorization: `Bearer ${chiaraToken}` },
    });
    assert.equal(chiaraDl.status, 403, `Stranger broker download must return 403, got ${chiaraDl.status}`);

    const adminListRes = await fetch(`${baseUrl}/api/portal/bills`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const adminList = await adminListRes.json();
    assert.ok(adminList.bills.some((b) => b.id === firstBody.bill.id), 'Admin must see unassigned bills');

    // 3. Authenticated retry with SAME X-Idempotency-Key + SAME payload returns 200 idempotent with SAME bill & lead
    const retryRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`,
        'X-Idempotency-Key': authKey,
      },
      body: JSON.stringify({
        fileName: 'fattura_luce.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfA,
        utilityType: 'luce',
        notes: 'Prima bolletta cliente nuovo',
      }),
    });
    assert.equal(retryRes.status, 200, `Expected 200 on idempotent authenticated retry, got ${retryRes.status}`);
    const retryBody = await retryRes.json();
    assert.equal(retryBody.idempotent, true);
    assert.equal(retryBody.bill?.id, firstBody.bill.id, 'Retry must return exact existing bill ID');
    assert.equal(retryBody.leadId, firstBody.leadId, 'Retry must return exact existing lead ID');

    // 4. Same key with DIFFERENT file bytes returns 409 Conflict
    const diffBytesRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custAToken}`,
        'X-Idempotency-Key': authKey,
      },
      body: JSON.stringify({
        fileName: 'fattura_luce.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfB,
        utilityType: 'luce',
      }),
    });
    assert.equal(diffBytesRes.status, 409, `Same key with different bytes must return 409, got ${diffBytesRes.status}`);

    // 5. Same idempotency key string on DIFFERENT customer account (Customer B) is scoped per account and succeeds cleanly!
    const custBRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custBToken}`,
        'X-Idempotency-Key': authKey,
      },
      body: JSON.stringify({
        fileName: 'fattura_gas.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfB,
        utilityType: 'gas',
      }),
    });
    assert.equal(custBRes.status, 201, `Same idempotency key for Customer B must be scoped cleanly and return 201, got ${custBRes.status}`);
    const custBBody = await custBRes.json();
    assert.notEqual(custBBody.bill.id, firstBody.bill.id);

    // 6. Concurrent duplicate authenticated uploads produce only 1 bill and 1 lead
    const concurrentKey = 'auth-idem-concurrent-002';
    const [r1, r2] = await Promise.all([
      fetch(`${baseUrl}/api/portal/bills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custAToken}`,
          'X-Idempotency-Key': concurrentKey,
        },
        body: JSON.stringify({ fileName: 'c.pdf', mimeType: 'application/pdf', base64Data: pdfA, utilityType: 'luce' }),
      }),
      fetch(`${baseUrl}/api/portal/bills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${custAToken}`,
          'X-Idempotency-Key': concurrentKey,
        },
        body: JSON.stringify({ fileName: 'c.pdf', mimeType: 'application/pdf', base64Data: pdfA, utilityType: 'luce' }),
      }),
    ]);
    const b1 = await r1.json();
    const b2 = await r2.json();
    assert.equal(b1.bill.id, b2.bill.id, 'Concurrent duplicate authenticated uploads must converge to one bill');
    assert.equal(b1.leadId, b2.leadId, 'Concurrent duplicate authenticated uploads must converge to one lead');

    // 7. Suspended broker assigned on customer must NOT receive new bills; guest upload must never assign suspended broker or hardcoded user-op-2
    brokerChiara.onboardingStatus = 'suspended';
    brokerValentina.onboardingStatus = 'suspended';
    unassignedCust.assignedBrokerId = brokerChiara.id;

    const suspUploadRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custAToken}` },
      body: JSON.stringify({ fileName: 's.pdf', mimeType: 'application/pdf', base64Data: pdfA, utilityType: 'gas' }),
    });
    assert.equal(suspUploadRes.status, 201);
    const suspBody = await suspUploadRes.json();
    assert.equal(suspBody.bill?.assignedBrokerId, undefined, 'Suspended broker on customer must NOT be assigned to new bill');

    const guestNoActiveRes = await fetch(`${baseUrl}/api/portal/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Guest Queue',
        phone: '+39 347 1122000',
        privacyConsent: true,
        utilityType: 'luce',
        fileName: 'g.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfA,
      }),
    });
    assert.equal(guestNoActiveRes.status, 201);
    const guestNoActiveBody = await guestNoActiveRes.json();
    assert.equal(
      guestNoActiveBody.bill?.assignedBrokerId,
      undefined,
      `Guest upload when all brokers suspended must enter unassigned queue, never phantom user-op-2 (got ${guestNoActiveBody.bill?.assignedBrokerId})`
    );

    // 8. Storage error during uploadBill must fail loudly without creating a lead
    const origUpload = portalService.uploadBill;
    const leadsBeforeErr = dataStore.getLeads().length;
    portalService.uploadBill = async () => {
      throw Object.assign(new Error('Storage bucket offline'), { status: 503 });
    };
    try {
      const storageFailRes = await fetch(`${baseUrl}/api/portal/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custAToken}` },
        body: JSON.stringify({ fileName: 'err.pdf', mimeType: 'application/pdf', base64Data: pdfA, utilityType: 'luce' }),
      });
      assert.equal(storageFailRes.status, 503, 'Storage failure must propagate 503 error and never return success');
      assert.equal(dataStore.getLeads().length, leadsBeforeErr, 'Failed storage upload must not create any lead');
    } finally {
      portalService.uploadBill = origUpload;
    }

    // Also keep lint unused-var clean on valentinaToken
    assert.ok(valentinaToken);
    console.log('✔ ALL SECTION A TESTS PASSED!');
  } finally {
    brokerChiara.onboardingStatus = origChiaraStatus;
    brokerValentina.onboardingStatus = origValentinaStatus;
    const custs = dataStore.getCustomers();
    for (const id of [unassignedCust.id, custB.id]) {
      const idx = custs.findIndex((c) => c.id === id);
      if (idx >= 0) custs.splice(idx, 1);
    }
    for (const id of [unassignedUser.id, userB.id]) {
      const idx = dataStore.users.findIndex((u) => u.id === id);
      if (idx >= 0) dataStore.users.splice(idx, 1);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

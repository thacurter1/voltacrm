const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: PORTAL BILL DOWNLOAD DEFENSIVE NULL CHECK (SEC-12) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'portal-nullcheck-test-jwt-secret-min32chars';

const serverDir = path.join(__dirname, '..', 'server');
const reqModule = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = reqModule('express');

const { users } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));
const { portalService } = require(path.join(serverDir, 'dist', 'services', 'portalService.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/portal', portalRouter);

  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/portal`;

  const originalGetBill = portalService.getBill;

  try {
    const customerUser = users.find((u) => u.id === 'user-cust-1');
    assert.ok(customerUser, 'Customer user user-cust-1 must exist');
    const customerToken = generateToken({
      userId: customerUser.id,
      email: customerUser.email,
      role: customerUser.role,
    });

    const brokerUser = users.find((u) => u.id === 'user-op-3');
    assert.ok(brokerUser, 'Broker user user-op-3 must exist');
    const brokerToken = generateToken({
      userId: brokerUser.id,
      email: brokerUser.email,
      role: brokerUser.role,
    });

    // -------------------------------------------------------------------------
    // TEST 1: Customer requests download of non-existent bill returning null
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Customer download di bolletta inesistente con bill === null ---');
    portalService.getBill = async (id) => {
      if (id === 'non-existent-id-9999') return null;
      return originalGetBill.call(portalService, id);
    };

    const resNull = await fetch(`${baseUrl}/bills/non-existent-id-9999/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });

    const bodyNull = await resNull.json();
    console.log(`[TEST 1] HTTP status: ${resNull.status}, body:`, bodyNull);

    assert.equal(
      resNull.status,
      404,
      `Expected HTTP 404 for non-existent bill, but received ${resNull.status} (likely TypeError 500)`
    );
    assert.equal(bodyNull.success, false, 'Expected success === false');
    assert.equal(
      bodyNull.message,
      'Bolletta richiesta non trovata.',
      'Expected exact error message "Bolletta richiesta non trovata."'
    );
    console.log('✔ HTTP 404 restituito correttamente con messaggio pulito per bill === null');

    // -------------------------------------------------------------------------
    // TEST 2: Customer requests download when getBill returns undefined
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Customer download con getBill che restituisce undefined ---');
    portalService.getBill = async (id) => {
      if (id === 'non-existent-undefined-id') return undefined;
      return originalGetBill.call(portalService, id);
    };

    const resUndefined = await fetch(`${baseUrl}/bills/non-existent-undefined-id/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });

    const bodyUndefined = await resUndefined.json();
    console.log(`[TEST 2] HTTP status: ${resUndefined.status}, body:`, bodyUndefined);

    assert.equal(
      resUndefined.status,
      404,
      `Expected HTTP 404 for undefined bill, but received ${resUndefined.status}`
    );
    assert.equal(bodyUndefined.success, false);
    assert.equal(bodyUndefined.message, 'Bolletta richiesta non trovata.');
    console.log('✔ HTTP 404 restituito correttamente con messaggio pulito per bill === undefined');

    // -------------------------------------------------------------------------
    // TEST 3: Staff/Broker requests download of non-existent bill returning null
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Staff/Broker download di bolletta inesistente con bill === null ---');
    portalService.getBill = async (id) => {
      if (id === 'broker-null-bill-9999') return null;
      return originalGetBill.call(portalService, id);
    };

    const resBrokerNull = await fetch(`${baseUrl}/bills/broker-null-bill-9999/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${brokerToken}`,
      },
    });

    const bodyBrokerNull = await resBrokerNull.json();
    console.log(`[TEST 3] HTTP status: ${resBrokerNull.status}, body:`, bodyBrokerNull);

    assert.equal(
      resBrokerNull.status,
      404,
      `Expected HTTP 404 for broker on non-existent bill, but received ${resBrokerNull.status}`
    );
    assert.equal(bodyBrokerNull.success, false);
    assert.equal(bodyBrokerNull.message, 'Bolletta richiesta non trovata.');
    console.log('✔ HTTP 404 restituito correttamente per staff su bill inesistente');

    // -------------------------------------------------------------------------
    // TEST 4: Regression check - Regular bill download works for authorized customer
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Regressione - Download regolare di bolletta esistente per cliente autorizzato ---');
    portalService.getBill = originalGetBill;

    // Upload a temporary bill for cust-1
    const testBill = await portalService.uploadBill({
      customerId: 'cust-1',
      customerName: 'Andrea Moretti',
      fileName: 'bolletta-test-nullcheck.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 test bill content for SEC-12'),
      utilityType: 'luce',
    });

    const resExisting = await fetch(`${baseUrl}/bills/${testBill.id}/download`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
    });

    assert.equal(resExisting.status, 200, `Expected 200 for existing bill, received ${resExisting.status}`);
    const resBytes = Buffer.from(await resExisting.arrayBuffer());
    assert.ok(resBytes.length > 0, 'Downloaded file bytes must not be empty');
    console.log(`✔ Download regolare completato con successo (status 200, ${resBytes.length} bytes)`);

    // Clean up uploaded bill
    if (typeof portalService.deleteBill === 'function') {
      await portalService.deleteBill(testBill.id);
    }

    console.log('\n=== TUTTI I TEST DEL SUITE SEC-12 SUPERATI CON SUCCESSO ===');
  } finally {
    portalService.getBill = originalGetBill;
    await new Promise((resolve) => server.close(resolve));
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST FALLITO:', err);
  process.exit(1);
});

const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: BROKER SWITCH CONTRACT SIGN & PORTAL ACCESS (TDD) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'broker-tdd-secret-at-least-32-characters-long';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users, customers } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { switchRouter } = require(path.join(serverDir, 'dist', 'routes', 'switch.js'));
const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/switch', switchRouter);
  app.use('/api/portal', portalRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const brokerUser = users.find(u => u.id === 'user-op-3');
    assert.ok(brokerUser, 'Broker user-op-3 must exist');
    const brokerToken = generateToken({ userId: brokerUser.id, email: brokerUser.email, role: brokerUser.role });

    const assignedCustomer = customers.find(c => c.id === 'cust-1');
    assert.ok(assignedCustomer, 'Customer cust-1 must exist');

    // 1. TEST SIGN: Broker firma contratto per il cliente assegnato
    console.log('--- TEST 1: Broker firma mandato FEA Canvas per cliente assegnato ---');
    const canvas1x1Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const signRes = await fetch(`${baseUrl}/switch/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brokerToken}`
      },
      body: JSON.stringify({
        customerId: assignedCustomer.id,
        customerName: assignedCustomer.name,
        signerFiscalCode: assignedCustomer.fiscalCode,
        phone: assignedCustomer.phone,
        signatureType: 'canvas',
        canvasDataUrl: canvas1x1Png,
        offerId: 'off-luce-1',
        supplier: 'Octopus Energy',
        utilityPointId: assignedCustomer.utilityPoints[0].id,
        podOrPdr: assignedCustomer.utilityPoints[0].podOrPdr
      })
    });

    const signText = await signRes.text();
    let signData;
    try { signData = JSON.parse(signText); } catch { signData = { raw: signText }; }
    assert.equal(signRes.status, 201, `Broker must be able to sign for assigned customer. Received: ${signRes.status} - ${JSON.stringify(signData)}`);
    assert.equal(signData.success, true);
    console.log('✔ Broker firma completata con successo');

    // 2. TEST PORTAL: Broker consulta bollette del cliente assegnato
    console.log('--- TEST 2: Broker consulta bollette cliente su /portal/bills ---');
    const billsRes = await fetch(`${baseUrl}/portal/bills?customerId=${assignedCustomer.id}`, {
      headers: { Authorization: `Bearer ${brokerToken}` }
    });
    assert.equal(billsRes.status, 200, `Broker must access portal bills for assigned customer. Received: ${billsRes.status}`);
    const billsData = await billsRes.json();
    assert.equal(billsData.success, true);
    console.log('✔ Broker accesso a portal bills riuscito');

    console.log('\n🎉 ALL BROKER ACCESS TESTS PASSED!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('❌ Broker Access Test Failed:', err.message);
  process.exit(1);
});

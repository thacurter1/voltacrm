const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: BROKER SIGNATURE ACTIVATION & NOTIFICATION TRIGGER (TDD) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'broker-activation-tdd-secret-32-chars-long';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users, customers, addSignatureLog } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { switchRouter } = require(path.join(serverDir, 'dist', 'routes', 'switch.js'));
const { notificationsRouter } = require(path.join(serverDir, 'dist', 'routes', 'notifications.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/switch', switchRouter);
  app.use('/api/notifications', notificationsRouter);

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

    // Prepara una firma pending in dataStore
    const testSigId = `sig-tdd-broker-act-${Date.now()}`;
    const point = assignedCustomer.utilityPoints[0];
    const signatureLog = {
      id: testSigId,
      customerId: assignedCustomer.id,
      customerName: assignedCustomer.name,
      signerFiscalCode: assignedCustomer.fiscalCode,
      phone: assignedCustomer.phone,
      signatureType: 'canvas',
      canvasHash: 'a'.repeat(64),
      offerId: 'off-luce-1',
      supplier: 'Octopus Energy',
      utilityPointId: point.id,
      podOrPdr: point.podOrPdr,
      energyType: point.type,
      offerSnapshot: {
        id: 'off-luce-1',
        supplier: 'Octopus Energy',
        name: 'Octopus Fissa 12M',
        energyType: 'luce',
        pricingType: 'fixed',
        unitPriceOrSpread: 0.118,
        fixedAnnualFee: 96,
        durationMonths: 12,
        greenCertified: true,
        tag: 'Miglior Prezzo'
      },
      originalPointSnapshot: { ...point },
      consentVersion: '1.0',
      canonicalDocument: {},
      timestamp: new Date().toISOString(),
      status: 'signed',
      activationStatus: 'pending_activation',
      signatureHash: 'hash-test-sig'
    };
    await addSignatureLog(signatureLog);

    // 1. TEST ACTIVATION: Broker attiva la firma per il cliente assegnato
    console.log('--- TEST 1: Broker attiva firma con provvigione su POST /switch/signatures/:id/activate ---');
    const activateRes = await fetch(`${baseUrl}/switch/signatures/${testSigId}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brokerToken}`
      },
      body: JSON.stringify({
        confirmationReference: 'DIST-CONF-BROKER-01',
        activationDate: '2026-10-01',
        generateCommission: true,
        agentId: brokerUser.id
      })
    });

    const actText = await activateRes.text();
    let actData;
    try { actData = JSON.parse(actText); } catch { actData = { raw: actText }; }
    
    assert.equal(
      activateRes.status,
      200,
      `Broker must be authorized to activate signature. Got ${activateRes.status}: ${JSON.stringify(actData)}`
    );
    assert.equal(actData.success, true);
    console.log('✔ Broker attivazione firma autorizzata con successo');

    // 2. TEST NOTIFICATION TRIGGER: Broker genera notifica operativa
    console.log('--- TEST 2: Broker genera notifica operativa su POST /notifications/trigger ---');
    const notifRes = await fetch(`${baseUrl}/notifications/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brokerToken}`
      },
      body: JSON.stringify({
        title: 'Contratto Attivato',
        message: 'Il contratto del cliente è stato confermato dal distributore.',
        type: 'signature_completed',
        priority: 'high',
        targetRole: 'broker'
      })
    });

    const notifText = await notifRes.text();
    let notifData;
    try { notifData = JSON.parse(notifText); } catch { notifData = { raw: notifText }; }

    assert.equal(
      notifRes.status,
      201,
      `Broker must be authorized to trigger notifications. Got ${notifRes.status}: ${JSON.stringify(notifData)}`
    );
    assert.equal(notifData.success, true);
    console.log('✔ Broker invio trigger notifica autorizzato con successo');

    console.log('\n🎉 ALL BROKER ACTIVATION & NOTIFICATION TESTS PASSED!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('❌ Test Failed:', err.message);
  process.exit(1);
});

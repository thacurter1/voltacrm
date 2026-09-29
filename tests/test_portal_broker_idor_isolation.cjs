const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: PORTAL BROKER IDOR & DATA ISOLATION (TDD) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'portal-idor-tdd-secret-at-least-32-characters';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users, customers } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));
const { portalService } = require(path.join(serverDir, 'dist', 'services', 'portalService.js'));

async function runTests() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api/portal', portalRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/portal`;

  try {
    // Valentina Neri (user-op-3) is broker assigned to cust-1 and cust-3
    const brokerValentina = users.find(u => u.id === 'user-op-3');
    assert.ok(brokerValentina, 'Broker user-op-3 must exist');
    const valentinaToken = generateToken({ userId: brokerValentina.id, email: brokerValentina.email, role: brokerValentina.role });

    const assignedCust = customers.find(c => c.id === 'cust-1');
    const unassignedCust = customers.find(c => c.id === 'cust-2');
    assert.ok(assignedCust && unassignedCust, 'Both cust-1 and cust-2 must exist');

    // Create a bill for cust-1 (assigned) and a bill for cust-2 (unassigned)
    const dummyPdfBase64 = Buffer.from('%PDF-1.4 dummy content').toString('base64');
    await portalService.uploadBill({
      customerId: assignedCust.id,
      customerName: assignedCust.name,
      fileName: 'bolletta-valentina-cust1.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 dummy content'),
      utilityType: 'luce'
    });

    const bill2 = await portalService.uploadBill({
      customerId: unassignedCust.id,
      customerName: unassignedCust.name,
      fileName: 'bolletta-chiara-cust2.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 dummy content'),
      utilityType: 'luce'
    });

    // TEST 1: Broker querying unassigned customer bills receives 403 Forbidden
    console.log('--- TEST 1: Broker accede a GET /bills?customerId=cust-2 (non assegnato) ---');
    const unassignedRes = await fetch(`${baseUrl}/bills?customerId=${unassignedCust.id}`, {
      headers: { Authorization: `Bearer ${valentinaToken}` }
    });
    assert.equal(
      unassignedRes.status,
      403,
      `Broker must NOT access bills for unassigned customer. Received status: ${unassignedRes.status}`
    );
    console.log('✔ Accesso negato correttamente (403 Forbidden)');

    // TEST 2: Broker querying GET /bills without customerId only gets assigned customer bills
    console.log('--- TEST 2: Broker richiede GET /bills senza filtro customerId ---');
    const listRes = await fetch(`${baseUrl}/bills`, {
      headers: { Authorization: `Bearer ${valentinaToken}` }
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    const customerIds = listData.bills.map(b => b.customerId);
    assert.ok(!customerIds.includes(unassignedCust.id), 'Broker must NEVER see bills belonging to unassigned customer');
    assert.ok(customerIds.includes(assignedCust.id), 'Broker must see bills belonging to assigned customer');
    console.log('✔ Lista bollette filtrata con isolamento rigoroso (0 bollette altrui)');

    // TEST 3: Broker attempting to download bill of unassigned customer receives 403 Forbidden
    console.log('--- TEST 3: Broker scarica bolletta cliente altrui GET /bills/:id/download ---');
    const downloadRes = await fetch(`${baseUrl}/bills/${bill2.id}/download`, {
      headers: { Authorization: `Bearer ${valentinaToken}` }
    });
    assert.equal(
      downloadRes.status,
      403,
      `Broker must NOT download bill of unassigned customer. Received status: ${downloadRes.status}`
    );
    console.log('✔ Download bolletta altrui bloccato (403 Forbidden)');

    // TEST 4: Broker uploading bill for unassigned customer receives 403 Forbidden
    console.log('--- TEST 4: Broker carica bolletta per cliente non assegnato POST /bills ---');
    const uploadRes = await fetch(`${baseUrl}/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${valentinaToken}`
      },
      body: JSON.stringify({
        customerId: unassignedCust.id,
        utilityType: 'luce',
        fileName: 'tentativo-illegittimo.pdf',
        mimeType: 'application/pdf',
        base64Data: dummyPdfBase64
      })
    });
    assert.equal(
      uploadRes.status,
      403,
      `Broker must NOT upload bill for unassigned customer. Received status: ${uploadRes.status}`
    );
    console.log('✔ Upload bolletta per cliente altrui bloccato (403 Forbidden)');

    console.log('\n🎉 ALL PORTAL IDOR & BROKER ISOLATION TESTS PASSED!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('❌ Portal IDOR Test Failed:', err.message);
  process.exit(1);
});

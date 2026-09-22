const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: RBAC HIERARCHY & BROKER DATA ISOLATION ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'rbac-test-secret-at-least-32-characters-long';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { customersRouter } = require(path.join(serverDir, 'dist', 'routes', 'customers.js'));
const { commissionRouter } = require(path.join(serverDir, 'dist', 'routes', 'commissions.js'));
const { operationsRouter } = require(path.join(serverDir, 'dist', 'routes', 'operations.js'));
const { leadsRouter } = require(path.join(serverDir, 'dist', 'routes', 'leads.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', customersRouter);
  app.use('/api/commissions', commissionRouter);
  app.use('/api/operations', operationsRouter);
  app.use('/api/leads', leadsRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const adminUser = users.find(u => u.id === 'user-admin-1');
    assert.ok(adminUser, 'Admin user user-admin-1 must exist');
    const adminToken = generateToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });

    const brokerUser = users.find(u => u.id === 'user-op-3');
    assert.ok(brokerUser, 'Broker user user-op-3 must exist');
    const brokerToken = generateToken({ userId: brokerUser.id, email: brokerUser.email, role: brokerUser.role });

    const ccUser = users.find(u => u.id === 'user-cc-4');
    assert.ok(ccUser, 'Call center user user-cc-4 must exist');
    const ccToken = generateToken({ userId: ccUser.id, email: ccUser.email, role: ccUser.role });

    // --- 1. ADMIN RBAC & DATA VISIBILITY ---
    console.log('--- TEST 1: Admin Scope (Full Visibility) ---');
    const adminCustRes = await fetch(`${baseUrl}/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminCustRes.status, 200, 'Admin should get 200 from /customers');
    const adminCustData = await adminCustRes.json();
    assert.ok(adminCustData.customers.length >= 3, 'Admin must see all agency customers');
    const hasCust1 = adminCustData.customers.some(c => c.id === 'cust-1');
    const hasCust2 = adminCustData.customers.some(c => c.id === 'cust-2');
    const hasCust3 = adminCustData.customers.some(c => c.id === 'cust-3');
    assert.ok(hasCust1 && hasCust2 && hasCust3, 'Admin must see customers across all brokers');
    console.log(`✔ Admin vede tutti i clienti (${adminCustData.customers.length} clienti)`);

    const adminSecRes = await fetch(`${baseUrl}/operations/security-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminSecRes.status, 200, 'Admin can view security logs');
    console.log('✔ Admin accede ai log di sicurezza e audit GDPR');

    // --- 2. BROKER RBAC & STRICT DATA ISOLATION ---
    console.log('--- TEST 2: Broker Scope (Strict Isolation - Valentina Neri) ---');
    const brokerCustRes = await fetch(`${baseUrl}/customers`, {
      headers: { Authorization: `Bearer ${brokerToken}` }
    });
    assert.equal(brokerCustRes.status, 200, 'Broker should get 200 from /customers');
    const brokerCustData = await brokerCustRes.json();
    
    // In strict isolation, broker must NOT see cust-2 (belonging to Alessandro Mori)
    const brokerHasCust2 = brokerCustData.customers.some(c => c.id === 'cust-2');
    assert.equal(brokerHasCust2, false, 'Broker MUST NOT see customers assigned to other brokers (cust-2)');
    for (const cust of brokerCustData.customers) {
      const isAssigned = cust.accountManager === brokerUser.name || 
                         cust.accountManager === 'Valentina Neri' || 
                         cust.assignedBrokerId === brokerUser.id;
      assert.ok(isAssigned, `Every customer returned to broker must be assigned to them, got ${cust.name} (${cust.accountManager})`);
    }
    console.log(`✔ Broker vede solo i propri clienti (${brokerCustData.customers.length} clienti isolati)`);

    // --- 3. IDOR PREVENTION FOR BROKERS ---
    console.log('--- TEST 3: IDOR Prevention on /api/customers/:id ---');
    const ownCustRes = await fetch(`${baseUrl}/customers/cust-1`, {
      headers: { Authorization: `Bearer ${brokerToken}` }
    });
    assert.equal(ownCustRes.status, 200, 'Broker can view their own customer details');

    // Attempt IDOR on cust-2 (Alessandro Mori) -> Must return 403 Forbidden
    const otherCustRes = await fetch(`${baseUrl}/customers/cust-2`, {
      headers: { Authorization: `Bearer ${brokerToken}` }
    });
    assert.equal(otherCustRes.status, 403, 'Broker must be FORBIDDEN from viewing other brokers customers (IDOR prevention)');
    console.log('✔ Tentativo di IDOR su cliente altrui bloccato con 403 Forbidden');

    // Broker cannot view security logs
    const brokerSecRes = await fetch(`${baseUrl}/operations/security-logs`, {
      headers: { Authorization: `Bearer ${brokerToken}` }
    });
    assert.equal(brokerSecRes.status, 403, 'Broker cannot view security logs');
    console.log('✔ Broker bloccato da log di sicurezza globali (403 Forbidden)');

    // Broker cannot execute SEPA settlement
    const brokerSettleRes = await fetch(`${baseUrl}/commissions/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${brokerToken}`
      },
      body: JSON.stringify({
        agentId: 'user-op-3',
        commissionIds: ['comm-1']
      })
    });
    assert.equal(brokerSettleRes.status, 403, 'Broker cannot settle commissions');
    console.log('✔ Broker bloccato da liquidazione SEPA (403 Forbidden)');

    // --- 4. CALL CENTER BOUNDARY & RESTRICTIONS ---
    console.log('--- TEST 4: Call Center Boundary & Financial Restrictions ---');
    // Call Center cannot access broker commissions
    const ccCommRes = await fetch(`${baseUrl}/commissions`, {
      headers: { Authorization: `Bearer ${ccToken}` }
    });
    assert.equal(ccCommRes.status, 403, 'Call Center must be FORBIDDEN from viewing commissions');
    console.log('✔ Call Center bloccato da provvigioni e dati finanziari (403 Forbidden)');

    // Call Center cannot access security logs
    const ccSecRes = await fetch(`${baseUrl}/operations/security-logs`, {
      headers: { Authorization: `Bearer ${ccToken}` }
    });
    assert.equal(ccSecRes.status, 403, 'Call Center must be FORBIDDEN from viewing security logs');
    console.log('✔ Call Center bloccato da log di sicurezza (403 Forbidden)');

    // Call Center CAN access lead marketing queue
    const ccLeadsRes = await fetch(`${baseUrl}/leads`, {
      headers: { Authorization: `Bearer ${ccToken}` }
    });
    assert.equal(ccLeadsRes.status, 200, 'Call Center can access lead queue');
    const ccLeadsData = await ccLeadsRes.json();
    assert.ok(Array.isArray(ccLeadsData.leads), 'Leads returned as array');
    console.log('✔ Call Center accede alla coda lead e gestione agenda');

    console.log('\n🎉 ALL RBAC HIERARCHY & ISOLATION TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'test-audit-2026-11-12-secret-at-least-32-chars!!';

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require(path.join(__dirname, '..', 'server', 'node_modules', 'express'));
const bcrypt = require(path.join(__dirname, '..', 'server', 'node_modules', 'bcryptjs'));

async function run() {
  console.log('=== TEST SUITE: AUDIT 2026-11-12 REMEDIATION (CODE-01, CODE-02) ===');

  const dataStore = require(path.join(__dirname, '..', 'server', 'dist', 'services', 'dataStore.js'));
  const operationsService = require(path.join(__dirname, '..', 'server', 'dist', 'services', 'operationsService.js'));
  const { authRouter } = require(path.join(__dirname, '..', 'server', 'dist', 'routes', 'auth.js'));
  const { operationsRouter } = require(path.join(__dirname, '..', 'server', 'dist', 'routes', 'operations.js'));
  const { generateToken } = require(path.join(__dirname, '..', 'server', 'dist', 'middleware', 'auth.js'));

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/operations', operationsRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const adminUser = dataStore.users.find((u) => u.id === 'user-admin-1');
  const brokerUser = dataStore.users.find((u) => u.id === 'user-op-3');
  const customerUser = dataStore.users.find((u) => u.id === 'user-cust-1');
  assert.ok(adminUser && brokerUser && customerUser, 'Demo seed users must exist');

  const origAdminStatus = adminUser.onboardingStatus;
  const origBrokerStatus = brokerUser.onboardingStatus;
  const origCustStatus = customerUser.onboardingStatus;
  const origBrokerPass = brokerUser.password;
  const origCustPass = customerUser.password;

  const testLeadOtherId = 'lead-audit-other-broker';
  const testLeadOwnId = 'lead-audit-own-broker';
  const testApptOtherId = 'appt-audit-other-broker';
  const testApptOwnId = 'appt-audit-own-broker';

  dataStore.getLeads().push(
    {
      id: testLeadOtherId,
      name: 'Lead Altrui',
      phone: '+39 333 1111111',
      city: 'Roma',
      source: 'manual',
      status: 'new',
      createdAt: '2026-11-12',
      assignedBrokerId: adminUser.id,
      notes: '',
    },
    {
      id: testLeadOwnId,
      name: 'Lead Proprio',
      phone: '+39 333 2222222',
      city: 'Milano',
      source: 'manual',
      status: 'new',
      createdAt: '2026-11-12',
      assignedBrokerId: brokerUser.id,
      notes: '',
    }
  );

  await operationsService.saveAppointment({
    id: testApptOtherId,
    leadId: testLeadOtherId,
    customerName: 'Lead Altrui',
    phone: '+39 333 1111111',
    city: 'Roma',
    agentName: 'Matteo Riva',
    scheduledAt: '2026-11-15T10:00:00.000Z',
    durationMinutes: 30,
    type: 'phone_consultation',
    status: 'scheduled',
    notes: '',
  });

  try {
    const brokerToken = generateToken({ userId: brokerUser.id, email: brokerUser.email, role: brokerUser.role });

    // CODE-01.1: Broker cannot overwrite an existing appointment assigned to another consultant via POST
    const overwriteRes = await fetch(`${baseUrl}/api/operations/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${brokerToken}` },
      body: JSON.stringify({
        id: testApptOtherId,
        leadId: testLeadOtherId,
        customerName: 'Lead Altrui',
        phone: '+39 333 1111111',
        city: 'Roma',
        agentName: 'Valentina Neri',
        scheduledAt: '2026-11-15T11:00:00.000Z',
        durationMinutes: 30,
        type: 'phone_consultation',
        status: 'scheduled',
        notes: 'Hijack attempt',
      }),
    });
    assert.equal(overwriteRes.status, 403, `Expected 403 when overwriting another broker appointment, got ${overwriteRes.status}`);

    // CODE-01.2: Broker cannot create a new appointment for a lead assigned to another broker
    const foreignLeadRes = await fetch(`${baseUrl}/api/operations/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${brokerToken}` },
      body: JSON.stringify({
        id: 'appt-audit-foreign-lead',
        leadId: testLeadOtherId,
        customerName: 'Lead Altrui',
        phone: '+39 333 1111111',
        city: 'Roma',
        agentName: 'Valentina Neri',
        scheduledAt: '2026-11-15T12:00:00.000Z',
        durationMinutes: 30,
        type: 'phone_consultation',
        status: 'scheduled',
        notes: 'Foreign lead attempt',
      }),
    });
    assert.equal(foreignLeadRes.status, 403, `Expected 403 when creating appointment for foreign lead, got ${foreignLeadRes.status}`);

    // CODE-01.3: Broker CAN create an appointment for their own assigned lead
    const ownLeadRes = await fetch(`${baseUrl}/api/operations/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${brokerToken}` },
      body: JSON.stringify({
        id: testApptOwnId,
        leadId: testLeadOwnId,
        customerName: 'Lead Proprio',
        phone: '+39 333 2222222',
        city: 'Milano',
        agentName: 'Valentina Neri',
        scheduledAt: '2026-11-15T14:00:00.000Z',
        durationMinutes: 30,
        type: 'phone_consultation',
        status: 'scheduled',
        notes: 'Valid own appointment',
      }),
    });
    assert.equal(ownLeadRes.status, 201, `Expected 201 for own lead appointment, got ${ownLeadRes.status}`);
    console.log('  ✅ CODE-01: POST /api/operations/appointments RBAC/IDOR checks passed');

    // CODE-02: Suspended accounts must be blocked directly at login endpoints
    const testOpPass = 'ValidOpPass2026!';
    const testCustPass = 'ValidCustPass2026!';
    brokerUser.password = bcrypt.hashSync(testOpPass, 10);
    customerUser.password = bcrypt.hashSync(testCustPass, 10);
    brokerUser.onboardingStatus = 'suspended';
    customerUser.onboardingStatus = 'suspended';

    const opLoginRes = await fetch(`${baseUrl}/api/auth/login-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: brokerUser.email, password: testOpPass, totpCode: '123456' }),
    });
    const opLoginBody = await opLoginRes.json();
    assert.equal(opLoginRes.status, 403, `Expected 403 on suspended operator login, got ${opLoginRes.status}`);
    assert.ok(!opLoginBody.token, 'Suspended operator login must NOT return a JWT token');

    const custLoginRes = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: customerUser.email, password: testCustPass }),
    });
    const custLoginBody = await custLoginRes.json();
    assert.equal(custLoginRes.status, 403, `Expected 403 on suspended customer login, got ${custLoginRes.status}`);
    assert.ok(!custLoginBody.token, 'Suspended customer login must NOT return a JWT token');

    const demoLoginRes = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: brokerUser.id }),
    });
    const demoLoginBody = await demoLoginRes.json();
    assert.equal(demoLoginRes.status, 403, `Expected 403 on suspended demo-login, got ${demoLoginRes.status}`);
    assert.ok(!demoLoginBody.token, 'Suspended demo-login must NOT return a JWT token');

    const logs = await operationsService.listSecurityLogs();
    const suspendedLogs = logs.filter((l) => l.eventType === 'suspended_account_access_attempt');
    assert.ok(suspendedLogs.length >= 2, 'Suspended login attempts must emit suspended_account_access_attempt logs');
    console.log('  ✅ CODE-02: Login endpoints immediately block suspended accounts and emit security logs');
  } finally {
    adminUser.onboardingStatus = origAdminStatus;
    brokerUser.onboardingStatus = origBrokerStatus;
    customerUser.onboardingStatus = origCustStatus;
    brokerUser.password = origBrokerPass;
    customerUser.password = origCustPass;
    const leads = dataStore.getLeads();
    for (const id of [testLeadOtherId, testLeadOwnId]) {
      const idx = leads.findIndex((l) => l.id === id);
      if (idx >= 0) leads.splice(idx, 1);
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

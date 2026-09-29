const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: STAFF INVITATIONS FOR BROKER & OPERATOR (TDD) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'staff-invitation-tdd-secret-at-least-32-chars';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { createInvitationSchema } = require(path.join(serverDir, 'dist', 'middleware', 'validate.js'));
const { users } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { authRouter } = require(path.join(serverDir, 'dist', 'routes', 'auth.js'));

async function runTests() {
  // 1. UNIT TEST: Schema validation for staff roles
  console.log('--- TEST 1: Schema validation for broker and operator roles ---');
  
  const brokerPayload = {
    role: 'broker',
    name: 'Roberto Valente',
    email: 'roberto.valente@voltaenergia.it',
    phone: '+39 340 1234567'
  };
  const brokerParsed = createInvitationSchema.safeParse(brokerPayload);
  assert.equal(
    brokerParsed.success,
    true,
    `createInvitationSchema must accept role 'broker'. Error: ${JSON.stringify(brokerParsed.error?.issues)}`
  );
  console.log('✔ Schema accetta correttamente role: broker');

  const operatorPayload = {
    role: 'operator',
    name: 'Elena Bianchi',
    email: 'elena.bianchi@voltaenergia.it',
    phone: '+39 345 7654321'
  };
  const operatorParsed = createInvitationSchema.safeParse(operatorPayload);
  assert.equal(
    operatorParsed.success,
    true,
    `createInvitationSchema must accept role 'operator'. Error: ${JSON.stringify(operatorParsed.error?.issues)}`
  );
  console.log('✔ Schema accetta correttamente role: operator');

  const invalidRolePayload = {
    role: 'superadmin',
    name: 'Hacker Ex',
    email: 'hacker@example.com'
  };
  const invalidParsed = createInvitationSchema.safeParse(invalidRolePayload);
  assert.equal(invalidParsed.success, false, 'createInvitationSchema must reject unrecognized roles');
  console.log('✔ Schema respinge correttamente ruoli non censiti');

  // 2. INTEGRATION TEST: HTTP route endpoint POST /api/auth/invitations
  console.log('--- TEST 2: HTTP Endpoint POST /api/auth/invitations with admin token ---');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  try {
    const adminUser = users.find(u => u.role === 'admin');
    assert.ok(adminUser, 'Admin user must exist in dataStore');
    const adminToken = generateToken({ userId: adminUser.id, email: adminUser.email, role: adminUser.role });

    // Calling POST /invitations with role: 'broker' must pass schema validation (not return 400 Bad Request)
    const brokerRes = await fetch(`${baseUrl}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(brokerPayload)
    });

    const brokerResData = await brokerRes.json();
    assert.notEqual(
      brokerRes.status,
      400,
      `POST /invitations with role 'broker' must NOT fail validation with 400. Got: ${JSON.stringify(brokerResData)}`
    );
    console.log(`✔ Richiesta invito broker supera la validazione Zod (status non 400: ${brokerRes.status})`);

    // Calling POST /invitations with role: 'superadmin' must return 400 Bad Request
    const invalidRes = await fetch(`${baseUrl}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(invalidRolePayload)
    });
    assert.equal(invalidRes.status, 400, 'POST /invitations with invalid role must return 400 Bad Request');
    console.log('✔ Richiesta con ruolo fittizio bloccata con 400 Bad Request');

    console.log('\n🎉 ALL STAFF INVITATION TESTS PASSED!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('❌ Staff Invitations Test Failed:', err.message);
  process.exit(1);
});

const assert = require('node:assert/strict');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'p1-auth-regression-secret-at-least-32-characters';

const req = require('node:module').createRequire(path.join(__dirname, 'server', 'package.json'));
req('express-async-errors');
const express = req('express');
const { users } = require('./server/dist/services/dataStore.js');
const { generateToken, authenticateToken, requireRole } = require('./server/dist/middleware/auth.js');
const { customersRouter } = require('./server/dist/routes/customers.js');
const { leadsRouter } = require('./server/dist/routes/leads.js');
const { authRouter } = require('./server/dist/routes/auth.js');

async function main() {
  const operator = {
    id: 'p1-operator', email: 'p1-operator@example.test', role: 'operator', name: 'P1 Operator',
    password: 'unused', is2faEnabled: false,
  };
  users.push(operator);
  const token = generateToken({ userId: operator.id, email: operator.email, role: operator.role });

  const app = express();
  app.use(express.json());
  app.get('/role-check', authenticateToken, requireRole('operator'), (_req, res) => res.json({ success: true }));
  app.use('/customers', customersRouter);
  app.use('/leads', leadsRouter);
  app.use('/auth', authRouter);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = route => fetch(base + route, { headers: { authorization: `Bearer ${token}` } });
  try {
    assert.equal((await get('/customers')).status, 200, 'operator must be able to load customers');
    assert.equal((await get('/leads')).status, 200, 'operator must be able to load leads');
    assert.equal((await get('/auth/profiles')).status, 200, 'operator must be able to load profiles');

    const customerAccount = users.find(user => user.role === 'customer' && user.customerId === 'cust-1');
    const customerToken = generateToken({ userId: customerAccount.id, email: customerAccount.email, role: customerAccount.role });
    const updateResponse = await fetch(base + '/customers/cust-1', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${customerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+39 333 999 8877', email: 'updated-customer@example.test', city: 'Torino' }),
    });
    assert.equal(updateResponse.status, 200, 'customer contact changes must persist through the backend');
    const updatePayload = await updateResponse.json();
    assert.ok(updatePayload.token, 'email changes must return a replacement JWT');
    assert.equal(customerAccount.email, 'updated-customer@example.test');

    operator.role = 'customer';
    assert.notEqual((await get('/role-check')).status, 200, 'a role change must invalidate privileges in an existing JWT');
  } finally {
    users.splice(users.findIndex(user => user.id === operator.id), 1);
    await new Promise(resolve => server.close(resolve));
  }
  console.log('P1 auth regression tests passed.');
}

main().catch(error => { console.error(error); process.exit(1); });

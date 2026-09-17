const assert = require('node:assert/strict');
const path = require('node:path');
process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'p1-operations-regression-secret-at-least-32-chars';

async function main() {
  const operations = require('./server/dist/services/operationsService.js');
  const appointment = await operations.saveAppointment({
    id: 'appt-p1', leadId: 'lead-1', customerName: 'Customer', phone: '+393331234567', city: 'Roma',
    agentName: 'Agent', scheduledAt: '2026-09-18T10:00:00.000Z', durationMinutes: 30,
    type: 'phone_consultation', status: 'scheduled', notes: '',
  });
  assert.equal((await operations.listAppointments())[0].id, appointment.id);
  await operations.updateAppointmentStatus(appointment.id, 'completed');
  assert.equal((await operations.listAppointments())[0].status, 'completed');

  await operations.addSecurityLog({ eventType: 'gdpr_consent_logged', userEmail: 'agent@example.test', ipAddress: '127.0.0.1', status: 'safe', details: 'consent' });
  assert.equal((await operations.listSecurityLogs())[0].ipAddress, '127.0.0.1');

  const req = require('node:module').createRequire(path.join(__dirname, 'server', 'package.json'));
  req('express-async-errors');
  const express = req('express');
  const { users } = require('./server/dist/services/dataStore.js');
  const { generateToken } = require('./server/dist/middleware/auth.js');
  const { operationsRouter } = require('./server/dist/routes/operations.js');
  const actor = { id: 'p1-ops-user', email: 'real-actor@example.test', role: 'operator', name: 'Operator', password: 'unused', is2faEnabled: false };
  users.push(actor);
  const token = generateToken({ userId: actor.id, email: actor.email, role: actor.role });
  const app = express();
  app.use(express.json());
  app.use('/operations', operationsRouter);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base + '/operations/appointments')).status, 401, 'operations endpoints must require auth');
    const response = await fetch(base + '/operations/security-logs', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ eventType: 'login_failed', status: 'warning', details: 'attempt', userEmail: 'forged@example.test', ipAddress: 'forged' }),
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.log.userEmail, actor.email, 'server must derive audit identity from the JWT');
    assert.notEqual(payload.log.ipAddress, 'forged', 'server must ignore a client-provided audit IP');
  } finally {
    users.splice(users.findIndex(user => user.id === actor.id), 1);
    await new Promise(resolve => server.close(resolve));
  }
  console.log('P1 operations regression tests passed.');
}
main().catch(error => { console.error(error); process.exit(1); });

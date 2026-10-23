const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: SECURITY AUDIT LOGGING (SEC-08) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'security-audit-test-secret-at-least-32-chars';

const serverDir = path.join(__dirname, '..', 'server');
const reqModule = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = reqModule('express');

const { users } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken, authenticateToken, requireRole } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { authRouter } = require(path.join(serverDir, 'dist', 'routes', 'auth.js'));
const { listSecurityLogs } = require(path.join(serverDir, 'dist', 'services', 'operationsService.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  // Endpoint protetto solo per admin per testare violazioni RBAC
  app.get('/api/admin-restricted', authenticateToken, requireRole('admin'), (_req, res) => {
    res.json({ success: true, message: 'Benvenuto admin' });
  });

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Operator login failure (credenziali errate)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Operator Login Failure Audit Log ---');
    const logsBefore1 = await listSecurityLogs();
    const countBefore1 = logsBefore1.length;

    const opFailRes = await fetch(`${baseUrl}/auth/login-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'c.bianchi@voltagroup.it',
        password: 'PasswordCompletamenteSbagliata!'
      })
    });
    assert.equal(opFailRes.status, 401, 'Login fallito con password errata deve dare 401');

    const logsAfter1 = await listSecurityLogs();
    assert.equal(logsAfter1.length, countBefore1 + 1, 'Deve essere stato aggiunto un log di sicurezza');
    const opFailLog = logsAfter1[0];
    assert.equal(opFailLog.eventType, 'login_failed_operator', 'eventType deve essere login_failed_operator');
    assert.equal(opFailLog.status, 'warning', 'status deve essere warning');
    assert.equal(opFailLog.userEmail, 'c.bianchi@voltagroup.it', 'userEmail deve essere email tentata');
    assert.ok(
      opFailLog.details.includes('Credenziali operatore errate'),
      `details deve menzionare credenziali errate: ${opFailLog.details}`
    );
    console.log('✔ Operator login failure registrato correttamente');

    // -------------------------------------------------------------------------
    // TEST 2: Operator TOTP failure (codice 2FA errato)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Operator TOTP Failure Audit Log ---');
    const logsBefore2 = await listSecurityLogs();
    const countBefore2 = logsBefore2.length;

    const totpFailRes = await fetch(`${baseUrl}/auth/login-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'c.bianchi@voltagroup.it',
        password: 'operator123',
        totpCode: '000000'
      })
    });
    assert.equal(totpFailRes.status, 403, 'Login operatore con 2FA errato deve dare 403');

    const logsAfter2 = await listSecurityLogs();
    assert.equal(logsAfter2.length, countBefore2 + 1, 'Deve essere stato aggiunto un log per 2FA errato');
    const totpFailLog = logsAfter2[0];
    assert.equal(totpFailLog.eventType, 'totp_failed_operator', 'eventType deve essere totp_failed_operator');
    assert.equal(totpFailLog.status, 'warning', 'status deve essere warning');
    assert.equal(totpFailLog.userEmail, 'c.bianchi@voltagroup.it', 'userEmail deve corrispondere all\'operatore');
    assert.ok(
      totpFailLog.details.includes('Codice 2FA non valido o scaduto'),
      `details deve menzionare codice 2FA non valido: ${totpFailLog.details}`
    );
    console.log('✔ Operator TOTP failure registrato correttamente');

    // -------------------------------------------------------------------------
    // TEST 3: Operator login success
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Operator Login Success Audit Log ---');
    const logsBefore3 = await listSecurityLogs();
    const countBefore3 = logsBefore3.length;

    const opSuccessRes = await fetch(`${baseUrl}/auth/login-operator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'c.bianchi@voltagroup.it',
        password: 'operator123',
        totpCode: '123456'
      })
    });
    assert.equal(opSuccessRes.status, 200, 'Login operatore valido deve dare 200');

    const logsAfter3 = await listSecurityLogs();
    assert.equal(logsAfter3.length, countBefore3 + 1, 'Deve essere stato aggiunto un log per login riuscito');
    const opSuccessLog = logsAfter3[0];
    assert.equal(opSuccessLog.eventType, 'login_success_operator', 'eventType deve essere login_success_operator');
    assert.equal(opSuccessLog.status, 'safe', 'status deve essere safe');
    assert.equal(opSuccessLog.userEmail, 'c.bianchi@voltagroup.it', 'userEmail deve corrispondere all\'operatore');
    console.log('✔ Operator login success registrato correttamente');

    // -------------------------------------------------------------------------
    // TEST 4: Customer login failure
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Customer Login Failure Audit Log ---');
    const logsBefore4 = await listSecurityLogs();
    const countBefore4 = logsBefore4.length;

    const custFailRes = await fetch(`${baseUrl}/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'andrea.moretti@email.it',
        password: 'PasswordClienteErrata!'
      })
    });
    assert.equal(custFailRes.status, 401, 'Login cliente con credenziali errate deve dare 401');

    const logsAfter4 = await listSecurityLogs();
    assert.equal(logsAfter4.length, countBefore4 + 1, 'Deve essere stato aggiunto un log per fallimento login cliente');
    const custFailLog = logsAfter4[0];
    assert.equal(custFailLog.eventType, 'login_failed_customer', 'eventType deve essere login_failed_customer');
    assert.equal(custFailLog.status, 'warning', 'status deve essere warning');
    assert.equal(custFailLog.userEmail, 'andrea.moretti@email.it', 'userEmail deve corrispondere all\'identificatore tentato');
    console.log('✔ Customer login failure registrato correttamente');

    // -------------------------------------------------------------------------
    // TEST 5: Customer login success
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Customer Login Success Audit Log ---');
    const logsBefore5 = await listSecurityLogs();
    const countBefore5 = logsBefore5.length;

    const custSuccessRes = await fetch(`${baseUrl}/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'andrea.moretti@email.it',
        password: 'customer123'
      })
    });
    assert.equal(custSuccessRes.status, 200, 'Login cliente valido deve dare 200');

    const logsAfter5 = await listSecurityLogs();
    assert.equal(logsAfter5.length, countBefore5 + 1, 'Deve essere stato aggiunto un log per login cliente riuscito');
    const custSuccessLog = logsAfter5[0];
    assert.equal(custSuccessLog.eventType, 'login_success_customer', 'eventType deve essere login_success_customer');
    assert.equal(custSuccessLog.status, 'safe', 'status deve essere safe');
    assert.equal(custSuccessLog.userEmail, 'andrea.moretti@email.it', 'userEmail deve corrispondere al cliente');
    console.log('✔ Customer login success registrato correttamente');

    // -------------------------------------------------------------------------
    // TEST 6: RBAC violation in requireRole
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: RBAC Violation Audit Log ---');
    const brokerUser = users.find(u => u.role === 'broker');
    assert.ok(brokerUser, 'Deve esistere un utente broker nei demo users');
    const brokerToken = generateToken({ userId: brokerUser.id, email: brokerUser.email, role: brokerUser.role });

    const logsBefore6 = await listSecurityLogs();
    const countBefore6 = logsBefore6.length;

    const rbacRes = await fetch(`${baseUrl}/admin-restricted`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${brokerToken}`
      }
    });
    assert.equal(rbacRes.status, 403, 'Broker che tenta endpoint admin deve ricevere 403 Forbidden');

    const logsAfter6 = await listSecurityLogs();
    assert.equal(logsAfter6.length, countBefore6 + 1, 'Deve essere stato aggiunto un log per violazione RBAC');
    const rbacLog = logsAfter6[0];
    assert.equal(rbacLog.eventType, 'rbac_violation', 'eventType deve essere rbac_violation');
    assert.equal(rbacLog.status, 'warning', 'status deve essere warning');
    assert.equal(rbacLog.userEmail, brokerUser.email, 'userEmail deve corrispondere all\'utente chiamante');
    assert.ok(
      rbacLog.details.includes('broker') && rbacLog.details.includes('/api/admin-restricted'),
      `details deve indicare il ruolo violatore e l'URL: ${rbacLog.details}`
    );
    console.log('✔ RBAC violation registrato correttamente');

    console.log('\n🎉 ALL SECURITY AUDIT LOGGING TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test suite fallita:', err);
  process.exit(1);
});

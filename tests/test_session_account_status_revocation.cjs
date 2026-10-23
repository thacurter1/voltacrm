const assert = require('node:assert/strict');
const path = require('node:path');

console.log('=== TEST SUITE: SESSION ACCOUNT STATUS REVOCATION (SEC-07) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'session-revocation-test-secret-at-least-32-chars';

const serverDir = path.join(__dirname, '..', 'server');
const reqModule = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = reqModule('express');

const { users } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken, authenticateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { listSecurityLogs } = require(path.join(serverDir, 'dist', 'services', 'operationsService.js'));

async function runTests() {
  const app = express();
  app.use(express.json());

  app.get('/api/test-protected', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
  });

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const targetUser = users.find(u => u.id === 'user-op-2');
  assert.ok(targetUser, 'Utente target user-op-2 deve esistere nel dataStore');
  const originalStatus = targetUser.onboardingStatus;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Utente attivo con token JWT valido ha accesso regolare (HTTP 200)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Accesso regolare con onboardingStatus = active ---');
    targetUser.onboardingStatus = 'active';

    const token = generateToken({
      userId: targetUser.id,
      email: targetUser.email,
      role: targetUser.role
    });

    const activeRes = await fetch(`${baseUrl}/test-protected`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    assert.equal(activeRes.status, 200, 'Utente attivo con token valido deve ricevere 200 OK');
    const activeData = await activeRes.json();
    assert.equal(activeData.success, true);
    assert.equal(activeData.user.userId, targetUser.id);
    console.log('✔ Accesso consentito per utente attivo');

    // -------------------------------------------------------------------------
    // TEST 2: Sospensione immediata dell\'account -> Token valido rifiutato con 403
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Revoca immediata di sessione con onboardingStatus = suspended ---');
    const logsBefore = await listSecurityLogs();
    const countBefore = logsBefore.length;

    // L'account viene sospeso mentre il token JWT emesso in precedenza è ancora temporalmente valido
    targetUser.onboardingStatus = 'suspended';

    const suspendedRes = await fetch(`${baseUrl}/test-protected`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    assert.equal(suspendedRes.status, 403, 'Account sospeso con token valido DEVE ricevere HTTP 403');
    const suspendedData = await suspendedRes.json();
    assert.equal(suspendedData.success, false, 'success deve essere false');
    assert.equal(
      suspendedData.message,
      'Account sospeso. Contattare l’amministratore.',
      `Messaggio atteso: "Account sospeso. Contattare l’amministratore.", ricevuto: "${suspendedData.message}"`
    );

    // Verifica emissione security log
    const logsAfter = await listSecurityLogs();
    assert.equal(logsAfter.length, countBefore + 1, 'Deve essere registrato un evento di security log per account sospeso');
    const securityEvent = logsAfter[0];
    assert.equal(securityEvent.eventType, 'suspended_account_access_attempt', 'eventType deve essere suspended_account_access_attempt');
    assert.equal(securityEvent.userEmail, targetUser.email, 'userEmail deve corrispondere all\'email dell\'utente');
    assert.equal(securityEvent.status, 'warning', 'status deve essere warning');
    assert.equal(securityEvent.details, 'Tentativo di accesso con token valido ma account sospeso');
    console.log('✔ Accesso bloccato con 403 e security log registrato correttamente');

    // -------------------------------------------------------------------------
    // TEST 3: Riattivazione account -> Accesso ripristinato con lo stesso token
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Riattivazione account ripristina accesso ---');
    targetUser.onboardingStatus = 'active';

    const reactivatedRes = await fetch(`${baseUrl}/test-protected`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    assert.equal(reactivatedRes.status, 200, 'Utente riattivato deve poter accedere nuovamente');
    const reactivatedData = await reactivatedRes.json();
    assert.equal(reactivatedData.success, true);
    console.log('✔ Accesso ripristinato dopo riattivazione');

    console.log('\n=== TUTTI I TEST PASSATI CON SUCCESSO ===');
  } finally {
    targetUser.onboardingStatus = originalStatus;
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST FALLITO:', err);
  process.exit(1);
});

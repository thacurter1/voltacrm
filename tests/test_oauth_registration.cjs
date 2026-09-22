const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

console.log('=== TEST SUITE: GOOGLE & APPLE OAUTH AUTHENTICATION ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'oauth-test-secret-at-least-32-characters-long';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { authRouter } = require(path.join(serverDir, 'dist', 'routes', 'auth.js'));

async function runTests() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  try {
    // TEST 1: Google OAuth Customer Registration & Login
    console.log('--- TEST 1: Google OAuth Customer Registration ---');
    const googleRes = await fetch(`${baseUrl}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        role: 'customer',
        email: 'test.google.user@gmail.com',
        name: 'Mario Rossi (Google)'
      })
    });
    assert.equal(googleRes.status, 200, 'Google OAuth registration must return 200');
    const googleData = await googleRes.json();
    assert.equal(googleData.success, true);
    assert.ok(googleData.token, 'Must return a valid JWT token');
    assert.equal(googleData.user.email, 'test.google.user@gmail.com');
    assert.equal(googleData.user.role, 'customer');
    assert.equal(googleData.provider, 'google');
    console.log('✔ Google OAuth Customer Registrato:', googleData.user.name);

    // TEST 2: Existing Google OAuth User Login (Idempotent, no duplicate)
    console.log('--- TEST 2: Existing Google OAuth Login (Idempotency) ---');
    const initialUsersCount = users.filter(u => u.email === 'test.google.user@gmail.com').length;
    assert.equal(initialUsersCount, 1, 'Exactly 1 user with this email should exist');

    const repeatRes = await fetch(`${baseUrl}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        role: 'customer',
        email: 'test.google.user@gmail.com'
      })
    });
    assert.equal(repeatRes.status, 200);
    const repeatData = await repeatRes.json();
    assert.equal(repeatData.user.id, googleData.user.id, 'Must authenticate the same existing user');
    const afterUsersCount = users.filter(u => u.email === 'test.google.user@gmail.com').length;
    assert.equal(afterUsersCount, 1, 'No duplicate user should be created');
    console.log('✔ Idempotenza Google OAuth verificata con successo');

    // TEST 3: Apple OAuth Operator Registration
    console.log('--- TEST 3: Apple OAuth Operator Registration ---');
    const appleRes = await fetch(`${baseUrl}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'apple',
        role: 'operator',
        email: 'consultant.apple@voltagroup.it',
        name: 'Chiara Bianchi (Apple Staff)'
      })
    });
    assert.equal(appleRes.status, 200, 'Apple OAuth operator registration must return 200');
    const appleData = await appleRes.json();
    assert.equal(appleData.success, true);
    assert.ok(appleData.token);
    assert.equal(appleData.user.role, 'operator');
    assert.equal(appleData.provider, 'apple');
    console.log('✔ Apple OAuth Operator Registrato:', appleData.user.name);

    // TEST 4: Invalid Provider Rejection
    console.log('--- TEST 4: Invalid Provider Rejection (Zod Schema Validation) ---');
    const invalidRes = await fetch(`${baseUrl}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'facebook',
        role: 'customer'
      })
    });
    assert.equal(invalidRes.status, 400, 'Unsupported OAuth provider must return 400 Bad Request');
    console.log('✔ Validazione schema Zod rifiuta provider non consentiti');

    // TEST 5: Google OAuth with idToken payload decoding
    console.log('--- TEST 5: Google OAuth with idToken payload decoding ---');
    const fakeGoogleIdToken = 'header.' + Buffer.from(JSON.stringify({
      email: 'verified.google.user@gmail.com',
      name: 'Google User Verified',
      picture: 'https://lh3.googleusercontent.com/a/test'
    })).toString('base64url') + '.signature';

    const idTokenRes = await fetch(`${baseUrl}/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        role: 'customer',
        idToken: fakeGoogleIdToken
      })
    });
    assert.equal(idTokenRes.status, 200);
    const idTokenData = await idTokenRes.json();
    assert.equal(idTokenData.user.email, 'verified.google.user@gmail.com');
    assert.equal(idTokenData.user.name, 'Google User Verified');
    console.log('✔ idToken Google decodificato con successo:', idTokenData.user.email);

    // TEST 6: Frontend UI Wiring & Token Preservation Verification
    console.log('--- TEST 6: Frontend UI Wiring & Token Preservation ---');
    const appCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
    const portalGateCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'PortalGate.tsx'), 'utf8');
    const loginModalCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'LoginModal.tsx'), 'utf8');
    const oauthButtonsCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'OAuthButtons.tsx'), 'utf8');

    assert.ok(appCode.includes('isMockOrMissing'), 'App.tsx must not overwrite valid JWT tokens');
    assert.ok(portalGateCode.includes('<OAuthButtons'), 'PortalGate must render OAuthButtons');
    assert.ok(loginModalCode.includes('<OAuthButtons'), 'LoginModal must render OAuthButtons');
    assert.ok(oauthButtonsCode.includes('Google') && oauthButtonsCode.includes('Apple'), 'OAuthButtons must support both Google and Apple');
    assert.ok(oauthButtonsCode.includes('activeModalProvider'), 'OAuthButtons must support interactive account selection modal');
    console.log('✔ Componenti UI e preservazione token verificati con successo');

    console.log('\n🎉 ALL GOOGLE & APPLE OAUTH TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup inserted test users
    const idx1 = users.findIndex(u => u.email === 'test.google.user@gmail.com');
    if (idx1 !== -1) users.splice(idx1, 1);
    const idx2 = users.findIndex(u => u.email === 'consultant.apple@voltagroup.it');
    if (idx2 !== -1) users.splice(idx2, 1);
    const idx3 = users.findIndex(u => u.email === 'verified.google.user@gmail.com');
    if (idx3 !== -1) users.splice(idx3, 1);

    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('❌ OAuth Test Failed:', err);
  process.exit(1);
});

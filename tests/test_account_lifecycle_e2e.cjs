process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'test-account-lifecycle-secret-at-least-32-chars!!';
process.env.APP_PUBLIC_URL = 'https://voltacrm.vercel.app';

const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

async function run() {
  console.log('=== TEST SUITE: FULL ACCOUNT LIFECYCLE, SESSIONS & RELEASE ID (SECTIONS C, E) ===');

  const dataStore = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
  const emailService = require(path.join(serverDir, 'dist', 'services', 'emailService.js'));
  const tokenService = require(path.join(serverDir, 'dist', 'services', 'authTokenService.js'));
  const { authRouter } = require(path.join(serverDir, 'dist', 'routes', 'auth.js'));
  const { generateToken, authenticateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.get('/api/protected-ping', authenticateToken, (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  emailService.clearTestEmailOutbox();
  tokenService.clearAuthActionTokensForTest();

  const regEmail = `lifecycle.${Date.now()}@example.invalid`;
  const regPassword = 'StrongPassword2026!';
  const newPassword = 'EvenStrongerPassword2026!';
  const changedEmail = `changed.${Date.now()}@example.invalid`;

  try {
    // 1. Registration requires privacyConsent === true and enforces strict CF checksum in non-demo mode
    process.env.VOLTA_DEMO_MODE = 'false';
    const noPrivacyRes = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mario Lifecycle',
        email: regEmail,
        phone: '+39 347 1234567',
        fiscalCode: 'RSSMRA80A01H501U',
        password: regPassword,
      }),
    });
    assert.equal(noPrivacyRes.status, 400, 'Registration without privacyConsent must return 400');

    const badCfRes = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mario Lifecycle',
        email: regEmail,
        phone: '+39 347 1234567',
        fiscalCode: 'MRTNRA82M15F205X', // Fails strict official Italian check digit
        password: regPassword,
        privacyConsent: true,
        marketingConsent: false,
      }),
    });
    assert.equal(badCfRes.status, 400, 'Registration outside demo mode must reject invalid CF check digit');
    process.env.VOLTA_DEMO_MODE = 'true';

    // 2. Successful registration creates pending_verification account, NO JWT token, stores consent metadata, sends email
    const regRes = await fetch(`${baseUrl}/api/auth/register-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mario Lifecycle',
        email: regEmail,
        phone: '+39 347 1234567',
        fiscalCode: 'RSSMRA80A01H501U',
        password: regPassword,
        privacyConsent: true,
        privacyPolicyVersion: 'bozza-2026-11',
        marketingConsent: false,
      }),
    });
    assert.equal(regRes.status, 201, `Expected 201 on registration, got ${regRes.status}`);
    const regBody = await regRes.json();
    assert.equal(regBody.token, undefined, 'Pending verification account must NOT receive active JWT token');
    assert.equal(regBody.requireEmailVerification, true);
    assert.equal(regBody.emailSent, true);
    assert.equal(regBody.user.onboardingStatus, 'pending_verification');
    assert.equal(regBody.user.privacyConsentAccepted, true);
    assert.equal(regBody.user.privacyPolicyVersion, 'bozza-2026-11');
    assert.equal(regBody.user.marketingConsent, false);

    // 3. Cannot log in or call protected route before verifying email
    const preVerifyLogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regEmail, password: regPassword }),
    });
    assert.equal(preVerifyLogin.status, 403, 'Login must fail with 403 before email verification');
    const preVerifyBody = await preVerifyLogin.json();
    assert.equal(preVerifyBody.requireEmailVerification, true);

    // Extract first verification token from outbox
    const outbox1 = emailService.getTestEmailOutbox();
    assert.ok(outbox1.length >= 1);
    const match1 = outbox1[0].text.match(/verifyEmailToken=([A-Za-z0-9_-]+)/);
    assert.ok(match1, 'Verification email must include verifyEmailToken link using allowed APP_PUBLIC_URL');
    assert.ok(outbox1[0].text.startsWith('https://voltacrm.vercel.app') || outbox1[0].text.includes('https://voltacrm.vercel.app'));
    const token1 = match1[1];

    // 4. Resend verification revokes token1 and issues token2
    const resendRes = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail }),
    });
    assert.equal(resendRes.status, 200);
    const outbox2 = emailService.getTestEmailOutbox();
    const match2 = outbox2[0].text.match(/verifyEmailToken=([A-Za-z0-9_-]+)/);
    assert.ok(match2 && match2[1] !== token1, 'Resend must issue new verification token');
    const token2 = match2[1];

    const verifyOldRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token1 }),
    });
    assert.equal(verifyOldRes.status, 400, 'Revoked verification token must fail');

    // Verify with token2 -> succeeds; replay fails
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token2 }),
    });
    assert.equal(verifyRes.status, 200, 'Valid verification token must succeed');

    const replayVerifyRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token2 }),
    });
    assert.equal(replayVerifyRes.status, 400, 'Reused verification token must be rejected');

    // 5. Login succeeds after verification & legacy active account still works seamlessly
    const postVerifyLogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regEmail, password: regPassword }),
    });
    assert.equal(postVerifyLogin.status, 200);
    const postVerifyBody = await postVerifyLogin.json();
    assert.ok(postVerifyBody.token, 'Verified customer login must issue JWT token');
    const initialJwt = postVerifyBody.token;

    const legacyLogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'andrea.moretti@email.it', password: 'customer123' }),
    });
    assert.equal(legacyLogin.status, 200, 'Existing legacy active accounts must remain compatible');

    // 6. Forgot-password does not enumerate non-existent accounts (identical 200 response shape)
    const forgotMissing = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'does-not-exist-anywhere@example.invalid' }),
    });
    const forgotReal = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail }),
    });
    assert.equal(forgotMissing.status, 200);
    assert.equal(forgotReal.status, 200);
    assert.deepEqual(await forgotMissing.json(), await forgotReal.json(), 'Forgot-password response must not enumerate users');

    // Extract reset token & reset password -> revokes old password AND old JWT (initialJwt)
    const resetMail = emailService.getTestEmailOutbox()[0];
    const resetMatch = resetMail.text.match(/resetToken=([A-Za-z0-9_-]+)/);
    assert.ok(resetMatch, 'Reset email must carry resetToken link');
    assert.ok(!resetMail.text.includes(regPassword), 'Email must never contain passwords');
    const resetToken = resetMatch[1];

    const resetRes = await fetch(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password: newPassword }),
    });
    assert.equal(resetRes.status, 200);

    // Old JWT must now be rejected immediately on protected route (tokenVersion bumped!)
    const staleJwtCheck = await fetch(`${baseUrl}/api/protected-ping`, {
      headers: { Authorization: `Bearer ${initialJwt}` },
    });
    assert.equal(staleJwtCheck.status, 403, 'Old JWT issued before password reset must be rejected immediately');

    // Old password rejected, new password accepted
    const oldPassLogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regEmail, password: regPassword }),
    });
    assert.equal(oldPassLogin.status, 401);

    const newPassLogin = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regEmail, password: newPassword }),
    });
    assert.equal(newPassLogin.status, 200);
    const newSessionBody = await newPassLogin.json();
    const freshJwt = newSessionBody.token;

    // 7. Logout-all revokes freshJwt server-side
    const logoutAllRes = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshJwt}` },
    });
    assert.equal(logoutAllRes.status, 200);
    const afterLogoutAllPing = await fetch(`${baseUrl}/api/protected-ping`, {
      headers: { Authorization: `Bearer ${freshJwt}` },
    });
    assert.equal(afterLogoutAllPing.status, 403, 'logout-all must invalidate active JWT server-side');

    // 8. Email change flow requires verification on newEmail before swapping login email
    const loginAgainRes = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regEmail, password: newPassword }),
    });
    const session3Jwt = (await loginAgainRes.json()).token;

    const reqEmailChangeRes = await fetch(`${baseUrl}/api/auth/request-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session3Jwt}` },
      body: JSON.stringify({ newEmail: changedEmail, password: newPassword }),
    });
    assert.equal(reqEmailChangeRes.status, 200);
    const changeMail = emailService.getTestEmailOutbox()[0];
    assert.equal(changeMail.to, changedEmail);
    const changeMatch = changeMail.text.match(/emailChangeToken=([A-Za-z0-9_-]+)/);
    assert.ok(changeMatch);

    const confirmChangeRes = await fetch(`${baseUrl}/api/auth/confirm-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: changeMatch[1] }),
    });
    assert.equal(confirmChangeRes.status, 200);

    const loginWithNewEmail = await fetch(`${baseUrl}/api/auth/login-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: changedEmail, password: newPassword }),
    });
    assert.equal(loginWithNewEmail.status, 200, 'Login with verified new email must succeed');

    // 9. Keep unused generateToken check cleanly and verify /health exposes release.commit non-sensitively
    assert.ok(typeof generateToken === 'function');
    const fs = require('node:fs');
    const indexSrc = fs.readFileSync(path.join(serverDir, 'src', 'index.ts'), 'utf8');
    assert.ok(indexSrc.includes('RELEASE_COMMIT') && indexSrc.includes('buildTimestamp'), '/health must expose non-sensitive release commit & timestamp');

    // 10. Staff invitation returns explicit delivery status when email provider fails (never confuses token with emailSent)
    const dbClient = require(path.join(serverDir, 'dist', 'services', 'dbClient.js'));
    const invitationService = require(path.join(serverDir, 'dist', 'services', 'invitationService.js'));
    const origDbFlag = dbClient.isSupabaseConfigured;
    const origDb = dbClient.supabase;
    dbClient.isSupabaseConfigured = true;
    dbClient.supabase = {
      from: () => ({
        insert: async () => ({ error: null }),
        select: () => ({
          order: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    };
    emailService.configureEmailTestAdapter(async () => {
      throw new Error('550 SMTP unreachable');
    });
    const savedUsers = [...dataStore.users];
    try {
      const staffInvRes = await invitationService.createAccountInvitation(
        { id: 'user-admin-1', name: 'Matteo Riva' },
        { role: 'broker', name: 'Staff Test', email: `staff.${Date.now()}@example.invalid`, phone: '+39 333 1112223' }
      );
      assert.ok(staffInvRes.token, 'Invitation token generated');
      assert.equal(staffInvRes.emailSent, false, 'Failed email send must set emailSent=false');
      assert.ok(staffInvRes.deliveryError, 'Failed email send must surface deliveryError');
    } finally {
      emailService.configureEmailTestAdapter(null);
      dbClient.isSupabaseConfigured = origDbFlag;
      dbClient.supabase = origDb;
      dataStore.users.splice(0, dataStore.users.length, ...savedUsers);
    }

    console.log('✔ ALL ACCOUNT LIFECYCLE TESTS PASSED!');
  } finally {
    const idxU = dataStore.users.findIndex((u) => u.email === regEmail || u.email === changedEmail);
    if (idxU >= 0) {
      const custId = dataStore.users[idxU].customerId;
      dataStore.users.splice(idxU, 1);
      const idxC = dataStore.getCustomers().findIndex((c) => c.id === custId);
      if (idxC >= 0) dataStore.getCustomers().splice(idxC, 1);
    }
    emailService.clearTestEmailOutbox();
    tokenService.clearAuthActionTokensForTest();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

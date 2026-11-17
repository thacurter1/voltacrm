const assert = require('node:assert/strict');
const path = require('node:path');

async function run() {
  console.log('=== TEST SUITE: EMAIL SERVICE & OFFICIAL ITALIAN CF/VAT VALIDATION ===');

  const serverDist = path.join(__dirname, '..', 'server', 'dist');
  const {
    normalizeFiscalCode,
    validateItalianFiscalCodeOrVat,
    shouldEnforceStrictFiscalChecksum,
  } = require(path.join(serverDist, 'utils', 'fiscalCode.js'));

  const {
    sendTransactionalEmail,
    configureEmailTestAdapter,
    getTestEmailOutbox,
    clearTestEmailOutbox,
  } = require(path.join(serverDist, 'services', 'emailService.js'));

  // 1. CF / P.IVA normalization & checksum math
  assert.equal(normalizeFiscalCode(' rssmra80a01h501u '), 'RSSMRA80A01H501U');
  assert.deepEqual(validateItalianFiscalCodeOrVat('rssmra80a01h501u'), { valid: true, kind: 'cf', normalized: 'RSSMRA80A01H501U' });
  assert.deepEqual(validateItalianFiscalCodeOrVat('RSSMRA80A01H50MM'), { valid: true, kind: 'cf', normalized: 'RSSMRA80A01H50MM' });
  assert.equal(validateItalianFiscalCodeOrVat('MRTNRA82M15F205X').valid, false, 'Invalid CF check digit must fail');
  assert.equal(validateItalianFiscalCodeOrVat('RSSMRA80A01H501T').valid, false, 'Wrong CF check letter must fail');
  assert.deepEqual(validateItalianFiscalCodeOrVat('01114601006'), { valid: true, kind: 'piva', normalized: '01114601006' });
  assert.deepEqual(validateItalianFiscalCodeOrVat('00743110157'), { valid: true, kind: 'piva', normalized: '00743110157' });
  assert.equal(validateItalianFiscalCodeOrVat('09876540152').valid, false, 'Invalid P.IVA check digit must fail');
  assert.equal(validateItalianFiscalCodeOrVat('00000000000').valid, false, 'All-zero P.IVA must fail');
  assert.equal(validateItalianFiscalCodeOrVat('SHORT').valid, false);

  const prevDemo = process.env.VOLTA_DEMO_MODE;
  process.env.VOLTA_DEMO_MODE = 'false';
  assert.equal(shouldEnforceStrictFiscalChecksum(), true);
  process.env.VOLTA_DEMO_MODE = 'true';
  assert.equal(shouldEnforceStrictFiscalChecksum(), false);
  process.env.VOLTA_DEMO_MODE = prevDemo;

  // 2. Email service: fails honestly in production when unconfigured
  const prevNodeEnv = process.env.NODE_ENV;
  const prevProvider = process.env.EMAIL_PROVIDER;
  process.env.NODE_ENV = 'production';
  process.env.VOLTA_DEMO_MODE = 'false';
  delete process.env.EMAIL_PROVIDER;
  configureEmailTestAdapter(null);

  const unconfiguredResult = await sendTransactionalEmail({
    to: 'cliente@example.invalid',
    subject: 'Verifica account',
    text: 'Test body senza segreti',
  });
  assert.equal(unconfiguredResult.sent, false, 'Unconfigured production email provider MUST return sent=false');
  assert.ok(unconfiguredResult.error, 'Unconfigured provider must explain failure');

  // 3. Email adapter retries transient failures (max 2 retries = 3 attempts) and never logs secret tokens
  process.env.NODE_ENV = 'test';
  let attempts = 0;
  const loggedLines = [];
  const origError = console.error;
  const origLog = console.log;
  console.error = (...args) => loggedLines.push(args.join(' '));
  console.log = (...args) => loggedLines.push(args.join(' '));
  try {
    configureEmailTestAdapter(async (msg) => {
      attempts++;
      if (attempts < 2) {
        const err = new Error('SMTP temporary timeout 503');
        err.transient = true;
        throw err;
      }
      return { messageId: `msg-test-${attempts}`, accepted: [msg.to] };
    });
    clearTestEmailOutbox();
    const secretToken = 'SECRET_RAW_TOKEN_MUST_NOT_BE_LOGGED_123456';
    const retryRes = await sendTransactionalEmail({
      to: 'cliente@example.invalid',
      subject: 'Verifica indirizzo',
      text: `Apri https://voltacrm.vercel.app/?verifyEmailToken=${secretToken}`,
    });
    assert.equal(retryRes.sent, true);
    assert.equal(attempts, 2, 'Email adapter must retry transient error');
    assert.equal(getTestEmailOutbox().length, 1);

    // Exhausted failure must not throw unhandled and must return sent=false
    configureEmailTestAdapter(async () => {
      const err = new Error('550 Permanent mailbox failure');
      err.transient = true;
      throw err;
    });
    const failedRes = await sendTransactionalEmail({
      to: 'bad@example.invalid',
      subject: 'Reset password',
      text: `Link https://voltacrm.vercel.app/?resetToken=${secretToken}`,
    });
    assert.equal(failedRes.sent, false);
    assert.ok(failedRes.error.includes('550'));
    assert.ok(
      !loggedLines.some((line) => line.includes(secretToken)),
      'Logs must NEVER leak raw tokens or links'
    );
  } finally {
    console.error = origError;
    console.log = origLog;
    configureEmailTestAdapter(null);
    process.env.NODE_ENV = prevNodeEnv;
    process.env.VOLTA_DEMO_MODE = prevDemo;
    if (prevProvider !== undefined) process.env.EMAIL_PROVIDER = prevProvider;
    else delete process.env.EMAIL_PROVIDER;
  }

  console.log('✔ ALL EMAIL & FISCAL VALIDATION TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

async function run() {
  console.log('=== TEST SUITE: MIGRATION 20261117 & AUTH ACTION TOKEN SERVICE ===');

  const rootDir = path.join(__dirname, '..');
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20261117_01_account_lifecycle_and_tokens.sql');
  const schemaPath = path.join(rootDir, 'supabase', 'schema.sql');

  assert.ok(fs.existsSync(migrationPath), 'Migration 20261117_01_account_lifecycle_and_tokens.sql must exist');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  for (const [label, sql] of [['migration', migrationSql], ['schema.sql', schemaSql]]) {
    assert.ok(sql.includes('auth_action_tokens'), `${label} must define auth_action_tokens`);
    assert.ok(sql.includes('token_version'), `${label} must include token_version on crm_accounts`);
    assert.ok(sql.includes('email_verified'), `${label} must include email_verified on crm_accounts`);
    assert.ok(sql.includes('claim_token_hash'), `${label} must include claim_token_hash on portal_bills/leads`);
    assert.ok(sql.includes('customers_fiscal_code_unique'), `${label} must include partial unique index customers_fiscal_code_unique`);
    assert.ok(sql.includes('needs_info'), `${label} must allow needs_info bill status`);
    assert.ok(sql.includes('support_request'), `${label} must allow support_request lead source`);
    for (const fnName of [
      'consume_auth_action_token',
      'complete_email_verification',
      'complete_password_reset',
      'bump_account_token_version',
      'confirm_account_email_change',
      'claim_guest_bill_with_token',
    ]) {
      assert.ok(sql.includes(fnName), `${label} must define RPC ${fnName}`);
      assert.ok(
        new RegExp(`revoke all on function public\\.${fnName}[^;]+from public,\\s*anon,\\s*authenticated`, 'i').test(sql),
        `${label} must revoke execute from public, anon, authenticated on ${fnName}`
      );
      assert.ok(
        new RegExp(`grant execute on function public\\.${fnName}[^;]+to service_role`, 'i').test(sql),
        `${label} must grant execute to service_role on ${fnName}`
      );
    }
  }

  // Test authTokenService atomic behavior
  const {
    issueAuthActionToken,
    consumeAuthActionToken,
    listAccountTokensForTest,
    clearAuthActionTokensForTest,
  } = require(path.join(rootDir, 'server', 'dist', 'services', 'authTokenService.js'));

  clearAuthActionTokensForTest();

  const issued1 = await issueAuthActionToken({
    accountId: 'acc-test-1',
    purpose: 'verify_email',
    targetEmail: 'user@example.invalid',
    ttlMs: 60_000,
  });
  assert.ok(/^[A-Za-z0-9_-]{43,}$/.test(issued1.rawToken), 'Issued token must be >= 256-bit base64url');
  const expectedHash = crypto.createHash('sha256').update(issued1.rawToken).digest('hex');
  const stored1 = listAccountTokensForTest('acc-test-1');
  assert.equal(stored1.length, 1);
  assert.equal(stored1[0].tokenHash, expectedHash, 'Only SHA-256 digest may be stored');
  assert.equal(JSON.stringify(stored1[0]).includes(issued1.rawToken), false, 'Raw token must never be persisted');

  // Re-issuing verify_email revokes prior active verify_email token
  const issued2 = await issueAuthActionToken({
    accountId: 'acc-test-1',
    purpose: 'verify_email',
    targetEmail: 'user@example.invalid',
    ttlMs: 60_000,
    revokePrevious: true,
  });
  await assert.rejects(
    () => consumeAuthActionToken({ rawToken: issued1.rawToken, purpose: 'verify_email' }),
    /non valido|revocato|scaduto/i,
    'Previously issued token must fail once superseded'
  );

  // Wrong purpose must reject
  await assert.rejects(
    () => consumeAuthActionToken({ rawToken: issued2.rawToken, purpose: 'reset_password' }),
    /non valido|revocato|scaduto/i
  );

  // Valid single-use consumption succeeds once and rejects second attempt
  const consumed = await consumeAuthActionToken({ rawToken: issued2.rawToken, purpose: 'verify_email' });
  assert.equal(consumed.accountId, 'acc-test-1');
  assert.equal(consumed.targetEmail, 'user@example.invalid');

  await assert.rejects(
    () => consumeAuthActionToken({ rawToken: issued2.rawToken, purpose: 'verify_email' }),
    /non valido|già utilizzato|scaduto/i,
    'Single-use token must reject replay'
  );

  // Expired token rejects
  const expired = await issueAuthActionToken({
    accountId: 'acc-test-1',
    purpose: 'reset_password',
    ttlMs: -1000,
  });
  await assert.rejects(
    () => consumeAuthActionToken({ rawToken: expired.rawToken, purpose: 'reset_password' }),
    /non valido|scaduto/i,
    'Expired token must reject'
  );

  clearAuthActionTokensForTest();
  console.log('✔ ALL MIGRATION 20261117 & TOKEN STORE TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

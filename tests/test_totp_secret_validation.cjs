const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running TOTP Secret Validation Hardening Suite (SEC-03)...');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// 1. Test runtimeConfig.ts logic
const runtimeConfigCode = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'src', 'services', 'runtimeConfig.ts'),
  'utf8'
);

test('runtimeConfig.ts: must explicitly forbid RFC 3548 / Google Authenticator example seed (JBSWY3DPEHPK3PXP)', () => {
  assert.ok(
    runtimeConfigCode.includes('JBSWY3DPEHPK3PXP'),
    'runtimeConfig.ts must explicitly check and forbid the JBSWY3DPEHPK3PXP documentation test seed'
  );
});

// 2. Test verify_production_readiness.cjs logic
const verifyScriptCode = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'verify_production_readiness.cjs'),
  'utf8'
);

test('verify_production_readiness.cjs: must explicitly forbid RFC 3548 example seed (JBSWY3DPEHPK3PXP)', () => {
  assert.ok(
    verifyScriptCode.includes('JBSWY3DPEHPK3PXP'),
    'verify_production_readiness.cjs must explicitly check and forbid the JBSWY3DPEHPK3PXP documentation test seed'
  );
});

// 3. Test that server/.env does NOT contain the public default RFC seed
const envPath = path.join(__dirname, '..', 'server', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  test('server/.env: must NOT contain the public default RFC 2FA seed', () => {
    assert.strictEqual(
      envContent.includes('JBSWY3DPEHPK3PXP'),
      false,
      'server/.env must NOT contain JBSWY3DPEHPK3PXP'
    );
  });
}

// 4. Test that docs/DEPLOYMENT_GUIDE.md and server/.env.production.example do not suggest JBSWY3DPEHPK3PXP as a valid copy-paste secret
const deploymentGuide = fs.readFileSync(path.join(__dirname, '..', 'docs', 'DEPLOYMENT_GUIDE.md'), 'utf8');
test('docs/DEPLOYMENT_GUIDE.md: must instruct generating a random 2FA secret instead of copy-pasting JBSWY3DPEHPK3PXP', () => {
  assert.strictEqual(
    deploymentGuide.includes('ADMIN_2FA_SECRET="JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"'),
    false,
    'docs/DEPLOYMENT_GUIDE.md must not provide JBSWY3DPEHPK3PXP as a production-ready secret'
  );
});

console.log(`\n📊 TOTP Secret Validation Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

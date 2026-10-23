const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Operator 2FA Configuration Suite (SEC-11)...');

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

// 1. Check runtimeConfig.ts requirements
const runtimeConfigCode = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'src', 'services', 'runtimeConfig.ts'),
  'utf8'
);

test('runtimeConfig.ts: must validate OPERATOR_2FA_SECRET', () => {
  assert.ok(
    runtimeConfigCode.includes('OPERATOR_2FA_SECRET'),
    'runtimeConfig.ts must check and validate OPERATOR_2FA_SECRET'
  );
});

// 2. Check verify_production_readiness.cjs requirements
const verifyScriptCode = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'verify_production_readiness.cjs'),
  'utf8'
);

test('verify_production_readiness.cjs: must validate OPERATOR_2FA_SECRET', () => {
  assert.ok(
    verifyScriptCode.includes('OPERATOR_2FA_SECRET'),
    'verify_production_readiness.cjs must check and validate OPERATOR_2FA_SECRET'
  );
});

// 3. Check server/.env requirements
const envPath = path.join(__dirname, '..', 'server', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  test('server/.env: must define distinct OPERATOR_2FA_SECRET', () => {
    assert.ok(
      envContent.includes('OPERATOR_2FA_SECRET='),
      'server/.env must define OPERATOR_2FA_SECRET'
    );
    const adminMatch = envContent.match(/ADMIN_2FA_SECRET=([^\r\n]+)/);
    const opMatch = envContent.match(/OPERATOR_2FA_SECRET=([^\r\n]+)/);
    if (adminMatch && opMatch) {
      assert.notStrictEqual(
        adminMatch[1].trim(),
        opMatch[1].trim(),
        'OPERATOR_2FA_SECRET must NOT equal ADMIN_2FA_SECRET'
      );
      assert.ok(opMatch[1].trim().length >= 20, 'OPERATOR_2FA_SECRET must be at least 20 chars');
      assert.strictEqual(opMatch[1].trim().includes('VOLTA_'), false, 'No VOLTA_ prefix');
      assert.strictEqual(opMatch[1].trim().includes('JBSWY3DPEHPK3PXP'), false, 'No RFC default seed');
    }
  });
}

// 4. Check documentation
const deploymentGuide = fs.readFileSync(path.join(__dirname, '..', 'docs', 'DEPLOYMENT_GUIDE.md'), 'utf8');
test('docs/DEPLOYMENT_GUIDE.md: must document OPERATOR_2FA_SECRET', () => {
  assert.ok(
    deploymentGuide.includes('OPERATOR_2FA_SECRET'),
    'docs/DEPLOYMENT_GUIDE.md must document OPERATOR_2FA_SECRET'
  );
});

console.log(`\n📊 Operator 2FA Configuration Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

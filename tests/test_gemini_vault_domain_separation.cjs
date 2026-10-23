const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Gemini Vault Cryptographic Domain Separation Suite (SEC-05)...');

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

// 1. Check secretVault.ts code requirements
const secretVaultCode = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'src', 'services', 'secretVault.ts'),
  'utf8'
);

test('secretVault.ts: must explicitly forbid reusing JWT_SECRET as GEMINI_VAULT_SECRET outside demo mode', () => {
  const hasDomainSeparation =
    secretVaultCode.includes('GEMINI_VAULT_SECRET ===') ||
    secretVaultCode.includes('=== process.env.JWT_SECRET') ||
    secretVaultCode.includes('separazione crittografica');
  assert.ok(
    hasDomainSeparation,
    'secretVault.ts must enforce domain separation between GEMINI_VAULT_SECRET and JWT_SECRET'
  );
});

// 2. Check runtimeConfig.ts requirements
const runtimeConfigCode = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'src', 'services', 'runtimeConfig.ts'),
  'utf8'
);

test('runtimeConfig.ts: must validate GEMINI_VAULT_SECRET when encrypted key is configured', () => {
  assert.ok(
    runtimeConfigCode.includes('GEMINI_VAULT_SECRET'),
    'runtimeConfig.ts must require and validate GEMINI_VAULT_SECRET'
  );
});

// 3. Check verify_production_readiness.cjs requirements
const verifyScriptCode = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'verify_production_readiness.cjs'),
  'utf8'
);

test('verify_production_readiness.cjs: must validate GEMINI_VAULT_SECRET', () => {
  assert.ok(
    verifyScriptCode.includes('GEMINI_VAULT_SECRET'),
    'verify_production_readiness.cjs must check GEMINI_VAULT_SECRET'
  );
});

// 4. Check server/.env requirements
const envPath = path.join(__dirname, '..', 'server', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  test('server/.env: must define distinct GEMINI_VAULT_SECRET', () => {
    assert.ok(
      envContent.includes('GEMINI_VAULT_SECRET='),
      'server/.env must define GEMINI_VAULT_SECRET'
    );
    const jwtMatch = envContent.match(/JWT_SECRET=([^\r\n]+)/);
    const vaultMatch = envContent.match(/GEMINI_VAULT_SECRET=([^\r\n]+)/);
    if (jwtMatch && vaultMatch) {
      assert.notStrictEqual(
        jwtMatch[1].trim(),
        vaultMatch[1].trim(),
        'GEMINI_VAULT_SECRET must NOT equal JWT_SECRET'
      );
    }
  });
}

console.log(`\n📊 Gemini Vault Domain Separation Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

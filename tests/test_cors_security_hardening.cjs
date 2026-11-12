const assert = require('assert');

console.log('🧪 Running CORS Security Hardening Suite (SEC-01)...');

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

const fs = require('fs');
const path = require('path');
const serverIndexCode = fs.readFileSync(path.join(__dirname, '..', 'server', 'src', 'index.ts'), 'utf8');

// Function to test the actual server/src/index.ts implementation
function extractServerCorsChecker() {
  // Extract the function body between `cors({` and `})` in server/src/index.ts
  const match = serverIndexCode.match(/cors\(\{\s*origin:\s*\(([^)]+)\)\s*=>\s*\{([\s\S]*?)\},\s*methods:/);
  if (!match) throw new Error('Could not find cors origin handler in server/src/index.ts');
  const body = match[2];
  
  // Reconstruct runner
  const fn = new Function('allowedOrigins', `
    return function(origin, callback) {
      ${body}
    }
  `);
  return fn;
}

const configuredAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://clienti.localhost:5173',
  'http://cliente.localhost:5173',
  'http://staff.localhost:5173',
  'http://crm.localhost:5173',
  'https://voltagroup.it',
  'https://clienti.voltagroup.it',
  'https://staff.voltagroup.it',
  'https://crm.voltagroup.it',
  'https://voltacrm.vercel.app'
];

const checkServerOrigin = extractServerCorsChecker()(configuredAllowedOrigins);

function isServerOriginAllowed(origin) {
  let allowed = false;
  checkServerOrigin(origin, (err, result) => {
    if (!err && result === true) allowed = true;
  });
  return allowed;
}

// 1. Legitimate origins MUST be allowed
test('Legitimate localhost and *.localhost origins allowed', () => {
  assert.strictEqual(isServerOriginAllowed('http://localhost:5173'), true);
  assert.strictEqual(isServerOriginAllowed('http://clienti.localhost:5173'), true);
  assert.strictEqual(isServerOriginAllowed('http://staff.localhost:5173'), true);
});

test('Legitimate production domain and subdomains allowed', () => {
  assert.strictEqual(isServerOriginAllowed('https://voltagroup.it'), true);
  assert.strictEqual(isServerOriginAllowed('https://clienti.voltagroup.it'), true);
  assert.strictEqual(isServerOriginAllowed('https://staff.voltagroup.it'), true);
  assert.strictEqual(isServerOriginAllowed('https://crm.voltagroup.it'), true);
});

// 2. Malicious origins MUST be rejected
test('Malicious domain starting with clienti- MUST be rejected', () => {
  assert.strictEqual(isServerOriginAllowed('https://clienti-attacker.com'), false, 'clienti-attacker.com must NOT be allowed');
  assert.strictEqual(isServerOriginAllowed('https://clienti-evil.org'), false, 'clienti-evil.org must NOT be allowed');
});

test('Malicious domain starting with staff- MUST be rejected', () => {
  assert.strictEqual(isServerOriginAllowed('https://staff-phishing.net'), false, 'staff-phishing.net must NOT be allowed');
  assert.strictEqual(isServerOriginAllowed('https://staff-hacker.com'), false, 'staff-hacker.com must NOT be allowed');
});

test('Malicious domain starting with crm- MUST be rejected', () => {
  assert.strictEqual(isServerOriginAllowed('https://crm-rogue.it'), false, 'crm-rogue.it must NOT be allowed');
});

test('Arbitrary domains MUST be rejected', () => {
  assert.strictEqual(isServerOriginAllowed('https://random-site.com'), false);
  assert.strictEqual(isServerOriginAllowed('https://attacker.voltagroup.it.evil.com'), false);
});

test('Vercel preview subdomains must match project slug (CODE-03)', () => {
  assert.strictEqual(isServerOriginAllowed('https://clienti-voltacrm.vercel.app'), true);
  assert.strictEqual(isServerOriginAllowed('https://staff-voltacrm.vercel.app'), true);
  assert.strictEqual(isServerOriginAllowed('https://clienti-attacker.vercel.app'), false, 'Unrelated vercel.app project must NOT be allowed');
  assert.strictEqual(isServerOriginAllowed('https://staff-evil.vercel.app'), false, 'Unrelated vercel.app project must NOT be allowed');
});

console.log(`\n📊 CORS Security Hardening Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

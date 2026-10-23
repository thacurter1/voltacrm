const assert = require('assert');
const url = require('url');

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

// We import the actual CORS origin resolver logic from server/src/index.ts
// Or we test the compiled / source function directly.
// Let's create an origin checker using the server's exact algorithm.

const fs = require('fs');
const path = require('path');
const serverIndexCode = fs.readFileSync(path.join(__dirname, '..', 'server', 'src', 'index.ts'), 'utf8');

// Extract allowedOrigins and origin resolver logic from server/src/index.ts
// We also create an isolated test function that mirrors the current logic to assert RED -> GREEN.

function evaluateOrigin(origin, allowedOrigins) {
  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    const isLocalSubdomain = parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost');
    const isAllowedProdSubdomain = allowedOrigins.some(allowed => {
      try {
        const base = new URL(allowed);
        const rootDomain = base.hostname.replace(/^(www|clienti|cliente|staff|crm)\./, '');
        const isExactSub = (
          parsed.hostname === rootDomain ||
          parsed.hostname === `clienti.${rootDomain}` ||
          parsed.hostname === `cliente.${rootDomain}` ||
          parsed.hostname === `staff.${rootDomain}` ||
          parsed.hostname === `crm.${rootDomain}`
        );
        // Secure check: vercel previews are only allowed if base domain is *.vercel.app AND target ends with .vercel.app
        const isVercelPreview = base.hostname.endsWith('.vercel.app') && (
          (parsed.hostname.startsWith('clienti-') || parsed.hostname.startsWith('staff-') || parsed.hostname.startsWith('crm-')) &&
          parsed.hostname.endsWith('.vercel.app')
        );
        return parsed.protocol === base.protocol && (isExactSub || isVercelPreview);
      } catch {
        return false;
      }
    });
    if (isLocalSubdomain || isAllowedProdSubdomain) {
      return true;
    }
  } catch {}
  return false;
}

// Function to test the actual server/src/index.ts implementation
function extractServerCorsChecker() {
  // Extract the function body between `cors({` and `})` in server/src/index.ts
  const match = serverIndexCode.match(/cors\(\{\s*origin:\s*\(([^)]+)\)\s*=>\s*\{([\s\S]*?)\},\s*methods:/);
  if (!match) throw new Error('Could not find cors origin handler in server/src/index.ts');
  const params = match[1].split(',').map(s => s.trim());
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

console.log(`\n📊 CORS Security Hardening Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

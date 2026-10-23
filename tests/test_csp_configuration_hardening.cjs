process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: CSP CONFIGURATION HARDENING IN VERCEL.JSON (SEC-10) ===');

const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
assert.ok(fs.existsSync(vercelJsonPath), 'vercel.json must exist');

const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
assert.ok(Array.isArray(vercelConfig.headers), 'vercel.json must have headers array');

const globalHeaderGroup = vercelConfig.headers.find(h => h.source === '/(.*)');
assert.ok(globalHeaderGroup, 'Global headers for /(.*) must be present');
assert.ok(Array.isArray(globalHeaderGroup.headers), 'Global headers must contain a headers array');

const cspHeader = globalHeaderGroup.headers.find(h => h.key === 'Content-Security-Policy');
assert.ok(cspHeader, 'Content-Security-Policy header must be defined');

const cspValue = cspHeader.value;
assert.ok(typeof cspValue === 'string' && cspValue.length > 0, 'CSP header value must be a non-empty string');

// Parse CSP directives into a map: directiveName -> array of tokens
const directives = {};
cspValue.split(';').forEach(directiveStr => {
  const trimmed = directiveStr.trim();
  if (!trimmed) return;
  const parts = trimmed.split(/\s+/);
  const name = parts[0];
  const values = parts.slice(1);
  directives[name] = values;
});

assert.ok(directives['connect-src'], "CSP must have 'connect-src' directive");
const connectSrc = directives['connect-src'];

console.log('\n[TEST 1] connect-src must not allow localhost or local IP variations');
const forbiddenLocalPatterns = ['localhost', '127.0.0.1'];
for (const token of connectSrc) {
  for (const forbidden of forbiddenLocalPatterns) {
    assert.ok(
      !token.includes(forbidden),
      `connect-src must NOT contain '${token}' (forbidden pattern: '${forbidden}')`
    );
  }
}
console.log('✔ connect-src does not contain localhost or 127.0.0.1');

console.log('\n[TEST 2] connect-src must not allow generativelanguage.googleapis.com (backend only)');
assert.ok(
  !connectSrc.some(token => token.includes('generativelanguage.googleapis.com')),
  'connect-src must NOT allow client-side calls to generativelanguage.googleapis.com'
);
console.log('✔ connect-src does not allow generativelanguage.googleapis.com');

console.log('\n[TEST 3] connect-src must retain all required production origins');
const requiredOrigins = [
  "'self'",
  'https://*.supabase.co',
  'wss://*.supabase.co',
  'https://accounts.google.com',
  'https://appleid.apple.com',
  'https://*.vercel.app',
  'https://voltacrm-api.onrender.com'
];

for (const origin of requiredOrigins) {
  assert.ok(
    connectSrc.includes(origin),
    `connect-src must contain production origin '${origin}'`
  );
}
console.log('✔ connect-src retains all necessary production origins');

console.log('\n[TEST 4] Baseline CSP security directives must remain intact');
assert.ok(directives['default-src']?.includes("'self'"), "default-src must include 'self'");
assert.ok(directives['object-src']?.includes("'none'"), "object-src must be 'none'");
assert.ok(directives['frame-ancestors']?.includes("'none'"), "frame-ancestors must be 'none'");
assert.ok(directives['base-uri']?.includes("'self'"), "base-uri must include 'self'");
console.log('✔ Baseline security directives are intact');

console.log('\nAll CSP hardening tests passed successfully!');

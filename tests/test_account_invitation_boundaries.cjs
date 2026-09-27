const assert = require('node:assert/strict');
const { validateProductionConfiguration } = require('../server/dist/services/runtimeConfig.js');
const { generateTotp, verifyTotp, generateTotpSecret } = require('../server/dist/utils/totp.js');

const original = { ...process.env };
try {
  Object.assign(process.env, {
    NODE_ENV: 'production', VOLTA_DEMO_MODE: 'false',
    JWT_SECRET: 'a-secure-test-jwt-secret-longer-than-32-characters',
    SUPABASE_URL: 'https://valid-test-project.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_valid_test_key_not_for_network',
    ADMIN_INITIAL_PASSWORD: 'a-test-password-longer-than-12',
    ADMIN_2FA_SECRET: 'a-test-totp-secret-longer-than-20',
    ADMIN_EMAIL: 'admin@test.invalid',
  });
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.TOTEM_KIOSK_API_KEY;
  assert.doesNotThrow(validateProductionConfiguration, 'new secret key must be accepted');

  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_public_key';
  assert.throws(validateProductionConfiguration, /Persistenza Supabase/, 'public key must not authorize backend startup');

  const originalNow = Date.now;
  try {
    Date.now = () => 59000;
    assert.equal(generateTotp('b32:GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), '287082');
    assert.equal(verifyTotp('287082', 'b32:GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'), true);
  } finally { Date.now = originalNow; }
  assert.match(generateTotpSecret(), /^b32:[A-Z2-7]{32}$/);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
}

async function post(path, body, token) {
  const response = await fetch(`http://127.0.0.1:5000/api/auth${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return response.status;
}

(async () => {
  assert.equal(await post('/invitations', { role: 'admin', name: 'Test User', email: 'test@example.com', phone: '' }), 401);
  assert.equal(await post('/invitations/inspect', { token: 'invalid' }), 400);
  assert.equal(await post('/invitations/accept', { token: 'invalid', password: 'long-enough-password' }), 400);
  console.log('Invitation authorization, token validation, Supabase key selection and standard TOTP passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });

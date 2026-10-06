const assert = require('node:assert/strict');
const path = require('node:path');

const { isDemoAllowed, authenticateToken } = require('../server/dist/middleware/auth.js');

// --- 1. Unit Test: isDemoAllowed matrix ---
const origEnv = { ...process.env };

try {
  // Case A: Production with demo=true -> MUST BE FALSE
  process.env.NODE_ENV = 'production';
  process.env.VOLTA_DEMO_MODE = 'true';
  assert.equal(isDemoAllowed(), false, 'isDemoAllowed must be FALSE in production even if VOLTA_DEMO_MODE is true');

  // Case B: Production with demo=false -> MUST BE FALSE
  process.env.NODE_ENV = 'production';
  process.env.VOLTA_DEMO_MODE = 'false';
  assert.equal(isDemoAllowed(), false, 'isDemoAllowed must be FALSE in production');

  // Case C: Development with demo=false -> MUST BE FALSE
  process.env.NODE_ENV = 'development';
  process.env.VOLTA_DEMO_MODE = 'false';
  assert.equal(isDemoAllowed(), false, 'isDemoAllowed must be FALSE when VOLTA_DEMO_MODE is false');

  // Case D: Development with demo=true -> TRUE
  process.env.NODE_ENV = 'development';
  process.env.VOLTA_DEMO_MODE = 'true';
  assert.equal(isDemoAllowed(), true, 'isDemoAllowed must be TRUE in development with VOLTA_DEMO_MODE=true');

  // Case E: Test with demo=true -> TRUE
  process.env.NODE_ENV = 'test';
  process.env.VOLTA_DEMO_MODE = 'true';
  assert.equal(isDemoAllowed(), true, 'isDemoAllowed must be TRUE in test with VOLTA_DEMO_MODE=true');
} finally {
  for (const k of Object.keys(process.env)) {
    if (!(k in origEnv)) delete process.env[k];
  }
  Object.assign(process.env, origEnv);
}

// --- 2. Integration Tests against running test server ---
async function request(endpoint, options = {}) {
  const res = await fetch(`http://127.0.0.1:5000${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  console.log('--- TEST 1: demo-login with valid role succeeds in test environment ---');
  const adminRes = await request('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ role: 'admin' })
  });
  assert.equal(adminRes.status, 200);
  assert.equal(adminRes.data.success, true);
  assert.equal(adminRes.data.user.role, 'admin');
  assert.ok(adminRes.data.token, 'Must return JWT token');

  console.log('--- TEST 2: demo-login with invalid/non-existent role returns 404 (no admin fallback) ---');
  const invalidRes = await request('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ role: 'super_hacker_role', userId: 'non_existent_id' })
  });
  assert.equal(invalidRes.status, 404, 'Must return 404 for unknown demo account');

  console.log('--- TEST 3: mock token for valid user succeeds in demo mode ---');
  const mockMeRes = await request('/api/auth/me', {
    headers: { Authorization: 'Bearer mock-op-token-user-admin-1-9999' }
  });
  assert.equal(mockMeRes.status, 200);
  assert.equal(mockMeRes.data.user.id, 'user-admin-1');

  console.log('--- TEST 4: mock token with fake id is rejected (no fallback to users[0]) ---');
  const fakeMockRes = await request('/api/auth/me', {
    headers: { Authorization: 'Bearer mock-fake-non-existent-user-id-9999' }
  });
  assert.equal(fakeMockRes.status, 403, 'Must reject mock token with unknown user');

  console.log('\n🎉 ALL DEMO SECURITY HARDENING CHECKS PASSED!');
})().catch(err => {
  console.error('Demo security hardening test failed:', err);
  process.exit(1);
});

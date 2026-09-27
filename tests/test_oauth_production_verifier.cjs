const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

process.env.NODE_ENV = 'production';
process.env.GOOGLE_OAUTH_CLIENT_ID = 'voltacrm-google-audit-client';
process.env.APPLE_OAUTH_CLIENT_ID = 'voltacrm-apple-audit-client';

const serverDir = path.join(__dirname, '..', 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const jwt = req('jsonwebtoken');
const { verifyOAuthToken } = require(path.join(serverDir, 'dist', 'services', 'oauthVerifier.js'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'audit-key', use: 'sig', alg: 'RS256' };
const originalFetch = global.fetch;
global.fetch = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) });

function token(provider, payload, options = {}) {
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256', keyid: 'audit-key',
    issuer: provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com',
    audience: provider === 'google' ? process.env.GOOGLE_OAUTH_CLIENT_ID : process.env.APPLE_OAUTH_CLIENT_ID,
    expiresIn: '5m', ...options
  });
}

(async () => {
  const identity = { sub: 'stable-provider-subject', email: 'person@example.com', email_verified: true };
  const google = await verifyOAuthToken('google', token('google', identity));
  assert.equal(google.sub, identity.sub);
  const apple = await verifyOAuthToken('apple', token('apple', { ...identity, email_verified: 'true' }));
  assert.equal(apple.email, identity.email);

  await assert.rejects(verifyOAuthToken('google', token('google', identity, { audience: 'another-app' })), /audience/);
  await assert.rejects(verifyOAuthToken('google', token('google', { ...identity, email_verified: false })), /incompleti/);
  await assert.rejects(verifyOAuthToken('google', token('google', { ...identity, sub: undefined })), /incompleti/);
  await assert.rejects(verifyOAuthToken('apple', token('apple', identity, { audience: 'another-apple-app' })), /audience/);
  console.log('Production OAuth verifier: valid Google/Apple tokens accepted; wrong audience and unverified identity rejected.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'test-vault-master-secret-at-least-32-bytes-long!!';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: GEMINI AES-256-GCM SECRET VAULT & HEADER SECURITY (TDD) ===');

async function run() {
  const vaultPath = path.join(__dirname, '..', 'server', 'dist', 'services', 'secretVault.js');
  assert.ok(fs.existsSync(vaultPath), 'server/dist/services/secretVault.js must exist');

  const {
    encryptSecretEnvelope,
    decryptSecretEnvelopeToBuffer,
    withDecryptedGeminiKey,
  } = require(vaultPath);

  const sampleKey = 'AIzaSyTestKeyForUnitVerification00000001';
  const masterSecret = process.env.JWT_SECRET;

  // 1. Encrypt produces enc:v1:<salt>:<iv>:<tag>:<ciphertext> and never leaks plaintext
  const envelope1 = encryptSecretEnvelope(sampleKey, masterSecret);
  const envelope2 = encryptSecretEnvelope(sampleKey, masterSecret);
  assert.ok(envelope1.startsWith('enc:v1:'), `Envelope must start with enc:v1:, got ${envelope1}`);
  assert.notEqual(envelope1, envelope2, 'Two encryptions of same secret must use distinct random salt/IV');
  assert.ok(!envelope1.includes(sampleKey), 'Envelope must never contain plaintext key');

  // 2. Decrypt to Buffer recovers exact bytes and allows zeroing in RAM
  const buf = decryptSecretEnvelopeToBuffer(envelope1, masterSecret);
  assert.ok(Buffer.isBuffer(buf), 'Decrypted output must be a Buffer');
  assert.equal(buf.toString('utf8'), sampleKey, 'Decrypted Buffer must match original secret');
  buf.fill(0);
  assert.ok(buf.every((byte) => byte === 0), 'Buffer must be zeroed in memory after fill(0)');

  // 3. Tampering with ciphertext or authTag must fail AES-GCM authentication
  const parts = envelope1.split(':');
  const tamperedTag = parts[4].replace(/^[0-9a-f]/i, (ch) => (ch === 'a' ? 'b' : 'a'));
  const tamperedEnvelope = [parts[0], parts[1], parts[2], parts[3], tamperedTag, parts[5]].join(':');
  assert.throws(
    () => decryptSecretEnvelopeToBuffer(tamperedEnvelope, masterSecret),
    /Impossibile decifrare|Unsupported state or unable to authenticate data/i,
    'Tampered AES-GCM envelope must throw authentication error'
  );

  // 4. Wrong master secret must fail AES-GCM authentication
  assert.throws(
    () => decryptSecretEnvelopeToBuffer(envelope1, 'wrong-master-secret-at-least-32-bytes-long!!'),
    /Impossibile decifrare|Unsupported state or unable to authenticate data/i,
    'Wrong master secret must fail decryption'
  );

  // 5. withDecryptedGeminiKey decrypts GEMINI_API_KEY_ENCRYPTED and scrubs any leaked key from errors
  process.env.GEMINI_API_KEY_ENCRYPTED = envelope1;
  delete process.env.GEMINI_API_KEY;

  let capturedKey = null;
  const res = await withDecryptedGeminiKey(async (decryptedKey) => {
    capturedKey = decryptedKey;
    return 'ok';
  });
  assert.equal(res, 'ok');
  assert.equal(capturedKey, sampleKey);

  await assert.rejects(
    async () => {
      await withDecryptedGeminiKey(async (decryptedKey) => {
        throw new Error(`Simulated network error for key=${decryptedKey} on endpoint`);
      });
    },
    (err) => {
      assert.ok(!err.message.includes(sampleKey), 'Thrown error must have raw API key redacted');
      assert.ok(err.message.includes('[REDACTED_SECRET]'), 'Thrown error must replace raw key with [REDACTED_SECRET]');
      return true;
    }
  );

  // 6. Verify geminiOcrService.ts uses x-goog-api-key header and never puts ?key= in URL
  const geminiOcrSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'src', 'services', 'geminiOcrService.ts'),
    'utf8'
  );
  assert.ok(
    !geminiOcrSrc.includes('?key='),
    'geminiOcrService.ts must NOT pass API key in URL query string (?key=)'
  );
  assert.ok(
    geminiOcrSrc.includes('x-goog-api-key'),
    'geminiOcrService.ts must pass API key via x-goog-api-key HTTP header'
  );
  assert.ok(
    geminiOcrSrc.includes('withDecryptedGeminiKey'),
    'geminiOcrService.ts must use withDecryptedGeminiKey from secretVault'
  );

  console.log('✔ ALL GEMINI SECRET VAULT & HEADER SECURITY TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});

const path = require('node:path');
const dotenv = require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const secretVault = require(path.join(__dirname, '..', 'server', 'dist', 'services', 'secretVault.js'));

const rawKey = process.argv[2] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!rawKey) {
  console.error('Uso: node scripts/encrypt_gemini_key.cjs "<raw-api-key>"');
  process.exit(1);
}

const masterSecret = process.env.GEMINI_VAULT_SECRET || process.env.JWT_SECRET;
if (!masterSecret) {
  console.error('Errore: JWT_SECRET o GEMINI_VAULT_SECRET non impostato in server/.env');
  process.exit(1);
}

const encrypted = secretVault.encryptSecretEnvelope(rawKey, masterSecret);
console.log('\n--- PAYLOAD CIFRATO GEMINI (AES-256-GCM) ---');
console.log(`GEMINI_API_KEY_ENCRYPTED=${encrypted}`);
console.log('--------------------------------------------\n');

// Self-verify decryption immediately
const testBuf = secretVault.decryptSecretEnvelopeToBuffer(encrypted, masterSecret);
if (testBuf.toString('utf8') === rawKey.trim()) {
  testBuf.fill(0);
  console.log('✔ Autoverifica decifratura e zeroing RAM riuscita con successo.');
} else {
  testBuf.fill(0);
  console.error('❌ Autoverifica fallita.');
  process.exit(1);
}

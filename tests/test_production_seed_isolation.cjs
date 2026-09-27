const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'production';
process.env.VOLTA_DEMO_MODE = 'false';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.ADMIN_INITIAL_PASSWORD = 'local-audit-password-only';
process.env.ADMIN_2FA_SECRET = 'local-audit-totp-secret-only';

const store = require(path.join(__dirname, '..', 'server', 'dist', 'services', 'dataStore.js'));
assert.deepEqual({ users: store.users.length, leads: store.getLeads().length, customers: store.getCustomers().length },
  { users: 0, leads: 0, customers: 0 });
const { validateProductionConfiguration } = require(path.join(__dirname, '..', 'server', 'dist', 'services', 'runtimeConfig.js'));
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.SUPABASE_URL = 'https://audit-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = crypto.randomBytes(32).toString('hex');
process.env.ADMIN_INITIAL_PASSWORD = crypto.randomBytes(20).toString('hex');
process.env.ADMIN_2FA_SECRET = crypto.randomBytes(20).toString('hex');
process.env.ADMIN_EMAIL = 'audit.admin@volta.invalid';
assert.doesNotThrow(validateProductionConfiguration);
process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
assert.throws(validateProductionConfiguration, /JWT_SECRET/);
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.ADMIN_INITIAL_PASSWORD = 'replace-with-a-unique-password-at-least-12-chars';
assert.throws(validateProductionConfiguration, /ADMIN_INITIAL_PASSWORD/);
console.log('Production startup does not load demo identities, leads or customers.');

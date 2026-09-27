const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://pagination-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_pagination_test_only';
process.env.VOLTA_DEMO_MODE = 'true';

const { supabase } = require('../server/dist/services/dbClient.js');
const store = require('../server/dist/services/dataStore.js');
assert.ok(supabase);

const accounts = Array.from({ length: 1001 }, (_, index) => ({
  id: `paged-user-${String(index).padStart(4, '0')}`,
  email: `paged-${index}@test.invalid`, password_hash: 'unused', role: 'customer',
  customer_id: null, two_factor_secret: null, is_2fa_enabled: false, profile: {},
}));
const calls = [];
supabase.from = table => {
  let cursor = '';
  let limit = 1000;
  const query = {
    select() { return this; },
    order() { return this; },
    limit(value) { limit = value; return this; },
    gt(_column, value) { cursor = value; return this; },
    then(resolve, reject) {
      calls.push({ table, cursor });
      const source = table === 'crm_accounts' ? accounts : [];
      return Promise.resolve({ data: source.filter(row => row.id > cursor).slice(0, limit), error: null }).then(resolve, reject);
    },
  };
  return query;
};

(async () => {
  await store.initDataStore(true);
  assert.ok(store.users.some(user => user.id === 'paged-user-1000'), 'last page must not be truncated');
  assert.equal(calls.filter(call => call.table === 'crm_accounts').length, 2);
  console.log('Data store loads records beyond the Supabase 1000-row page limit.');
})().catch(error => { console.error(error); process.exitCode = 1; });

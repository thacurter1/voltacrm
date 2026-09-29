const assert = require('node:assert/strict');

// A demo process may inherit real backend credentials from its host.
process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.SUPABASE_URL = 'https://demo-isolation-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_demo_isolation_test_only';

const { isSupabaseConfigured, supabase } = require('../server/dist/services/dbClient.js');
assert.equal(isSupabaseConfigured, false, 'demo mode must ignore inherited Supabase credentials');
assert.equal(supabase, null, 'demo mode must not create a Supabase client');
console.log('Demo mode is isolated from inherited Supabase credentials.');

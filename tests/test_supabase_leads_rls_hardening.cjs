const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Supabase Leads RLS Hardening Suite (SEC-04)...');

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

const schemaSqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

// 1. Check schema.sql for any open anon policy on public.leads
test('schema.sql: must NOT contain open anon insert policy on public.leads', () => {
  const hasOpenAnonPolicy = /create\s+policy\s+["'][^"']+["']\s+on\s+public\.leads\s+for\s+insert\s+to\s+[^;]*anon/i.test(schemaSql);
  assert.strictEqual(
    hasOpenAnonPolicy,
    false,
    'schema.sql must NOT contain an open insert policy for anon on public.leads'
  );
});

// 2. Check schema.sql for any grant to anon on public.leads
test('schema.sql: must NOT grant select, insert, or update on public.leads to anon', () => {
  const hasAnonGrant = /grant\s+[^;]+on\s+public\.leads\s+to\s+[^;]*\banon\b/i.test(schemaSql);
  assert.strictEqual(
    hasAnonGrant,
    false,
    'schema.sql must NOT grant permissions on public.leads to anon'
  );
});

// 3. Check that a hardening migration exists in supabase/migrations
test('migrations: must contain dedicated migration revoking anon access on public.leads', () => {
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir);
  const found = files.some(file => {
    if (!file.endsWith('.sql')) return false;
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    return (
      content.includes('revoke all on public.leads from anon') ||
      (content.includes('revoke all on table public.leads from anon') ||
       (content.includes('drop policy if exists') && content.includes('public.leads') && content.includes('anon')))
    );
  });
  assert.strictEqual(
    found,
    true,
    'A migration must exist that drops open anon policies and revokes all on public.leads from anon'
  );
});

console.log(`\n📊 Supabase Leads RLS Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

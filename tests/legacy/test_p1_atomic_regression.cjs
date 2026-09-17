const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

async function main() {
  const db = require('./server/dist/services/dbClient.js');
  const signatures = require('./server/dist/services/signatureService.js');
  assert.equal(typeof signatures.activateSignedSignatureWithCommissions, 'function', 'atomic activation service must exist');

  const calls = [];
  db.isSupabaseConfigured = true;
  db.supabase = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: {
          signatureReceipt: { id: 'sig-p1', status: 'activated' },
          commissions: { records: [{ id: 'comm-p1' }], totalEur: 45 },
        },
        error: null,
      };
    },
  };
  try {
    const result = await signatures.activateSignedSignatureWithCommissions({
      signatureId: 'sig-p1', confirmationReference: 'DIST-P1', activationDate: '2026-09-17', activatedBy: 'admin-p1',
      agentId: 'agent-p1', agentName: 'Agent P1', customerName: 'Customer P1', podOrPdr: 'IT001EP1',
      utilityType: 'luce', customerType: 'residential', annualConsumption: 2500, isDualFuel: false,
    });
    assert.equal(calls.length, 1, 'activation and commission generation must use one database transaction RPC');
    assert.equal(calls[0].name, 'activate_signature_with_commissions');
    assert.equal(result.commissions.totalEur, 45);
  } finally {
    db.isSupabaseConfigured = false;
    db.supabase = null;
  }

  const migration = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20260917_01_p1_atomic_activation.sql'), 'utf8');
  assert.match(migration, /activate_signed_signature\s*\(/i);
  assert.match(migration, /generate_contract_commissions\s*\(/i);
  console.log('P1 atomic activation regression tests passed.');
}

main().catch(error => { console.error(error); process.exit(1); });

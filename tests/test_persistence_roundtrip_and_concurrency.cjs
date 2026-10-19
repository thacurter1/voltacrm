const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://persistence-roundtrip-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_persistence_roundtrip_test';
process.env.VOLTA_DEMO_MODE = 'false';
process.env.JWT_SECRET = 'persistence-roundtrip-jwt-secret-at-least-32-chars';

console.log('=== TEST SUITE: PERSISTENCE ROUND-TRIP, CONCURRENCY & VALIDATOR (TDD) ===');

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { supabase } = require('../server/dist/services/dbClient.js');
const store = require('../server/dist/services/dataStore.js');
const { triggerNotificationSchema } = require('../server/dist/middleware/validate.js');
const { portalRouter } = require('../server/dist/routes/portal.js');

assert.ok(supabase, 'Supabase client must be initialized for I/O boundary test');

// Synthetic PostgreSQL tables at the Supabase I/O boundary
const dbTables = {
  leads: [],
  customers: [],
  signature_logs: [],
  notifications: [],
  crm_accounts: [
    {
      id: 'user-op-2',
      email: 'l.bianchi@voltagroup.it',
      password_hash: 'unused',
      role: 'operator',
      customer_id: null,
      two_factor_secret: null,
      is_2fa_enabled: true,
      profile: { id: 'user-op-2', name: 'Laura Bianchi', email: 'l.bianchi@voltagroup.it', role: 'operator' },
    },
  ],
};

supabase.rpc = async (fnName, params) => {
  if (fnName === 'append_notification_reader') {
    const ids = params.p_ids || [];
    const userId = params.p_user_id;
    for (const row of dbTables.notifications) {
      if (ids.includes(row.id)) {
        const current = Array.isArray(row.read_by) ? row.read_by : [];
        if (userId && !current.includes(userId)) {
          row.read_by = [...current, userId];
        }
        if (row.target_user_id || row.target_customer_id || row.meta?.customerId) {
          row.is_read = true;
        }
      }
    }
    return { data: null, error: null };
  }
  return { data: null, error: null };
};

supabase.from = (table) => {
  if (!dbTables[table]) dbTables[table] = [];
  let cursor = '';
  let limit = 1000;
  let filterInIds = null;
  let filterEqCol = null;
  let filterEqVal = null;
  let pendingUpdate = null;

  const query = {
    select() {
      return this;
    },
    order() {
      return this;
    },
    limit(v) {
      limit = v;
      return this;
    },
    gt(_col, v) {
      cursor = v;
      return this;
    },
    in(col, vals) {
      if (col === 'id') filterInIds = vals;
      if (pendingUpdate) {
        for (const row of dbTables[table]) {
          if (vals.includes(row.id)) Object.assign(row, structuredClone(pendingUpdate));
        }
        return Promise.resolve({ data: null, error: null });
      }
      return this;
    },
    eq(col, val) {
      filterEqCol = col;
      filterEqVal = val;
      if (pendingUpdate) {
        for (const row of dbTables[table]) {
          if (row[col] === val) Object.assign(row, structuredClone(pendingUpdate));
        }
        return Promise.resolve({ data: null, error: null });
      }
      return this;
    },
    async insert(rows) {
      // Simulate slight async DB I/O delay to expose race conditions
      await new Promise((r) => setTimeout(r, 15));
      const items = Array.isArray(rows) ? rows : [rows];
      for (const item of items) {
        if (table === 'leads' && item.idempotency_key) {
          const dup = dbTables.leads.find((r) => r.idempotency_key === item.idempotency_key);
          if (dup) {
            return {
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "idx_leads_idempotency_key"',
              },
            };
          }
        }
        dbTables[table].push(structuredClone(item));
      }
      return { data: items, error: null };
    },
    update(patch) {
      pendingUpdate = patch;
      return this;
    },
    then(resolve, reject) {
      const source = dbTables[table] || [];
      let rows = source.filter((r) => !cursor || r.id > cursor);
      if (filterInIds) rows = rows.filter((r) => filterInIds.includes(r.id));
      if (filterEqCol) rows = rows.filter((r) => r[filterEqCol] === filterEqVal);
      return Promise.resolve({
        data: structuredClone(rows.slice(0, limit)),
        error: null,
      }).then(resolve, reject);
    },
  };
  return query;
};

function requestJson(baseUrl, reqPath, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, baseUrl);
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const request = http.request(
      url,
      {
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = raw;
          try {
            data = JSON.parse(raw);
          } catch {
            // keep raw
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function run() {
  // ===========================================================================
  // [TEST 1] Persistence Round-Trip across initDataStore(true)
  // ===========================================================================
  console.log('\n[TEST 1] Lead & Notification structured fields survive full DB write -> initDataStore(true) reload');
  await store.initDataStore(true);

  const testLead = {
    id: 'lead-rt-1',
    name: 'Cliente Roundtrip',
    phone: '+39 347 1122334',
    email: 'rt@example.com',
    city: 'Milano',
    source: 'bill_upload',
    status: 'new',
    notes: 'Test roundtrip',
    createdAt: '2026-10-19',
    assignedBrokerId: 'user-op-2',
    billId: 'bill-rt-99',
    privacyConsentAccepted: true,
    privacyConsentTimestamp: '2026-10-19T10:30:00.000Z',
    privacyPolicyVersion: '2026.10',
    idempotencyKey: 'idem-rt-key-001',
  };

  await store.addLead(testLead);

  const personalNotif = {
    id: 'notif-rt-personal',
    type: 'switch_due',
    title: 'Avviso Personale',
    message: 'Solo per user-a / cust-a',
    timestamp: '2026-10-19T10:31:00.000Z',
    isRead: false,
    priority: 'high',
    targetRole: 'customer',
    targetUserId: 'user-a',
    targetCustomerId: 'cust-a',
  };

  const broadcastNotif = {
    id: 'notif-rt-bcast',
    type: 'price_drop',
    title: 'Avviso Broadcast',
    message: 'Per tutti i clienti',
    timestamp: '2026-10-19T10:32:00.000Z',
    isRead: false,
    priority: 'info',
    targetRole: 'customer',
  };

  await store.addNotification(personalNotif);
  await store.addNotification(broadcastNotif);

  // Two distinct users mark the broadcast notification read
  await store.markNotificationsRead(['notif-rt-bcast'], 'user-a');
  await store.markNotificationsRead(['notif-rt-bcast'], 'user-b');

  // Force full reload from synthetic Supabase tables (wiping in-memory state)
  await store.initDataStore(true);

  const reloadedLead = store.getLeads().find((l) => l.id === 'lead-rt-1');
  assert.ok(reloadedLead, 'Reloaded lead must exist');
  assert.equal(reloadedLead.billId, 'bill-rt-99', 'billId must survive DB round-trip');
  assert.equal(reloadedLead.privacyConsentAccepted, true, 'privacyConsentAccepted must survive DB round-trip');
  assert.equal(
    reloadedLead.privacyConsentTimestamp,
    '2026-10-19T10:30:00.000Z',
    'privacyConsentTimestamp must survive DB round-trip'
  );
  assert.equal(reloadedLead.privacyPolicyVersion, '2026.10', 'privacyPolicyVersion must survive DB round-trip');
  assert.equal(reloadedLead.idempotencyKey, 'idem-rt-key-001', 'idempotencyKey must survive DB round-trip');

  const reloadedPersonal = store.getNotifications().find((n) => n.id === 'notif-rt-personal');
  assert.ok(reloadedPersonal, 'Reloaded personal notification must exist');
  assert.equal(reloadedPersonal.targetUserId, 'user-a', 'targetUserId must survive DB round-trip');
  assert.equal(reloadedPersonal.targetCustomerId, 'cust-a', 'targetCustomerId must survive DB round-trip');

  const reloadedBcast = store.getNotifications().find((n) => n.id === 'notif-rt-bcast');
  assert.ok(reloadedBcast, 'Reloaded broadcast notification must exist');
  assert.deepEqual(
    reloadedBcast.readBy,
    ['user-a', 'user-b'],
    'Broadcast readBy array must persist both concurrent readers across DB reload'
  );
  assert.equal(reloadedBcast.isRead, false, 'Global isRead on broadcast notification must remain false');
  console.log('✔ [TEST 1] Full DB persistence round-trip verified for leads and notifications');

  // ===========================================================================
  // [TEST 2] Strict Zod Validator triggerNotificationSchema
  // ===========================================================================
  console.log('\n[TEST 2] triggerNotificationSchema accepts targetUserId and targetCustomerId');
  const parsed = triggerNotificationSchema.safeParse({
    title: 'Notifica Mirata',
    message: 'Contenuto mirato',
    type: 'switch_due',
    priority: 'high',
    targetRole: 'customer',
    targetUserId: 'user-cust-1',
    targetCustomerId: 'cust-1',
  });
  assert.equal(parsed.success, true, 'triggerNotificationSchema must accept targetUserId and targetCustomerId');
  console.log('✔ [TEST 2] triggerNotificationSchema strict validation verified');

  // ===========================================================================
  // [TEST 3] Concurrent Idempotency & Payload Fingerprint Conflict (409)
  // ===========================================================================
  console.log('\n[TEST 3] Parallel consultation requests (race condition) & key reuse conflict (409)');
  const app = express();
  app.use(express.json());
  app.use('/api/portal', portalRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const beforeCount = dbTables.leads.length;
    const concurrentPayload = {
      customerName: 'Concorrente Test',
      phone: '+39 333 7788990',
      email: 'concorrente@example.com',
      privacyConsent: true,
      privacyPolicyVersion: '2026.10',
      offerId: 'off-1',
      offerName: 'Sorgenia Luce',
      supplier: 'Sorgenia',
      utilityType: 'luce',
      annualConsumption: 2100,
      idempotencyKey: 'concurrent-idem-key-777',
    };

    // Launch 8 parallel requests simultaneously
    const parallelResults = await Promise.all(
      Array.from({ length: 8 }, () =>
        requestJson(baseUrl, '/api/portal/consultations', {
          method: 'POST',
          body: concurrentPayload,
        })
      )
    );

    for (const r of parallelResults) {
      assert.ok(r.status === 200 || r.status === 201, `Expected 200/201, got ${r.status}`);
    }
    const distinctLeadIds = new Set(parallelResults.map((r) => r.data.leadId));
    assert.equal(distinctLeadIds.size, 1, 'All 8 parallel requests must resolve to the exact same leadId');
    assert.equal(
      dbTables.leads.length,
      beforeCount + 1,
      `Expected exactly 1 lead inserted in DB across 8 parallel requests, found ${dbTables.leads.length - beforeCount}`
    );

    // Reuse the SAME idempotencyKey with a DIFFERENT phone/offer -> must return 409 Conflict
    const conflictRes = await requestJson(baseUrl, '/api/portal/consultations', {
      method: 'POST',
      body: {
        ...concurrentPayload,
        phone: '+39 399 0000111',
        offerId: 'off-2',
      },
    });
    assert.equal(
      conflictRes.status,
      409,
      `Reusing idempotencyKey for a different request payload must return 409 Conflict (got ${conflictRes.status})`
    );
    console.log('✔ [TEST 3] Concurrent idempotency lock, DB unique constraint handling, and 409 conflict verified');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ===========================================================================
  // [TEST 4] CORS Header, SQL Unique Index & Corporate Identity Completeness
  // ===========================================================================
  console.log('\n[TEST 4] CORS X-Idempotency-Key, SQL unique index & companyProfile completeness');
  const serverIndexSrc = fs.readFileSync(path.join(serverDir, 'src', 'index.ts'), 'utf8');
  assert.ok(
    serverIndexSrc.includes('X-Idempotency-Key'),
    'server/src/index.ts CORS allowedHeaders must include X-Idempotency-Key'
  );

  const migrationSql = fs.readFileSync(
    path.join(rootDir, 'supabase', 'migrations', '20261019_01_audit_p1_p2_remediation.sql'),
    'utf8'
  );
  assert.ok(
    migrationSql.toLowerCase().includes('create unique index') && migrationSql.includes('idempotency_key'),
    'Migration must create a UNIQUE index on leads(idempotency_key)'
  );
  assert.ok(
    migrationSql.includes('append_notification_reader'),
    'Migration must define atomic append_notification_reader function'
  );

  const companyProfileSrc = fs.readFileSync(path.join(rootDir, 'src', 'config', 'companyProfile.ts'), 'utf8');
  for (const requiredVar of [
    'VITE_COMPANY_NAME',
    'VITE_COMPANY_VAT',
    'VITE_COMPANY_ADDRESS',
    'VITE_COMPANY_TOLL_FREE',
    'VITE_COMPANY_SUPPORT_EMAIL',
    'VITE_COMPANY_PRIVACY_EMAIL',
    'VITE_COMPANY_PEC',
  ]) {
    const checkBlock = companyProfileSrc.split('isConfiguredCorporateIdentity:')[1] || '';
    assert.ok(
      checkBlock.includes(requiredVar),
      `isConfiguredCorporateIdentity must verify ${requiredVar} before hiding the demo banner`
    );
  }
  console.log('✔ [TEST 4] CORS, SQL unique constraint/RPC, and complete corporate identity check verified');

  console.log('\n🎉 ALL PERSISTENCE ROUND-TRIP & CONCURRENCY TESTS PASSED!');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

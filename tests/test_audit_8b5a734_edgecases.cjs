const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://audit-8b5a734-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_audit_8b5a734_test';
process.env.VOLTA_DEMO_MODE = 'false';
process.env.JWT_SECRET = 'audit-8b5a734-jwt-secret-at-least-32-chars';

console.log('=== TEST SUITE: AUDIT 8b5a734 EDGE CASES & REMEDIATION (TDD) ===');

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { supabase } = require('../server/dist/services/dbClient.js');
assert.ok(supabase, 'Supabase client must be initialized for I/O boundary test');

// Synthetic PostgreSQL tables & storage bucket at the Supabase I/O boundary
const dbTables = {
  leads: [],
  customers: [],
  signature_logs: [],
  notifications: [],
  portal_bills: [],
  meter_readings: [],
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

const storageFiles = new Map();

let simulatePkeyConflictOnNextLeadInsert = false;
let simulateCrossWorkerRaceWinnerOnLeadInsert = null;
let rpcAppendNotificationReaderMode = 'active'; // 'active' | 'missing_pgrst202'

supabase.storage = {
  from(_bucket) {
    return {
      async upload(storagePath, bytes, opts) {
        storageFiles.set(storagePath, { bytes: Buffer.from(bytes), contentType: opts?.contentType });
        return { data: { path: storagePath }, error: null };
      },
      async remove(paths) {
        for (const p of paths) {
          storageFiles.delete(p);
        }
        return { data: paths, error: null };
      },
      async createSignedUrl(storagePath) {
        if (!storageFiles.has(storagePath)) {
          return { data: null, error: { message: 'Object not found' } };
        }
        return { data: { signedUrl: `https://storage.example/${storagePath}` }, error: null };
      },
      async download(storagePath) {
        const entry = storageFiles.get(storagePath);
        if (!entry) return { data: null, error: { message: 'Object not found' } };
        return {
          data: {
            async arrayBuffer() {
              return entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength);
            },
          },
          error: null,
        };
      },
    };
  },
};

supabase.rpc = async (fnName, params) => {
  if (fnName === 'append_notification_reader') {
    if (rpcAppendNotificationReaderMode === 'missing_pgrst202') {
      return {
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function public.append_notification_reader(p_ids, p_user_id) in the schema cache',
        },
      };
    }
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
  let pendingDelete = false;
  let pendingInsertSingleRow = null;

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
      if (pendingDelete) {
        dbTables[table] = dbTables[table].filter((row) => row[col] !== val);
        return Promise.resolve({ data: null, error: null });
      }
      if (pendingUpdate) {
        for (const row of dbTables[table]) {
          if (row[col] === val) Object.assign(row, structuredClone(pendingUpdate));
        }
        return Promise.resolve({ data: null, error: null });
      }
      return this;
    },
    delete() {
      pendingDelete = true;
      return this;
    },
    insert(rows) {
      const items = Array.isArray(rows) ? rows : [rows];
      if (table === 'portal_bills') {
        const cloned = structuredClone(items[0]);
        dbTables.portal_bills.push(cloned);
        pendingInsertSingleRow = cloned;
        return this;
      }

      return (async () => {
        if (table === 'leads' && simulatePkeyConflictOnNextLeadInsert) {
          simulatePkeyConflictOnNextLeadInsert = false;
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "leads_pkey"',
            },
          };
        }
        if (table === 'leads' && simulateCrossWorkerRaceWinnerOnLeadInsert) {
          const hook = simulateCrossWorkerRaceWinnerOnLeadInsert;
          simulateCrossWorkerRaceWinnerOnLeadInsert = null;
          await hook(items[0]);
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "idx_leads_idempotency_key"',
            },
          };
        }
        for (const item of items) {
          if (table === 'leads') {
            if (dbTables.leads.some((r) => r.id === item.id)) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "leads_pkey"',
                },
              };
            }
            if (item.idempotency_key && dbTables.leads.some((r) => r.idempotency_key === item.idempotency_key)) {
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
      })();
    },
    single() {
      if (pendingInsertSingleRow) {
        const r = structuredClone(pendingInsertSingleRow);
        pendingInsertSingleRow = null;
        return Promise.resolve({ data: r, error: null });
      }
      const source = dbTables[table] || [];
      const found = filterEqCol ? source.find((r) => r[filterEqCol] === filterEqVal) : source[0];
      return Promise.resolve({ data: found ? structuredClone(found) : null, error: found ? null : { message: 'Not found' } });
    },
    maybeSingle() {
      const source = dbTables[table] || [];
      const found = filterEqCol ? source.find((r) => r[filterEqCol] === filterEqVal) : source[0];
      return Promise.resolve({ data: found ? structuredClone(found) : null, error: null });
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

const storePath = require.resolve('../server/dist/services/dataStore.js');
const store = require(storePath);
const { portalRouter } = require('../server/dist/routes/portal.js');

function loadIsolatedDataStore() {
  delete require.cache[storePath];
  const isolated = require(storePath);
  return isolated;
}

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
  // [CHECK 1] SQL ACLs & Idempotency Fingerprint Column in Migrations and Schema
  // ===========================================================================
  console.log('\n[CHECK 1] SQL ACLs for append_notification_reader and idempotency_fingerprint column');
  const sqlFiles = [
    path.join(rootDir, 'supabase', 'schema.sql'),
    path.join(rootDir, 'supabase', 'migrations', '20261019_01_audit_p1_p2_remediation.sql'),
    path.join(rootDir, 'supabase', 'migrations', '20261019_02_audit_rpc_acl_and_idempotency_fingerprint.sql'),
  ];
  for (const sqlFile of sqlFiles) {
    assert.ok(fs.existsSync(sqlFile), `Missing SQL file: ${sqlFile}`);
    const content = fs.readFileSync(sqlFile, 'utf8').toLowerCase();
    assert.ok(
      content.includes('revoke all on function public.append_notification_reader(text[], text) from public, anon, authenticated'),
      `${path.basename(sqlFile)} must revoke execute on append_notification_reader from public, anon, authenticated`
    );
    assert.ok(
      content.includes('grant execute on function public.append_notification_reader(text[], text) to service_role'),
      `${path.basename(sqlFile)} must grant execute on append_notification_reader to service_role`
    );
    assert.ok(
      content.includes('idempotency_fingerprint'),
      `${path.basename(sqlFile)} must include idempotency_fingerprint column`
    );
  }
  console.log('✔ [CHECK 1] SQL ACLs and idempotency_fingerprint column verified across schema and migrations');

  // ===========================================================================
  // [CHECK 2] Auditor Reproduction #1: Unrelated 23505 (leads_pkey) MUST Throw
  // ===========================================================================
  console.log('\n[CHECK 2] addLead throws on unrelated 23505 (leads_pkey or missing winning idempotency_key)');
  await store.initDataStore(true);

  simulatePkeyConflictOnNextLeadInsert = true;
  let callerError = null;
  try {
    await store.addLead({
      id: 'lead-dup-pk',
      name: 'Mario',
      phone: '+393331234567',
      city: 'Milano',
      source: 'manual',
      status: 'new',
      notes: 'test',
      createdAt: '2026-10-19',
    });
  } catch (e) {
    callerError = e;
  }
  assert.ok(callerError !== null, 'addLead must throw when 23505 occurs on leads_pkey without a matching idempotencyKey');
  assert.equal(callerError.status, 409, '23505 error thrown by addLead must have status 409');
  assert.equal(
    store.getLeads().some((l) => l.id === 'lead-dup-pk'),
    false,
    'Failed lead must not be added to local cache'
  );

  // Also test when lead HAS an idempotencyKey, but 23505 is on leads_pkey (no row with that idempotencyKey in DB)
  simulatePkeyConflictOnNextLeadInsert = true;
  let pkeyWithIdemError = null;
  try {
    await store.addLead({
      id: 'lead-dup-pk-with-idem',
      name: 'Mario Idem',
      phone: '+393331234567',
      city: 'Milano',
      source: 'public_comparator',
      status: 'new',
      notes: 'test',
      createdAt: '2026-10-19',
      idempotencyKey: 'non-existent-idem-in-db',
    });
  } catch (e) {
    pkeyWithIdemError = e;
  }
  assert.ok(
    pkeyWithIdemError !== null,
    'addLead must throw when 23505 occurs on leads_pkey or no winning lead with idempotencyKey exists in DB after reload'
  );
  console.log('✔ [CHECK 2] Unrelated 23505 violations properly throw 409 and never return false success');

  // ===========================================================================
  // [CHECK 3] Auditor Reproduction #2: Multi-Worker markNotificationsRead
  // ===========================================================================
  console.log('\n[CHECK 3] Multi-worker markNotificationsRead requires atomic RPC and never clobbers read_by');
  dbTables.notifications = [
    {
      id: 'broadcast',
      type: 'price_drop',
      title: 'Broadcast',
      message: 'msg',
      timestamp: new Date().toISOString(),
      is_read: false,
      priority: 'info',
      target_role: 'customer',
      read_by: [],
    },
  ];

  const workerA = loadIsolatedDataStore();
  const workerB = loadIsolatedDataStore();
  await workerA.initDataStore(true);
  await workerB.initDataStore(true);

  // Restore original store cache entry for portalRouter
  require.cache[storePath] = {
    id: storePath,
    filename: storePath,
    loaded: true,
    exports: store,
  };

  // Sub-check 3a: When RPC fails with PGRST202, markNotificationsRead must throw and NOT overwrite read_by
  rpcAppendNotificationReaderMode = 'missing_pgrst202';
  let rpcMissingErr = null;
  try {
    await workerA.markNotificationsRead(['broadcast'], 'reader-a');
  } catch (e) {
    rpcMissingErr = e;
  }
  assert.ok(rpcMissingErr !== null, 'markNotificationsRead must throw when append_notification_reader RPC fails');
  assert.deepEqual(dbTables.notifications[0].read_by, [], 'DB read_by must remain untouched when RPC fails');

  // Sub-check 3b: When RPC is active, concurrent workerA and workerB preserve both readers
  rpcAppendNotificationReaderMode = 'active';
  await Promise.all([
    workerA.markNotificationsRead(['broadcast'], 'reader-a'),
    workerB.markNotificationsRead(['broadcast'], 'reader-b'),
  ]);
  assert.deepEqual(
    dbTables.notifications[0].read_by.slice().sort(),
    ['reader-a', 'reader-b'],
    'Both concurrent workers must preserve their readers in DB via atomic RPC'
  );
  assert.deepEqual(
    workerA.getNotifications().find((n) => n.id === 'broadcast').readBy.slice().sort(),
    ['reader-a', 'reader-b'],
    'Worker A local cache must reflect refreshed DB state'
  );
  assert.deepEqual(
    workerB.getNotifications().find((n) => n.id === 'broadcast').readBy.slice().sort(),
    ['reader-a', 'reader-b'],
    'Worker B local cache must reflect refreshed DB state'
  );
  console.log('✔ [CHECK 3] Multi-worker markNotificationsRead atomic RPC and error propagation verified');

  // ===========================================================================
  // [CHECK 4] Canonical SHA-256 Fingerprint Conflicts (Same OfferName/FileName, Different OfferId/Bytes)
  // ===========================================================================
  console.log('\n[CHECK 4] Canonical SHA-256 fingerprint rejects same offerName with different offerId and same fileName with different PDF bytes');
  await store.initDataStore(true);

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/portal', portalRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 4a: Consultation with same phone and same offerName ("Sorgenia Luce"), but different offerId ("off-1" vs "off-2")
    const consultKey = 'idem-sha256-consult-001';
    const firstConsult = await requestJson(baseUrl, '/api/portal/consultations', {
      method: 'POST',
      body: {
        customerName: 'Luca Verdi',
        phone: '+39 333 1112223',
        privacyConsent: true,
        offerId: 'off-1',
        offerName: 'Sorgenia Luce',
        utilityType: 'luce',
        annualConsumption: 2500,
        idempotencyKey: consultKey,
      },
    });
    assert.equal(firstConsult.status, 201, 'First consultation request must succeed with 201');

    // Exact same key, phone, and offerName ("Sorgenia Luce"), but different offerId ("off-2")
    const diffOfferIdConsult = await requestJson(baseUrl, '/api/portal/consultations', {
      method: 'POST',
      body: {
        customerName: 'Luca Verdi',
        phone: '+39 333 1112223',
        privacyConsent: true,
        offerId: 'off-2',
        offerName: 'Sorgenia Luce',
        utilityType: 'luce',
        annualConsumption: 2500,
        idempotencyKey: consultKey,
      },
    });
    assert.equal(
      diffOfferIdConsult.status,
      409,
      `Same offerName but different offerId on same idempotencyKey must return 409 Conflict (got ${diffOfferIdConsult.status})`
    );

    // Same key, phone, offerId, offerName, but different annualConsumption (2500 vs 4200)
    const diffConsumptionConsult = await requestJson(baseUrl, '/api/portal/consultations', {
      method: 'POST',
      body: {
        customerName: 'Luca Verdi',
        phone: '+39 333 1112223',
        privacyConsent: true,
        offerId: 'off-1',
        offerName: 'Sorgenia Luce',
        utilityType: 'luce',
        annualConsumption: 4200,
        idempotencyKey: consultKey,
      },
    });
    assert.equal(
      diffConsumptionConsult.status,
      409,
      `Different annualConsumption on same idempotencyKey must return 409 Conflict (got ${diffConsumptionConsult.status})`
    );

    // 4b: Bill upload with same phone and same fileName ("bolletta.pdf"), but different PDF byte content
    const pdfBytes1 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Bolletta Maggio) >>\nendobj\n%%EOF\n');
    const pdfBytes2 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Bolletta Giugno DIVERSA) >>\nendobj\n%%EOF\n');
    const billKey = 'idem-sha256-bill-001';

    const firstBill = await requestJson(baseUrl, '/api/portal/bills', {
      method: 'POST',
      body: {
        customerName: 'Giulia Neri',
        phone: '+39 340 9988776',
        privacyConsent: true,
        utilityType: 'luce',
        fileName: 'bolletta.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfBytes1.toString('base64'),
        idempotencyKey: billKey,
      },
    });
    assert.equal(firstBill.status, 201, `First bill upload must succeed with 201 (got ${firstBill.status})`);

    // Same idempotencyKey, same phone, same fileName ("bolletta.pdf"), but DIFFERENT PDF bytes
    const diffBytesBill = await requestJson(baseUrl, '/api/portal/bills', {
      method: 'POST',
      body: {
        customerName: 'Giulia Neri',
        phone: '+39 340 9988776',
        privacyConsent: true,
        utilityType: 'luce',
        fileName: 'bolletta.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfBytes2.toString('base64'),
        idempotencyKey: billKey,
      },
    });
    assert.equal(
      diffBytesBill.status,
      409,
      `Same fileName ("bolletta.pdf") with different PDF bytes on same idempotencyKey must return 409 Conflict (got ${diffBytesBill.status})`
    );
    console.log('✔ [CHECK 4] Canonical SHA-256 fingerprint conflicts verified for consultations and bill uploads');

    // ===========================================================================
    // [CHECK 5] Cross-Worker Concurrent POST /api/portal/bills Orphan Bill Cleanup
    // ===========================================================================
    console.log('\n[CHECK 5] Cross-worker concurrent POST /api/portal/bills cleans up losing worker orphan bill');
    const billsBeforeRace = dbTables.portal_bills.length;
    const filesBeforeRace = storageFiles.size;
    const raceKey = 'idem-cross-worker-bill-race-999';
    const racePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Bolletta Concorrente Cross Worker) >>\nendobj\n%%EOF\n');
    const raceBytesSha256 = crypto.createHash('sha256').update(racePdfBytes).digest('hex');
    const racePhone = '+39 348 5566778';
    const normalizedRacePhone = racePhone.replace(/\D/g, '');
    const raceFingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          source: 'bill_upload',
          phone: normalizedRacePhone,
          utilityType: 'gas',
          fileName: 'fattura_gas.pdf',
          mimeType: 'application/pdf',
          bytesSha256: raceBytesSha256,
        })
      )
      .digest('hex');

    // Simulate another worker winning the DB insert right after this worker uploaded its bill to portal_bills + storage
    const winningBillId = 'bill-winner-cross-worker-1';
    const winningLeadId = 'lead-winner-cross-worker-1';
    const winningStoragePath = `guest-winner/${winningBillId}-fattura_gas.pdf`;

    simulateCrossWorkerRaceWinnerOnLeadInsert = async (_losingRow) => {
      // Winner worker uploaded its own bill and inserted the winning lead row in DB
      storageFiles.set(winningStoragePath, { bytes: racePdfBytes, contentType: 'application/pdf' });
      dbTables.portal_bills.push({
        id: winningBillId,
        customer_id: 'guest-winner',
        customer_name: 'Marco Concorrente',
        file_name: 'fattura_gas.pdf',
        storage_path: winningStoragePath,
        mime_type: 'application/pdf',
        file_size_bytes: racePdfBytes.length,
        utility_type: 'gas',
        status: 'in_review',
        notes: null,
        extracted_savings_eur: null,
        lead_id: winningLeadId,
        assigned_broker_id: 'user-op-2',
        created_at: new Date().toISOString(),
      });
      dbTables.leads.push({
        id: winningLeadId,
        name: 'Marco Concorrente',
        phone: racePhone,
        email: 'marco@example.com',
        city: 'Torino',
        source: 'bill_upload',
        status: 'new',
        notes: '[BOLLETTA CARICATA] File: fattura_gas.pdf',
        created_at: new Date().toISOString(),
        assigned_broker_id: 'user-op-2',
        bill_id: winningBillId,
        privacy_consent_accepted: true,
        privacy_consent_timestamp: new Date().toISOString(),
        privacy_policy_version: '2026.10',
        idempotency_key: raceKey,
        idempotency_fingerprint: raceFingerprint,
      });
    };

    const raceRes = await requestJson(baseUrl, '/api/portal/bills', {
      method: 'POST',
      body: {
        customerName: 'Marco Concorrente',
        phone: racePhone,
        email: 'marco@example.com',
        city: 'Torino',
        privacyConsent: true,
        utilityType: 'gas',
        fileName: 'fattura_gas.pdf',
        mimeType: 'application/pdf',
        base64Data: racePdfBytes.toString('base64'),
        idempotencyKey: raceKey,
      },
    });

    assert.ok(
      raceRes.status === 200 || raceRes.status === 201,
      `Cross-worker idempotent bill upload should succeed with 200/201 (got ${raceRes.status}: ${JSON.stringify(raceRes.data)})`
    );
    assert.equal(raceRes.data.leadId, winningLeadId, 'Response must return the winning worker leadId');
    assert.equal(raceRes.data.bill?.id, winningBillId, 'Response must return the winning worker bill');
    assert.equal(
      dbTables.portal_bills.length,
      billsBeforeRace + 1,
      `Losing worker must delete its orphan portal_bills row; expected ${billsBeforeRace + 1} total bills, found ${dbTables.portal_bills.length}`
    );
    assert.equal(
      storageFiles.size,
      filesBeforeRace + 1,
      `Losing worker must delete its orphan file from storage; expected ${filesBeforeRace + 1} total files, found ${storageFiles.size}`
    );
    console.log('✔ [CHECK 5] Cross-worker orphan bill & storage object compensation verified (0 orphans left behind)');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n🎉 ALL AUDIT 8b5a734 EDGE CASE TESTS PASSED!');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

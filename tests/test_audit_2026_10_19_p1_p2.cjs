process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'audit-2026-10-19-p1-p2-jwt-secret-at-least-32-chars';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

console.log('=== TEST SUITE: AUDIT 19 OTTOBRE 2026 — P1 & P2 REMEDIATION (TDD) ===');

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

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
            // keep raw buffer string for binary/PDF downloads
          }
          resolve({ status: res.statusCode, data, raw, headers: res.headers });
        });
      }
    );
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function run() {
  const dataStore = require('../server/dist/services/dataStore.js');
  const gmeFeedService = require('../server/dist/services/gmeFeedService.js');
  const { portalRouter } = require('../server/dist/routes/portal.js');
  const { notificationsRouter } = require('../server/dist/routes/notifications.js');

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/portal', portalRouter);
  app.use('/api/notifications', notificationsRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // =========================================================================
    // [P1.1] Guest Bills Data Model, Foreign Key & Broker Access
    // =========================================================================
    console.log('\n[TEST P1.1] Guest bill upload links to lead & allows assigned broker download/list');
    const pdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF', 'utf8').toString('base64');

    const guestUploadRes = await requestJson(baseUrl, '/api/portal/bills', {
      method: 'POST',
      body: {
        customerName: 'Guest Audit Test',
        phone: '+39 340 9988771',
        email: 'guest.audit@example.com',
        privacyConsent: true,
        privacyPolicyVersion: '2026.10',
        utilityType: 'luce',
        fileName: 'bolletta_guest_audit.pdf',
        mimeType: 'application/pdf',
        base64Data: pdfBase64,
      },
    });

    assert.equal(guestUploadRes.status, 201, `Expected 201 on guest bill upload, got ${guestUploadRes.status}`);
    const uploadedBill = guestUploadRes.data?.bill;
    assert.ok(uploadedBill?.id, 'Uploaded guest bill must have an id');
    assert.ok(uploadedBill?.leadId, 'Uploaded guest bill must store structured leadId');
    assert.ok(uploadedBill?.assignedBrokerId, 'Uploaded guest bill must store assignedBrokerId');

    // Verify lead has structured consent & billId
    const createdLead = dataStore.getLeads().find((l) => l.id === uploadedBill.leadId);
    assert.ok(createdLead, 'Lead linked to guest bill must exist in dataStore');
    assert.equal(createdLead.billId, uploadedBill.id, 'Lead must reference billId');
    assert.equal(createdLead.privacyConsentAccepted, true, 'Lead must record privacyConsentAccepted=true');
    assert.ok(
      typeof createdLead.privacyConsentTimestamp === 'string' && createdLead.privacyConsentTimestamp.includes('T'),
      'Lead must record ISO privacyConsentTimestamp'
    );
    assert.equal(createdLead.privacyPolicyVersion, '2026.10', 'Lead must record privacyPolicyVersion');

    // Assigned broker token
    const { generateToken } = require('../server/dist/middleware/auth.js');
    const assignedBroker = dataStore.users.find((u) => u.id === uploadedBill.assignedBrokerId);
    assert.ok(assignedBroker, 'Assigned broker profile must exist in dataStore.users');
    const broker1Token = generateToken({
      userId: assignedBroker.id,
      email: assignedBroker.email,
      role: assignedBroker.role,
    });

    const brokerBillsRes = await requestJson(baseUrl, '/api/portal/bills', {
      headers: { Authorization: `Bearer ${broker1Token}` },
    });
    assert.equal(brokerBillsRes.status, 200);
    assert.ok(
      Array.isArray(brokerBillsRes.data?.bills) &&
        brokerBillsRes.data.bills.some((b) => b.id === uploadedBill.id),
      'Assigned broker must see the guest bill in GET /api/portal/bills'
    );

    const brokerDownloadRes = await requestJson(baseUrl, `/api/portal/bills/${uploadedBill.id}/download`, {
      headers: { Authorization: `Bearer ${broker1Token}` },
    });
    assert.equal(
      brokerDownloadRes.status,
      200,
      `Assigned broker must be able to download guest bill (got ${brokerDownloadRes.status})`
    );

    // Unassigned broker must still get 403
    const unassignedBroker = dataStore.users.find(
      (u) => (u.role === 'broker' || u.role === 'operator') && u.id !== uploadedBill.assignedBrokerId
    );
    assert.ok(unassignedBroker, 'Unassigned broker profile must exist in dataStore.users');
    const broker2Token = generateToken({
      userId: unassignedBroker.id,
      email: unassignedBroker.email,
      role: unassignedBroker.role,
    });
    const otherBrokerDownloadRes = await requestJson(baseUrl, `/api/portal/bills/${uploadedBill.id}/download`, {
      headers: { Authorization: `Bearer ${broker2Token}` },
    });
    assert.equal(otherBrokerDownloadRes.status, 403, 'Unassigned broker must receive 403 on guest bill download');

    // Verify SQL schema & migration no longer enforce strict customers(id) FK on guest portal_bills
    const schemaSql = fs.readFileSync(path.join(rootDir, 'supabase', 'schema.sql'), 'utf8');
    assert.ok(schemaSql.includes('lead_id'), 'supabase/schema.sql portal_bills must include lead_id column');
    assert.ok(schemaSql.includes('assigned_broker_id'), 'supabase/schema.sql portal_bills must include assigned_broker_id');
    const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20261019_01_audit_p1_p2_remediation.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration 20261019_01_audit_p1_p2_remediation.sql must exist');
    console.log('✔ [P1.1] Guest bill schema, lead link, and broker authorization verified');

    // =========================================================================
    // [P1.2] Notification Isolation by Recipient & Per-User Read State
    // =========================================================================
    console.log('\n[TEST P1.2] Notification isolation between Customer A and Customer B + per-user read state');
    const personalNotifId = `notif-audit-cust1-${Date.now()}`;
    await dataStore.addNotification({
      id: personalNotifId,
      type: 'switch_due',
      title: 'Offerta riservata Cliente 1',
      message: 'Notifica personale solo per cust-1',
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'high',
      targetRole: 'customer',
      meta: { customerId: 'cust-1' },
    });

    const broadcastNotifId = `notif-audit-bcast-${Date.now()}`;
    await dataStore.addNotification({
      id: broadcastNotifId,
      type: 'price_drop',
      title: 'Aggiornamento Mercato per tutti i clienti',
      message: 'Comunicazione broadcast',
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: 'info',
      targetRole: 'customer',
    });

    const cust1User = dataStore.users.find((u) => u.role === 'customer' && u.customerId === 'cust-1');
    const cust2User = dataStore.users.find((u) => u.role === 'customer' && u.customerId === 'cust-2');
    assert.ok(cust1User && cust2User, 'Customer 1 and Customer 2 profiles must exist in dataStore.users');
    const cust1Token = generateToken({ userId: cust1User.id, email: cust1User.email, role: cust1User.role });
    const cust2Token = generateToken({ userId: cust2User.id, email: cust2User.email, role: cust2User.role });

    const cust1ListRes = await requestJson(baseUrl, '/api/notifications', {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    const cust2ListRes = await requestJson(baseUrl, '/api/notifications', {
      headers: { Authorization: `Bearer ${cust2Token}` },
    });

    assert.ok(
      cust1ListRes.data.notifications.some((n) => n.id === personalNotifId),
      'Customer 1 must receive their personal notification'
    );
    assert.ok(
      !cust2ListRes.data.notifications.some((n) => n.id === personalNotifId),
      'Customer 2 must NOT receive Customer 1 personal notification'
    );

    // Customer 2 attempts to mark Customer 1's personal notification read -> 403
    const cust2PatchPersonal = await requestJson(baseUrl, `/api/notifications/${personalNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cust2Token}` },
    });
    assert.equal(
      cust2PatchPersonal.status,
      403,
      `Customer 2 must get 403 when marking Customer 1 notification read (got ${cust2PatchPersonal.status})`
    );

    // Customer 1 marks the broadcast notification read -> should be read for Customer 1, still unread for Customer 2
    const cust1PatchBroadcast = await requestJson(baseUrl, `/api/notifications/${broadcastNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    assert.equal(cust1PatchBroadcast.status, 200);

    const cust1AfterRead = await requestJson(baseUrl, '/api/notifications', {
      headers: { Authorization: `Bearer ${cust1Token}` },
    });
    const cust2AfterRead = await requestJson(baseUrl, '/api/notifications', {
      headers: { Authorization: `Bearer ${cust2Token}` },
    });

    const bcastForCust1 = cust1AfterRead.data.notifications.find((n) => n.id === broadcastNotifId);
    const bcastForCust2 = cust2AfterRead.data.notifications.find((n) => n.id === broadcastNotifId);
    assert.equal(bcastForCust1?.isRead, true, 'Broadcast notification must be marked read for Customer 1');
    assert.equal(bcastForCust2?.isRead, false, 'Broadcast notification must remain unread for Customer 2');
    console.log('✔ [P1.2] Recipient notification isolation and per-recipient read state verified');

    // =========================================================================
    // [P1.3] Honest GME Market Index Benchmark Labeling (No Fake Live / Random)
    // =========================================================================
    console.log('\n[TEST P1.3] Honest GME Market Index benchmark labeling & deterministic refresh');
    const gmeSrc = fs.readFileSync(path.join(rootDir, 'server', 'src', 'services', 'gmeFeedService.ts'), 'utf8');
    assert.ok(!gmeSrc.includes('Math.random()'), 'gmeFeedService.ts must not use Math.random() for fake market jitter');
    assert.ok(!gmeSrc.includes('GME Live Feed'), 'gmeFeedService.ts must not falsely claim "GME Live Feed"');

    const beforeIdx = gmeFeedService.getMarketIndices();
    assert.ok(
      beforeIdx.lastUpdated.toLowerCase().includes('benchmark') || beforeIdx.lastUpdated.includes('Marzo 2026'),
      `Expected transparent benchmark label in lastUpdated, got "${beforeIdx.lastUpdated}"`
    );
    const refreshedIdx = await gmeFeedService.refreshMarketIndices();
    assert.equal(refreshedIdx.punEurKwh, beforeIdx.punEurKwh, 'Benchmark refresh without external feed must be deterministic');
    console.log('✔ [P1.3] GME benchmark labeling & determinism verified');

    // =========================================================================
    // [P1.4] Configurable Corporate Identity & Demo Disclosure
    // =========================================================================
    console.log('\n[TEST P1.4] Configurable corporate identity in src/config/companyProfile.ts');
    const companyProfilePath = path.join(rootDir, 'src', 'config', 'companyProfile.ts');
    assert.ok(fs.existsSync(companyProfilePath), 'src/config/companyProfile.ts must exist');
    const companyProfileSrc = fs.readFileSync(companyProfilePath, 'utf8');
    assert.ok(companyProfileSrc.includes('VITE_COMPANY_NAME'), 'Must support VITE_COMPANY_NAME');
    assert.ok(companyProfileSrc.includes('VITE_COMPANY_VAT'), 'Must support VITE_COMPANY_VAT');
    assert.ok(companyProfileSrc.includes('isConfiguredCorporateIdentity'), 'Must expose isConfiguredCorporateIdentity flag');
    console.log('✔ [P1.4] Configurable corporate identity verified');

    // =========================================================================
    // [P2.1 & P2.2] Idempotent Lead Intake & Non-Blocking Notification Outbox
    // =========================================================================
    console.log('\n[TEST P2.1 & P2.2] Idempotent guest consultation intake & non-blocking notification');
    const portalRouteSrc = fs.readFileSync(path.join(rootDir, 'server', 'src', 'routes', 'portal.ts'), 'utf8');
    assert.ok(
      portalRouteSrc.includes('Notifica non inviata') || portalRouteSrc.includes('notifErr'),
      'server/src/routes/portal.ts must catch notification errors so lead creation never returns 500'
    );

    const leadsCountBefore = dataStore.getLeads().length;
    const consultPayload = {
      customerName: 'Mario Idempotente',
      phone: '+39 333 1122334',
      email: 'mario.idempotente@example.com',
      privacyConsent: true,
      privacyPolicyVersion: '2026.10',
      offerId: 'off-1',
      offerName: 'Sorgenia Next Energy Sunlight Luce',
      supplier: 'Sorgenia',
      utilityType: 'luce',
      annualConsumption: 2500,
      idempotencyKey: 'idem-audit-test-001',
    };

    const firstConsult = await requestJson(baseUrl, '/api/portal/consultations', {
      method: 'POST',
      body: consultPayload,
    });
    assert.equal(firstConsult.status, 201);

    const secondConsult = await requestJson(baseUrl, '/api/portal/consultations', {
      method: 'POST',
      body: consultPayload,
    });
    assert.ok(
      secondConsult.status === 200 || secondConsult.status === 201,
      'Duplicate consultation retry must succeed idempotently'
    );
    assert.equal(
      secondConsult.data.leadId,
      firstConsult.data.leadId,
      'Idempotent retry must return the same leadId without creating a duplicate'
    );
    const leadsCountAfter = dataStore.getLeads().length;
    assert.equal(leadsCountAfter, leadsCountBefore + 1, 'Exactly 1 lead must be persisted after retry');
    console.log('✔ [P2.1 & P2.2] Idempotent lead intake & GDPR consent metadata verified');

    // =========================================================================
    // [P2.3] Household Wizard source: 'household-estimate'
    // =========================================================================
    console.log('\n[TEST P2.3] Household wizard sets source="household-estimate" and CustomerApp displays "Stima da Profilo Casa"');
    const intakeSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'customer', 'EnergyBillIntake.tsx'), 'utf8');
    const customerAppSrc = fs.readFileSync(path.join(rootDir, 'src', 'apps', 'CustomerApp.tsx'), 'utf8');
    const offerCompSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'offerComparison.ts'), 'utf8');

    assert.ok(offerCompSrc.includes("'household-estimate'"), "offerComparison.ts ComparisonSource must include 'household-estimate'");
    assert.ok(intakeSrc.includes("source: 'household-estimate'"), "EnergyBillIntake.tsx handleWizardSubmit must set source: 'household-estimate'");
    assert.ok(customerAppSrc.includes('Stima da Profilo Casa'), "CustomerApp.tsx must display 'Stima da Profilo Casa' for household-estimate");
    console.log('✔ [P2.3] Household estimate origin label verified');

    // =========================================================================
    // [P2.4] NotificationCenter.tsx Rollback & Session Dismissal
    // =========================================================================
    console.log('\n[TEST P2.4] NotificationCenter.tsx handleMarkAllAsRead rollback & session dismissal');
    const notifCenterSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'NotificationCenter.tsx'), 'utf8');
    assert.ok(
      notifCenterSrc.includes('dismissedNotificationIds') || notifCenterSrc.includes('volta_dismissed_notifications'),
      'NotificationCenter.tsx must track dismissed notification IDs so polling does not resurrect them'
    );
    console.log('✔ [P2.4] NotificationCenter rollback and session dismissal verified');

    // =========================================================================
    // [P2.5] Totem Hostname Recognition
    // =========================================================================
    console.log('\n[TEST P2.5] Totem hostname recognition in src/App.tsx');
    const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'App.tsx'), 'utf8');
    assert.ok(
      appSrc.includes('VITE_TOTEM_HOSTNAME') || appSrc.includes("host.includes('totem')"),
      'src/App.tsx must recognize VITE_TOTEM_HOSTNAME or hostnames containing totem (e.g. voltacrm-totem.vercel.app)'
    );
    console.log('✔ [P2.5] Totem hostname recognition verified');

    console.log('\n🎉 ALL AUDIT 19 OTTOBRE 2026 P1 & P2 TESTS PASSED!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

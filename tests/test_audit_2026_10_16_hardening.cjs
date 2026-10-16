const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

console.log('=== TEST SUITE: AUDIT 2026-10-16 SECURITY & OAUTH HARDENING (TDD) ===');

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'audit-2026-10-16-tdd-secret-at-least-32-chars';

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
const express = req('express');

const { users, customers, addSignatureLog } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
const { generateToken } = require(path.join(serverDir, 'dist', 'middleware', 'auth.js'));
const { switchRouter } = require(path.join(serverDir, 'dist', 'routes', 'switch.js'));
const { operationsRouter } = require(path.join(serverDir, 'dist', 'routes', 'operations.js'));
const { saveAppointment } = require(path.join(serverDir, 'dist', 'services', 'operationsService.js'));

// Helper: valid minimal 1x1 PNG Base64 for canvas signature test
const VALID_1X1_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

async function runTests() {
  // ---------------------------------------------------------------------------
  // TEST 1: vercel.json CSP Alignment with index.html (OAuth scripts & no unsafe-inline in script-src)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: vercel.json Content-Security-Policy alignment ---');
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8'));
  const rootHeaders = vercelConfig.headers.find(h => h.source === '/(.*)')?.headers || [];
  const cspHeader = rootHeaders.find(h => h.key === 'Content-Security-Policy')?.value || '';
  assert.ok(cspHeader.length > 0, 'vercel.json must define Content-Security-Policy header');

  const scriptSrcMatch = cspHeader.match(/script-src\s+([^;]+)/);
  assert.ok(scriptSrcMatch, 'CSP must include script-src directive');
  const scriptSrc = scriptSrcMatch[1];
  assert.ok(!scriptSrc.includes("'unsafe-inline'"), "vercel.json script-src must NOT contain 'unsafe-inline'");
  assert.ok(scriptSrc.includes('https://accounts.google.com/gsi/client'), 'vercel.json script-src must allow Google GSI client');
  assert.ok(scriptSrc.includes('https://appleid.cdn-apple.com'), 'vercel.json script-src must allow Apple ID CDN');
  assert.ok(cspHeader.includes('frame-src') && cspHeader.includes('https://accounts.google.com'), 'vercel.json CSP must allow Google/Apple frame-src');
  console.log('✔ Test 1 Passed: vercel.json CSP header is hardened and allows Google/Apple OAuth SDKs');

  // ---------------------------------------------------------------------------
  // TEST 2: supabaseClient.ts OAuth Demo/Simulated Fallback Guard
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: supabaseClient.ts OAuth fallback guard ---');
  const supaClientCode = fs.readFileSync(path.join(rootDir, 'src', 'services', 'supabaseClient.ts'), 'utf8');
  assert.ok(
    supaClientCode.includes('!isDemoSessionActive()') && supaClientCode.includes('!options?.email'),
    'supabaseClient.ts signInWithOAuth must guard Supabase redirect with !isDemoSessionActive() && !options?.email'
  );
  console.log('✔ Test 2 Passed: supabaseClient.ts properly guards Supabase OAuth redirect in demo/fallback mode');

  // ---------------------------------------------------------------------------
  // Setup Express test server for TEST 3 (switchRouter) & TEST 4 (operationsRouter)
  // ---------------------------------------------------------------------------
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/switch', switchRouter);
  app.use('/api/operations', operationsRouter);

  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    const brokerValentina = users.find(u => u.id === 'user-op-3'); // role: 'broker'
    const operatorChiara = users.find(u => u.id === 'user-op-2'); // role: 'operator'
    const adminMatteo = users.find(u => u.id === 'user-admin-1'); // role: 'admin'
    const valentinaToken = generateToken({ userId: brokerValentina.id, email: brokerValentina.email, role: brokerValentina.role });
    const chiaraToken = generateToken({ userId: operatorChiara.id, email: operatorChiara.email, role: operatorChiara.role });
    const adminToken = generateToken({ userId: adminMatteo.id, email: adminMatteo.email, role: adminMatteo.role });

    const unassignedCust = customers.find(c => c.id === 'cust-2'); // Assigned to Alessandro Mori
    assert.ok(unassignedCust, 'cust-2 must exist');

    // -------------------------------------------------------------------------
    // TEST 3: switch.ts Multi-Tenant Broker/Operator IDOR Prevention
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: switch.ts Multi-Tenant Broker & Operator IDOR Isolation ---');

    // 3a. Operator Chiara querying GET /api/switch/audit should only see her assigned customers (not cust-2 or Valentina's cust-1)
    const auditChiaraRes = await fetch(`${baseUrl}/switch/audit`, {
      headers: { Authorization: `Bearer ${chiaraToken}` }
    });
    assert.equal(auditChiaraRes.status, 200);
    const auditChiaraData = await auditChiaraRes.json();
    assert.ok(
      !auditChiaraData.audits.some(a => a.customerId === 'cust-2' || a.customerId === 'cust-1'),
      'Operator must NOT see switch audits for customers assigned to other brokers'
    );

    // 3b. Broker Valentina attempting POST /api/switch/sign for unassigned customer cust-2 must be rejected with 403
    const signUnassignedRes = await fetch(`${baseUrl}/switch/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${valentinaToken}`
      },
      body: JSON.stringify({
        customerId: unassignedCust.id,
        customerName: unassignedCust.name,
        signerFiscalCode: unassignedCust.fiscalCode,
        phone: unassignedCust.phone,
        signatureType: 'canvas',
        canvasDataUrl: VALID_1X1_PNG_DATA_URL,
        offerId: 'off-luce-1',
        supplier: 'Octopus Energy',
        utilityPointId: unassignedCust.utilityPoints[0].id,
        podOrPdr: unassignedCust.utilityPoints[0].podOrPdr,
        consentVersion: 'v1.0-arera-2026'
      })
    });
    assert.equal(
      signUnassignedRes.status,
      403,
      `Broker must NOT sign contract for unassigned customer cust-2. Got status ${signUnassignedRes.status}`
    );

    // 3c. Broker Valentina attempting POST /api/switch/signatures/:id/activate for unassigned customer cust-2 must be rejected with 403
    const fakeSigId = `sig-unassigned-${Date.now()}`;
    await addSignatureLog({
      id: fakeSigId,
      customerId: unassignedCust.id,
      customerName: unassignedCust.name,
      signerFiscalCode: unassignedCust.fiscalCode,
      phone: unassignedCust.phone,
      signatureType: 'canvas',
      canvasDataUrl: VALID_1X1_PNG_DATA_URL,
      canvasHash: 'abc123hash',
      offerId: 'off-luce-1',
      supplier: 'Octopus Energy',
      utilityPointId: unassignedCust.utilityPoints[0].id,
      podOrPdr: unassignedCust.utilityPoints[0].podOrPdr,
      energyType: 'luce',
      offerSnapshot: {
        id: 'off-luce-1',
        supplier: 'Octopus Energy',
        name: 'Octopus Fissa 12M',
        energyType: 'luce',
        pricingType: 'fixed',
        unitPriceOrSpread: 0.118,
        fixedAnnualFee: 96,
        durationMonths: 12,
        greenCertified: true,
        tag: 'Prezzo Fisso Competitivo'
      },
      originalPointSnapshot: JSON.parse(JSON.stringify(unassignedCust.utilityPoints[0])),
      consentVersion: 'v1.0',
      canonicalDocument: {},
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1',
      status: 'signed',
      activationStatus: 'pending_activation',
      signatureHash: 'sig-hash-123',
      documentHash: 'doc-hash-123'
    });

    const activateUnassignedRes = await fetch(`${baseUrl}/switch/signatures/${fakeSigId}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${valentinaToken}`
      },
      body: JSON.stringify({
        confirmationReference: 'REF-UNASSIGNED-001',
        activationDate: '2026-11-01',
        generateCommission: false
      })
    });
    assert.equal(
      activateUnassignedRes.status,
      403,
      `Broker must NOT activate signature for unassigned customer cust-2. Got status ${activateUnassignedRes.status}`
    );
    console.log('✔ Test 3 Passed: switch.ts enforces strict multi-tenant broker/operator isolation on audit, sign, and activate');

    // -------------------------------------------------------------------------
    // TEST 4: operations.ts Multi-Tenant Appointment Isolation
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: operations.ts Multi-Tenant Appointment Isolation ---');
    const valentinaApptId = `appt-val-${Date.now()}`;
    const otherApptId = `appt-other-${Date.now()}`;

    await saveAppointment({
      id: valentinaApptId,
      leadId: 'lead-val-1',
      customerName: 'Cliente Valentina',
      phone: '+39 333 1112223',
      city: 'Firenze',
      agentName: 'Valentina Neri',
      scheduledAt: '2026-10-20T10:00:00.000Z',
      durationMinutes: 30,
      type: 'phone_consultation',
      status: 'scheduled',
      notes: 'Appuntamento Valentina'
    });

    await saveAppointment({
      id: otherApptId,
      leadId: 'lead-other-99',
      customerName: 'Cliente Altro Broker',
      phone: '+39 333 9998887',
      city: 'Roma',
      agentName: 'Chiara Bianchi',
      scheduledAt: '2026-10-21T14:00:00.000Z',
      durationMinutes: 45,
      type: 'video_call',
      status: 'scheduled',
      notes: 'Appuntamento Chiara'
    });

    // 4a. Broker Valentina listing appointments only sees her own appointment, not Chiara's
    const valApptsRes = await fetch(`${baseUrl}/operations/appointments`, {
      headers: { Authorization: `Bearer ${valentinaToken}` }
    });
    assert.equal(valApptsRes.status, 200);
    const valApptsData = await valApptsRes.json();
    const valApptIds = valApptsData.appointments.map(a => a.id);
    assert.ok(valApptIds.includes(valentinaApptId), 'Broker Valentina must see her own appointment');
    assert.ok(!valApptIds.includes(otherApptId), "Broker Valentina must NOT see Chiara Bianchi's appointment");

    // 4b. Broker Valentina attempting to PATCH status of Chiara's appointment gets 403
    const patchOtherRes = await fetch(`${baseUrl}/operations/appointments/${otherApptId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${valentinaToken}`
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    assert.equal(
      patchOtherRes.status,
      403,
      `Broker must NOT modify status of another broker's appointment. Got status ${patchOtherRes.status}`
    );

    // 4c. Admin sees both appointments
    const adminApptsRes = await fetch(`${baseUrl}/operations/appointments`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminApptsRes.status, 200);
    const adminApptsData = await adminApptsRes.json();
    const adminApptIds = adminApptsData.appointments.map(a => a.id);
    assert.ok(adminApptIds.includes(valentinaApptId) && adminApptIds.includes(otherApptId), 'Admin must see all appointments');

    console.log('✔ Test 4 Passed: operations.ts isolates broker/operator appointments and blocks cross-broker status updates');
    console.log('\n🎉 ALL AUDIT 2026-10-16 HARDENING TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

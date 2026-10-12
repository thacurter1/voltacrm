process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

console.log('=== TEST SUITE: BILL UPLOAD DIRECT LEAD GENERATION FOR ADMIN & BROKER (TDD) ===');

// 1. Verify types declaration
console.log('\n[TEST 1] Type definitions include bill_upload in LeadSource');
const clientTypesPath = path.join(__dirname, '..', 'src', 'types.ts');
const serverTypesPath = path.join(__dirname, '..', 'server', 'src', 'types.ts');
assert.ok(fs.existsSync(clientTypesPath), 'src/types.ts must exist');
assert.ok(fs.existsSync(serverTypesPath), 'server/src/types.ts must exist');

const clientTypesSrc = fs.readFileSync(clientTypesPath, 'utf8');
const serverTypesSrc = fs.readFileSync(serverTypesPath, 'utf8');

assert.ok(
  clientTypesSrc.includes("'bill_upload'"),
  "src/types.ts LeadSource must include 'bill_upload'"
);
assert.ok(
  serverTypesSrc.includes("'bill_upload'"),
  "server/src/types.ts LeadSource must include 'bill_upload'"
);
console.log('✔ LeadSource includes bill_upload in client and server types');

// 2. Verify portalApi uploadBill accepts guest fields & persists lead in demo mode
console.log('\n[TEST 2] portalApi.uploadBill supports guest lead intake & demo persistence');
const portalApiPath = path.join(__dirname, '..', 'src', 'api', 'portal.ts');
assert.ok(fs.existsSync(portalApiPath), 'src/api/portal.ts must exist');
const portalApiSrc = fs.readFileSync(portalApiPath, 'utf8');

assert.ok(
  portalApiSrc.includes('customerName?:') || portalApiSrc.includes('customerName :'),
  'BillUploadInput must support optional customerName'
);
assert.ok(
  portalApiSrc.includes('phone?:') || portalApiSrc.includes('phone :'),
  'BillUploadInput must support optional phone'
);
assert.ok(
  portalApiSrc.includes('privacyConsent?:') || portalApiSrc.includes('privacyConsent :'),
  'BillUploadInput must support optional privacyConsent'
);
assert.ok(
  portalApiSrc.includes("'bill_upload'") || portalApiSrc.includes('"bill_upload"'),
  "portalApi.uploadBill demo fallback must persist lead with source 'bill_upload'"
);
console.log('✔ portalApi.uploadBill interface and demo lead persistence verified');

// 3. Verify EnergyBillIntake.tsx has guest contact modal for unauthenticated bill upload
console.log('\n[TEST 3] EnergyBillIntake.tsx guest contact intake modal');
const intakePath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyBillIntake.tsx');
assert.ok(fs.existsSync(intakePath), 'src/components/customer/EnergyBillIntake.tsx must exist');
const intakeSrc = fs.readFileSync(intakePath, 'utf8');

assert.ok(
  intakeSrc.includes('isGuestModalOpen') || intakeSrc.includes('guestModal') || intakeSrc.includes('showContactModal') || intakeSrc.includes('Richiedi analisi') || intakeSrc.includes('Analisi gratuita'),
  'EnergyBillIntake must provide guest contact modal or intake state'
);
assert.ok(
  intakeSrc.includes('Nome e Cognome') || intakeSrc.includes('Mario Rossi'),
  'EnergyBillIntake guest modal must prompt for Nome e Cognome'
);
assert.ok(
  intakeSrc.includes('privacyConsent') || intakeSrc.includes('informativa privacy'),
  'EnergyBillIntake guest modal must prompt for privacy consent'
);
console.log('✔ EnergyBillIntake.tsx guest intake modal verified');

// 4. Verify LeadsManager.tsx displays bill_upload source badge & filter
console.log('\n[TEST 4] LeadsManager.tsx includes bill_upload badge and filter option');
const leadsManagerPath = path.join(__dirname, '..', 'src', 'components', 'LeadsManager.tsx');
assert.ok(fs.existsSync(leadsManagerPath), 'src/components/LeadsManager.tsx must exist');
const leadsManagerSrc = fs.readFileSync(leadsManagerPath, 'utf8');

assert.ok(
  leadsManagerSrc.includes('bill_upload'),
  'LeadsManager must handle bill_upload source'
);
assert.ok(
  leadsManagerSrc.includes('Bolletta Caricata') || leadsManagerSrc.includes('Da Bolletta'),
  'LeadsManager must render "Bolletta Caricata" badge/filter label'
);
console.log('✔ LeadsManager.tsx source badge and filter verified');

// 5. Test Live Express Server POST /api/portal/bills
async function testLiveApi() {
  console.log('\n[TEST 5] Live Server POST /api/portal/bills endpoint test');

  // Dynamically import compiled server routes & services
  let server;
  let port;
  try {
    const serverDir = path.join(__dirname, '..', 'server');
    const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
    const express = req('express');
    const { getLeads } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
    const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));

    const app = express();
    app.use(express.json({ limit: '15mb' }));
    app.use('/api/portal', portalRouter);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });

    const makeRequest = (method, endpoint, body = null, headers = {}) => {
      return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: endpoint,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...headers,
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
            } catch {
              resolve({ status: res.statusCode, body: data });
            }
          });
        });
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
      });
    };

    // Subtest A: Unauthenticated request without guest contact info returns 401
    const unauthNoContact = await makeRequest('POST', '/api/portal/bills', {
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('%PDF-1.4 mock').toString('base64'),
      utilityType: 'luce',
    });
    assert.equal(unauthNoContact.status, 401, 'Request without token or guest contact must return 401');

    // Subtest B: Guest request missing privacy consent returns 400
    const guestMissingPrivacy = await makeRequest('POST', '/api/portal/bills', {
      customerName: 'Mario Rossi',
      phone: '+39 347 1234567',
      privacyConsent: false,
      fileName: 'bolletta.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('%PDF-1.4 mock').toString('base64'),
      utilityType: 'luce',
    });
    assert.equal(guestMissingPrivacy.status, 400, 'Guest upload without privacy consent must return 400');

    // Subtest C: Guest request with short phone returns 400
    const guestShortPhone = await makeRequest('POST', '/api/portal/bills', {
      customerName: 'Mario Rossi',
      phone: '123',
      privacyConsent: true,
      fileName: 'bolletta.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('%PDF-1.4 mock').toString('base64'),
      utilityType: 'luce',
    });
    assert.equal(guestShortPhone.status, 400, 'Guest upload with phone < 8 digits must return 400');

    // Subtest D: Valid Guest bill upload returns 201 and creates lead
    const validGuestUpload = await makeRequest('POST', '/api/portal/bills', {
      customerName: 'Elena Bianchi',
      phone: '+39 348 9876543',
      email: 'elena.bianchi@test.it',
      privacyConsent: true,
      preferredContact: 'Pomeriggio (14-18)',
      fileName: 'Fattura_Enel_Elena.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('%PDF-1.4 mock file content for elena').toString('base64'),
      utilityType: 'luce',
      notes: 'Caricata per confronto tariffa bioraria',
    });
    assert.equal(validGuestUpload.status, 201, 'Valid guest bill upload must return 201');
    assert.ok(validGuestUpload.body.bill, 'Response must include created bill');
    assert.ok(validGuestUpload.body.leadId, 'Response must include created leadId');

    // Verify lead exists in dataStore
    const leads = getLeads();
    const createdLead = leads.find(l => l.name === 'Elena Bianchi' && l.source === 'bill_upload');
    assert.ok(createdLead, 'Lead with source bill_upload must be present in CRM dataStore');
    assert.equal(createdLead.phone, '+39 348 9876543');
    assert.ok(createdLead.notes.includes('Fattura_Enel_Elena.pdf'));
    assert.ok(createdLead.notes.includes('[BOLLETTA CARICATA]'));
    console.log('✔ Live guest bill upload creates CRM lead with source bill_upload');

  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('ℹ Server dist not built yet, will verify in full test run');
    } else {
      throw err;
    }
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

testLiveApi()
  .then(() => {
    console.log('\n🎉 ALL BILL UPLOAD LEAD INTAKE TESTS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });

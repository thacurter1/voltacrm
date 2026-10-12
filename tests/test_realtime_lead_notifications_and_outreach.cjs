process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'realtime-lead-notifications-jwt-secret-at-least-32-chars';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

console.log('=== TEST SUITE: REAL-TIME NOTIFICATIONS & 1-CLICK OUTREACH (TDD RED PHASE) ===');

// 1. Verify types declaration includes consultation_requested
console.log('\n[TEST 1] Type definitions include consultation_requested in NotificationType');
const clientTypesPath = path.join(__dirname, '..', 'src', 'types.ts');
const serverTypesPath = path.join(__dirname, '..', 'server', 'src', 'types.ts');
assert.ok(fs.existsSync(clientTypesPath), 'src/types.ts must exist');
assert.ok(fs.existsSync(serverTypesPath), 'server/src/types.ts must exist');

const clientTypesSrc = fs.readFileSync(clientTypesPath, 'utf8');
const serverTypesSrc = fs.readFileSync(serverTypesPath, 'utf8');

assert.ok(
  clientTypesSrc.includes("'consultation_requested'"),
  "src/types.ts NotificationType must include 'consultation_requested'"
);
assert.ok(
  serverTypesSrc.includes("'consultation_requested'"),
  "server/src/types.ts NotificationType must include 'consultation_requested'"
);
console.log('✔ NotificationType includes consultation_requested in client and server types');

// 2. Verify LeadsManager.tsx contains 1-click WhatsApp outreach action
console.log('\n[TEST 2] LeadsManager.tsx 1-click WhatsApp outreach action');
const leadsManagerPath = path.join(__dirname, '..', 'src', 'components', 'LeadsManager.tsx');
assert.ok(fs.existsSync(leadsManagerPath), 'src/components/LeadsManager.tsx must exist');
const leadsManagerSrc = fs.readFileSync(leadsManagerPath, 'utf8');

assert.ok(
  leadsManagerSrc.includes('wa.me') || leadsManagerSrc.includes('whatsapp') || leadsManagerSrc.includes('WhatsApp'),
  'LeadsManager must render WhatsApp outreach button/action'
);
assert.ok(
  leadsManagerSrc.includes('MessageSquare') || leadsManagerSrc.includes('MessageCircle') || leadsManagerSrc.includes('WhatsApp'),
  'LeadsManager must include icon or label for WhatsApp'
);
console.log('✔ LeadsManager 1-click WhatsApp action verified');

// 3. Test Live Express Server POST /consultations and POST /bills generate notifications
async function testLiveNotifications() {
  console.log('\n[TEST 3] Live Server generates notifications on consultation and bill upload');

  const serverDir = path.join(__dirname, '..', 'server');
  const req = require('node:module').createRequire(path.join(serverDir, 'package.json'));
  const express = req('express');
  const { getNotifications } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
  const { portalRouter } = require(path.join(serverDir, 'dist', 'routes', 'portal.js'));

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/portal', portalRouter);

  let server;
  let port;
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  const makeRequest = (method, endpoint, body) => {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const reqHttp = http.request({
        hostname: '127.0.0.1',
        port,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      reqHttp.on('error', reject);
      reqHttp.write(payload);
      reqHttp.end();
    });
  };

  try {
    // Subtest A: Guest Consultation creates notification
    const resConsultation = await makeRequest('POST', '/api/portal/consultations', {
      customerName: 'Francesca Neri',
      phone: '+39 347 5566778',
      email: 'francesca.neri@test.it',
      privacyConsent: true,
      offerId: 'off-luce-1',
      offerName: 'Octopus Fissa 12M',
      supplier: 'Octopus Energy',
      utilityType: 'luce',
      annualConsumption: 2400,
    });
    assert.equal(resConsultation.status, 201, 'Consultation request must return 201');

    const notifsAfterConsultation = getNotifications();
    const consultationNotif = notifsAfterConsultation.find(n => 
      n.title.toLowerCase().includes('consulenza') || (n.message && n.message.includes('Francesca Neri'))
    );
    assert.ok(consultationNotif, 'A notification must be created when a consultation is submitted');
    assert.equal(consultationNotif.priority, 'urgent', 'Consultation notification must have urgent priority');
    assert.equal(consultationNotif.actionTab, 'leads', 'Notification actionTab must be leads');
    console.log('✔ Consultation request triggers urgent notification for staff');

    // Subtest B: Guest Bill Upload creates notification
    const resBill = await makeRequest('POST', '/api/portal/bills', {
      customerName: 'Roberto Conti',
      phone: '+39 349 1122334',
      privacyConsent: true,
      fileName: 'Fattura_Gas_Eni_Roberto.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('%PDF-1.4 mock pdf').toString('base64'),
      utilityType: 'gas',
    });
    assert.equal(resBill.status, 201, 'Bill upload must return 201');

    const notifsAfterBill = getNotifications();
    const billNotif = notifsAfterBill.find(n => 
      n.type === 'bill_uploaded' && n.message && n.message.includes('Roberto Conti')
    );
    assert.ok(billNotif, 'A notification with type bill_uploaded must be created on bill upload');
    assert.equal(billNotif.priority, 'urgent', 'Bill uploaded notification must have urgent priority');
    assert.equal(billNotif.actionTab, 'leads', 'Notification actionTab must be leads');
    console.log('✔ Bill upload triggers urgent notification for staff');

  } finally {
    if (server) {
      await new Promise(r => server.close(r));
    }
  }
}

testLiveNotifications()
  .then(() => {
    console.log('\n🎉 ALL REALTIME NOTIFICATIONS & OUTREACH CHECKS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'utm-attribution-sharing-test-jwt-secret-32-chars';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

console.log('=== TEST SUITE: UTM ATTRIBUTION TRACKING & 1-CLICK OFFER SHARING (TDD RED PHASE) ===');

// 1. Verify EnergyOfferDetails contains "Condividi Stima" action
console.log('\n[TEST 1] EnergyOfferDetails.tsx contains Condividi Stima sharing action');
const offerDetailsPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyOfferDetails.tsx');
assert.ok(fs.existsSync(offerDetailsPath), 'EnergyOfferDetails.tsx must exist');
const offerDetailsSrc = fs.readFileSync(offerDetailsPath, 'utf8');

assert.ok(
  offerDetailsSrc.includes('Condividi Stima') || offerDetailsSrc.includes('Condividi stima') || offerDetailsSrc.includes('Condividi'),
  'EnergyOfferDetails must render sharing button'
);
assert.ok(
  offerDetailsSrc.includes('Share2') || offerDetailsSrc.includes('Share'),
  'EnergyOfferDetails must include share icon'
);
assert.ok(
  offerDetailsSrc.includes('navigator.clipboard') || offerDetailsSrc.includes('navigator.share'),
  'EnergyOfferDetails must support clipboard copying or web share API'
);
console.log('✔ EnergyOfferDetails sharing button and clipboard/web share integration verified');

// 2. Verify CustomerApp parses UTM query parameters
console.log('\n[TEST 2] CustomerApp.tsx parses UTM parameters from URL search params');
const customerAppPath = path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx');
assert.ok(fs.existsSync(customerAppPath), 'CustomerApp.tsx must exist');
const customerAppSrc = fs.readFileSync(customerAppPath, 'utf8');

assert.ok(
  customerAppSrc.includes('utm_source') || customerAppSrc.includes('utmSource'),
  'CustomerApp must parse utm_source parameter'
);
assert.ok(
  customerAppSrc.includes('utm_campaign') || customerAppSrc.includes('utmCampaign'),
  'CustomerApp must parse utm_campaign parameter'
);
console.log('✔ CustomerApp UTM search params parsing verified');

// 3. Test Live Server stores UTM Campaign attribution in Lead notes
async function testLiveUtmAttribution() {
  console.log('\n[TEST 3] Live Server stores UTM campaign attribution in lead notes');

  const serverDir = path.join(__dirname, '..', 'server');
  const reqMod = require('node:module').createRequire(path.join(serverDir, 'package.json'));
  const express = reqMod('express');
  const { getLeads } = require(path.join(serverDir, 'dist', 'services', 'dataStore.js'));
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
    // Subtest A: Consultation with UTM tags
    const resConsultation = await makeRequest('POST', '/api/portal/consultations', {
      customerName: 'Mario Rossi Meta Lead',
      phone: '+39 347 1122334',
      privacyConsent: true,
      offerId: 'off-luce-1',
      utilityType: 'luce',
      utmSource: 'meta_ads',
      utmCampaign: 'campagna_primavera_luce',
      utmMedium: 'cpc',
    });
    assert.equal(resConsultation.status, 201, 'Consultation request must return 201');

    const leads = getLeads();
    const metaLead = leads.find(l => l.name === 'Mario Rossi Meta Lead');
    assert.ok(metaLead, 'Lead must exist in dataStore');
    assert.ok(
      metaLead.notes && metaLead.notes.includes('meta_ads') && metaLead.notes.includes('campagna_primavera_luce'),
      'Lead notes must include UTM attribution info for marketing analytics'
    );
    console.log('✔ Consultation lead records marketing UTM attribution in CRM notes');

    // Subtest B: Bill Upload with UTM tags
    const resBill = await makeRequest('POST', '/api/portal/bills', {
      customerName: 'Laura Bianchi Google Lead',
      phone: '+39 349 9988776',
      privacyConsent: true,
      fileName: 'Bolletta_Google_Ads.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('%PDF-1.4 mock pdf').toString('base64'),
      utilityType: 'gas',
      utmSource: 'google_ads',
      utmCampaign: 'search_brand_gas',
    });
    assert.equal(resBill.status, 201, 'Bill upload must return 201');

    const googleLead = getLeads().find(l => l.name === 'Laura Bianchi Google Lead');
    assert.ok(googleLead, 'Bill lead must exist in dataStore');
    assert.ok(
      googleLead.notes && googleLead.notes.includes('google_ads') && googleLead.notes.includes('search_brand_gas'),
      'Bill upload lead notes must include UTM attribution info for marketing analytics'
    );
    console.log('✔ Bill upload lead records marketing UTM attribution in CRM notes');

  } finally {
    if (server) {
      await new Promise(r => server.close(r));
    }
  }
}

testLiveUtmAttribution()
  .then(() => {
    console.log('\n🎉 ALL UTM ATTRIBUTION & SHARING TESTS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });

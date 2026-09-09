// test_commissions.cjs - Automated test suite for Commission Module (Punto 5)
const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== TEST SUITE: COMMISSIONS & SETTLEMENT ENGINE ===');

  // Test 1: GET /api/commissions/summaries
  console.log('\n--- TEST 1: GET /api/commissions/summaries ---');
  const res1 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/commissions/summaries',
    method: 'GET'
  });
  console.log('T1 Status:', res1.status);
  if (res1.status !== 200 || !res1.data || !res1.data.success || !Array.isArray(res1.data.summaries)) {
    throw new Error('Test 1 fallito: ' + JSON.stringify(res1.data || res1.raw));
  }
  console.log('Agenti trovati:', res1.data.summaries.length);
  console.log('Primo agente:', res1.data.summaries[0].agentName, 'Maturato:', res1.data.summaries[0].accruedAmountEur, '€');

  // Test 2: GET /api/commissions
  console.log('\n--- TEST 2: GET /api/commissions ---');
  const res2 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/commissions',
    method: 'GET'
  });
  console.log('T2 Status:', res2.status);
  if (res2.status !== 200 || !res2.data || !res2.data.success || !Array.isArray(res2.data.commissions)) {
    throw new Error('Test 2 fallito: ' + JSON.stringify(res2.data || res2.raw));
  }
  console.log('Totale record provvigioni:', res2.data.commissions.length);

  // Test 3: POST /api/commissions/generate (generazione su nuovo contratto)
  console.log('\n--- TEST 3: POST /api/commissions/generate ---');
  const res3 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/commissions/generate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId: 'contract-test-999',
    customerName: 'Azienda Test Srl',
    podOrPdr: 'IT001E99887766',
    utilityType: 'luce',
    customerType: 'business',
    annualConsumption: 25000
  });
  console.log('T3 Status:', res3.status);
  if (res3.status !== 200 && res3.status !== 201) {
    throw new Error('Test 3 fallito: ' + JSON.stringify(res3.data || res3.raw));
  }
  console.log('Provvigioni generate:', res3.data.records.length, 'Importo totale:', res3.data.totalEur, '€');

  // Test 4: POST /api/commissions/settle (liquidazione)
  console.log('\n--- TEST 4: POST /api/commissions/settle ---');
  // Trova provvigioni in stato accrued per Chiara
  const chiaraAccrued = res2.data.commissions.filter(c => c.agentId === 'user-op-2' && c.status === 'accrued');
  const idsToSettle = chiaraAccrued.slice(0, 2).map(c => c.id);
  
  const res4 = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/commissions/settle',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    agentId: 'user-op-2',
    commissionIds: idsToSettle,
    paymentReference: 'TEST-BONIFICO-SEP2026',
    notes: 'Distinta liquidazione automatica di test'
  });
  console.log('T4 Status:', res4.status);
  if (res4.status !== 200 || !res4.data || !res4.data.success || !res4.data.batch) {
    throw new Error('Test 4 fallito: ' + JSON.stringify(res4.data || res4.raw));
  }
  console.log('Batch generato con successo:', res4.data.batch.paymentReference, 'Importo:', res4.data.batch.totalAmountEur, '€');

  console.log('\n>>> ALL COMMISSION ENGINE TESTS PASSED! <<<');
}

runTests().catch(err => {
  console.error('Test fallito:', err.message);
  process.exit(1);
});

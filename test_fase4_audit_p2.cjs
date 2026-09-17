// test_fase4_audit_p2.cjs - Automated test suite for P2 & Remaining Audit Resolutions
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
  console.log('=== TEST SUITE: PHASE 4 AUDIT P2 RESOLUTIONS ===\n');

  // ----------------------------------------------------
  // TEST 1: [P2-SEC-01] Hardcoded JWT Secret in Production
  // ----------------------------------------------------
  console.log('--- TEST 1: [P2-SEC-01] JWT Secret Strictness in Production ---');
  const checkCode = `
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    process.env.VOLTA_DEMO_MODE = 'true';
    try {
      const { generateToken } = await import('./server/dist/middleware/auth.js');
      generateToken({ userId: '1', email: 'test@example.com', role: 'admin' });
      console.log('UNEXPECTED_SUCCESS');
    } catch (err) {
      if (err.message.includes('FATAL SECURITY ERROR: JWT_SECRET')) {
        console.log('EXPECTED_FATAL_ERROR');
      } else {
        console.log('WRONG_ERROR: ' + err.message);
      }
    }
  `;
  const jwtProc = spawnSync(process.execPath, ['--input-type=module', '-e', checkCode], {
    encoding: 'utf8'
  });
  const jwtOutput = (jwtProc.stdout || '') + (jwtProc.stderr || '');
  console.log('JWT Prod Test Output:', jwtOutput.trim());
  if (!jwtOutput.includes('EXPECTED_FATAL_ERROR')) {
    throw new Error('[P2-SEC-01] JWT secret fallback was NOT blocked in production mode!');
  }
  console.log('✅ [P2-SEC-01] Verified: Production mode strictly rejects missing JWT_SECRET.');

  // ----------------------------------------------------
  // Obtains Admin Token for API tests
  // ----------------------------------------------------
  console.log('\n--- AUTH: Ottenimento Token Admin ---');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login-operator',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'm.riva@voltagroup.it',
    password: 'admin123',
    totpCode: '123456'
  });
  const adminToken = loginRes.data?.token;
  if (!adminToken) {
    throw new Error('Impossibile ottenere token admin: ' + JSON.stringify(loginRes.data || loginRes.raw));
  }
  console.log('✅ Admin token ottenuto con successo.');

  // ----------------------------------------------------
  // TEST 2: [P2-BIZ-01] Idempotenza e integrità bonus Dual Fuel
  // ----------------------------------------------------
  console.log('\n--- TEST 2: [P2-BIZ-01] Idempotenza e integrità bonus Dual Fuel ---');
  const customerName = 'Famiglia Bianchi Test';
  const pod = 'IT001E' + Math.floor(10000000 + Math.random() * 90000000);
  const contractId = 'contract-dual-luce-' + Date.now();
  
  // Step 2a: Generate Luce commission with Dual Fuel
  const luceRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/commissions/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId,
    customerName,
    podOrPdr: pod,
    utilityType: 'luce',
    customerType: 'residential',
    annualConsumption: 2800,
    isDualFuel: true
  });
  
  if (luceRes.status !== 200 && luceRes.status !== 201) {
    throw new Error('Generazione provvigione Luce fallita: ' + JSON.stringify(luceRes.data));
  }
  const luceBonus = luceRes.data.records.find(r => r.type === 'bonus');
  if (!luceBonus || luceBonus.amountEur !== 25) {
    throw new Error('Primo contratto Dual Fuel deve contenere il bonus di 25€!');
  }
  console.log('Primo contratto (Luce) bonus assegnato: €' + luceBonus.amountEur);

  // Step 2b: Retry identico per la stessa fornitura (idempotenza anti-duplicazione)
  const retryRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/commissions/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    agentId: 'user-op-2',
    agentName: 'Chiara Bianchi (Consulente Senior)',
    contractId,
    customerName,
    podOrPdr: pod,
    utilityType: 'luce',
    customerType: 'residential',
    annualConsumption: 2800,
    isDualFuel: true
  });

  if (retryRes.status !== 200 && retryRes.status !== 201) {
    throw new Error('Retry provvigione fallito: ' + JSON.stringify(retryRes.data));
  }
  const bonusCount = retryRes.data.records.filter(r => r.type === 'bonus').length;
  if (bonusCount !== 1) {
    throw new Error(`Atteso esattamente 1 bonus dopo il retry, trovati: ${bonusCount}`);
  }
  console.log('Retry provvigionale convalidato: nessun bonus duplicato (esattamente 1 bonus)');
  console.log('✅ [P2-BIZ-01] Verified: Idempotenza provvigionale e protezione anti-duplicazione attiva.');

  // ----------------------------------------------------
  // TEST 3: [P2-DB-02] Pre-seeded Demo Bills in Portal Service
  // ----------------------------------------------------
  console.log('\n--- TEST 3: [P2-DB-02] Pre-seeded Demo Bills nel Portale Clienti ---');
  const billsRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/portal/bills?customerId=cust-1',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('Portal Bills Status:', billsRes.status);
  if (billsRes.status !== 200 || !billsRes.data || !Array.isArray(billsRes.data.bills)) {
    throw new Error('GET /api/portal/bills fallito: ' + JSON.stringify(billsRes.data));
  }
  const cust1Bills = billsRes.data.bills;
  console.log('Bollette trovate per cust-1:', cust1Bills.length);
  if (cust1Bills.length < 2) {
    throw new Error('Previste almeno 2 bollette precaricate per cust-1, trovate: ' + cust1Bills.length);
  }
  const bill1 = cust1Bills.find(b => b.id === 'bill-1');
  if (!bill1 || bill1.fileName !== 'Fattura_Enel_Luce_Maggio2026.pdf') {
    throw new Error('Bolletta bill-1 non trovata o incoerente: ' + JSON.stringify(bill1));
  }
  console.log('✅ [P2-DB-02] Verified: Bollette precaricate correttamente nel portale clienti.');

  // ----------------------------------------------------
  // TEST 4: [P1-DB-03] Database Schema Completeness
  // ----------------------------------------------------
  console.log('\n--- TEST 4: [P1-DB-03] Database Schema & RPC Integrity ---');
  const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const requiredTokens = [
    'public.commission_generations',
    'generation_id text references public.commission_generations(id)',
    'settlement_batch_id text references public.settlement_batches(id)',
    'public.portal_bills',
    'public.meter_readings',
    'public.sync_customer_after_signature_activation',
    'signature_activation_sync_customer',
    'public.generate_contract_commissions',
    'public.settle_commissions',
    'public.activate_signature_with_commissions'
  ];

  for (const token of requiredTokens) {
    if (!schemaContent.includes(token)) {
      throw new Error(`Token obbligatorio mancante nello schema SQL: ${token}`);
    }
  }
  console.log('✅ [P1-DB-03] Verified: Schema SQL include tutte le tabelle, chiavi esterne, trigger e RPC.');

  // ----------------------------------------------------
  // TEST 5: [P2-SEC-02] CSP Optimization in vercel.json
  // ----------------------------------------------------
  console.log('\n--- TEST 5: [P2-SEC-02] CSP Optimization in vercel.json ---');
  const vercelPath = path.join(__dirname, 'vercel.json');
  const vercelContent = fs.readFileSync(vercelPath, 'utf8');
  if (!vercelContent.includes("object-src 'none'") || !vercelContent.includes("base-uri 'self'")) {
    throw new Error("vercel.json CSP non contiene object-src 'none' o base-uri 'self'!");
  }
  console.log('✅ [P2-SEC-02] Verified: CSP vercel.json contiene object-src \'none\' e base-uri \'self\'.');

  console.log('\n🎉 ALL PHASE 4 AUDIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});

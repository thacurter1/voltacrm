const http = require('http');

function request(options, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...options.headers
      }
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, raw: b }); }
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== VERIFICA TDD: BLOCCO 3 (FINDINGS 8, 9, 10) ===\n');

  let failures = [];

  // Login Admin
  const adminLogin = await request({
    path: '/api/auth/login-operator',
    method: 'POST'
  }, {
    email: 'm.riva@voltagroup.it',
    password: 'admin123',
    totpCode: '123456'
  });
  const adminToken = adminLogin.data?.token;
  if (!adminToken) {
    console.error('Login admin fallito');
    process.exit(1);
  }
  const authHeader = { Authorization: `Bearer ${adminToken}` };

  // --- TEST 1 (Finding 10): Idempotenza generazione provvigioni ---
  console.log('--- Test 1.1 (Finding 10): Prima chiamata /api/commissions/generate ---');
  const contractId = 'CTR-IDEM-TEST-' + Date.now();
  const commPayload = {
    agentId: 'user-admin-1',
    agentName: 'Matteo Riva',
    contractId,
    customerName: 'Azienda Idempotente Srl',
    customerType: 'business',
    utilityType: 'luce',
    podOrPdr: 'IT001E99988877',
    annualConsumption: 12000,
    isDualFuel: false
  };

  const comm1 = await request({
    path: '/api/commissions/generate',
    method: 'POST',
    headers: authHeader
  }, commPayload);
  console.log('Prima chiamata status:', comm1.status, 'Record generati:', comm1.data?.records?.length);

  const commListBefore = await request({
    path: '/api/commissions?agentId=user-admin-1',
    method: 'GET',
    headers: authHeader
  });
  const countBefore = commListBefore.data?.commissions?.filter(c => c.contractId === contractId).length;

  console.log('--- Test 1.2 (Finding 10): Seconda chiamata (RETRY) identica /api/commissions/generate ---');
  const comm2 = await request({
    path: '/api/commissions/generate',
    method: 'POST',
    headers: authHeader
  }, commPayload);
  console.log('Seconda chiamata status:', comm2.status, 'Record restituiti:', comm2.data?.records?.length);

  const commListAfter = await request({
    path: '/api/commissions?agentId=user-admin-1',
    method: 'GET',
    headers: authHeader
  });
  const countAfter = commListAfter.data?.commissions?.filter(c => c.contractId === contractId).length;

  console.log(`Conteggio provvigioni per ${contractId}: Prima=${countBefore}, Dopo retry=${countAfter}`);
  if (countAfter !== countBefore) {
    failures.push(`Test 1 (Finding 10) FALLITO: Chiamate duplicate hanno generato record duplicati (${countBefore} -> ${countAfter}).`);
  }

  // --- TEST 2 (Finding 9): Conservazione firma Canvas su server ---
  console.log('--- Test 2 (Finding 9): POST /api/switch/sign con signatureType=canvas e tratto grafico ---');
  const canvasPayload = {
    customerId: 'cust-1',
    customerName: 'Andrea Moretti',
    signerFiscalCode: 'MRTNRA82M15F205X',
    phone: '+39 335 1122334',
    signatureType: 'canvas',
    canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    offerId: 'off-luce-1',
    supplier: 'Octopus Energy'
  };

  const canvasSignRes = await request({
    path: '/api/switch/sign',
    method: 'POST',
    headers: authHeader
  }, canvasPayload);
  console.log('Canvas sign status:', canvasSignRes.status, 'Data:', JSON.stringify(canvasSignRes.data));
  if (canvasSignRes.status !== 201 || !canvasSignRes.data?.signatureReceipt?.signatureHash) {
    failures.push(`Test 2 (Finding 9) FALLITO: Firma canvas respinta o priva di hash valido (status ${canvasSignRes.status}).`);
  }

  // --- TEST 3 (Finding 8): Creazione cliente con forniture utility_points ---
  console.log('--- Test 3 (Finding 8): POST /api/customers con utilityPoints ---');
  const newCustPayload = {
    name: 'Mario Test Persistenza',
    fiscalCode: 'TSTMRA80A01H501Z',
    phone: '+39 333 1122334',
    email: 'mario.test@persiste.it',
    city: 'Torino',
    utilityPoints: [
      {
        id: 'p-1',
        type: 'luce',
        podOrPdr: 'IT001E11223344',
        annualConsumption: 3200,
        powerKw: 4.5,
        currentSupplier: 'Enel',
        currentOfferName: 'Fissa',
        currentTariffType: 'fixed',
        currentUnitCost: 0.15,
        currentFixedFeeYear: 120
      }
    ]
  };

  const createCustRes = await request({
    path: '/api/customers',
    method: 'POST',
    headers: authHeader
  }, newCustPayload);
  console.log('Create customer status:', createCustRes.status);

  const createdId = createCustRes.data?.customer?.id;
  if (createCustRes.status !== 201 || !createdId) {
    failures.push(`Test 3 (Finding 8) FALLITO: Creazione cliente fallita (status ${createCustRes.status}).`);
  } else {
    // Verifica che GET /customers/:id restituisca le forniture
    const getCustRes = await request({
      path: `/api/customers/${createdId}`,
      method: 'GET',
      headers: authHeader
    });
    if (getCustRes.status !== 200 || !getCustRes.data?.customer?.utilityPoints?.length) {
      failures.push('Test 3 (Finding 8) FALLITO: Le forniture (utilityPoints) del cliente non sono state conservate.');
    }
  }

  console.log('\n========================================');
  if (failures.length > 0) {
    console.error(`❌ VERIFICA RED BLOCCO 3: ${failures.length} problemi riscontrati:`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 TUTTI I TEST BLOCCO 3 SONO PASSATI (GREEN)!');
    process.exit(0);
  }
}

run();

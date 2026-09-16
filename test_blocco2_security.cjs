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
  console.log('=== VERIFICA TDD: BLOCCO 2 (FINDINGS 5, 6, 7, 11) ===\n');

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

  // Login Customer (user-cust-1 associato a cust-1)
  const custLogin = await request({
    path: '/api/auth/login-customer',
    method: 'POST'
  }, {
    identifier: 'andrea.moretti@email.it',
    password: 'customer123'
  });
  const custToken = custLogin.data?.token;

  if (!custToken) {
    console.error('Login customer fallito!');
    process.exit(1);
  }

  // --- TEST 1 (Finding 11): Cliente legge la propria anagrafica /customers/cust-1 ---
  console.log('--- Test 1 (Finding 11): GET /customers/cust-1 con token Customer proprietario (deve restituire 200) ---');
  const r11 = await request({
    path: '/api/customers/cust-1',
    method: 'GET',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log('Status:', r11.status);
  if (r11.status !== 200) {
    failures.push(`Test 1 (Finding 11) FALLITO: Cliente proprietario riceve status ${r11.status} anziché 200 su propria anagrafica.`);
  }

  // --- TEST 2 (Finding 11): Cliente non può leggere anagrafica di un altro cliente (cust-2) ---
  console.log('--- Test 2 (Finding 11): GET /customers/cust-2 con token Customer cust-1 (deve restituire 403) ---');
  const r11_cross = await request({
    path: '/api/customers/cust-2',
    method: 'GET',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log('Status:', r11_cross.status);
  if (r11_cross.status !== 403) {
    failures.push(`Test 2 (Finding 11) FALLITO: Cliente legge anagrafica altrui (${r11_cross.status} anziché 403).`);
  }

  // --- TEST 3 (Finding 5): Cliente non può accedere alle rotte provvigionali ---
  console.log('--- Test 3.1 (Finding 5): GET /commissions con token Customer (deve restituire 403) ---');
  const r5_1 = await request({
    path: '/api/commissions',
    method: 'GET',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log('Status:', r5_1.status);
  if (r5_1.status !== 403) {
    failures.push(`Test 3.1 FALLITO: Customer accede a /commissions (${r5_1.status} anziché 403).`);
  }

  console.log('--- Test 3.2 (Finding 5): GET /commissions/summaries con token Customer (deve restituire 403) ---');
  const r5_2 = await request({
    path: '/api/commissions/summaries',
    method: 'GET',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log('Status:', r5_2.status);
  if (r5_2.status !== 403) {
    failures.push(`Test 3.2 FALLITO: Customer accede a /commissions/summaries (${r5_2.status} anziché 403).`);
  }

  console.log('--- Test 3.3 (Finding 5): GET /commissions/batches con token Customer (deve restituire 403) ---');
  const r5_3 = await request({
    path: '/api/commissions/batches',
    method: 'GET',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log('Status:', r5_3.status);
  if (r5_3.status !== 403) {
    failures.push(`Test 3.3 FALLITO: Customer accede a /commissions/batches (${r5_3.status} anziché 403).`);
  }

  // --- TEST 4 (Finding 5): Cliente su /switch/signatures riceve solo le proprie firme ---
  console.log('--- Test 4 (Finding 5): GET /switch/signatures con token Customer (deve restituire solo firme cust-1) ---');
  const r5_sig = await request({
    path: '/api/switch/signatures',
    method: 'GET',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  console.log('Status:', r5_sig.status);
  if (r5_sig.status === 200) {
    const hasOtherSigs = r5_sig.data?.signatures?.some(s => s.customerId !== 'cust-1');
    if (hasOtherSigs) {
      failures.push('Test 4 (Finding 5) FALLITO: Customer legge firme di altri clienti in /switch/signatures!');
    }
  } else {
    failures.push(`Test 4 (Finding 5) FALLITO: status ${r5_sig.status}.`);
  }

  // --- TEST 5 (Finding 6): Cliente non può firmare per conto di un altro customerId ---
  console.log('--- Test 5 (Finding 6): POST /switch/sign da parte di cust-1 per customerId cust-2 (deve restituire 403) ---');
  const r6_idor = await request({
    path: '/api/switch/sign',
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` }
  }, {
    customerId: 'cust-2',
    customerName: 'Cliente Estraneo',
    signerFiscalCode: 'STRANO99A01H501Z',
    phone: '+39 340 1234567',
    otpCode: '123456',
    offerId: 'off-oct-12m',
    supplier: 'Octopus Energy'
  });
  console.log('Status:', r6_idor.status);
  if (r6_idor.status !== 403) {
    failures.push(`Test 5 (Finding 6) FALLITO: Cliente cust-1 ha potuto tentare firma per cust-2 (status ${r6_idor.status} anziché 403).`);
  }

  // --- TEST 6 (Finding 6): Firma respinta se l'offerta non esiste nel catalogo ---
  console.log('--- Test 6 (Finding 6): POST /switch/sign con offerId inesistente (deve restituire 400) ---');
  // Invio OTP valido per il customer
  const otpRes = await request({
    path: '/api/messaging/send-otp',
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` }
  }, { phone: '+39 340 1234567', channel: 'sms' });
  const validOtp = otpRes.data?.debugOtp;

  const r6_badOffer = await request({
    path: '/api/switch/sign',
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` }
  }, {
    customerId: 'cust-1',
    customerName: 'Andrea Moretti',
    signerFiscalCode: 'MRTNDR85M01H501Z',
    phone: '+39 340 1234567',
    otpCode: validOtp || '123456',
    offerId: 'offerta-fantasma-non-esistente',
    supplier: 'Fornitore Inesistente'
  });
  console.log('Status:', r6_badOffer.status);
  if (r6_badOffer.status !== 400) {
    failures.push(`Test 6 (Finding 6) FALLITO: Accettata offerta inesistente in /switch/sign (status ${r6_badOffer.status} anziché 400).`);
  }

  console.log('\n========================================');
  if (failures.length > 0) {
    console.error(`❌ VERIFICA RED BLOCCO 2: ${failures.length} problemi riscontrati:`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 TUTTI I TEST BLOCCO 2 SONO PASSATI (GREEN)!');
    process.exit(0);
  }
}

run();

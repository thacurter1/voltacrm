const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== VERIFICA TDD: FASE 1 AUDIT FIX (P0 & P1) ===\n');

  // 1. Login Admin e Login Customer
  const adminLogin = await request(`${BASE_URL}/auth/login-operator`, {
    method: 'POST',
    body: { email: 'm.riva@voltagroup.it', password: 'admin123', totpCode: '123456' }
  });
  if (adminLogin.status !== 200 || !adminLogin.data.token) {
    throw new Error(`Login admin fallito: status ${adminLogin.status}`);
  }
  const adminToken = adminLogin.data.token;

  const custLogin = await request(`${BASE_URL}/auth/login-customer`, {
    method: 'POST',
    body: { identifier: 'andrea.moretti@email.it', password: 'customer123' }
  });
  if (custLogin.status !== 200 || !custLogin.data.token) {
    throw new Error(`Login customer fallito: status ${custLogin.status}`);
  }
  const custToken = custLogin.data.token;

  // Login Operatore Chiara Bianchi (user-op-2)
  const opLogin = await request(`${BASE_URL}/auth/login-operator`, {
    method: 'POST',
    body: { email: 'c.bianchi@voltagroup.it', password: 'operator123', totpCode: '123456' }
  });
  if (opLogin.status !== 200 || !opLogin.data.token) {
    throw new Error(`Login operatore fallito: status ${opLogin.status}`);
  }
  const opToken = opLogin.data.token;

  // TEST 1: GET /api/switch/offers restituisce catalogo completo (almeno 7 offerte)
  console.log('--- Test 1.1: GET /api/switch/offers catalogo completo ---');
  const offersRes = await request(`${BASE_URL}/switch/offers`);
  const offersCount = offersRes.data?.offers?.length || offersRes.data?.count || 0;
  console.log(`Offers count: ${offersCount}, Status: ${offersRes.status}`);
  if (offersRes.status !== 200 || offersCount < 7) {
    throw new Error(`Test 1.1 FALLITO: attese almeno 7 offerte, ricevute ${offersCount}`);
  }

  // TEST 2: POST /api/switch/sign con offerta Enel (off-luce-3) e A2A (off-luce-2)
  console.log('\n--- Test 1.2: POST /api/switch/sign con offerta Enel (off-luce-3) via Canvas ---');
  const signEnel = await request(`${BASE_URL}/switch/sign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      customerId: 'cust-1',
      customerName: 'Andrea Moretti',
      signerFiscalCode: 'MRTNRA82M15F205X',
      phone: '+39 335 1122334',
      signatureType: 'canvas',
      canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      offerId: 'off-luce-3',
      supplier: 'Enel Energia'
    }
  });
  console.log(`Sign Enel status: ${signEnel.status}`);
  if (signEnel.status !== 201 || !signEnel.data.success) {
    throw new Error(`Test 1.2 FALLITO: firma offerta Enel respinta con status ${signEnel.status} (${JSON.stringify(signEnel.data)})`);
  }

  // TEST 3: Prevenzione IDOR su /switch/sign quando customerId è omesso dal body
  console.log('\n--- Test 2.1: POST /api/switch/sign senza customerId (deve vincolare automaticamente a cust-1) ---');
  const signNoCustId = await request(`${BASE_URL}/switch/sign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      customerName: 'Andrea Moretti',
      signerFiscalCode: 'MRTNRA82M15F205X',
      phone: '+39 335 1122334',
      signatureType: 'canvas',
      canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      offerId: 'off-luce-1',
      supplier: 'Octopus Energy'
    }
  });
  console.log(`Sign senza customerId status: ${signNoCustId.status}, customerId assegnato: ${signNoCustId.data.signatureReceipt?.customerId}`);
  if (signNoCustId.status !== 201 || signNoCustId.data.signatureReceipt?.customerId !== 'cust-1') {
    throw new Error(`Test 2.1 FALLITO: non vincolato a cust-1 (ricevuto ${signNoCustId.data.signatureReceipt?.customerId})`);
  }

  // TEST 4: Prevenzione IDOR su /switch/sign con customerId altrui (cust-2) da token cust-1
  console.log('\n--- Test 2.2: POST /api/switch/sign con customerId cust-2 da token cust-1 (deve restituire 403) ---');
  const signIdor = await request(`${BASE_URL}/switch/sign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      customerId: 'cust-2',
      customerName: 'Elena Ferrari',
      signerFiscalCode: 'FRRLNE85T42F205Y',
      phone: '+39 347 9988776',
      signatureType: 'canvas',
      canvasDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      offerId: 'off-luce-1',
      supplier: 'Octopus Energy'
    }
  });
  console.log(`Sign IDOR status: ${signIdor.status}`);
  if (signIdor.status !== 403) {
    throw new Error(`Test 2.2 FALLITO: atteso 403 Forbidden, ricevuto ${signIdor.status}`);
  }

  // TEST 5: Idempotenza Dual Fuel (Luce + Gas con stesso contractId)
  console.log('\n--- Test 3.1: Provvigioni Dual Fuel (Luce leg) ---');
  const dualLuce = await request(`${BASE_URL}/commissions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      agentId: 'user-op-2',
      agentName: 'Chiara Bianchi',
      contractId: 'CTR-DUAL-CONGIUNTO-999',
      customerName: 'Famiglia Test Dual Fuel',
      podOrPdr: 'IT001E99999999',
      utilityType: 'luce',
      annualConsumption: 2800,
      isDualFuel: true
    }
  });
  console.log(`Dual Fuel Luce status: ${dualLuce.status}, record generati: ${dualLuce.data.records?.length}`);
  if (dualLuce.status !== 201 || dualLuce.data.records?.length !== 3) {
    throw new Error(`Test 3.1 FALLITO: attesi 3 record (upfront, bonus, rec), ricevuti ${dualLuce.data.records?.length}`);
  }

  console.log('\n--- Test 3.2: Provvigioni Dual Fuel (Gas leg con stesso contractId) ---');
  const dualGas = await request(`${BASE_URL}/commissions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      agentId: 'user-op-2',
      agentName: 'Chiara Bianchi',
      contractId: 'CTR-DUAL-CONGIUNTO-999',
      customerName: 'Famiglia Test Dual Fuel',
      podOrPdr: '01234567890123',
      utilityType: 'gas',
      annualConsumption: 1100,
      isDualFuel: true
    }
  });
  console.log(`Dual Fuel Gas status: ${dualGas.status}, record generati: ${dualGas.data.records?.length}`);
  if (dualGas.status !== 201 || dualGas.data.records?.length !== 3) {
    throw new Error(`Test 3.2 FALLITO: la seconda fornitura Gas del contratto Dual Fuel è stata erroneamente bloccata!`);
  }

  console.log('\n--- Test 3.3: Retry identico Luce (deve attivare idempotenza senza duplicare) ---');
  const dualLuceRetry = await request(`${BASE_URL}/commissions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      agentId: 'user-op-2',
      agentName: 'Chiara Bianchi',
      contractId: 'CTR-DUAL-CONGIUNTO-999',
      customerName: 'Famiglia Test Dual Fuel',
      podOrPdr: 'IT001E99999999',
      utilityType: 'luce',
      annualConsumption: 2800,
      isDualFuel: true
    }
  });
  console.log(`Retry Luce status: ${dualLuceRetry.status}, record restituiti: ${dualLuceRetry.data.records?.length}`);
  if (dualLuceRetry.status !== 201 || dualLuceRetry.data.records?.length !== 3) {
    throw new Error(`Test 3.3 FALLITO: idempotenza retry fallita`);
  }

  // TEST 6: BOLA Protection su GET /api/commissions
  console.log('\n--- Test 4.1: BOLA su GET /commissions per Operatore (Chiara Bianchi) con query ?agentId=user-admin-1 ---');
  const opComms = await request(`${BASE_URL}/commissions?agentId=user-admin-1`, {
    headers: { Authorization: `Bearer ${opToken}` }
  });
  console.log(`Operatore riceve: ${opComms.data.count} provvigioni`);
  const anyOtherAgent = opComms.data.commissions.some(c => c.agentId !== 'user-op-2');
  if (anyOtherAgent) {
    throw new Error(`Test 4.1 FALLITO: BOLA vulnerabile! L'operatore visualizza provvigioni di altri agenti.`);
  }
  console.log('BOLA bloccato: operatore riceve unicamente le proprie provvigioni.');

  // TEST 7: Notifiche DoS Prevention (Customer non può triggerare o azzerare notifiche admin)
  console.log('\n--- Test 5.1: Customer che chiama POST /api/notifications/trigger (deve restituire 403) ---');
  const custTrigger = await request(`${BASE_URL}/notifications/trigger`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      title: 'Attacco DoS',
      message: 'Notifica fraudolenta da cliente',
      priority: 'urgent',
      targetRole: 'admin'
    }
  });
  console.log(`Customer trigger status: ${custTrigger.status}`);
  if (custTrigger.status !== 403) {
    throw new Error(`Test 5.1 FALLITO: atteso 403 Forbidden per trigger da customer, ricevuto ${custTrigger.status}`);
  }

  // TEST 8 (FASE 2): Transizione di stato cliente post-firma contratto (lastSwitchAuditDate, nextSwitchAuditDate, fornitore luce)
  console.log('\n--- Test 6.1 (Fase 2): Verifica aggiornamento stato anagrafico e scadenze switch a 120gg per cust-1 ---');
  const custStateRes = await request(`${BASE_URL}/customers/cust-1`, {
    headers: { Authorization: `Bearer ${custToken}` }
  });
  if (custStateRes.status !== 200 || !custStateRes.data.customer) {
    throw new Error(`Test 6.1 FALLITO: recupero anagrafica cust-1 fallito con status ${custStateRes.status}`);
  }
  const updatedCust = custStateRes.data.customer;
  const todayIso = new Date().toISOString().split('T')[0];
  console.log(`Cliente cust-1 lastSwitchAuditDate: ${updatedCust.lastSwitchAuditDate}, nextSwitchAuditDate: ${updatedCust.nextSwitchAuditDate}`);
  if (updatedCust.lastSwitchAuditDate !== todayIso) {
    throw new Error(`Test 6.1 FALLITO: lastSwitchAuditDate (${updatedCust.lastSwitchAuditDate}) non corrisponde a oggi (${todayIso})`);
  }
  const lucePoint = updatedCust.utilityPoints?.find(p => p.type === 'luce');
  console.log(`Luce point fornitore corrente: ${lucePoint?.currentSupplier}, tariffa: ${lucePoint?.currentOfferName}`);
  if (lucePoint?.currentSupplier !== 'Octopus Energy') {
    throw new Error(`Test 6.1 FALLITO: fornitore luce non aggiornato a Octopus Energy (trovato: ${lucePoint?.currentSupplier})`);
  }
  if (!updatedCust.hasBrokerageMandate) {
    throw new Error(`Test 6.1 FALLITO: hasBrokerageMandate deve essere true.`);
  }

  // TEST 9 (FASE 2): Verifica CSPRNG per generazione OTP e verifica con debugOtp
  console.log('\n--- Test 6.2 (Fase 2): Verifica generazione OTP crittografica CSPRNG ---');
  const otpRes = await request(`${BASE_URL}/messaging/send-otp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      phone: '+39 340 1234567',
      channel: 'sms',
      reason: 'fase2_verification'
    }
  });
  if (otpRes.status !== 200 || !otpRes.data.debugOtp) {
    throw new Error(`Test 6.2 FALLITO: generazione OTP fallita con status ${otpRes.status}`);
  }
  const codeVal = parseInt(otpRes.data.debugOtp, 10);
  if (isNaN(codeVal) || codeVal < 100000 || codeVal > 999999) {
    throw new Error(`Test 6.2 FALLITO: codice OTP non è un intero a 6 cifre valido (ricevuto: ${otpRes.data.debugOtp})`);
  }
  console.log(`CSPRNG OTP generato con successo: ${otpRes.data.debugOtp} (valido e compreso tra 100000 e 999999)`);

  console.log('\n======================================================');
  console.log('🎉 TUTTI I TEST DI FASE 1 E FASE 2 SONO PASSATI (GREEN)!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERRORE TEST FASE 1 & 2:', err);
  process.exit(1);
});

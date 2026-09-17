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
  console.log('=== VERIFICA TDD: FASE 3 AUDIT FIX (P0 & P1) ===\n');

  // TEST 1: Registrazione cliente con Codice Fiscale già esistente (deve restituire 409 Conflict)
  console.log('--- Test 1: POST /api/auth/register-customer con CF duplicato (RSSMRA85M01H501Z) ---');
  const dupRes = await request(`${BASE_URL}/auth/register-customer`, {
    method: 'POST',
    body: {
      name: 'Mario Duplicato',
      email: 'mario.duplicato@test.it',
      phone: '+39 333 9998877',
      fiscalCode: 'MRTNRA82M15F205X', // Già presente nei mock
      password: 'StrongPassword123!'
    }
  });
  console.log('Duplicate CF status:', dupRes.status);
  if (dupRes.status !== 409) {
    throw new Error(`Expected status 409 Conflict, got ${dupRes.status}: ${JSON.stringify(dupRes.data)}`);
  }
  console.log('✔ Blocco Account Takeover verificato: duplicato respinto con 409 Conflict.');

  // TEST 2: Registrazione cliente nuovo e tentativo re-invio identico
  console.log('\n--- Test 2: Registrazione nuovo cliente e verifica collisione email ---');
  const uniqueEmail = `nuovo.cliente.${Date.now()}@example.com`;
  const uniqueCF = 'BNCLRA80A41H501Y';
  const regRes = await request(`${BASE_URL}/auth/register-customer`, {
    method: 'POST',
    body: {
      name: 'Laura Bianchi',
      email: uniqueEmail,
      phone: '+39 340 1234567',
      fiscalCode: uniqueCF,
      password: 'StrongPassword123!'
    }
  });
  console.log('New customer status:', regRes.status);
  if (regRes.status !== 201 || !regRes.data.token) {
    throw new Error(`Expected status 201, got ${regRes.status}: ${JSON.stringify(regRes.data)}`);
  }
  const customerToken = regRes.data.token;

  // Tentativo duplicazione con stessa email
  const dupEmailRes = await request(`${BASE_URL}/auth/register-customer`, {
    method: 'POST',
    body: {
      name: 'Impostore Email',
      email: uniqueEmail,
      phone: '+39 349 0000000',
      fiscalCode: 'XYZWRA99Z99Z999X',
      password: 'StrongPassword123!'
    }
  });
  console.log('Duplicate Email status:', dupEmailRes.status);
  if (dupEmailRes.status !== 409) {
    throw new Error(`Expected status 409 Conflict on duplicate email, got ${dupEmailRes.status}`);
  }
  console.log('✔ Blocco duplicazione email verificato: respinto con 409 Conflict.');

  // TEST 3: Invio OTP con numero non associato da token Customer (deve restituire 403 Forbidden)
  console.log('\n--- Test 3: POST /api/messaging/send-otp con numero non proprietario (BOLA check) ---');
  const bolaOtpRes = await request(`${BASE_URL}/messaging/send-otp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      phone: '+39 399 9999999', // Numero estraneo rispetto al registrato '+39 340 1234567'
      channel: 'sms',
      reason: 'digital_signature'
    }
  });
  console.log('BOLA OTP mismatch status:', bolaOtpRes.status);
  if (bolaOtpRes.status !== 403) {
    throw new Error(`Expected status 403 Forbidden on foreign phone, got ${bolaOtpRes.status}: ${JSON.stringify(bolaOtpRes.data)}`);
  }
  console.log('✔ Toll fraud / SMS bombing neutralizzato: respinto con 403 Forbidden.');

  // TEST 4: Invio OTP con numero proprio registrato (deve riuscire 200 OK)
  console.log('\n--- Test 4: POST /api/messaging/send-otp con numero proprietario del customer ---');
  const validOtpRes = await request(`${BASE_URL}/messaging/send-otp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      phone: '+39 340 1234567',
      channel: 'sms',
      reason: 'digital_signature'
    }
  });
  console.log('Valid customer OTP status:', validOtpRes.status);
  if (validOtpRes.status !== 200) {
    throw new Error(`Expected status 200 OK, got ${validOtpRes.status}: ${JSON.stringify(validOtpRes.data)}`);
  }
  console.log('✔ Invio OTP al recapito registrato autorizzato con 200 OK.');

  // TEST 5: Verifica presenza offerta Dolomiti nel catalogo backend
  console.log('\n--- Test 5: GET /api/switch/offers contiene offerta Dolomiti Energia ---');
  const offersRes = await request(`${BASE_URL}/switch/offers`);
  if (offersRes.status !== 200 || !Array.isArray(offersRes.data.offers)) {
    throw new Error(`Expected 200 OK from offers, got ${offersRes.status}`);
  }
  const hasDolomiti = offersRes.data.offers.some(o => o.id === 'off-luce-dolomiti');
  if (!hasDolomiti) {
    throw new Error('Offerta off-luce-dolomiti mancante nel catalogo switch/offers');
  }
  console.log('✔ Offerta Dolomiti Energia presente nel catalogo sincronizzato.');

  console.log('\n======================================================');
  console.log('🎉 TUTTI I TEST AUDIT V3 SONO PASSATI (GREEN)!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST AUDIT V3 FALLITO:', err);
  process.exit(1);
});

const http = require('http');
const crypto = require('crypto');

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

// Calcolo TOTP standard RFC 6238 HMAC-SHA1
function computeTotp(secret, stepOffset = 0, timeStep = 30) {
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / timeStep) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'utf-8'));
  hmac.update(buf);
  const digest = hmac.digest();
  
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

async function run() {
  console.log('=== VERIFICA TDD: BLOCCO 1 SICUREZZA (COMPLETA) ===\n');

  let failures = [];

  // TEST 1: GET /api/notifications deve richiedere autenticazione (NO bypass non autenticato)
  console.log('--- Test 1.1: GET /api/notifications senza token deve restituire 401 ---');
  const r1 = await request({ path: '/api/notifications', method: 'GET' });
  console.log('Status:', r1.status);
  if (r1.status !== 401) {
    failures.push(`Test 1.1 FALLITO: GET /api/notifications ha restituito ${r1.status} anziché 401.`);
  }

  console.log('--- Test 1.2: GET /api/notifications?role=admin senza token deve restituire 401 ---');
  const r1_2 = await request({ path: '/api/notifications?role=admin', method: 'GET' });
  console.log('Status:', r1_2.status);
  if (r1_2.status !== 401) {
    failures.push(`Test 1.2 FALLITO: GET /api/notifications?role=admin ha restituito ${r1_2.status} anziché 401.`);
  }

  // TEST 2: POST /api/messaging/send-otp con stringa arbitraria x-totem-token deve restituire 401
  console.log('--- Test 2.1: POST /api/messaging/send-otp con x-totem-token arbitrario "abcdefgh" deve fallire (401) ---');
  const r2_1 = await request({
    path: '/api/messaging/send-otp',
    method: 'POST',
    headers: { 'x-totem-token': 'abcdefgh' }
  }, { phone: '+39 340 1234567', channel: 'sms' });
  console.log('Status:', r2_1.status);
  if (r2_1.status !== 401) {
    failures.push(`Test 2.1 FALLITO: Token Totem arbitrario ha bypassato autenticazione su /send-otp (${r2_1.status} anziché 401).`);
  }

  // TEST 3: POST /api/messaging/send-otp NON deve MAI accettare token Totem (anche se valido per il Kiosk)
  console.log('--- Test 2.2: POST /api/messaging/send-otp con x-totem-token anche valido deve restituire 401 (Totem non autorizzato a inviare OTP) ---');
  const r2_2 = await request({
    path: '/api/messaging/send-otp',
    method: 'POST',
    headers: { 'x-totem-token': 'KIOSK-TOKEN-RETAIL-01' }
  }, { phone: '+39 340 1234567', channel: 'sms' });
  console.log('Status:', r2_2.status);
  if (r2_2.status !== 401) {
    failures.push(`Test 2.2 FALLITO: /send-otp ha accettato token Totem (${r2_2.status} anziché 401).`);
  }

  // TEST 4: POST /api/messaging/send-offer-whatsapp con token Totem non valido deve restituire 401
  console.log('--- Test 2.3: POST /api/messaging/send-offer-whatsapp con token Totem fasullo deve restituire 401 ---');
  const r2_3 = await request({
    path: '/api/messaging/send-offer-whatsapp',
    method: 'POST',
    headers: { 'x-totem-token': 'totem-fasullo-stringa' }
  }, {
    phone: '+39 340 9876543',
    customerName: 'Mario Rossi',
    savingsEur: 300,
    utilityType: 'luce',
    offerName: 'Offerta Test'
  });
  console.log('Status:', r2_3.status);
  if (r2_3.status !== 401) {
    failures.push(`Test 2.3 FALLITO: send-offer-whatsapp ha accettato token totem fasullo (${r2_3.status} anziché 401).`);
  }

  // TEST 5: POST /api/messaging/send-offer-whatsapp con token Totem VALIDO deve restituire 200
  console.log('--- Test 2.4: POST /api/messaging/send-offer-whatsapp con token Totem VALIDO deve restituire 200 ---');
  const r2_4 = await request({
    path: '/api/messaging/send-offer-whatsapp',
    method: 'POST',
    headers: { 'x-totem-token': 'KIOSK-TOKEN-RETAIL-01' }
  }, {
    phone: '+39 340 9876543',
    customerName: 'Mario Rossi',
    savingsEur: 300,
    utilityType: 'luce',
    offerName: 'Offerta Test'
  });
  console.log('Status:', r2_4.status);
  if (r2_4.status !== 200) {
    failures.push(`Test 2.4 FALLITO: send-offer-whatsapp con token totem valido ha restituito ${r2_4.status}.`);
  }

  // TEST 6: Notifiche non contengono codici OTP in chiaro
  console.log('--- Test 3.1: Verifica che le notifiche non contengano codici OTP in chiaro ---');
  const loginRes = await request({
    path: '/api/auth/login-operator',
    method: 'POST'
  }, {
    email: 'm.riva@voltagroup.it',
    password: 'admin123',
    totpCode: '123456'
  });
  const adminToken = loginRes.data?.token;

  if (adminToken) {
    await request({
      path: '/api/messaging/send-otp',
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, { phone: '+39 349 7788990', channel: 'sms' });

    const notifs = await request({
      path: '/api/notifications',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const leakedNotif = notifs.data?.notifications?.find(n =>
      n.message && /Codice \d{6} generato/.test(n.message)
    );
    if (leakedNotif) {
      failures.push(`Test 3.1 FALLITO: Notifica contiene OTP in chiaro nel messaggio: "${leakedNotif.message}"`);
    } else {
      console.log('Nessun OTP in chiaro nelle notifiche: OK.');
    }
  }

  // TEST 7: Login 2FA con TOTP RFC 6238 calcolato da secret
  console.log('--- Test 4.1: Login 2FA con codice TOTP RFC 6238 valido deve restituire 200 ---');
  const validTotp = computeTotp('VOLTA_ADMIN_SECRET_KEY_2FA_2026');
  const r4_1 = await request({
    path: '/api/auth/login-operator',
    method: 'POST'
  }, {
    email: 'm.riva@voltagroup.it',
    password: 'admin123',
    totpCode: validTotp
  });
  console.log('Status:', r4_1.status, 'Token ricevuto:', !!r4_1.data?.token);
  if (r4_1.status !== 200 || !r4_1.data?.token) {
    failures.push(`Test 4.1 FALLITO: Login con TOTP RFC 6238 valido ha restituito status ${r4_1.status}.`);
  }

  console.log('--- Test 4.2: Login 2FA con codice TOTP errato (999999) deve restituire 403 ---');
  const r4_2 = await request({
    path: '/api/auth/login-operator',
    method: 'POST'
  }, {
    email: 'm.riva@voltagroup.it',
    password: 'admin123',
    totpCode: '999999'
  });
  console.log('Status:', r4_2.status);
  if (r4_2.status !== 403) {
    failures.push(`Test 4.2 FALLITO: Login con TOTP errato ha restituito status ${r4_2.status} anziché 403.`);
  }

  console.log('--- Test 4.3: Profilo restituito non deve esporre twoFactorSecret ---');
  if (r4_1.data?.user?.twoFactorSecret) {
    failures.push('Test 4.3 FALLITO: twoFactorSecret è esposto nel profilo utente!');
  } else {
    console.log('twoFactorSecret protetto e non esposto: OK.');
  }

  console.log('\n========================================');
  if (failures.length > 0) {
    console.error(`❌ VERIFICA FALLITA: ${failures.length} errori:`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log('🎉 TUTTI I TEST DI SICUREZZA BLOCCO 1 SONO PASSATI (GREEN)!');
    process.exit(0);
  }
}

run();

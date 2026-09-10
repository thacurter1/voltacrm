const http = require('http');

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(opts, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, raw: b }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runOcrTests() {
  console.log('--- TEST 1: Chiamata non autenticata (deve fallire 401) ---');
  const unauthRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ocr/analyze-bill',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    base64Data: 'dGVzdA=='
  });
  console.log('Unauth Status:', unauthRes.status);
  if (unauthRes.status !== 401) {
    console.error('❌ Fallito: chiamata senza token doveva restituire 401');
    process.exit(1);
  }

  console.log('--- TEST 2: Login Operatore per ottenere JWT ---');
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
  const token = loginRes.data?.token;
  if (!token) {
    console.error('❌ Login operatore fallito per test OCR');
    process.exit(1);
  }

  console.log('--- TEST 3: Chiamata autenticata OCR con token valido ---');
  const authRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ocr/analyze-bill',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {
    fileName: 'Bolletta_Enel_Luce_Test.pdf',
    mimeType: 'application/pdf',
    base64Data: Buffer.from('PDF DEMO CONTENT FOR ENEL LUCE IT001E12345678 CF: RSSMRA80A01H501U').toString('base64')
  });

  console.log('STATUS:', authRes.status);
  console.log('BODY:', JSON.stringify(authRes.data, null, 2));
  if (authRes.status !== 200) {
    console.error('❌ Test OCR autenticato fallito con status:', authRes.status);
    process.exit(1);
  }
  console.log('>>> ALL OCR TESTS PASSED! <<<');
}

runOcrTests().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});

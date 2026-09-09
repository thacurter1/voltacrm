const http = require('http');

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
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
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- TEST 1: Invia OTP SMS ---');
  const t1 = await post('/api/messaging/send-otp', {
    phone: '+39 340 1234567',
    channel: 'sms',
    reason: 'digital_signature'
  });
  console.log('T1 Status:', t1.status, t1.data?.message || t1.raw);
  if (t1.status !== 200 && t1.status !== 201) {
    console.error('Test 1 fallito con status:', t1.status);
    process.exit(1);
  }

  const debugOtp = t1.data?.debugOtp;
  console.log('Debug OTP generato:', debugOtp);

  console.log('--- TEST 2: Verifica OTP Errato ---');
  const t2 = await post('/api/messaging/verify-otp', {
    phone: '+39 340 1234567',
    code: '000000'
  });
  console.log('T2 Status:', t2.status, t2.data?.message || t2.raw);
  if (t2.status !== 400) {
    console.error('Test 2 fallito: doveva essere 400');
    process.exit(1);
  }

  console.log('--- TEST 3: Verifica OTP Corretto ---');
  const t3 = await post('/api/messaging/verify-otp', {
    phone: '+39 340 1234567',
    code: debugOtp
  });
  console.log('T3 Status:', t3.status, t3.data?.message || t3.raw);
  if (t3.status !== 200) {
    console.error('Test 3 fallito: doveva essere 200');
    process.exit(1);
  }

  console.log('--- TEST 4: Invio Preventivo WhatsApp Totem ---');
  const t4 = await post('/api/messaging/send-offer-whatsapp', {
    phone: '+39 340 9876543',
    customerName: 'Marco Rossi',
    savingsEur: 420,
    utilityType: 'luce',
    offerName: 'Octopus Energy Relax'
  });
  console.log('T4 Status:', t4.status, t4.data?.message || t4.raw);
  if (t4.status !== 200) {
    console.error('Test 4 fallito: doveva essere 200');
    process.exit(1);
  }

  console.log('>>> ALL MESSAGING TESTS PASSED! <<<');
}

run();

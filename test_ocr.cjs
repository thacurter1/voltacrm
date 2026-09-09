const http = require('http');

function testOcrEndpoint() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      fileName: 'Bolletta_Enel_Luce_Test.pdf',
      mimeType: 'application/pdf',
      base64Data: Buffer.from('PDF DEMO CONTENT FOR ENEL LUCE IT001E12345678 CF: RSSMRA80A01H501U').toString('base64')
    });

    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/ocr/analyze-bill',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

testOcrEndpoint()
  .then(res => {
    console.log('STATUS:', res.status);
    console.log('BODY:', JSON.stringify(res.body, null, 2));
    if (res.status !== 200) {
      console.log('❌ TEST RED (Expected failure before implementation): Status is ' + res.status);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });

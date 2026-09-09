const http = require('http');

function get(path) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: 5000, path }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch { resolve({ status: res.statusCode, raw: b }); }
      });
    }).on('error', err => resolve({ status: 500, error: err.message }));
  });
}

function post(path, body = {}) {
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
  console.log('--- TEST 1: GET /api/switch/market-indices arricchito ---');
  const t1 = await get('/api/switch/market-indices');
  console.log('T1 Status:', t1.status);
  const idx = t1.data?.marketIndex;
  console.log('PUN:', idx?.punEurKwh, 'F1:', idx?.punF1, 'F2:', idx?.punF2, 'F3:', idx?.punF3);
  console.log('Storico 6m presente:', Array.isArray(idx?.historical6m), 'Lunghezza:', idx?.historical6m?.length);

  if (!idx?.punF1 || !idx?.punF2 || !idx?.punF3 || !Array.isArray(idx?.historical6m) || idx.historical6m.length < 6) {
    console.error('FAIL: Campi F1/F2/F3 o storico 6m mancanti!');
    process.exit(1);
  }

  console.log('--- TEST 2: POST /api/switch/refresh-indices ---');
  const t2 = await post('/api/switch/refresh-indices');
  console.log('T2 Status:', t2.status, t2.data?.message || t2.raw);
  if (t2.status !== 200 || !t2.data?.success) {
    console.error('FAIL: Refresh endpoint non risponde con status 200');
    process.exit(1);
  }

  console.log('>>> ALL GME FEED TESTS PASSED! <<<');
}

run();

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = __dirname;

async function main() {
  const runtimeUrl = pathToFileURL(path.join(root, 'server', 'dist', 'services', 'runtimeConfig.js')).href;
  const ocrUrl = pathToFileURL(path.join(root, 'server', 'dist', 'services', 'geminiOcrService.js')).href;
  const runtime = await import(`${runtimeUrl}?p0=${Date.now()}`);
  const ocr = await import(`${ocrUrl}?p0=${Date.now()}`);

  const previous = { ...process.env };
  const previousFetch = global.fetch;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.VOLTA_DEMO_MODE;
    delete process.env.JWT_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.throws(
      () => runtime.validateProductionConfiguration(),
      /persistente|supabase|demo/i,
      'A non-production deployment must not silently start with demo accounts and in-memory storage',
    );

    process.env.NODE_ENV = 'production';
    process.env.VOLTA_DEMO_MODE = 'true';
    assert.throws(
      () => runtime.validateProductionConfiguration(),
      /demo.*produzione|produzione.*demo/i,
      'Production must reject explicit demo mode',
    );

    process.env.NODE_ENV = 'development';
    delete process.env.VOLTA_DEMO_MODE;
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(
      () => ocr.analyzeBillWithGemini('renamed.pdf', 'application/pdf', Buffer.from('not a bill').toString('base64')),
      /gemini.*configurat|ocr.*disponibile/i,
      'OCR must fail closed instead of inventing customer, fiscal and supply data',
    );

    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{}' }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    await assert.rejects(
      () => ocr.analyzeBillWithGemini('incomplete.pdf', 'application/pdf', 'cGRm'),
      /incomplet|non valid|mancant/i,
      'Incomplete provider output must be rejected instead of filled with invented defaults',
    );

    global.fetch = previousFetch;
    process.env.NODE_ENV = 'development';
    delete process.env.VOLTA_DEMO_MODE;
    process.env.JWT_SECRET = 'p0-regression-jwt-secret-at-least-32-characters';
    const express = require(path.join(root, 'server', 'node_modules', 'express'));
    const authUrl = pathToFileURL(path.join(root, 'server', 'dist', 'routes', 'auth.js')).href;
    const { authRouter } = await import(`${authUrl}?p0=${Date.now()}`);
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    const server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    try {
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login-operator`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'm.riva@voltagroup.it', password: 'admin123', totpCode: '123456' }),
      });
      assert.notEqual(response.status, 200, 'Demo credentials and mock OTP must not authenticate unless demo mode is explicit');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    global.fetch = previousFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }

  console.log('P0 regression tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

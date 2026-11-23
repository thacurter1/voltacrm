// Gemini OCR service with a mocked provider: no real network calls, no real keys.
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const path = require('node:path');

const FAKE_KEY = 'AIzaFAKE_test_key_0123456789abcdefghij';
const distPath = path.join(__dirname, '..', 'server', 'dist', 'services', 'geminiOcrService.js');
const ocr = require(distPath);
const PDF_B64 = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');

function geminiReply(payload, { status = 200, raw } = {}) {
  const text = raw !== undefined ? raw : JSON.stringify(payload);
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function capture() {
  const lines = [];
  return { lines, logger: { info: (...a) => lines.push(a.join(' ')), warn: (...a) => lines.push(a.join(' ')) } };
}

async function expectOcrError(promise, { status, code }, label) {
  try {
    await promise;
  } catch (err) {
    assert.equal(err.status, status, `${label}: status`);
    assert.equal(err.code, code, `${label}: code`);
    assert.ok(!String(err.message).includes(FAKE_KEY), `${label}: message must not leak the key`);
    return err;
  }
  assert.fail(`${label}: expected an OcrError`);
}

const VALID = {
  utilityType: 'luce',
  podOrPdr: 'it001e12345678',
  supplier: 'Fornitore Esempio S.p.A.',
  customerName: 'Mario Rossi',
  fiscalCode: 'rssmra80a01h501u',
  annualConsumption: 2700,
  f1Kwh: 1000, f2Kwh: 900, f3Kwh: 800,
  powerKw: 3,
  rawCostTotal: '1.234,56',
  currentUnitCost: '0.142',
  currentFixedFeeYear: null,
  period: 'Settembre - Ottobre 2026',
  estimatedSavingEur: 999,
  confidenceScore: 99.9,
};

async function run() {
  // AbortSignal.timeout() timers are unref'd: keep the loop alive like a real server would.
  const keepAlive = setInterval(() => {}, 1000);
  delete process.env.GEMINI_API_KEY_ENCRYPTED;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_MODEL;

  // 1. Missing key -> 503 OCR_NOT_CONFIGURED, provider never called
  delete process.env.GEMINI_API_KEY;
  let called = false;
  await expectOcrError(
    ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, { fetchImpl: async () => { called = true; return geminiReply(VALID); } }),
    { status: 503, code: 'OCR_NOT_CONFIGURED' }, 'missing key');
  assert.equal(called, false, 'provider must not be called without a key');
  console.log('  PASS missing key -> 503 OCR_NOT_CONFIGURED');

  process.env.GEMINI_API_KEY = FAKE_KEY;

  // 2. Valid extraction with the default stable model
  assert.equal(ocr.DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.notEqual(ocr.resolveGeminiModel({}), 'gemini-2.0-flash');
  let seen;
  const log = capture();
  const result = await ocr.analyzeBillWithGemini('bolletta.pdf', 'application/pdf', PDF_B64, {
    logger: log.logger,
    fetchImpl: async (url, init) => { seen = { url, init }; return geminiReply(VALID); },
  });
  assert.ok(seen.url.includes('/models/gemini-3.8-flash:generateContent'), 'default model endpoint');
  assert.equal(seen.init.headers['x-goog-api-key'], FAKE_KEY, 'key travels only in the header');
  assert.ok(!seen.url.includes(FAKE_KEY), 'key never in the URL');
  assert.ok(seen.init.signal instanceof AbortSignal, 'request has a timeout signal');
  const prompt = JSON.parse(seen.init.body).contents[0].parts[0].text;
  assert.ok(/non inventare/i.test(prompt) && !/estimatedSaving/.test(prompt), 'prompt forbids invented values and never asks for savings');
  assert.equal(result.podOrPdr, 'IT001E12345678');
  assert.equal(result.fiscalCode, 'RSSMRA80A01H501U');
  assert.equal(result.rawCostTotal, 1234.56, 'Italian decimal comma parsed');
  assert.equal(result.currentUnitCost, 0.142, 'dot decimal preserved');
  assert.equal(result.currentFixedFeeYear, undefined, 'null stays missing, never defaulted');
  assert.equal(result.estimatedSavingEur, undefined, 'model-provided savings are discarded');
  assert.equal(result.confidenceScore, 100, 'completeness = share of key fields read');
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.model, 'gemini-3.8-flash');
  assert.ok(log.lines.every((l) => !l.includes('Mario Rossi') && !l.includes('RSSMRA') && !l.includes(FAKE_KEY)), 'logs carry no PII or key');
  console.log('  PASS valid extraction (default model, normalisation, no invented savings)');

  // 3. GEMINI_MODEL override + partial data + fenced JSON
  process.env.GEMINI_MODEL = 'gemini-3.6-flash';
  const partial = await ocr.analyzeBillWithGemini('gas.jpg', 'image/jpeg', PDF_B64, {
    logger: capture().logger,
    fetchImpl: async (url) => {
      assert.ok(url.includes('/models/gemini-3.6-flash:'), 'GEMINI_MODEL override honoured');
      return geminiReply(null, { raw: '```json\n{"utilityType":"GAS","podOrPdr":"IT001E1234","supplier":"Gas Srl","rawCostTotal":88.4,"f1Kwh":10}\n```' });
    },
  });
  assert.equal(partial.utilityType, 'gas');
  assert.equal(partial.podOrPdr, undefined, 'a POD on a gas bill is not a valid PDR: left for review');
  assert.equal(partial.f1Kwh, undefined, 'no F-bands for gas');
  assert.ok(partial.missingFields.includes('annualConsumption') && partial.missingFields.includes('podOrPdr'));
  assert.ok(partial.confidenceScore > 0 && partial.confidenceScore < 50);
  process.env.GEMINI_MODEL = 'bad model/../x';
  assert.equal(ocr.resolveGeminiModel(), 'gemini-3.8-flash', 'invalid GEMINI_MODEL falls back to the default');
  delete process.env.GEMINI_MODEL;
  console.log('  PASS model override, partial data, fenced JSON');

  // 4. Malformed JSON / invalid schema / empty reply -> 422 OCR_UNREADABLE
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: capture().logger, fetchImpl: async () => geminiReply(null, { raw: '{"utilityType": "luce", "supplier": ' }),
  }), { status: 422, code: 'OCR_UNREADABLE' }, 'malformed JSON');
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: capture().logger, fetchImpl: async () => geminiReply({ utilityType: 'acqua', supplier: 'X' }),
  }), { status: 422, code: 'OCR_UNREADABLE' }, 'schema violation');
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: capture().logger, fetchImpl: async () => geminiReply({ utilityType: 'luce' }),
  }), { status: 422, code: 'OCR_UNREADABLE' }, 'nothing readable');
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: capture().logger,
    fetchImpl: async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }),
  }), { status: 422, code: 'OCR_UNREADABLE' }, 'blocked/empty reply');
  console.log('  PASS malformed / invalid / empty replies -> 422 OCR_UNREADABLE');

  // 5. Timeout -> 504 OCR_TIMEOUT
  const hang = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  });
  const t0 = Date.now();
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, { logger: capture().logger, timeoutMs: 60, fetchImpl: hang }),
    { status: 504, code: 'OCR_TIMEOUT' }, 'timeout');
  assert.ok(Date.now() - t0 < 2000, 'timeout is enforced');
  assert.equal(ocr.resolveGeminiTimeoutMs({}), 30000);
  assert.equal(ocr.resolveGeminiTimeoutMs({ GEMINI_OCR_TIMEOUT_MS: '5' }), 30000, 'out-of-range timeout ignored');
  console.log('  PASS timeout -> 504 OCR_TIMEOUT');

  // 6. Provider 503 / network error -> 503, with secrets redacted from logs
  const log503 = capture();
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: log503.logger,
    fetchImpl: async () => new Response(`{"error":{"message":"overloaded for key ${FAKE_KEY}"}}`, { status: 503 }),
  }), { status: 503, code: 'OCR_PROVIDER_UNAVAILABLE' }, 'provider 503');
  assert.ok(log503.lines.some((l) => l.includes('HTTP 503')), 'provider failure is logged');
  assert.ok(log503.lines.every((l) => !l.includes(FAKE_KEY)), 'key redacted from logs');
  assert.ok(log503.lines.some((l) => l.includes('[REDACTED_SECRET]')), 'redaction marker present');
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: capture().logger, fetchImpl: async () => { throw new TypeError(`fetch failed ${FAKE_KEY}`); },
  }), { status: 503, code: 'OCR_PROVIDER_UNAVAILABLE' }, 'network error');
  await expectOcrError(ocr.analyzeBillWithGemini('b.pdf', 'application/pdf', PDF_B64, {
    logger: capture().logger, fetchImpl: async () => new Response('bad request', { status: 400 }),
  }), { status: 422, code: 'OCR_PROVIDER_REJECTED' }, 'provider 400');
  console.log('  PASS provider/network failures -> 503 with redacted logs');

  delete process.env.GEMINI_API_KEY;
  clearInterval(keepAlive);
  console.log('PASS: Gemini OCR service (mocked provider)');
}

run().catch((err) => { console.error(err); process.exit(1); });

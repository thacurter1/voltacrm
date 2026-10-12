const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/api/transport.ts'), 'utf8').replace(/import\.meta/g, '({env:{VITE_DEMO_MODE:"false",VITE_API_URL:"https://example.test/api"}})');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let fetchImpl, count = 0;
const exported = {};
new Function('exports', 'require', 'fetch', 'setTimeout', compiled)(exported, require, (...args) => { count++; return fetchImpl(...args); }, (fn, ms) => setTimeout(fn, Math.min(ms, 20)));
async function main() {
  fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => { signal?.addEventListener('abort', () => reject(signal.reason), { once: true }); });
  const outcome = await Promise.race([exported.request('/auth/login', { method: 'POST' }).catch(e => e), new Promise(resolve => setTimeout(() => resolve('still pending'), 120))]);
  assert.ok(outcome instanceof Error, 'A stalled backend must release the form with an error');
  assert.match(outcome.message, /tempo|risponde/i);
  assert.equal(count, 1, 'Timed out POST must never be retried automatically');
  const controller = new AbortController();
  controller.abort(new Error('user cancelled'));
  count = 0;
  await assert.rejects(exported.request('/cancel', { signal: controller.signal }), /user cancelled/);
  assert.equal(count, 0, 'Pre-cancelled calls must not be sent');
  fetchImpl = async () => ({ ok: true, json: () => new Promise(() => {}) });
  await assert.rejects(exported.request('/slow-body'), /tempo|risponde/i, 'Response body reading must also be bounded');
  fetchImpl = async () => ({ ok: true, json: async () => ({ success: true }) });
  assert.deepEqual(await exported.request('/ok'), { success: true });
  console.log('Request deadlines, response-body deadlines, cancellation and no POST retries verified.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

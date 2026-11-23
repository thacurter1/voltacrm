// OCR review UI: real data is shown for review, failures degrade to manual entry, nothing is invented.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
function load(rel) {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, mod, mod.exports);
  return mod.exports;
}

// 1. Failure helpers map backend codes to transparent, non-blocking copy
const { describeOcrFailure, toOcrFailure } = load('src/components/ocr/ocrFailure.ts');
for (const code of ['OCR_NOT_CONFIGURED', 'OCR_TIMEOUT', 'OCR_PROVIDER_UNAVAILABLE', 'OCR_UNREADABLE', 'OCR_PROVIDER_REJECTED']) {
  const msg = describeOcrFailure({ code, message: 'x' });
  assert.ok(/manualmente/.test(msg), `${code} must point to manual entry`);
  assert.ok(!/AIza|GEMINI_API_KEY/.test(msg), `${code} copy must not mention keys`);
}
const f = toOcrFailure(Object.assign(new Error('down'), { status: 503, code: 'OCR_NOT_CONFIGURED' }));
assert.deepEqual(f, { message: 'down', code: 'OCR_NOT_CONFIGURED', status: 503 });
console.log('  PASS failure codes degrade to manual entry');

// 2. Transport keeps status/code on errors
const transport = read('src/api/transport.ts');
assert.ok(/status: response\.status/.test(transport) && /code: typeof body\.code === 'string'/.test(transport), 'transport must expose status and code');

// 3. Review modal: no fabricated contact data, mandates or savings
const modal = read('src/components/BillOcrModal.tsx');
for (const banned of ["'+39 33'", '@email.it', "'Milano (MI)'", 'Alessandro Mori', 'hasBrokerageMandate: true', 'estimatedSavingEur.toFixed', 'Accuratezza OCR', 'SAMPLE_BILLS']) {
  assert.ok(!modal.includes(banned), `BillOcrModal must not contain ${banned}`);
}
assert.ok(modal.includes('hasBrokerageMandate: false'), 'mandate is never assumed from a bill');
assert.ok(modal.includes('missingFields') && modal.includes('data-testid="ocr-review-summary"'), 'extracted vs missing fields are shown for review');
assert.ok(modal.includes('data-testid="ocr-manual-fallback"') && modal.includes('Inserisci a mano'), 'manual entry is always reachable');
const app = read('src/App.tsx');
for (const banned of ["'+39 347 0000000'", "'cliente.ocr@email.it'", 'CF${randomSuffix}', 'extractedSavingsEur: 180']) {
  assert.ok(!app.includes(banned), `App.tsx must not contain ${banned}`);
}
assert.ok(app.includes('setOcrReview({ result: analysis.result, error: null })') && app.includes('setOcrReview({ result: null, error: failure })'), 'stored-bill analysis opens the review (or manual fallback)');
console.log('  PASS review modal and App never invent data');

// 4. Inbox renders real states, no placeholder savings, >= 44px actions
const { ClientBillsInbox } = load('src/components/ClientBillsInbox.tsx');
const bills = [
  { id: 'b1', customerId: 'c1', customerName: 'Anna Bianchi', fileName: 'luce.pdf', uploadDate: '2026-11-20', fileSizeKb: 120, utilityType: 'luce', status: 'analyzed' },
  { id: 'b2', customerId: 'c2', customerName: 'Luca Verdi', fileName: 'gas.jpg', uploadDate: '2026-11-21', fileSizeKb: 900, utilityType: 'gas', status: 'in_review' },
  { id: 'b3', customerId: 'c3', customerName: 'Sara Neri', fileName: 'luce2.pdf', uploadDate: '2026-11-22', fileSizeKb: 300, utilityType: 'luce', status: 'needs_info' },
];
const html = renderToStaticMarkup(React.createElement(ClientBillsInbox, { bills, onOpenOcrForBill: () => {}, onMarkAnalyzed: () => {} }));
assert.ok(!html.includes('180'), 'no placeholder savings');
for (const label of ['Analizzata', 'Ricevuta / In verifica', 'Richiesta informazioni', 'Leggi dati bolletta']) assert.ok(html.includes(label), label);
assert.ok(html.includes('min-h-11'), 'actions are >= 44px');
assert.ok(!/AI|Sparkles|animate-pulse/.test(html), 'no AI artefacts');
const withSaving = renderToStaticMarkup(React.createElement(ClientBillsInbox, { bills: [{ ...bills[0], extractedSavingsEur: 210 }], onOpenOcrForBill: () => {}, onMarkAnalyzed: () => {} }));
assert.ok(/210/.test(withSaving), 'real savings are shown when computed');
console.log('  PASS inbox shows real states only');
console.log('PASS: OCR review UI');

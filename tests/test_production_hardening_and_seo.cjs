process.env.NODE_ENV = 'test';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: PRODUCTION HARDENING, SEO/OPEN GRAPH & ERROR RECOVERY (TDD RED PHASE) ===');

// 1. Verify index.html contains comprehensive SEO, Open Graph & Twitter Cards
console.log('\n[TEST 1] index.html SEO, Open Graph and Twitter metadata');
const indexPath = path.join(__dirname, '..', 'index.html');
assert.ok(fs.existsSync(indexPath), 'index.html must exist');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

assert.ok(
  indexHtml.includes('<meta name="description"'),
  'index.html must include meta description tag'
);
assert.ok(
  indexHtml.includes('luce e gas') || indexHtml.includes('Luce e Gas'),
  'meta description must mention luce e gas'
);
assert.ok(
  indexHtml.includes('property="og:title"'),
  'index.html must include Open Graph og:title'
);
assert.ok(
  indexHtml.includes('property="og:description"'),
  'index.html must include Open Graph og:description'
);
assert.ok(
  indexHtml.includes('property="og:type" content="website"'),
  'index.html must include Open Graph og:type="website"'
);
assert.ok(
  indexHtml.includes('name="twitter:card"'),
  'index.html must include Twitter card meta tag'
);
assert.ok(
  indexHtml.includes('<title>Volta Energia') && (indexHtml.includes('Tariffe') || indexHtml.includes('Confronta')),
  'Page title must be optimized for Volta Energia rate comparison'
);
console.log('✔ index.html contains complete SEO and Open Graph metadata');

// 2. Verify ErrorBoundary branded recovery UI & support info
console.log('\n[TEST 2] ErrorBoundary branded recovery UI');
const errorBoundaryPath = path.join(__dirname, '..', 'src', 'components', 'ErrorBoundary.tsx');
assert.ok(fs.existsSync(errorBoundaryPath), 'src/components/ErrorBoundary.tsx must exist');
const errorBoundarySrc = fs.readFileSync(errorBoundaryPath, 'utf8');

assert.ok(
  errorBoundarySrc.includes('Volta Energia'),
  'ErrorBoundary must display Volta Energia branding'
);
assert.ok(
  errorBoundarySrc.includes('800 912 345') || errorBoundarySrc.includes('supporto@voltaenergia.it'),
  'ErrorBoundary must provide direct customer assistance contact'
);
assert.ok(
  errorBoundarySrc.includes('handleReset') || errorBoundarySrc.includes('handleHome') || errorBoundarySrc.includes('Torna al comparatore') || errorBoundarySrc.includes('Torna alla home'),
  'ErrorBoundary must provide action to navigate back to comparator home'
);
console.log('✔ ErrorBoundary branded recovery options verified');

// 3. Verify demo preservation and ?demo=true activation logic in transport.ts
console.log('\n[TEST 3] Demo access preservation & ?demo=true activation');
const transportPath = path.join(__dirname, '..', 'src', 'api', 'transport.ts');
assert.ok(fs.existsSync(transportPath), 'src/api/transport.ts must exist');
const transportSrc = fs.readFileSync(transportPath, 'utf8');

assert.ok(
  transportSrc.includes('demo=true'),
  'transport.ts must preserve explicit demo access when ?demo=true is present'
);
assert.ok(
  transportSrc.includes('isDemoSessionActive'),
  'transport.ts must export isDemoSessionActive'
);
console.log('✔ Demo preservation and activation guarantees verified');

console.log('\n🎉 ALL PRODUCTION HARDENING & SEO CHECKS PASSED!');

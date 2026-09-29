const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

console.log('=== TEST SUITE: FRONTEND TRANSPORT & CONNECTION DIAGNOSTICS (TDD) ===');

const transportTsPath = path.join(__dirname, '..', 'src', 'api', 'transport.ts');
assert.ok(fs.existsSync(transportTsPath), 'transport.ts must exist');

const transportSource = fs.readFileSync(transportTsPath, 'utf8');

// Transpile TS to CommonJS while safely handling import.meta
const transpiled = ts.transpileModule(transportSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

// Evaluate module in sandbox
const moduleExports = {};
const sandboxFn = new Function('exports', 'importMetaEnv', `
  const import_meta = { env: importMetaEnv || {} };
  ${transpiled.replace(/import\.meta/g, 'import_meta')}
`);

sandboxFn(moduleExports, { VITE_API_URL: '', VITE_DEMO_MODE: 'false' });

assert.ok(
  typeof moduleExports.evaluateApiConfiguration === 'function',
  'transport.ts must export evaluateApiConfiguration function'
);

const { evaluateApiConfiguration } = moduleExports;

// TEST 1: Localhost development fallback to localhost:5000/api
console.log('--- TEST 1: Localhost development defaults to http://localhost:5000/api ---');
const localStatus = evaluateApiConfiguration('localhost', '');
assert.equal(localStatus.isConfigured, true);
assert.equal(localStatus.isCloudEnvironment, false);
assert.equal(localStatus.apiBaseUrl, 'http://localhost:5000/api');
console.log('✔ Localhost configura correttamente default a port 5000');

// TEST 2: Cloud domain with localhost URL returns explicit unconfigured diagnostic
console.log('--- TEST 2: Cloud domain with localhost URL triggers unconfigured state ---');
const cloudLocalhostStatus = evaluateApiConfiguration('voltacrm.vercel.app', 'http://localhost:5000/api');
assert.equal(cloudLocalhostStatus.isConfigured, false);
assert.equal(cloudLocalhostStatus.isCloudEnvironment, true);
assert.equal(cloudLocalhostStatus.apiBaseUrl, null);
assert.match(cloudLocalhostStatus.statusMessage, /localhost/i);
console.log('✔ Dominio cloud con localhost intercettato correttamente come non configurato');

// TEST 3: Cloud domain with valid remote HTTPS URL
console.log('--- TEST 3: Cloud domain with HTTPS backend URL succeeds ---');
const cloudHttpsStatus = evaluateApiConfiguration('voltacrm.vercel.app', 'https://api.voltacrm.it/api');
assert.equal(cloudHttpsStatus.isConfigured, true);
assert.equal(cloudHttpsStatus.isCloudEnvironment, true);
assert.equal(cloudHttpsStatus.apiBaseUrl, 'https://api.voltacrm.it/api');
console.log('✔ Dominio cloud con backend remoto HTTPS configurato correttamente');

// TEST 4: Cloud domain with empty VITE_API_URL
console.log('--- TEST 4: Cloud domain with missing VITE_API_URL ---');
const cloudEmptyStatus = evaluateApiConfiguration('voltacrm.vercel.app', '');
assert.equal(cloudEmptyStatus.isConfigured, false);
assert.equal(cloudEmptyStatus.isCloudEnvironment, true);
assert.equal(cloudEmptyStatus.apiBaseUrl, null);
assert.match(cloudEmptyStatus.statusMessage, /VITE_API_URL/i);
console.log('✔ Dominio cloud senza variabile d\'ambiente segnala richiesta VITE_API_URL');

console.log('\n🎉 ALL TRANSPORT DIAGNOSTICS TESTS PASSED!');

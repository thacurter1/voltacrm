const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'db.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText.replace(/import\.meta/g, 'importMeta');

function createStore(demoMode, storedState = {
    customers: [{ id: 'stored-demo-customer' }], leads: [{ id: 'stored-demo-lead' }]
  }) {
  const entries = new Map([['VOLTA_ENERGY_CRM_DB_V3', JSON.stringify(storedState)]]);
  let writes = 0;
  const localStorage = {
    getItem: key => entries.get(key) || null,
    setItem: (key, value) => { writes++; entries.set(key, value); },
    removeItem: key => entries.delete(key),
  };
  const exports = {};
  const requireStub = specifier => {
    if (specifier === './mockData') return {
      INITIAL_CUSTOMERS: [{ id: 'seed-customer' }],
      INITIAL_LEADS: [{ id: 'seed-lead' }],
      INITIAL_APPOINTMENTS: []
    };
    if (specifier === './energyEngine') return { CURRENT_MARKET_INDEX: {} };
    if (specifier === './cryptoService') return { cryptoService: { encrypt: async () => 'ciphertext' } };
    throw new Error(`Unexpected import: ${specifier}`);
  };
  new Function('require', 'exports', 'localStorage', 'importMeta', compiled)(
    requireStub, exports, localStorage, { env: { VITE_DEMO_MODE: demoMode ? 'true' : 'false' } }
  );
  return { dbService: exports.dbService, writes: () => writes };
}

const production = createStore(false);
const productionData = production.dbService.load();
assert.deepEqual(productionData.customers, [], 'production must not display browser demo customers');
assert.deepEqual(productionData.leads, [], 'production must not display browser demo leads');
production.dbService.save(productionData);
assert.equal(production.writes(), 0, 'production must not rewrite demo local storage');

const demo = createStore(true);
assert.equal(demo.dbService.load().customers[0].id, 'stored-demo-customer');
const emptyDemo = createStore(true, { customers: [], leads: [], appointments: [], bills: [], securityLogs: [] });
assert.deepEqual(emptyDemo.dbService.load().customers, [], 'deleted demo customers must stay deleted');
assert.deepEqual(emptyDemo.dbService.load().leads, [], 'deleted demo leads must stay deleted');
console.log('Frontend demo data stays outside the production data path.');

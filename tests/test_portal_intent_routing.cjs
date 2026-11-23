// Behavioural test for URL -> portal entry resolution (QA bug: /?portal=customer opened the public Home).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.join(__dirname, '..', 'src', 'config', 'portalRouting.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
const { resolvePortalIntent } = mod.exports;

const at = (search, hostname = 'voltaenergia.example', pathname = '/') => resolvePortalIntent({ search, hostname, pathname });

const cases = [
  ['', null, 'plain / stays on the public Home'],
  ['?portal=customer', 'customer', '/?portal=customer opens the Customer gate'],
  ['?portal=CUSTOMER', 'customer', 'portal intent is case-insensitive'],
  ['?portal=staff', 'staff', '/?portal=staff opens the Staff gate'],
  ['?portal=home', 'home', '/?portal=home opens the portal hub'],
  ['?portal=totem', 'totem', '/?portal=totem stays a totem intent'],
  ['?login=customer', 'customer', 'legacy login=customer'],
  ['?login=true', 'staff', 'legacy login=true opens Staff'],
  ['?app=cliente', 'customer', 'legacy app=cliente'],
  ['?mode=crm', 'staff', 'legacy mode=crm'],
  ['?utm_source=google', null, 'marketing params do not open a gate'],
];
for (const [search, expected, label] of cases) {
  assert.equal(at(search), expected, label);
  console.log(`  PASS ${label}`);
}

assert.equal(at('', 'clienti.voltaenergia.it'), 'customer', 'clienti.* host');
assert.equal(at('', 'clienti-volta.vercel.app'), 'customer', 'clienti-* preview host');
assert.equal(at('', 'staff.voltaenergia.it'), 'staff', 'staff.* host');
assert.equal(at('', 'crm-volta.vercel.app'), 'staff', 'crm-* preview host');
assert.equal(at('', 'localhost', '/clienti'), 'customer', '/clienti path');
assert.equal(at('', 'localhost', '/Staff'), 'staff', '/staff path');
assert.equal(at('?portal=home', 'clienti.voltaenergia.it'), 'home', 'explicit portal param beats host');
console.log('  PASS host and path aliases');

const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
assert.ok(app.includes("useState(() => currentPortalIntent() === 'customer')"), 'Customer gate initial state must follow the URL intent');
assert.ok(app.includes("const isExplicitCustomerLogin = portalParam === 'customer'"), 'Customer gate must open on portal=customer');
console.log('PASS: portal intent routing (/, ?portal=customer|staff|home)');

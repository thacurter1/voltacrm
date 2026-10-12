const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/import\.meta/g, '({env:{VITE_DEMO_MODE:"true"}})');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), js)(id => dependencies[id] || require(id), module, module.exports, ...Object.values(globals));
  return module.exports;
}
function elements(node, type) {
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === type ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => elements(child, type))];
}
const states = [];
let cursor = 0;
const hooks = { ...React, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; } };
let passwordSent, registered = false;
const messages = [];
const api = { auth: { loginCustomer: async (_id, password) => { passwordSent = password; return { user: { role: 'customer' } }; }, registerCustomer: async () => { registered = true; return { user: {} }; } } };
const { PortalGate } = load('src/components/PortalGate.tsx', { react: hooks, '../api/client': { api, DEMO_MODE: false }, '../services/supabaseClient': { INITIAL_PROFILES: [] }, './OAuthButtons': { OAuthButtons: () => null } });
const props = { portal: 'customer', customers: [], profiles: [], onLoginCustomer() {}, onLoginOperator() {}, onToast: (...args) => messages.push(args) };
function render() { cursor = 0; return PortalGate(props); }
async function main() {
  let view = render();
  const identifier = elements(view, 'input').find(n => n.props.value === '' && n.props.type !== 'password');
  identifier.props.onChange({ target: { value: 'person@example.test' } });
  elements(view, 'input').find(n => n.props.type === 'password').props.onChange({ target: { value: ' SyntheticExample12! ' } });
  view = render();
  await elements(view, 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(passwordSent, ' SyntheticExample12! ', 'Login must preserve exact password bytes');
  states[1] = 'register';
  view = render();
  const fiscal = elements(view, 'input').find(n => n.props.placeholder === 'RSSMRA80A01H501U');
  assert.equal(fiscal.props.required, true, 'Fiscal code must be visibly required');
  const password = elements(view, 'input').find(n => n.props.type === 'password');
  assert.equal(password.props.minLength, 12);
  assert.equal(password.props.required, true);
  await elements(view, 'form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(registered, false, 'Invalid registration must not reach backend');
  const { EnergyPortalHeader } = load('src/components/customer/EnergyPortalHeader.tsx', { '../NotificationCenter': { NotificationCenter: () => null } });
  let loggedOut = false;
  const header = EnergyPortalHeader({ activeView: 'offers', onSelectView() {}, customerName: 'Test', onLogout: () => { loggedOut = true; } });
  const exit = elements(header, 'button').find(n => n.props.onClick && React.Children.toArray(n.props.children).some(c => c === 'Esci' || c?.props?.children === 'Esci'));
  assert.ok(exit, 'Customers need a visible sign-out button');
  exit.props.onClick();
  assert.equal(loggedOut, true);
  const storage = { getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() {} };
  const { dbService } = load('src/services/db.ts', { './mockData': { INITIAL_CUSTOMERS: [], INITIAL_LEADS: [], INITIAL_APPOINTMENTS: [] }, './energyEngine': { CURRENT_MARKET_INDEX: {} } }, { localStorage: storage, console: { warn() {}, error() {} } });
  assert.throws(() => dbService.save({ customers: [] }), /salvataggio|salvare/i, 'Failed writes must reject success');
  assert.ok(dbService.load(), 'Unavailable storage must not prevent demo startup');
  console.log('Exact passwords, registration validation, customer logout and storage failures verified.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

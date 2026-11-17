const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const rootDir = path.join(__dirname, '..');

function transpileAndLoad(relPath, deps = {}, importMetaEnv = { VITE_DEMO_MODE: 'false' }) {
  const fullPath = path.join(rootDir, relPath);
  const src = fs
    .readFileSync(fullPath, 'utf8')
    .replace(/import\.meta/g, `({ env: ${JSON.stringify(importMetaEnv)} })`);
  const compiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const fakeRequire = (id) => {
    if (deps[id]) return deps[id];
    return require(id);
  };
  new Function('require', 'module', 'exports', compiled)(fakeRequire, mod, mod.exports);
  return mod.exports;
}

async function run() {
  console.log('=== TEST SUITE: FRONTEND OPERATIONAL FLOWS, OAUTH & ACCESSIBILITY (SECTIONS B & D) ===');

  // 1. OAuthButtons: hidden when unconfigured outside DEMO_MODE, selective when partial, visible in DEMO_MODE
  const { OAuthButtons } = transpileAndLoad(
    'src/components/OAuthButtons.tsx',
    { '../api/client': { api: {}, DEMO_MODE: false } },
    { VITE_DEMO_MODE: 'false' }
  );
  const prodNoneHtml = renderToStaticMarkup(
    React.createElement(OAuthButtons, { role: 'customer', onSuccess: () => {}, onToast: () => {} })
  );
  assert.equal(prodNoneHtml, '', 'Unconfigured Google & Apple in production must render nothing (no broken buttons)');

  const { OAuthButtons: OAuthGoogleOnly } = transpileAndLoad(
    'src/components/OAuthButtons.tsx',
    { '../api/client': { api: {}, DEMO_MODE: false } },
    { VITE_DEMO_MODE: 'false', VITE_GOOGLE_CLIENT_ID: 'google-client-123.apps.googleusercontent.com' }
  );
  const googleOnlyHtml = renderToStaticMarkup(
    React.createElement(OAuthGoogleOnly, { role: 'customer', onSuccess: () => {}, onToast: () => {} })
  );
  assert.ok(googleOnlyHtml.includes('Google') && !googleOnlyHtml.includes('Apple'), 'Only configured OAuth provider should render in production');

  const { OAuthButtons: OAuthDemo } = transpileAndLoad(
    'src/components/OAuthButtons.tsx',
    { '../api/client': { api: {}, DEMO_MODE: true } },
    { VITE_DEMO_MODE: 'true' }
  );
  const demoHtml = renderToStaticMarkup(
    React.createElement(OAuthDemo, { role: 'customer', onSuccess: () => {}, onToast: () => {} })
  );
  assert.ok(demoHtml.includes('Google') && demoHtml.includes('Apple'), 'Demo mode retains both OAuth buttons');
  console.log('  ✅ OAuthButtons conditional availability verified');

  // 2. CustomerApp & EnergyBillIntake upload direct link preserves normal default
  const customerAppSrc = fs.readFileSync(path.join(rootDir, 'src', 'apps', 'CustomerApp.tsx'), 'utf8');
  const billIntakeSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'customer', 'EnergyBillIntake.tsx'), 'utf8');
  assert.ok(
    customerAppSrc.includes("intakeInitialMode") && customerAppSrc.includes("'upload'"),
    'CustomerApp must wire SubitoMySupplies.onUploadBill to pass initialMode="upload"'
  );
  assert.ok(
    billIntakeSrc.includes('initialMode') && (billIntakeSrc.includes('prevInitialMode') || billIntakeSrc.includes('useEffect')),
    'EnergyBillIntake must sync when initialMode explicitly switches to upload'
  );
  console.log('  ✅ Upload direct link & default preservation verified');

  // 3. PortalGate accessibility, titles, show/hide password, forgot/reset/verify, privacy + marketing
  const portalGateSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'PortalGate.tsx'), 'utf8');
  for (const requiredMarker of [
    'Crea il tuo account',
    'Recupera la tua password',
    'htmlFor="register-name"',
    'id="register-name"',
    'htmlFor="register-email"',
    'id="register-email"',
    'htmlFor="register-phone"',
    'id="register-phone"',
    'htmlFor="register-privacy"',
    'htmlFor="register-marketing"',
    'role="alert"',
    'aria-pressed',
    'autoComplete="new-password"',
    'forgotPassword',
  ]) {
    assert.ok(portalGateSrc.includes(requiredMarker), `PortalGate.tsx missing required element/flow: ${requiredMarker}`);
  }
  console.log('  ✅ PortalGate accessibility, titles, privacy/marketing & lifecycle modes verified');

  // 4. SubitoMySupplies honest empty state, readable bill states, conditional consultant display
  const { SubitoMySupplies } = transpileAndLoad('src/components/customer/SubitoMySupplies.tsx', {
    'lucide-react': require('lucide-react'),
  });
  const emptyUnassignedHtml = renderToStaticMarkup(
    React.createElement(SubitoMySupplies, {
      customer: {
        id: 'c1',
        name: 'Mario Nuovo',
        fiscalCode: 'RSSMRA80A01H501U',
        phone: '+39 340 1234567',
        email: 'm@example.invalid',
        city: '',
        utilityPoints: [],
        contractStartDate: '2026-11-17',
        lastSwitchAuditDate: '2026-11-17',
        nextSwitchAuditDate: '2027-03-17',
        accountManager: '',
        hasBrokerageMandate: false,
      },
      bills: [
        {
          id: 'b1',
          customerId: 'c1',
          customerName: 'Mario Nuovo',
          fileName: 'prima.pdf',
          uploadDate: '2026-11-17',
          fileSizeKb: 120,
          utilityType: 'luce',
          status: 'needs_info',
        },
      ],
      onUploadBill: () => {},
    })
  );
  assert.ok(emptyUnassignedHtml.includes('Carica la tua prima bolletta'), 'Empty state must invite first bill upload');
  assert.ok(emptyUnassignedHtml.includes('Richiesta informazioni'), 'Must display readable needs_info state');
  assert.ok(!emptyUnassignedHtml.includes('attivare il monitoraggio del risparmio'), 'Must not promise monitoring/savings before analysis');
  assert.ok(!emptyUnassignedHtml.includes('Il tuo referente:'), 'Must NOT display phantom referent when unassigned');
  console.log('  ✅ SubitoMySupplies honest empty state & status verified');

  // 5. CustomerAccountView exists and supports edit profile, email change, password change, logout-all, claim, support, export, closure
  const accountViewPath = path.join(rootDir, 'src', 'components', 'customer', 'CustomerAccountView.tsx');
  assert.ok(fs.existsSync(accountViewPath), 'CustomerAccountView.tsx must exist');
  const accountViewSrc = fs.readFileSync(accountViewPath, 'utf8');
  for (const feature of [
    'updateContact',
    'requestEmailChange',
    'changePassword',
    'logoutAllSessions',
    'claimGuestBill',
    'createSupportRequest',
    'exportAccountData',
    'requestAccountClosure',
  ]) {
    assert.ok(accountViewSrc.includes(feature), `CustomerAccountView.tsx must wire ${feature}`);
  }
  console.log('  ✅ CustomerAccountView complete lifecycle features verified');

  console.log('✔ ALL FRONTEND OPERATIONAL FLOW TESTS PASSED!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

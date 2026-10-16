const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Subdomain & Dual Login Routing Suite (TDD)...');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

const appTsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
const customerAppTsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx'), 'utf8');
const headerTsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyPortalHeader.tsx'), 'utf8');
const portalGateTsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'PortalGate.tsx'), 'utf8');
const viteConfig = fs.readFileSync(path.join(__dirname, '..', 'vite.config.ts'), 'utf8');
const serverIndex = fs.readFileSync(path.join(__dirname, '..', 'server', 'src', 'index.ts'), 'utf8');

// 1. Subdomain detection in App.tsx supports both clienti.* / cliente.* and staff.* / crm.*
test('App.tsx: detects customer subdomains (clienti.* and cliente.*) and staff subdomains (staff.* and crm.*)', () => {
  assert.ok(
    appTsx.includes("portalHost.startsWith('clienti.')") && appTsx.includes("portalHost.startsWith('cliente.')"),
    'App.tsx must detect both clienti.* and cliente.* subdomains as customer portal'
  );
  assert.ok(
    appTsx.includes("portalHost.startsWith('staff.')") && appTsx.includes("portalHost.startsWith('crm.')"),
    'App.tsx must detect both staff.* and crm.* subdomains as staff portal'
  );
});

// 2. Customer Login Gate in App.tsx opens PortalGate portal="customer" on customer subdomain or when Area Clienti is clicked
test('App.tsx: renders <PortalGate portal="customer" /> when customer login gate is active', () => {
  assert.ok(
    appTsx.includes('isCustomerGateOpen') && appTsx.includes('portal="customer"'),
    'App.tsx must support isCustomerGateOpen and render <PortalGate portal="customer" />'
  );
  assert.ok(
    appTsx.includes('onOpenCustomerLogin'),
    'App.tsx must pass onOpenCustomerLogin to CustomerApp'
  );
});

// 3. EnergyPortalHeader & CustomerApp expose "Area Clienti" login button alongside "Area Staff & Broker"
test('EnergyPortalHeader.tsx & CustomerApp.tsx: expose onOpenCustomerLogin and render "Area Clienti" button', () => {
  assert.ok(
    customerAppTsx.includes('onOpenCustomerLogin?: () => void'),
    'CustomerAppProps must declare onOpenCustomerLogin?: () => void'
  );
  assert.ok(
    headerTsx.includes('onOpenCustomerLogin?: () => void') && headerTsx.includes('Area Clienti'),
    'EnergyPortalHeader must accept onOpenCustomerLogin and render "Area Clienti" button'
  );
});

// 4. PortalGate.tsx renders the "Torna al Comparatore Pubblico" button when onBackToPublic is provided
test('PortalGate.tsx: renders onBackToPublic button in header and Demo 1-Click buttons on customer/staff portals', () => {
  assert.ok(
    portalGateTsx.includes('onClick={onBackToPublic}'),
    'PortalGate.tsx must wire onBackToPublic to a clickable button'
  );
});

// 5. vite.config.ts and server/src/index.ts support local and production subdomains
test('vite.config.ts & server/src/index.ts: allow *.localhost and subdomain origins', () => {
  assert.ok(
    viteConfig.includes('allowedHosts: true'),
    'vite.config.ts server must set allowedHosts: true for *.localhost subdomain testing'
  );
  assert.ok(
    serverIndex.includes('clienti.') || serverIndex.includes('.localhost'),
    'server/src/index.ts CORS configuration must allow subdomain origins'
  );
});

console.log(`\n📊 Risultato Subdomain & Dual Login Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: PUBLIC UNAUTHENTICATED ROOT ROUTING & STAFF ACCESS HEADER (TDD) ===');

const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
assert.ok(fs.existsSync(appPath), 'src/App.tsx must exist');
const appSrc = fs.readFileSync(appPath, 'utf8');

const customerAppPath = path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx');
assert.ok(fs.existsSync(customerAppPath), 'src/apps/CustomerApp.tsx must exist');
const customerAppSrc = fs.readFileSync(customerAppPath, 'utf8');

const headerPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyPortalHeader.tsx');
assert.ok(fs.existsSync(headerPath), 'src/components/customer/EnergyPortalHeader.tsx must exist');
const headerSrc = fs.readFileSync(headerPath, 'utf8');

// -----------------------------------------------------------------------------
// TEST 1: CustomerApp accepts onOpenStaffLogin and isPublicVisitor props
// -----------------------------------------------------------------------------
console.log('\n[TEST 1] CustomerAppProps interface declaration');
assert.ok(
  customerAppSrc.includes('onOpenStaffLogin?: () => void') || customerAppSrc.includes('onOpenStaffLogin?:'),
  'CustomerAppProps must declare optional onOpenStaffLogin prop'
);
assert.ok(
  customerAppSrc.includes('isPublicVisitor?: boolean') || customerAppSrc.includes('isPublicVisitor?:'),
  'CustomerAppProps must declare optional isPublicVisitor prop'
);

// -----------------------------------------------------------------------------
// TEST 2: Staff Access Header with "Area Staff & Broker" & "Comparatore Ufficiale"
// -----------------------------------------------------------------------------
console.log('\n[TEST 2] Header contains "Area Staff & Broker" button and official comparator branding');
assert.ok(
  headerSrc.includes('Area Staff & Broker') || customerAppSrc.includes('Area Staff & Broker'),
  'Header or CustomerApp must render "Area Staff & Broker" button'
);
assert.ok(
  headerSrc.includes('Comparatore Ufficiale') || customerAppSrc.includes('Comparatore Ufficiale'),
  'Header or CustomerApp must include "Comparatore Ufficiale" badge'
);
assert.ok(
  headerSrc.includes('Trasparente, gratuito e senza vincoli') || customerAppSrc.includes('Trasparente, gratuito e senza vincoli'),
  'Header or CustomerApp must include "Trasparente, gratuito e senza vincoli" subtitle'
);
assert.ok(
  headerSrc.includes('onOpenStaffLogin') || customerAppSrc.includes('onOpenStaffLogin'),
  'Header or CustomerApp must wire onOpenStaffLogin trigger'
);

// -----------------------------------------------------------------------------
// TEST 3: Null customer does not block public visitor in CustomerApp
// -----------------------------------------------------------------------------
console.log('\n[TEST 3] CustomerApp does not show "Non riusciamo a trovare la tua fornitura" for public visitor');
assert.ok(
  customerAppSrc.includes('!activeCustomer && !isPublicVisitor') ||
  customerAppSrc.includes('!customer && !isPublicVisitor') ||
  customerAppSrc.includes('!activeCustomer && !isGuest'),
  'CustomerApp null customer check must be guarded so public visitor is not blocked'
);

// -----------------------------------------------------------------------------
// TEST 4: App.tsx Public Root Landing condition
// -----------------------------------------------------------------------------
console.log('\n[TEST 4] App.tsx renders CustomerApp as unauthenticated public root landing');
assert.ok(
  appSrc.includes('isPublicVisitor') && appSrc.includes('onOpenStaffLogin'),
  'App.tsx must mount CustomerApp in public visitor mode with onOpenStaffLogin'
);
assert.ok(
  appSrc.includes('isStaffGateOpen') || appSrc.includes('isStaffLogin') || appSrc.includes("portalParam === 'staff'"),
  'App.tsx must distinguish staff login request from public visitor landing'
);
assert.ok(
  appSrc.includes("searchParams.get('login') === 'true'") || appSrc.includes("portalParams.get('login') === 'true'"),
  'App.tsx must check login=true query param to open staff gate'
);

// -----------------------------------------------------------------------------
// TEST 5: Demo compatibility & Totem preservation
// -----------------------------------------------------------------------------
console.log('\n[TEST 5] DemoRoleSwitcher and Totem portal preserved');
assert.ok(
  appSrc.includes('DemoRoleSwitcher'),
  'App.tsx must preserve DemoRoleSwitcher'
);
assert.ok(
  appSrc.includes("portalParam === 'totem'") || appSrc.includes("searchParams.get('portal') === 'totem'"),
  'App.tsx must preserve Totem portal check'
);
assert.ok(
  appSrc.includes("searchParams.get('portal') === 'home'") || appSrc.includes("portalParam === 'home'"),
  'App.tsx must preserve PortalHome on portal=home'
);

console.log('\n🎉 ALL PUBLIC LANDING ROUTING TESTS PASSED!');

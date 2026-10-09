process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';
process.env.JWT_SECRET = 'customer-isolation-test-secret-at-least-32-chars';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: CUSTOMER PORTAL DATA ISOLATION & NO FALLBACK (TDD) ===');

// 1. Static AST/Content analysis of src/apps/CustomerApp.tsx
const customerAppPath = path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx');
const customerAppSrc = fs.readFileSync(customerAppPath, 'utf8');

// RED CHECK 1: CustomerApp must NOT call dbService.load() for production customer state
assert.strictEqual(
  customerAppSrc.includes('const initialDb = dbService.load();'),
  false,
  'CustomerApp must NOT call dbService.load() to initialize customer data'
);

// RED CHECK 2: CustomerApp must accept customer and bills props
assert.ok(
  customerAppSrc.includes('customer?: Customer | null') || customerAppSrc.includes('customer: Customer | null'),
  'CustomerAppProps must accept customer prop'
);
assert.ok(
  customerAppSrc.includes('bills?: CustomerBill[]') || customerAppSrc.includes('bills: CustomerBill[]'),
  'CustomerAppProps must accept bills prop'
);

// RED CHECK 3: CustomerApp must NOT fallback to cust-1 or customers[0]
assert.strictEqual(
  customerAppSrc.includes("|| 'cust-1'"),
  false,
  'CustomerApp must NOT contain fallback to "cust-1"'
);
assert.strictEqual(
  customerAppSrc.includes("initialDb.customers[0]"),
  false,
  'CustomerApp must NOT fallback to initialDb.customers[0]'
);

// RED CHECK 4: CustomerApp must render recovery message when customer === null
assert.ok(
  customerAppSrc.includes('Non riusciamo a trovare la tua fornitura'),
  'CustomerApp must render "Non riusciamo a trovare la tua fornitura" when customer is null'
);

// 2. Static AST/Content analysis of src/components/customer/SubitoHeader.tsx
const headerPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'SubitoHeader.tsx');
const headerSrc = fs.readFileSync(headerPath, 'utf8');

// RED CHECK 5: Return to backend must be conditional on onReturnToBackend
assert.ok(
  headerSrc.includes('{onReturnToBackend &&') || headerSrc.includes('Boolean(onReturnToBackend) &&'),
  'SubitoHeader must guard "Torna al Backend CRM" button with onReturnToBackend check'
);

// 3. Static AST/Content analysis of src/App.tsx
const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
const appSrc = fs.readFileSync(appPath, 'utf8');

// RED CHECK 6: App.tsx passes customer and bills props to CustomerApp
assert.ok(
  appSrc.includes('<CustomerApp') && appSrc.includes('customer=') && appSrc.includes('bills='),
  'App.tsx must pass customer and bills props to CustomerApp'
);

// RED CHECK 7: App.tsx only renders ImpersonationBanner when staff is impersonating
assert.ok(
  appSrc.includes('impersonat') && appSrc.includes('<ImpersonationBanner'),
  'App.tsx must conditionally render ImpersonationBanner only during staff impersonation'
);

// 4. Runtime Service Isolation: Customer A cannot see Customer B's bills
const { portalService } = require('../server/dist/services/portalService.js');

async function testBackendDataIsolation() {
  const custA = 'cust-1';
  const custB = 'cust-2';

  const billsA = await portalService.listBills(custA);
  const billsB = await portalService.listBills(custB);

  // Assert that none of custB's bills are in custA's results
  for (const b of billsA) {
    assert.strictEqual(b.customerId, custA, `Bill ${b.id} belongs to ${b.customerId}, expected ${custA}`);
  }
  for (const b of billsB) {
    assert.strictEqual(b.customerId, custB, `Bill ${b.id} belongs to ${b.customerId}, expected ${custB}`);
  }

  // Non-existent customer ID returns empty array, never a fallback
  const billsNonExistent = await portalService.listBills('cust-non-existent-999');
  assert.strictEqual(billsNonExistent.length, 0, 'Non-existent customer must return 0 bills, not a fallback');

  console.log('✔ Backend portalService bill isolation verified');
}

testBackendDataIsolation().then(() => {
  console.log('🎉 ALL CUSTOMER PORTAL ISOLATION CHECKS PASSED!');
}).catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});

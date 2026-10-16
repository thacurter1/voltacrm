const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Systematic Debugging Regression Suite...');

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

const appTsxPath = path.join(__dirname, '..', 'src', 'App.tsx');
const crmAppPath = path.join(__dirname, '..', 'src', 'apps', 'CrmApp.tsx');
const portalRoutePath = path.join(__dirname, '..', 'server', 'src', 'routes', 'portal.ts');

const appTsx = fs.readFileSync(appTsxPath, 'utf8');
const crmApp = fs.readFileSync(crmAppPath, 'utf8');
const portalRoute = fs.readFileSync(portalRoutePath, 'utf8');

// 1. CallCenterWorkspace in App.tsx must not fire duplicate saveAppointment / updateAppointmentStatus calls
test('App.tsx: CallCenterWorkspace handlers do not fire duplicate saveAppointment or updateAppointmentStatus API calls', () => {
  const callCenterSectionMatch = appTsx.match(/<CallCenterWorkspace[\s\S]*?\/>/);
  assert.ok(callCenterSectionMatch, 'Must find <CallCenterWorkspace /> in App.tsx');
  const callCenterBlock = callCenterSectionMatch[0];

  assert.ok(
    !callCenterBlock.includes('api.operations.saveAppointment'),
    'CallCenterWorkspace onScheduleAppointment must delegate exclusively to handleScheduleAppointment without duplicate api.operations.saveAppointment call'
  );
  assert.ok(
    !callCenterBlock.includes('api.operations.updateAppointmentStatus'),
    'CallCenterWorkspace onUpdateAppointmentStatus must delegate exclusively to handleUpdateAppointmentStatus without duplicate api.operations.updateAppointmentStatus call'
  );
});

// 2. TeamProfilesManager onCustomerCreated in App.tsx passes live marketIndex to runQuarterlyAudit
test('App.tsx: TeamProfilesManager onCustomerCreated passes live marketIndex to runQuarterlyAudit', () => {
  const teamSectionMatch = appTsx.match(/<TeamProfilesManager[\s\S]*?\/>/);
  assert.ok(teamSectionMatch, 'Must find <TeamProfilesManager /> in App.tsx');
  const teamBlock = teamSectionMatch[0];

  assert.ok(
    teamBlock.includes('runQuarterlyAudit([newCust, ...customers], marketIndex)') ||
    teamBlock.includes('runQuarterlyAudit(updated, marketIndex)'),
    'onCustomerCreated must pass marketIndex to runQuarterlyAudit'
  );
});

// 3. PortalGate onBackToPublic in App.tsx clears portal/login URL query parameters via history.replaceState
test('App.tsx: PortalGate onBackToPublic clears portal/login URL query params so ?portal=staff visitors can return to public comparator', () => {
  const portalGateSectionMatch = appTsx.match(/<PortalGate[\s\S]*?\/>/);
  assert.ok(portalGateSectionMatch, 'Must find <PortalGate /> in App.tsx');
  const portalGateBlock = portalGateSectionMatch[0];

  assert.ok(
    portalGateBlock.includes('replaceState') || appTsx.includes('handleBackToPublic'),
    'onBackToPublic must clear URL query parameters (portal, login) via history.replaceState in addition to setIsStaffGateOpen(false)'
  );
});

// 4. Header in App.tsx does not hardcode pendingCommissionsCount={2}
test('App.tsx: Header does not hardcode static pendingCommissionsCount={2}', () => {
  assert.ok(
    !appTsx.includes('pendingCommissionsCount={2}'),
    'App.tsx must not hardcode pendingCommissionsCount={2}'
  );
});

// 5. CrmApp.tsx does not use loose .includes() substring matching for broker customer ownership
test('CrmApp.tsx: broker customer filtering uses strict equality instead of loose .includes()', () => {
  assert.ok(
    !crmApp.includes('currentUser.name.includes(c.accountManager)') &&
    !crmApp.includes('c.accountManager.includes(brokerName)'),
    'CrmApp.tsx must not use loose .includes() on accountManager'
  );
});

// 6. server/src/routes/portal.ts coerces numeric string annualConsumption on guest consultations
test('portal.ts: guest consultation route coerces numeric string annualConsumption safely', () => {
  assert.ok(
    portalRoute.includes('Number(annualConsumption)'),
    'portal.ts should coerce annualConsumption with Number(annualConsumption) so numeric strings are preserved'
  );
});

const ownershipPath = path.join(__dirname, '..', 'server', 'src', 'services', 'customerOwnership.ts');
const customersRoutePath = path.join(__dirname, '..', 'server', 'src', 'routes', 'customers.ts');
const switchRoutePath = path.join(__dirname, '..', 'server', 'src', 'routes', 'switch.ts');

const ownershipSrc = fs.readFileSync(ownershipPath, 'utf8');
const customersRouteSrc = fs.readFileSync(customersRoutePath, 'utf8');
const switchRouteSrc = fs.readFileSync(switchRoutePath, 'utf8');

// 7. customerOwnership.ts exports centralized getAccessibleCustomersForActor and switch.ts / customers.ts reuse it
test('customerOwnership.ts & routes: centralized getAccessibleCustomersForActor & canActorAccessCustomer eliminate duplicated RBAC branching', () => {
  assert.ok(
    ownershipSrc.includes('export function getAccessibleCustomersForActor'),
    'customerOwnership.ts must export getAccessibleCustomersForActor'
  );
  assert.ok(
    customersRouteSrc.includes('canActorAccessCustomer'),
    'customers.ts must reuse canActorAccessCustomer instead of manual per-role branching'
  );
  assert.ok(
    switchRouteSrc.includes('getAccessibleCustomersForActor'),
    'switch.ts must reuse getAccessibleCustomersForActor for /audit and /signatures'
  );
});

// 8. portal.ts centralizes UTM attribution formatting and default broker lookup
test('portal.ts: centralizes formatUtmNote and resolveDefaultBrokerId helpers', () => {
  assert.ok(
    portalRoute.includes('function formatUtmNote') && portalRoute.includes('function resolveDefaultBrokerId'),
    'portal.ts should use shared formatUtmNote and resolveDefaultBrokerId helpers across guest endpoints'
  );
});

console.log(`\n📊 Risultato Systematic Debugging Suite: ${passed} passati, ${failed} falliti.`);
if (failed > 0) {
  process.exit(1);
}

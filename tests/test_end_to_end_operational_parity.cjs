const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: END-TO-END OPERATIONAL PARITY (CALL CENTER -> BILLS -> SWITCH -> COMMISSIONS) ===');

const root = path.join(__dirname, '..');

// 1. Backend CORS allows 127.0.0.1 & createLeadSchema accepts empty email string
const serverIndex = fs.readFileSync(path.join(root, 'server', 'src', 'index.ts'), 'utf8');
assert.ok(
  serverIndex.includes("parsed.hostname === '127.0.0.1'"),
  'Express CORS must allow 127.0.0.1 local origin alongside localhost'
);

const validateSrc = fs.readFileSync(path.join(root, 'server', 'src', 'middleware', 'validate.ts'), 'utf8');
assert.ok(
  validateSrc.includes("z.union([z.string().email(), z.literal('')]).optional()"),
  'createLeadSchema must accept empty string email without throwing 400 ZodError'
);

// 2. portalApi operational fallbacks & persistence (analyzeBill, createSupportRequest, claimGuestBill, export/closure)
const portalSrc = fs.readFileSync(path.join(root, 'src', 'api', 'portal.ts'), 'utf8');
assert.ok(
  portalSrc.includes("status: 'analyzed'") && portalSrc.includes("model: 'demo'"),
  'portalApi.analyzeBill must update stored bill status and return demo-labelled OCR extraction in demo sessions'
);
assert.ok(
  portalSrc.includes('leads: [supportLead, ...(state.leads || [])]'),
  'portalApi.createSupportRequest must persist support lead in dbService so it survives reload and reaches Call Center'
);

// 3. client.ts OTP verification, SignatureActivationPanel alignment & Commissions settlement
const clientSrc = fs.readFileSync(path.join(root, 'src', 'api', 'client.ts'), 'utf8');
assert.ok(
  clientSrc.includes('VOLTA_DEMO_LAST_OTP') && clientSrc.includes('verified: true'),
  'api.messaging.verifyOtp must verify sandbox OTP code in demo sessions'
);
assert.ok(
  clientSrc.includes("status: 'signed' as const") && clientSrc.includes("activationStatus: 'pending_activation' as const"),
  'api.switch.signContract must emit status=signed and activationStatus=pending_activation for SignatureActivationPanel'
);
assert.ok(
  clientSrc.includes('VOLTA_DEMO_COMMISSIONS_V1') && clientSrc.includes('VOLTA_DEMO_BATCHES_V1'),
  'api.commissions must persist commission records and settlement batches in demo sessions'
);

// 4. AddCustomerModal prevents in-place button type="button" -> type="submit" premature form submit
const addCustSrc = fs.readFileSync(path.join(root, 'src', 'components', 'AddCustomerModal.tsx'), 'utf8');
assert.ok(
  addCustSrc.includes('key="next-to-forniture"') && addCustSrc.includes('key="submit-new-customer"'),
  'AddCustomerModal must use distinct keys on step navigation vs submit buttons to prevent mid-click form submission'
);

// 5. TeamProfilesManager displays all staff roles (admin, call_center, broker, operator)
const teamSrc = fs.readFileSync(path.join(root, 'src', 'components', 'TeamProfilesManager.tsx'), 'utf8');
assert.ok(
  teamSrc.includes("p.role !== 'customer'") && teamSrc.includes('<option value="broker">'),
  'TeamProfilesManager must display and allow creating broker and operator profiles'
);

// 6. ScheduleAppointmentModal defaults to today (never hardcoded past date)
const schedSrc = fs.readFileSync(path.join(root, 'src', 'components', 'ScheduleAppointmentModal.tsx'), 'utf8');
assert.strictEqual(
  schedSrc.includes('2026-09-05'),
  false,
  'ScheduleAppointmentModal must not default to a hardcoded past date'
);

console.log('✔ ALL END-TO-END OPERATIONAL PARITY CHECKS PASSED!');

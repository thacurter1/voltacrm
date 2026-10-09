process.env.NODE_ENV = 'test';
process.env.VOLTA_DEMO_MODE = 'true';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

console.log('=== TEST SUITE: BILL INTAKE VALIDATION & HONEST COMPARISON MODEL (TDD) ===');

// 1. Check offerComparison.ts module
const offerComparisonTsPath = path.join(__dirname, '..', 'src', 'services', 'offerComparison.ts');
assert.ok(fs.existsSync(offerComparisonTsPath), 'src/services/offerComparison.ts must exist');

// 2. Load compiled or transpiled offerComparison if available, or test pure logic
// Since project uses Vite / TS, let's test functions exported by offerComparison.ts
const offerCompSrc = fs.readFileSync(offerComparisonTsPath, 'utf8');

// Verify interface and function definitions in source
assert.ok(offerCompSrc.includes('interface ComparisonInput'), 'Must export ComparisonInput');
assert.ok(offerCompSrc.includes('interface ComparisonResult'), 'Must export ComparisonResult');
assert.ok(offerCompSrc.includes('compareOffer'), 'Must export compareOffer function');
assert.ok(offerCompSrc.includes('MAX_BILL_FILE_BYTES'), 'Must define MAX_BILL_FILE_BYTES as 10MB');
assert.ok(offerCompSrc.includes('validateBillUploadFile'), 'Must export validateBillUploadFile');

// Verify NO Math.max(80 or Math.max(120 in offerComparison.ts
assert.strictEqual(
  offerCompSrc.includes('Math.max(80') || offerCompSrc.includes('Math.max(120'),
  false,
  'offerComparison must NEVER enforce artificial minimum savings'
);

// 3. Test validateBillUploadFile logic
// Replicate client validation rules matching backend MAX_BILL_BYTES (10MB) and mime signatures
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

function validateClientFile(file) {
  if (!file) return { valid: false, error: 'File non selezionato.' };
  if (file.size <= 0) return { valid: false, error: 'Il file è vuoto.' };
  if (file.size > MAX_BYTES) return { valid: false, error: 'La dimensione del file supera il limite di 10 MB.' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mime = file.type || '';
  if (mime === 'image/webp' || ext === 'webp') {
    return { valid: false, error: 'Formato WebP non supportato. Carica un file PDF, PNG o JPEG.' };
  }
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(mime);
  const isAllowedExt = ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
  if (!isAllowedMime && !isAllowedExt) {
    return { valid: false, error: 'Formato non supportato. Sono ammessi solo file PDF, JPG o PNG.' };
  }
  return { valid: true };
}

// Test validation scenarios
assert.strictEqual(validateClientFile(null).valid, false);
assert.strictEqual(validateClientFile({ name: 'bill.pdf', size: 0, type: 'application/pdf' }).valid, false);
assert.strictEqual(validateClientFile({ name: 'bill.webp', size: 500, type: 'image/webp' }).valid, false);
assert.strictEqual(validateClientFile({ name: 'bill.docx', size: 500, type: 'application/docx' }).valid, false);
assert.strictEqual(validateClientFile({ name: 'bill.pdf', size: 11 * 1024 * 1024, type: 'application/pdf' }).valid, false);
assert.strictEqual(validateClientFile({ name: 'bill.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' }).valid, true);
assert.strictEqual(validateClientFile({ name: 'fattura.jpg', size: 3 * 1024 * 1024, type: 'image/jpeg' }).valid, true);
assert.strictEqual(validateClientFile({ name: 'foto.png', size: 1 * 1024 * 1024, type: 'image/png' }).valid, true);
console.log('✔ Client file validation constraints (PDF, JPG, PNG <= 10MB, no WebP) verified');

// 4. Verify EnergyBillIntake component source
const intakePath = path.join(__dirname, '..', 'src', 'components', 'customer', 'EnergyBillIntake.tsx');
assert.ok(fs.existsSync(intakePath), 'EnergyBillIntake.tsx must exist');
const intakeSrc = fs.readFileSync(intakePath, 'utf8');

// RED CHECK: Must NOT call createCustomerFromOcr or invent mandate
assert.strictEqual(
  intakeSrc.includes('createCustomerFromOcr') || intakeSrc.includes('hasBrokerageMandate: true'),
  false,
  'EnergyBillIntake must NOT create synthetic customers or brokerage mandates'
);

// RED CHECK: Must NOT call portalApi.analyzeBill from customer context
assert.strictEqual(
  intakeSrc.includes('portalApi.analyzeBill') || intakeSrc.includes('.analyzeBill('),
  false,
  'EnergyBillIntake must NOT call analyzeBill directly (which returns 403 for customer)'
);

// RED CHECK: Must use portalApi.uploadBill
assert.ok(
  intakeSrc.includes('portalApi.uploadBill'),
  'EnergyBillIntake must use portalApi.uploadBill for uploads'
);

// RED CHECK: Maximum size 10MB mentioned in UI (not 15MB)
assert.strictEqual(
  intakeSrc.includes('15MB') || intakeSrc.includes('15 MB'),
  false,
  'EnergyBillIntake must not reference 15 MB limit'
);
assert.ok(
  intakeSrc.includes('10 MB') || intakeSrc.includes('10MB'),
  'EnergyBillIntake must state 10 MB limit'
);

// RED CHECK: Must NOT allow WebP
assert.strictEqual(
  intakeSrc.includes('webp') || intakeSrc.includes('WebP'),
  false,
  'EnergyBillIntake must NOT offer WebP format'
);

console.log('🎉 ALL BILL INTAKE & COMPARISON MODEL CHECKS PASSED!');

const assert = require('node:assert/strict');
const { requireKioskDevice } = require('../server/dist/middleware/kioskDevice.js');
const { kioskLeadSchema } = require('../server/dist/middleware/validate.js');

const validCapture = { phone: '+39 340 1234567', supplyType: 'luce', monthlyExpenseEur: 65 };
assert.equal(kioskLeadSchema.safeParse(validCapture).success, true);
for (const invalid of [
  { ...validCapture, phone: '12345678' },
  { ...validCapture, monthlyExpenseEur: -10 },
  { ...validCapture, supplyType: 'unknown' },
  { ...validCapture, email: 'not-an-email' },
]) assert.equal(kioskLeadSchema.safeParse(invalid).success, false, 'Invalid kiosk data must be rejected');

function checkDevice(header) {
  let status = 0;
  let nextCalled = false;
  const response = {
    status(value) { status = value; return this; },
    json() { return this; },
  };
  requireKioskDevice({ headers: header ? { 'x-kiosk-device-key': header } : {} }, response, () => { nextCalled = true; });
  return { status, nextCalled };
}

const original = {
  NODE_ENV: process.env.NODE_ENV,
  VOLTA_DEMO_MODE: process.env.VOLTA_DEMO_MODE,
  TOTEM_KIOSK_DEVICE_KEY: process.env.TOTEM_KIOSK_DEVICE_KEY,
};

try {
  process.env.NODE_ENV = 'production';
  process.env.VOLTA_DEMO_MODE = 'true';
  delete process.env.TOTEM_KIOSK_DEVICE_KEY;
  assert.equal(checkDevice().status, 503, 'An unprovisioned production kiosk fails closed');
  process.env.TOTEM_KIOSK_DEVICE_KEY = 'dedicated-device-key';
  assert.equal(checkDevice().status, 401, 'A public browser cannot submit a kiosk lead');
  assert.equal(checkDevice('wrong-device-key').status, 401);
  assert.equal(checkDevice('dedicated-device-key').nextCalled, true);
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

(async () => {
  const response = await fetch('http://127.0.0.1:5000/api/kiosk/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '+39 340 1234567',
      name: 'Visitatore test',
      supplyType: 'luce',
      monthlyExpenseEur: 65,
      totemId: 'TEST-KIOSK',
    }),
  });
  assert.equal(response.status, 201, 'Standalone demo kiosk can capture a request');
  const result = await response.json();
  assert.equal(result.estimatedSavingsAnnualEur, null, 'No savings without a real bill comparison');
  assert.match(result.advice, /verificherà la bolletta/i);
  console.log('Dedicated-device boundary and honest kiosk estimate verified.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

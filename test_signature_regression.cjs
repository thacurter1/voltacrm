const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 5196;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const VALID_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function request(pathname, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: response.status, data };
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Backend exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for the isolated signature test backend.');
}

async function run() {
  const tsxCli = path.join(__dirname, 'server', 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = path.join(__dirname, 'server', 'src', 'index.ts');
  const child = spawn(process.execPath, [tsxCli, serverEntry], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VOLTA_DEMO_MODE: 'true',
      PORT: String(PORT),
      JWT_SECRET: 'signature-regression-secret-with-adequate-length',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      ADMIN_INITIAL_PASSWORD: 'admin123',
      CUSTOMER_INITIAL_PASSWORD: 'customer123'
    }
  });
  let backendOutput = '';
  child.stdout.on('data', chunk => { backendOutput += chunk; });
  child.stderr.on('data', chunk => { backendOutput += chunk; });

  try {
    await waitForServer(child);

    const adminLogin = await request('/auth/login-operator', {
      method: 'POST',
      body: { email: 'm.riva@voltagroup.it', password: 'admin123', totpCode: '123456' }
    });
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
    const adminToken = adminLogin.data.token;

    const customerLogin = await request('/auth/login-customer', {
      method: 'POST',
      body: { identifier: 'andrea.moretti@email.it', password: 'customer123' }
    });
    assert.equal(customerLogin.status, 200, JSON.stringify(customerLogin.data));

    const created = await request('/customers', {
      token: adminToken,
      method: 'POST',
      body: {
        name: 'Cliente Firma Regressione',
        fiscalCode: 'RSSMRA80A01H501U',
        phone: '+39 347 000 1122',
        email: 'firma.regressione@example.test',
        city: 'Torino',
        utilityPoints: [
          {
            id: 'sig-point-a',
            type: 'luce',
            podOrPdr: 'IT001E00000001',
            annualConsumption: 2400,
            currentSupplier: 'Fornitore A',
            currentOfferName: 'Offerta A',
            currentTariffType: 'fixed',
            currentUnitCost: 0.22,
            currentFixedFeeYear: 150
          },
          {
            id: 'sig-point-b',
            type: 'luce',
            podOrPdr: 'IT001E00000002',
            annualConsumption: 3100,
            currentSupplier: 'Fornitore B',
            currentOfferName: 'Offerta B',
            currentTariffType: 'fixed',
            currentUnitCost: 0.24,
            currentFixedFeeYear: 160
          }
        ]
      }
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const customerId = created.data.customer.id;

    const validPayload = {
      customerId,
      customerName: 'Cliente Firma Regressione',
      signerFiscalCode: 'RSSMRA80A01H501U',
      phone: '+39 347 000 1122',
      signatureType: 'canvas',
      canvasDataUrl: VALID_PNG,
      offerId: 'off-luce-1',
      supplier: 'Octopus Energy',
      utilityPointId: 'sig-point-b',
      podOrPdr: 'IT001E00000002',
      consentVersion: 'brokerage-and-switch-v1'
    };

    const invalidPng = await request('/switch/sign', {
      token: adminToken,
      method: 'POST',
      body: { ...validPayload, canvasDataUrl: 'data:image/png;base64,dGhpcyBpcyBub3QgYSBwbmc=' }
    });
    assert.equal(invalidPng.status, 400, 'A PNG MIME prefix must not bypass decoded PNG validation.');

    const suffixPhone = await request('/switch/sign', {
      token: adminToken,
      method: 'POST',
      body: { ...validPayload, phone: '00001122' }
    });
    assert.equal(suffixPhone.status, 400, 'A matching phone suffix must not satisfy identity validation.');

    const conflictingName = await request('/switch/sign', {
      token: adminToken,
      method: 'POST',
      body: { ...validPayload, customerName: 'Nome Alterato' }
    });
    assert.equal(conflictingName.status, 400, 'Signer name must be derived from the stored customer.');

    const conflictingFiscalCode = await request('/switch/sign', {
      token: adminToken,
      method: 'POST',
      body: { ...validPayload, signerFiscalCode: 'VRDLGI80A01H501J' }
    });
    assert.equal(conflictingFiscalCode.status, 400, 'Fiscal code must be derived from the stored customer.');

    const wrongEnergyPoint = await request('/switch/sign', {
      token: adminToken,
      method: 'POST',
      body: {
        ...validPayload,
        utilityPointId: 'sig-point-b',
        podOrPdr: 'IT001E00000002',
        offerId: 'off-gas-1',
        supplier: 'Eni Plenitude'
      }
    });
    assert.equal(wrongEnergyPoint.status, 400, 'Offer energy type must match the bound utility point.');

    const beforeSign = await request(`/customers/${customerId}`, { token: adminToken });
    const signed = await request('/switch/sign', {
      token: adminToken,
      method: 'POST',
      body: validPayload
    });
    assert.equal(signed.status, 201, JSON.stringify(signed.data));
    const receipt = signed.data.signatureReceipt;
    assert.equal(receipt.customerName, 'Cliente Firma Regressione');
    assert.equal(receipt.signerFiscalCode, 'RSSMRA80A01H501U');
    assert.equal(receipt.phone, '+39 347 000 1122');
    assert.equal(receipt.utilityPointId, 'sig-point-b');
    assert.equal(receipt.podOrPdr, 'IT001E00000002');
    assert.equal(receipt.energyType, 'luce');
    assert.equal(receipt.status, 'signed');
    assert.equal(receipt.activationStatus, 'pending_activation');
    assert.equal(receipt.consentVersion, 'brokerage-and-switch-v1');
    assert.equal(receipt.canvasDataUrl, VALID_PNG, 'The signed canvas bytes must be retained.');
    assert.equal(receipt.offerSnapshot.unitPriceOrSpread, 0.118);
    assert.equal(receipt.offerSnapshot.fixedAnnualFee, 96);
    assert.equal(receipt.originalPointSnapshot.currentSupplier, 'Fornitore B');
    assert.equal(receipt.canonicalDocument.offer.id, 'off-luce-1');
    assert.match(receipt.signatureHash, /^SHA256:[a-f0-9]{64}$/);
    const expectedDocumentHash = `SHA256:${require('node:crypto').createHash('sha256').update(JSON.stringify(receipt.canonicalDocument)).digest('hex')}`;
    assert.equal(receipt.documentHash, expectedDocumentHash, 'The retained canonical document must independently verify its hash.');
    assert.equal(receipt.signatureHash, expectedDocumentHash, 'The signature seal must bind only retained canonical evidence.');

    const afterSign = await request(`/customers/${customerId}`, { token: adminToken });
    assert.deepEqual(
      afterSign.data.customer.utilityPoints,
      beforeSign.data.customer.utilityPoints,
      'Signing must not switch suppliers or mutate utility points.'
    );

    const customerActivation = await request(`/switch/signatures/${receipt.id}/activate`, {
      token: customerLogin.data.token,
      method: 'POST',
      body: { confirmationReference: 'DSO-REF-001', activationDate: '2026-10-01' }
    });
    assert.equal(customerActivation.status, 403, 'Activation is a staff-only action.');

    const incompleteActivation = await request(`/switch/signatures/${receipt.id}/activate`, {
      token: adminToken,
      method: 'POST',
      body: { confirmationReference: '' }
    });
    assert.equal(incompleteActivation.status, 400, 'Activation requires a reference and date.');

    const activated = await request(`/switch/signatures/${receipt.id}/activate`, {
      token: adminToken,
      method: 'POST',
      body: { confirmationReference: 'DSO-REF-001', activationDate: '2026-10-01' }
    });
    assert.equal(activated.status, 200, JSON.stringify(activated.data));
    assert.equal(activated.data.signatureReceipt.status, 'activated');
    assert.equal(activated.data.signatureReceipt.activationReference, 'DSO-REF-001');

    const afterActivation = await request(`/customers/${customerId}`, { token: adminToken });
    const pointA = afterActivation.data.customer.utilityPoints.find(point => point.id === 'sig-point-a');
    const pointB = afterActivation.data.customer.utilityPoints.find(point => point.id === 'sig-point-b');
    assert.equal(pointA.currentSupplier, 'Fornitore A', 'Activation must not alter a sibling point.');
    assert.equal(pointB.currentSupplier, 'Octopus Energy');
    assert.equal(pointB.currentOfferName, 'Octopus Fissa 12M');
    assert.equal(pointB.currentUnitCost, 0.118);
    assert.equal(pointB.currentFixedFeeYear, 96);

    const duplicateActivation = await request(`/switch/signatures/${receipt.id}/activate`, {
      token: adminToken,
      method: 'POST',
      body: { confirmationReference: 'DSO-REF-002', activationDate: '2026-10-02' }
    });
    assert.equal(duplicateActivation.status, 409, 'An activated signature cannot be applied twice.');

    console.log('PASS signature regression: identity, PNG, point binding, pending signature, and staff activation.');
  } finally {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
    if (process.exitCode) console.error(backendOutput);
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

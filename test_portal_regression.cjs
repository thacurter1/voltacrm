const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = __dirname;

async function main() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'portal-regression-test-secret';
  const compileDir = path.join(root, 'server', '.portal-regression-' + process.pid);
  fs.mkdirSync(compileDir, { recursive: true });
  execFileSync(process.execPath, [
    path.join(root, 'server', 'node_modules', 'typescript', 'bin', 'tsc'),
    'src/services/dbClient.ts',
    'src/services/portalService.ts',
    'src/routes/portal.ts',
    '--outDir', compileDir,
    '--target', 'ES2022',
    '--module', 'NodeNext',
    '--moduleResolution', 'NodeNext',
    '--strict',
    '--esModuleInterop',
    '--skipLibCheck',
  ], {
    cwd: path.join(root, 'server'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const {
    createPortalService,
    validateBillFile,
    validateMeterReadingInput,
  } = await import(pathToFileURL(path.join(compileDir, 'services', 'portalService.js')).href);

  const pdf = Buffer.from('%PDF-1.7\nportal-test');
  assert.equal(validateBillFile(pdf, 'application/pdf').mimeType, 'application/pdf');
  assert.throws(
    () => validateBillFile(Buffer.from('not a pdf'), 'application/pdf'),
    /contenuto.*non corrisponde/i,
    'A renamed non-PDF must be rejected by its bytes',
  );
  assert.throws(
    () => validateBillFile(Buffer.alloc(10 * 1024 * 1024 + 1), 'application/pdf'),
    /10 MB/i,
    'Oversized files must be rejected before storage',
  );

  assert.deepEqual(
    validateMeterReadingInput({
      utilityPointId: 'util-1-luce',
      utilityType: 'luce',
      readings: { f1: 100, f2: 80, f3: 70 },
    }).readings,
    { f1: 100, f2: 80, f3: 70 },
  );
  assert.throws(
    () => validateMeterReadingInput({
      utilityPointId: 'util-1-luce',
      utilityType: 'luce',
      readings: { f1: -1 },
    }),
    /non negativ/i,
  );
  assert.throws(
    () => validateMeterReadingInput({
      utilityPointId: 'util-1-gas',
      utilityType: 'gas',
      readings: { gas: '12' },
    }),
    /numero/i,
  );

  const calls = [];
  const storedBytes = new Map();
  const records = [];
  let failMetadata = false;
  const backend = {
    async uploadBill(pathname, bytes) {
      calls.push(['upload', pathname]);
      storedBytes.set(pathname, Buffer.from(bytes));
    },
    async insertBill(record) {
      calls.push(['insert', record.storagePath]);
      if (failMetadata) throw new Error('metadata unavailable');
      records.push(record);
      return record;
    },
    async removeBill(pathname) {
      calls.push(['remove', pathname]);
      storedBytes.delete(pathname);
    },
    async listBills(customerId) {
      return records.filter((item) => item.customerId === customerId);
    },
    async getBill(id) {
      return records.find((item) => item.id === id) || null;
    },
    async getBillDownload(record) {
      return { kind: 'bytes', bytes: storedBytes.get(record.storagePath), mimeType: record.mimeType };
    },
    async insertReading(record) {
      return record;
    },
    async listReadings() {
      return [];
    },
  };

  const service = createPortalService(backend, () => new Date('2026-09-16T12:00:00.000Z'));
  const bill = await service.uploadBill({
    customerId: 'cust-1',
    customerName: 'Andrea Moretti',
    fileName: '../../settembre.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
    utilityType: 'luce',
    notes: 'Bolletta settembre',
  });
  assert.equal(bill.fileName, 'settembre.pdf');
  assert.deepEqual(await service.listBills('cust-1'), [bill]);
  const download = await service.getBillDownload(bill.id);
  assert.equal(download.kind, 'bytes');
  assert.deepEqual(download.bytes, pdf, 'Local demo download must return the actual uploaded bytes');

  failMetadata = true;
  await assert.rejects(
    service.uploadBill({
      customerId: 'cust-1',
      customerName: 'Andrea Moretti',
      fileName: 'failure.pdf',
      mimeType: 'application/pdf',
      bytes: pdf,
      utilityType: 'luce',
    }),
    /metadata unavailable/,
  );
  assert.equal(calls.at(-1)[0], 'remove', 'Failed metadata persistence must compensate the uploaded object');
  assert.equal(storedBytes.size, 1, 'Compensated upload must not leave orphaned bytes');

  await assert.rejects(
    service.getBillDownload('bill-does-not-exist'),
    /non trovata/i,
  );

  require(path.join(root, 'server', 'node_modules', 'express-async-errors'));
  const express = require(path.join(root, 'server', 'node_modules', 'express'));
  const { portalRouter } = await import(pathToFileURL(path.join(compileDir, 'routes', 'portal.js')).href);
  const { generateToken } = await import(pathToFileURL(path.join(compileDir, 'middleware', 'auth.js')).href);
  const dataStore = await import(pathToFileURL(path.join(compileDir, 'services', 'dataStore.js')).href);
  dataStore.users.push({
    id: 'user-cust-2',
    email: 'customer2@example.test',
    role: 'customer',
    customerId: 'cust-2',
  });

  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use('/api/portal', portalRouter);
  app.use((error, _request, response, _next) => {
    response.status(error.status || 500).json({ success: false, message: error.message });
  });
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const address = server.address();
  const baseUrl = 'http://127.0.0.1:' + address.port + '/api/portal';
  const customer1Token = generateToken({
    userId: 'user-cust-1',
    email: 'andrea.moretti@email.it',
    role: 'customer',
  });
  const customer2Token = generateToken({
    userId: 'user-cust-2',
    email: 'customer2@example.test',
    role: 'customer',
  });

  try {
    const unauthenticated = await fetch(baseUrl + '/bills');
    assert.equal(unauthenticated.status, 401, 'Portal routes must require authentication');

    const uploadResponse = await fetch(baseUrl + '/bills', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + customer1Token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId: 'cust-2',
        fileName: 'owned.pdf',
        mimeType: 'application/pdf',
        base64Data: pdf.toString('base64'),
        utilityType: 'luce',
      }),
    });
    assert.equal(uploadResponse.status, 201);
    const uploaded = await uploadResponse.json();
    assert.equal(uploaded.bill.customerId, 'cust-1', 'Customer payload IDs must not override token ownership');

    const ownListResponse = await fetch(baseUrl + '/bills?customerId=cust-2', {
      headers: { Authorization: 'Bearer ' + customer1Token },
    });
    const ownList = await ownListResponse.json();
    assert.equal(ownList.bills.length, 1);
    assert.equal(ownList.bills[0].customerId, 'cust-1', 'Customer list queries must remain owner-scoped');

    const forbiddenDownload = await fetch(baseUrl + '/bills/' + uploaded.bill.id + '/download', {
      headers: { Authorization: 'Bearer ' + customer2Token },
      redirect: 'manual',
    });
    assert.equal(forbiddenDownload.status, 403, 'Another customer must not download the uploaded bill');

    const downloadResponse = await fetch(baseUrl + '/bills/' + uploaded.bill.id + '/download', {
      headers: { Authorization: 'Bearer ' + customer1Token },
    });
    assert.equal(downloadResponse.status, 200);
    assert.deepEqual(
      Buffer.from(await downloadResponse.arrayBuffer()),
      pdf,
      'Authenticated local download must stream the actual uploaded bytes',
    );
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  console.log('Portal regression tests passed.');
  fs.rmSync(compileDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

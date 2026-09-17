const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const projectRoot = __dirname;
const originalCwd = process.cwd();
const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'voltacrm-accounting-'));

function validInput(overrides = {}) {
  return {
    agentId: 'agent-accounting-a',
    agentName: 'Agent Accounting A',
    contractId: 'contract-accounting-a',
    customerName: 'Customer Accounting A',
    podOrPdr: 'IT001EACCOUNTINGA',
    utilityType: 'luce',
    customerType: 'residential',
    annualConsumption: 3600,
    isDualFuel: false,
    ...overrides
  };
}

async function requestJson(server, method, pathname, body, headers = {}) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: address.port,
      method,
      path: pathname,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers
      }
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: response.statusCode, data });
      });
    });
    request.on('error', reject);
    if (body) request.end(JSON.stringify(body));
    else request.end();
  });
}

async function main() {
  process.chdir(isolatedCwd);
  process.env.NODE_ENV = 'test';
  process.env.DOTENV_CONFIG_PATH = path.join(isolatedCwd, 'missing.env');
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  process.env.JWT_SECRET = 'accounting-regression-secret';

  const serviceUrl = pathToFileURL(path.join(projectRoot, 'server', 'dist', 'services', 'commissionService.js')).href;
  const routeUrl = pathToFileURL(path.join(projectRoot, 'server', 'dist', 'routes', 'commissions.js')).href;
  const authUrl = pathToFileURL(path.join(projectRoot, 'server', 'dist', 'middleware', 'auth.js')).href;
  const service = await import(`${serviceUrl}?memory=${Date.now()}`);

  await assert.rejects(
    Promise.resolve().then(() => service.generateContractCommissions(validInput({ contractId: '' }))),
    /contractId/i,
    'generation must reject an unstable, missing contract id'
  );
  await assert.rejects(
    Promise.resolve().then(() => service.generateContractCommissions(validInput({ podOrPdr: '   ' }))),
    /podOrPdr/i,
    'generation must reject a missing POD/PDR'
  );
  await assert.rejects(
    Promise.resolve().then(() => service.generateContractCommissions(validInput({
      contractId: 'contract-string-consumption',
      podOrPdr: 'IT001ESTRINGCONSUMPTION',
      annualConsumption: '3600'
    }))),
    /annualConsumption/i,
    'generation must reject numeric strings instead of silently coercing request data'
  );

  const first = await service.generateContractCommissions(validInput());
  const replay = await service.generateContractCommissions(validInput());
  assert.deepEqual(
    replay.records.map(record => record.id),
    first.records.map(record => record.id),
    'an identical generation retry must return the original stable records'
  );
  await assert.rejects(
    Promise.resolve().then(() => service.generateContractCommissions(validInput({
      agentId: 'agent-accounting-b',
      agentName: 'Agent Accounting B'
    }))),
    /belongs to another agent/i,
    'a replay must not disclose or adopt another agent\'s commission generation'
  );

  const secondAgent = await service.generateContractCommissions(validInput({
    agentId: 'agent-accounting-b',
    agentName: 'Agent Accounting B',
    contractId: 'contract-accounting-b',
    podOrPdr: 'IT001EACCOUNTINGB'
  }));
  await assert.rejects(
    Promise.resolve().then(() => service.settleCommissions({
      agentId: 'agent-accounting-a',
      commissionIds: [first.records[0].id, secondAgent.records[0].id]
    })),
    /eligible|agent|accrued/i,
    'mixed-agent settlement must fail atomically'
  );
  const afterRejectedSettlement = await service.getCommissions({ agentId: 'agent-accounting-a' });
  assert.equal(
    afterRejectedSettlement.find(record => record.id === first.records[0].id).status,
    'accrued',
    'a rejected settlement must not partially update eligible records'
  );

  const selectedIds = first.records.map(record => record.id);
  const settled = await service.settleCommissions({
    agentId: 'agent-accounting-a',
    commissionIds: selectedIds
  });
  const settledReplay = await service.settleCommissions({
    agentId: 'agent-accounting-a',
    commissionIds: [...selectedIds].reverse()
  });
  assert.equal(settledReplay.batch.id, settled.batch.id, 'settlement retry must return the original batch');
  assert.equal(settledReplay.updatedCount, settled.updatedCount, 'settlement retry must be duplicate-safe');

  const express = require(path.join(projectRoot, 'server', 'node_modules', 'express'));
  const { commissionRouter } = await import(`${routeUrl}?route=${Date.now()}`);
  const { generateToken } = await import(`${authUrl}?auth=${Date.now()}`);
  const app = express();
  app.use(express.json());
  app.use('/api/commissions', commissionRouter);
  const api = http.createServer(app);
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  try {
    const token = generateToken({ userId: 'user-admin-1', email: 'm.riva@voltagroup.it', role: 'admin' });
    const invalidResponse = await requestJson(api, 'POST', '/api/commissions/generate', {
      agentId: 'user-admin-1',
      customerName: 'Missing Stable Identifiers',
      utilityType: 'luce',
      annualConsumption: 1000
    }, { authorization: `Bearer ${token}` });
    assert.equal(invalidResponse.status, 400, 'the route must reject missing contractId and podOrPdr');
  } finally {
    await new Promise(resolve => api.close(resolve));
  }

  const dbRecord = {
    id: 'comm-db-authoritative', agent_id: 'db-agent', agent_name: 'Database Agent',
    contract_id: 'db-contract', customer_name: 'Database Customer', pod_or_pdr: 'IT001EDATABASE',
    utility_type: 'luce', customer_type: 'business', annual_consumption: 9000,
    type: 'upfront', amount_eur: 95, status: 'accrued', period: '2026-09',
    accrual_date: '2026-09-16', settlement_date: null, payment_reference: null, notes: null
  };
  const seen = [];
  const fakeSupabase = http.createServer((request, response) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; });
    request.on('end', () => {
      seen.push({ method: request.method, url: request.url, body: raw ? JSON.parse(raw) : null });
      response.setHeader('content-type', 'application/json');
      if (request.method === 'GET' && request.url.startsWith('/rest/v1/commissions')) {
        response.statusCode = 200;
        response.end(JSON.stringify([dbRecord]));
        return;
      }
      if (request.url.includes('/rest/v1/rpc/generate_contract_commissions')) {
        response.statusCode = 500;
        response.end(JSON.stringify({ message: 'forced database failure' }));
        return;
      }
      if (request.url.includes('/rest/v1/rpc/settle_commissions')) {
        response.statusCode = 500;
        response.end(JSON.stringify({ message: 'forced database failure' }));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ message: 'unexpected fake database request' }));
    });
  });
  const databaseModuleRoot = path.join(projectRoot, 'server', `.accounting-test-db-${process.pid}`);
  fs.mkdirSync(path.join(databaseModuleRoot, 'services'), { recursive: true });
  fs.copyFileSync(path.join(projectRoot, 'server', 'dist', 'services', 'commissionService.js'), path.join(databaseModuleRoot, 'services', 'commissionService.js'));
  fs.copyFileSync(path.join(projectRoot, 'server', 'dist', 'services', 'dbClient.js'), path.join(databaseModuleRoot, 'services', 'dbClient.js'));
  await new Promise(resolve => fakeSupabase.listen(0, '127.0.0.1', resolve));
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${fakeSupabase.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
    delete process.env.SUPABASE_ANON_KEY;
    const databaseServiceUrl = pathToFileURL(path.join(databaseModuleRoot, 'services', 'commissionService.js')).href;
    const databaseService = await import(`${databaseServiceUrl}?db=${Date.now()}`);
    const records = await databaseService.getCommissions();
    assert.deepEqual(records.map(record => record.id), ['comm-db-authoritative'], 'configured reads must use database state');
    await assert.rejects(databaseService.generateContractCommissions(validInput({ contractId: 'db-failure-contract', podOrPdr: 'IT001EDBFAIL' })), /forced database failure/i);
    await assert.rejects(databaseService.settleCommissions({ agentId: 'db-agent', commissionIds: ['comm-db-authoritative'] }), /forced database failure/i);
    const NativeDate = global.Date;
    global.Date = class extends NativeDate {
      constructor(...args) {
        super(...(args.length > 0 ? args : ['2099-12-01T00:00:00.000Z']));
      }
      static now() { return new NativeDate('2099-12-01T00:00:00.000Z').getTime(); }
    };
    try {
      await assert.rejects(databaseService.settleCommissions({ agentId: 'db-agent', commissionIds: ['comm-db-authoritative'] }), /forced database failure/i);
    } finally {
      global.Date = NativeDate;
    }
    assert.equal(seen.filter(request => request.url.includes('/rpc/generate_contract_commissions')).length, 1);
    const settlementRequests = seen.filter(request => request.url.includes('/rpc/settle_commissions'));
    assert.equal(settlementRequests.length, 2);
    assert.equal(
      settlementRequests[1].body.p_payment_reference,
      settlementRequests[0].body.p_payment_reference,
      'automatic payment references must remain stable when a retry crosses a calendar month'
    );
  } finally {
    await new Promise(resolve => fakeSupabase.close(resolve));
    fs.rmSync(databaseModuleRoot, { recursive: true, force: true });
  }

  console.log('Accounting regression tests passed.');
}

main()
  .finally(() => {
    process.chdir(originalCwd);
    fs.rmSync(isolatedCwd, { recursive: true, force: true });
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });

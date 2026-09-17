// test_e2e_full_flow.cjs - Astra Audit Unified End-to-End Test
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const FALLBACK_PORT = 5199;
const VALID_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function checkHealth(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function request(port, pathname, { token, method = 'GET', body } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/api${pathname}`, {
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

async function runTests(port) {
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING ASTRA E2E UNIFIED FLOW TEST on PORT ${port}`);
  console.log(`======================================================`);

  // --- 1. Login Admin ---
  console.log('\n--- FASE 1: Autenticazione Admin & Consulente ---');
  const loginRes = await request(port, '/auth/login-operator', {
    method: 'POST',
    body: { email: 'm.riva@voltagroup.it', password: 'admin123', totpCode: '123456' }
  });
  assert.equal(loginRes.status, 200, `Login fallito: ${JSON.stringify(loginRes.data)}`);
  const adminToken = loginRes.data.token;
  assert.ok(adminToken, 'Admin token mancante');
  console.log('✔ Login Admin completato con successo (JWT ottenuto).');

  // --- 2. Creazione Cliente Reale con 2 Forniture (Luce + Gas) ---
  console.log('\n--- FASE 2: Creazione Cliente Reale con fornitura Dual Fuel ---');
  const podLuce = `IT001E${String(Date.now()).slice(-8)}`;
  const pdrGas = `0088${String(Date.now()).slice(-10)}`;

  const createCustomerRes = await request(port, '/customers', {
    token: adminToken,
    method: 'POST',
    body: {
      name: 'Giuseppe Garibaldi',
      fiscalCode: 'GRBGPP60A01H501U',
      phone: '+39 333 9988776',
      email: `garibaldi-${Date.now()}@voltagroup.test`,
      city: 'Genova',
      accountManager: 'user-admin-1',
      utilityPoints: [
        {
          id: 'point-e2e-luce',
          type: 'luce',
          podOrPdr: podLuce,
          annualConsumption: 3200,
          powerKw: 3.5,
          currentSupplier: 'Servizio Elettrico Nazionale',
          currentOfferName: 'Maggior Tutela Luce',
          currentTariffType: 'fixed',
          currentUnitCost: 0.245,
          currentFixedFeeYear: 144
        },
        {
          id: 'point-e2e-gas',
          type: 'gas',
          podOrPdr: pdrGas,
          annualConsumption: 1400,
          currentSupplier: 'Eni Plenitude Gas',
          currentOfferName: 'Plenitude Base Gas',
          currentTariffType: 'fixed',
          currentUnitCost: 0.72,
          currentFixedFeeYear: 120
        }
      ]
    }
  });

  assert.equal(createCustomerRes.status, 201, `Creazione cliente fallita: ${JSON.stringify(createCustomerRes.data)}`);
  const customer = createCustomerRes.data.customer;
  assert.ok(customer, 'Customer object mancante nella risposta');
  assert.equal(customer.utilityPoints.length, 2, 'Devono essere presenti 2 punti di fornitura');
  console.log(`✔ Cliente creato: ${customer.name} (ID: ${customer.id})`);
  console.log(`  - Fornitura Luce: POD ${podLuce} (${customer.utilityPoints[0].currentSupplier})`);
  console.log(`  - Fornitura Gas: PDR ${pdrGas} (${customer.utilityPoints[1].currentSupplier})`);

  // --- 3. Selezione Offerta Migliore dal Catalogo Switch ---
  console.log('\n--- FASE 3: Consultazione Catalogo e Proposta Risparmio ---');
  const offersRes = await request(port, '/switch/offers', { token: adminToken });
  assert.equal(offersRes.status, 200);
  const targetOffer = offersRes.data.offers.find(o => o.id === 'off-luce-1' || (o.energyType === 'luce' && o.supplier === 'Octopus Energy'));
  assert.ok(targetOffer, 'Offerta Octopus Energy Luce non trovata');
  console.log(`✔ Offerta selezionata per lo switch: ${targetOffer.name} (${targetOffer.supplier}, ${targetOffer.pricingType})`);

  // --- 4. Firma Digitale Mandato (FEA con Tratto Grafico Canvas) ---
  console.log('\n--- FASE 4: Stipula Mandato e Firma FEA Canvas ---');
  const signRes = await request(port, '/switch/sign', {
    token: adminToken,
    method: 'POST',
    body: {
      customerId: customer.id,
      customerName: customer.name,
      signerFiscalCode: customer.fiscalCode,
      phone: customer.phone,
      utilityPointId: 'point-e2e-luce',
      podOrPdr: podLuce,
      offerId: targetOffer.id,
      supplier: targetOffer.supplier,
      signatureType: 'canvas',
      canvasDataUrl: VALID_PNG,
      consentVersion: '1.0'
    }
  });

  assert.equal(signRes.status, 201, `Firma fallita: ${JSON.stringify(signRes.data)}`);
  const receipt = signRes.data.signatureReceipt;
  assert.ok(receipt, 'Ricevuta di firma mancante');
  assert.equal(receipt.status, 'signed');
  assert.equal(receipt.activationStatus, 'pending_activation');
  assert.equal(receipt.podOrPdr, podLuce);
  console.log(`✔ Firma registrata con ID: ${receipt.id}`);
  console.log(`  - Stato firma: ${receipt.status} (${receipt.activationStatus})`);

  // Verifica Isolamento: la fornitura NON deve essere mutata prima dell'attivazione
  const checkCustomerBeforeRes = await request(port, `/customers/${customer.id}`, { token: adminToken });
  assert.equal(checkCustomerBeforeRes.status, 200);
  const custBefore = checkCustomerBeforeRes.data.customer;
  const pointLuceBefore = custBefore.utilityPoints.find(p => p.id === 'point-e2e-luce');
  assert.equal(pointLuceBefore.currentSupplier, 'Servizio Elettrico Nazionale', 'La fornitura luce NON deve mutare prima dell attivazione');
  const pointGasBefore = custBefore.utilityPoints.find(p => p.id === 'point-e2e-gas');
  assert.equal(pointGasBefore.currentSupplier, 'Eni Plenitude Gas', 'La fornitura gas non deve essere toccata');
  console.log('✔ Verifica isolamento confermata: POD non mutato nello stato pending_activation.');

  // --- 5. Conferma Attivazione da Staff con Riferimento Distributore e Auto-Provvigione ---
  console.log('\n--- FASE 5: Conferma Attivazione Staff con Riferimento Distributore ---');
  const confirmationRef = `DIST-CONF-${Date.now()}`;
  const activationDate = new Date().toISOString().slice(0, 10);

  const activateRes = await request(port, `/switch/signatures/${receipt.id}/activate`, {
    token: adminToken,
    method: 'POST',
    body: {
      confirmationReference: confirmationRef,
      activationDate,
      generateCommission: true,
      agentId: 'user-admin-1'
    }
  });

  assert.equal(activateRes.status, 200, `Attivazione fallita: ${JSON.stringify(activateRes.data)}`);
  assert.equal(activateRes.data.signatureReceipt.status, 'activated');
  assert.equal(activateRes.data.signatureReceipt.activationStatus, 'activated');
  assert.equal(activateRes.data.signatureReceipt.activationReference, confirmationRef);
  console.log(`✔ Fornitura attivata con successo! Riferimento: ${confirmationRef}`);

  // Verifica aggiornamento anagrafico e ciclo 120 giorni
  const checkCustomerAfterRes = await request(port, `/customers/${customer.id}`, { token: adminToken });
  assert.equal(checkCustomerAfterRes.status, 200);
  const custAfter = checkCustomerAfterRes.data.customer;
  const pointLuceAfter = custAfter.utilityPoints.find(p => p.id === 'point-e2e-luce');
  assert.equal(pointLuceAfter.currentSupplier, targetOffer.supplier, 'Fornitore luce aggiornato a Octopus Energy');
  assert.equal(pointLuceAfter.currentOfferName, targetOffer.name, 'Offerta luce aggiornata a Octopus Fissa');
  const pointGasAfter = custAfter.utilityPoints.find(p => p.id === 'point-e2e-gas');
  assert.equal(pointGasAfter.currentSupplier, 'Eni Plenitude Gas', 'Fornitura gas preservata senza alterazioni');
  assert.equal(custAfter.hasBrokerageMandate, true, 'Mandato di brokeraggio marcato true');
  assert.equal(custAfter.lastSwitchAuditDate, activationDate);
  console.log('✔ Stato fornitura aggiornato con isolamento per singolo POD.');
  console.log(`✔ Calendario switch a 120 giorni impostato a: ${custAfter.nextSwitchAuditDate}`);

  // --- 6. Verifica Provvigioni Generate e Idempotenza ---
  console.log('\n--- FASE 6: Verifica Maturazione Provvigionale e Idempotenza ---');
  const commissionsResult = activateRes.data.commissions;
  assert.ok(commissionsResult, 'Blocco provvigionale mancante nella risposta di attivazione');
  assert.ok(Array.isArray(commissionsResult.records), 'Records provvigionali non è un array');
  assert.ok(commissionsResult.records.length >= 2, 'Devono essere presenti almeno gettone upfront e mantenimento/bonus');
  assert.ok(commissionsResult.totalEur > 0, 'Totale provvigionale deve essere maggiore di 0');
  console.log(`✔ Provvigioni generate su attivazione: ${commissionsResult.records.length} voci per un totale di €${commissionsResult.totalEur}`);

  const upfrontRecord = commissionsResult.records.find(r => r.type === 'upfront');
  assert.ok(upfrontRecord, 'Gettone upfront mancante');
  assert.equal(upfrontRecord.contractId, receipt.id);
  assert.equal(upfrontRecord.podOrPdr, podLuce);
  assert.equal(upfrontRecord.status, 'accrued');

  // Test Idempotenza: ri-generare per lo stesso contratto non deve duplicare
  const retryGenRes = await request(port, '/commissions/generate', {
    token: adminToken,
    method: 'POST',
    body: {
      agentId: 'user-admin-1',
      agentName: upfrontRecord.agentName,
      contractId: receipt.id,
      customerName: customer.name,
      podOrPdr: podLuce,
      utilityType: 'luce',
      annualConsumption: 3200,
      isDualFuel: true
    }
  });
  assert.equal(retryGenRes.status, 201, `Retry generation fallita: ${JSON.stringify(retryGenRes.data)}`);
  assert.equal(retryGenRes.data.records.length, commissionsResult.records.length, 'Idempotenza: non devono essere generati nuovi record duplicati');
  console.log('✔ Idempotenza provvigionale verificata: retry contrattuale restituisce i record esistenti senza duplicare.');

  // --- 7. Liquidazione Distinta SEPA ---
  console.log('\n--- FASE 7: Liquidazione Batch SEPA Provvigioni ---');
  const commissionIds = commissionsResult.records.map(r => r.id);
  const paymentRef = `SEPA-E2E-${Date.now()}`;

  const settleRes = await request(port, '/commissions/settle', {
    token: adminToken,
    method: 'POST',
    body: {
      agentId: 'user-admin-1',
      commissionIds,
      paymentReference: paymentRef,
      notes: 'Liquidazione provvigionale test E2E flusso completo'
    }
  });

  assert.equal(settleRes.status, 200, `Liquidazione fallita: ${JSON.stringify(settleRes.data)}`);
  assert.equal(settleRes.data.batch.paymentReference, paymentRef);
  assert.equal(settleRes.data.updatedCount, commissionIds.length);
  console.log(`✔ Distinta SEPA generata con successo: ${paymentRef} per ${settleRes.data.updatedCount} record.`);

  // --- 8. Casi Limite e Negativi ---
  console.log('\n--- FASE 8: Test Casi Negativi e Confini ---');
  // Ri-attivazione stessa firma -> 409 Conflict
  const reActivateRes = await request(port, `/switch/signatures/${receipt.id}/activate`, {
    token: adminToken,
    method: 'POST',
    body: { confirmationReference: 'CONF-DUPLICATE', activationDate }
  });
  assert.equal(reActivateRes.status, 409, 'Ri-attivazione deve restituire 409 Conflict');
  console.log('✔ Conflitto su firma già attivata gestito (409 Conflict).');

  // Attivazione senza riferimento distributore -> 400 Bad Request
  const emptyRefRes = await request(port, `/switch/signatures/${receipt.id}/activate`, {
    token: adminToken,
    method: 'POST',
    body: { confirmationReference: '   ', activationDate }
  });
  assert.equal(emptyRefRes.status, 400, 'Mancanza riferimento deve restituire 400 Bad Request');
  console.log('✔ Validazione dati mancanti verificata (400 Bad Request).');

  // Firma inesistente -> 404 Not Found
  const notFoundRes = await request(port, '/switch/signatures/sig-non-esistente-999/activate', {
    token: adminToken,
    method: 'POST',
    body: { confirmationReference: 'CONF-TEST', activationDate }
  });
  assert.equal(notFoundRes.status, 404, 'Firma inesistente deve restituire 404 Not Found');
  console.log('✔ Firma inesistente gestita (404 Not Found).');

  console.log('\n======================================================');
  console.log('🎉 TUTTI I TEST DEL FLUSSO END-TO-END ASTRA SONO PASSATI!');
  console.log('======================================================\n');
}

async function main() {
  let isRunning = await checkHealth(DEFAULT_PORT);
  let child = null;
  let activePort = DEFAULT_PORT;

  if (!isRunning) {
    activePort = FALLBACK_PORT;
    console.log(`Port ${DEFAULT_PORT} non attiva, avvio server di test su porta ${activePort}...`);
    const tsxCli = path.join(__dirname, 'server', 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const serverEntry = path.join(__dirname, 'server', 'src', 'index.ts');
    child = spawn(process.execPath, [tsxCli, serverEntry], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        VOLTA_DEMO_MODE: 'true',
        PORT: String(activePort),
        JWT_SECRET: 'astra-e2e-test-secret-with-adequate-length-32char',
        ADMIN_INITIAL_PASSWORD: 'admin123',
        CUSTOMER_INITIAL_PASSWORD: 'customer123',
        SUPABASE_URL: '',
        SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: ''
      }
    });

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (await checkHealth(activePort)) {
        isRunning = true;
        break;
      }
    }
    if (!isRunning) {
      if (child) child.kill();
      throw new Error('Impossibile avviare il server per il test E2E.');
    }
  }

  try {
    await runTests(activePort);
  } finally {
    if (child) {
      child.kill();
    }
  }
}

main().catch(err => {
  console.error('\n❌ ERRORE NEL TEST E2E:', err);
  process.exit(1);
});

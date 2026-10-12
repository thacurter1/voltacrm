const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/services/operationGuard.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
new Function('exports', compiled)(exported);
const mergeSource = fs.readFileSync(path.join(__dirname, '../src/services/mergeRecords.ts'), 'utf8');
const mergedExports = {};
new Function('exports', ts.transpileModule(mergeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mergedExports);
const archive = [{ id: 'customer-a', name: 'A' }, { id: 'customer-b', name: 'B' }];
assert.deepEqual(mergedExports.mergeRecords(archive, []), archive, 'Empty role scope cannot erase the archive');
const updated = mergedExports.mergeRecords(archive, [{ id: 'customer-a', name: 'Updated' }]);
assert.equal(updated.length, 2);
assert.equal(updated.find(row => row.id === 'customer-b').name, 'B', 'Hidden customer survives a scoped save');
assert.equal(updated.find(row => row.id === 'customer-a').name, 'Updated');

(async () => {
  const guard = exported.createOperationGuard();
  let selectedUser = '';
  let finishOld;
  const oldOperation = guard.begin();
  const delayed = new Promise(resolve => { finishOld = resolve; }).then(() => {
    if (guard.isCurrent(oldOperation)) selectedUser = 'old customer';
  });
  const newOperation = guard.begin();
  if (guard.isCurrent(newOperation)) selectedUser = 'new broker';
  finishOld();
  await delayed;
  assert.equal(selectedUser, 'new broker', 'Late role loads cannot overwrite a newer selection');

  const submission = guard.begin();
  guard.invalidate();
  assert.equal(guard.isCurrent(submission), false, 'Logout or kiosk reset invalidates pending results');
  assert.equal(guard.isCurrent(guard.begin()), true, 'A fresh session remains usable');
  console.log('Latest role selection and cancelled kiosk results verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });

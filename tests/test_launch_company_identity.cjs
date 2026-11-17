const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/config/companyProfile.ts'), 'utf8');
function profile(env) {
  const js = ts.transpileModule(source.replaceAll('import.meta', '__meta'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, __meta: { env } };
  vm.runInNewContext(js, context);
  return context.exports.COMPANY_PROFILE;
}
const configured = Object.fromEntries([
  'NAME', 'VAT', 'ADDRESS', 'TOLL_FREE', 'SUPPORT_EMAIL', 'PRIVACY_EMAIL', 'PEC',
].map(key => [`VITE_COMPANY_${key}`, 'configured-value']));
assert.equal(profile(configured).isConfiguredCorporateIdentity, true);
assert.equal(profile({ VITE_CONFIRM_CORPORATE_IDENTITY: 'true' }).isConfiguredCorporateIdentity, false,
  'A confirmation flag must not hide missing company details');
for (const key of Object.keys(configured)) {
  assert.equal(profile({ ...configured, [key]: '   ' }).isConfiguredCorporateIdentity, false,
    `${key}: whitespace is not configured company information`);
}
console.log('PASS: company identity requires all actual non-empty fields');

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

console.log('--- STARTING BUTTONS & NAVIGATION INTEGRITY TEST ---');

// 1. AST SCAN OF ALL TSX FILES IN SRC
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const tsxFiles = walk(path.join(__dirname, '..', 'src'));
console.log(`Found ${tsxFiles.length} TSX files to inspect.`);

let totalButtons = 0;
const inertButtons = [];
const emptyHandlers = [];
const alertsFound = [];
const deadLinksFound = [];

tsxFiles.forEach(filePath => {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // Check for alert() calls
  if (code.includes('alert(')) {
    alertsFound.push(filePath);
  }

  // Check for href="#" or href='#'
  if (code.includes('href="#"') || code.includes("href='#'")) {
    deadLinksFound.push(filePath);
  }

  function visit(node, parentForm = false) {
    const isForm = node.kind === ts.SyntaxKind.JsxElement &&
      node.openingElement.tagName.getText(sourceFile) === 'form';
    const currentForm = parentForm || isForm;

    if (node.kind === ts.SyntaxKind.JsxElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
      const tag = (node.kind === ts.SyntaxKind.JsxElement ? node.openingElement : node);
      const tagName = tag.tagName.getText(sourceFile);

      if (tagName === 'button') {
        totalButtons++;
        let onClickAttr = null;
        let typeAttr = null;

        tag.attributes.properties.forEach(prop => {
          if (prop.kind === ts.SyntaxKind.JsxAttribute) {
            const name = prop.name.getText(sourceFile);
            if (name === 'onClick') onClickAttr = prop;
            if (name === 'type') typeAttr = prop;
          }
        });

        const { line } = sourceFile.getLineAndCharacterOfPosition(tag.getStart(sourceFile));
        const lineNum = line + 1;
        const typeValue = typeAttr && typeAttr.initializer ? typeAttr.initializer.getText(sourceFile).replace(/['"]/g, '') : null;

        if (!onClickAttr && typeValue !== 'submit') {
          inertButtons.push(`${filePath}:${lineNum}`);
        }

        if (typeValue === 'submit' && !currentForm && !onClickAttr) {
          inertButtons.push(`${filePath}:${lineNum} (submit outside form without onClick)`);
        }

        if (onClickAttr && onClickAttr.initializer) {
          const initText = onClickAttr.initializer.getText(sourceFile);
          if (/\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(initText) ||
              /\{\s*\(\s*e\s*\)\s*=>\s*\{\s*\}\s*\}/.test(initText) ||
              /\{\s*undefined\s*\}/.test(initText) ||
              /\{\s*null\s*\}/.test(initText)) {
            emptyHandlers.push(`${filePath}:${lineNum} -> ${initText}`);
          }
        }
      }
    }

    ts.forEachChild(node, child => visit(child, currentForm));
  }

  visit(sourceFile);
});

console.log(`Audited ${totalButtons} buttons across the application.`);
assert.strictEqual(inertButtons.length, 0, `Found inert buttons without handler:\n${inertButtons.join('\n')}`);
assert.strictEqual(emptyHandlers.length, 0, `Found buttons with empty dummy handlers:\n${emptyHandlers.join('\n')}`);
assert.strictEqual(alertsFound.length, 0, `Found alert() calls in files:\n${alertsFound.join('\n')}`);
assert.strictEqual(deadLinksFound.length, 0, `Found dead href='#' links in files:\n${deadLinksFound.join('\n')}`);
console.log('✅ AST Button Audit Passed: 100% of buttons have active handlers, 0 alerts, 0 dead links.');

// 2. VERIFY SPECIFIC TAB & NAVIGATION INTEGRITY
const appCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
const crmAppCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'apps', 'CrmApp.tsx'), 'utf8');
const customerAppCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx'), 'utf8');
const headerCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Header.tsx'), 'utf8');
const tariffComparatorCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'TariffComparator.tsx'), 'utf8');
const subitoHeaderCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'customer', 'SubitoHeader.tsx'), 'utf8');
const subitoMySuppliesCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'customer', 'SubitoMySupplies.tsx'), 'utf8');
const callCenterCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'callcenter', 'CallCenterWorkspace.tsx'), 'utf8');

// Required tabs in App.tsx and CrmApp.tsx
const requiredTabs = [
  'dashboard',
  'onboarding',
  'leads',
  'callcenter',
  'inbox_bills',
  'crm',
  'portfolio',
  'team_profiles',
  'commissions',
  'tariffe',
  'switch4m',
  'security'
];

requiredTabs.forEach(tab => {
  assert(appCode.includes(`activeTab === '${tab}'`), `src/App.tsx is missing rendering for tab: ${tab}`);
  assert(crmAppCode.includes(`activeTab === '${tab}'`), `src/apps/CrmApp.tsx is missing rendering for tab: ${tab}`);
});
console.log('✅ Tab Routing Integrity Passed: All 12 tabs present in both App.tsx and CrmApp.tsx.');

// Check TariffComparator action button
assert(tariffComparatorCode.includes('onSelectOffer'), 'TariffComparator is missing onSelectOffer prop');
assert(tariffComparatorCode.includes('Seleziona per Contratto'), 'TariffComparator is missing Seleziona per Contratto action button');
assert(appCode.includes('onSelectOffer'), 'App.tsx does not wire onSelectOffer to TariffComparator');
assert(crmAppCode.includes('onSelectOffer'), 'CrmApp.tsx does not wire onSelectOffer to TariffComparator');
console.log('✅ Tariff Comparator Selection Button Passed.');

// Check SubitoHeader mobile button and NotificationCenter onNavigateTab
assert(subitoHeaderCode.includes('sm:hidden') && subitoHeaderCode.includes('onUploadBill'), 'SubitoHeader is missing mobile upload bill button');
assert(subitoHeaderCode.includes('onNavigateTab'), 'SubitoHeader is missing onNavigateTab for NotificationCenter');
console.log('✅ SubitoHeader Mobile Button & Notification Navigation Passed.');

// Check SubitoMySupplies onOpenBillDetails wiring
assert(customerAppCode.includes('onOpenBillDetails'), 'CustomerApp is missing onOpenBillDetails on SubitoMySupplies');
assert(subitoMySuppliesCode.includes('onOpenBillDetails?.(bill)'), 'SubitoMySupplies is missing onOpenBillDetails invocation');
assert(subitoMySuppliesCode.includes('<button') && subitoMySuppliesCode.includes('onOpenBillDetails?.(bill)'), 'SubitoMySupplies bill item must be an accessible <button>');
console.log('✅ SubitoMySupplies Accessible Button & Bill Details Wiring Passed.');

// Check CallCenterWorkspace & Header branding
assert(headerCode.includes('Volta Energia'), 'Header must display Volta Energia brand');
assert(!callCenterCode.includes('VoltaCRM Energy'), 'CallCenterWorkspace contains outdated VoltaCRM Energy brand in script');
assert(callCenterCode.includes('Volta Energia'), 'CallCenterWorkspace must use Volta Energia brand');
console.log('✅ Backend Brand Compliance Passed: Volta Energia strictly maintained in Header and CallCenter.');

console.log('\n🎉 ALL BUTTON & NAVIGATION INTEGRITY CHECKS PASSED!');

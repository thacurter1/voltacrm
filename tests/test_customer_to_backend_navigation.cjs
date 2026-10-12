const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ts = require('typescript');

console.log('--- RUNNING CUSTOMER TO BACKEND NAVIGATION TEST ---');

// 1. Check src/components/customer/SubitoHeader.tsx
const subitoHeaderPath = path.join(__dirname, '..', 'src', 'components', 'customer', 'SubitoHeader.tsx');
const subitoHeaderContent = fs.readFileSync(subitoHeaderPath, 'utf8');

assert(
  subitoHeaderContent.includes('onReturnToBackend?: () => void'),
  'SubitoHeaderProps must include onReturnToBackend callback prop'
);

assert(
  subitoHeaderContent.includes('Torna al Backend CRM'),
  'SubitoHeader must render a visible "Torna al Backend CRM" button'
);

// 2. Check src/apps/CustomerApp.tsx
const customerAppPath = path.join(__dirname, '..', 'src', 'apps', 'CustomerApp.tsx');
const customerAppContent = fs.readFileSync(customerAppPath, 'utf8');

assert(
  customerAppContent.includes('onReturnToBackend') && customerAppContent.includes('CustomerAppProps'),
  'CustomerApp must accept onReturnToBackend prop'
);

assert(
  customerAppContent.includes('onReturnToBackend={onReturnToBackend}'),
  'CustomerApp must pass onReturnToBackend to SubitoHeader'
);

// 3. Check src/App.tsx
const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

// Verify handleSelectUser does not discard _newUser
assert(
  !appContent.includes('const handleSelectUser = useCallback(async (_newUser?: UserProfile) => {\n    try {\n      const { user } = await api.auth.me();'),
  'handleSelectUser must not discard _newUser argument!'
);

assert(
  appContent.includes('targetUser') || appContent.includes('if (_newUser)'),
  'handleSelectUser must check and utilize _newUser parameter'
);

// Verify CustomerApp is passed onReturnToBackend in embedded mode
const appTree = ts.createSourceFile('App.tsx', appContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let customerMounts = 0;
function inspect(node) {
  if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(appTree) === 'CustomerApp') {
    customerMounts++;
    assert(node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(appTree) === 'onReturnToBackend'),
      'App.tsx must pass onReturnToBackend when mounting CustomerApp');
  }
  ts.forEachChild(node, inspect);
}
inspect(appTree);
assert(customerMounts > 0, 'The customer portal must remain mounted');

console.log('✅ ALL CUSTOMER TO BACKEND NAVIGATION CHECKS PASSED!');

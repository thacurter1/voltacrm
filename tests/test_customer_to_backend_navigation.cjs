const fs = require('fs');
const path = require('path');
const assert = require('assert');

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
assert(
  appContent.includes('<CustomerApp onReturnToBackend='),
  'App.tsx must pass onReturnToBackend when mounting CustomerApp'
);

console.log('✅ ALL CUSTOMER TO BACKEND NAVIGATION CHECKS PASSED!');

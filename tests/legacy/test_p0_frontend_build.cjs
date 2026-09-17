const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const command = process.platform === 'win32'
  ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build']]
  : ['npm', ['run', 'build']];

execFileSync(command[0], command[1], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEMO_MODE: 'false' },
});

const assetsDir = path.join(root, 'dist', 'assets');
const bundle = fs.readdirSync(assetsDir)
  .filter(name => name.endsWith('.js'))
  .map(name => fs.readFileSync(path.join(assetsDir, name), 'utf8'))
  .join('\n');

for (const secret of ['admin123', 'operator123', 'VOLTA_ADMIN_SECRET_KEY_2FA_2026']) {
  assert.equal(bundle.includes(secret), false, `Production frontend bundle exposes demo secret: ${secret}`);
}

console.log('P0 frontend production-bundle test passed.');

// QA 2026-11: login toast covered the header nav; the PWA banner floated over content on first load.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', out)(require, mod, mod.exports);
  return { src, mod: mod.exports };
}

// Toast region
const toast = load('src/components/ToastContainer.tsx');
const html = renderToStaticMarkup(React.createElement(toast.mod.ToastContainer, {
  toasts: [{ id: 't1', title: 'Accesso effettuato', message: 'Benvenuto', type: 'success' }],
  onDismiss: () => {},
}));
const region = html.match(/data-testid="toast-region" class="([^"]+)"/);
assert.ok(region, 'toast region must render');
const cls = region[1].split(/\s+/);
assert.ok(!cls.includes('top-4') && !cls.some((c) => /^top-[0-3]$/.test(c)), 'toast must not sit on top of the header');
assert.ok(cls.includes('sm:bottom-6') && cls.includes('sm:right-6'), 'toast sits bottom-right on tablet/desktop');
assert.ok(cls.includes('bottom-20'), 'toast clears the Staff mobile tab bar');
assert.ok(cls.includes('z-[60]'), 'toast uses the semantic toast z-index (60)');
assert.ok(html.includes('aria-label="Chiudi notifica"') && html.includes('h-11 w-11'), 'dismiss button is labelled and >= 44px');
assert.ok(html.includes('role="status"'), 'success toasts are polite status messages');
console.log('PASS: toast never covers the navigation bar');

// Install banner
const banner = load('src/components/InstallAppBanner.tsx');
assert.ok(!/\bfixed\b/.test(banner.src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'install banner must stay in document flow (no position: fixed)');
const prevWindow = global.window;
const desc = Object.getOwnPropertyDescriptor(global, 'navigator');
global.window = { matchMedia: () => ({ matches: false }), navigator: {} };
Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131', platform: 'Win32', maxTouchPoints: 0 }, configurable: true });
global.localStorage = { getItem: () => null, setItem: () => {} };
const desktop = renderToStaticMarkup(React.createElement(banner.mod.InstallAppBanner, {}));
assert.equal(desktop, '', 'without an install prompt the banner renders nothing on first load');
Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 }, configurable: true });
const ios = renderToStaticMarkup(React.createElement(banner.mod.InstallAppBanner, { inline: true }));
assert.ok(ios.includes('data-testid="install-app-banner"'), 'iOS Safari gets the in-flow hint');
assert.ok(ios.includes('min-h-11') && ios.includes('h-11 w-11'), 'banner actions are >= 44px');
global.localStorage = { getItem: () => 'true', setItem: () => {} };
assert.equal(renderToStaticMarkup(React.createElement(banner.mod.InstallAppBanner, {})), '', 'dismissed banner stays hidden');
global.window = prevWindow;
if (desc) Object.defineProperty(global, 'navigator', desc); else delete global.navigator;
delete global.localStorage;
console.log('PASS: install banner is discreet and in-flow');

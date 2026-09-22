const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

function checkServer() {
  return new Promise((resolve) => {
    const tryUrl = (url, fallback) => {
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => {
        if (fallback) tryUrl(fallback, null);
        else resolve(false);
      });
      req.setTimeout(800, () => {
        req.destroy();
        if (fallback) tryUrl(fallback, null);
        else resolve(false);
      });
    };
    tryUrl('http://127.0.0.1:5000/api/health', 'http://localhost:5000/api/health');
  });
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n========================================`);
    console.log(`RUNNING TEST SUITE: ${scriptName}`);
    console.log(`========================================`);
    const proc = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', VOLTA_DEMO_MODE: 'true' }
    });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test suite ${scriptName} failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  let serverProc = null;
  let isRunning = await checkServer();

  if (!isRunning) {
    console.log('Backend server not running on port 5000. Starting server/dist/index.js...');
    let serverOutput = '';
    serverProc = spawn(process.execPath, [path.join(__dirname, 'server', 'dist', 'index.js')], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test', VOLTA_DEMO_MODE: 'true' }
    });
    serverProc.stdout.on('data', chunk => { serverOutput += chunk; });
    serverProc.stderr.on('data', chunk => { serverOutput += chunk; });

    let retries = 25;
    while (retries > 0) {
      await new Promise(r => setTimeout(r, 400));
      isRunning = await checkServer();
      if (isRunning) break;
      retries--;
    }

    if (!isRunning) {
      if (serverProc) serverProc.kill();
      console.error('Failed to start backend server for tests.');
      if (serverOutput) console.error('Server output:\n' + serverOutput);
      process.exit(1);
    }
    console.log('Backend server started and healthy on http://127.0.0.1:5000\n');
  } else {
    console.log('Backend server is already running on port 5000\n');
  }

  const testSuites = [
    'test_blocco1_security.cjs',
    'test_blocco2_security.cjs',
    'test_blocco3_persistence.cjs',
    'test_fase1_audit.cjs',
    'test_fase3_audit.cjs',
    'test_fase4_audit_p2.cjs',
    'test_gme_feed.cjs',
    'test_messaging.cjs',
    'test_ocr.cjs',
    'test_commissions.cjs',
    'test_e2e_full_flow.cjs',
    'test_fase5_subito_callcenter_portfolio.cjs',
    path.join('tests', 'test_f1_f2_f3_engine.cjs'),
    path.join('tests', 'test_buttons_and_navigation_integrity.cjs'),
    path.join('tests', 'test_customer_to_backend_navigation.cjs'),
    path.join('tests', 'test_oauth_registration.cjs'),
    path.join('tests', 'test_rbac_hierarchy.cjs')
  ];

  let passed = 0;
  let failed = 0;

  try {
    for (const test of testSuites) {
      await runScript(test);
      passed++;
    }
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    failed++;
  } finally {
    if (serverProc) {
      console.log('\nStopping spawned test server...');
      serverProc.kill();
    }
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed}/${testSuites.length} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL TEST SUITES PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

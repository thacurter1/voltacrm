const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

function checkServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:5000/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n========================================`);
    console.log(`RUNNING TEST SUITE: ${scriptName}`);
    console.log(`========================================`);
    const proc = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      stdio: 'inherit'
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
    serverProc = spawn(process.execPath, [path.join(__dirname, 'server', 'dist', 'index.js')], {
      stdio: 'pipe'
    });

    let retries = 15;
    while (retries > 0) {
      await new Promise(r => setTimeout(r, 500));
      isRunning = await checkServer();
      if (isRunning) break;
      retries--;
    }

    if (!isRunning) {
      if (serverProc) serverProc.kill();
      console.error('Failed to start backend server for tests.');
      process.exit(1);
    }
    console.log('Backend server started and healthy on http://localhost:5000\n');
  } else {
    console.log('Backend server is already running on http://localhost:5000\n');
  }

  const testSuites = [
    'test_gme_feed.cjs',
    'test_messaging.cjs',
    'test_ocr.cjs',
    'test_commissions.cjs'
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

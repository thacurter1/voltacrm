/**
 * scripts/create_split_codebase_txt.cjs
 *
 * Generates two cleanly split plain-text files so they never exceed web chat upload limits:
 * - voltacrm_part1_backend_and_db.txt  (Express API, Auth, Middleware, Services, Supabase SQL RLS)
 * - voltacrm_part2_frontend_and_tests.txt (React 19 Components, Comparator UI, Hooks, 47 Test suites, Docs)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'export_zips');

const PART1_FILE = path.join(EXPORT_DIR, 'voltacrm_part1_backend_and_db.txt');
const PART2_FILE = path.join(EXPORT_DIR, 'voltacrm_part2_frontend_and_tests.txt');
const ROOT_PART1_FILE = path.join(PROJECT_ROOT, 'voltacrm_part1_backend_and_db.txt');
const ROOT_PART2_FILE = path.join(PROJECT_ROOT, 'voltacrm_part2_frontend_and_tests.txt');

const INCLUDED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.cjs',
  '.mjs',
  '.sql',
  '.json',
  '.html',
  '.css',
  '.md',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.superpowers',
  'export_zips',
  '_staging',
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'voltacrm_full_codebase.txt',
  'voltacrm_part1_backend_and_db.txt',
  'voltacrm_part2_frontend_and_tests.txt',
]);

function getAllFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(PROJECT_ROOT, fullPath);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        getAllFiles(fullPath, fileList);
      }
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (INCLUDED_EXTENSIONS.has(ext) && !EXCLUDED_FILES.has(entry.name)) {
        fileList.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
      }
    }
  }

  return fileList;
}

const allFiles = getAllFiles(PROJECT_ROOT);
allFiles.sort((a, b) => a.relPath.localeCompare(b.relPath));

// Separate files into Part 1 and Part 2
const part1Files = [];
const part2Files = [];

for (const f of allFiles) {
  const rel = f.relPath;
  if (
    rel.startsWith('server/') ||
    rel.startsWith('supabase/') ||
    rel === 'package.json' ||
    rel === 'index.html' ||
    rel === 'README.md' ||
    rel.startsWith('.env')
  ) {
    part1Files.push(f);
  } else {
    // src/, tests/, docs/, scripts/, vite.config.ts, tsconfig*.json
    part2Files.push(f);
  }
}

function dumpFiles(files, title, partNum, totalParts) {
  let output = '';
  output += '================================================================================\n';
  output += `   VOLTACRM SAAS — CODEBASE DUMP [PARTE ${partNum}/${totalParts}]: ${title}   \n`;
  output += `   GENERATO: ${new Date().toISOString()}\n`;
  output += `   FILE INCLUSI: ${files.length}\n`;
  output += '================================================================================\n\n';

  for (const f of files) {
    try {
      const content = fs.readFileSync(f.fullPath, 'utf8');
      output += `\n\n=== FILE: ${f.relPath} ===\n`;
      output += content;
      if (!content.endsWith('\n')) output += '\n';
    } catch (err) {
      console.warn(`Impossibile leggere ${f.relPath}:`, err.message);
    }
  }

  return output;
}

console.log('=== GENERAZIONE PARTI SUDDIVISE PER CHAT LLM ===');

const part1Content = dumpFiles(part1Files, 'BACKEND EXPRESS, AUTH, SERVIZI & SUPABASE SQL RLS', 1, 2);
fs.writeFileSync(PART1_FILE, part1Content, 'utf8');
fs.writeFileSync(ROOT_PART1_FILE, part1Content, 'utf8');
const p1Mb = (fs.statSync(PART1_FILE).size / (1024 * 1024)).toFixed(2);
console.log(`✔ Generata Parte 1 (${p1Mb} MB, ${part1Files.length} file):`);
console.log(`  -> ${ROOT_PART1_FILE}`);

const part2Content = dumpFiles(part2Files, 'FRONTEND REACT 19, COMPARATORE, 47 TEST SUITES & AUDIT DOCS', 2, 2);
fs.writeFileSync(PART2_FILE, part2Content, 'utf8');
fs.writeFileSync(ROOT_PART2_FILE, part2Content, 'utf8');
const p2Mb = (fs.statSync(PART2_FILE).size / (1024 * 1024)).toFixed(2);
console.log(`✔ Generata Parte 2 (${p2Mb} MB, ${part2Files.length} file):`);
console.log(`  -> ${ROOT_PART2_FILE}\n`);

// Update the full codebase dump as well
const { execSync } = require('child_process');
execSync('node scripts/create_unified_codebase_txt.cjs', { cwd: PROJECT_ROOT });

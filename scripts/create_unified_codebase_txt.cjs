/**
 * scripts/create_unified_codebase_txt.cjs
 *
 * Concatenates all source files into a single plain-text codebase export file
 * formatted specifically for LLM deep context window analysis (Gemini 4 Argon).
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'voltacrm_full_codebase.txt');
const EXPORT_DIR_FILE = path.join(PROJECT_ROOT, 'export_zips', 'voltacrm_full_codebase.txt');

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

console.log('=== RACCOLTA FILE PER CONCATENAZIONE CODEBASE ===');
const files = getAllFiles(PROJECT_ROOT);
console.log(`Trovati ${files.length} file sorgente.`);

// Sort files logically: Docs -> Configs -> Backend/DB -> Services -> Components -> Apps -> Tests
files.sort((a, b) => a.relPath.localeCompare(b.relPath));

let outStream = '';

outStream += '================================================================================\n';
outStream += '   VOLTACRM SAAS — FULL CODEBASE REPOSITORY DUMP FOR GEMINI 4 ARGON DEEP AUDIT  \n';
outStream += `   GENERATO: ${new Date().toISOString()}\n`;
outStream += `   TOTALE FILE INCLUSI: ${files.length}\n`;
outStream += '================================================================================\n\n';

let totalLines = 0;
let totalBytes = 0;

for (const f of files) {
  try {
    const content = fs.readFileSync(f.fullPath, 'utf8');
    const lines = content.split('\n').length;
    totalLines += lines;
    totalBytes += Buffer.byteLength(content, 'utf8');

    outStream += `\n\n=== FILE: ${f.relPath} ===\n`;
    outStream += content;
    if (!content.endsWith('\n')) outStream += '\n';
  } catch (err) {
    console.warn(`Impossibile leggere ${f.relPath}:`, err.message);
  }
}

fs.writeFileSync(OUTPUT_FILE, outStream, 'utf8');
console.log(`✔ File generato con successo: ${OUTPUT_FILE}`);

const exportDir = path.dirname(EXPORT_DIR_FILE);
if (fs.existsSync(exportDir)) {
  fs.writeFileSync(EXPORT_DIR_FILE, outStream, 'utf8');
  console.log(`✔ Copia sincronizzata in: ${EXPORT_DIR_FILE}`);
}

const sizeMb = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
console.log(`\nStatistiche:`);
console.log(`- Dimensione: ${sizeMb} MB`);
console.log(`- File inclusi: ${files.length}`);
console.log(`- Righe totali: ${totalLines.toLocaleString('it-IT')}`);

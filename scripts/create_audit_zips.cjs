/**
 * scripts/create_audit_zips.cjs
 *
 * Generates clean, production-grade ZIP archives for external LLM audit (Gemini 4 Argon, Google AI Studio, etc.)
 * Strips away node_modules, build artifacts (dist), git history, and local environment files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPORT_DIR = path.join(PROJECT_ROOT, 'export_zips');
const STAGING_DIR = path.join(EXPORT_DIR, '_staging');

console.log('=== GENERAZIONE ARCHIVI ZIP PER AUDIT GEMINI 4 ARGON ===\n');

// Ensure clean export directory
if (fs.existsSync(EXPORT_DIR)) {
  fs.rmSync(EXPORT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(EXPORT_DIR, { recursive: true });

function copyDir(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (filterFn && !filterFn(srcPath, entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function createZip(stageFolder, zipName) {
  const zipPath = path.join(EXPORT_DIR, zipName);
  console.log(`Creazione archivio: ${zipName}...`);
  // Use bsdtar with relative paths inside the staging folder
  execSync(`tar -a -c -f "${zipPath}" *`, {
    cwd: stageFolder,
    stdio: 'pipe',
  });
  const stat = fs.statSync(zipPath);
  const sizeKb = (stat.size / 1024).toFixed(1);
  console.log(`✔ Generato ${zipName} (${sizeKb} KB)\n`);
  return zipPath;
}

// 0. Generate the master audit prompt for Gemini 4 Argon
const auditPrompt = `# PROMPT DI AUDIT PER GEMINI 4 ARGON

## Istruzioni per l'utente:
1. Trascina l'archivio ZIP su Gemini 4 Argon (o Google AI Studio / Gemini Web).
2. Copia e incolla il prompt sottostante come primo messaggio.

---

### PROMPT DA COPIARE:

Sei un Principal Software Architect, Staff Security Engineer e Lead QA Auditor incaricato di eseguire un **Audit Tecnico Spietato e Approfondito (Ruthless Deep Audit)** sulla codebase di **VoltaCRM**.

### Contesto del Progetto:
- **Prodotto**: SaaS CRM ed Energy Billing Comparator per broker e clienti nel mercato libero dell'energia in Italia (normative ARERA, PUN, PSV).
- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons (Frontend), Node.js + Express + TypeScript (Backend), Supabase PostgreSQL con RLS policies (Database).
- **Funzionalità Chiave**:
  1. Comparatore pubblico unificato con 4 modalità di intake (profilo, wizard consumo con stima elettrodomestici, OCR bollette, inserimento manuale).
  2. Modale offerta con scomposizione ARERA a 4 voci (Materia, Trasporto, Oneri, Imposte) e condivisione 1-click stima.
  3. Tracciamento attribuzione campagne ADV (UTM source, campaign, medium) nei lead CRM.
  4. Portale clienti e CRM Broker/Admin con isolamento RBAC, notifiche in tempo reale e azioni WhatsApp 1-click.
  5. Suite di test automatizzata integrata (47 suite di test).

---

### Obiettivi dell'Audit:
Analizza l'intero codice sorgente presente nell'archivio e fornisci un report dettagliato diviso nei seguenti pilastri:

#### 1. Architettura, Modularità e Scalabilità
- Valuta la separazione delle responsabilità (Frontend / Backend / Data Access / Auth).
- Analizza la gestione dello stato e l'isolamento dei contesti.
- Identifica potenziali colli di bottiglia o duplicazioni architetturali.

#### 2. Sicurezza, Autenticazione & RBAC / IDOR
- Valuta la gestione dei token JWT e delle sessioni.
- Esamina la robustezza del controllo accessi basato sui ruoli (Admin, Broker, Call Center, Customer).
- Verifica l'isolamento dei dati (IDOR protection) e la gestione delle richieste non autenticate (guest intake vs portal protetto).
- Identifica vulnerabilità potenziali (OWASP Top 10, sanitizzazione input, CORS, headers).

#### 3. Integrità Matematica ed Economica (Energy Domain)
- Esamina il motore di confronto (\`src/services/offerComparison.ts\`).
- Verifica l'onestà dei calcoli (nessun delta fittizio positivo bloccato a zero, gestione trasparente del null per consumi non forniti).
- Valuta la precisione delle formule ARERA (quota fissa, quota energia, scomposizione percentuali luce/gas).

#### 4. Accessibilità (WCAG), UX/UI & Robustezza Frontend
- Conformità WCAG 2.1 AA (touch targets >= 44px, contrasto colori, attributi ARIA, focus management nei modali).
- Resilienza a crash (ErrorBoundary, fallback di rete, gestione offline/demo).

#### 5. Copertura Test & Manutenibilità
- Analisi delle 47 suite di test (\`tests/\` e \`run_all_tests.cjs\`).
- Valutazione dei test fuzzer, stress concurrency ed edge cases.
- Verifica dei quality gate (zero errori di compilazione TypeScript, zero warning linter).

---

### Formato Richiesto per l'Output:
1. **Verdetto Esecutivo Globale** (Punteggio da 1 a 10 con livello di maturità del codice).
2. **Punti di Forza Principali** (Evidenze di eccellenza ingegneristica).
3. **Vulnerabilità o Rilievi Critici** (se presenti, con file, riga e scenario di exploit/failure).
4. **Miglioramenti Raccomandati** (Prioritizzati per impatto: Alto / Medio / Basso).
5. **Giudizio Finale per il Rilascio in Produzione** (GO / NO-GO argomentato).
`;

const auditPromptPath = path.join(EXPORT_DIR, 'AUDIT_PROMPT_GEMINI_ARGON.md');
fs.writeFileSync(auditPromptPath, auditPrompt, 'utf8');
console.log(`✔ Creato file guida: AUDIT_PROMPT_GEMINI_ARGON.md\n`);

// Helper to clean staging
function cleanStage() {
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });
}

// -------------------------------------------------------------------
// 1. VOLTACRM_FULL_PROJECT.zip (All clean source code)
// -------------------------------------------------------------------
cleanStage();
const fullStage = path.join(STAGING_DIR, 'voltacrm-full');
fs.mkdirSync(fullStage, { recursive: true });

copyDir(path.join(PROJECT_ROOT, 'src'), path.join(fullStage, 'src'));
copyDir(path.join(PROJECT_ROOT, 'public'), path.join(fullStage, 'public'));
copyDir(path.join(PROJECT_ROOT, 'server', 'src'), path.join(fullStage, 'server', 'src'));
copyDir(path.join(PROJECT_ROOT, 'supabase'), path.join(fullStage, 'supabase'));
copyDir(path.join(PROJECT_ROOT, 'tests'), path.join(fullStage, 'tests'));
copyDir(path.join(PROJECT_ROOT, 'docs'), path.join(fullStage, 'docs'));
copyDir(path.join(PROJECT_ROOT, 'scripts'), path.join(fullStage, 'scripts'));

// Config files
const rootConfigs = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'run_all_tests.cjs',
  'index.html',
  '.env.example',
  '.env.production',
  'README.md',
];
for (const file of rootConfigs) {
  copyFile(path.join(PROJECT_ROOT, file), path.join(fullStage, file));
}

copyFile(path.join(PROJECT_ROOT, 'server', 'package.json'), path.join(fullStage, 'server', 'package.json'));
copyFile(path.join(PROJECT_ROOT, 'server', 'tsconfig.json'), path.join(fullStage, 'server', 'tsconfig.json'));
copyFile(path.join(PROJECT_ROOT, 'server', '.env.example'), path.join(fullStage, 'server', '.env.example'));
copyFile(auditPromptPath, path.join(fullStage, 'AUDIT_PROMPT_GEMINI_ARGON.md'));

createZip(fullStage, '01_VOLTACRM_FULL_PROJECT.zip');

// -------------------------------------------------------------------
// 2. VOLTACRM_FRONTEND.zip (React + Vite + Comparator UI)
// -------------------------------------------------------------------
cleanStage();
const feStage = path.join(STAGING_DIR, 'voltacrm-frontend');
fs.mkdirSync(feStage, { recursive: true });

copyDir(path.join(PROJECT_ROOT, 'src'), path.join(feStage, 'src'));
copyDir(path.join(PROJECT_ROOT, 'public'), path.join(feStage, 'public'));
const feConfigs = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'index.html',
  '.env.example',
];
for (const file of feConfigs) {
  copyFile(path.join(PROJECT_ROOT, file), path.join(feStage, file));
}
copyFile(auditPromptPath, path.join(feStage, 'AUDIT_PROMPT_GEMINI_ARGON.md'));

createZip(feStage, '02_VOLTACRM_FRONTEND.zip');

// -------------------------------------------------------------------
// 3. VOLTACRM_BACKEND_AND_SECURITY.zip (Express + Auth + Supabase)
// -------------------------------------------------------------------
cleanStage();
const beStage = path.join(STAGING_DIR, 'voltacrm-backend');
fs.mkdirSync(beStage, { recursive: true });

copyDir(path.join(PROJECT_ROOT, 'server', 'src'), path.join(beStage, 'server', 'src'));
copyDir(path.join(PROJECT_ROOT, 'supabase'), path.join(beStage, 'supabase'));
copyFile(path.join(PROJECT_ROOT, 'server', 'package.json'), path.join(beStage, 'server', 'package.json'));
copyFile(path.join(PROJECT_ROOT, 'server', 'tsconfig.json'), path.join(beStage, 'server', 'tsconfig.json'));
copyFile(path.join(PROJECT_ROOT, 'server', '.env.example'), path.join(beStage, 'server', '.env.example'));
copyFile(auditPromptPath, path.join(beStage, 'AUDIT_PROMPT_GEMINI_ARGON.md'));

createZip(beStage, '03_VOLTACRM_BACKEND_AND_SECURITY.zip');

// -------------------------------------------------------------------
// 4. VOLTACRM_TESTS_AND_AUDIT_DOCS.zip (47 test suites + Ruthless Audit)
// -------------------------------------------------------------------
cleanStage();
const testStage = path.join(STAGING_DIR, 'voltacrm-tests-docs');
fs.mkdirSync(testStage, { recursive: true });

copyDir(path.join(PROJECT_ROOT, 'tests'), path.join(testStage, 'tests'));
copyDir(path.join(PROJECT_ROOT, 'docs'), path.join(testStage, 'docs'));
copyDir(path.join(PROJECT_ROOT, 'scripts'), path.join(testStage, 'scripts'));
copyFile(path.join(PROJECT_ROOT, 'run_all_tests.cjs'), path.join(testStage, 'run_all_tests.cjs'));
copyFile(path.join(PROJECT_ROOT, 'package.json'), path.join(testStage, 'package.json'));
copyFile(auditPromptPath, path.join(testStage, 'AUDIT_PROMPT_GEMINI_ARGON.md'));

createZip(testStage, '04_VOLTACRM_TESTS_AND_AUDIT_DOCS.zip');

// Cleanup staging
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}

console.log('====================================================');
console.log('🎉 TUTTI I FILE ZIP SONO STATI CREATI CON SUCCESSO!');
console.log(`Directory: ${EXPORT_DIR}`);
console.log('====================================================\n');

const zips = fs.readdirSync(EXPORT_DIR);
for (const z of zips) {
  const stat = fs.statSync(path.join(EXPORT_DIR, z));
  console.log(`- ${z.padEnd(40)} [${(stat.size / 1024).toFixed(1)} KB]`);
}

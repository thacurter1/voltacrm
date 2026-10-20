#!/usr/bin/env node

/**
 * VoltaCRM — Script di Verifica Pre-Flight per il Rilascio in Produzione
 * 
 * Uso:
 *   node scripts/verify_production_readiness.cjs [--env-file=server/.env]
 *   node scripts/verify_production_readiness.cjs --test
 */

const fs = require('node:fs');
const path = require('node:path');

// Support loading custom env file if passed
const args = process.argv.slice(2);
const envArg = args.find(a => a.startsWith('--env-file='));
const isTestMode = args.includes('--test');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

function verifyConfig(env) {
  const errors = [];
  const warnings = [];
  const passed = [];

  // 1. Modalità Demo vs Produzione
  if (env.VOLTA_DEMO_MODE === 'true' || env.VITE_DEMO_MODE === 'true') {
    errors.push('VOLTA_DEMO_MODE / VITE_DEMO_MODE è impostato a "true". In produzione DEVE essere categoricamente "false" per garantire la persistenza crittografata su database.');
  } else {
    passed.push('Modalità Demo disattivata (VOLTA_DEMO_MODE=false). Dati reali isolati.');
  }

  // 2. Chiave Segreta JWT
  const jwt = env.JWT_SECRET || '';
  if (!jwt) {
    errors.push('JWT_SECRET mancante. Obbligatoria per firmare i token di sessione autenticati.');
  } else if (jwt.length < 32) {
    errors.push(`JWT_SECRET troppo corta (${jwt.length} caratteri). Minimo 32 caratteri raccomandati.`);
  } else if (/demo|default|secret|change-in-production|super-secret/i.test(jwt)) {
    errors.push('JWT_SECRET contiene parole chiave predefinite (demo/default/secret). Generare un segreto crittografico casuale.');
  } else {
    passed.push(`JWT_SECRET valida e robusta (${jwt.length} caratteri).`);
  }

  // 3. Database Supabase
  const supaUrl = env.SUPABASE_URL || '';
  const supaKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supaUrl) {
    errors.push('SUPABASE_URL mancante. Necessario per la connessione al database PostgreSQL.');
  } else if (!supaUrl.startsWith('https://')) {
    errors.push(`SUPABASE_URL non valido: "${supaUrl}". Deve essere un endpoint HTTPS.`);
  } else {
    passed.push(`SUPABASE_URL configurato (${supaUrl}).`);
  }

  if (!supaKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY mancante. Il backend necessita di privilegi service_role.');
  } else if (supaKey.startsWith('sb_publishable') || supaKey.includes('anon')) {
    errors.push('La chiave Supabase configurata nel backend è anon/publishable. È richiesta una chiave privilegiata (service_role o sb_secret).');
  } else {
    passed.push('Chiave Supabase backend privilegiata configurata.');
  }

  // 4. Bootstrap Amministratore (se configurato)
  if (env.ADMIN_EMAIL || env.ADMIN_INITIAL_PASSWORD || env.ADMIN_2FA_SECRET) {
    if (!env.ADMIN_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ADMIN_EMAIL)) {
      errors.push(`ADMIN_EMAIL non valido o mancante: "${env.ADMIN_EMAIL}".`);
    } else {
      passed.push(`ADMIN_EMAIL configurato: ${env.ADMIN_EMAIL}.`);
    }

    const pwd = env.ADMIN_INITIAL_PASSWORD || '';
    if (pwd.length < 12) {
      errors.push('ADMIN_INITIAL_PASSWORD troppo corta (minimo 12 caratteri richiesti per la sicurezza).');
    } else if (/password|admin|12345/i.test(pwd)) {
      errors.push('ADMIN_INITIAL_PASSWORD contiene parole ovvie (password/admin). Scegliere una password complessa.');
    } else {
      passed.push('ADMIN_INITIAL_PASSWORD valida e conforme ai criteri di complessità.');
    }

    const secret2fa = env.ADMIN_2FA_SECRET || '';
    if (secret2fa.length < 20) {
      errors.push('ADMIN_2FA_SECRET troppo corta (minimo 20 caratteri Base32 richiesti).');
    } else if (secret2fa.includes('VOLTA_')) {
      errors.push('ADMIN_2FA_SECRET contiene la parola "VOLTA_". Deve essere un segreto TOTP univoco non prevedibile.');
    } else {
      passed.push('ADMIN_2FA_SECRET conforme allo standard TOTP Authenticator.');
    }
  } else {
    warnings.push('Credenziali bootstrap ADMIN non fornite nel file env. L\'admin deve essere già stato provisionato nel database crm_accounts.');
  }

  // 5. Configurazione CORS
  const cors = env.CORS_ORIGIN || '';
  if (!cors) {
    warnings.push('CORS_ORIGIN non definito. Il server accetterà richieste da qualsiasi origine o dai default.');
  } else if (cors.includes('localhost') && env.NODE_ENV === 'production') {
    warnings.push(`CORS_ORIGIN contiene localhost in ambiente di produzione: "${cors}". Assicurarsi di includere i domini di produzione HTTPS reali.`);
  } else {
    passed.push(`CORS_ORIGIN configurato per i domini autorizzati.`);
  }

  // 6. Integrazioni Terze Parti (Opzionali)
  for (const [k, v] of Object.entries(env)) {
    if (k.startsWith('VITE_') && typeof v === 'string' && /AIza[0-9A-Za-z_-]{20,50}/.test(v)) {
      errors.push(`VIOLAZIONE SICUREZZA CHIAVE AI: Trovata chiave Google Gemini in chiaro nella variabile ${k}. Le chiavi API devono risiedere SOLO sul backend (Render) in forma cifrata (GEMINI_API_KEY_ENCRYPTED).`);
    }
  }

  if (env.GEMINI_API_KEY_ENCRYPTED) {
    if (!env.GEMINI_API_KEY_ENCRYPTED.startsWith('enc:v1:')) {
      errors.push('GEMINI_API_KEY_ENCRYPTED deve iniziare con il prefisso envelope "enc:v1:". Usare node scripts/encrypt_gemini_key.cjs per generarla.');
    } else {
      passed.push('Google Gemini Vision API configurata in modalita protetta cifrata (AES-256-GCM).');
    }
  } else if (env.GEMINI_API_KEY) {
    passed.push('Google Gemini Vision API configurata per OCR avanzato bollette.');
  } else {
    warnings.push('GEMINI_API_KEY non configurata. Il sistema usera il parser OCR standard basato su espressioni regolari.');
  }

  if (env.WHATSAPP_CLOUD_API_TOKEN || env.TWILIO_ACCOUNT_SID) {
    passed.push('Provider messaggistica (WhatsApp Cloud API / Twilio) configurato.');
  } else {
    warnings.push('Provider WhatsApp Cloud / Twilio non configurato. Gli operatori useranno il link diretto 1-click wa.me.');
  }

  // 7. Configurazione Totem Kiosk (Sicurezza Chiave Dispositivo)
  if (env.VITE_TOTEM_DEVICE_TOKEN || env.VITE_TOTEM_KIOSK_DEVICE_KEY || env.VITE_KIOSK_DEVICE_KEY) {
    errors.push('VIOLAZIONE SICUREZZA TOTEM: Trovata chiave segreta del totem in una variabile VITE_* (es. VITE_TOTEM_DEVICE_TOKEN / VITE_TOTEM_KIOSK_DEVICE_KEY). Non inserire MAI la chiave del dispositivo in variabili VITE_* (verrebbero esposte nel bundle pubblico). Usare TOTEM_KIOSK_DEVICE_KEY solo sul backend (Render) e inserire la chiave nel browser del totem al primo avvio.');
  }
  if (env.VITE_TOTEM_HOSTNAME && (env.VITE_TOTEM_HOSTNAME.includes('http://') || env.VITE_TOTEM_HOSTNAME.includes('https://') || env.VITE_TOTEM_HOSTNAME.includes('/'))) {
    errors.push(`VITE_TOTEM_HOSTNAME deve contenere solo l'hostname (es. "voltacrm-totem.vercel.app"), non uno schema URL o percorso: "${env.VITE_TOTEM_HOSTNAME}".`);
  }
  if (env.TOTEM_KIOSK_DEVICE_KEY) {
    if (env.TOTEM_KIOSK_DEVICE_KEY.length < 16) {
      errors.push(`TOTEM_KIOSK_DEVICE_KEY troppo corta (${env.TOTEM_KIOSK_DEVICE_KEY.length} caratteri). Usare almeno 16 caratteri casuali.`);
    } else {
      passed.push('TOTEM_KIOSK_DEVICE_KEY configurata correttamente per il backend.');
    }
  } else {
    warnings.push('TOTEM_KIOSK_DEVICE_KEY non impostata: le API /api/kiosk/* risponderanno correttamente 503 ("Totem non configurato") in produzione.');
  }

  return { errors, warnings, passed };
}

function runVerification() {
  console.log('================================================================');
  console.log('   VOLTACRM SAAS — PRE-FLIGHT CHECK DI PRODUZIONE');
  console.log('================================================================\n');

  if (isTestMode) {
    console.log('Esecuzione test autonomo della logica di verifica pre-flight...');
    // Test case 1: Bad demo config
    const badConfig = {
      VOLTA_DEMO_MODE: 'true',
      JWT_SECRET: 'demo-secret',
      SUPABASE_URL: 'http://localhost',
      SUPABASE_SECRET_KEY: 'sb_publishable_123',
      ADMIN_INITIAL_PASSWORD: 'password123',
      ADMIN_2FA_SECRET: 'VOLTA_123',
      VITE_TOTEM_DEVICE_TOKEN: 'leaked-secret-in-vite'
    };
    const resBad = verifyConfig(badConfig);
    if (resBad.errors.length < 5) {
      throw new Error(`Test fallito: la configurazione insicura doveva produrre almeno 5 errori, trovati ${resBad.errors.length}`);
    }

    // Test case 2: Good production config
    const goodConfig = {
      VOLTA_DEMO_MODE: 'false',
      JWT_SECRET: 'f87a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      SUPABASE_URL: 'https://wobbcdurpamtbkicqzhx.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-service-role-key',
      ADMIN_EMAIL: 'admin@voltacrm.it',
      ADMIN_INITIAL_PASSWORD: 'Xk9#mQ2$vL8!zW4*pT7^',
      ADMIN_2FA_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      CORS_ORIGIN: 'https://voltacrm.it,https://app.voltacrm.it',
      TOTEM_KIOSK_DEVICE_KEY: 'kiosk-prod-key-9f8e7d6c5b4a3f2e1d0c',
      VITE_TOTEM_HOSTNAME: 'voltacrm-totem.vercel.app',
      NODE_ENV: 'production'
    };
    const resGood = verifyConfig(goodConfig);
    if (resGood.errors.length > 0) {
      throw new Error(`Test fallito: la configurazione valida ha prodotto errori inattesi: ${JSON.stringify(resGood.errors)}`);
    }

    console.log('✔ Test di verifica pre-flight superato con successo!\n');
    return true;
  }

  // Normal execution: load target env
  let targetEnv = { ...process.env };
  if (envArg) {
    const envFilePath = path.resolve(process.cwd(), envArg.split('=')[1]);
    console.log(`Caricamento variabili d'ambiente da: ${envFilePath}`);
    targetEnv = { ...targetEnv, ...parseEnvFile(envFilePath) };
  } else {
    // Default check server/.env if exists
    const defaultServerEnv = path.resolve(process.cwd(), 'server', '.env');
    if (fs.existsSync(defaultServerEnv)) {
      console.log(`Caricamento variabili da server/.env`);
      targetEnv = { ...targetEnv, ...parseEnvFile(defaultServerEnv) };
    }
  }

  const { errors, warnings, passed } = verifyConfig(targetEnv);

  console.log('--- CONTROLLI SUPERATI ---');
  for (const p of passed) {
    console.log(`  [OK] ${p}`);
  }

  if (warnings.length > 0) {
    console.log('\n--- AVVISI (RACCOMANDAZIONI NON BLOCCANTI) ---');
    for (const w of warnings) {
      console.log(`  [AVVISO] ${w}`);
    }
  }

  if (errors.length > 0) {
    console.log('\n--- ERRORI BLOCCANTI PER LA PRODUZIONE ---');
    for (const e of errors) {
      console.log(`  [ERRORE] ${e}`);
    }
    console.log('\n❌ PRE-FLIGHT CHECK FALLITO! Correggere gli errori sopra prima del rilascio in produzione.');
    return false;
  }

  console.log('\n🎉 TUTTI I CONTROLLI CRITICI DI PRODUZIONE SONO SUPERATI!');
  console.log('L\'ambiente è pronto per il deployment live.\n');
  return true;
}

const success = runVerification();
process.exit(success ? 0 : 1);

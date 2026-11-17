#!/usr/bin/env node

/**
 * VoltaCRM — Audit sola lettura di parità schema DB, duplicati e ACL PostgREST
 *
 * Non applica SQL né modifica dati; verifica lo stato reale dell'ambiente Supabase
 * configurato prima dell'applicazione delle migrazioni o del deploy backend.
 *
 * Uso:
 *   node scripts/check_db_migration_readiness.cjs [--env-file=server/.env]
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith('--env-file='));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      result[key] = val;
    }
  }
  return result;
}

async function main() {
  const envPath = envArg
    ? path.resolve(process.cwd(), envArg.split('=')[1])
    : path.resolve(process.cwd(), 'server', '.env');
  const env = { ...process.env, ...parseEnvFile(envPath) };

  const supaUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;

  if (!supaUrl || !serviceKey) {
    console.error('Errore: SUPABASE_URL o chiave privilegiata non configurata.');
    process.exit(1);
  }

  console.log('=== VERIFICA SOLA LETTURA RENDER & SUPABASE ===');

  try {
    const healthRes = await fetch('https://voltacrm-api.onrender.com/health');
    const healthText = await healthRes.text();
    console.log(`[Render /health] HTTP ${healthRes.status}: ${healthText}`);
  } catch (err) {
    console.log(`[Render /health] Irraggiungibile: ${err.message}`);
  }

  const svcHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  const schemaProbes = [
    { label: '20261019_02 (leads.idempotency_fingerprint + privacy)', url: '/rest/v1/leads?select=id,idempotency_key,idempotency_fingerprint,privacy_consent_accepted,privacy_policy_version&limit=1' },
    { label: '20261117_01 (crm_accounts.token_version + email_verified)', url: '/rest/v1/crm_accounts?select=id,token_version,email_verified&limit=1' },
    { label: '20261117_01 (portal_bills.claim_token_hash)', url: '/rest/v1/portal_bills?select=id,claim_token_hash&limit=1' },
    { label: '20261117_01 (leads.claim_token_hash)', url: '/rest/v1/leads?select=id,claim_token_hash&limit=1' },
    { label: '20261117_01 (tabella auth_action_tokens)', url: '/rest/v1/auth_action_tokens?select=id&limit=1' },
  ];

  for (const probe of schemaProbes) {
    const res = await fetch(`${supaUrl}${probe.url}`, { headers: svcHeaders });
    const body = await res.text();
    console.log(`[Schema] ${probe.label}: HTTP ${res.status} (${res.ok ? 'PRESENTE' : 'MANCANTE/DA APPLICARE — ' + body.slice(0, 120)})`);
  }

  // Controllo duplicati prima dei vincoli univoci su public.customers e public.leads
  const custRes = await fetch(`${supaUrl}/rest/v1/customers?select=id,fiscal_code,deleted_at&limit=1000`, { headers: svcHeaders });
  if (custRes.ok) {
    const customers = await custRes.json();
    const activeCustomers = customers.filter((c) => !c.deleted_at);
    const cfMap = new Map();
    for (const c of activeCustomers) {
      const norm = String(c.fiscal_code || '').trim().toUpperCase();
      if (!norm || /^OAUTHUSER/.test(norm) || /^CF[0-9]+$/.test(norm)) continue;
      cfMap.set(norm, (cfMap.get(norm) || 0) + 1);
    }
    const duplicateCfs = [...cfMap.values()].filter((n) => n > 1).length;
    console.log(`[Duplicati] customers righe totali=${customers.length}, attivi=${activeCustomers.length}, fiscal_code duplicati=${duplicateCfs}`);
  } else {
    const errText = await custRes.text();
    console.log(`[Duplicati] customers non leggibile: HTTP ${custRes.status} (${errText.slice(0, 120)})`);
  }

  const leadsRes = await fetch(`${supaUrl}/rest/v1/leads?select=id,idempotency_key&limit=1000`, { headers: svcHeaders });
  if (leadsRes.ok) {
    const leads = await leadsRes.json();
    const keyMap = new Map();
    for (const l of leads) {
      const k = String(l.idempotency_key || '').trim();
      if (!k) continue;
      keyMap.set(k, (keyMap.get(k) || 0) + 1);
    }
    const duplicateKeys = [...keyMap.values()].filter((n) => n > 1).length;
    console.log(`[Duplicati] leads righe analizzate=${leads.length}, idempotency_key duplicati=${duplicateKeys}`);
  } else {
    console.log(`[Duplicati] leads non leggibile: HTTP ${leadsRes.status}`);
  }

  if (anonKey) {
    const anonHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };
    const anonLeadsRes = await fetch(`${supaUrl}/rest/v1/leads?select=id&limit=1`, { headers: anonHeaders });
    console.log(`[ACL anon] GET /rest/v1/leads come anon: HTTP ${anonLeadsRes.status} (${anonLeadsRes.status === 401 || anonLeadsRes.status === 403 ? 'PROTETTO (20261023_01 attiva)' : 'ATTENZIONE: VERIFICARE 20261023_01'})`);
  }
}

main().catch((err) => {
  console.error('Errore audit:', err.message);
  process.exit(1);
});

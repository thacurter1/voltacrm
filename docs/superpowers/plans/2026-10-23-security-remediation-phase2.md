# Fase 2: Bonifica Vulnerabilità ad Alta Priorità (SEC-04, SEC-05, SEC-11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bonificare le vulnerabilità ad alta priorità (HIGH): bloccare l'inserimento diretto anonimo via Supabase PostgREST su `public.leads`, garantire la separazione crittografica di dominio tra `JWT_SECRET` e `GEMINI_VAULT_SECRET` (con re-encryption sicura in memoria dell'envelope esistente), e configurare il segreto 2FA per gli operatori (`OPERATOR_2FA_SECRET`) prevenendo il blocco logico HTTP 503 al login.

**Architecture:**
- **Database RLS & ACL (SEC-04):** Creazione della migrazione SQL `supabase/migrations/20261023_01_revoke_anon_leads_and_tighten_postgrest.sql` e allineamento di `supabase/schema.sql`. Revoca completa dei permessi `anon` su `public.leads` e rimozione della policy aperta `Inserimento lead aperto per kiosk`. Tutte le registrazioni lead continuano ad essere garantite via backend Express con privilegi `service_role`.
- **Cryptographic Domain Separation (SEC-05):** In `server/src/services/secretVault.ts`, vietare il riuso promiscuo di `JWT_SECRET` per la decifratura dei segreti a riposo fuori dalla modalità demo; richiedere tassativamente una chiave dedicata `GEMINI_VAULT_SECRET` distinta da `JWT_SECRET`. Eseguire uno script in-memory che migra l'envelope cifrato `GEMINI_API_KEY_ENCRYPTED` dalla vecchia chiave master (`JWT_SECRET`) alla nuova chiave master dedicata (`GEMINI_VAULT_SECRET`) senza mai stampare i valori in chiaro.
- **Operator 2FA Provisioning (SEC-11):** Configurare `OPERATOR_2FA_SECRET` in `server/.env` con un seed Base32 casuale forte crittograficamente (CSPRNG), aggiornare `runtimeConfig.ts`, `verify_production_readiness.cjs`, `server/.env.production.example` e `docs/DEPLOYMENT_GUIDE.md`.

**Tech Stack:** Node.js, Express, PostgreSQL / Supabase RLS, AES-256-GCM, HKDF-SHA256, crypto (CSPRNG).

**Spec:** `brain/7badb234-2ab3-40ff-9748-a44736212863/security_audit_report_2026_10_23.md`

## Global Constraints

- Non stampare mai valori di segreti in chiaro nei log, nelle asserzioni o nei report.
- Non interrompere il flusso di intake lead dal comparatore pubblico, dal caricamento bollette guest o dal totem kiosk, che operano tramite l'API Express del backend.
- Ogni fix deve essere accompagnato da test automatizzati che ne dimostrino l'efficacia (Red/Green TDD).

---

### Task 1: Revoca dei permessi anonimi su `public.leads` in Supabase (SEC-04)

**Files:**
- Create: `supabase/migrations/20261023_01_revoke_anon_leads_and_tighten_postgrest.sql`
- Modify: `supabase/schema.sql:424,453`
- Test: `tests/test_supabase_leads_rls_hardening.cjs`

**Interfaces:**
- Consumes: schema PostgreSQL e configurazione RLS.
- Produces: `revoke all on public.leads from anon;`, drop della policy aperta `anon`, mantenendo i permessi `service_role` (backend) e `authenticated` (operatori).

- [x] **Step 1: Scrivere il test per verificare la mancanza del blocco anon su leads (Red)**
Creare `tests/test_supabase_leads_rls_hardening.cjs` che analizza `schema.sql` e le migrazioni verificando che `anon` non abbia concessioni `insert`, `update` o `select` su `public.leads`, e che non esistano policy aperte ad `anon` con `with check (true)`.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_supabase_leads_rls_hardening.cjs`
Atteso: FAIL (trova policy aperta e permessi `anon` su `public.leads`).

- [x] **Step 3: Creare la migrazione SQL e aggiornare `supabase/schema.sql`**
Creare `supabase/migrations/20261023_01_revoke_anon_leads_and_tighten_postgrest.sql`:
```sql
-- Revoca accesso anonimo diretto a public.leads da PostgREST
drop policy if exists "Inserimento lead aperto per kiosk" on public.leads;
revoke all on public.leads from anon;

-- Mantiene RLS attivo e concede permessi solo a service_role e authenticated (operatori)
alter table public.leads enable row level security;
grant select, insert, update on public.leads to authenticated;
grant all on public.leads to service_role;
```
Allineare `supabase/schema.sql` rimuovendo la grant ad `anon` e la policy aperta.

- [x] **Step 4: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_supabase_leads_rls_hardening.cjs`
Atteso: PASS.

- [x] **Step 5: Commit delle modifiche SQL**
```bash
git add supabase/migrations/20261023_01_revoke_anon_leads_and_tighten_postgrest.sql supabase/schema.sql tests/test_supabase_leads_rls_hardening.cjs
git commit -m "fix(security): revoke direct anon PostgREST access to public.leads (SEC-04)"
```

---

### Task 2: Separazione crittografica di dominio tra `JWT_SECRET` e `GEMINI_VAULT_SECRET` (SEC-05)

**Files:**
- Modify: `server/src/services/secretVault.ts:7-18`
- Modify: `server/src/services/runtimeConfig.ts`
- Modify: `scripts/verify_production_readiness.cjs`
- Modify: `server/.env.production.example`
- Modify: `docs/DEPLOYMENT_GUIDE.md`
- Modify: `server/.env` (aggiunta di `GEMINI_VAULT_SECRET` e re-encryption in memoria di `GEMINI_API_KEY_ENCRYPTED`)
- Test: `tests/test_gemini_vault_domain_separation.cjs`

**Interfaces:**
- Consumes: `process.env.GEMINI_VAULT_SECRET`, `process.env.JWT_SECRET`.
- Produces: `resolveMasterSecret` rifiuta il riuso di `JWT_SECRET` in produzione o fuori demo mode; obbliga ad avere `GEMINI_VAULT_SECRET` distinta; decifratura e utilizzo della chiave Gemini con la chiave master dedicata.

- [x] **Step 1: Scrivere il test per verificare la separazione crittografica (Red)**
Creare `tests/test_gemini_vault_domain_separation.cjs` che verifica che `secretVault.ts` sollevi un errore esplicito se `GEMINI_VAULT_SECRET` è assente o identico a `JWT_SECRET` in ambiente di produzione.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_gemini_vault_domain_separation.cjs`
Atteso: FAIL (attualmente `secretVault.ts` ricade silenziosamente su `JWT_SECRET`).

- [x] **Step 3: Aggiornare `secretVault.ts`, `runtimeConfig.ts` e `verify_production_readiness.cjs`**
In `server/src/services/secretVault.ts`, verificare che fuori da demo mode `process.env.GEMINI_VAULT_SECRET` sia definito, $\ge 32$ caratteri e diverso da `process.env.JWT_SECRET`.
Aggiornare `runtimeConfig.ts` e `verify_production_readiness.cjs` per convalidare la presenza di `GEMINI_VAULT_SECRET`.

- [x] **Step 4: Migrazione dell'envelope crittografico in `server/.env`**
Eseguire uno script Node in-memory che:
1. Legge il vecchio `GEMINI_API_KEY_ENCRYPTED` da `server/.env`.
2. Decifra l'envelope usando il vecchio master (`JWT_SECRET`).
3. Genera un nuovo segreto `GEMINI_VAULT_SECRET` casuale a 64 caratteri esadecimali.
4. Cifra nuovamente la chiave Gemini con il nuovo master.
5. Salva in `server/.env` la variabile `GEMINI_VAULT_SECRET` e il nuovo envelope cifrato (senza mai stampare la chiave in chiaro).

- [x] **Step 5: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_gemini_vault_domain_separation.cjs` e `node tests/test_gemini_secret_vault.cjs`
Atteso: PASS.

- [x] **Step 6: Commit delle modifiche crittografiche**
```bash
git add server/src/services/secretVault.ts server/src/services/runtimeConfig.ts scripts/verify_production_readiness.cjs server/.env.production.example docs/DEPLOYMENT_GUIDE.md tests/test_gemini_vault_domain_separation.cjs
git commit -m "fix(security): enforce domain separation for Gemini vault master secret (SEC-05)"
```

---

### Task 3: Configurazione e validazione `OPERATOR_2FA_SECRET` (SEC-11)

**Files:**
- Modify: `server/src/services/runtimeConfig.ts`
- Modify: `scripts/verify_production_readiness.cjs`
- Modify: `server/.env.production.example`
- Modify: `docs/DEPLOYMENT_GUIDE.md`
- Modify: `server/.env` (aggiunta di `OPERATOR_2FA_SECRET` casuale a 32 caratteri Base32)
- Test: `tests/test_operator_2fa_configuration.cjs`

**Interfaces:**
- Consumes: `process.env.OPERATOR_2FA_SECRET`.
- Produces: `OPERATOR_2FA_SECRET` valido, non vuoto, distinto dall'admin secret, senza lockout 503 per gli operatori.

- [x] **Step 1: Scrivere il test per verificare il controllo su `OPERATOR_2FA_SECRET` (Red)**
Creare `tests/test_operator_2fa_configuration.cjs` che controlla che:
- `runtimeConfig.ts` richieda `OPERATOR_2FA_SECRET` valido fuori demo.
- `server/.env` contenga `OPERATOR_2FA_SECRET` valorizzato e distinto da `ADMIN_2FA_SECRET`.
- Nessun operatore riceva 503 per 2FA non configurato.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_operator_2fa_configuration.cjs`
Atteso: FAIL (manca `OPERATOR_2FA_SECRET` in `server/.env` e controlli nei validatori).

- [x] **Step 3: Aggiornare `runtimeConfig.ts` e `verify_production_readiness.cjs`**
Aggiungere la validazione di `OPERATOR_2FA_SECRET` ($\ge 20$ caratteri, no `VOLTA_`, no default RFC).
Aggiungere `OPERATOR_2FA_SECRET` in `server/.env.production.example` e documentarlo in `docs/DEPLOYMENT_GUIDE.md`.

- [x] **Step 4: Generare un segreto Base32 casuale forte per gli operatori in `server/.env`**
Generare programmaticamente `OPERATOR_2FA_SECRET` casuale a 32 caratteri Base32 in `server/.env`.

- [x] **Step 5: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_operator_2fa_configuration.cjs`
Atteso: PASS.

- [x] **Step 6: Commit delle modifiche di configurazione operatore**
```bash
git add server/src/services/runtimeConfig.ts scripts/verify_production_readiness.cjs server/.env.production.example docs/DEPLOYMENT_GUIDE.md tests/test_operator_2fa_configuration.cjs
git commit -m "fix(security): configure and validate OPERATOR_2FA_SECRET preventing 503 lockout (SEC-11)"
```

---

### Task 4: Verifica Finale di Regressione della Fase 2

- [x] **Step 1: Ricompilare il backend (`npm run build --prefix server`)**
- [x] **Step 2: Registrare le nuove suite in `run_all_tests.cjs` ed eseguire l'intera suite**
Eseguire: `node run_all_tests.cjs`
Atteso: Tutte le suite di test passate (59/59).
- [x] **Step 3: Eseguire il check di produzione finale**
Eseguire: `node scripts/verify_production_readiness.cjs --env-file=server/.env`
Atteso: Superamento di tutti i controlli senza warning bloccanti.

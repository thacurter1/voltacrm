# VoltaCRM Operational Flows (Sections A–E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completare in modo verificabile i flussi operativi di VoltaCRM: assegnazione sicura e idempotenza autenticata bollette (A), collegamenti/OAuth/accessibilità UI (B), ciclo account completo con verifica email, reset password, versionamento sessioni, email transazionale, privacy/marketing e CF/P.IVA (C), primo accesso, claim guest, account management/export/chiusura e consegna inviti (D), release marker su `/health`, test E2E e verifica browser desktop/mobile (E).

**Architecture:** Evoluzione incrementale dell'architettura esistente (`crm_accounts`, `customers`, `portal_bills`, `leads`, JWT + TOTP staff, RPC `SECURITY DEFINER`), aggiungendo `auth_action_tokens` (token 256-bit salvati come SHA-256 hash), `token_version` / `email_verified` su `crm_accounts`, `claim_token_hash` su `portal_bills`/`leads`, `emailService` modulare (Resend / SMTP / memory test adapter) e flussi frontend accessibili e verificati via browser.

**Tech Stack:** TypeScript, Express 5, Zod, bcryptjs, React 19, Vite, PostgreSQL/Supabase RLS & RPC, Node `assert`, Playwright/headless browser verification.

**Spec:** `docs/superpowers/specs/2026-11-17-operational-flows-design.md`

## Global Constraints
- Non stampare mai password, token, codici verifica o segreti nei log, nelle risposte API o nei test.
- Conservare grafica viola/blu VoltaCRM, tre portali separati, selettore demo in demo mode, avviso identità societaria dimostrativa e distinzione netta luce/gas.
- Non applicare SQL su Supabase cloud né inviare email reali senza ambiente e destinatari autorizzati; usare database locale/in-memory e email test adapter per i test automatizzati.
- Ogni task segue rigorosamente Red/Green TDD (`FAIL` prima, implementazione minimale, `PASS` dopo, commit atomico).

---

### Task 1: Assegnazione sicura e idempotenza persistente su upload autenticato (Sezione A)

**Files:**
- Modify: `server/src/routes/portal.ts`
- Test: `tests/test_portal_authenticated_idempotency_and_assignment.cjs`

**Interfaces:**
- Produces: `isActiveStaffAccount(user)` e `resolveDefaultBrokerId()` (nessun fallback `'user-op-2'`; solo staff attivo reale altrimenti `undefined`), idempotenza account-scoped su `POST /api/portal/bills` autenticato con fingerprint comprensivo di `customerId`, `utilityType`, `fileName`, `mimeType`, `bytesSha256`, lock in-flight e compensazione del solo worker perdente.

- [ ] **Step 1: Scrivere il test Red** (`tests/test_portal_authenticated_idempotency_and_assignment.cjs`): verificare che un cliente appena registrato senza broker produca `assignedBrokerId === undefined` (non `'user-op-2'`), broker estraneo riceva `403`, broker sospeso non venga mai scelto da `resolveDefaultBrokerId`, retry autenticato con stessa `X-Idempotency-Key` e stesso file produca un solo file/lead (`200`), stessa chiave con file diverso dia `409`, concorrenza cross-worker su stessa chiave elimini solo il file del worker perdente e mai quello vincente, ed errore di `portalService.uploadBill` propaghi errore senza creare lead.
- [ ] **Step 2: Verificare FAIL (`node tests/test_portal_authenticated_idempotency_and_assignment.cjs`)**
- [ ] **Step 3: Implementare i helper condivisi di assegnazione e idempotenza in `server/src/routes/portal.ts` e compilare `npm.cmd run server:build`**
- [ ] **Step 4: Verificare GREEN (`node tests/test_portal_authenticated_idempotency_and_assignment.cjs` + `tests/test_audit_2026_10_19_p1_p2.cjs` + `tests/test_audit_8b5a734_edgecases.cjs`)**
- [ ] **Step 5: Commit** (`fix(portal): remove phantom broker fallback and add idempotency to authenticated uploads`)

---

### Task 2: Servizio Email Transazionale e Validazione Ufficiale CF/P.IVA (Sezione C.1 / C.4)

**Files:**
- Create: `server/src/services/emailService.ts`
- Create: `server/src/utils/fiscalCode.ts`
- Test: `tests/test_email_and_fiscal_validation.cjs`

**Interfaces:**
- Produces: `sendTransactionalEmail(message)` / `configureEmailTestAdapter(adapter)` / `getTestEmailOutbox()`, `validateItalianFiscalCodeOrVat(value)` / `normalizeFiscalCode(value)` / `shouldEnforceStrictFiscalChecksum()`.

- [ ] **Step 1: Scrivere il test Red** (`tests/test_email_and_fiscal_validation.cjs`): testare checksum CF validi (`RSSMRA80A01H501U`) e invalidi (`MRTNRA82M15F205X`, omocodia valida/invalida), checksum P.IVA validi (`01114601006`, `00743110157`) e invalidi (`09876540152`), retry email adapter su errore transitorio 5xx, mancato invio esplicito (`sent: false`) in produzione senza provider, e assenza token nei log console.
- [ ] **Step 2: Verificare FAIL**
- [ ] **Step 3: Implementare `server/src/utils/fiscalCode.ts` e `server/src/services/emailService.ts`, compilare `npm.cmd run server:build`**
- [ ] **Step 4: Verificare GREEN**
- [ ] **Step 5: Commit** (`feat(security): add transactional email service and official Italian CF/VAT checksums`)

---

### Task 3: Migrazione SQL Incrementale, Schema Canonico e Auth Action Token Service (Sezione C.1 / D / E)

**Files:**
- Create: `supabase/migrations/20261117_01_account_lifecycle_and_tokens.sql`
- Modify: `supabase/schema.sql`
- Create: `server/src/services/authTokenService.ts`
- Modify: `server/src/services/dataStore.ts`
- Test: `tests/test_migration_20261117_and_token_store.cjs`

**Interfaces:**
- Produces: tabella `public.auth_action_tokens`, colonne `token_version` e `email_verified` su `crm_accounts`, `claim_token_hash` su `portal_bills` e `leads`, indice parziale univoco `customers_fiscal_code_unique` (escludendo segnaposto `OAUTHUSER*`), RPC `consume_auth_action_token`, `complete_email_verification`, `complete_password_reset`, `bump_account_token_version`, `confirm_account_email_change`, `claim_guest_bill_with_token` (`SECURITY DEFINER`, `set search_path = public, pg_temp`, ACL `service_role` only); service `authTokenService` funzionante sia su Supabase che su memory/demo backend.

- [ ] **Step 1: Scrivere il test Red** (`tests/test_migration_20261117_and_token_store.cjs`): verificare struttura SQL della migrazione e `schema.sql` (nessun `EXECUTE` pubblico su RPC, controllo duplicati, SHA-256 digest only), creazione token con revoca precedenti, consumo atomico monouso, rifiuto scaduto/riusato e persistenza `token_version`.
- [ ] **Step 2: Verificare FAIL**
- [ ] **Step 3: Scrivere migrazione `20261117_01_account_lifecycle_and_tokens.sql`, allineare `supabase/schema.sql`, creare `server/src/services/authTokenService.ts` e aggiornare `dataStore.ts`**
- [ ] **Step 4: Verificare GREEN**
- [ ] **Step 5: Commit** (`feat(db): add auth_action_tokens, token_version, unique CF index and claim hashes`)

---

### Task 4: Ciclo Account Backend, Revoca Sessioni, Inviti Staff e Release Identifier (Sezioni C, D.2, E)

**Files:**
- Modify: `server/src/types.ts`
- Modify: `server/src/middleware/validate.ts`
- Modify: `server/src/middleware/auth.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/services/invitationService.ts`
- Modify: `server/src/index.ts`
- Test: `tests/test_account_lifecycle_e2e.cjs`

**Interfaces:**
- Produces: endpoints `POST /api/auth/register-customer` (stato `pending_verification`, consensi + timestamp + marketing opzionale, verifica email), `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password` (anti-enumerazione 200), `POST /api/auth/reset-password`, `POST /api/auth/change-password`, `POST /api/auth/logout-all`, `POST /api/auth/request-email-change`, `POST /api/auth/confirm-email-change`, controllo `tokenVersion` + blocco `pending_verification` in `authenticateToken`, `emailSent`/`deliveryError` su `invitationService`, e `release: { commit, buildTimestamp }` su `/health` & `/api/health`.

- [ ] **Step 1: Scrivere il test Red** (`tests/test_account_lifecycle_e2e.cjs`): coprire registrazione con `pending_verification`, blocco login pre-verifica, verifica email con token monouso, revoca token precedente al reinvio, registrazione concorrente duplicata CF/email (nessun orfano), compatibilità utente legacy attivo, forgot-password anti-enumerazione, reset-password con invalidazione vecchia password e vecchi JWT (`tokenVersion`), change-password, logout-all, invito staff con fallimento consegna email non mascherato, e campo non sensibile `release` su `/health`.
- [ ] **Step 2: Verificare FAIL**
- [ ] **Step 3: Implementare modifiche in `types.ts`, `validate.ts`, `auth.ts` middleware, `routes/auth.ts`, `invitationService.ts`, `index.ts` e compilare `npm.cmd run server:build`**
- [ ] **Step 4: Verificare GREEN**
- [ ] **Step 5: Commit** (`feat(auth): implement email verification, password reset, session versioning and invite delivery status`)

---

### Task 5: Claim Bolletta Guest, Richieste Assistenza, Export Dati e Chiusura Account (Sezione D)

**Files:**
- Modify: `server/src/services/portalService.ts`
- Modify: `server/src/routes/portal.ts`
- Test: `tests/test_customer_account_and_guest_claim.cjs`

**Interfaces:**
- Produces: `claimToken` (ritornato al guest in `POST /api/portal/bills`, salvato come `claimTokenHash`), `POST /api/portal/bills/claim`, `POST /api/portal/support-requests`, `GET /api/portal/support-requests`, `GET /api/portal/account/export`, `POST /api/portal/account/closure-request` (conserva `signature_logs` e `portal_bills`, sospende account e incrementa `tokenVersion`), stato bolletta `needs_info`.

- [ ] **Step 1: Scrivere il test Red** (`tests/test_customer_account_and_guest_claim.cjs`): verificare che un guest ottenga `claimToken` ma un utente appena registrato con stessa email **non** veda automaticamente la bolletta guest; che `POST /api/portal/bills/claim` con `claimToken` associ la bolletta e fallisca al riuso; che `support-requests`, `account/export` e `closure-request` (con verifica password e conservazione documenti) funzionino in isolamento multi-cliente.
- [ ] **Step 2: Verificare FAIL**
- [ ] **Step 3: Implementare in `portalService.ts` e `portal.ts`, compilare `npm.cmd run server:build`**
- [ ] **Step 4: Verificare GREEN**
- [ ] **Step 5: Commit** (`feat(portal): add guest bill claim token, support requests, GDPR export and closure flow`)

---

### Task 6: Frontend — Collegamenti Upload, OAuth Condizionale, Accessibilità Auth e Area Account (Sezioni B & D)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api/client.ts`
- Modify: `src/api/portal.ts`
- Modify: `src/components/OAuthButtons.tsx`
- Modify: `src/components/PortalGate.tsx`
- Modify: `src/apps/CustomerApp.tsx`
- Modify: `src/components/customer/EnergyPortalHeader.tsx`
- Modify: `src/components/customer/EnergyBillIntake.tsx`
- Modify: `src/components/customer/SubitoMySupplies.tsx`
- Create: `src/components/customer/CustomerAccountView.tsx`
- Modify: `src/components/TeamProfilesManager.tsx`
- Test: `tests/test_frontend_operational_flows.cjs`

- [ ] **Step 1: Scrivere il test Red** (`tests/test_frontend_operational_flows.cjs`): verificare rendering OAuth condizionale (`!DEMO_MODE` senza Client ID nasconde Google/Apple), accessibilità form `PortalGate` (`htmlFor` su tutte le label, `autoComplete`, toggle password, `role="alert"`, privacy + marketing non preselezionato, titoli coerenti per login/registrazione/reset/verifica), collegamento diretto `'upload'` da `SubitoMySupplies` mantenendo `'profile'` di default su `CustomerApp`, presenza tab Account con modifica recapiti, cambio password, `logout-all`, claim guest, assistenza, export e chiusura.
- [ ] **Step 2: Verificare FAIL**
- [ ] **Step 3: Implementare tutte le viste e integrazioni API frontend, compilare `npm.cmd run build` e `npm.cmd run lint`**
- [ ] **Step 4: Verificare GREEN**
- [ ] **Step 5: Commit** (`feat(frontend): fix upload navigation, hide unconfigured OAuth, harden auth accessibility and add customer account view`)

---

### Task 7: Collaudo E2E Completo, Verifica Browser Desktop/Mobile e Riepilogo Finale (Sezione E)

**Files:**
- Modify: `run_all_tests.cjs`
- Test: `tests/test_full_customer_journey_e2e.cjs`
- Browser Verification: script Playwright/Chromium locale su server Vite + backend API con screenshot desktop (1440px) e mobile (390px) salvati nella directory artifacts e ispezionati via `read_file`.

- [ ] **Step 1: Scrivere `tests/test_full_customer_journey_e2e.cjs`** che esegue in sequenza con backend HTTP e email adapter in-memory: registrazione -> rifiuto login non verificato -> verifica email -> primo login -> upload bolletta -> presa in carico staff assegnato -> analisi -> stato cliente -> richiesta cambio email + conferma -> reset password + revoca vecchia sessione/password -> nuovo login + verifica isolamento Cliente 2 e Broker 2.
- [ ] **Step 2: Aggiornare `run_all_tests.cjs` includendo tutte le nuove suite (`test_portal_authenticated_idempotency_and_assignment.cjs`, `test_email_and_fiscal_validation.cjs`, `test_migration_20261117_and_token_store.cjs`, `test_account_lifecycle_e2e.cjs`, `test_customer_account_and_guest_claim.cjs`, `test_frontend_operational_flows.cjs`, `test_full_customer_journey_e2e.cjs`)**
- [ ] **Step 3: Eseguire `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run server:build`, `npm.cmd test`**
- [ ] **Step 4: Eseguire verifica browser reale su desktop (1440x900) e mobile (390x844)** verificando tastiera, focus, nessun bottone morto, "Carica la tua prima bolletta oggi" -> upload al primo click, registrazione/reset password, area account, ispezione screenshot reali via `read_file`.
- [ ] **Step 5: Commit** (`test(e2e): integrate full operational lifecycle and regression suites`)

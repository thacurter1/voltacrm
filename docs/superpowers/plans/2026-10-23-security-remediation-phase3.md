# Fase 3: Bonifica Vulnerabilità a Media/Bassa Severità e Resilienza Operativa (SEC-06, SEC-07, SEC-08, SEC-10, SEC-12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completare la bonifica del sistema con l'introduzione del logging automatico di sicurezza su eventi critici e violazioni RBAC (SEC-08), la revoca immediata delle sessioni JWT per account sospesi (SEC-07), il controllo difensivo 404 sul download di bollette inesistenti (SEC-12), l'inasprimento della Content-Security-Policy in produzione (SEC-10) e la rimozione delle vulnerabilità delle dipendenze frontend (SEC-06).

**Architecture:**
- **Security Audit Logging (SEC-08):** Collegamento sistematico della funzione `addSecurityLog` da `operationsService.ts` all'interno dei rami di fallimento di autenticazione e 2FA in `server/src/routes/auth.ts`, nonché nei controlli di autorizzazione in `server/src/middleware/auth.ts` (`requireRole`). Ogni evento viene registrato in `public.security_logs` con `status` conforme (`safe`, `warning`, `critical`).
- **Account Status & Session Invalidation (SEC-07):** In `server/src/middleware/auth.ts`, verifica immediata dello stato `onboardingStatus === 'suspended'` nel middleware `authenticateToken`, impedendo ad account sospesi di continuare a operare con token validi fino a 8 ore.
- **Defensive Error Handling (SEC-12):** In `server/src/routes/portal.ts`, verifica difensiva `if (!bill) throw httpError('Bolletta richiesta non trovata.', 404);` all'inizio dell'handler di download bolletta, evitando l'unhandled `TypeError: Cannot read properties of null (reading 'customerId')`.
- **Content-Security-Policy Hardening (SEC-10):** In `vercel.json`, rimozione di origini di test locali (`http://localhost:*`, `ws://localhost:*`) e del dominio non necessario client-side `https://generativelanguage.googleapis.com` dalla direttiva `connect-src`.
- **Frontend Dependencies Hardening (SEC-06):** Esecuzione di `npm audit fix` su root per aggiornare `source-map-js` e `vite` alle versioni prive di vulnerabilità, verificando la corretta compilazione di produzione.

**Tech Stack:** Node.js, Express, TypeScript, Vitest / Node Assert, PostgreSQL / Supabase, NPM.

**Spec:** `brain/7badb234-2ab3-40ff-9748-a44736212863/security_audit_report_2026_10_23.md`

## Global Constraints

- Non stampare mai valori di credenziali, password o token nei log o nelle asserzioni di test.
- Mantenere la piena compatibilità con tutte le 59 suite di test esistenti.
- Ogni fix deve essere accompagnato da test automatizzati che ne dimostrino l'efficacia (Red/Green TDD).

---

### Task 1: Security Audit Event Logging su Tentativi Falliti e Violazioni RBAC (SEC-08)

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/middleware/auth.ts`
- Test: `tests/test_security_audit_logging.cjs`

**Interfaces:**
- Consumes: `addSecurityLog` da `../services/operationsService.js`.
- Produces: Log di audit automatici per tentativi falliti di autenticazione operatore/cliente, tentativi falliti di secondo fattore TOTP, violazioni di autorizzazione RBAC in `requireRole`.

- [x] **Step 1: Scrivere il test per verificare l'invocazione di `addSecurityLog` su eventi di sicurezza (Red)**
Creare `tests/test_security_audit_logging.cjs` che controlla che:
- Un login con password errata generi un record di log con `event_type = 'login_failed_operator'` e `status = 'warning'`.
- Un login con codice 2FA errato generi un record di log con `event_type = 'totp_failed_operator'` e `status = 'warning'`.
- Una chiamata a un endpoint protetto da `requireRole('admin')` con utente `customer` o `broker` generi `event_type = 'rbac_violation'` e `status = 'warning'`.
- Un login riuscito generi `event_type = 'login_success_operator'` con `status = 'safe'`.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_security_audit_logging.cjs`
Atteso: FAIL.

- [x] **Step 3: Implementare l'audit logging in `auth.ts` e `auth.ts` (middleware)**
Importare `addSecurityLog` in `auth.ts` e registrarlo nei rami di failure e success; importarlo in `server/src/middleware/auth.ts` ed emettere il log su violazione `requireRole`.

- [x] **Step 4: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_security_audit_logging.cjs`
Atteso: PASS.

- [x] **Step 5: Commit delle modifiche**
```bash
git add server/src/routes/auth.ts server/src/middleware/auth.ts tests/test_security_audit_logging.cjs
git commit -m "feat(security): audit log auth failures, invalid TOTP, and RBAC violations (SEC-08)"
```

---

### Task 2: Revoca Immediata di Sessione per Account Sospesi (SEC-07)

**Files:**
- Modify: `server/src/middleware/auth.ts:65-72`
- Test: `tests/test_session_account_status_revocation.cjs`

**Interfaces:**
- Consumes: `current.onboardingStatus` da `users`.
- Produces: Risposta HTTP 403 immediata (`Account sospeso. Contattare l’amministratore.`) ed emissione di security log se un account ha `onboardingStatus === 'suspended'`.

- [x] **Step 1: Scrivere il test per la revoca immediata di token di account sospesi (Red)**
Creare `tests/test_session_account_status_revocation.cjs` che genera un token JWT valido per un utente, quindi imposta `onboardingStatus = 'suspended'` e verifica che `authenticateToken` risponda con 403 e messaggio esplicito.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_session_account_status_revocation.cjs`
Atteso: FAIL.

- [x] **Step 3: Aggiungere il controllo di sospensione in `authenticateToken`**
In `server/src/middleware/auth.ts`, verificare se `current.onboardingStatus === 'suspended'`, registrare il log di allerta e restituire HTTP 403.

- [x] **Step 4: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_session_account_status_revocation.cjs`
Atteso: PASS.

- [x] **Step 5: Commit delle modifiche**
```bash
git add server/src/middleware/auth.ts tests/test_session_account_status_revocation.cjs
git commit -m "fix(security): immediately revoke session on suspended account status (SEC-07)"
```

---

### Task 3: Null Check Preventivo su Download Bolletta Inesistente (SEC-12)

**Files:**
- Modify: `server/src/routes/portal.ts:680-685`
- Test: `tests/test_portal_bill_download_nullcheck.cjs`

**Interfaces:**
- Consumes: `portalService.getBill(req.params.id)`.
- Produces: Risposta pulita HTTP 404 (`Bolletta richiesta non trovata.`) anziché HTTP 500 TypeError.

- [x] **Step 1: Scrivere il test per verificare il ritorno di 404 su bolletta inesistente (Red)**
Creare `tests/test_portal_bill_download_nullcheck.cjs` che chiama `GET /api/portal/bills/non-existent-id-9999/download` con token valido e verifica che restituisca 404 senza provocare un'eccezione non gestita sul server.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_portal_bill_download_nullcheck.cjs`
Atteso: FAIL o 500 TypeError.

- [x] **Step 3: Aggiungere il null check difensivo in `server/src/routes/portal.ts`**
Aggiungere subito dopo `const bill = await portalService.getBill(req.params.id);`:
```typescript
if (!bill) {
  throw httpError('Bolletta richiesta non trovata.', 404);
}
```

- [x] **Step 4: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_portal_bill_download_nullcheck.cjs`
Atteso: PASS (restituisce 404).

- [x] **Step 5: Commit delle modifiche**
```bash
git add server/src/routes/portal.ts tests/test_portal_bill_download_nullcheck.cjs
git commit -m "fix(security): add defensive null check on bill download endpoint (SEC-12)"
```

---

### Task 4: Inasprimento della Content-Security-Policy (CSP) in `vercel.json` (SEC-10)

**Files:**
- Modify: `vercel.json`
- Test: `tests/test_csp_configuration_hardening.cjs`

**Interfaces:**
- Consumes: header `Content-Security-Policy` di `vercel.json`.
- Produces: CSP priva di localhost, ws://localhost e endpoint generativelanguage client-side.

- [x] **Step 1: Scrivere il test per verificare le direttive CSP (Red)**
Creare `tests/test_csp_configuration_hardening.cjs` che parsa `vercel.json` e verifica che:
- `connect-src` non contenga `http://localhost:*` o `ws://localhost:*`
- `connect-src` non contenga `https://generativelanguage.googleapis.com`
- `connect-src` mantenga le origini di produzione necessarie (`supabase.co`, `accounts.google.com`, `appleid.apple.com`, `voltacrm-api.onrender.com`).

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_csp_configuration_hardening.cjs`
Atteso: FAIL.

- [x] **Step 3: Aggiornare `vercel.json`**
Rimuovere `http://localhost:*`, `http://127.0.0.1:*`, `ws://localhost:*`, `ws://127.0.0.1:*` e `https://generativelanguage.googleapis.com` dalla direttiva `connect-src` in `vercel.json`.

- [x] **Step 4: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_csp_configuration_hardening.cjs`
Atteso: PASS.

- [x] **Step 5: Commit delle modifiche CSP**
```bash
git add vercel.json tests/test_csp_configuration_hardening.cjs
git commit -m "fix(security): tighten Content-Security-Policy in production header (SEC-10)"
```

---

### Task 5: Aggiornamento Dipendenze Frontend (`vite`, `source-map-js`) (SEC-06)

**Files:**
- Modify: `package.json`, `package-lock.json`

- [x] **Step 1: Eseguire l'aggiornamento sicuro dei pacchetti con fix disponibili**
Eseguire: `npm.cmd audit fix`
- [x] **Step 2: Verificare `npm.cmd audit`**
Eseguire: `npm.cmd audit`
Atteso: 0 vulnerabilities (o solo pacchetti non sfruttatili in dev se non vi sono breaking changes).
- [x] **Step 3: Verificare il build frontend (`npm.cmd run build`)**
Eseguire: `npm.cmd run build`
Atteso: Build completata con successo senza errori TypeScript o Vite.
- [x] **Step 4: Commit delle modifiche dipendenze**
```bash
git add package.json package-lock.json
git commit -m "chore(security): upgrade frontend dependencies addressing security advisories (SEC-06)"
```

---

### Task 6: Verifica Finale di Regressione della Fase 3

- [x] **Step 1: Ricompilare il backend (`npm.cmd run build --prefix server`)**
- [x] **Step 2: Registrare le nuove suite in `run_all_tests.cjs` ed eseguire l'intera suite**
Eseguire: `node run_all_tests.cjs`
Atteso: Tutte le suite di test passate (63/63).
- [x] **Step 3: Eseguire il check di produzione finale**
Eseguire: `node scripts/verify_production_readiness.cjs --env-file=server/.env`
Atteso: Superamento di tutti i controlli senza warning bloccanti.

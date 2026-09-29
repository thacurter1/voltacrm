# Debug & Production Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Risolvere tutti i problemi identificati durante il debug approfondito dell'applicazione VoltaCRM (attivazione contratti da parte dei broker, isolamento IDOR bollette e letture nel portale, estensione ruoli invito staff a broker/operatori, gestione diagnostica URL di produzione frontend).

**Architecture:** Approccio modulare a strati con TDD (Red-Green-Refactor) rigoroso. Centralizzazione delle verifiche di ownership cliente/broker in un modulo riusabile; allineamento delle autorizzazioni RBAC su tutte le rotte Express; validazione Zod estesa per gli inviti staff.

**Tech Stack:** Node.js, Express, TypeScript, Supabase (PostgreSQL), Zod, React/Vite.

**Spec:** docs/superpowers/plans/2026-09-29-debug-and-stabilization.md

## Global Constraints
- Non rompere nessuna delle 20 suite di test esistenti (`run_all_tests.cjs` deve rimanere 100% verde).
- Nessuna regressione sui contratti switch, formule provvigionali ARERA, autenticazione 2FA o verifica crittografica OAuth JWKS.
- Zero placeholder o implementazioni simulate in produzione: persistenza garantita su Supabase.
- Eseguire sempre verifica Red (test che fallisce) prima di scrivere codice di produzione.

---

### Task 1: Sblocco Ruolo Broker per Attivazione Firme e Trigger Notifiche

**Files:**
- Modify: `server/src/routes/switch.ts:227-235`
- Modify: `server/src/routes/notifications.ts:69-73`
- Test: `tests/test_broker_activation_and_notifications.cjs`

**Interfaces:**
- Consumes: `requireRole('admin', 'call_center', 'operator', 'broker')`
- Produces: Permesso per il ruolo `broker` di attivare firme per i propri clienti e inviare trigger notifiche.

- [x] **Step 1: Write the failing test**
Create `tests/test_broker_activation_and_notifications.cjs` verifying that a broker user can call `POST /api/switch/signatures/:id/activate` (with `generateCommission: true`) and `POST /api/notifications/trigger`.

- [x] **Step 2: Run test to verify it fails**
Run: `node tests/test_broker_activation_and_notifications.cjs`
Expected: FAIL with status `403` ("Permessi insufficienti per questa operazione.")

- [x] **Step 3: Write minimal implementation**
In `server/src/routes/switch.ts:230`:
Change `requireRole('admin', 'call_center', 'operator')` to `requireRole('admin', 'call_center', 'operator', 'broker')`.
In `server/src/routes/notifications.ts:70`:
Change `requireRole('admin', 'call_center', 'operator')` to `requireRole('admin', 'call_center', 'operator', 'broker')`.

- [x] **Step 4: Run test to verify it passes**
Run: `cmd /c "npm run server:build"` followed by `node tests/test_broker_activation_and_notifications.cjs`
Expected: PASS with 200/201.

- [x] **Step 5: Commit**
```bash
git add server/src/routes/switch.ts server/src/routes/notifications.ts tests/test_broker_activation_and_notifications.cjs
git commit -m "fix(switch): authorize broker role on signature activation and notification triggers"
```

---

### Task 2: Protezione IDOR e Scoping Isolamento Dati nel Portale Documenti

**Files:**
- Create: `server/src/services/customerOwnership.ts`
- Modify: `server/src/routes/customers.ts:9-32` (import from new module)
- Modify: `server/src/routes/portal.ts:40-105`
- Test: `tests/test_portal_broker_idor_isolation.cjs`

**Interfaces:**
- Consumes: `isBrokerAssigned(customer, actor): boolean`
- Produces: `assertCustomerAccess(actor, customer): void` che lancia `403 Forbidden` se un broker tenta di accedere, scaricare o caricare bollette di clienti non a lui assegnati; filtra automaticamente la lista bollette e letture quando il broker omette `?customerId=...`.

- [x] **Step 1: Write the failing test**
Create `tests/test_portal_broker_idor_isolation.cjs` testing:
1. Broker A accessing `GET /api/portal/bills?customerId=<assigned>` -> 200 OK.
2. Broker A accessing `GET /api/portal/bills?customerId=<unassigned>` -> 403 Forbidden.
3. Broker A accessing `GET /api/portal/bills` (omitted) -> returns only bills of assigned customers.
4. Broker A downloading bill of unassigned customer -> 403 Forbidden.

- [x] **Step 2: Run test to verify it fails**
Run: `node tests/test_portal_broker_idor_isolation.cjs`
Expected: FAIL (unassigned bills accessible or 200 instead of 403).

- [x] **Step 3: Write minimal implementation**
Extract and centralize `isBrokerAssigned` and `assertCustomerAccess` into `server/src/services/customerOwnership.ts`.
Use it in `server/src/routes/portal.ts` inside `resolveCustomer()`, `GET /bills`, `GET /bills/:id/download`, and `GET /readings`.

- [x] **Step 4: Run test to verify it passes**
Run: `cmd /c "npm run server:build"` followed by `node tests/test_portal_broker_idor_isolation.cjs`
Expected: PASS (strict data isolation confirmed).

- [x] **Step 5: Commit**
```bash
git add server/src/services/customerOwnership.ts server/src/routes/customers.ts server/src/routes/portal.ts tests/test_portal_broker_idor_isolation.cjs
git commit -m "fix(portal): enforce strict broker customer isolation and prevent IDOR on bills and readings"
```

---

### Task 3: Estensione Ruoli negli Inviti Account Staff (`broker` e `operator`)

**Files:**
- Modify: `server/src/services/invitationService.ts:8-15`
- Modify: `server/src/middleware/validate.ts:118-122`
- Test: `tests/test_staff_invitations_broker_operator.cjs`

**Interfaces:**
- Consumes: `createInvitationSchema` con ruoli estesi
- Produces: `createAccountInvitation` capace di generare token e link di onboarding con 2FA TOTP per nuovi consulenti `broker` e `operator`.

- [x] **Step 1: Write the failing test**
Create `tests/test_staff_invitations_broker_operator.cjs` testing admin creating an invitation with `role: 'broker'` and `role: 'operator'`.

- [x] **Step 2: Run test to verify it fails**
Run: `node tests/test_staff_invitations_broker_operator.cjs`
Expected: FAIL with status `400` (Zod validation error: Invalid discriminator value).

- [x] **Step 3: Write minimal implementation**
In `server/src/services/invitationService.ts`:
```typescript
export type InvitationRole = 'customer' | 'admin' | 'call_center' | 'operator' | 'broker';
```
In `server/src/middleware/validate.ts`:
```typescript
z.object({
  role: z.enum(['admin', 'call_center', 'operator', 'broker']),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(25).default(''),
}).strict(),
```

- [x] **Step 4: Run test to verify it passes**
Run: `cmd /c "npm run server:build"` followed by `node tests/test_staff_invitations_broker_operator.cjs`
Expected: PASS with 201 (invitation created with secure TOTP secret).

- [x] **Step 5: Commit**
```bash
git add server/src/services/invitationService.ts server/src/middleware/validate.ts tests/test_staff_invitations_broker_operator.cjs
git commit -m "feat(auth): support operator and broker roles in account invitation workflow"
```

---

### Task 4: Diagnostica e Banner di Connessione Backend nel Frontend

**Files:**
- Modify: `src/api/transport.ts:7-25`
- Create: `src/components/NetworkStatusBanner.tsx`
- Modify: `src/App.tsx:880-920`
- Test: `tests/test_transport_diagnostics.cjs`

**Interfaces:**
- Consumes: `API_BASE_URL`, `isNetworkError`
- Produces: `getApiConfigurationStatus()` che identifica se il backend è offline o se manca la configurazione `VITE_API_URL` su ambienti cloud (Vercel), mostrando all'amministratore un banner non bloccante con istruzioni chiare.

- [x] **Step 1: Write the failing test**
Create `tests/test_transport_diagnostics.cjs` testing URL resolution edge cases:
- Localhost development defaults to `http://localhost:5000/api`.
- Cloud domain with localhost URL returns explicit `unconfigured` diagnostic.
- Cloud domain with HTTPS backend URL returns valid target.

- [x] **Step 2: Run test to verify it fails**
Run: `node tests/test_transport_diagnostics.cjs`
Expected: FAIL.

- [x] **Step 3: Write minimal implementation**
Add `getApiConfigurationStatus()` in `src/api/transport.ts`.
Create `src/components/NetworkStatusBanner.tsx` showing a clean notification only if the API is unreachable on production.
Mount it gracefully in `src/App.tsx`.

- [x] **Step 4: Run test to verify it passes**
Run: `cmd /c "npm run build"` followed by `node tests/test_transport_diagnostics.cjs`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add src/api/transport.ts src/components/NetworkStatusBanner.tsx src/App.tsx tests/test_transport_diagnostics.cjs
git commit -m "feat(frontend): add connection diagnostics and unconfigured backend banner"
```

---

### Task 5: Integrazione Suite Globale e Collaudo Finale

**Files:**
- Modify: `run_all_tests.cjs`

- [x] **Step 1: Add new test suites to runner**
Include in `run_all_tests.cjs`:
- `tests/test_broker_activation_and_notifications.cjs`
- `tests/test_portal_broker_idor_isolation.cjs`
- `tests/test_staff_invitations_broker_operator.cjs`
- `tests/test_transport_diagnostics.cjs`

- [x] **Step 2: Run complete test suite**
Run: `node run_all_tests.cjs`
Expected: 26/26 test suites passed (0 failures).

- [x] **Step 3: Run full linter and builds**
Run:
- `cmd /c "npm run lint"` (0 errors, 0 warnings)
- `cmd /c "npm run server:build"` (exit 0)
- `cmd /c "npm run build"` (exit 0)

- [x] **Step 4: Commit and push**
```bash
git add run_all_tests.cjs
git commit -m "test(ci): integrate new debug regression test suites into master runner"
```

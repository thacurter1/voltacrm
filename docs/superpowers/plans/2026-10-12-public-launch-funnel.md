# Public Launch Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Volta Energia into an open, high-converting public energy comparator (Facile.it-style) where visitors land directly on the comparator without a login barrier, compare offers, and submit genuine consultation leads into the CRM, while retaining secure staff access.

**Architecture:** In `App.tsx`, route unauthenticated visitors directly to `CustomerApp` in guest mode; add a prominent "Area Staff / Accedi" action in the header to open the staff login; update `EnergyOfferDetails.tsx` to collect contact details (Name, Phone, Email, Privacy consent) for guest visitors; ensure `POST /api/portal/consultations` accepts guest consultation requests and assigns them to the CRM lead pipeline; maintain 100% demo mode functionality.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Express backend, Node.js strict assertions.

**Spec:** Passo 1 del Piano di Lancio Pubblico (Funnel di Conversione Aperto).

## Global Constraints

- **Zero Login Barrier for Consumers:** Public visitors must compare electricity & gas offers and calculate savings immediately without entering passwords.
- **Genuine Lead Capture:** Unauthenticated consultation requests must collect Name, Phone, and Email, create a real lead in CRM, and notify staff.
- **Staff Access Preservation:** Staff (Admin, Broker, Operator, Call Center) can easily log in via "Area Staff" button or `?portal=staff`.
- **Demo Mode Isolation:** `DemoRoleSwitcher` and demo logins must remain 100% operational in demo mode.
- **Code Quality:** Oxlint must output 0 errors, 0 warnings; TypeScript (`tsc -b` and server `tsc`) must exit 0.
- **Test Integrity:** All existing 38 test suites plus the new test suite must pass (39/39 passing).

---

### Task 1: Backend Guest Consultation Endpoint & Lead Intake (TDD Red Phase)

**Files:**
- Modify: `server/src/routes/portal.ts`
- Create: `tests/test_public_launch_funnel.cjs`

**Interfaces:**
- Consumes: `POST /api/portal/consultations`
- Produces: Support for unauthenticated guest requests (when no Bearer token is provided, or with guest flag) creating a lead in `dataStore.addLead`:
  ```ts
  interface GuestConsultationBody {
    customerName: string;
    phone: string;
    email?: string;
    offerId: string;
    offerName?: string;
    supplier?: string;
    utilityType: 'luce' | 'gas';
    annualConsumption?: number;
    notes?: string;
    privacyConsent: boolean;
  }
  ```

- [ ] **Step 1: Write failing tests in `tests/test_public_launch_funnel.cjs`**
  - Test that `POST /api/portal/consultations` accepts a guest request without auth token with valid phone and name.
  - Test that missing phone or missing privacy consent returns 400 Bad Request.
  - Test that lead is persisted in CRM data store with correct details and source `'public_comparator'`.

- [ ] **Step 2: Run test to verify RED**
  - Run `node tests/test_public_launch_funnel.cjs` -> Expected: FAIL (401 Unauthorized because endpoint requires token).

- [ ] **Step 3: Update `server/src/routes/portal.ts`**
  - Allow unauthenticated requests on `POST /consultations` when valid guest payload (`customerName`, `phone`, `privacyConsent`) is provided.
  - If authenticated, use existing customer profile resolution; if unauthenticated, create lead with source `'public_comparator'` and assign to default active broker.

- [ ] **Step 4: Run test to verify GREEN**
  - Run `node tests/test_public_launch_funnel.cjs` -> Expected: PASS.
  - Run `npm run server:build` and test full test runner.

- [ ] **Step 5: Commit**
  ```bash
  git add server/src/routes/portal.ts tests/test_public_launch_funnel.cjs
  git commit -m "feat(api): allow guest consultation lead submission for public funnel"
  ```

---

### Task 2: Frontend Guest Consultation Modal in `EnergyOfferDetails.tsx`

**Files:**
- Modify: `src/components/customer/EnergyOfferDetails.tsx`
- Modify: `src/api/portal.ts`

**Interfaces:**
- Consumes: `isGuest: boolean`, `onRequestConsultation: (offer, notes, guestData?) => Promise<void>`
- Produces: Dedicated contact intake form for guests before consultation submission:
  - Nome e Cognome (obbligatorio)
  - Telefono / Cellulare (obbligatorio, format check)
  - Email (opzionale/consigliata per riepilogo)
  - Orario preferito per essere ricontattato (Mattina / Pomeriggio / Qualsiasi)
  - Checkbox obbligatoria: "Accetto l'informativa sulla privacy e acconsento ad essere ricontattato da un consulente Volta Energia"

- [ ] **Step 1: Update `src/api/portal.ts` to support guest payload in `requestConsultation`**
  - Add optional `guestData?: { name: string; phone: string; email?: string; privacyConsent: boolean; preferredTime?: string }`.
  - Pass guestData in request body.

- [ ] **Step 2: Update `EnergyOfferDetails.tsx`**
  - Render guest contact form inputs when user is not logged in as a registered customer.
  - Validate required fields (name, phone, privacy consent) before calling submission.
  - Show friendly confirmation state upon success: "Richiesta Ricevuta! Un consulente ti contatterà al numero indicato entro 24 ore."

- [ ] **Step 3: Run lint and typecheck**
  - `cmd /c "npm run lint"` -> 0 errors, 0 warnings.
  - `cmd /c "npx tsc -b"` -> 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/customer/EnergyOfferDetails.tsx src/api/portal.ts
  git commit -m "feat(ui): add guest contact and privacy intake form in offer details modal"
  ```

---

### Task 3: Public Unauthenticated Root Routing in `App.tsx` & Staff Access Header

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/apps/CustomerApp.tsx`

**Interfaces:**
- Consumes: `window.location.search`, `currentUser`, `isGateOpen`
- Produces: Default public landing renders `CustomerApp` in public/guest mode when no session is active and `portal !== 'staff'`:
  - When visitor arrives at `/`, they immediately see the Volta comparator.
  - In `CustomerApp` top bar, render:
    - Volta Energia brand identity.
    - Button "Area Staff / Accedi" (opens `PortalGate` or staff login modal with 1 click).
  - If user is logged in as staff (Admin, Broker, Operator, Call Center), render full CRM.
  - If URL has `?portal=staff` or `?login=true`, open login modal.

- [ ] **Step 1: Update `src/apps/CustomerApp.tsx`**
  - Accept optional `onOpenStaffLogin?: () => void` prop.
  - If user is guest/public, display top navigation header with "Area Riservata Staff / Accedi" and "Confronto Gratuito Senza Impegno".

- [ ] **Step 2: Update `src/App.tsx` root routing**
  - By default, if unauthenticated and no `portal=staff`, open `CustomerApp` as public portal.
  - Clicking "Area Riservata Staff" opens `PortalGate` or `LoginModal`.
  - Preserve `DemoRoleSwitcher` when demo session is active.

- [ ] **Step 3: Run lint and typecheck**
  - `cmd /c "npm run lint"` -> 0 errors, 0 warnings.
  - `cmd /c "npx tsc -b"` -> 0 errors.

- [ ] **Step 4: Commit**
  ```bash
  git add src/App.tsx src/apps/CustomerApp.tsx
  git commit -m "feat(routing): set CustomerApp as public root landing with staff login trigger"
  ```

---

### Task 4: Full Verification & Automated Tests Integration

**Files:**
- Modify: `run_all_tests.cjs`
- Verify: all test suites

- [ ] **Step 1: Register `test_public_launch_funnel.cjs` in `run_all_tests.cjs`**
- [ ] **Step 2: Build frontend and server**
  - `cmd /c "npm run build"`
  - `cmd /c "npm run server:build"`
- [ ] **Step 3: Run full automated test suite**
  - `node run_all_tests.cjs` -> all 39 test suites must pass (100% green).
- [ ] **Step 4: Run Oxlint**
  - `cmd /c "npm run lint"` -> 0 errors, 0 warnings across all files.
- [ ] **Step 5: Commit and final report**
  ```bash
  git add run_all_tests.cjs
  git commit -m "test: register public launch funnel test suite (39/39 passing)"
  ```

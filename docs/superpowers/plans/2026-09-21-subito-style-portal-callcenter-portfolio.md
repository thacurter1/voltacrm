# Subito-Style Customer Portal, Call Center CRM & Portfolio Revenue Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Subito.it-style customer marketplace and portal with zero exposure of 4-month switch, a marketing-to-call-center CRM queue with bulk CSV ingestion and calendar appointment assignment, and a consultant portfolio manager with switch revenue forecasting.

**Architecture:** 
- Frontend customer space refactored into a classifieds-style marketplace (`SubitoHeader`, `SubitoOfferCard`, `SubitoMySupplies`) using Subito coral/red theme (`#e02424`) with all 4-month switch mechanics strictly omitted.
- High-throughput CSV parser service (`csvImporter.ts`) paired with `POST /api/leads/bulk-import` to ingest large marketing lead batches.
- Dedicated Call Center workspace with fast dialer status toggles and interactive calendar (`AppointmentCalendar.tsx`) assigning qualified leads to consultant profiles.
- Portfolio forecast engine (`portfolioEngine.ts`) and view (`PortfolioManager.tsx`) projecting upcoming switch commission pipelines (upfront + recurring) grouped by consultant.

**Tech Stack:** React 19, TypeScript 5.8, Express 4 ESM, Tailwind CSS v4, Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-09-21-subito-style-portal-callcenter-portfolio-design.md`

## Global Constraints
- Do NOT expose any mention of 120-day / 4-month switch to the customer in `CustomerApp.tsx` or related customer portal components.
- CSV parser must handle both comma (`,`) and semicolon (`;`) delimiters, as well as Windows CRLF and UNIX LF.
- All existing 11 test suites in `run_all_tests.cjs` must continue to pass 100% green without regressions.
- No `any` type escapes where strong interfaces already exist.

---

### Task 1: Customer Portal Redesign in Subito.it Style (`CustomerApp.tsx`)

**Files:**
- Create: `src/components/customer/SubitoHeader.tsx`
- Create: `src/components/customer/SubitoOfferCard.tsx`
- Create: `src/components/customer/SubitoMySupplies.tsx`
- Modify: `src/apps/CustomerApp.tsx`
- Test: `test_fase5_subito_callcenter_portfolio.cjs`

**Interfaces:**
- Produces: `SubitoHeader(props: { category: string, onSelectCategory: (cat: string) => void, searchQuery: string, onSearchChange: (q: string) => void, onUploadBill: () => void })`
- Produces: `SubitoOfferCard(props: { offer: SupplierOffer, onSelect: (offer: SupplierOffer) => void, estimatedSavingsEur?: number })`

- [ ] **Step 1: Create `src/components/customer/SubitoHeader.tsx`**
  - Implement Subito-style navbar: Logo in `#e02424`, search bar *"Cosa cerchi? Cerca tariffa o fornitore..."*, category filter pills (*Tutte, Luce, Gas, Dual Fuel*), and primary CTA button *"Carica la tua Bolletta"*.
- [ ] **Step 2: Create `src/components/customer/SubitoOfferCard.tsx`**
  - Build horizontal classifieds card: Left supplier logo & badge, center offer title & ARERA green checkmark, right highlighted annual savings tag and *"Richiedi attivazione"* action.
- [ ] **Step 3: Create `src/components/customer/SubitoMySupplies.tsx`**
  - Render customer's active utility points, bills, and readings cleanly without any 4-month switch badges or labels.
- [ ] **Step 4: Refactor `src/apps/CustomerApp.tsx`**
  - Integrate `SubitoHeader`, `SubitoOfferCard` listing feed, and `SubitoMySupplies`. Ensure no 4-month switch terminology is rendered.
- [ ] **Step 5: Verify build & render**
  - Run `cmd /c npm run build` to ensure 0 TypeScript compilation errors.

---

### Task 2: Bulk CSV Parser & Ingestion Service (`csvImporter.ts` & Backend Route)

**Files:**
- Create: `src/services/csvImporter.ts`
- Modify: `server/src/routes/leads.ts`
- Modify: `server/src/services/dataStore.ts`
- Create: `src/components/callcenter/BulkCsvImportModal.tsx`

**Interfaces:**
- Produces: `parseLeadCsv(rawCsvText: string): { valid: ParsedLeadInput[], errors: string[] }`
- Produces endpoint: `POST /api/leads/bulk-import` -> `{ success: true, count: number }`

- [ ] **Step 1: Implement `src/services/csvImporter.ts`**
  - Write delimiter auto-detection (`,` vs `;`), row cleaning, and flexible header matching (`Nome`, `Telefono`, `Città`, `Consumo`, etc.).
- [ ] **Step 2: Add `POST /api/leads/bulk-import` in `server/src/routes/leads.ts`**
  - Accept array of leads, validate required fields, append to `dataStore.ts` `leads` array (and insert into Supabase if configured).
- [ ] **Step 3: Create `src/components/callcenter/BulkCsvImportModal.tsx`**
  - Modal with drag-and-drop file upload, preview table of first 5 rows, summary of valid/invalid records, and Confirm Import button.
- [ ] **Step 4: Verify CSV parsing logic**
  - Test parsing sample strings with different encodings and delimiters.

---

### Task 3: Dedicated Call Center Queue & Interactive Calendar (`CallCenterWorkspace.tsx` & `AppointmentCalendar.tsx`)

**Files:**
- Create: `src/components/callcenter/AppointmentCalendar.tsx`
- Create: `src/components/callcenter/CallCenterWorkspace.tsx`
- Modify: `src/App.tsx` (add navigation tab `call_center` or subview)
- Modify: `server/src/routes/operations.ts`

**Interfaces:**
- Produces: `AppointmentCalendar(props: { appointments: Appointment[], consultants: UserProfile[], onScheduleAppointment: (data: any) => void })`
- Produces: `CallCenterWorkspace(props: { leads: Lead[], onUpdateLeadStatus: (leadId: string, status: string) => void, onOpenImport: () => void })`

- [ ] **Step 1: Create `src/components/callcenter/AppointmentCalendar.tsx`**
  - Render weekly calendar grid, time slots (09:00 - 18:00), appointments colored by status, and assignment modal with dropdown of consultants.
- [ ] **Step 2: Create `src/components/callcenter/CallCenterWorkspace.tsx`**
  - Build dialer view with quick filter tabs (*Tutti, Da Chiamare, Da Richiamare, Fissati, Scartati*), phone action `tel:`, AIDA call helper, and button to open `AppointmentCalendar`.
- [ ] **Step 3: Integrate into main CRM navigation in `src/App.tsx` and `src/components/Header.tsx`**
  - Add "Call Center & Marketing" navigation item accessible to `admin`, `call_center`, and `operator` roles.
- [ ] **Step 4: Verify server endpoints**
  - Verify `GET /api/operations/appointments` and `POST /api/operations/appointments`.

---

### Task 4: Client Portfolio Manager & Switch Revenue Forecast (`PortfolioManager.tsx` & `portfolioEngine.ts`)

**Files:**
- Create: `src/services/portfolioEngine.ts`
- Create: `src/components/portfolio/PortfolioManager.tsx`
- Modify: `src/App.tsx` (add navigation tab `portfolio`)

**Interfaces:**
- Produces: `calculatePortfolioForecast(customers: Customer[]): PortfolioSummary`
- Produces: `PortfolioManager(props: { customers: Customer[], profiles: UserProfile[] })`

- [ ] **Step 1: Implement `src/services/portfolioEngine.ts`**
  - Group customers by `accountManager`.
  - Calculate upfront projection: €45/€95 for Luce, €40/€85 for Gas, €25 for Dual Fuel.
  - Calculate recurring monthly & annual projection: `(kWh * 0.0025)/12` + `(Smc * 0.015)/12`.
  - Compute 30-day, 60-day, and 90-day switch pipeline volume.
- [ ] **Step 2: Create `src/components/portfolio/PortfolioManager.tsx`**
  - Top KPI cards: Totale Portafogli, Utenze Gestite, Guadagno Stimato Prossimo Switch, Ricorrente Annuo.
  - Consultant selector tab to view individual consultant book of business.
  - Client table showing contract dates, upcoming switch window, and estimated revenue per customer.
- [ ] **Step 3: Integrate into CRM navigation in `src/App.tsx`**
  - Add "Portafoglio Clienti" tab.

---

### Task 5: Automated Test Suite & Remote Verification (`test_fase5_subito_callcenter_portfolio.cjs`)

**Files:**
- Create: `test_fase5_subito_callcenter_portfolio.cjs`
- Modify: `run_all_tests.cjs`

- [ ] **Step 1: Write `test_fase5_subito_callcenter_portfolio.cjs`**
  - Test 1: Bulk CSV endpoint `POST /api/leads/bulk-import` with multiple records.
  - Test 2: Appointment creation with consultant assignment.
  - Test 3: Customer portal masking test (verify no 120-day switch fields rendered in customer portal payload).
  - Test 4: Portfolio revenue forecast math accuracy.
- [ ] **Step 2: Add to `run_all_tests.cjs`**
- [ ] **Step 3: Run full verification suite**
  - Run `cmd /c npm run server:build`
  - Run `cmd /c npm run build`
  - Run `cmd /c npm run lint`
  - Run `node run_all_tests.cjs` (all 12 test suites must pass 100% green)
- [ ] **Step 4: Git commit and push to `origin/main`**
  - Verify GitHub Actions CI completion.

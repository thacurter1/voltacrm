# Facile.it Comparator Redesign & Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Volta Energia Customer Portal comparator to Facile.it benchmark standards (monthly hero pricing, 3-way intake with household estimation wizard, ARERA 4-component breakdown, 100% Green filter) while preserving 100% demo access and zero-error code quality.

**Architecture:** Extend `offerComparison.ts` with honest lifestyle estimation heuristics; update `EnergyOfferCard.tsx` with monthly hero presentation; enrich `EnergyBillIntake.tsx` with a household profile wizard alongside OCR and manual input; add ARERA 4-component breakdown cards to `EnergyOfferDetails.tsx`; integrate a "100% Green" filter into `CustomerApp.tsx`; resolve all 6 Oxlint warnings.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Express.js backend, Node.js strict assertions.

**Spec:** [docs/superpowers/specs/2026-10-12-facile-it-comparator-audit.md](file:///C:/Users/matte/.gemini/antigravity/scratch/energy-crm-saas/docs/superpowers/plans/2026-10-12-facile-it-comparator-redesign.md) / [audit_progetto_superpowers.md](file:///C:/Users/matte/.gemini/antigravity/brain/7badb234-2ab3-40ff-9748-a44736212863/audit_progetto_superpowers.md).

## Global Constraints

- **Demo Mode Preservation:** Under no circumstance break demo mode, role switching (`DemoRoleSwitcher`), mock credentials, or offline storage (`dbService`).
- **Mathematical Honesty:** Zero fake clamped savings; delta must be pure `current - proposed`; missing baseline must yield `null` with reason.
- **Code Quality:** Oxlint must output 0 errors; TypeScript frontend (`tsc -b`) and backend (`tsc`) must exit with 0.
- **Touch & Accessibility:** All interactive elements must maintain minimum 44px touch targets.
- **Test Integrity:** All 37 existing test suites in `run_all_tests.cjs` must stay green.

---

### Task 1: Model & Test Suite Expansion (TDD Red Phase)

**Files:**
- Modify: `src/services/offerComparison.ts`
- Modify: `tests/test_honest_offer_comparison.cjs`
- Modify: `tests/test_customer_intake_and_assistance_flow.cjs`

**Interfaces:**
- Consumes: `UtilityType`, `ComparisonInput`, `SupplierOffer`
- Produces:
  ```ts
  export interface LifestyleEstimateParams {
    householdSize: 'single' | 'couple' | 'family';
    utilityType: UtilityType;
    hasHeatPumpOrAc?: boolean;
    hasElectricBoiler?: boolean;
    hasInduction?: boolean;
  }
  export function estimateLifestyleConsumption(params: LifestyleEstimateParams): number;
  ```

- [ ] **Step 1: Write the failing tests in test suites**

Add tests for:
1. `estimateLifestyleConsumption` for Single, Couple, Family across Luce and Gas with appliances.
2. Monthly hero calculation (`annualCost / 12` rounded) and monthly CCV/PCV (`fixedAnnualFee / 12`).
3. Verification that green filtering works cleanly.

- [ ] **Step 2: Run test to verify failure**

Run: `node tests/test_honest_offer_comparison.cjs`
Expected: FAIL with `estimateLifestyleConsumption is not a function`.

- [ ] **Step 3: Implement minimal function in `src/services/offerComparison.ts`**

Export `estimateLifestyleConsumption` calculating benchmark consumption without fake inflation:
- Luce: Single = 1500 kWh, Couple = 2400 kWh, Family = 3400 kWh (+400 AC, +800 Boiler, +350 Induction).
- Gas: Single = 600 Smc, Couple = 950 Smc, Family = 1300 Smc.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/test_honest_offer_comparison.cjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/offerComparison.ts tests/test_honest_offer_comparison.cjs
git commit -m "feat(model): add lifestyle consumption estimation and test assertions"
```

---

### Task 2: EnergyOfferCard UX Enhancement (Monthly Hero Price & Badging)

**Files:**
- Modify: `src/components/customer/EnergyOfferCard.tsx`

**Interfaces:**
- Consumes: `comparison: ComparisonResult`, `onViewDetails: (c: ComparisonResult) => void`
- Produces: Enhanced card with `~€XX / mese` hero number, quota fissa in `€/mese`, badges for 100% Green and Prezzo Fisso/Variabile.

- [ ] **Step 1: Update `EnergyOfferCard.tsx` layout**
  - Compute `monthlyCost = annualCost !== null ? Math.round(annualCost / 12) : null`.
  - Prominently render `~€{monthlyCost} / mese` as the primary number in `#0a2540` bold typography.
  - Render `~€{Math.round(annualCost)} / anno` directly below as secondary metadata.
  - Display quota fissa as `(offer.fixedAnnualFee / 12).toFixed(2)} €/mese ({offer.fixedAnnualFee} €/anno)`.
  - Maintain CTA button with `min-h-[44px]` and accessible click targets.

- [ ] **Step 2: Run lint and typecheck**

Run: `cmd /c "npm run lint"` and `cmd /c "npx tsc -b"`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/customer/EnergyOfferCard.tsx
git commit -m "feat(ui): elevate EnergyOfferCard with monthly hero pricing and clear CCV/PCV"
```

---

### Task 3: EnergyBillIntake 3-Way Flow (House Profile Wizard + OCR + Exact Data)

**Files:**
- Modify: `src/components/customer/EnergyBillIntake.tsx`

**Interfaces:**
- Consumes: `customer: Customer`, `onUploaded: (bill: CustomerBill) => void`, `onManualInput: (input: ComparisonInput) => void`
- Produces: 3-tab intake (`'profile'` for registered, `'wizard'` for household profile estimation, `'upload'` for bill dropzone, `'manual'` for exact kWh/Smc).

- [ ] **Step 1: Implement Lifestyle Profile Wizard Tab in `EnergyBillIntake.tsx`**
  - Add state for `householdSize` ('single' | 'couple' | 'family'), `hasAc`, `hasBoiler`, `hasInduction`.
  - Render interactive selector cards with icons: Single (1 persona), Coppia (2 persone), Famiglia (3+ persone).
  - Render appliance toggle chips (Climatizzatore, Scaldabagno, Piano a induzione) when `utilityType === 'luce'`.
  - Display live calculated estimated consumption (e.g. `2.400 kWh / anno`).
  - Add button "Confronta Offerte con questa Stima" that calls `onManualInput(...)` with `source: 'manual'`.

- [ ] **Step 2: Run lint and typecheck**

Run: `cmd /c "npm run lint"` and `cmd /c "npx tsc -b"`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/customer/EnergyBillIntake.tsx
git commit -m "feat(ui): add interactive household consumption wizard to EnergyBillIntake"
```

---

### Task 4: EnergyOfferDetails ARERA 4-Component Breakdown

**Files:**
- Modify: `src/components/customer/EnergyOfferDetails.tsx`

**Interfaces:**
- Consumes: `comparison: ComparisonResult`, `currentInput: ComparisonInput`, `onRequestConsultation: (offer, notes) => void`
- Produces: Modal with dual Monthly + Annual figures and standard ARERA 4-component breakdown:
  1. Spesa Materia Energia
  2. Spesa Trasporto e Gestione Contatore
  3. Spesa Oneri di Sistema
  4. Imposte e IVA stimate

- [ ] **Step 1: Implement ARERA breakdown in `EnergyOfferDetails.tsx`**
  - Compute ARERA breakdown percentages based on `annualCost`:
    - Materia Energia: ~55% for Luce, ~60% for Gas.
    - Trasporto e Gestione Contatore: ~18% for Luce, ~15% for Gas.
    - Oneri di Sistema: ~12% for Luce, ~8% for Gas.
    - Imposte (Accise + IVA): ~15% for Luce, ~17% for Gas.
  - Display clear, structured visual component bars or cards.
  - Show dual Monthly (`~€XX/mese`) and Annual (`~€XXX/anno`) costs.

- [ ] **Step 2: Run lint and typecheck**

Run: `cmd /c "npm run lint"` and `cmd /c "npx tsc -b"`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/customer/EnergyOfferDetails.tsx
git commit -m "feat(ui): add ARERA 4-component breakdown and monthly cost view to offer details"
```

---

### Task 5: CustomerApp Filter & Stepper Integration + Oxlint Cleanup

**Files:**
- Modify: `src/apps/CustomerApp.tsx`
- Modify: `src/components/LoginModal.tsx`
- Modify: `tests/test_demo_security_hardening.cjs`

**Interfaces:**
- Consumes: `offers: SupplierOffer[]`, `comparisonInput: ComparisonInput`
- Produces: Enhanced filtering with `onlyGreen: boolean` toggle; eliminate Oxlint warnings.

- [ ] **Step 1: Add "Solo 100% Green" filter toggle to `CustomerApp.tsx`**
  - Add state `onlyGreen: boolean`.
  - Filter `comparisons` with `(!onlyGreen || offer.greenCertified)`.
  - Render an attractive toggle button with `Leaf` icon next to the existing filter pills.

- [ ] **Step 2: Resolve Oxlint warnings**
  - Fix unused imports in `tests/test_demo_security_hardening.cjs` (`path`, `authenticateToken`).
  - Optimize `CustomerApp.tsx` state initialization to prevent unnecessary cascading renders.
  - Clean `LoginModal.tsx` `Date.now()` call in event handler rather than render pass.

- [ ] **Step 3: Run Oxlint**

Run: `cmd /c "npm run lint"`
Expected: 0 warnings, 0 errors!

- [ ] **Step 4: Commit**

```bash
git add src/apps/CustomerApp.tsx src/components/LoginModal.tsx tests/test_demo_security_hardening.cjs
git commit -m "feat(portal): add 100% green filter and eliminate oxlint warnings"
```

---

### Task 6: Full Verification & Test Suite Execution

**Files:**
- Verify: all files

- [ ] **Step 1: Run frontend build**
Run: `cmd /c "npx tsc -b && npx vite build"`
Expected: Exit code 0.

- [ ] **Step 2: Run server build**
Run: `cmd /c "npm run server:build"`
Expected: Exit code 0.

- [ ] **Step 3: Run all automated test suites**
Run: `node run_all_tests.cjs`
Expected: 37/37 suites passed (100% green).

- [ ] **Step 4: Final verification and commit**
```bash
git status
git log -n 5 --oneline
```

# Volta Energia Full Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inside the isolated worktree `C:\Users\matte\.gemini\antigravity\scratch\energy-crm-saas-redesign` on branch `redesign/volta-v2`.

**Goal:** Redesign the entire Volta Energia frontend (Public Landing, Comparison Funnel, Customer Portal, Auth Gates, Staff/Broker CRM, and Totem) in the approved Energy-Tech commercial utility style (`#0A3B40` Petrol-Teal + `#0A6847` Emerald + self-hosted `Bricolage Grotesque`/`Manrope`/`JetBrains Mono`), removing AI-slop patterns and floating demo bars on customer screens while leaving `main` completely untouched.

**Architecture:** Establish canonical CSS design tokens and self-hosted fonts first, create a shared `VoltaBrandMark` component, redesign the public/customer funnel around the Enel-inspired commercial hierarchy (full-width `#0A3B40` hero with real photo + right-docked Bolletta/Stima strips + centered Luce|Gas toggle + scannable 3-column offer cards), confine demo role switching strictly to Staff header & PortalGate in `DEMO_MODE`, and unify Staff CRM & Totem views onto the same token system.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4, Lucide React, `@fontsource/bricolage-grotesque`, `@fontsource/manrope`, `@fontsource/jetbrains-mono`.

**Spec:** `PRODUCT.md` and `DESIGN.md` in `C:\Users\matte\.gemini\antigravity\scratch\energy-crm-saas-redesign`.

## Global Constraints
- Never touch `C:\Users\matte\.gemini\antigravity\scratch\energy-crm-saas` (`main`).
- Keep Luce and Gas as two separate comparisons (no fake dual-fuel promise).
- Preserve honest corporate demo notice in footer until real company fields are configured.
- Zero AI-slop tells: no `#635bff`, no `Sparkles`, no emoji in nav/demo controls, no pill-badge clutter, no uppercase tracked eyebrows above sections, no hover zoom on `<img>`.
- Zero floating `"1-CLICK DEMO"` bar on public/customer views or in production.
- All existing 73 test suites + `oxlint` (0 errors, 0 warnings) + `tsc -b && vite build` must pass, plus Desktop (`1440px`), Tablet (`768px`), and Mobile (`390px`) browser QA.

---

- [ ] **Task 1:** Install dependencies + `@fontsource/*` fonts, write `DESIGN.md`, update `index.html`, `src/main.tsx`, `src/index.css`, and create `src/components/common/VoltaBrandMark.tsx`.
- [ ] **Task 2:** Redesign `EnergyWelcome.tsx`, `EnergyPortalHeader.tsx`, `CookieBanner.tsx`, and `LegalFooter.tsx` to match Preview v3 commercial utility hierarchy.
- [ ] **Task 3:** Redesign `CustomerApp.tsx`, `EnergyBillIntake.tsx`, `EnergyOfferCard.tsx`, `EnergyOfferDetails.tsx`, `SubitoMySupplies.tsx`, and `CustomerAccountView.tsx` (clean dual-path intake, scannable tariff cards, zero pill clutter).
- [ ] **Task 4:** Confine demo switcher strictly to Staff `Header.tsx` & `PortalGate.tsx` (remove floating `DemoRoleSwitcher` from public/customer views in `App.tsx`), redesign `PortalHome.tsx`, `PortalGate.tsx`, and `OAuthButtons.tsx`.
- [ ] **Task 5:** Unify Staff/Broker CRM (`Header.tsx`, `DashboardOverview.tsx`, `LeadsManager.tsx`, `CallCenterWorkspace.tsx`, `ClientBillsInbox.tsx`, `CustomerCrm.tsx`, `OnboardingManager.tsx`, `PortfolioManager.tsx`, `CommissionManager.tsx`, `QuarterlySwitchEngine.tsx`, `TariffComparator.tsx`, `TeamProfilesManager.tsx`, `SecurityAuditDashboard.tsx`, modals) and `TotemApp.tsx`/`TotemKioskMode.tsx` onto the `#0A3B40`/`#0A6847` Energy-Tech system.
- [ ] **Task 6:** Run `oxlint`, `server:build`, `build`, `node run_all_tests.cjs` (73/73), inspect Desktop (`1440px`), Tablet (`768px`), and Mobile (`390px`) live browser screenshots, verify `main` is spotless, and push `redesign/volta-v2` to GitHub for Vercel Preview.

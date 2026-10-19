# Audit 8b5a734 Edge-Cases & Multi-Worker Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all remaining P1 and P2 edge-case findings from `VERIFICA_8b5a734.md` (SQL `SECURITY DEFINER` RPC ACLs, canonical schema & incremental migration alignment, strict `23505` unique conflict handling, atomic `markNotificationsRead` without racy fallback, SHA-256 canonical request fingerprinting for `offerId` and bill bytes, and cross-worker orphan bill compensation).

**Architecture:** We lock down `public.append_notification_reader(text[], text)` with explicit `REVOKE ALL ... FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE ... TO service_role` in both the incremental migration and canonical `supabase/schema.sql`. In `dataStore.ts`, we require the atomic RPC in Supabase mode (never falling back to racy local-cache overwrites) and only treat `23505` as an idempotent retry when a single lead with `idempotencyKey` violates `idx_leads_idempotency_key` and the winning record is verified in the reloaded store. In `portal.ts` and `portalService.ts`, we persist a SHA-256 `idempotencyFingerprint` covering `offerId` and bill byte digests, and explicitly compensate (`deleteBill`) any loser bill metadata/storage object during cross-worker races or `addLead` failures.

**Tech Stack:** TypeScript, Express, Supabase (PostgreSQL + Storage), Node.js `crypto`, CJS Test Harness.

**Spec:** `C:/Users/matte/Documents/Codex/2026-09-16/c-users-matte-gemini-antigravity-brain/VERIFICA_8b5a734.md`

## Global Constraints

- Zero regressions across all existing 52 test suites (`node run_all_tests.cjs`).
- Oxlint (`npm.cmd run lint`) must exit with 0 errors and 0 warnings.
- Frontend (`npm.cmd run build`) and Backend (`npm.cmd run server:build`) TypeScript builds must exit 0.
- Never break demo mode (`VOLTA_DEMO_MODE=true`) or mock credentials.
- PowerShell 5.1 environment: chain commands with `; if ($LASTEXITCODE -eq 0) { ... }`, never `&&`.

---

### Task 1: SQL Migration & Canonical Schema Hardening + Lead Fingerprint Type

**Files:**
- Modify: `supabase/migrations/20261019_01_audit_p1_p2_remediation.sql`
- Create: `supabase/migrations/20261019_02_audit_rpc_acl_and_idempotency_fingerprint.sql`
- Modify: `supabase/schema.sql`
- Modify: `src/types.ts`

**Interfaces:**
- Produces:
  - `Lead.idempotencyFingerprint?: string` in `src/types.ts`
  - `public.leads.idempotency_fingerprint text` column in `supabase/schema.sql` and `supabase/migrations/20261019_02_audit_rpc_acl_and_idempotency_fingerprint.sql`
  - `public.append_notification_reader(text[], text)` in `supabase/schema.sql` and migrations with explicit `revoke all on function public.append_notification_reader(text[], text) from public, anon, authenticated;` and `grant execute on function public.append_notification_reader(text[], text) to service_role;`

- [ ] **Step 1: Add `idempotencyFingerprint?: string` to `Lead` in `src/types.ts`**
- [ ] **Step 2: Add explicit `REVOKE` and `GRANT` on `public.append_notification_reader(text[], text)` and `idempotency_fingerprint` column in `supabase/migrations/20261019_01_audit_p1_p2_remediation.sql`**
- [ ] **Step 3: Create `supabase/migrations/20261019_02_audit_rpc_acl_and_idempotency_fingerprint.sql` for incremental migration safety**
- [ ] **Step 4: Add `idempotency_fingerprint` column and `public.append_notification_reader(text[], text)` + ACL statements to `supabase/schema.sql`**
- [ ] **Step 5: Build and commit**

---

### Task 2: Strict `23505` Conflict Handling, Atomic RPC Requirement & Canonical Fingerprint + Orphan Bill Compensation

**Files:**
- Modify: `server/src/services/dataStore.ts`
- Modify: `server/src/services/portalService.ts`
- Modify: `server/src/routes/portal.ts`
- Create: `tests/test_audit_8b5a734_edgecases.cjs`
- Modify: `tests/test_persistence_roundtrip_and_concurrency.cjs`
- Modify: `run_all_tests.cjs`

**Interfaces:**
- Consumes: `Lead.idempotencyFingerprint?: string` from `src/types.ts`
- Produces:
  - `leadToRow` / `rowToLead` mapping `idempotency_fingerprint` <-> `idempotencyFingerprint` in `server/src/services/dataStore.ts`
  - Strict `23505` check in `addLeads` (only recovers when `items.length === 1 && items[0].idempotencyKey`, error is not on `leads_pkey`, and reloaded `leads` contains the winning record with `idempotencyKey === items[0].idempotencyKey`)
  - Strict atomic `markNotificationsRead` in `server/src/services/dataStore.ts` (calls `check(rpcRes?.error)` on `append_notification_reader` RPC and `await initDataStore(true)` without racy local fallback)
  - `portalService.deleteBill(id: string): Promise<void>` in `server/src/services/portalService.ts`
  - Canonical SHA-256 `idempotencyFingerprint` calculation and cross-worker orphan bill compensation in `server/src/routes/portal.ts`

- [ ] **Step 1: Write the failing test `tests/test_audit_8b5a734_edgecases.cjs` covering all 6 findings from `VERIFICA_8b5a734.md`**
- [ ] **Step 2: Run `node tests/test_audit_8b5a734_edgecases.cjs` to confirm RED failure**
- [ ] **Step 3: Implement `dataStore.ts`, `portalService.ts`, and `portal.ts` fixes**
- [ ] **Step 4: Build backend (`npm.cmd run server:build`) and run `node tests/test_audit_8b5a734_edgecases.cjs` and `node tests/test_persistence_roundtrip_and_concurrency.cjs` to confirm GREEN**
- [ ] **Step 5: Register `tests/test_audit_8b5a734_edgecases.cjs` in `run_all_tests.cjs`, run lint, build, and full test suite (53/53), and commit**

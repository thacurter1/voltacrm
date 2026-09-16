# Audit remediation implementation plan

Goal: correct all findings in audit-voltacrm-aggiornato.md without deploying or modifying existing Vite edits.
Architecture: backend owns committed customer, identity, signature and accounting state. Supabase commits precede success; demo memory only when explicitly non-production. A signature binds one utility point and a versioned offer, with activation as a separate staff action.
Stack: existing Express/TypeScript/React/Supabase; no new dependency required.
Spec: conversation audit accepted by user on 2026-09-16 and outputs/audit-voltacrm-aggiornato.md in the Codex task directory.

Ruling: user requested direct corrections to the audited checkout; work in place and preserve vite.config.ts. No commit, push or deployment. Database migration scripts are reviewable deliverables, not remotely executed.

- [ ] Core: isolated Node regression tests first (invalid canvas, wrong identity, single POD, persistence rejection, registration, secrets). Await datastore writes; persistent auth account/customer transaction; fail closed production configuration; startup awaits hydration; signature document and artifact persistence, separate activation transaction. Integrate modal/client and existing switch callbacks.
- [ ] Accounting: independent agent owns commissionService.ts, commissions route, tests and separate SQL migration. Stable required contractId/POD; database-backed reads; idempotent generation RPC and atomic settlement RPC; only accrued matching records; no cross-agent updates or memory success on DB failure.
- [ ] Portal: independent agent owns portal route/service/migration and CustomerPortal UI plus isolated tests. Authenticated customer ownership, actual uploaded bytes persisted, durable meter readings; no local success on failed server calls. Communicate API client/index additions to coordinator.
- [ ] Integration/review: compile backend and frontend, run isolated regression suite without external credentials, build Vite, inspect full diff, independent code review and fix findings. Document production migration/config requirements and evidence.

Shared boundaries: coordinator owns index.ts, api/client.ts, middleware/validate.ts, dataStore.ts, auth and switch routes, DigitalSignatureModal and App/Crm callbacks. Agents add distinct SQL migration files, never edit schema.sql simultaneously. Portal uses exported users/getCustomers for authorization; independently persists its own records. Accounting uses dbClient only.

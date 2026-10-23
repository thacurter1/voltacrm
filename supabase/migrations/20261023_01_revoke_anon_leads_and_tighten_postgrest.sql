-- ==============================================================================
-- MIGRATION: 20261023_01_revoke_anon_leads_and_tighten_postgrest.sql
-- Purpose:
--   1. Drop permissive "Inserimento lead aperto per kiosk" policy on public.leads.
--   2. Revoke all privileges on public.leads from anon to prevent PostgREST bypass.
--   3. Ensure public.leads can only be written by backend service_role or authenticated staff.
-- ==============================================================================

alter table if exists public.leads enable row level security;

-- Drop open policy that allowed anon to insert arbitrary payloads directly into public.leads
drop policy if exists "Inserimento lead aperto per kiosk" on public.leads;

-- Revoke all table-level grants on public.leads from anon
revoke all on public.leads from anon;

-- Reaffirm authenticated staff policy and service_role grant
drop policy if exists "Operatori gestiscono leads" on public.leads;
create policy "Operatori gestiscono leads"
  on public.leads for all
  to authenticated
  using (public.is_operator_or_admin());

grant select, insert, update on public.leads to authenticated;
grant all on public.leads to service_role;

-- ==============================================================================
-- MIGRATION: 20261019_02_audit_rpc_acl_and_idempotency_fingerprint.sql
-- Purpose:
--   1. Add idempotency_fingerprint column on public.leads for payload conflict detection.
--   2. Ensure unique partial index on public.leads (idempotency_key).
--   3. Define and lock down public.append_notification_reader(text[], text) ACLs to service_role.
-- ==============================================================================

alter table if exists public.leads
  add column if not exists idempotency_fingerprint text;

drop index if exists public.idx_leads_idempotency_key;
create unique index if not exists idx_leads_idempotency_key
  on public.leads (idempotency_key)
  where idempotency_key is not null;

create or replace function public.append_notification_reader(
  p_ids text[],
  p_user_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    return;
  end if;

  update public.notifications
  set
    read_by = case
      when coalesce(read_by, '[]'::jsonb) ? p_user_id then coalesce(read_by, '[]'::jsonb)
      else coalesce(read_by, '[]'::jsonb) || to_jsonb(p_user_id)
    end,
    is_read = case
      when target_user_id is not null or target_customer_id is not null or (meta is not null and meta ? 'customerId') then true
      else is_read
    end
  where id = any(p_ids);
end;
$$;

revoke all on function public.append_notification_reader(text[], text) from public, anon, authenticated;
grant execute on function public.append_notification_reader(text[], text) to service_role;

grant usage on schema public to service_role;
grant all on public.crm_accounts to service_role;
grant all on public.crm_appointments to service_role;
grant select, insert, update, delete on public.profiles, public.commissions, public.settlement_batches to service_role;
grant select, insert, update, delete on public.leads, public.customers, public.notifications, public.portal_bills to service_role;
grant select, insert, update, delete on public.signature_logs, public.meter_readings, public.security_logs to service_role;

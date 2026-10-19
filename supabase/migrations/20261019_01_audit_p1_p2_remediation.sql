-- ==============================================================================
-- MIGRATION: 20261019_01_audit_p1_p2_remediation.sql
-- Purpose:
--   1. Allow guest bill uploads in public.portal_bills (drop strict customers(id) FK on customer_id,
--      add lead_id and assigned_broker_id columns + indexes).
--   2. Add per-recipient isolation and read tracking columns on public.notifications
--      (target_user_id, target_customer_id, read_by jsonb).
--   3. Add verifiable GDPR consent metadata & idempotency columns on public.leads
--      (bill_id, privacy_consent_accepted, privacy_consent_timestamp, privacy_policy_version, idempotency_key).
-- ==============================================================================

alter table if exists public.portal_bills
  drop constraint if exists portal_bills_customer_id_fkey;

alter table if exists public.portal_bills
  add column if not exists lead_id text,
  add column if not exists assigned_broker_id text;

create index if not exists idx_portal_bills_lead_id on public.portal_bills (lead_id);
create index if not exists idx_portal_bills_assigned_broker_id on public.portal_bills (assigned_broker_id);

alter table if exists public.notifications
  add column if not exists target_user_id text,
  add column if not exists target_customer_id text,
  add column if not exists read_by jsonb default '[]'::jsonb not null;

create index if not exists idx_notifications_target_user_id on public.notifications (target_user_id);
create index if not exists idx_notifications_target_customer_id on public.notifications (target_customer_id);

alter table if exists public.leads
  add column if not exists bill_id text,
  add column if not exists privacy_consent_accepted boolean default false,
  add column if not exists privacy_consent_timestamp timestamptz,
  add column if not exists privacy_policy_version text,
  add column if not exists idempotency_key text,
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

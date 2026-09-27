-- Apply after the 20260917 migrations. Existing databases are not changed by schema.sql.
begin;

alter table public.customers add column if not exists assigned_broker_id text;
create index if not exists idx_customers_assigned_broker on public.customers (assigned_broker_id);

alter table public.leads add column if not exists assigned_broker_id text;
alter table public.leads add column if not exists assigned_agent text;
create index if not exists idx_leads_assigned_broker on public.leads (assigned_broker_id);

alter table public.crm_accounts drop constraint if exists crm_accounts_role_check;
alter table public.crm_accounts add constraint crm_accounts_role_check
  check (role in ('admin', 'operator', 'broker', 'call_center', 'customer'));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'operator', 'broker', 'call_center', 'customer'));
create unique index if not exists crm_accounts_oauth_identity_unique
  on public.crm_accounts ((profile->>'authProvider'), (profile->>'oauthSubject'))
  where profile ? 'oauthSubject';

create or replace function public.update_customer_contact(
  p_actor_id text,
  p_customer_id text,
  p_contact jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor public.crm_accounts%rowtype;
  v_customer public.customers%rowtype;
  v_email text := lower(btrim(p_contact->>'email'));
  v_actor_name text;
begin
  select * into v_actor from public.crm_accounts where id = p_actor_id for update;
  if not found then raise exception 'Actor account not found'; end if;
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;

  if v_actor.role = 'customer' and v_actor.customer_id is distinct from p_customer_id then
    raise exception 'Customer ownership mismatch';
  elsif v_actor.role in ('operator', 'broker') then
    v_actor_name := lower(btrim(split_part(coalesce(v_actor.profile->>'name', ''), ' (', 1)));
    if v_customer.assigned_broker_id is not null then
      if v_customer.assigned_broker_id <> p_actor_id then raise exception 'Broker ownership mismatch'; end if;
    elsif v_actor_name = '' or lower(btrim(split_part(coalesce(v_customer.account_manager, ''), ' (', 1))) <> v_actor_name then
      raise exception 'Broker ownership mismatch';
    end if;
  elsif v_actor.role <> 'admin' and v_actor.role <> 'customer' then
    raise exception 'Role not allowed';
  end if;

  if nullif(v_email, '') is null then raise exception 'Email is required'; end if;
  if exists (select 1 from public.crm_accounts where lower(trim(email)) = v_email and customer_id is distinct from p_customer_id) then
    raise exception 'Email already registered' using errcode = '23505';
  end if;

  update public.customers
     set phone = btrim(p_contact->>'phone'), email = v_email, city = btrim(p_contact->>'city'),
         updated_at = timezone('utc', now())
   where id = p_customer_id returning * into v_customer;
  update public.crm_accounts
     set email = v_email,
         profile = profile || jsonb_build_object('email', v_email, 'phone', btrim(p_contact->>'phone'))
   where customer_id = p_customer_id;
  return to_jsonb(v_customer);
end;
$$;

revoke all on function public.update_customer_contact(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_customer_contact(text, text, jsonb) to service_role;

-- Explicit backend permissions when automatic Data API grants are disabled.
grant usage on schema public to service_role;
grant select on public.profiles, public.commissions, public.settlement_batches to service_role;
grant select, insert, update on public.leads, public.customers, public.notifications, public.portal_bills to service_role;
grant select, insert on public.signature_logs, public.meter_readings, public.security_logs to service_role;
commit;

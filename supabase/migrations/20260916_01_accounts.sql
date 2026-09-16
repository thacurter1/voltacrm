-- Run after schema.sql. No changes are applied remotely by the application.
begin;
create table if not exists public.crm_accounts (
  id text primary key,
  email text not null,
  password_hash text not null,
  role text not null check(role in ('admin','operator','call_center','customer')),
  customer_id text references public.customers(id),
  two_factor_secret text,
  is_2fa_enabled boolean not null default false,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_accounts_email_unique on public.crm_accounts(lower(trim(email)));
alter table public.crm_accounts enable row level security;
revoke all on public.crm_accounts from public, anon, authenticated;
grant all on public.crm_accounts to service_role;

create or replace function public.register_customer_account(p_profile jsonb, p_customer jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_profile->>'role' <> 'customer' or p_profile->>'customerId' <> p_customer->>'id' then
    raise exception 'Invalid customer registration';
  end if;
  insert into public.customers(id,name,fiscal_code,phone,email,city,contract_start_date,last_switch_audit_date,
    next_switch_audit_date,has_brokerage_mandate,account_manager,notes,utility_points)
  values(p_customer->>'id',p_customer->>'name',p_customer->>'fiscal_code',p_customer->>'phone',
    p_customer->>'email',p_customer->>'city',(p_customer->>'contract_start_date')::date,
    (p_customer->>'last_switch_audit_date')::date,(p_customer->>'next_switch_audit_date')::date,
    false,p_customer->>'account_manager',p_customer->>'notes',coalesce(p_customer->'utility_points','[]'::jsonb));
  insert into public.crm_accounts(id,email,password_hash,role,customer_id,is_2fa_enabled,profile)
  values(p_profile->>'id',lower(trim(p_profile->>'email')),p_profile->>'password','customer',
    p_customer->>'id',false,p_profile - 'password' - 'twoFactorSecret');
end;
$$;

create or replace function public.bootstrap_crm_admin(p_profile jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('voltacrm-bootstrap-admin'));
  if exists(select 1 from public.crm_accounts where role='admin') then return; end if;
  if length(coalesce(p_profile->>'twoFactorSecret','')) < 20 or p_profile->>'role' <> 'admin' then
    raise exception 'Missing secure bootstrap credentials';
  end if;
  insert into public.crm_accounts(id,email,password_hash,role,two_factor_secret,is_2fa_enabled,profile)
  values(p_profile->>'id',lower(trim(p_profile->>'email')),p_profile->>'password','admin',
    p_profile->>'twoFactorSecret',true,p_profile - 'password' - 'twoFactorSecret');
end;
$$;
revoke all on function public.register_customer_account(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.bootstrap_crm_admin(jsonb) from public,anon,authenticated;
grant execute on function public.register_customer_account(jsonb,jsonb) to service_role;
grant execute on function public.bootstrap_crm_admin(jsonb) to service_role;
commit;

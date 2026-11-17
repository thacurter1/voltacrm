-- ==============================================================================
-- MIGRATION: 20261117_01_account_lifecycle_and_tokens.sql
-- Purpose:
--   1. Account lifecycle columns on public.crm_accounts (token_version, email_verified)
--      with backward-compatible backfill for already-active legacy accounts.
--   2. Atomic single-use token store (public.auth_action_tokens) with SHA-256 digests only.
--   3. Unique partial index on public.customers (upper(trim(fiscal_code))) after duplicate guard.
--   4. Guest bill claim_token_hash on public.portal_bills & public.leads, needs_info bill status,
--      and support_request lead source.
--   5. Hardened SECURITY DEFINER RPCs for verification, password reset, email change,
--      session revocation (token_version), and atomic guest bill claim.
-- ==============================================================================

begin;

-- 1. Backward-compatible columns on public.crm_accounts
alter table if exists public.crm_accounts
  add column if not exists token_version integer not null default 1,
  add column if not exists email_verified boolean not null default false;

-- Preserve existing already-active accounts created prior to email verification enforcement.
update public.crm_accounts
   set email_verified = true
 where email_verified = false
   and coalesce(profile->>'onboardingStatus', 'active') = 'active';

-- Update role check constraint if needed to remain aligned with schema.sql
alter table if exists public.crm_accounts drop constraint if exists crm_accounts_role_check;
alter table if exists public.crm_accounts add constraint crm_accounts_role_check
  check (role in ('admin', 'operator', 'broker', 'call_center', 'customer'));

-- 2. Cryptographic single-use action tokens (verify_email, reset_password, change_email)
create table if not exists public.auth_action_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references public.crm_accounts(id) on delete cascade,
  purpose text not null check (purpose in ('verify_email', 'reset_password', 'change_email')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  target_email text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_auth_action_tokens_account_purpose
  on public.auth_action_tokens (account_id, purpose)
  where consumed_at is null and revoked_at is null;

alter table public.auth_action_tokens enable row level security;
revoke all on public.auth_action_tokens from public, anon, authenticated;
grant all on public.auth_action_tokens to service_role;

-- 3. Guest bill claim hashes & expanded portal/lead constraints
alter table if exists public.portal_bills
  add column if not exists claim_token_hash text;

create index if not exists idx_portal_bills_claim_token_hash
  on public.portal_bills (claim_token_hash)
  where claim_token_hash is not null;

alter table if exists public.portal_bills drop constraint if exists portal_bills_status_check;
alter table if exists public.portal_bills add constraint portal_bills_status_check
  check (status in ('in_review', 'needs_info', 'analyzed', 'archived'));

alter table if exists public.leads
  add column if not exists claim_token_hash text;

alter table if exists public.leads drop constraint if exists leads_source_check;
alter table if exists public.leads add constraint leads_source_check
  check (source in ('totem_kiosk', 'facebook_ads', 'google_ads', 'referral', 'manual', 'website_calculator', 'landing_page', 'public_comparator', 'bill_upload', 'support_request'));

-- 4. Duplicate check before hardening normalized fiscal_code uniqueness on public.customers
do $$
declare
  v_dup_count integer;
begin
  select count(*) into v_dup_count from (
    select upper(trim(fiscal_code)) as norm_cf
      from public.customers
     where deleted_at is null
       and length(trim(fiscal_code)) > 0
       and upper(trim(fiscal_code)) !~ '^OAUTHUSER'
       and upper(trim(fiscal_code)) !~ '^CF[0-9]+$'
     group by upper(trim(fiscal_code))
    having count(*) > 1
  ) dup;

  if v_dup_count > 0 then
    raise exception 'Trovati % codici fiscali duplicati su public.customers: bonificare i duplicati prima di applicare customers_fiscal_code_unique.', v_dup_count;
  end if;
end $$;

create unique index if not exists customers_fiscal_code_unique
  on public.customers (upper(trim(fiscal_code)))
  where deleted_at is null
    and length(trim(fiscal_code)) > 0
    and upper(trim(fiscal_code)) !~ '^OAUTHUSER'
    and upper(trim(fiscal_code)) !~ '^CF[0-9]+$';

-- 5. Update register_customer_account to lock email & fiscal_code and persist lifecycle fields
create or replace function public.register_customer_account(p_profile jsonb, p_customer jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := lower(trim(p_profile->>'email'));
  v_cf text := upper(trim(p_customer->>'fiscal_code'));
begin
  if p_profile->>'role' <> 'customer' or p_profile->>'customerId' <> p_customer->>'id' then
    raise exception 'Invalid customer registration';
  end if;

  perform pg_advisory_xact_lock(hashtext('voltacrm-reg-email-' || v_email));
  perform pg_advisory_xact_lock(hashtext('voltacrm-reg-cf-' || v_cf));

  insert into public.customers(id, name, fiscal_code, phone, email, city, contract_start_date, last_switch_audit_date,
    next_switch_audit_date, has_brokerage_mandate, account_manager, assigned_broker_id, notes, utility_points)
  values(p_customer->>'id', p_customer->>'name', v_cf, p_customer->>'phone',
    nullif(v_email, ''), p_customer->>'city', (p_customer->>'contract_start_date')::date,
    (p_customer->>'last_switch_audit_date')::date, (p_customer->>'next_switch_audit_date')::date,
    false, p_customer->>'account_manager', nullif(p_customer->>'assigned_broker_id', ''),
    p_customer->>'notes', coalesce(p_customer->'utility_points', '[]'::jsonb));

  insert into public.crm_accounts(id, email, password_hash, role, customer_id, is_2fa_enabled, token_version, email_verified, profile)
  values(
    p_profile->>'id',
    v_email,
    p_profile->>'password',
    'customer',
    p_customer->>'id',
    false,
    coalesce((p_profile->>'tokenVersion')::integer, 1),
    coalesce((p_profile->>'emailVerified')::boolean, false),
    p_profile - 'password' - 'twoFactorSecret'
  );
end;
$$;

-- 6. SECURITY DEFINER RPCs for atomic token consumption, verification, reset, email change & session revocation
create or replace function public.consume_auth_action_token(
  p_token_hash text,
  p_purpose text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tok public.auth_action_tokens%rowtype;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_purpose not in ('verify_email', 'reset_password', 'change_email') then
    raise exception 'Token non valido.' using errcode = '22023';
  end if;

  select * into v_tok
    from public.auth_action_tokens
   where token_hash = p_token_hash
     and purpose = p_purpose
   for update;

  if not found or v_tok.consumed_at is not null or v_tok.revoked_at is not null or v_tok.expires_at <= now() then
    raise exception 'Token non valido, revocato o scaduto.' using errcode = 'P0002';
  end if;

  update public.auth_action_tokens
     set consumed_at = now()
   where id = v_tok.id;

  return jsonb_build_object(
    'id', v_tok.id,
    'accountId', v_tok.account_id,
    'purpose', v_tok.purpose,
    'targetEmail', v_tok.target_email
  );
end;
$$;

create or replace function public.complete_email_verification(
  p_token_hash text
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tok jsonb;
  v_account_id text;
  v_next_status text;
begin
  v_tok := public.consume_auth_action_token(p_token_hash, 'verify_email');
  v_account_id := v_tok->>'accountId';

  update public.crm_accounts
     set email_verified = true,
         profile = profile || jsonb_build_object(
           'emailVerified', true,
           'onboardingStatus', case when profile->>'onboardingStatus' = 'suspended' then 'suspended' else 'active' end
         )
   where id = v_account_id
   returning profile->>'onboardingStatus' into v_next_status;

  if not found then
    raise exception 'Account non trovato.';
  end if;
  return v_account_id;
end;
$$;

create or replace function public.complete_password_reset(
  p_token_hash text,
  p_password_hash text
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tok jsonb;
  v_account_id text;
begin
  if length(coalesce(p_password_hash, '')) < 50 then
    raise exception 'Hash password non valido.';
  end if;

  v_tok := public.consume_auth_action_token(p_token_hash, 'reset_password');
  v_account_id := v_tok->>'accountId';

  update public.crm_accounts
     set password_hash = p_password_hash,
         token_version = coalesce(token_version, 1) + 1,
         email_verified = true,
         profile = profile || jsonb_build_object(
           'tokenVersion', coalesce(token_version, 1) + 1,
           'emailVerified', true,
           'onboardingStatus', case when profile->>'onboardingStatus' = 'suspended' then 'suspended' else 'active' end
         )
   where id = v_account_id;

  if not found then
    raise exception 'Account non trovato.';
  end if;
  return v_account_id;
end;
$$;

create or replace function public.bump_account_token_version(
  p_account_id text,
  p_new_password_hash text default null
) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_next integer;
begin
  update public.crm_accounts
     set token_version = coalesce(token_version, 1) + 1,
         password_hash = coalesce(p_new_password_hash, password_hash),
         profile = profile || jsonb_build_object('tokenVersion', coalesce(token_version, 1) + 1)
   where id = p_account_id
   returning token_version into v_next;

  if not found then
    raise exception 'Account non trovato.';
  end if;
  return v_next;
end;
$$;

create or replace function public.confirm_account_email_change(
  p_token_hash text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tok jsonb;
  v_account_id text;
  v_new_email text;
  v_customer_id text;
begin
  v_tok := public.consume_auth_action_token(p_token_hash, 'change_email');
  v_account_id := v_tok->>'accountId';
  v_new_email := lower(trim(coalesce(v_tok->>'targetEmail', '')));
  if v_new_email = '' then
    raise exception 'Nuovo indirizzo email mancante.';
  end if;

  if exists (select 1 from public.crm_accounts where lower(trim(email)) = v_new_email and id <> v_account_id) then
    raise exception 'Email già registrata.' using errcode = '23505';
  end if;

  update public.crm_accounts
     set email = v_new_email,
         email_verified = true,
         token_version = coalesce(token_version, 1) + 1,
         profile = profile || jsonb_build_object(
           'email', v_new_email,
           'emailVerified', true,
           'tokenVersion', coalesce(token_version, 1) + 1
         )
   where id = v_account_id
   returning customer_id into v_customer_id;

  if not found then
    raise exception 'Account non trovato.';
  end if;

  if v_customer_id is not null then
    update public.customers
       set email = v_new_email,
           updated_at = timezone('utc', now())
     where id = v_customer_id;
  end if;

  return jsonb_build_object('accountId', v_account_id, 'customerId', v_customer_id, 'email', v_new_email);
end;
$$;

create or replace function public.claim_guest_bill_with_token(
  p_claim_token_hash text,
  p_customer_id text,
  p_customer_name text
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_bill public.portal_bills%rowtype;
begin
  if p_claim_token_hash !~ '^[0-9a-f]{64}$' or nullif(trim(p_customer_id), '') is null then
    raise exception 'Codice di verifica bolletta non valido.';
  end if;

  select * into v_bill
    from public.portal_bills
   where claim_token_hash = p_claim_token_hash
   for update;

  if not found or v_bill.customer_id not like 'guest-%' then
    raise exception 'Bolletta guest non trovata o già associata.';
  end if;

  update public.portal_bills
     set customer_id = p_customer_id,
         customer_name = p_customer_name,
         claim_token_hash = null
   where id = v_bill.id;

  if v_bill.lead_id is not null then
    update public.leads
       set claim_token_hash = null
     where id = v_bill.lead_id;
  end if;

  return v_bill.id;
end;
$$;

revoke all on function public.consume_auth_action_token(text, text) from public, anon, authenticated;
revoke all on function public.complete_email_verification(text) from public, anon, authenticated;
revoke all on function public.complete_password_reset(text, text) from public, anon, authenticated;
revoke all on function public.bump_account_token_version(text, text) from public, anon, authenticated;
revoke all on function public.confirm_account_email_change(text) from public, anon, authenticated;
revoke all on function public.claim_guest_bill_with_token(text, text, text) from public, anon, authenticated;

grant execute on function public.consume_auth_action_token(text, text) to service_role;
grant execute on function public.complete_email_verification(text) to service_role;
grant execute on function public.complete_password_reset(text, text) to service_role;
grant execute on function public.bump_account_token_version(text, text) to service_role;
grant execute on function public.confirm_account_email_change(text) to service_role;
grant execute on function public.claim_guest_bill_with_token(text, text, text) to service_role;

commit;

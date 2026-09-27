begin;

-- Invited customers keep their broker assignment when the customer and account
-- are created atomically.
create or replace function public.register_customer_account(p_profile jsonb, p_customer jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_profile->>'role' <> 'customer' or p_profile->>'customerId' <> p_customer->>'id' then
    raise exception 'Invalid customer registration';
  end if;
  insert into public.customers(id,name,fiscal_code,phone,email,city,contract_start_date,last_switch_audit_date,
    next_switch_audit_date,has_brokerage_mandate,account_manager,assigned_broker_id,notes,utility_points)
  values(p_customer->>'id',p_customer->>'name',p_customer->>'fiscal_code',p_customer->>'phone',
    p_customer->>'email',p_customer->>'city',(p_customer->>'contract_start_date')::date,
    (p_customer->>'last_switch_audit_date')::date,(p_customer->>'next_switch_audit_date')::date,
    false,p_customer->>'account_manager',nullif(p_customer->>'assigned_broker_id',''),
    p_customer->>'notes',coalesce(p_customer->'utility_points','[]'::jsonb));
  insert into public.crm_accounts(id,email,password_hash,role,customer_id,is_2fa_enabled,profile)
  values(p_profile->>'id',lower(trim(p_profile->>'email')),p_profile->>'password','customer',
    p_customer->>'id',false,p_profile - 'password' - 'twoFactorSecret');
end;
$$;

create index if not exists crm_accounts_invite_token_idx
  on public.crm_accounts ((profile->>'inviteTokenHash'))
  where profile ? 'inviteTokenHash';

create or replace function public.accept_crm_invitation(
  p_token_hash text,
  p_password_hash text,
  p_totp_secret text default null
) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_account public.crm_accounts%rowtype;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' or length(p_password_hash) < 50 then
    raise exception 'Invalid invitation credentials';
  end if;
  select * into v_account from public.crm_accounts
    where profile->>'inviteTokenHash' = p_token_hash for update;
  if not found or v_account.profile->>'onboardingStatus' <> 'invited'
     or (v_account.profile->>'inviteExpiresAt')::timestamptz <= now() then
    raise exception 'Invitation invalid or expired';
  end if;
  if v_account.role <> 'customer' and
     (p_totp_secret is null or p_totp_secret is distinct from v_account.profile->>'inviteTotpSecret') then
    raise exception 'Staff second factor not confirmed';
  end if;
  update public.crm_accounts
     set password_hash = p_password_hash,
         two_factor_secret = case when v_account.role = 'customer' then null else p_totp_secret end,
         is_2fa_enabled = v_account.role <> 'customer',
         profile = (v_account.profile - 'inviteTokenHash' - 'inviteExpiresAt' - 'inviteTotpSecret')
                   || '{"onboardingStatus":"active"}'::jsonb
   where id = v_account.id;
  return v_account.id;
end;
$$;

revoke all on function public.accept_crm_invitation(text,text,text) from public,anon,authenticated;
grant execute on function public.accept_crm_invitation(text,text,text) to service_role;
commit;

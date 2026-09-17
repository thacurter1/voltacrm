begin;

create or replace function public.sync_customer_after_signature_activation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'activated'
     and new.activation_status = 'activated'
     and new.activation_date is not null
     and (old.status, old.activation_status) is distinct from (new.status, new.activation_status) then
    update public.customers
       set last_switch_audit_date = new.activation_date,
           next_switch_audit_date = new.activation_date + 120,
           has_brokerage_mandate = true
     where id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists signature_activation_sync_customer on public.signature_logs;
create trigger signature_activation_sync_customer
after update of status, activation_status, activation_date on public.signature_logs
for each row execute function public.sync_customer_after_signature_activation();

create or replace function public.activate_signature_with_commissions(
  p_signature_id text,
  p_confirmation_reference text,
  p_activation_date date,
  p_activated_by text,
  p_agent_id text,
  p_agent_name text,
  p_customer_name text,
  p_pod_or_pdr text,
  p_utility_type text,
  p_customer_type text,
  p_annual_consumption numeric,
  p_is_dual_fuel boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signature jsonb;
  v_commissions jsonb;
begin
  v_signature := public.activate_signed_signature(
    p_signature_id,
    p_confirmation_reference,
    p_activation_date,
    p_activated_by
  );

  v_commissions := public.generate_contract_commissions(
    p_agent_id,
    p_agent_name,
    p_signature_id,
    p_customer_name,
    p_pod_or_pdr,
    p_utility_type,
    p_customer_type,
    p_annual_consumption,
    p_is_dual_fuel
  );

  return jsonb_build_object(
    'signatureReceipt', v_signature,
    'commissions', v_commissions
  );
end;
$$;

revoke all on function public.activate_signature_with_commissions(
  text, text, date, text, text, text, text, text, text, text, numeric, boolean
) from public, anon, authenticated;
grant execute on function public.activate_signature_with_commissions(
  text, text, date, text, text, text, text, text, text, text, numeric, boolean
) to service_role;

commit;

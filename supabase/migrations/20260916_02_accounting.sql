begin;

create table if not exists public.commission_generations (
  id text primary key,
  contract_id text not null,
  pod_or_pdr text not null,
  agent_id text not null,
  request_fingerprint text not null,
  period text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (contract_id, pod_or_pdr)
);

alter table public.commission_generations enable row level security;
revoke all on public.commission_generations from public, anon, authenticated;

alter table public.commissions
  add column if not exists generation_id text references public.commission_generations(id),
  add column if not exists settlement_batch_id text references public.settlement_batches(id);

create index if not exists idx_commissions_generation_id
  on public.commissions (generation_id);

create index if not exists idx_commissions_settlement_batch_id
  on public.commissions (settlement_batch_id);

create unique index if not exists uq_settlement_batches_payment_reference
  on public.settlement_batches (payment_reference);

revoke insert, update, delete on public.commissions from anon, authenticated;
revoke insert, update, delete on public.settlement_batches from anon, authenticated;

create or replace function public.generate_contract_commissions(
  p_agent_id text,
  p_agent_name text,
  p_contract_id text,
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
  v_agent_id text := btrim(p_agent_id);
  v_agent_name text := btrim(p_agent_name);
  v_contract_id text := btrim(p_contract_id);
  v_customer_name text := btrim(p_customer_name);
  v_pod_or_pdr text := btrim(p_pod_or_pdr);
  v_utility_type text := btrim(p_utility_type);
  v_customer_type text := coalesce(nullif(btrim(p_customer_type), ''), 'residential');
  v_is_dual_fuel boolean := coalesce(p_is_dual_fuel, false);
  v_is_business boolean;
  v_period text := to_char(current_date, 'YYYY-MM');
  v_generation_id text;
  v_fingerprint text;
  v_generation public.commission_generations%rowtype;
  v_records jsonb;
  v_total numeric;
  v_rate numeric;
  v_recurring numeric;
begin
  if nullif(v_agent_id, '') is null then raise exception 'agentId is required'; end if;
  if nullif(v_agent_name, '') is null then raise exception 'agentName is required'; end if;
  if nullif(v_contract_id, '') is null then raise exception 'contractId is required'; end if;
  if nullif(v_customer_name, '') is null then raise exception 'customerName is required'; end if;
  if nullif(v_pod_or_pdr, '') is null then raise exception 'podOrPdr is required'; end if;
  if v_utility_type not in ('luce', 'gas') then raise exception 'utilityType must be luce or gas'; end if;
  if v_customer_type not in ('residential', 'business') then raise exception 'customerType must be residential or business'; end if;
  if p_annual_consumption is null or p_annual_consumption < 0 then
    raise exception 'annualConsumption must be non-negative';
  end if;

  v_is_business := v_customer_type = 'business' or p_annual_consumption > 6000;
  v_generation_id := 'gen-' || md5(v_contract_id || chr(31) || v_pod_or_pdr);
  v_fingerprint := md5(concat_ws(
    chr(31),
    v_agent_name,
    v_customer_name,
    v_utility_type,
    case when v_is_business then 'business' else 'residential' end,
    p_annual_consumption::text,
    v_is_dual_fuel::text
  ));

  perform pg_advisory_xact_lock(hashtextextended('commission-generation|' || v_contract_id || '|' || v_pod_or_pdr, 0));

  select generation.*
    into v_generation
    from public.commission_generations generation
   where generation.contract_id = v_contract_id
     and generation.pod_or_pdr = v_pod_or_pdr
   for update;

  if found then
    if v_generation.agent_id <> v_agent_id then
      raise exception 'This contract and POD/PDR generation belongs to another agent';
    end if;
    if v_generation.request_fingerprint <> v_fingerprint then
      raise exception 'This generation retry does not match the original request';
    end if;
  else
    if exists (
      select 1
        from public.commissions commission
       where commission.contract_id = v_contract_id
         and commission.pod_or_pdr = v_pod_or_pdr
         and commission.period = v_period
         and commission.agent_id <> v_agent_id
    ) then
      raise exception 'This contract and POD/PDR generation belongs to another agent';
    end if;

    insert into public.commission_generations (
      id, contract_id, pod_or_pdr, agent_id, request_fingerprint, period
    ) values (
      v_generation_id, v_contract_id, v_pod_or_pdr, v_agent_id, v_fingerprint, v_period
    );

    insert into public.commissions (
      id, agent_id, agent_name, contract_id, customer_name, pod_or_pdr,
      utility_type, customer_type, annual_consumption, type, amount_eur,
      status, period, accrual_date, notes, generation_id
    ) values (
      'comm-' || md5(v_contract_id || chr(31) || v_pod_or_pdr || chr(31) || 'upfront' || chr(31) || v_period),
      v_agent_id, v_agent_name, v_contract_id, v_customer_name, v_pod_or_pdr,
      v_utility_type, case when v_is_business then 'business' else 'residential' end,
      p_annual_consumption, 'upfront',
      case when v_utility_type = 'luce' then case when v_is_business then 95 else 45 end
           else case when v_is_business then 85 else 40 end end,
      'accrued', v_period, current_date,
      'Gettone attivazione ' || upper(v_utility_type) || case when v_is_business then ' (Business)' else ' (Residenziale)' end,
      v_generation_id
    )
    on conflict (contract_id, pod_or_pdr, type, period)
    do update set generation_id = excluded.generation_id
      where public.commissions.agent_id = excluded.agent_id;

    if v_is_dual_fuel then
      insert into public.commissions (
        id, agent_id, agent_name, contract_id, customer_name, pod_or_pdr,
        utility_type, customer_type, annual_consumption, type, amount_eur,
        status, period, accrual_date, notes, generation_id
      ) values (
        'comm-' || md5(v_contract_id || chr(31) || v_pod_or_pdr || chr(31) || 'bonus' || chr(31) || v_period),
        v_agent_id, v_agent_name, v_contract_id, v_customer_name, v_pod_or_pdr,
        v_utility_type, case when v_is_business then 'business' else 'residential' end,
        p_annual_consumption, 'bonus', 25, 'accrued', v_period, current_date,
        'Bonus promozionale Dual Fuel (Luce + Gas)', v_generation_id
      )
      on conflict (contract_id, pod_or_pdr, type, period)
      do update set generation_id = excluded.generation_id
        where public.commissions.agent_id = excluded.agent_id;
    end if;

    v_rate := case when v_utility_type = 'luce' then 0.0025 else 0.015 end;
    v_recurring := round((p_annual_consumption * v_rate) / 12, 2);
    if v_recurring > 0 then
      insert into public.commissions (
        id, agent_id, agent_name, contract_id, customer_name, pod_or_pdr,
        utility_type, customer_type, annual_consumption, type, amount_eur,
        status, period, accrual_date, notes, generation_id
      ) values (
        'comm-' || md5(v_contract_id || chr(31) || v_pod_or_pdr || chr(31) || 'recurring' || chr(31) || v_period),
        v_agent_id, v_agent_name, v_contract_id, v_customer_name, v_pod_or_pdr,
        v_utility_type, case when v_is_business then 'business' else 'residential' end,
        p_annual_consumption, 'recurring', greatest(1, v_recurring), 'accrued',
        v_period, current_date,
        'Mantenimento portafoglio mese (' || p_annual_consumption || case when v_utility_type = 'luce' then ' kWh/anno)' else ' Smc/anno)' end,
        v_generation_id
      )
      on conflict (contract_id, pod_or_pdr, type, period)
      do update set generation_id = excluded.generation_id
        where public.commissions.agent_id = excluded.agent_id;
    end if;
  end if;

  select
    coalesce(
      jsonb_agg(to_jsonb(commission) order by
        case commission.type when 'upfront' then 1 when 'bonus' then 2 when 'recurring' then 3 else 4 end
      ),
      '[]'::jsonb
    ),
    coalesce(sum(commission.amount_eur), 0)
    into v_records, v_total
    from public.commissions commission
   where commission.generation_id = v_generation_id;

  if jsonb_array_length(v_records) = 0 then
    raise exception 'Commission generation did not produce records';
  end if;

  return jsonb_build_object('records', v_records, 'totalEur', round(v_total, 2));
end;
$$;

create or replace function public.settle_commissions(
  p_agent_id text,
  p_commission_ids text[],
  p_batch_id text,
  p_payment_reference text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_agent_id text := btrim(p_agent_id);
  v_batch_id text := btrim(p_batch_id);
  v_payment_reference text := btrim(p_payment_reference);
  v_ids text[];
  v_batch public.settlement_batches%rowtype;
  v_found_count integer;
  v_eligible_count integer;
  v_agent_name text;
  v_total numeric;
  v_updated integer;
begin
  if nullif(v_agent_id, '') is null then raise exception 'agentId is required'; end if;
  if nullif(v_batch_id, '') is null then raise exception 'batchId is required'; end if;
  if nullif(v_payment_reference, '') is null then raise exception 'paymentReference is required'; end if;

  select coalesce(array_agg(item.id order by item.id), '{}'::text[])
    into v_ids
    from (
      select distinct btrim(value) as id
        from unnest(p_commission_ids) as supplied(value)
       where nullif(btrim(value), '') is not null
    ) item;

  if cardinality(v_ids) = 0 then raise exception 'At least one commissionId is required'; end if;

  select batch.*
    into v_batch
    from public.settlement_batches batch
   where batch.id = v_batch_id
   for update;

  if found then
    if v_batch.agent_id <> v_agent_id or v_batch.payment_reference <> v_payment_reference then
      raise exception 'Settlement retry does not match the original batch';
    end if;
    select count(*) into v_found_count
      from public.commissions commission
     where commission.settlement_batch_id = v_batch_id;
    if v_found_count <> cardinality(v_ids)
       or exists (
         select 1 from unnest(v_ids) supplied(id)
          where not exists (
            select 1 from public.commissions commission
             where commission.id = supplied.id
               and commission.settlement_batch_id = v_batch_id
          )
       ) then
      raise exception 'Settlement retry does not match the original commission set';
    end if;
    return jsonb_build_object('batch', to_jsonb(v_batch), 'updatedCount', v_batch.commission_count);
  end if;

  perform 1
    from public.commissions commission
   where commission.id = any(v_ids)
   order by commission.id
   for update;

  select
    count(*),
    count(*) filter (where commission.agent_id = v_agent_id and commission.status = 'accrued'),
    min(commission.agent_name),
    coalesce(sum(commission.amount_eur) filter (where commission.agent_id = v_agent_id and commission.status = 'accrued'), 0)
    into v_found_count, v_eligible_count, v_agent_name, v_total
    from public.commissions commission
   where commission.id = any(v_ids);

  if v_found_count <> cardinality(v_ids) or v_eligible_count <> cardinality(v_ids) then
    raise exception 'All selected commissions must exist, belong to the agent, and be eligible accrued records';
  end if;

  insert into public.settlement_batches (
    id, agent_id, agent_name, settlement_date, payment_reference,
    period, total_amount_eur, commission_count, notes
  ) values (
    v_batch_id, v_agent_id, v_agent_name, current_date, v_payment_reference,
    to_char(current_date, 'YYYY-MM'), round(v_total, 2), cardinality(v_ids),
    coalesce(nullif(btrim(p_notes), ''), 'Liquidazione saldo provvigionale del ' || current_date::text)
  )
  returning * into v_batch;

  update public.commissions commission
     set status = 'settled',
         settlement_date = current_date,
         payment_reference = v_payment_reference,
         settlement_batch_id = v_batch_id
   where commission.id = any(v_ids)
     and commission.agent_id = v_agent_id
     and commission.status = 'accrued';
  get diagnostics v_updated = row_count;

  if v_updated <> cardinality(v_ids) then
    raise exception 'Settlement lost eligibility while being processed';
  end if;

  return jsonb_build_object('batch', to_jsonb(v_batch), 'updatedCount', v_updated);
end;
$$;

revoke all on function public.generate_contract_commissions(text, text, text, text, text, text, text, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.generate_contract_commissions(text, text, text, text, text, text, text, numeric, boolean)
  to service_role;

revoke all on function public.settle_commissions(text, text[], text, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_commissions(text, text[], text, text, text)
  to service_role;

commit;

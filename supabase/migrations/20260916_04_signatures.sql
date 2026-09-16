begin;

alter table public.signature_logs
  add column if not exists utility_point_id text,
  add column if not exists pod_or_pdr text,
  add column if not exists energy_type text,
  add column if not exists offer_snapshot jsonb,
  add column if not exists original_point_snapshot jsonb,
  add column if not exists consent_version text,
  add column if not exists canonical_document jsonb,
  add column if not exists canvas_data_url text,
  add column if not exists document_hash text,
  add column if not exists status text not null default 'signed',
  add column if not exists activation_status text not null default 'pending_activation',
  add column if not exists activation_reference text,
  add column if not exists activation_date date,
  add column if not exists activated_by text,
  add column if not exists activated_at timestamp with time zone;

alter table public.signature_logs
  drop constraint if exists signature_logs_energy_type_check,
  add constraint signature_logs_energy_type_check
    check (energy_type is null or energy_type in ('luce', 'gas')),
  drop constraint if exists signature_logs_status_check,
  add constraint signature_logs_status_check
    check (status in ('signed', 'activated')),
  drop constraint if exists signature_logs_activation_status_check,
  add constraint signature_logs_activation_status_check
    check (activation_status in ('pending_activation', 'activated'));

create or replace function public.activate_signed_signature(
  p_signature_id text,
  p_confirmation_reference text,
  p_activation_date date,
  p_activated_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signature public.signature_logs%rowtype;
  v_customer public.customers%rowtype;
  v_points jsonb;
  v_current_point jsonb;
  v_original_point jsonb;
  v_offer jsonb;
  v_point_index integer;
  v_updated_point jsonb;
  v_activated_at timestamp with time zone := timezone('utc'::text, now());
begin
  if nullif(btrim(p_confirmation_reference), '') is null or p_activation_date is null then
    raise exception 'Activation reference and date are required' using errcode = '22023';
  end if;

  select * into v_signature
  from public.signature_logs
  where id = p_signature_id
  for update;

  if not found then
    raise exception 'Signature not found' using errcode = 'P0002';
  end if;
  if v_signature.status <> 'signed' or v_signature.activation_status <> 'pending_activation' then
    raise exception 'Signature already activated or not pending' using errcode = '40001';
  end if;
  if v_signature.utility_point_id is null or v_signature.pod_or_pdr is null
     or v_signature.offer_snapshot is null or v_signature.original_point_snapshot is null then
    raise exception 'Signature lacks the immutable point or offer snapshot' using errcode = '22023';
  end if;

  select * into v_customer
  from public.customers
  where id = v_signature.customer_id
  for update;

  if not found then
    raise exception 'Customer not found for signature' using errcode = 'P0002';
  end if;

  v_points := coalesce(v_customer.utility_points, '[]'::jsonb);
  select point.value, (point.ordinality - 1)::integer
    into v_current_point, v_point_index
  from jsonb_array_elements(v_points) with ordinality as point(value, ordinality)
  where point.value->>'id' = v_signature.utility_point_id
    and point.value->>'podOrPdr' = v_signature.pod_or_pdr
  limit 1;

  if v_current_point is null then
    raise exception 'Signed utility point not found' using errcode = '40001';
  end if;

  v_original_point := v_signature.original_point_snapshot;
  if (v_current_point->>'id', v_current_point->>'type', v_current_point->>'podOrPdr',
      v_current_point->>'currentSupplier', v_current_point->>'currentOfferName',
      v_current_point->>'currentTariffType', v_current_point->>'currentUnitCost',
      v_current_point->>'currentFixedFeeYear')
     is distinct from
     (v_original_point->>'id', v_original_point->>'type', v_original_point->>'podOrPdr',
      v_original_point->>'currentSupplier', v_original_point->>'currentOfferName',
      v_original_point->>'currentTariffType', v_original_point->>'currentUnitCost',
      v_original_point->>'currentFixedFeeYear') then
    raise exception 'Stale utility point snapshot conflict' using errcode = '40001';
  end if;

  v_offer := v_signature.offer_snapshot;
  if v_offer->>'energyType' is distinct from v_current_point->>'type' then
    raise exception 'Offer energy type conflicts with signed point' using errcode = '22023';
  end if;

  v_updated_point := v_current_point || jsonb_build_object(
    'currentSupplier', v_offer->>'supplier',
    'currentOfferName', v_offer->>'name',
    'currentTariffType', case when v_offer->>'pricingType' = 'fixed' then 'fixed' else 'indexed' end,
    'currentUnitCost', (v_offer->>'unitPriceOrSpread')::numeric,
    'currentFixedFeeYear', (v_offer->>'fixedAnnualFee')::numeric
  );

  update public.customers
  set utility_points = jsonb_set(v_points, array[v_point_index::text], v_updated_point, false)
  where id = v_customer.id;

  update public.signature_logs
  set status = 'activated',
      activation_status = 'activated',
      activation_reference = btrim(p_confirmation_reference),
      activation_date = p_activation_date,
      activated_by = p_activated_by,
      activated_at = v_activated_at
  where id = p_signature_id;

  return to_jsonb(v_signature) || jsonb_build_object(
    'status', 'activated',
    'activation_status', 'activated',
    'activation_reference', btrim(p_confirmation_reference),
    'activation_date', p_activation_date,
    'activated_by', p_activated_by,
    'activated_at', v_activated_at
  );
end;
$$;

revoke all on function public.activate_signed_signature(text, text, date, text) from public, anon, authenticated;
grant execute on function public.activate_signed_signature(text, text, date, text) to service_role;

commit;

-- Durable customer portal bills and meter readings.
-- Review and apply through the normal Supabase migration workflow.

create table if not exists public.portal_bills (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  customer_name text not null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  utility_type text not null check (utility_type in ('luce', 'gas')),
  status text not null default 'in_review' check (status in ('in_review', 'analyzed', 'archived')),
  notes text,
  extracted_savings_eur numeric check (extracted_savings_eur is null or extracted_savings_eur >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.meter_readings (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  utility_point_id text not null,
  utility_type text not null check (utility_type in ('luce', 'gas')),
  readings jsonb not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint meter_readings_object check (jsonb_typeof(readings) = 'object'),
  constraint meter_readings_values check (
    (
      utility_type = 'luce'
      and not (readings ? 'gas')
      and (readings ? 'f1' or readings ? 'f2' or readings ? 'f3')
      and (not (readings ? 'f1') or (jsonb_typeof(readings -> 'f1') = 'number' and (readings ->> 'f1')::numeric >= 0))
      and (not (readings ? 'f2') or (jsonb_typeof(readings -> 'f2') = 'number' and (readings ->> 'f2')::numeric >= 0))
      and (not (readings ? 'f3') or (jsonb_typeof(readings -> 'f3') = 'number' and (readings ->> 'f3')::numeric >= 0))
    )
    or
    (
      utility_type = 'gas'
      and readings ? 'gas'
      and not (readings ? 'f1' or readings ? 'f2' or readings ? 'f3')
      and jsonb_typeof(readings -> 'gas') = 'number'
      and (readings ->> 'gas')::numeric >= 0
    )
  )
);

create index if not exists idx_portal_bills_customer_created
  on public.portal_bills(customer_id, created_at desc);
create index if not exists idx_meter_readings_customer_recorded
  on public.meter_readings(customer_id, recorded_at desc);
create index if not exists idx_meter_readings_utility_point
  on public.meter_readings(utility_point_id, recorded_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-bills',
  'customer-bills',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_portal_customer(target_customer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.customers c on c.id = target_customer_id
    where p.id = auth.uid()
      and (
        p.role in ('admin', 'operator', 'call_center')
        or (p.role = 'customer' and (lower(c.email) = lower(p.email) or c.phone = p.phone))
      )
  );
$$;

revoke all on function public.can_access_portal_customer(text) from public;
grant execute on function public.can_access_portal_customer(text) to authenticated;

alter table public.portal_bills enable row level security;
alter table public.meter_readings enable row level security;

drop policy if exists "Portal bills scoped read" on public.portal_bills;
create policy "Portal bills scoped read"
  on public.portal_bills for select
  to authenticated
  using (public.can_access_portal_customer(customer_id));

drop policy if exists "Portal bills scoped insert" on public.portal_bills;
create policy "Portal bills scoped insert"
  on public.portal_bills for insert
  to authenticated
  with check (
    public.can_access_portal_customer(customer_id)
    and status = 'in_review'
  );

drop policy if exists "Meter readings scoped read" on public.meter_readings;
create policy "Meter readings scoped read"
  on public.meter_readings for select
  to authenticated
  using (public.can_access_portal_customer(customer_id));

drop policy if exists "Meter readings scoped insert" on public.meter_readings;
create policy "Meter readings scoped insert"
  on public.meter_readings for insert
  to authenticated
  with check (public.can_access_portal_customer(customer_id));

grant select, insert on public.portal_bills to authenticated;
grant select, insert on public.meter_readings to authenticated;

-- Storage objects are intentionally accessed only through the authenticated
-- backend. The bucket stays private and no direct authenticated-client policy
-- is created; downloads use a 60-second signed URL or backend byte streaming.

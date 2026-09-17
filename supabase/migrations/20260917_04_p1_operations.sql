create table if not exists public.crm_appointments (
  id text primary key,
  lead_id text not null,
  customer_name text not null,
  phone text not null,
  city text not null,
  agent_name text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  type text not null check (type in ('phone_consultation', 'field_visit', 'video_call')),
  status text not null check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.crm_appointments enable row level security;
revoke all on public.crm_appointments from anon, authenticated;
grant all on public.crm_appointments to service_role;

create index if not exists crm_appointments_scheduled_at_idx on public.crm_appointments (scheduled_at desc);

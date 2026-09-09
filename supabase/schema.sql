-- ==============================================================================
-- SCHEMA SUPABASE PER VOLTACRM: DUAL PORTAL, PROFILI, RBAC E ROW LEVEL SECURITY
-- ==============================================================================

-- 1. Tabella dei Profili Utente (estende auth.users di Supabase)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'operator', 'customer')),
  phone text,
  whatsapp text,
  fiscal_code text,
  assigned_broker_id uuid references public.profiles(id),
  avatar_initials text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabella Forniture / Punti di Prelievo (POD / PDR)
create table if not exists public.utility_points (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('luce', 'gas')),
  pod_or_pdr text not null,
  annual_consumption numeric not null default 2700,
  power_kw numeric default 3.0,
  current_supplier text not null,
  current_offer_name text not null,
  current_tariff_type text not null check (current_tariff_type in ('fixed', 'indexed')),
  current_unit_cost numeric not null,
  current_fixed_fee_year numeric not null default 120.0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabella Bollette Caricate dai Clienti
create table if not exists public.bills (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  file_name text not null,
  file_url text,
  file_size_kb integer not null default 0,
  utility_type text not null check (utility_type in ('luce', 'gas')),
  status text not null check (status in ('in_review', 'analyzed', 'archived')) default 'in_review',
  extracted_savings_eur numeric default 0.0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabella Log di Sicurezza e GDPR Audit
create table if not exists public.security_logs (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,
  event_type text not null,
  ip_address text not null,
  status text not null check (status in ('safe', 'warning', 'critical')),
  details text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - ISOLAMENTO MATEMATICO DEI DATI FRA OPERATORI E CLIENTI
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.utility_points enable row level security;
alter table public.bills enable row level security;
alter table public.security_logs enable row level security;

-- Helper function: verifica se l'utente corrente è operatore o admin
create or replace function public.is_operator_or_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'operator')
  );
end;
$$ language plpgsql security definer;

-- Politiche RLS: PROFILES
create policy "Chiunque autenticato può leggere il proprio profilo"
  on public.profiles for select
  using (auth.uid() = id or public.is_operator_or_admin());

create policy "Gli utenti possono aggiornare il proprio profilo"
  on public.profiles for update
  using (auth.uid() = id or public.is_operator_or_admin());

-- Politiche RLS: UTILITY_POINTS (POD/PDR)
create policy "I clienti vedono solo i propri POD/PDR, gli operatori vedono tutto"
  on public.utility_points for select
  using (auth.uid() = profile_id or public.is_operator_or_admin());

create policy "Operatori possono inserire forniture per i clienti"
  on public.utility_points for insert
  with check (auth.uid() = profile_id or public.is_operator_or_admin());

-- Politiche RLS: BILLS (Bollette)
create policy "I clienti vedono solo le proprie bollette, gli operatori vedono tutto"
  on public.bills for select
  using (auth.uid() = profile_id or public.is_operator_or_admin());

create policy "I clienti possono caricare bollette nella propria area"
  on public.bills for insert
  with check (auth.uid() = profile_id or public.is_operator_or_admin());

-- Trigger per creare automaticamente il record in public.profiles alla registrazione
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    upper(substring(coalesce(new.raw_user_meta_data->>'full_name', 'U'), 1, 2))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

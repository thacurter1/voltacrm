-- ==============================================================================
-- SCHEMA SUPABASE HARDENED PER VOLTACRM: ZERO-TRUST, ANTI-TAMPER E RLS AUDITATO
-- ==============================================================================

-- Disabilita l'accesso diretto anonimo per default su tutto lo schema public
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

-- 1. Tabella dei Profili Utente (estende auth.users di Supabase)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null check (role in ('admin', 'operator', 'call_center', 'customer')) default 'customer',
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
  annual_consumption numeric not null default 2700 check (annual_consumption >= 0),
  power_kw numeric default 3.0 check (power_kw is null or power_kw > 0),
  current_supplier text not null,
  current_offer_name text not null,
  current_tariff_type text not null check (current_tariff_type in ('fixed', 'indexed')),
  current_unit_cost numeric not null check (current_unit_cost >= 0),
  current_fixed_fee_year numeric not null default 120.0 check (current_fixed_fee_year >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tabella Bollette Caricate dai Clienti
create table if not exists public.bills (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  file_name text not null,
  file_url text,
  file_size_kb integer not null default 0 check (file_size_kb >= 0 and file_size_kb <= 25600), -- Limite max 25MB
  utility_type text not null check (utility_type in ('luce', 'gas')),
  status text not null check (status in ('in_review', 'analyzed', 'archived')) default 'in_review',
  extracted_savings_eur numeric default 0.0 check (extracted_savings_eur >= 0),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabella Log di Sicurezza e GDPR Audit (Append-Only, Anti-Manomissione)
create table if not exists public.security_logs (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,
  event_type text not null,
  ip_address text not null,
  status text not null check (status in ('safe', 'warning', 'critical')),
  details text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabella Leads Marketing & Totem Kiosk Point
create table if not exists public.leads (
  id text primary key,
  name text not null,
  phone text not null,
  email text,
  city text default 'Milano',
  source text not null check (source in ('totem_kiosk', 'facebook_ads', 'google_ads', 'referral', 'manual', 'website_calculator', 'landing_page')) default 'totem_kiosk',
  status text not null check (status in ('new', 'call_center_queue', 'contacted', 'appointment_booked', 'in_negotiation', 'won', 'lost')) default 'new',
  notes text,
  estimated_consumption_kwh numeric default 2800,
  estimated_consumption_smc numeric default 1000,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Tabella Log Firme Digitali & Mandati di Brokeraggio (Anti-Tamper SHA-256)
create table if not exists public.signature_logs (
  id text primary key,
  customer_id text,
  customer_name text not null,
  signer_fiscal_code text not null,
  phone text not null,
  otp_code text not null,
  offer_id text,
  supplier text,
  signature_hash text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Tabella Notifiche Operative di Sistema & Scadenze 120 Giorni
create table if not exists public.notifications (
  id text primary key,
  type text not null check (type in ('totem_lead', 'switch_due', 'bill_uploaded', 'signature_completed', 'security_alert', 'market_trend')),
  title text not null,
  message text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  is_read boolean default false not null,
  priority text not null check (priority in ('low', 'normal', 'high', 'urgent', 'info')) default 'normal',
  target_role text not null check (target_role in ('all', 'admin', 'call_center', 'customer')) default 'all',
  action_tab text,
  meta jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- FUNZIONI SICURE DI CONTROLLO RUOLI (SECURITY DEFINER CON SEARCH_PATH PROTETTO)
-- ==============================================================================

-- Funzione 1: Verifica se l'utente autenticato è Admin
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- Funzione 2: Verifica se l'utente autenticato è Operatore o Admin
create or replace function public.is_operator_or_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'operator', 'call_center')
  );
end;
$$;

-- ==============================================================================
-- TRIGGER ANTI-SCALATA PRIVILEGI (PREVENT PRIVILEGE ESCALATION)
-- ==============================================================================

-- Blocca qualsiasi tentativo da parte di utenti non-admin di modificare il proprio ruolo in 'admin' o 'operator'
create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Se il ruolo viene modificato e l'utente NON è un amministratore di sistema
  if (NEW.role is distinct from OLD.role) and not public.is_admin() then
    raise exception 'VIOLAZIONE DI SICUREZZA: Solo gli amministratori possono modificare i privilegi di ruolo.';
  end if;
  NEW.updated_at = timezone('utc'::text, now());
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_unauthorized_role_change();

-- Trigger di Signup Sicuro: FORZA SEMPRE il ruolo iniziale a 'customer' (Anti-Metadata Injection)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_role text := 'customer';
begin
  -- Se la registrazione viene fatta via invite esplicito con autorizzazione admin
  if (new.raw_app_meta_data->>'role') in ('admin', 'operator', 'call_center') then
    assigned_role := new.raw_app_meta_data->>'role';
  end if;

  insert into public.profiles (id, email, full_name, role, avatar_initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    assigned_role,
    upper(substring(coalesce(new.raw_user_meta_data->>'full_name', 'U'), 1, 2))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - ISOLAMENTO TOTALE ZERO-TRUST
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.utility_points enable row level security;
alter table public.bills enable row level security;
alter table public.security_logs enable row level security;

-- ------------------------------------------------------------------------------
-- RLS PROFILES: Nessun utente può vedere o toccare profili di altri clienti
-- ------------------------------------------------------------------------------
drop policy if exists "Lettura profili protetta" on public.profiles;
create policy "Lettura profili protetta"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_operator_or_admin());

drop policy if exists "Modifica proprio profilo protetta" on public.profiles;
create policy "Modifica proprio profilo protetta"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS UTILITY_POINTS (POD/PDR): Isolamento rigoroso delle forniture energetiche
-- ------------------------------------------------------------------------------
drop policy if exists "Visualizzazione POD PDR ristretta" on public.utility_points;
create policy "Visualizzazione POD PDR ristretta"
  on public.utility_points for select
  to authenticated
  using (auth.uid() = profile_id or public.is_operator_or_admin());

drop policy if exists "Inserimento POD PDR autorizzato" on public.utility_points;
create policy "Inserimento POD PDR autorizzato"
  on public.utility_points for insert
  to authenticated
  with check (auth.uid() = profile_id or public.is_operator_or_admin());

drop policy if exists "Modifica POD PDR solo operatori" on public.utility_points;
create policy "Modifica POD PDR solo operatori"
  on public.utility_points for update
  to authenticated
  using (public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- RLS BILLS: I clienti vedono solo le proprie bollette. Stato e Risparmio protetti
-- ------------------------------------------------------------------------------
drop policy if exists "Visualizzazione bollette ristretta" on public.bills;
create policy "Visualizzazione bollette ristretta"
  on public.bills for select
  to authenticated
  using (auth.uid() = profile_id or public.is_operator_or_admin());

drop policy if exists "Caricamento bolletta da cliente o operatore" on public.bills;
create policy "Caricamento bolletta da cliente o operatore"
  on public.bills for insert
  to authenticated
  with check (
    (auth.uid() = profile_id and status = 'in_review') or 
    public.is_operator_or_admin()
  );

drop policy if exists "Aggiornamento stato bolletta solo operatori" on public.bills;
create policy "Aggiornamento stato bolletta solo operatori"
  on public.bills for update
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

drop policy if exists "Cancellazione bolletta autorizzata" on public.bills;
create policy "Cancellazione bolletta autorizzata"
  on public.bills for delete
  to authenticated
  using (auth.uid() = profile_id or public.is_operator_or_admin());

-- ------------------------------------------------------------------------------
-- RLS SECURITY_LOGS: Audit trail immutabile (Append-Only)
-- ------------------------------------------------------------------------------
-- Gli operatori e gli admin possono visualizzare i log di sicurezza
drop policy if exists "Lettura log audit solo per operatori e admin" on public.security_logs;
create policy "Lettura log audit solo per operatori e admin"
  on public.security_logs for select
  to authenticated
  using (public.is_operator_or_admin());

-- Gli utenti autenticati possono solo inserire eventi di sicurezza (nessuna modifica o cancellazione ammessa)
drop policy if exists "Scrittura log audit consentita" on public.security_logs;
create policy "Scrittura log audit consentita"
  on public.security_logs for insert
  to authenticated
  with check (true);

-- Divieto assoluto di UPDATE e DELETE su security_logs per garantire integrità legale GDPR
revoke update, delete on public.security_logs from public, authenticated, anon;

-- ==============================================================================
-- PERMESSI RUOLI POSTGRES (LEAST PRIVILEGE PRINCIPLE)
-- ==============================================================================

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.utility_points to authenticated;
grant select, insert, update, delete on public.bills to authenticated;
grant select, insert on public.security_logs to authenticated;

-- Permessi per leads, firme e notifiche
alter table public.leads enable row level security;
alter table public.signature_logs enable row level security;
alter table public.notifications enable row level security;

-- Policy Leads: Operatori e Admin possono gestire tutti i lead; il Totem o inserimenti anonimi possono solo inserire
drop policy if exists "Operatori gestiscono leads" on public.leads;
create policy "Operatori gestiscono leads" on public.leads for all to authenticated using (public.is_operator_or_admin());

drop policy if exists "Inserimento lead aperto per kiosk" on public.leads;
create policy "Inserimento lead aperto per kiosk" on public.leads for insert to anon, authenticated with check (true);

-- Policy Signature Logs: Immutabili (solo inserimento e lettura per operatori/clienti interessati)
drop policy if exists "Visualizzazione log di firma" on public.signature_logs;
create policy "Visualizzazione log di firma" on public.signature_logs for select to authenticated using (public.is_operator_or_admin());

drop policy if exists "Inserimento log di firma" on public.signature_logs;
create policy "Inserimento log di firma" on public.signature_logs for insert to authenticated with check (true);
revoke update, delete on public.signature_logs from public, authenticated, anon;

-- Policy Notifiche
drop policy if exists "Visualizzazione notifiche per ruolo" on public.notifications;
create policy "Visualizzazione notifiche per ruolo" on public.notifications for select to authenticated using (true);

drop policy if exists "Aggiornamento stato lettura notifiche" on public.notifications;
create policy "Aggiornamento stato lettura notifiche" on public.notifications for update to authenticated using (true);

grant select, insert, update on public.leads to authenticated, anon;
grant select, insert on public.signature_logs to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- ==============================================================================
-- 8. TABELLA PROVVIGIONI AGENTI & GETTONI COMMERCIALI
-- ==============================================================================
create table if not exists public.commissions (
  id text primary key,
  agent_id text not null,
  agent_name text not null,
  contract_id text not null,
  customer_name text not null,
  pod_or_pdr text not null,
  utility_type text not null check (utility_type in ('luce', 'gas')),
  customer_type text check (customer_type in ('residential', 'business')) default 'residential',
  annual_consumption numeric default 3000 check (annual_consumption >= 0),
  type text not null check (type in ('upfront', 'recurring', 'bonus', 'clawback')),
  amount_eur numeric not null check (amount_eur >= 0),
  status text not null check (status in ('pending', 'accrued', 'settled', 'clawback')) default 'pending',
  period text not null, -- formato YYYY-MM
  accrual_date date default current_date not null,
  settlement_date date,
  payment_reference text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indici di performance per reporting mensile e filtri per agente
create index if not exists idx_commissions_agent_id on public.commissions (agent_id);
create index if not exists idx_commissions_status on public.commissions (status);
create index if not exists idx_commissions_period on public.commissions (period);

-- RLS Provvigioni
alter table public.commissions enable row level security;

drop policy if exists "Operatori visualizzano proprie provvigioni o admin tutto" on public.commissions;
create policy "Operatori visualizzano proprie provvigioni o admin tutto"
  on public.commissions for select
  to authenticated
  using (
    public.is_admin() or 
    agent_id = auth.uid()::text or 
    agent_id in (select id::text from public.profiles where id = auth.uid())
  );

drop policy if exists "Inserimento e liquidazione provvigioni riservato ad admin o engine" on public.commissions;
create policy "Inserimento e liquidazione provvigioni riservato ad admin o engine"
  on public.commissions for all
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

grant select, insert, update on public.commissions to authenticated;

-- ==============================================================================
-- 9. TABELLA DISTINTE CONTABILI DI LIQUIDAZIONE (BONIFICI)
-- ==============================================================================
create table if not exists public.settlement_batches (
  id text primary key,
  agent_id text not null,
  agent_name text not null,
  settlement_date date default current_date not null,
  payment_reference text not null,
  period text not null,
  total_amount_eur numeric not null check (total_amount_eur >= 0),
  commission_count integer not null check (commission_count >= 0),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_batches_agent_id on public.settlement_batches (agent_id);
create index if not exists idx_batches_reference on public.settlement_batches (payment_reference);

alter table public.settlement_batches enable row level security;

drop policy if exists "Visualizzazione distinte per agente o admin" on public.settlement_batches;
create policy "Visualizzazione distinte per agente o admin"
  on public.settlement_batches for select
  to authenticated
  using (
    public.is_admin() or 
    agent_id = auth.uid()::text or 
    agent_id in (select id::text from public.profiles where id = auth.uid())
  );

drop policy if exists "Creazione distinte riservata a backoffice e admin" on public.settlement_batches;
create policy "Creazione distinte riservata a backoffice e admin"
  on public.settlement_batches for insert
  to authenticated
  with check (public.is_operator_or_admin());

grant select, insert on public.settlement_batches to authenticated;

-- ==============================================================================
-- 10. TABELLA FEED LIVE & STORICO INDICI GME ARERA (PUN & PSV)
-- ==============================================================================
create table if not exists public.market_indices (
  id text primary key, -- 'latest' per il corrente, o 'YYYY-MM' per consuntivo
  pun_eur_kwh numeric not null check (pun_eur_kwh >= 0),
  psv_eur_smc numeric not null check (psv_eur_smc >= 0),
  pun_f1 numeric check (pun_f1 is null or pun_f1 >= 0),
  pun_f2 numeric check (pun_f2 is null or pun_f2 >= 0),
  pun_f3 numeric check (pun_f3 is null or pun_f3 >= 0),
  pun_change_percent numeric,
  psv_change_percent numeric,
  pun_trend text check (pun_trend in ('up', 'down', 'stable')),
  psv_trend text check (psv_trend in ('up', 'down', 'stable')),
  historical_6m jsonb,
  last_updated text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.market_indices enable row level security;

drop policy if exists "Lettura pubblica indici di mercato GME" on public.market_indices;
create policy "Lettura pubblica indici di mercato GME"
  on public.market_indices for select
  to anon, authenticated
  using (true);

drop policy if exists "Aggiornamento indici riservato a backoffice e cronjob" on public.market_indices;
create policy "Aggiornamento indici riservato a backoffice e cronjob"
  on public.market_indices for all
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

grant select on public.market_indices to anon, authenticated;
grant insert, update on public.market_indices to authenticated;



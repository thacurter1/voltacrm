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
  contract_start_date date default current_date,
  last_switch_audit_date date default current_date,
  next_switch_audit_date date default (current_date + interval '120 days'),
  has_brokerage_mandate boolean default true not null,
  deleted_at timestamp with time zone,
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
  f1_kwh numeric check (f1_kwh is null or f1_kwh >= 0),
  f2_kwh numeric check (f2_kwh is null or f2_kwh >= 0),
  f3_kwh numeric check (f3_kwh is null or f3_kwh >= 0),
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
  status text not null check (status in ('new', 'call_center_queue', 'contacted', 'appointment_booked', 'in_negotiation', 'contract_signed', 'unreachable', 'won', 'lost')) default 'new',
  assigned_call_center_agent text,
  appointment_id text,
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
  signature_type text default 'otp' check (signature_type in ('otp', 'canvas')),
  canvas_hash text,
  ip_address text,
  offer_id text,
  supplier text,
  signature_hash text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Tabella Notifiche Operative di Sistema & Scadenze 120 Giorni
create table if not exists public.notifications (
  id text primary key,
  user_id text,
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

-- 8. Tabella Clienti & Contratti CRM (Persistenza ID cust-* e Forniture UtilityPoints)
create table if not exists public.customers (
  id text primary key,
  name text not null,
  fiscal_code text not null,
  phone text not null,
  email text,
  city text default 'Milano',
  contract_start_date date default current_date,
  last_switch_audit_date date default current_date,
  next_switch_audit_date date default (current_date + interval '120 days'),
  has_brokerage_mandate boolean default true not null,
  account_manager text default 'Matteo Riva',
  notes text,
  utility_points jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
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

-- Gli utenti autenticati possono solo inserire eventi di sicurezza associati alla propria identità
drop policy if exists "Scrittura log audit consentita" on public.security_logs;
create policy "Scrittura log audit consentita"
  on public.security_logs for insert
  to authenticated
  with check (
    user_email = (select email from auth.users where id = auth.uid()) or
    public.is_operator_or_admin()
  );

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

-- Policy Signature Logs: Immutabili (lettura per operatori o per il cliente intestatario del contratto)
drop policy if exists "Visualizzazione log di firma" on public.signature_logs;
create policy "Visualizzazione log di firma" on public.signature_logs for select to authenticated 
  using (public.is_operator_or_admin() or customer_id = auth.uid()::text);

drop policy if exists "Inserimento log di firma" on public.signature_logs;
create policy "Inserimento log di firma" on public.signature_logs for insert to authenticated with check (true);
revoke update, delete on public.signature_logs from public, authenticated, anon;

-- Policy Notifiche: Accesso isolato per proprietario o per ruolo autorizzato (previene data leakage)
drop policy if exists "Visualizzazione notifiche per ruolo" on public.notifications;
drop policy if exists "Visualizzazione notifiche per ruolo o proprietario" on public.notifications;
create policy "Visualizzazione notifiche per ruolo o proprietario" on public.notifications for select to authenticated 
  using (
    user_id = auth.uid()::text or 
    target_role = 'all' or 
    (target_role in ('admin', 'call_center', 'operator') and public.is_operator_or_admin())
  );

drop policy if exists "Aggiornamento stato lettura notifiche" on public.notifications;
drop policy if exists "Aggiornamento stato lettura notifiche proprietario" on public.notifications;
create policy "Aggiornamento stato lettura notifiche proprietario" on public.notifications for update to authenticated 
  using (
    user_id = auth.uid()::text or 
    public.is_operator_or_admin()
  );

grant select, insert, update on public.leads to authenticated, anon;
grant select, insert on public.signature_logs to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- Policy Customers: Operatori e Admin gestiscono tutte le anagrafiche, il cliente legge solo la propria
alter table public.customers enable row level security;
drop policy if exists "Operatori gestiscono customers o cliente legge proprio" on public.customers;
create policy "Operatori gestiscono customers o cliente legge proprio"
  on public.customers for all to authenticated
  using (
    public.is_operator_or_admin() or 
    id in (select customer_id from public.profiles where id = auth.uid()) or
    phone = (select phone from public.profiles where id = auth.uid())
  )
  with check (public.is_operator_or_admin());

grant select, insert, update on public.customers to authenticated;

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

-- ==============================================================================
-- 11. INDICI PER QUERY DI PERFORMANCE E FILTRI FREQUENTI
-- ==============================================================================
create index if not exists idx_utility_points_profile_id on public.utility_points (profile_id);
create index if not exists idx_utility_points_pod_or_pdr on public.utility_points (pod_or_pdr);
create index if not exists idx_bills_profile_id on public.bills (profile_id);
create index if not exists idx_bills_status on public.bills (status);
create index if not exists idx_leads_status on public.leads (status);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_fiscal_code on public.profiles (fiscal_code);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_notifications_target_role on public.notifications (target_role);
create index if not exists idx_customers_fiscal_code on public.customers (fiscal_code);
create index if not exists idx_customers_next_audit on public.customers (next_switch_audit_date);
create index if not exists idx_commissions_contract_id on public.commissions (contract_id);
create unique index if not exists uq_commissions_idempotency on public.commissions (contract_id, pod_or_pdr, type, period);

-- ==============================================================================
-- 12. TABELLA AGENDA APPUNTAMENTI CONSULENTI / OPERATORI
-- ==============================================================================
create table if not exists public.appointments (
  id uuid default gen_random_uuid() primary key,
  lead_id text references public.leads(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  agent_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('call', 'in_person', 'video', 'consultation')),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
  scheduled_at timestamp with time zone not null,
  duration_minutes integer default 30 check (duration_minutes > 0),
  location text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.appointments enable row level security;

drop policy if exists "Operatori e staff gestiscono agenda appuntamenti" on public.appointments;
create policy "Operatori e staff gestiscono agenda appuntamenti"
  on public.appointments for all
  to authenticated
  using (public.is_operator_or_admin())
  with check (public.is_operator_or_admin());

grant select, insert, update, delete on public.appointments to authenticated;

create index if not exists idx_appointments_agent on public.appointments (agent_id);
create index if not exists idx_appointments_scheduled_at on public.appointments (scheduled_at);
create index if not exists idx_appointments_status on public.appointments (status);

-- Indice GIN per ricerche ad alte prestazioni sui codici POD e PDR all'interno del JSONB utility_points
create index if not exists idx_cust_utility_points_gin on public.customers using gin (utility_points);


-- ==============================================================================
-- 13. TABELLA IDEMPOTENZA GENERAZIONI PROVVIGIONALI
-- ==============================================================================
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

-- Collegamenti e indici referenziali su commissions
alter table public.commissions
  add column if not exists generation_id text references public.commission_generations(id),
  add column if not exists settlement_batch_id text references public.settlement_batches(id);

create index if not exists idx_commissions_generation_id on public.commissions (generation_id);
create index if not exists idx_commissions_settlement_batch_id on public.commissions (settlement_batch_id);

-- ==============================================================================
-- 14. TABELLE PORTALE CLIENTI: BOLLETTE E AUTOLETTURE DURABILI
-- ==============================================================================
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
  ocr_result jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.portal_bills enable row level security;
drop policy if exists "Clienti visualizzano proprie bollette o staff tutto" on public.portal_bills;
create policy "Clienti visualizzano proprie bollette o staff tutto"
  on public.portal_bills for select
  to authenticated
  using (
    public.is_operator_or_admin() or
    customer_id in (select customer_id from public.profiles where id = auth.uid())
  );

create table if not exists public.meter_readings (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  utility_point_id text not null,
  utility_type text not null check (utility_type in ('luce', 'gas')),
  readings jsonb not null,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.meter_readings enable row level security;
drop policy if exists "Clienti gestiscono proprie letture o staff tutto" on public.meter_readings;
create policy "Clienti gestiscono proprie letture o staff tutto"
  on public.meter_readings for all
  to authenticated
  using (
    public.is_operator_or_admin() or
    customer_id in (select customer_id from public.profiles where id = auth.uid())
  );

-- ==============================================================================
-- 15. FUNZIONI ATOMICHE E TRIGGER (ATTIVAZIONE FIRMA, SWITCH 120GG, PROVVIGIONI)
-- ==============================================================================

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

    if v_is_dual_fuel and not exists (
      select 1 from public.commissions c
      where (c.contract_id = v_contract_id or lower(c.customer_name) = lower(v_customer_name))
        and c.type = 'bonus'
        and c.period = v_period
    ) then
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
        p_annual_consumption, 'recurring', v_recurring, 'accrued', v_period, current_date,
        'Mantenimento portafoglio mese (' || p_annual_consumption::text || ' ' || case when v_utility_type = 'luce' then 'kWh' else 'Smc' end || '/anno)',
        v_generation_id
      )
      on conflict (contract_id, pod_or_pdr, type, period)
      do update set generation_id = excluded.generation_id
        where public.commissions.agent_id = excluded.agent_id;
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(comm.*)), '[]'::jsonb),
         coalesce(sum(comm.amount_eur), 0)
    into v_records, v_total
    from public.commissions comm
   where comm.contract_id = v_contract_id
     and comm.pod_or_pdr = v_pod_or_pdr
     and comm.period = v_period
     and comm.agent_id = v_agent_id;

  return jsonb_build_object(
    'records', v_records,
    'totalEur', round(v_total, 2)
  );
end;
$$;

revoke all on function public.generate_contract_commissions(text, text, text, text, text, text, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.generate_contract_commissions(text, text, text, text, text, text, text, numeric, boolean) to service_role;

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

revoke all on function public.settle_commissions(text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.settle_commissions(text, text[], text, text, text) to service_role;

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

revoke all on function public.activate_signature_with_commissions(text, text, date, text, text, text, text, text, text, text, numeric, boolean) from public, anon, authenticated;
grant execute on function public.activate_signature_with_commissions(text, text, date, text, text, text, text, text, text, text, numeric, boolean) to service_role;

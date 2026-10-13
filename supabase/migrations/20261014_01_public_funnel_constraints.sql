-- Migration: 20261014_01_public_funnel_constraints.sql
-- Description: Align CHECK constraints for public funnel lead intake and real-time notifications,
-- and extend is_operator_or_admin() to include the 'broker' role.

-- 1. Aggiorna vincolo CHECK su public.leads.source per supportare il comparatore pubblico e l'upload bolletta guest
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check
  check (source in (
    'totem_kiosk',
    'facebook_ads',
    'google_ads',
    'referral',
    'manual',
    'website_calculator',
    'landing_page',
    'public_comparator',
    'bill_upload'
  ));

-- 2. Aggiorna vincolo CHECK su public.notifications.type per supportare richieste consulenza e notifiche di prezzo
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'totem_lead',
    'switch_due',
    'bill_uploaded',
    'signature_completed',
    'security_alert',
    'market_trend',
    'consultation_requested',
    'price_drop'
  ));

-- 3. Aggiorna vincolo CHECK su public.notifications.target_role per includere 'broker' e 'operator'
alter table public.notifications drop constraint if exists notifications_target_role_check;
alter table public.notifications add constraint notifications_target_role_check
  check (target_role in ('all', 'admin', 'call_center', 'customer', 'broker', 'operator'));

-- 4. Aggiorna la funzione di controllo ruoli RLS per includere il ruolo 'broker'
create or replace function public.is_operator_or_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'operator', 'call_center', 'broker')
  );
end;
$$;

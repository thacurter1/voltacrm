begin;

create or replace function public.update_customer_contact(
  p_actor_id text,
  p_customer_id text,
  p_contact jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.crm_accounts%rowtype;
  v_customer public.customers%rowtype;
  v_email text := lower(btrim(p_contact->>'email'));
begin
  select * into v_actor from public.crm_accounts where id = p_actor_id for update;
  if not found then raise exception 'Actor account not found'; end if;
  if v_actor.role = 'customer' and v_actor.customer_id is distinct from p_customer_id then
    raise exception 'Customer ownership mismatch';
  end if;
  if v_actor.role not in ('admin', 'operator', 'call_center', 'customer') then
    raise exception 'Role not allowed';
  end if;
  if nullif(v_email, '') is null then raise exception 'Email is required'; end if;
  if exists(select 1 from public.crm_accounts where lower(trim(email)) = v_email and customer_id is distinct from p_customer_id) then
    raise exception 'Email already registered' using errcode = '23505';
  end if;

  update public.customers
     set phone = btrim(p_contact->>'phone'),
         email = v_email,
         city = btrim(p_contact->>'city'),
         updated_at = timezone('utc', now())
   where id = p_customer_id
   returning * into v_customer;
  if not found then raise exception 'Customer not found'; end if;

  update public.crm_accounts
     set email = v_email,
         profile = profile || jsonb_build_object(
           'email', v_email,
           'phone', btrim(p_contact->>'phone')
         )
   where customer_id = p_customer_id;

  return to_jsonb(v_customer);
end;
$$;

revoke all on function public.update_customer_contact(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_customer_contact(text, text, jsonb) to service_role;

commit;

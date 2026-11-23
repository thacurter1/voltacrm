/**
 * Resolves which entry surface the URL asks for, before any session state is considered.
 *
 * - `/`                  -> null (public landing / comparator)
 * - `/?portal=home`      -> 'home' (portal hub)
 * - `/?portal=customer`  -> 'customer' (customer login/registration gate)
 * - `/?portal=staff`     -> 'staff' (staff login gate)
 *
 * Legacy aliases (`?app=` / `?mode=`, `?login=`), dedicated subdomains and
 * `/clienti` `/staff` paths resolve to the same intents.
 *
 * Kept dependency-free so it can be exercised directly from Node tests.
 */
export type PortalIntent = 'home' | 'customer' | 'staff' | 'totem' | null;

export interface PortalLocation {
  search: string;
  hostname: string;
  pathname: string;
}

const CUSTOMER_ALIASES = new Set(['customer', 'cliente', 'clienti']);
const STAFF_ALIASES = new Set(['staff', 'crm']);

export function resolvePortalIntent(location: PortalLocation): PortalIntent {
  const params = new URLSearchParams(location.search || '');
  const host = (location.hostname || '').toLowerCase();
  const pathname = (location.pathname || '/').toLowerCase();

  const portal = (params.get('portal') || '').trim().toLowerCase();
  if (portal === 'home') return 'home';
  if (portal === 'totem') return 'totem';
  if (CUSTOMER_ALIASES.has(portal)) return 'customer';
  if (STAFF_ALIASES.has(portal)) return 'staff';

  const login = (params.get('login') || '').trim().toLowerCase();
  if (login === 'customer') return 'customer';
  if (login === 'true' || login === 'staff') return 'staff';

  const legacy = (params.get('app') || params.get('mode') || '').trim().toLowerCase();
  if (CUSTOMER_ALIASES.has(legacy)) return 'customer';
  if (STAFF_ALIASES.has(legacy)) return 'staff';

  if (
    host.startsWith('clienti.') || host.startsWith('clienti-') ||
    host.startsWith('cliente.') || host.startsWith('cliente-') ||
    pathname === '/clienti' || pathname === '/cliente'
  ) return 'customer';

  if (
    host.startsWith('staff.') || host.startsWith('staff-') ||
    host.startsWith('crm.') || host.startsWith('crm-') ||
    pathname === '/staff' || pathname === '/crm'
  ) return 'staff';

  return null;
}

export function currentPortalIntent(): PortalIntent {
  if (typeof window === 'undefined') return null;
  return resolvePortalIntent(window.location);
}

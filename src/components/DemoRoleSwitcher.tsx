import React from 'react';
import { DEMO_USERS, dbService } from '../services/db';
import { INITIAL_CUSTOMERS } from '../services/mockData';
import { AuthUser, Customer } from '../types';

interface DemoRoleSwitcherProps {
  currentUser: AuthUser;
  customers: Customer[];
  onSelectUser: (user: any) => void;
  onOpenTotem?: () => void;
  onLogout: () => void;
}

export const DemoRoleSwitcher: React.FC<DemoRoleSwitcherProps> = ({
  currentUser,
  customers,
  onSelectUser,
  onOpenTotem,
  onLogout,
}) => {
  const handleSwitch = (value: string) => {
    if (!value) return;
    if (value === '__totem__') {
      onOpenTotem?.();
      return;
    }
    if (value === '__logout__') {
      onLogout();
      return;
    }

    const [role, userId] = value.split(':');
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
        localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
        const url = new URL(window.location.href);
        if (url.searchParams.has('portal')) {
          url.searchParams.set('portal', role === 'customer' ? 'customer' : 'staff');
        }
        if (url.searchParams.has('demo_user')) {
          url.searchParams.set('demo_user', role === 'customer' ? `user-${userId}` : userId);
        }
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch {}
    }

    if (role === 'customer') {
      const stored = dbService.load();
      const cust =
        customers.find((c) => c.id === userId) ||
        stored.customers.find((c) => c.id === userId) ||
        INITIAL_CUSTOMERS.find((c) => c.id === userId);
      if (cust) {
        if (!stored.customers.some((c) => c.id === cust.id)) {
          dbService.save({ ...stored, customers: [...stored.customers, cust] });
        }
        const custUser = {
          id: `user-${cust.id}`,
          name: cust.name,
          email: cust.email,
          role: 'customer' as const,
          customerId: cust.id,
          avatar: cust.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
          is2faEnabled: false,
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-cust-token-${cust.id}-${Date.now()}`);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(custUser));
          } catch {}
        }
        onSelectUser(custUser);
      }
      return;
    }

    const matched = DEMO_USERS.find((u) => u.id === userId) || DEMO_USERS[0];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-${matched.id}-${Date.now()}`);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
      } catch {}
    }
    onSelectUser(matched);
  };

  const currentValue = `${currentUser.role}:${currentUser.customerId || currentUser.id}`;

  return (
    <div className="flex items-center shrink-0">
      <label htmlFor="staff-demo-role-select" className="sr-only">
        Cambia profilo dimostrativo
      </label>
      <select
        id="staff-demo-role-select"
        value={currentValue}
        onChange={(e) => handleSwitch(e.target.value)}
        aria-label="Selettore profilo dimostrativo"
        className="h-8 px-2.5 max-w-[160px] rounded-md bg-[#072B2F] border border-white/25 text-white text-xs font-semibold cursor-pointer whitespace-nowrap truncate focus:outline-none focus:ring-2 focus:ring-[#34D399]"
      >
        <option value="admin:user-admin-1">Demo: Admin (M. Riva)</option>
        <option value="broker:user-op-3">Demo: Broker (V. Neri)</option>
        <option value="operator:user-op-2">Demo: Operatore</option>
        <option value="call_center:user-cc-4">Demo: Call Center</option>
        <option value="customer:cust-1">Demo: Cliente Privato</option>
        <option value="customer:cust-2">Demo: Cliente Business</option>
        {onOpenTotem && <option value="__totem__">Apri Totem Demo</option>}
        <option value="__logout__">Esci da Demo</option>
      </select>
    </div>
  );
};

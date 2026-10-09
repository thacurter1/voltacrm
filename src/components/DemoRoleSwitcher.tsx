import React, { useState } from 'react';
import { DEMO_USERS } from '../services/db';
import { AuthUser, Customer } from '../types';
import { Sparkles, ChevronDown, ChevronUp, LogOut, Monitor } from 'lucide-react';

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
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  const handleSwitch = (userId: string, role: string) => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
        localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
      } catch {}
    }
    if (role === 'customer') {
      const cust = customers.find(c => c.id === userId) || customers[0];
      if (cust) {
        const custUser = {
          id: `user-${cust.id}`,
          name: cust.name,
          email: cust.email,
          role: 'customer' as const,
          customerId: cust.id,
          avatar: cust.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
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

    const matched = DEMO_USERS.find(u => u.id === userId) || DEMO_USERS[0];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-${matched.id}-${Date.now()}`);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
      } catch {}
    }
    onSelectUser(matched);
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-3 right-4 z-50 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40 shadow-xl text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition-all hover:scale-105"
        title="Apri selettore rapido ruoli Demo"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span>Switch Demo ({currentUser.role})</span>
        <ChevronUp className="w-3 h-3 text-slate-400" />
      </button>
    );
  }

  return (
    <aside 
      aria-label="Selettore rapido ruoli demo"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 max-w-[95vw] bg-slate-950/95 text-white border border-indigo-500/40 rounded-2xl px-3 py-2 shadow-2xl backdrop-blur-md flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap text-xs"
    >
      <div className="flex items-center gap-1.5 text-amber-300 font-extrabold text-[11px] uppercase tracking-wider pr-1 border-r border-white/10 shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
        <span className="hidden sm:inline">1-Click Demo:</span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
        {/* Admin */}
        <button
          type="button"
          onClick={() => handleSwitch('user-admin-1', 'admin')}
          className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            currentUser.role === 'admin'
              ? 'bg-[#635bff] text-white shadow-xs ring-1 ring-white/30'
              : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <span>👑</span>
          <span className="hidden md:inline">Admin (Riva)</span>
          <span className="md:hidden">Admin</span>
        </button>

        {/* Broker */}
        <button
          type="button"
          onClick={() => handleSwitch('user-op-3', 'broker')}
          className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            currentUser.role === 'broker'
              ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-white/30'
              : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <span>💼</span>
          <span className="hidden md:inline">Broker (Neri)</span>
          <span className="md:hidden">Broker</span>
        </button>

        {/* Operatore */}
        <button
          type="button"
          onClick={() => handleSwitch('user-op-2', 'operator')}
          className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            currentUser.role === 'operator'
              ? 'bg-sky-600 text-white shadow-xs ring-1 ring-white/30'
              : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <span>🎧</span>
          <span className="hidden md:inline">Operatore</span>
          <span className="md:hidden">Op</span>
        </button>

        {/* Call Center */}
        <button
          type="button"
          onClick={() => handleSwitch('user-cc-4', 'call_center')}
          className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            currentUser.role === 'call_center'
              ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-white/30'
              : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <span>📞</span>
          <span className="hidden md:inline">Call Center</span>
          <span className="md:hidden">CC</span>
        </button>

        {/* Cliente Privato */}
        <button
          type="button"
          onClick={() => handleSwitch('cust-1', 'customer')}
          className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            currentUser.role === 'customer' && currentUser.customerId === 'cust-1'
              ? 'bg-[#00d4aa] text-slate-950 shadow-xs ring-1 ring-white/30'
              : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <span>👤</span>
          <span className="hidden md:inline">Cliente (Moretti)</span>
          <span className="md:hidden">Cliente</span>
        </button>

        {/* Cliente B2B */}
        <button
          type="button"
          onClick={() => handleSwitch('cust-2', 'customer')}
          className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            currentUser.role === 'customer' && currentUser.customerId === 'cust-2'
              ? 'bg-[#00d4aa] text-slate-950 shadow-xs ring-1 ring-white/30'
              : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
          }`}
        >
          <span>🏢</span>
          <span className="hidden md:inline">B2B (La Terrazza)</span>
          <span className="md:hidden">B2B</span>
        </button>

        {/* Totem */}
        {onOpenTotem && (
          <button
            type="button"
            onClick={onOpenTotem}
            className="px-2.5 py-1 rounded-xl font-bold text-[11px] bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden md:inline">Totem</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 pl-1 border-l border-white/10 shrink-0">
        <button
          type="button"
          onClick={onLogout}
          className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
          title="Esci al Portale di Login"
          aria-label="Esci"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
          title="Riduci a icona"
          aria-label="Riduci a icona"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

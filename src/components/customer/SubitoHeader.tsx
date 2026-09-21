import React from 'react';
import { Search, Upload, Zap, Flame, Sparkles, Home, FileText, ShieldCheck } from 'lucide-react';
import { NotificationCenter } from '../NotificationCenter';
import { INITIAL_PROFILES } from '../../services/supabaseClient';

interface SubitoHeaderProps {
  category: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onUploadBill: () => void;
  customerName: string;
  customers: Array<{ id: string; name: string; city?: string }>;
  selectedCustomerId: string;
  onSelectCustomer: (id: string) => void;
  activeView: 'marketplace' | 'supplies';
  onSelectView: (view: 'marketplace' | 'supplies') => void;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  onReturnToBackend?: () => void;
}

export const SubitoHeader: React.FC<SubitoHeaderProps> = ({
  category,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onUploadBill,
  customerName,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  activeView,
  onSelectView,
  onToast,
  onReturnToBackend,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectView('marketplace')}>
            <span className="font-black text-2xl tracking-tighter text-[#e02424]">subito</span>
            <span className="text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-red-100 text-[#e02424]">
              energia
            </span>
          </div>
          <span className="hidden md:inline-block text-xs text-slate-400 border-l border-slate-200 pl-3">
            Il marketplace delle migliori tariffe luce e gas certificate
          </span>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => onSelectView('marketplace')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'marketplace'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#e02424]" />
              <span>Offerte</span>
            </button>
            <button
              onClick={() => onSelectView('supplies')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'supplies'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Le mie forniture</span>
            </button>
          </div>

          <NotificationCenter
            userRole="customer"
            onToast={onToast}
            onNavigateTab={(tab) => onSelectView(tab === 'supplies' || tab === 'inbox_bills' ? 'supplies' : 'marketplace')}
          />

          {/* Mobile CTA (Carica bolletta) */}
          <button
            type="button"
            onClick={onUploadBill}
            className="sm:hidden p-2 rounded-xl bg-[#e02424] hover:bg-[#c81e1e] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            title="Carica la tua bolletta"
            aria-label="Carica la tua bolletta"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Primary CTA (Inserisci / Carica bolletta) */}
          <button
            type="button"
            onClick={onUploadBill}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e02424] hover:bg-[#c81e1e] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Carica la tua bolletta</span>
          </button>

          {/* Customer Switcher (demo) */}
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="hidden xl:inline text-xs font-semibold text-slate-700">Ciao, {customerName.split(' ')[0]}</span>
            <select
              value={selectedCustomerId}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-red-400"
              title="Cambia cliente demo"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onReturnToBackend) {
                onReturnToBackend();
              } else {
                const adminUser = INITIAL_PROFILES[0];
                if (typeof window !== 'undefined') {
                  localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(adminUser));
                  localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-admin-${Date.now()}`);
                  try {
                    const raw = localStorage.getItem('VOLTA_ENERGY_CRM_DB_V3');
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      parsed.currentUser = adminUser;
                      localStorage.setItem('VOLTA_ENERGY_CRM_DB_V3', JSON.stringify(parsed));
                    }
                  } catch {}
                  const url = new URL(window.location.href);
                  url.searchParams.delete('app');
                  url.searchParams.delete('mode');
                  window.location.href = url.pathname || '/';
                }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a2540] hover:bg-[#1a385c] text-white text-xs font-bold transition shadow-xs cursor-pointer border border-[#635bff]/40 active:scale-95"
            title="Passa al Backend Gestionale Volta Energia (Staff & Broker)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#635bff]" />
            <span className="font-bold">Torna al Backend CRM</span>
          </button>
        </div>
      </div>

      {/* Subito Search and Category Bar */}
      {activeView === 'marketplace' && (
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-3 justify-between">
            {/* Search Box */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cosa cerchi? Cerca tariffa o fornitore..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#e02424] focus:ring-1 focus:ring-[#e02424] shadow-2xs"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Tutte le Offerte', icon: Home },
                { id: 'luce', label: 'Luce', icon: Zap },
                { id: 'gas', label: 'Gas', icon: Flame },
                { id: 'dual', label: 'Dual Fuel', icon: Sparkles },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => onSelectCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#e02424] text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

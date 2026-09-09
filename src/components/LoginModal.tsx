import React, { useState } from 'react';
import { 
  Headphones, 
  User, 
  Zap, 
  X
} from 'lucide-react';
import { AuthUser, Customer } from '../types';
import { DEMO_USERS } from '../services/db';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: AuthUser) => void;
  onRequire2FA: (user: AuthUser) => void;
  customers: Customer[];
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  onRequire2FA,
  customers,
}) => {
  const [activeTab, setActiveTab] = useState<'call_center' | 'customer'>('call_center');
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || 'cust-1');

  if (!isOpen) return null;

  const handleCustomerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = customers.find(c => c.id === selectedCustomerId);
    if (matched) {
      const user: AuthUser = {
        id: `user-${matched.id}`,
        name: matched.name,
        email: matched.email,
        role: 'customer',
        customerId: matched.id,
        avatar: matched.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        is2faEnabled: false,
      };
      onSelectUser(user);
      onClose();
    }
  };

  const handleCallCenterLogin = () => {
    const user = DEMO_USERS[0];
    if (user.is2faEnabled) {
      onClose();
      onRequire2FA(user);
    } else {
      onSelectUser(user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex items-center justify-center">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/50 backdrop-blur-xs transition-opacity" 
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] p-6 space-y-6 animate-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#635bff] flex items-center justify-center text-white shadow-xs">
              <Zap className="h-4 w-4 fill-white text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0a2540]">Accedi a VoltaCRM</h3>
              <p className="text-[11px] text-[#425466]">Scegli l'ambiente in base al tuo ruolo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-1 rounded-xl bg-slate-100 border border-[#e3e8ee] grid grid-cols-2 gap-1 font-semibold">
          <button
            onClick={() => setActiveTab('call_center')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'call_center' 
                ? 'bg-white text-[#0a2540] shadow-xs' 
                : 'text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <Headphones className="h-3.5 w-3.5 text-[#635bff]" />
            Backend Call Center
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'customer' 
                ? 'bg-white text-[#0a2540] shadow-xs' 
                : 'text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <User className="h-3.5 w-3.5 text-emerald-600" />
            Frontend Cliente
          </button>
        </div>

        {/* TAB 1: CALL CENTER LOGIN */}
        {activeTab === 'call_center' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[#425466] leading-relaxed">
              <span className="font-bold text-[#0a2540] block mb-0.5">Area Riservata Operatori & Commerciali</span>
              Include Lead Marketing, Agenda appuntamenti, Audit contratti a 120 giorni e OCR bollette.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[#425466] font-medium block mb-1">Email Aziendale</label>
                <input
                  type="email"
                  readOnly
                  value="m.riva@voltagroup.it"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-mono"
                />
              </div>

              <div>
                <label className="text-[#425466] font-medium block mb-1">Password</label>
                <input
                  type="password"
                  readOnly
                  value="••••••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540]"
                />
              </div>
            </div>

            <button
              onClick={handleCallCenterLogin}
              className="w-full py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Headphones className="h-4 w-4" />
              Accedi al Backend Call Center
            </button>
          </div>
        )}

        {/* TAB 2: CUSTOMER LOGIN */}
        {activeTab === 'customer' && (
          <form onSubmit={handleCustomerLogin} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-slate-700 leading-relaxed">
              <span className="font-bold text-[#0a2540] block mb-0.5">Area Riservata Cliente Finale</span>
              Permette al cliente di vedere le proprie forniture, caricare la bolletta e accettare offerte migliorative.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[#425466] font-medium block mb-1">Seleziona Profilo Cliente (Demo)</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city} • {c.fiscalCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <User className="h-4 w-4" />
              Accedi al Portale Cliente
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

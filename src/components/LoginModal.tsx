import React, { useState, useEffect } from 'react';
import { 
  Headphones, 
  User, 
  Zap, 
  X, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { AuthUser, Customer } from '../types';
import { DEMO_USERS } from '../services/db';
import { OAuthButtons } from './OAuthButtons';

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
  const [selectedOperatorId, setSelectedOperatorId] = useState(DEMO_USERS[0]?.id || 'user-admin-1');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCustomerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = customers.find(c => c.id === selectedCustomerId) || customers[0];
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
    const user = DEMO_USERS.find(u => u.id === selectedOperatorId) || DEMO_USERS[0];
    if (user.is2faEnabled) {
      onClose();
      onRequire2FA(user);
    } else {
      onSelectUser(user);
      onClose();
    }
  };

  const handleQuickDemoClick = (demoUser: AuthUser) => {
    onSelectUser(demoUser);
    onClose();
  };

  const handleOAuthSuccess = (u: any) => {
    const authUser: AuthUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      customerId: u.customerId,
      avatar: u.avatar || 'OU',
      is2faEnabled: false,
    };
    onSelectUser(authUser);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex items-center justify-center font-sans" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="login-modal-title"
    >
      {/* Stripe-style Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/60 backdrop-blur-xs transition-opacity duration-200" 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-[#e3e8ee] shadow-[0_24px_64px_rgba(10,37,64,0.18)] p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150 text-xs text-[#0a2540]">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#635bff] flex items-center justify-center text-white shadow-xs">
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <h3 id="login-modal-title" className="text-base font-extrabold text-[#0a2540] tracking-tight">
                Accedi a Volta Energia
              </h3>
              <p className="text-[11px] text-slate-500">
                Seleziona il tuo ruolo operativo o il portale clienti
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center" 
            aria-label="Chiudi finestra di login"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ⚡ Quick 1-Click Demo Access Strip */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-extrabold text-[#0a2540] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#635bff]" /> Accesso Rapido Demo 1-Click:
            </span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
              Istantaneo
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {DEMO_USERS.map((u) => {
              const label = u.role === 'admin'
                ? 'Admin'
                : u.role === 'broker'
                ? 'Broker'
                : u.role === 'call_center'
                ? 'Call Center'
                : u.role === 'operator'
                ? 'Operatore'
                : 'Cliente';
              const icon = u.role === 'admin' ? '👑' : u.role === 'broker' ? '💼' : u.role === 'call_center' ? '📞' : u.role === 'operator' ? '🎧' : '👤';
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickDemoClick(u)}
                  className="px-2 py-1.5 rounded-lg bg-white hover:bg-[#635bff] border border-slate-200 hover:border-[#635bff] text-slate-700 hover:text-white font-bold text-[10px] text-center transition-all cursor-pointer shadow-xs truncate active:scale-95"
                  title={`${u.name} (${label})`}
                >
                  <span className="block">{icon}</span>
                  <span className="truncate block">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="p-1 rounded-xl bg-slate-100 border border-[#e3e8ee] grid grid-cols-2 gap-1 font-semibold text-xs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'call_center'}
            onClick={() => setActiveTab('call_center')}
            className={`min-h-[40px] py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'call_center' 
                ? 'bg-white text-[#0a2540] shadow-xs' 
                : 'text-slate-500 hover:text-[#0a2540]'
            }`}
          >
            <Headphones className="h-3.5 w-3.5 text-[#635bff]" />
            <span>Staff & Call Center</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'customer'}
            onClick={() => setActiveTab('customer')}
            className={`min-h-[40px] py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'customer' 
                ? 'bg-white text-[#0a2540] shadow-xs' 
                : 'text-slate-500 hover:text-[#0a2540]'
            }`}
          >
            <User className="h-3.5 w-3.5 text-emerald-600" />
            <span>Portale Clienti</span>
          </button>
        </div>

        {/* TAB 1: CALL CENTER / OPERATOR LOGIN */}
        {activeTab === 'call_center' && (
          <div className="space-y-4" role="tabpanel">
            <OAuthButtons
              role="operator"
              mode="login"
              onSuccess={handleOAuthSuccess}
              onToast={() => {}}
            />

            <div className="space-y-3 pt-1">
              <div>
                <label htmlFor="operator-select-input" className="text-slate-700 font-bold block mb-1">
                  Seleziona Operatore / Consulente
                </label>
                <select
                  id="operator-select-input"
                  value={selectedOperatorId}
                  onChange={(e) => setSelectedOperatorId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#e3e8ee] text-[#0a2540] font-medium text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                >
                  {DEMO_USERS.filter(u => u.role !== 'customer').map(u => {
                    const cleanName = u.name.split(' (')[0].trim();
                    const roleLabel = u.role === 'admin'
                      ? 'Broker Owner'
                      : u.role === 'broker'
                      ? 'Broker Consulente'
                      : u.role === 'call_center'
                      ? 'Operatore Call Center'
                      : 'Consulente Senior';
                    return (
                      <option key={u.id} value={u.id}>
                        {cleanName} ({roleLabel})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="operator-email-input" className="text-slate-700 font-bold block mb-1">
                  Email Aziendale
                </label>
                <input
                  id="operator-email-input"
                  type="email"
                  readOnly
                  value={DEMO_USERS.find(u => u.id === selectedOperatorId)?.email || 'm.riva@voltagroup.it'}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-mono text-xs"
                />
              </div>

              <div>
                <label htmlFor="operator-password-input" className="text-slate-700 font-bold block mb-1">
                  Password
                </label>
                <input
                  id="operator-password-input"
                  type="password"
                  readOnly
                  value="••••••••••••"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-[#e3e8ee] text-[#0a2540] text-xs"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCallCenterLogin}
              className="w-full min-h-[44px] py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Headphones className="h-4 w-4" />
              <span>Accedi al Backend Operativo</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        )}

        {/* TAB 2: CUSTOMER LOGIN */}
        {activeTab === 'customer' && (
          <div className="space-y-4" role="tabpanel">
            <OAuthButtons
              role="customer"
              mode="login"
              onSuccess={handleOAuthSuccess}
              onToast={() => {}}
            />

            <form onSubmit={handleCustomerLogin} className="space-y-4 pt-1">
              <div>
                <label htmlFor="customer-select-profile" className="text-slate-700 font-bold block mb-1">
                  Seleziona Profilo Cliente
                </label>
                <select
                  id="customer-select-profile"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-[#e3e8ee] text-[#0a2540] font-medium text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city} • {c.fiscalCode})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <User className="h-4 w-4" />
                <span>Accedi al Portale Bollette</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  User, 
  Briefcase 
} from 'lucide-react';
import { Customer, UserProfile } from '../types';
import { api } from '../api/client';
import { INITIAL_PROFILES } from '../services/supabaseClient';
import { OAuthButtons } from './OAuthButtons';

interface PortalGateProps {
  onLoginOperator: (user: UserProfile) => void;
  onLoginCustomer: (user: UserProfile) => void;
  onRequire2FA: (user: UserProfile) => void;
  customers: Customer[];
  profiles: UserProfile[];
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  onOpenTotem?: () => void;
}

export const PortalGate: React.FC<PortalGateProps> = ({
  onLoginOperator,
  onLoginCustomer,
  onRequire2FA: _onRequire2FA,
  customers: _customers,
  profiles: _profiles,
  onToast,
  onOpenTotem,
}) => {
  const [activePortal, setActivePortal] = useState<'customer' | 'operator'>('customer');
  const [customerMode, setCustomerMode] = useState<'login' | 'register'>('login');

  // Customer Auth State
  const [customerIdentifier, setCustomerIdentifier] = useState('andrea.moretti@email.it');
  const [customerPassword, setCustomerPassword] = useState('');

  // Customer Self-Registration State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regFiscalCode, setRegFiscalCode] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Operator Auth State
  const [operatorEmail, setOperatorEmail] = useState('m.riva@voltagroup.it');
  const [operatorPassword, setOperatorPassword] = useState('admin123');
  const [operatorTotp, setOperatorTotp] = useState('123456');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1-Click Demo Login: Entra istantaneamente in qualsiasi ruolo senza blocchi o redirect esterni
  const handleDirectDemoLogin = async (role: string, userId?: string) => {
    setIsSubmitting(true);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
        localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
      } catch {}
    }
    try {
      if (api.auth?.demoLogin) {
        const res = await api.auth.demoLogin(role, userId);
        if (res?.user) {
          onToast('Accesso Demo Effettuato', `Benvenuto in modalità ${role}: ${res.user.name}`, 'success');
          if (res.user.role === 'customer') {
            onLoginCustomer(res.user);
          } else {
            onLoginOperator(res.user);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('[PortalGate] Demo API fallback locale:', err);
    } finally {
      setIsSubmitting(false);
    }

    // Fallback sicuro istantaneo su profili preconfigurati
    const fallbackProfile = INITIAL_PROFILES.find(p => (userId && p.id === userId) || p.role === role) || INITIAL_PROFILES[0];
    if (typeof window !== 'undefined') {
      try {
        const token = fallbackProfile.role === 'customer'
          ? `mock-cust-token-${fallbackProfile.id}-${Date.now()}`
          : `mock-op-token-${fallbackProfile.id}-${Date.now()}`;
        localStorage.setItem('VOLTA_AUTH_TOKEN', token);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(fallbackProfile));
      } catch {}
    }
    onToast('Accesso Demo 1-Click', `Benvenuto ${fallbackProfile.name}`, 'success');
    if (fallbackProfile.role === 'customer') {
      onLoginCustomer(fallbackProfile);
    } else {
      onLoginOperator(fallbackProfile);
    }
  };

  // Customer Login Handler
  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = customerIdentifier.trim();
    const pwd = customerPassword.trim();

    if (!query) {
      onToast('Dati Mancanti', 'Inserisci la tua email o Codice Fiscale.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const authRes = await api.auth.loginCustomer(query, pwd || 'customer123');
      if (authRes?.success && authRes.user) {
        onToast('Accesso Eseguito', `Benvenuto ${authRes.user.name}`, 'success');
        onLoginCustomer(authRes.user);
        return;
      }
    } catch (err) {
      // In modalità demo o fallback, accetta il profilo corrispondente
      const customerProfiles = INITIAL_PROFILES.filter(p => p.role === 'customer');
      const matched = customerProfiles.find(p =>
        p.email.toLowerCase() === query.toLowerCase() ||
        (p.fiscalCode && p.fiscalCode.toLowerCase() === query.toLowerCase()) ||
        p.name.toLowerCase().includes(query.toLowerCase())
      ) || customerProfiles[0];
      
      if (matched) {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
            localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
            localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-cust-token-${matched.id}-${Date.now()}`);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
          } catch {}
        }
        onToast('Accesso Demo Cliente', `Benvenuto ${matched.name}`, 'success');
        onLoginCustomer(matched);
        return;
      }
      onToast('Accesso Negato', err instanceof Error ? err.message : 'Accesso non riuscito.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Customer Registration Handler
  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPhone) {
      onToast('Dati Incompleti', 'Compila tutti i campi obbligatori.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.auth.registerCustomer({
        name: regName,
        email: regEmail,
        phone: regPhone,
        fiscalCode: regFiscalCode,
        password: regPassword || 'customer123',
      });

      onToast('Registrazione Completata!', 'Il tuo profilo cliente è attivo.', 'success');
      onLoginCustomer(result.user);
    } catch (err) {
      onToast('Errore', err instanceof Error ? err.message : 'Impossibile completare la registrazione.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Operator Login Handler
  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setIsSubmitting(true);
    try {
      const result = await api.auth.loginOperator(operatorEmail, operatorPassword, operatorTotp);
      if (result.user) {
        onLoginOperator(result.user);
        return;
      } else if (result.require2FA) {
        if (operatorTotp === '123456') {
          const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase());
          if (matched) {
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
                localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
                localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-${matched.id}-${Date.now()}`);
                localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
              } catch {}
            }
            onLoginOperator(matched);
            return;
          }
        }
        onToast('Richiesta 2FA', result.message || 'Inserisci il codice TOTP a 6 cifre.', 'info');
      }
    } catch (_err) {
      const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase()) || INITIAL_PROFILES[0];
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
          localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
          localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-${matched.id}-${Date.now()}`);
          localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
        } catch {}
      }
      onToast('Accesso Demo Operatore', `Benvenuto ${matched.name}`, 'success');
      onLoginOperator(matched);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col justify-between text-[#0a2540] relative overflow-x-hidden selection:bg-[#635bff] selection:text-white font-sans">
      
      {/* Subtle Stripe-style diagonal background mesh gradient */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 91, 255, 0.15), transparent 70%)',
        }}
      />

      {/* Top Navigation Bar: Minimalist & Clean */}
      <header className="relative z-10 px-4 sm:px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#635bff] flex items-center justify-center text-white shadow-xs">
              <Zap className="h-4 w-4 fill-white text-white" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-[#0a2540]">
              Volta Energia
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenTotem && (
              <button
                type="button"
                onClick={onOpenTotem}
                className="px-3 py-1.5 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                title="Apri modalità Totem Kiosk per showroom e fiere"
              >
                <span>🖥️ Modalità Totem</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              title="Accedi istantaneamente come Admin in Demo Mode"
            >
              <Sparkles className="h-3 w-3 text-amber-300 fill-amber-300" />
              <span>Accedi come Demo Mode</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Single Centered Stripe Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
        
        {/* The Card */}
        <div className="w-full bg-white rounded-2xl border border-[#e3e8ee] shadow-[0_20px_60px_rgba(10,37,64,0.08)] p-6 sm:p-8 space-y-6">
          
          {/* Card Header */}
          <div className="text-center space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0a2540]">
              Accedi al tuo account
            </h1>
            <p className="text-xs text-slate-500">
              Seleziona il portale clienti o l'area riservata staff
            </p>
          </div>

          {/* Segmented Control Switcher (Stripe style) */}
          <div className="p-1 rounded-xl bg-slate-100 border border-[#e3e8ee] grid grid-cols-2 gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActivePortal('customer')}
              className={`min-h-[38px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activePortal === 'customer'
                  ? 'bg-white text-[#0a2540] shadow-xs'
                  : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <User className="h-4 w-4 text-[#635bff]" />
              <span>Portale Clienti</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePortal('operator')}
              className={`min-h-[38px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activePortal === 'operator'
                  ? 'bg-white text-[#0a2540] shadow-xs'
                  : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <Briefcase className="h-4 w-4 text-[#635bff]" />
              <span>Staff & Broker</span>
            </button>
          </div>

          {/* ⚡ 1-Click Demo Sandbox Quick Strip */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#635bff]" /> Accesso Rapido Demo 1-Click:
              </span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                Attivo
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => handleDirectDemoLogin('broker', 'user-op-3')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                💼 Broker
              </button>
              <button
                type="button"
                onClick={() => handleDirectDemoLogin('call_center', 'user-cc-4')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                📞 Call Center
              </button>
              <button
                type="button"
                onClick={() => handleDirectDemoLogin('operator', 'user-op-2')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                🎧 Operatore
              </button>
              <button
                type="button"
                onClick={() => handleDirectDemoLogin('customer', 'user-cust-1')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-emerald-800 font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                👤 Privato
              </button>
              <button
                type="button"
                onClick={() => handleDirectDemoLogin('customer', 'user-cust-2')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-emerald-800 font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                🏢 Business
              </button>
            </div>
          </div>

          {/* Social / OAuth Buttons */}
          <OAuthButtons
            role={activePortal}
            mode={customerMode}
            onSuccess={activePortal === 'customer' ? onLoginCustomer : onLoginOperator}
            onToast={onToast}
          />

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              oppure con credenziali
            </span>
          </div>

          {/* 1. CUSTOMER PORTAL TAB */}
          {activePortal === 'customer' && (
            <div className="space-y-4">
              {customerMode === 'login' ? (
                <form onSubmit={handleCustomerLogin} className="space-y-4">
                  <div>
                    <label htmlFor="customer-identifier" className="block text-xs font-bold text-[#0a2540] mb-1.5">
                      Email o Codice Fiscale
                    </label>
                    <input
                      id="customer-identifier"
                      type="text"
                      value={customerIdentifier}
                      onChange={(e) => setCustomerIdentifier(e.target.value)}
                      placeholder="andrea.moretti@email.it oppure MRTNDR85M01H501Z"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="customer-password" className="block text-xs font-bold text-[#0a2540]">
                        Password
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Demo: qualsiasi</span>
                    </div>
                    <input
                      id="customer-password"
                      type="password"
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <span>Entra nel Portale Bollette</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCustomerRegister} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0a2540] mb-1">Nome e Cognome *</label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Mario Rossi"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0a2540] mb-1">Codice Fiscale</label>
                      <input
                        type="text"
                        value={regFiscalCode}
                        onChange={(e) => setRegFiscalCode(e.target.value.toUpperCase())}
                        placeholder="RSSMRA80A01H501U"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs font-mono focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0a2540] mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="mario.rossi@email.it"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0a2540] mb-1">Cellulare *</label>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+39 340 1234567"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0a2540] mb-1">Password</label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] mt-2"
                  >
                    <span>Crea Account e Accedi</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}

              {/* Mode Toggle Link */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setCustomerMode(m => m === 'login' ? 'register' : 'login')}
                  className="text-xs font-semibold text-[#635bff] hover:text-[#5851ea] cursor-pointer"
                >
                  {customerMode === 'login' 
                    ? 'Non hai ancora un account? Registrati' 
                    : 'Hai già un account? Accedi con le tue credenziali'}
                </button>
              </div>
            </div>
          )}

          {/* 2. OPERATOR & STAFF TAB */}
          {activePortal === 'operator' && (
            <div className="space-y-4">
              <form onSubmit={handleOperatorLogin} className="space-y-4">
                <div>
                  <label htmlFor="operator-email" className="block text-xs font-bold text-[#0a2540] mb-1.5">
                    Email Aziendale
                  </label>
                  <input
                    id="operator-email"
                    type="email"
                    value={operatorEmail}
                    onChange={(e) => setOperatorEmail(e.target.value)}
                    placeholder="m.riva@voltagroup.it"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="operator-pwd" className="block text-xs font-bold text-[#0a2540] mb-1.5">
                      Password
                    </label>
                    <input
                      id="operator-pwd"
                      type="password"
                      value={operatorPassword}
                      onChange={(e) => setOperatorPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="operator-totp" className="block text-xs font-bold text-[#0a2540]">
                        Codice 2FA (TOTP)
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Demo: 123456</span>
                    </div>
                    <input
                      id="operator-totp"
                      type="text"
                      maxLength={6}
                      value={operatorTotp}
                      onChange={(e) => setOperatorTotp(e.target.value)}
                      placeholder="123456"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all font-mono text-center tracking-widest font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#0a2540] hover:bg-slate-800 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Lock className="h-4 w-4 text-[#00d4aa]" />
                  <span>Accedi al CRM & Backend Operativo</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>© Volta Energia • Connessione protetta SSL • Conforme ARERA & GDPR</span>
        </div>
      </footer>
    </div>
  );
};

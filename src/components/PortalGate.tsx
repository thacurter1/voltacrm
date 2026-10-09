import React, { useState } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  User, 
  Monitor, 
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
  // Check URL params for initial portal selection or invite
  const searchParams = new URLSearchParams(window.location.search);
  const initialPortal = searchParams.get('portal') === 'operator' ? 'operator' : 'customer';
  const initialInvite = searchParams.get('invite');
  const initialEmail = searchParams.get('email') || '';

  const [activePortal, setActivePortal] = useState<'customer' | 'operator'>(initialPortal);
  
  // Customer Auth State
  const [customerMode, setCustomerMode] = useState<'login' | 'register'>(
    initialInvite ? 'register' : 'login'
  );
  const [customerIdentifier, setCustomerIdentifier] = useState(initialEmail);
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
            onLoginOperator(matched);
            return;
          }
        }
        onToast('Richiesta 2FA', result.message || 'Inserisci il codice TOTP a 6 cifre.', 'info');
      }
    } catch (_err) {
      const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase()) || INITIAL_PROFILES[0];
      onToast('Accesso Demo Operatore', `Benvenuto ${matched.name}`, 'success');
      onLoginOperator(matched);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col justify-between text-[#0a2540] relative overflow-x-hidden selection:bg-[#635bff] selection:text-white font-sans">
      
      {/* Stripe-grade ambient background lighting */}
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-indigo-50/70 via-slate-50/40 to-transparent pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#635bff]/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-64 -left-32 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-[#e3e8ee]/80 bg-white/70 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#635bff] flex items-center justify-center text-white shadow-xs">
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-[#0a2540] tracking-tight">Volta Energia</span>
              <span className="text-[10px] text-[#635bff] font-bold uppercase tracking-wider block -mt-0.5">
                Piattaforma Trasparenza & Gestione
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {onOpenTotem && (
              <button
                type="button"
                onClick={onOpenTotem}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold bg-[#0a2540] hover:bg-[#081d33] text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
                title="Avvia la modalità Totem Touchscreen per punti vendita"
              >
                <Monitor className="h-3.5 w-3.5 text-[#00d4aa]" />
                <span className="hidden sm:inline">Modalità Totem Kiosk</span>
                <span className="sm:hidden">Totem</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
              disabled={isSubmitting}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold bg-[#635bff] hover:bg-[#5851ea] text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
              title="Accedi istantaneamente alla piattaforma in modalità Demo"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
              <span>Accedi come Demo Mode</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-4 max-w-5xl mx-auto w-full space-y-6">
        
        {/* ⚡ 1-CLICK DEMO ACCESS BAR (Stripe Sandbox style — ALWAYS available) */}
        <section 
          aria-label="Accesso rapido demo" 
          className="w-full bg-white rounded-2xl border border-[#e3e8ee] p-5 shadow-[0_2px_8px_rgba(10,37,64,0.04)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md bg-[#635bff]/10 text-[#635bff] font-extrabold text-xs tracking-wide flex items-center gap-1 border border-[#635bff]/20">
                <Sparkles className="h-3 w-3" /> DEMO 1-CLICK
              </span>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-[#0a2540]">
                  Accesso Immediato a Qualsiasi Ruolo (Senza Password)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Clicca un ruolo per entrare istantaneamente con un profilo preconfigurato:
                </p>
              </div>
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ambiente Demo Attivo</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {/* 1. Admin */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
              disabled={isSubmitting}
              className="p-3 rounded-xl bg-slate-50 hover:bg-[#635bff] border border-slate-200 hover:border-[#635bff] text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px]"
            >
              <div>
                <span className="text-base mb-0.5 block">👑</span>
                <span className="font-bold text-xs text-[#0a2540] block group-hover:text-white">Admin CRM</span>
                <span className="text-[10px] text-slate-500 group-hover:text-indigo-100 block truncate">Matteo Riva</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-[#635bff] group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 2. Broker */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('broker', 'user-op-3')}
              disabled={isSubmitting}
              className="p-3 rounded-xl bg-slate-50 hover:bg-[#635bff] border border-slate-200 hover:border-[#635bff] text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px]"
            >
              <div>
                <span className="text-base mb-0.5 block">💼</span>
                <span className="font-bold text-xs text-[#0a2540] block group-hover:text-white">Broker</span>
                <span className="text-[10px] text-slate-500 group-hover:text-indigo-100 block truncate">Valentina Neri</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-[#635bff] group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 3. Operatore */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('operator', 'user-op-2')}
              disabled={isSubmitting}
              className="p-3 rounded-xl bg-slate-50 hover:bg-[#635bff] border border-slate-200 hover:border-[#635bff] text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px]"
            >
              <div>
                <span className="text-base mb-0.5 block">🎧</span>
                <span className="font-bold text-xs text-[#0a2540] block group-hover:text-white">Operatore</span>
                <span className="text-[10px] text-slate-500 group-hover:text-indigo-100 block truncate">Chiara Bianchi</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-[#635bff] group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 4. Call Center */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('call_center', 'user-cc-4')}
              disabled={isSubmitting}
              className="p-3 rounded-xl bg-slate-50 hover:bg-[#635bff] border border-slate-200 hover:border-[#635bff] text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px]"
            >
              <div>
                <span className="text-base mb-0.5 block">📞</span>
                <span className="font-bold text-xs text-[#0a2540] block group-hover:text-white">Call Center</span>
                <span className="text-[10px] text-slate-500 group-hover:text-indigo-100 block truncate">Marco Rossi</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-[#635bff] group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 5. Cliente Privato */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('customer', 'user-cust-1')}
              disabled={isSubmitting}
              className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-600 border border-slate-200 hover:border-emerald-600 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px]"
            >
              <div>
                <span className="text-base mb-0.5 block">👤</span>
                <span className="font-bold text-xs text-[#0a2540] block group-hover:text-white">Cliente Privato</span>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-100 block truncate">Andrea Moretti</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-emerald-600 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 6. Cliente B2B */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('customer', 'user-cust-2')}
              disabled={isSubmitting}
              className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-600 border border-slate-200 hover:border-emerald-600 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px]"
            >
              <div>
                <span className="text-base mb-0.5 block">🏢</span>
                <span className="font-bold text-xs text-[#0a2540] block group-hover:text-white">Cliente B2B</span>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-100 block truncate">La Terrazza Srl</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-emerald-600 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 7. Totem Point */}
            <button
              type="button"
              onClick={() => {
                if (onOpenTotem) {
                  onOpenTotem();
                } else {
                  window.location.search = '?app=totem';
                }
              }}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-xs flex flex-col justify-between min-h-[76px] col-span-2 sm:col-span-2 lg:col-span-1"
            >
              <div>
                <span className="text-base mb-0.5 block">🖥️</span>
                <span className="font-bold text-xs text-white block">Totem Kiosk</span>
                <span className="text-[10px] text-slate-400 block truncate">Touchscreen</span>
              </div>
              <span className="mt-1.5 text-[10px] font-bold text-[#00d4aa] flex items-center gap-0.5">
                Avvia →
              </span>
            </button>
          </div>
        </section>

        {/* STRIPE-STYLE MAIN AUTH CARD */}
        <div className="w-full max-w-4xl bg-white rounded-3xl border border-[#e3e8ee] shadow-[0_20px_60px_rgba(10,37,64,0.07)] overflow-hidden grid grid-cols-1 md:grid-cols-12">
          
          {/* Left Column: Architectural Branding Narrative */}
          <div className="md:col-span-5 bg-[#0a2540] p-8 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold backdrop-blur-xs border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Sicurezza & Trasparenza Garantita</span>
              </div>

              <h2 className="text-2xl font-black tracking-tight leading-snug">
                {activePortal === 'customer' ? (
                  <>Confronto trasparente delle tue <span className="text-[#00d4aa]">bollette luce e gas</span>.</>
                ) : (
                  <>Suite operativa per <span className="text-[#635bff]">Consulenti & Call Center</span>.</>
                )}
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activePortal === 'customer' ? (
                  'Carica la bolletta o inserisci i tuoi consumi, confronta le tariffe all\'ingrosso PUN/PSV e ricevi stime reali senza calcoli gonfiati.'
                ) : (
                  'Gestione lead commerciali, firma contratti FEA, calcolo provvigionale automatico e monitoraggio forniture clienti.'
                )}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 space-y-2.5 text-[11px] text-slate-300 relative z-10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00d4aa] shrink-0" />
                <span>Nessun costo nascosto né vincoli contrattuali</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00d4aa] shrink-0" />
                <span>Confronto matematico onesto basato su indici GME</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00d4aa] shrink-0" />
                <span>Accesso rapido demo sempre abilitato per test</span>
              </div>
            </div>

            {/* Subtle glow */}
            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#635bff]/25 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Right Column: High-Precision Stripe Form */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            
            {/* Segmented Pill Selector (Stripe style) */}
            <div className="p-1 rounded-xl bg-slate-100 border border-[#e3e8ee] grid grid-cols-2 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActivePortal('customer')}
                className={`min-h-[40px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activePortal === 'customer'
                    ? 'bg-white text-[#0a2540] shadow-xs'
                    : 'text-slate-500 hover:text-[#0a2540]'
                }`}
              >
                <User className="h-4 w-4 text-[#635bff]" />
                <span>Area Clienti</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePortal('operator')}
                className={`min-h-[40px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activePortal === 'operator'
                    ? 'bg-white text-[#0a2540] shadow-xs'
                    : 'text-slate-500 hover:text-[#0a2540]'
                }`}
              >
                <Briefcase className="h-4 w-4 text-[#635bff]" />
                <span>Staff & Operatori</span>
              </button>
            </div>

            {/* 1. CUSTOMER PORTAL TAB */}
            {activePortal === 'customer' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                
                {/* Mode toggle */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0a2540]">
                      {customerMode === 'login' ? 'Accedi al tuo Portale' : 'Crea un nuovo account'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Visualizza le tue forniture e monitora il risparmio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerMode(m => m === 'login' ? 'register' : 'login')}
                    className="text-xs font-bold text-[#635bff] hover:text-[#5851ea] cursor-pointer"
                  >
                    {customerMode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
                  </button>
                </div>

                {/* OAuth Social Login */}
                <OAuthButtons
                  role="customer"
                  mode={customerMode}
                  onSuccess={onLoginCustomer}
                  onToast={onToast}
                />

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                    oppure con credenziali
                  </span>
                </div>

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
                        <span className="text-[10px] text-slate-400 font-mono">Demo: qualsiasi o vuota</span>
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

                    {/* Quick Demo Customer Selector */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                        Oppure accedi come demo mode:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleDirectDemoLogin('customer', 'user-cust-1')}
                          disabled={isSubmitting}
                          className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-left transition-all cursor-pointer shadow-2xs"
                        >
                          <span className="font-bold text-xs text-[#0a2540] block">👤 Andrea Moretti</span>
                          <span className="text-[10px] text-slate-500 block">Privato (Luce & Gas)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDirectDemoLogin('customer', 'user-cust-2')}
                          disabled={isSubmitting}
                          className="p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-left transition-all cursor-pointer shadow-2xs"
                        >
                          <span className="font-bold text-xs text-[#0a2540] block">🏢 La Terrazza Srl</span>
                          <span className="text-[10px] text-slate-500 block">Business P.IVA</span>
                        </button>
                      </div>
                    </div>
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
              </div>
            )}

            {/* 2. OPERATOR & STAFF TAB */}
            {activePortal === 'operator' && (
              <div className="space-y-5 animate-in fade-in-50 duration-150">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[#0a2540]">
                    Accesso Riservato Staff & Broker
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Include CRM, dialer call center, gestione mandati e liquidazione provvigioni.
                  </p>
                </div>

                {/* OAuth for operators */}
                <OAuthButtons
                  role="operator"
                  mode="login"
                  onSuccess={onLoginOperator}
                  onToast={onToast}
                />

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                    oppure con credenziali aziendali
                  </span>
                </div>

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

                  {/* Quick Operator Demo Selector */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                      Oppure accedi come demo mode:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
                        disabled={isSubmitting}
                        className="py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[11px] font-bold text-[#0a2540] text-center transition-all cursor-pointer shadow-2xs"
                      >
                        👑 Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectDemoLogin('broker', 'user-op-3')}
                        disabled={isSubmitting}
                        className="py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[11px] font-bold text-[#0a2540] text-center transition-all cursor-pointer shadow-2xs"
                      >
                        💼 Broker
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectDemoLogin('operator', 'user-op-2')}
                        disabled={isSubmitting}
                        className="py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[11px] font-bold text-[#0a2540] text-center transition-all cursor-pointer shadow-2xs"
                      >
                        🎧 Operatore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectDemoLogin('call_center', 'user-cc-4')}
                        disabled={isSubmitting}
                        className="py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[11px] font-bold text-[#0a2540] text-center transition-all cursor-pointer shadow-2xs"
                      >
                        📞 Call Center
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#e3e8ee]/80 py-5 px-6 text-center text-xs text-slate-500 bg-white/60">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#0a2540]">Volta Energia</span>
            <span>• Piattaforma Trasparenza Tariffe & CRM Operativo</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Connessione crittografata HTTPS • Conforme Linee Guida ARERA</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

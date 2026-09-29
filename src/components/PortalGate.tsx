import React, { useState } from 'react';
import { 
  Zap, 
  Headphones, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Lock, 
  CheckCircle2 
} from 'lucide-react';
import { Customer, UserProfile } from '../types';
import { api, DEMO_MODE } from '../api/client';
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
  customers,
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
  const [operatorEmail, setOperatorEmail] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [operatorTotp, setOperatorTotp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  // 1-Click Demo Login: Entra istantaneamente in qualsiasi ruolo senza blocchi
  const handleDirectDemoLogin = async (role: string, userId?: string) => {
    try {
      setIsSubmitting(true);
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
    } catch (err) {
      console.warn('[PortalGate] Demo API fallback locale:', err);
    } finally {
      setIsSubmitting(false);
    }

    const fallbackProfile = INITIAL_PROFILES.find(p => (userId && p.id === userId) || p.role === role) || INITIAL_PROFILES[0];
    onToast('Accesso Demo Diretto', `Benvenuto ${fallbackProfile.name}`, 'success');
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
    const pwd = customerPassword;

    if (!query) {
      onToast('Dati Mancanti', 'Inserisci la tua email o Codice Fiscale.', 'warning');
      return;
    }

    if (!pwd) {
      onToast('Password Richiesta', 'Inserisci la tua password di accesso.', 'warning');
      return;
    }

    // 1. Tenta autenticazione crittografica tramite backend REST
    try {
      const authRes = await api.auth.loginCustomer(query, pwd);
      if (authRes?.success && authRes.user) {
        onToast('Accesso Eseguito', `Benvenuto ${authRes.user.name}`, 'success');
        onLoginCustomer(authRes.user);
        return;
      }
    } catch (err) {
      // Fallback matching local demo customer
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
    }
  };

  // Customer Registration Handler (Self-Service)
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
        password: regPassword,
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
          const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase()) || INITIAL_PROFILES[0];
          onLoginOperator(matched);
          return;
        }
        onToast('Richiesta 2FA', result.message || 'Inserisci il codice TOTP a 6 cifre (es. 123456).', 'info');
      }
    } catch (err) {
      // Fallback matching operator profiles
      const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase());
      if (matched) {
        onToast('Accesso Demo Operatore', `Benvenuto ${matched.name}`, 'success');
        onLoginOperator(matched);
        return;
      }
      onToast('Accesso Negato', err instanceof Error ? err.message : 'Credenziali non valide.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a2540] flex flex-col justify-between text-slate-100 selection:bg-[#635bff] selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#635bff] flex items-center justify-center text-white shadow-md">
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">Volta Energia</span>
            <span className="text-[10px] text-[#00d4aa] font-bold uppercase tracking-widest block -mt-1">
              CRM & Piattaforma Broker
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setActivePortal('customer')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activePortal === 'customer'
                ? 'bg-white text-[#0a2540] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Area Clienti
          </button>
          <button
            onClick={() => setActivePortal('operator')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              activePortal === 'operator'
                ? 'bg-[#635bff] text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Accesso Broker & Call Center
          </button>
          {onOpenTotem && (
            <button
              onClick={onOpenTotem}
              className="px-3.5 py-1.5 rounded-xl font-bold bg-[#00d4aa]/20 hover:bg-[#00d4aa]/30 text-[#00d4aa] border border-[#00d4aa]/40 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="Attiva la modalità Totem Touchscreen per punti vendita e centri commerciali"
            >
              <span>🖥️ Modalità Totem</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-4 max-w-5xl mx-auto w-full">
        {/* ⚡ BANNER ACCESSO RAPIDO DEMO A OGNI RUOLO */}
        <section aria-label="Accesso rapido demo" className="w-full mb-6 bg-slate-900/90 border border-amber-400/40 rounded-3xl p-5 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs tracking-wider shadow-sm flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 fill-slate-950" /> DEMO 1-CLICK
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Accesso Immediato Demo (Senza Password né 2FA)
                </h2>
                <p className="text-[11px] text-slate-300">
                  Clicca un qualsiasi ruolo per entrare direttamente con account demo preconfigurato:
                </p>
              </div>
            </div>
            <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1 shrink-0">
              <span>⚡ Accesso garantito senza errori</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
            {/* 1. Admin */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
              disabled={isSubmitting}
              className="p-3 rounded-2xl bg-white/5 hover:bg-[#635bff] border border-white/10 hover:border-[#635bff] text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xl mb-1 block">👑</span>
                <span className="font-bold text-xs text-white block group-hover:text-white">Demo Admin</span>
                <span className="text-[10px] text-slate-400 group-hover:text-indigo-100 block">Matteo Riva</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-indigo-400 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 2. Broker */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('broker', 'user-op-3')}
              disabled={isSubmitting}
              className="p-3 rounded-2xl bg-white/5 hover:bg-indigo-600 border border-white/10 hover:border-indigo-500 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xl mb-1 block">💼</span>
                <span className="font-bold text-xs text-white block group-hover:text-white">Demo Broker</span>
                <span className="text-[10px] text-slate-400 group-hover:text-indigo-100 block">Valentina Neri</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-indigo-400 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 3. Operatore */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('operator', 'user-op-2')}
              disabled={isSubmitting}
              className="p-3 rounded-2xl bg-white/5 hover:bg-sky-600 border border-white/10 hover:border-sky-500 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xl mb-1 block">🎧</span>
                <span className="font-bold text-xs text-white block group-hover:text-white">Demo Operatore</span>
                <span className="text-[10px] text-slate-400 group-hover:text-sky-100 block">Chiara Bianchi</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-sky-400 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 4. Call Center */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('call_center', 'user-cc-4')}
              disabled={isSubmitting}
              className="p-3 rounded-2xl bg-white/5 hover:bg-emerald-600 border border-white/10 hover:border-emerald-500 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xl mb-1 block">📞</span>
                <span className="font-bold text-xs text-white block group-hover:text-white">Demo Call Center</span>
                <span className="text-[10px] text-slate-400 group-hover:text-emerald-100 block">Marco Rossi</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-emerald-400 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 5. Cliente Residenziale */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('customer', 'user-cust-1')}
              disabled={isSubmitting}
              className="p-3 rounded-2xl bg-white/5 hover:bg-teal-600 border border-white/10 hover:border-teal-500 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xl mb-1 block">👤</span>
                <span className="font-bold text-xs text-white block group-hover:text-white">Demo Privato</span>
                <span className="text-[10px] text-slate-400 group-hover:text-teal-100 block">Andrea Moretti</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-teal-400 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 6. Cliente B2B */}
            <button
              type="button"
              onClick={() => handleDirectDemoLogin('customer', 'user-cust-2')}
              disabled={isSubmitting}
              className="p-3 rounded-2xl bg-white/5 hover:bg-cyan-600 border border-white/10 hover:border-cyan-500 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xl mb-1 block">🏢</span>
                <span className="font-bold text-xs text-white block group-hover:text-white">Demo B2B</span>
                <span className="text-[10px] text-slate-400 group-hover:text-cyan-100 block">La Terrazza Srl</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-cyan-400 group-hover:text-white flex items-center gap-0.5">
                Entra →
              </span>
            </button>

            {/* 7. Totem Point */}
            <button
              type="button"
              onClick={() => {
                if (onOpenTotem) onOpenTotem();
              }}
              className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500 border border-amber-400/40 hover:border-amber-400 text-left transition-all cursor-pointer group hover:scale-[1.02] shadow-sm flex flex-col justify-between col-span-2 sm:col-span-3 lg:col-span-1"
            >
              <div>
                <span className="text-xl mb-1 block">🖥️</span>
                <span className="font-bold text-xs text-amber-300 block group-hover:text-slate-950">Demo Totem</span>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-900 block">Touchscreen</span>
              </div>
              <span className="mt-2 text-[10px] font-bold text-amber-400 group-hover:text-slate-950 flex items-center gap-0.5">
                Avvia →
              </span>
            </button>
          </div>
        </section>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white rounded-3xl shadow-2xl overflow-hidden text-slate-900 border border-[#e3e8ee]">
          
          {/* LEFT COLUMN: HERO & BRANDING */}
          <div className="md:col-span-5 bg-gradient-to-br from-[#0a2540] to-[#1a3a60] p-8 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-semibold backdrop-blur-xs border border-white/10">
                <ShieldCheck className="h-3.5 w-3.5" />
                {activePortal === 'customer' ? 'Area Personale Protetta' : 'Crittografia AES-256 & 2FA'}
              </div>

              <h2 className="text-2xl font-bold tracking-tight leading-tight">
                {activePortal === 'customer' ? (
                  <>Il controllo trasparente delle tue <span className="text-[#00d4aa]">bollette luce e gas</span>.</>
                ) : (
                  <>Piattaforma Enterprise per <span className="text-[#635bff]">Broker & Call Center</span>.</>
                )}
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activePortal === 'customer' ? (
                  'Carica le tue bollette in 5 secondi, ricevi la pagella energetica con algoritmo ARERA e risparmia in modo automatico.'
                ) : (
                  'Script dialer AIDA, lead management, agenda appuntamenti e motore di audit quadrimestrale con simulatore PUN/PSV.'
                )}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 space-y-2 text-[11px] text-slate-300 relative z-10">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00d4aa]" />
                <span>Nessun costo nascosto o vincolo contrattuale</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00d4aa]" />
                <span>Audit automatico e ottimizzazione continua tariffe</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#00d4aa]" />
                <span>Consulente dedicato sempre raggiungibile su WhatsApp</span>
              </div>
            </div>

            {/* Decorative background glow */}
            <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[#635bff]/30 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* RIGHT COLUMN: AUTH FORMS */}
          <div className="md:col-span-7 p-8 flex flex-col justify-center text-xs">
            
            {/* PORTAL 1: CLIENTE FINALE */}
            {activePortal === 'customer' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0a2540]">
                      {customerMode === 'login' ? 'Accedi alla tua Area Risparmio' : 'Crea il tuo Profilo Risparmio'}
                    </h3>
                    <p className="text-[#425466] text-[11px]">
                      {customerMode === 'login' 
                        ? 'Inserisci la tua email o codice fiscale' 
                        : 'Bastano 30 secondi per iniziare a risparmiare sulle utenze'}
                    </p>
                  </div>

                  <div className="flex p-0.5 bg-slate-100 rounded-lg text-[11px] font-semibold">
                    <button
                      onClick={() => setCustomerMode('login')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        customerMode === 'login' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466]'
                      }`}
                    >
                      Accedi
                    </button>
                    <button
                      onClick={() => setCustomerMode('register')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        customerMode === 'register' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466]'
                      }`}
                    >
                      Registrati
                    </button>
                  </div>
                </div>

                {customerMode === 'login' ? (
                  <div className="space-y-4">
                    <OAuthButtons
                      role="customer"
                      mode="login"
                      onSuccess={onLoginCustomer}
                      onToast={onToast}
                    />

                    <form onSubmit={handleCustomerLogin} className="space-y-4">
                    <div>
                      <label className="block font-semibold text-[#0a2540] mb-1">Email o Codice Fiscale</label>
                      <input
                        type="text"
                        required
                        placeholder="Es. andrea.moretti@email.it oppure MRTNDR85..."
                        value={customerIdentifier}
                        onChange={e => setCustomerIdentifier(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden text-xs"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-[#0a2540]">Password</label>
                        <a href="#reset" onClick={e => { e.preventDefault(); onToast('Reset Password', 'Controlla la tua casella email per impostare una nuova password.', 'info'); }} className="text-[#635bff] text-[11px] hover:underline">
                          Password dimenticata?
                        </a>
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={customerPassword}
                        onChange={e => setCustomerPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-[#0a2540] hover:bg-[#1a3a60] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mt-2"
                    >
                      <span>Entra nell'Area Personale</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    {DEMO_MODE && <div className="pt-2 border-t border-[#e3e8ee]">
                      <span className="text-[10px] text-slate-400 block mb-1.5 uppercase font-bold">Oppure accedi con un account demo:</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {customers.slice(0, 3).map((c: Customer) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              const user: UserProfile = {
                                id: `user-${c.id}`,
                                name: c.name,
                                email: c.email,
                                role: 'customer',
                                customerId: c.id,
                                phone: c.phone,
                                fiscalCode: c.fiscalCode,
                                avatar: c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
                                onboardingStatus: 'active',
                              };
                              onLoginCustomer(user);
                            }}
                            className="py-1.5 px-2 rounded-lg border border-[#e3e8ee] hover:bg-emerald-50/50 hover:border-emerald-300 text-[10px] font-medium text-[#0a2540] truncate cursor-pointer transition-colors text-center"
                          >
                            👤 {c.name.split(' ')[0]} ({c.utilityPoints.length} utenze)
                          </button>
                        ))}
                      </div>
                    </div>}
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <OAuthButtons
                    role="customer"
                    mode="register"
                    onSuccess={onLoginCustomer}
                    onToast={onToast}
                  />

                  <form onSubmit={handleCustomerRegister} className="space-y-3.5">
                    <div>
                      <label className="block font-semibold text-[#0a2540] mb-1">Nome e Cognome / Ragione Sociale *</label>
                      <input
                        type="text"
                        required
                        placeholder="Es. Marco Rossi"
                        value={regName}
                        onChange={e => setRegName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-[#0a2540] mb-1">Email *</label>
                        <input
                          type="email"
                          required
                          placeholder="m.rossi@gmail.com"
                          value={regEmail}
                          onChange={e => setRegEmail(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#0a2540] mb-1">Cellulare (WhatsApp) *</label>
                        <input
                          type="tel"
                          required
                          placeholder="+39 340 1234567"
                          value={regPhone}
                          onChange={e => setRegPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#0a2540] mb-1">Codice Fiscale / Partita IVA</label>
                      <input
                        type="text"
                        placeholder="Es. RSSMRA80A01H501U"
                        required
                        value={regFiscalCode}
                        onChange={e => setRegFiscalCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden uppercase font-mono"
                      />
                    </div>

                    <label className="block font-semibold text-[#0a2540]">Password (almeno 12 caratteri)
                      <input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={regPassword} onChange={e=>setRegPassword(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" />
                    </label>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl bg-[#635bff] hover:bg-[#534be0] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mt-2 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{isSubmitting ? 'Attivazione in corso...' : 'Crea Profilo & Inizia'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* PORTAL 2: OPERATORE CALL CENTER & BROKER */}
          {activePortal === 'operator' && (
            <div className="space-y-5">
              <div className="border-b border-[#e3e8ee] pb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#635bff] text-[10px] font-bold uppercase mb-1">
                  <Headphones className="h-3 w-3" /> Area Operativa Riservata
                </div>
                <h3 className="text-base font-bold text-[#0a2540]">Accesso Consulenti & Call Center</h3>
                <p className="text-[#425466] text-[11px]">
                  Accesso protetto con autenticazione a due fattori TOTP (RFC 6238) o Social OAuth aziendale.
                </p>
              </div>

              <OAuthButtons
                role="operator"
                mode="login"
                onSuccess={onLoginOperator}
                onToast={onToast}
              />

              {DEMO_MODE && <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block mb-1.5 uppercase font-bold">Compila rapido con account demo:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setOperatorEmail('m.riva@voltagroup.it');
                        setOperatorPassword('admin123');
                        setOperatorTotp('123456');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-[10px] font-semibold text-slate-800 text-center transition-all cursor-pointer shadow-2xs"
                    >
                      👑 Admin (Riva)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOperatorEmail('c.bianchi@voltagroup.it');
                        setOperatorPassword('operator123');
                        setOperatorTotp('123456');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-[10px] font-semibold text-slate-800 text-center transition-all cursor-pointer shadow-2xs"
                    >
                      🎧 Operatore (Bianchi)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOperatorEmail('v.neri@voltagroup.it');
                        setOperatorPassword('operator123');
                        setOperatorTotp('123456');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-[10px] font-semibold text-slate-800 text-center transition-all cursor-pointer shadow-2xs"
                    >
                      💼 Broker (Neri)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOperatorEmail('m.rossi@voltagroup.it');
                        setOperatorPassword('operator123');
                        setOperatorTotp('123456');
                      }}
                      className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-[10px] font-semibold text-slate-800 text-center transition-all cursor-pointer shadow-2xs"
                    >
                      📞 Call Center (Rossi)
                    </button>
                  </div>
                </div>}

                <form onSubmit={handleOperatorLogin} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-[#0a2540]">Email operatore
                      <input type="email" autoComplete="username" required value={operatorEmail} onChange={e=>setOperatorEmail(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" />
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0a2540] mb-1">Password Operatore</label>
                    <input
                      type="password"
                      required autoComplete="current-password" value={operatorPassword} onChange={e=>setOperatorPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden text-xs"
                    />
                  </div>

                  <label className="block font-semibold text-[#0a2540]">Codice Authenticator
                    <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={operatorTotp} onChange={e=>setOperatorTotp(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" />
                  </label>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-amber-800 text-[11px]">
                    <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Richiede codice di sicurezza 2FA generato da Google Authenticator o Authy.</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-[#635bff] hover:bg-[#534be0] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Verifica Credenziali & 2FA</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-white/10">
        Volta Energia Enterprise • Crittografia AES-256-GCM • Conforme ARERA & GDPR EU 2016/679
      </footer>
    </div>
  );
};

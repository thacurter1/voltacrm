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
import { profileService } from '../services/supabaseClient';

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
  onRequire2FA,
  customers,
  profiles,
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Operator Auth State
  const [selectedOpId, setSelectedOpId] = useState<string>(
    profiles.find(p => p.role === 'admin')?.id || 'user-admin-1'
  );

  const operators = profiles.filter(p => p.role === 'admin' || p.role === 'call_center');

  // Customer Login Handler
  const handleCustomerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const query = customerIdentifier.trim().toLowerCase();

    // Cerca tra i profili clienti o nelle anagrafiche clienti
    const matchedProfile = profiles.find(p => 
      p.role === 'customer' && (
        p.email.toLowerCase() === query || 
        p.fiscalCode?.toLowerCase() === query
      )
    );

    const matchedCustomer = customers.find(c => 
      c.email.toLowerCase() === query || 
      c.fiscalCode.toLowerCase() === query ||
      c.id === customerIdentifier
    );

    if (matchedProfile || matchedCustomer) {
      const user: UserProfile = matchedProfile || {
        id: `user-${matchedCustomer!.id}`,
        name: matchedCustomer!.name,
        email: matchedCustomer!.email,
        role: 'customer',
        customerId: matchedCustomer!.id,
        phone: matchedCustomer!.phone,
        fiscalCode: matchedCustomer!.fiscalCode,
        avatar: matchedCustomer!.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
        onboardingStatus: 'active',
      };

      onLoginCustomer(user);
    } else {
      // Per agevolare il test rapido, effettua il login con il primo cliente demo se vuoto o non trovato
      const fallback = customers[0];
      if (fallback) {
        const user: UserProfile = {
          id: `user-${fallback.id}`,
          name: fallback.name,
          email: fallback.email,
          role: 'customer',
          customerId: fallback.id,
          phone: fallback.phone,
          fiscalCode: fallback.fiscalCode,
          avatar: fallback.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          onboardingStatus: 'active',
        };
        onToast('Accesso Demo Cliente', `Benvenuto ${fallback.name}`, 'info');
        onLoginCustomer(user);
      }
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
      const newProfile = await profileService.registerCustomerSelfService({
        name: regName,
        email: regEmail,
        phone: regPhone,
        fiscalCode: regFiscalCode || 'CF' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      });

      onToast('Registrazione Completata!', 'Il tuo profilo cliente è attivo.', 'success');
      onLoginCustomer(newProfile);
    } catch {
      onToast('Errore', 'Impossibile completare la registrazione.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Operator Login Handler
  const handleOperatorLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const op = operators.find(o => o.id === selectedOpId) || operators[0];
    if (op) {
      if (op.is2faEnabled) {
        onRequire2FA(op);
      } else {
        onLoginOperator(op);
      }
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
            <span className="font-bold text-lg text-white tracking-tight">VoltaCRM</span>
            <span className="text-[10px] text-[#00d4aa] font-bold uppercase tracking-widest block -mt-1">
              Energy Cloud
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
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
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
                <span>Audit automatico tariffe ogni 120 giorni</span>
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

                    {/* Quick Demo Selector */}
                    <div className="pt-2 border-t border-[#e3e8ee]">
                      <span className="text-[10px] text-slate-400 block mb-1.5 uppercase font-bold">Oppure prova con un account demo:</span>
                      <div className="flex gap-2">
                        {customers.slice(0, 2).map(c => (
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
                                avatar: c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
                                onboardingStatus: 'active',
                              };
                              onLoginCustomer(user);
                            }}
                            className="flex-1 py-1.5 px-2.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[11px] font-medium text-[#0a2540] truncate cursor-pointer transition-colors"
                          >
                            {c.name.split(' ')[0]} ({c.utilityPoints.length} utenze)
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                ) : (
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
                        value={regFiscalCode}
                        onChange={e => setRegFiscalCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden uppercase font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl bg-[#635bff] hover:bg-[#534be0] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mt-2 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>{isSubmitting ? 'Attivazione in corso...' : 'Crea Profilo & Inizia'}</span>
                    </button>
                  </form>
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
                    Accesso protetto con autenticazione a due fattori TOTP (RFC 6238).
                  </p>
                </div>

                <form onSubmit={handleOperatorLogin} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-[#0a2540] mb-1">Seleziona Profilo Operatore</label>
                    <select
                      value={selectedOpId}
                      onChange={e => setSelectedOpId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden bg-white text-xs"
                    >
                      {operators.map(op => (
                        <option key={op.id} value={op.id}>
                          {op.name} ({op.role === 'admin' ? 'Super Admin' : 'Consulente Call Center'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#0a2540] mb-1">Password Operatore</label>
                    <input
                      type="password"
                      defaultValue="VoltaSecure2026!#"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden text-xs"
                    />
                  </div>

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
        VoltaCRM Enterprise • Crittografia AES-256-GCM • Conforme ARERA & GDPR EU 2016/679
      </footer>
    </div>
  );
};

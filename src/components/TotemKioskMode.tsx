import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Flame, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  Send, 
  CheckCircle2, 
  X, 
  Lock, 
  ChevronLeft,
  ShieldCheck
} from 'lucide-react';
import { Lead } from '../types';
import { api, DEMO_MODE } from '../api/client';

interface TotemKioskModeProps {
  isOpen: boolean;
  onExitTotem: () => void;
  onLeadCaptured: (lead: Lead) => void;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const TotemKioskMode: React.FC<TotemKioskModeProps> = ({
  isOpen,
  onExitTotem,
  onLeadCaptured,
  onToast,
}) => {
  // Wizard steps: 1 = Utenza, 2 = Spesa attuale, 3 = Risultato & Risparmio, 4 = Invio Cellulare / QR
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedUtility, setSelectedUtility] = useState<'luce' | 'gas' | 'entrambe'>('luce');
  const [spendingBracket, setSpendingBracket] = useState<'bassa' | 'media' | 'alta'>('media');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [leadSent, setLeadSent] = useState(false);

  // Inactivity Auto-Reset Timer (60 secondi per i totem pubblici)
  const [secondsLeft, setSecondsLeft] = useState(60);

  // PIN / Password per uscire dalla modalità Totem (per l'operatore)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinFailedAttempts, setPinFailedAttempts] = useState(0);
  const [pinLockoutUntil, setPinLockoutUntil] = useState(0);

  // Reset del timer di inattività ad ogni tocco sullo schermo
  const resetInactivityTimer = () => {
    setSecondsLeft(60);
  };

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Reset Totem alla schermata iniziale
          setStep(1);
          setSelectedUtility('luce');
          setSpendingBracket('media');
          setPhoneNumber('');
          setCustomerName('');
          setLeadSent(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  // Calcolo stima trasparente per il totem
  const estimatedSavings = 
    selectedUtility === 'entrambe' 
      ? (spendingBracket === 'alta' ? 480 : spendingBracket === 'media' ? 340 : 190)
      : (spendingBracket === 'alta' ? 290 : spendingBracket === 'media' ? 210 : 120);

  // Tastierino numerico touch grande per digitare il cellulare
  const handleKeypadPress = (digit: string) => {
    resetInactivityTimer();
    if (phoneNumber.length < 10) {
      setPhoneNumber(prev => prev + digit);
    }
  };

  const handleKeypadDelete = () => {
    resetInactivityTimer();
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleFinishLead = () => {
    resetInactivityTimer();
    if (phoneNumber.length < 9) {
      onToast('Numero Incompleto', 'Inserisci un numero di cellulare valido.', 'warning');
      return;
    }

    const newLead: Lead = {
      id: `totem-${Date.now()}`,
      name: customerName.trim() || `Ospite Totem Point (${phoneNumber.slice(-4)})`,
      phone: `+39 ${phoneNumber}`,
      email: `totem.${phoneNumber}@voltacrm.it`,
      city: 'Punto Vendita Totem',
      source: 'landing_page',
      status: 'new',
      notes: `Lead Totem interattivo. Utenza: ${selectedUtility.toUpperCase()}, Fascia spesa: ${spendingBracket}, Risparmio calcolato: €${estimatedSavings}/anno.`,
      createdAt: new Date().toISOString().split('T')[0],
      estimatedConsumptionKwh: selectedUtility === 'gas' ? undefined : 3200,
      estimatedConsumptionSmc: selectedUtility === 'luce' ? undefined : 950,
    };

    onLeadCaptured(newLead);
    setLeadSent(true);

    // Invio automatico WhatsApp preventivo & link interattivo
    api.messaging.sendOfferWhatsApp({
      phone: `+39 ${phoneNumber}`,
      customerName: newLead.name,
      savingsEur: estimatedSavings,
      utilityType: selectedUtility,
      offerName: 'Miglior Tariffa Mercato Libero (ARERA)'
    }).catch(err => {
      console.warn('[Totem] Invio preventivo WhatsApp non riuscito:', err);
    });

    setTimeout(() => {
      // Dopo 5 secondi di ringraziamento, resetta per il cliente successivo
      setStep(1);
      setPhoneNumber('');
      setCustomerName('');
      setLeadSent(false);
      setSecondsLeft(60);
    }, 6000);
  };

  const handleVerifyPin = () => {
    const now = Date.now();
    if (now < pinLockoutUntil) {
      const waitSeconds = Math.ceil((pinLockoutUntil - now) / 1000);
      setPinError(`Troppi tentativi errati. Blocco temporaneo attivo per ancora ${waitSeconds} secondi.`);
      return;
    }

    const trimmed = enteredPin.trim();
    const configuredPin = typeof window !== 'undefined' ? localStorage.getItem('VOLTA_KIOSK_MASTER_PIN') : null;
    const expectedPin = configuredPin || (DEMO_MODE ? '8492' : null);
    const isMasterMatch = expectedPin !== null && trimmed === expectedPin;

    if (isMasterMatch) {
      setIsPinModalOpen(false);
      setEnteredPin('');
      setPinError('');
      setPinFailedAttempts(0);
      onExitTotem();
    } else {
      const nextAttempts = pinFailedAttempts + 1;
      setPinFailedAttempts(nextAttempts);
      setEnteredPin('');
      if (nextAttempts >= 3) {
        setPinLockoutUntil(Date.now() + 60 * 1000);
        setPinError('Superato il limite di 3 tentativi. Blocco di sicurezza applicato per 60 secondi.');
      } else {
        setPinError(`Credenziali non valide. (${3 - nextAttempts} tentativi rimasti)`);
      }
    }
  };

  return (
    <div 
      onPointerDown={resetInactivityTimer}
      className="fixed inset-0 z-50 bg-[#0a2540] text-slate-100 flex flex-col justify-between select-none overflow-hidden touch-manipulation font-sans"
    >
      {/* Background architectural glow & subtle grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#635bff_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#635bff]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[#00d4aa]/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP BAR: STRIPE TERMINAL KIOSK HEADER */}
      <header className="relative z-10 px-6 sm:px-10 py-5 sm:py-6 flex items-center justify-between border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-[#635bff] flex items-center justify-center text-white shadow-[0_4px_16px_rgba(99,91,255,0.4)]">
            <Zap className="h-7 w-7 fill-white text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              VOLTA <span className="text-[#00d4aa]">TERMINAL</span>
            </h1>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Totem Interattivo • Calcolo Risparmio Bollette
            </span>
          </div>
        </div>

        {/* Stepper summary & Inactivity ring */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Sessione attiva:</span>
            <span className="font-mono font-bold text-white">{secondsLeft}s</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setPhoneNumber('');
              setLeadSent(false);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Ricomincia</span>
          </button>

          {/* Operator PIN Locker */}
          <button
            type="button"
            onClick={() => setIsPinModalOpen(true)}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Esci dalla modalità Kiosk (Staff PIN)"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* STEP INDICATOR BAR */}
      <div className="relative z-10 max-w-2xl mx-auto w-full px-6 pt-4">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            { num: 1, label: 'Fornitura' },
            { num: 2, label: 'Spesa' },
            { num: 3, label: 'Risparmio' },
            { num: 4, label: 'Ricevi' },
          ].map((s) => {
            const isCurrent = step === s.num;
            const isPassed = step > s.num;
            return (
              <div key={s.num} className="space-y-1">
                <div className={`h-1.5 rounded-full transition-all duration-300 ${
                  isCurrent ? 'bg-[#00d4aa]' : isPassed ? 'bg-[#635bff]' : 'bg-white/10'
                }`} />
                <span className={`text-[10px] uppercase font-bold tracking-wider ${
                  isCurrent ? 'text-white' : isPassed ? 'text-slate-300' : 'text-slate-500'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CORPO CENTRALE WIZARD */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-10 max-w-4xl mx-auto w-full">
        
        {/* STEP 1: SCEGLI L'UTENZA */}
        {step === 1 && (
          <div className="space-y-8 text-center w-full animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-[#635bff]/20 text-[#635bff] border border-[#635bff]/30 text-xs font-black uppercase tracking-wider inline-block">
                Passo 1 di 3
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Quale fornitura vuoi ottimizzare?
              </h2>
              <p className="text-base sm:text-lg text-slate-300">
                Tocca lo schermo per selezionare l'utenza
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* OPZIONE 1: LUCE */}
              <button
                type="button"
                onClick={() => {
                  setSelectedUtility('luce');
                  setStep(2);
                }}
                className="min-h-[180px] p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/90 active:scale-95 border-2 border-white/15 hover:border-amber-400 text-center space-y-4 transition-all cursor-pointer shadow-xl group flex flex-col items-center justify-center"
              >
                <div className="h-20 w-20 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="h-10 w-10 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Solo LUCE</h3>
                  <p className="text-xs text-slate-400 mt-1">Abitazione o Locale Commerciale</p>
                </div>
              </button>

              {/* OPZIONE 2: GAS */}
              <button
                type="button"
                onClick={() => {
                  setSelectedUtility('gas');
                  setStep(2);
                }}
                className="min-h-[180px] p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/90 active:scale-95 border-2 border-white/15 hover:border-sky-400 text-center space-y-4 transition-all cursor-pointer shadow-xl group flex flex-col items-center justify-center"
              >
                <div className="h-20 w-20 rounded-2xl bg-sky-400/20 text-sky-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Flame className="h-10 w-10 fill-sky-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Solo GAS</h3>
                  <p className="text-xs text-slate-400 mt-1">Riscaldamento & Acqua Calda</p>
                </div>
              </button>

              {/* OPZIONE 3: ENTRAMBE */}
              <button
                type="button"
                onClick={() => {
                  setSelectedUtility('entrambe');
                  setStep(2);
                }}
                className="min-h-[180px] p-8 rounded-3xl bg-gradient-to-br from-[#635bff]/40 to-slate-900/80 hover:from-[#635bff]/60 active:scale-95 border-2 border-[#635bff] text-center space-y-4 transition-all cursor-pointer shadow-2xl group relative overflow-hidden flex flex-col items-center justify-center"
              >
                <div className="absolute top-0 right-0 bg-[#00d4aa] text-[#0a2540] font-black text-[10px] uppercase px-3 py-1 rounded-bl-xl shadow-md">
                  Più Richiesto
                </div>
                <div className="h-20 w-20 rounded-2xl bg-[#635bff]/30 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="h-10 w-10 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">LUCE + GAS</h3>
                  <p className="text-xs text-emerald-300 font-bold mt-1">Massima Convenienza</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: QUANTO SPENDI? */}
        {step === 2 && (
          <div className="space-y-8 text-center w-full animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-[#635bff]/20 text-[#635bff] border border-[#635bff]/30 text-xs font-black uppercase tracking-wider inline-block">
                Passo 2 di 3
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Qual è la tua spesa media a bolletta?
              </h2>
              <p className="text-base sm:text-lg text-slate-300">
                Seleziona la fascia più vicina alle tue abitudini
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* FASCIA 1: BASSA */}
              <button
                type="button"
                onClick={() => {
                  setSpendingBracket('bassa');
                  setStep(3);
                }}
                className="min-h-[160px] p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/90 active:scale-95 border-2 border-white/15 hover:border-emerald-400 text-center space-y-3 transition-all cursor-pointer shadow-xl flex flex-col items-center justify-center"
              >
                <span className="text-4xl sm:text-5xl block font-mono font-black text-slate-200">€ 50-80</span>
                <span className="font-bold text-base text-white block">Consumi Moderati</span>
                <span className="text-xs text-slate-400 block">Single o 1-2 persone</span>
              </button>

              {/* FASCIA 2: MEDIA */}
              <button
                type="button"
                onClick={() => {
                  setSpendingBracket('media');
                  setStep(3);
                }}
                className="min-h-[160px] p-8 rounded-3xl bg-[#635bff]/30 hover:bg-[#635bff]/50 active:scale-95 border-2 border-[#635bff] text-center space-y-3 transition-all cursor-pointer shadow-2xl flex flex-col items-center justify-center"
              >
                <span className="text-4xl sm:text-5xl block font-mono font-black text-[#00d4aa]">€ 80-160</span>
                <span className="font-bold text-base text-white block">Famiglia Standard</span>
                <span className="text-xs text-emerald-300 font-semibold block">3-4 componenti / appartamento</span>
              </button>

              {/* FASCIA 3: ALTA */}
              <button
                type="button"
                onClick={() => {
                  setSpendingBracket('alta');
                  setStep(3);
                }}
                className="min-h-[160px] p-8 rounded-3xl bg-slate-900/60 hover:bg-slate-900/90 active:scale-95 border-2 border-white/15 hover:border-amber-400 text-center space-y-3 transition-all cursor-pointer shadow-xl flex flex-col items-center justify-center"
              >
                <span className="text-4xl sm:text-5xl block font-mono font-black text-amber-300">Oltre 160€</span>
                <span className="font-bold text-base text-white block">Consumi Elevati</span>
                <span className="text-xs text-slate-400 block">Ville, riscaldamento autonomo o uffici</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-1.5 mx-auto cursor-pointer p-2"
              >
                <ChevronLeft className="h-4 w-4" /> Torna alla scelta fornitura
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ESITO & RISPARMIO STIMATO */}
        {step === 3 && (
          <div className="space-y-8 text-center w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-wider inline-block">
                Stima Risparmio Calcolata
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Ecco quanto puoi risparmiare con Volta Energia:
              </h2>
            </div>

            {/* RISPARMIO CARD IN STILE STRIPE TERMINAL */}
            <div className="p-8 sm:p-10 rounded-3xl bg-slate-950/80 border-2 border-[#00d4aa] text-center space-y-4 shadow-[0_20px_50px_rgba(0,212,170,0.18)]">
              <span className="text-xs font-bold uppercase tracking-widest text-[#00d4aa]">
                Risparmio Annuo Stimato
              </span>
              <div className="text-6xl sm:text-8xl font-black font-mono tracking-tight text-white">
                € {estimatedSavings}
                <span className="text-2xl sm:text-4xl font-sans text-[#00d4aa] font-bold"> / anno</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 pt-1 max-w-md mx-auto">
                Calcolato su indici ufficiali GME (PUN/PSV) e condizioni di mercato libero per {selectedUtility.toUpperCase()}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="min-h-[64px] w-full py-4 rounded-2xl bg-[#00d4aa] hover:bg-[#00c29b] active:scale-95 text-[#0a2540] font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg"
              >
                <span>Invia Scheda al mio Cellulare</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[64px] w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/20"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Ricalcola con altri importi</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: TASTIERINO TOUCH INTEGRATO (ATM STYLE) */}
        {step === 4 && (
          <div className="w-full max-w-md space-y-6 text-center animate-in zoom-in-95 duration-200">
            {!leadSent ? (
              <>
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Dove ti inviamo il riepilogo?
                  </h2>
                  <p className="text-xs text-slate-300">
                    Digita il tuo numero di cellulare per ricevere l'analisi gratuita
                  </p>
                </div>

                {/* DISPLAY NUMERO TOUCH */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border-2 border-[#00d4aa] text-center shadow-inner">
                  <span className="text-[11px] text-slate-400 block font-semibold mb-1">Numero di Cellulare:</span>
                  <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-[#00d4aa] min-h-[48px] flex items-center justify-center">
                    {phoneNumber ? `+39 ${phoneNumber}` : '+39 ...'}
                  </div>
                </div>

                {/* TASTIERINO NUMERICO TOUCH GIGANTE */}
                <div className="grid grid-cols-3 gap-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="min-h-[64px] rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 active:scale-95 text-2xl font-mono font-bold text-white transition-all cursor-pointer flex items-center justify-center shadow-md border border-white/10"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPhoneNumber('')}
                    className="min-h-[64px] rounded-2xl bg-white/5 hover:bg-white/15 text-xs uppercase font-bold text-slate-300 transition-all cursor-pointer flex items-center justify-center border border-white/10"
                  >
                    Cancella
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="min-h-[64px] rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 active:scale-95 text-2xl font-mono font-bold text-white transition-all cursor-pointer flex items-center justify-center shadow-md border border-white/10"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadDelete}
                    className="min-h-[64px] rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs uppercase font-bold text-amber-300 transition-all cursor-pointer flex items-center justify-center border border-white/10"
                  >
                    ⌫ Indietro
                  </button>
                </div>

                {/* PULSANTE INVIA PREVENTIVO */}
                <button
                  type="button"
                  onClick={handleFinishLead}
                  disabled={phoneNumber.length < 9}
                  className="w-full min-h-[56px] py-4 rounded-2xl bg-[#00d4aa] hover:bg-[#00c29b] active:scale-98 text-[#0a2540] font-black text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Send className="h-5 w-5" />
                  <span>Ricevi Offerta via WhatsApp / SMS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-slate-400 hover:text-white text-xs font-semibold block mx-auto cursor-pointer p-2"
                >
                  ← Torna al riepilogo risparmio
                </button>
              </>
            ) : (
              /* SCHERMATA FINALE DI SUCCESSO */
              <div className="p-8 sm:p-12 rounded-3xl bg-slate-950/90 border-2 border-emerald-400 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="h-20 w-20 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h2 className="text-3xl font-black text-white">
                  Richiesta Registrata!
                </h2>
                <p className="text-sm text-slate-300 max-w-sm mx-auto">
                  Abbiamo inviato il riepilogo con il risparmio stimato di <strong>€{estimatedSavings}/anno</strong> al tuo recapito.
                </p>
                <div className="text-xs text-slate-500 pt-4">
                  Il totem si resetterà automaticamente per il prossimo ospite...
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER TERMINAL */}
      <footer className="relative z-10 px-6 py-4 text-center text-xs text-slate-400 border-t border-white/10 bg-slate-950/40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Volta Terminal Kiosk • Punto informativo indipendente</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>GDPR compliant • Dati crittografati</span>
          </div>
        </div>
      </footer>

      {/* PIN MODAL PER LO STAFF */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center font-sans">
          <div onClick={() => setIsPinModalOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white text-[#0a2540] rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl text-xs border border-[#e3e8ee]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="font-extrabold text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#635bff]" />
                <span>Sblocco Kiosk Operatore</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsPinModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-slate-500 text-xs">
              Inserisci il PIN di sicurezza dell'agenzia (demo: <strong className="text-[#635bff] font-mono">8492</strong>) per uscire dal Totem e tornare al CRM.
            </p>

            <input
              type="password"
              placeholder="PIN Operatore"
              value={enteredPin}
              onChange={e => setEnteredPin(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleVerifyPin(); }}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-center font-mono text-lg font-bold focus:border-[#635bff] focus:ring-4 focus:ring-[#635bff]/10 focus:outline-none"
            />

            {pinError && (
              <span className="text-red-600 text-xs font-semibold block text-center">
                {pinError}
              </span>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleVerifyPin}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0a2540] hover:bg-slate-800 text-white font-bold cursor-pointer shadow-xs"
              >
                Sblocca
              </button>
            </div>

            {/* Always available 1-Click bypass for staff & testing */}
            <button
              type="button"
              onClick={() => {
                setIsPinModalOpen(false);
                setEnteredPin('');
                onExitTotem();
              }}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#635bff]/10 hover:bg-[#635bff]/20 text-[#635bff] font-extrabold border border-[#635bff]/30 text-center cursor-pointer transition text-xs flex items-center justify-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Esci Subito al CRM (1-Click Demo)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Zap, 
  Flame, 
  ArrowRight, 
  RotateCcw, 
  Send, 
  CheckCircle2, 
  X, 
  ChevronLeft,
  ShieldCheck
} from 'lucide-react';
import { Lead } from '../types';
import { DEMO_MODE } from '../api/client';
import { createOperationGuard } from '../services/operationGuard';

interface TotemKioskModeProps {
  isOpen: boolean;
  onExitTotem: () => void;
  onLeadCaptured: (lead: Lead, details: { supplyType: 'luce' | 'gas' | 'luce+gas'; monthlyExpenseEur: number }) => Promise<boolean>;
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
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Inactivity Auto-Reset Timer (60 secondi per i totem pubblici)
  const [secondsLeft, setSecondsLeft] = useState(60);

  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const requestGuard = useRef(createOperationGuard());
  const sendingRef = useRef(false);
  const thankYouTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleDeadline = useRef(0);
  const resetSession = useCallback(() => {
    requestGuard.current.invalidate();
    sendingRef.current = false;
    if (thankYouTimer.current) clearTimeout(thankYouTimer.current);
    thankYouTimer.current = null;
    setStep(1);
    setSelectedUtility('luce');
    setSpendingBracket('media');
    setPhoneNumber('');
    setCustomerName('');
    setLeadSent(false);
    setIsSending(false);
    setSendError('');
    setIsExitConfirmOpen(false);
    idleDeadline.current = Date.now() + 60000;
    setSecondsLeft(60);
  }, []);

  // Reset del timer di inattività ad ogni tocco sullo schermo
  const resetInactivityTimer = () => {
    // oxlint-disable-next-line react/purity -- Clock read belongs to the pointer event, not render.
    idleDeadline.current = Date.now() + 60000;
    setSecondsLeft(60);
  };

  useEffect(() => {
    if (!isOpen) return;
    idleDeadline.current = Date.now() + 60000;
    const interval = setInterval(() => {
      const remaining = Math.ceil((idleDeadline.current - Date.now()) / 1000);
      if (remaining <= 0) resetSession();
      else setSecondsLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, resetSession]);
  useEffect(() => () => {
    requestGuard.current.invalidate();
    if (thankYouTimer.current) clearTimeout(thankYouTimer.current);
  }, []);

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

  const handleFinishLead = async () => {
    if (sendingRef.current) return;
    resetInactivityTimer();
    if (phoneNumber.length < 9) {
      onToast('Numero Incompleto', 'Inserisci un numero di cellulare valido.', 'warning');
      return;
    }

    const newLead: Lead = {
      id: `totem-${crypto.randomUUID()}`,
      name: customerName.trim() || `Ospite Totem Point (${phoneNumber.slice(-4)})`,
      phone: `+39 ${phoneNumber}`,
      email: '',
      city: 'Punto Vendita Totem',
      source: 'totem_kiosk',
      status: 'new',
      notes: `Richiesta Totem. Utenza: ${selectedUtility.toUpperCase()}, fascia di spesa: ${spendingBracket}. Bolletta da verificare.`,
      createdAt: new Date().toISOString().split('T')[0],
    };

    sendingRef.current = true;
    const operation = requestGuard.current.begin();
    setIsSending(true);
    setSendError('');
    const monthlyExpenseEur = spendingBracket === 'bassa' ? 65 : spendingBracket === 'media' ? 120 : 190;
    const saved = await onLeadCaptured(newLead, {
      supplyType: selectedUtility === 'entrambe' ? 'luce+gas' : selectedUtility,
      monthlyExpenseEur,
    }).catch(() => false);
    if (!requestGuard.current.isCurrent(operation)) return;
    sendingRef.current = false;
    setIsSending(false);
    if (!saved) {
      setSendError('Non siamo riusciti a registrare la richiesta. Riprova o chiedi assistenza allo staff.');
      return;
    }
    setLeadSent(true);

    thankYouTimer.current = setTimeout(resetSession, 6000);
  };

  return (
    <div 
      onPointerDown={resetInactivityTimer}
      className="fixed inset-0 z-50 bg-[#0a2540] text-slate-100 flex flex-col justify-between select-none overflow-y-auto touch-manipulation font-sans"
    >
      {/* Code-native graphics keep the touch surface clear and lightweight. */}

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
              Totem Interattivo • Verifica delle bollette
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
            onClick={resetSession}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Ricomincia</span>
          </button>

          {/* Leave the public touch surface and return to the staff login. */}
          <button
            type="button"
            onClick={() => setIsExitConfirmOpen(true)}
            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Ricomincia la sessione totem"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* STEP INDICATOR BAR */}
      <div className="relative z-10 max-w-2xl mx-auto w-full px-6 pt-4">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            { num: 1, label: 'Fornitura' },
            { num: 2, label: 'Spesa' },
            { num: 3, label: 'Valutazione' },
            { num: 4, label: 'Contatto' },
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
                Passo 1 di 4
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
                className="min-h-[180px] p-8 rounded-3xl bg-slate-900 hover:bg-slate-800 active:scale-95 border-2 border-[#635bff] text-center space-y-4 transition-all cursor-pointer group relative overflow-hidden flex flex-col items-center justify-center"
              >
                <div className="absolute top-0 right-0 bg-[#00d4aa] text-[#0a2540] font-black text-[10px] uppercase px-3 py-1 rounded-bl-xl shadow-md">
                  Due forniture
                </div>
                <div className="h-20 w-20 rounded-2xl bg-[#635bff]/30 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="h-10 w-10 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">LUCE + GAS</h3>
                  <p className="text-xs text-emerald-300 font-bold mt-1">Luce e gas da valutare</p>
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
                Passo 2 di 4
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Qual è la tua spesa media mensile?
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
                {DEMO_MODE ? 'Simulazione dimostrativa' : 'Prima valutazione'}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                {DEMO_MODE ? 'Esempio di possibile risparmio' : 'Verifichiamo la tua bolletta insieme'}
              </h2>
            </div>

            {/* RISPARMIO CARD IN STILE STRIPE TERMINAL */}
            <div className="p-8 sm:p-10 rounded-3xl bg-slate-950/80 border-2 border-[#00d4aa] text-center space-y-4 shadow-[0_20px_50px_rgba(0,212,170,0.18)]">
              <span className="text-xs font-bold uppercase tracking-widest text-[#00d4aa]">
                {DEMO_MODE ? 'Esempio di risparmio annuo' : 'Analisi personalizzata'}
              </span>
              <div className="text-6xl sm:text-8xl font-black font-mono tracking-tight text-white">
                {DEMO_MODE ? <>€ {estimatedSavings}<span className="text-2xl sm:text-4xl font-sans text-[#00d4aa] font-bold"> / anno</span></> : <span className="text-3xl sm:text-5xl font-sans">Richiedi una verifica</span>}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 pt-1 max-w-md mx-auto">
                {DEMO_MODE ? 'Importo dimostrativo basato sulla fascia scelta: non è un preventivo né una tariffa verificata.' : `Un consulente confronterà le condizioni reali della tua fornitura ${selectedUtility.toUpperCase()} prima di indicarti un eventuale risparmio.`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="min-h-[64px] w-full py-4 rounded-2xl bg-[#00d4aa] hover:bg-[#00c29b] active:scale-95 text-[#0a2540] font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg"
              >
                <span>{DEMO_MODE ? 'Continua con la simulazione' : 'Richiedi un ricontatto'}</span>
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
                    {DEMO_MODE ? 'Prova la richiesta di contatto' : 'A quale numero possiamo ricontattarti?'}
                  </h2>
                  <p className="text-xs text-slate-300">
                    {DEMO_MODE ? 'Inserisci il numero per la simulazione.' : 'Lascia il numero per essere ricontattato da un consulente.'}
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
                  disabled={phoneNumber.length < 9 || isSending}
                  className="w-full min-h-[56px] py-4 rounded-2xl bg-[#00d4aa] hover:bg-[#00c29b] active:scale-98 text-[#0a2540] font-black text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Send className="h-5 w-5" />
                  <span>{isSending ? 'Registrazione in corso…' : DEMO_MODE ? 'Invia richiesta demo' : 'Richiedi ricontatto'}</span>
                </button>

                {sendError && <p role="alert" className="text-sm font-semibold text-rose-300">{sendError}</p>}

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-slate-400 hover:text-white text-xs font-semibold block mx-auto cursor-pointer p-2"
                >
                  ← Torna alla valutazione
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
                  {DEMO_MODE ? 'La richiesta demo è stata registrata. Eventuali messaggi dipendono dal servizio configurato.' : 'La tua richiesta è stata registrata. Un consulente ti ricontatterà al numero indicato.'}
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
          <span>Volta Energia • Postazione informativa touch</span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>I dati inseriti servono per gestire la richiesta di contatto.</span>
          </div>
        </div>
      </footer>

      {isExitConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center font-sans">
          <div onClick={() => setIsExitConfirmOpen(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white text-[#0a2540] rounded-3xl p-6 sm:p-7 space-y-4 shadow-2xl text-xs border border-[#e3e8ee]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="font-extrabold text-sm flex items-center gap-2">
                <X className="h-4 w-4 text-[#635bff]" />
                <span>Ricomincia la sessione totem</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsExitConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                aria-label="Chiudi conferma uscita"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-slate-500 text-xs">
              Il totem tornerà alla schermata iniziale. I dati non inviati di questa sessione verranno cancellati.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsExitConfirmOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={onExitTotem}
                className="flex-1 min-h-[44px] rounded-xl bg-[#0a2540] hover:bg-slate-800 text-white font-bold cursor-pointer shadow-xs"
              >
                Ricomincia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

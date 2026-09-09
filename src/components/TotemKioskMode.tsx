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
  ChevronLeft 
} from 'lucide-react';
import { Lead } from '../types';

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

  // PIN per uscire dalla modalità Totem (per l'operatore)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

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

  // Calcolo risparmio simulato istantaneo per il totem
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
    if (enteredPin === '1234' || enteredPin === '9999') {
      setIsPinModalOpen(false);
      setEnteredPin('');
      setPinError(false);
      onExitTotem();
    } else {
      setPinError(true);
      setEnteredPin('');
    }
  };

  return (
    <div 
      onPointerDown={resetInactivityTimer}
      className="fixed inset-0 z-50 bg-gradient-to-br from-[#0a2540] via-[#0f2d4a] to-[#1a3a60] text-white flex flex-col justify-between select-none overflow-hidden touch-manipulation"
    >
      {/* BARRA SUPERIORE DEL TOTEM */}
      <header className="p-6 sm:p-8 flex items-center justify-between border-b border-white/10 bg-black/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-[#635bff] flex items-center justify-center text-white shadow-lg">
            <Zap className="h-8 w-8 fill-white text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              VOLTA <span className="text-[#00d4aa]">TOUCH</span>
            </h1>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
              Totem Risparmio Bolletta • Calcolo Gratuito in 30 Secondi
            </span>
          </div>
        </div>

        {/* Indicatore step e Reset Timer */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-400 block font-semibold">Schermo Touch Interattivo</span>
            <span className="text-[11px] text-slate-500">Auto-reset in {secondsLeft}s</span>
          </div>

          <button
            onClick={() => {
              setStep(1);
              setPhoneNumber('');
              setLeadSent(false);
            }}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Ricomincia
          </button>

          {/* Pulsante Lucchetto per Operatore (PIN protetto) */}
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Esci da Modalità Totem (Richiede PIN)"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* CORPO CENTRALE A PROVA DI STUPIDO (STEP-BY-STEP WIZARD) */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 max-w-4xl mx-auto w-full">
        
        {/* STEP 1: SCEGLI L'UTENZA */}
        {step === 1 && (
          <div className="space-y-8 text-center w-full animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] text-xs font-bold uppercase tracking-wider">
                Passo 1 di 3
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Cosa vuoi verificare oggi?
              </h2>
              <p className="text-base sm:text-lg text-slate-300">
                Tocca l'opzione che ti interessa per calcolare il risparmio
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* OPZIONE 1: LUCE */}
              <button
                onClick={() => {
                  setSelectedUtility('luce');
                  setStep(2);
                }}
                className="p-8 sm:p-10 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white/20 hover:border-amber-400 text-center space-y-4 transition-all cursor-pointer shadow-xl group"
              >
                <div className="h-20 w-20 mx-auto rounded-3xl bg-amber-400/20 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Zap className="h-10 w-10 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Solo LUCE</h3>
                  <p className="text-xs text-slate-300 mt-1">Casa, Garage o Negozio</p>
                </div>
              </button>

              {/* OPZIONE 2: GAS */}
              <button
                onClick={() => {
                  setSelectedUtility('gas');
                  setStep(2);
                }}
                className="p-8 sm:p-10 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white/20 hover:border-sky-400 text-center space-y-4 transition-all cursor-pointer shadow-xl group"
              >
                <div className="h-20 w-20 mx-auto rounded-3xl bg-sky-400/20 text-sky-300 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Flame className="h-10 w-10 fill-sky-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Solo GAS</h3>
                  <p className="text-xs text-slate-300 mt-1">Riscaldamento e Cottura</p>
                </div>
              </button>

              {/* OPZIONE 3: ENTRAMBE */}
              <button
                onClick={() => {
                  setSelectedUtility('entrambe');
                  setStep(2);
                }}
                className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#635bff]/40 to-indigo-900/60 hover:from-[#635bff]/60 hover:to-indigo-800/80 active:scale-95 border-2 border-[#635bff] text-center space-y-4 transition-all cursor-pointer shadow-2xl group relative overflow-hidden"
              >
                <div className="absolute -top-3 -right-3 bg-[#00d4aa] text-[#0a2540] font-black text-[10px] uppercase px-4 py-1 rounded-bl-xl shadow-md">
                  Più Scelto
                </div>
                <div className="h-20 w-20 mx-auto rounded-3xl bg-[#635bff]/30 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <Sparkles className="h-10 w-10 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">LUCE + GAS</h3>
                  <p className="text-xs text-emerald-300 font-semibold mt-1">Massimo Risparmio Combinato</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: QUANTO SPENDI? */}
        {step === 2 && (
          <div className="space-y-8 text-center w-full animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] text-xs font-bold uppercase tracking-wider">
                Passo 2 di 3
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Quanto spendi a bolletta?
              </h2>
              <p className="text-base sm:text-lg text-slate-300">
                Scegli la cifra che si avvicina di più alle tue spese abituali
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* FASCIA 1: < 80€ */}
              <button
                onClick={() => {
                  setSpendingBracket('bassa');
                  setStep(3);
                }}
                className="p-8 sm:p-10 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white/20 hover:border-emerald-400 text-center space-y-3 transition-all cursor-pointer shadow-xl"
              >
                <span className="text-4xl sm:text-5xl block font-mono font-black text-slate-200">€ 50-80</span>
                <span className="font-bold text-base text-white block">Consumi Moderati</span>
                <span className="text-xs text-slate-400 block">Single o coppie / 1-2 persone</span>
              </button>

              {/* FASCIA 2: 80 - 160€ */}
              <button
                onClick={() => {
                  setSpendingBracket('media');
                  setStep(3);
                }}
                className="p-8 sm:p-10 rounded-3xl bg-[#635bff]/30 hover:bg-[#635bff]/50 active:scale-95 border-2 border-[#635bff] text-center space-y-3 transition-all cursor-pointer shadow-2xl"
              >
                <span className="text-4xl sm:text-5xl block font-mono font-black text-[#00d4aa]">€ 80-160</span>
                <span className="font-bold text-base text-white block">Consumi Famiglia</span>
                <span className="text-xs text-emerald-300 font-semibold block">Appartamento standard / 3-4 persone</span>
              </button>

              {/* FASCIA 3: > 160€ */}
              <button
                onClick={() => {
                  setSpendingBracket('alta');
                  setStep(3);
                }}
                className="p-8 sm:p-10 rounded-3xl bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white/20 hover:border-amber-400 text-center space-y-3 transition-all cursor-pointer shadow-xl"
              >
                <span className="text-4xl sm:text-5xl block font-mono font-black text-amber-300">Oltre 160€</span>
                <span className="font-bold text-base text-white block">Consumi Elevati</span>
                <span className="text-xs text-slate-400 block">Ville, uffici o negozi commerciali</span>
              </button>
            </div>

            <div className="pt-4">
              <button
                onClick={() => setStep(1)}
                className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-1 mx-auto cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Torna indietro
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: IL VERDETTO DEL TOTEM & RISPARMIO */}
        {step === 3 && (
          <div className="space-y-8 text-center w-full max-w-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                Esito Analisi Istantanea
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Ecco quanto puoi risparmiare con Volta:
              </h2>
            </div>

            {/* RISPARMIO GIGANTE */}
            <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-emerald-900/60 to-[#0a2540] border-3 border-[#00d4aa] text-center space-y-3 shadow-[0_20px_50px_rgba(0,212,170,0.25)]">
              <span className="text-xs font-bold uppercase tracking-widest text-[#00d4aa]">
                Risparmio Netto Garantito
              </span>
              <div className="text-6xl sm:text-8xl font-black font-mono tracking-tight text-white drop-shadow-md">
                € {estimatedSavings}
                <span className="text-2xl sm:text-4xl font-sans text-[#00d4aa] font-bold"> / anno</span>
              </div>
              <p className="text-sm text-slate-200 pt-2">
                Basato sui prezzi ARERA e sulle offerte all'ingrosso per {selectedUtility.toUpperCase()}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setStep(4)}
                className="w-full py-5 rounded-2xl bg-[#00d4aa] hover:bg-[#00c29b] active:scale-95 text-[#0a2540] font-black text-lg sm:text-xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg"
              >
                <span>Ricevi l'Offerta sul Cellulare</span>
                <ArrowRight className="h-6 w-6" />
              </button>

              <button
                onClick={() => setStep(2)}
                className="w-full py-5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/20"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Ricalcola con altri importi</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: TASTIERINO DIGITALE PER IL CELLULARE (STILE BANCOMAT) */}
        {step === 4 && (
          <div className="w-full max-w-xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            {!leadSent ? (
              <>
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Dove ti inviamo il preventivo?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Digita il tuo numero di cellulare per ricevere l'analisi su WhatsApp a costo zero
                  </p>
                </div>

                {/* DISPLAY NUMERO */}
                <div className="p-4 rounded-2xl bg-black/40 border-2 border-[#00d4aa] text-center shadow-inner">
                  <span className="text-xs text-slate-400 block font-semibold">Numero Cellulare:</span>
                  <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-[#00d4aa] min-h-[44px] flex items-center justify-center">
                    {phoneNumber ? `+39 ${phoneNumber}` : '+39 ...'}
                  </div>
                </div>

                {/* TASTIERINO NUMERICO TOUCH GIGANTE (ATM STYLE) */}
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                    <button
                      key={digit}
                      onClick={() => handleKeypadPress(digit)}
                      className="h-16 rounded-2xl bg-white/15 hover:bg-white/25 active:bg-white/35 active:scale-95 text-2xl font-mono font-bold text-white transition-all cursor-pointer flex items-center justify-center shadow-md"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setPhoneNumber('');
                    }}
                    className="h-16 rounded-2xl bg-white/5 hover:bg-white/15 text-xs uppercase font-bold text-slate-300 transition-all cursor-pointer flex items-center justify-center"
                  >
                    Cancella
                  </button>
                  <button
                    onClick={() => handleKeypadPress('0')}
                    className="h-16 rounded-2xl bg-white/15 hover:bg-white/25 active:bg-white/35 active:scale-95 text-2xl font-mono font-bold text-white transition-all cursor-pointer flex items-center justify-center shadow-md"
                  >
                    0
                  </button>
                  <button
                    onClick={handleKeypadDelete}
                    className="h-16 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs uppercase font-bold text-amber-300 transition-all cursor-pointer flex items-center justify-center"
                  >
                    ⌫ Indietro
                  </button>
                </div>

                {/* PULSANTE CONFERMA */}
                <button
                  onClick={handleFinishLead}
                  disabled={phoneNumber.length < 9}
                  className="w-full py-4 rounded-2xl bg-[#00d4aa] hover:bg-[#00c29b] active:scale-98 text-[#0a2540] font-black text-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Send className="h-5 w-5" />
                  <span>Invia Preventivo su WhatsApp</span>
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="text-slate-400 hover:text-white text-xs font-semibold block mx-auto cursor-pointer"
                >
                  ← Torna al riepilogo
                </button>
              </>
            ) : (
              /* SCHERMATA FINALE DI RINGRAZIAMENTO */
              <div className="p-8 sm:p-12 rounded-3xl bg-emerald-950/80 border-3 border-emerald-400 text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="h-20 w-20 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white">
                  Richiesta Inviata!
                </h2>
                <p className="text-base text-emerald-200 max-w-md mx-auto">
                  Abbiamo inviato l'analisi dettagliata con il risparmio di <strong>€{estimatedSavings}/anno</strong> sul tuo WhatsApp.
                </p>
                <div className="text-xs text-slate-400 pt-4">
                  Il totem si resetterà tra qualche istante per il prossimo ospite...
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER DEL TOTEM */}
      <footer className="p-6 text-center text-xs text-slate-400 border-t border-white/10 bg-black/15">
        Volta Touch Kiosk • Servizio di Monitoraggio Tariffe Indipendente conforme ARERA
      </footer>

      {/* MODALE PIN OPERATORE PER USCIRE DALLA MODALITÀ TOTEM */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div onClick={() => setIsPinModalOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-xs bg-white text-[#0a2540] rounded-2xl p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <div className="font-bold text-sm flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[#635bff]" />
                Accesso Riservato Operatore
              </div>
              <button onClick={() => setIsPinModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-slate-500 text-[11px]">
              Inserisci il PIN di sicurezza dell'agenzia per uscire dalla modalità Totem e tornare al CRM.
            </p>

            <input
              type="password"
              maxLength={4}
              placeholder="PIN (es. 1234)"
              value={enteredPin}
              onChange={e => setEnteredPin(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-center font-mono text-xl tracking-widest font-bold focus:border-[#635bff] focus:outline-hidden"
            />

            {pinError && (
              <span className="text-red-600 text-[11px] font-bold block text-center">
                PIN errato. Riprova con 1234 o 9999.
              </span>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleVerifyPin}
                className="flex-1 py-2 rounded-xl bg-[#0a2540] hover:bg-slate-800 text-white font-bold cursor-pointer shadow-xs"
              >
                Sblocca
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

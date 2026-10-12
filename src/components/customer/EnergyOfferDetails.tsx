import React from 'react';
import { 
  X, 
  Zap, 
  Flame, 
  HelpCircle, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  PhoneCall
} from 'lucide-react';
import { SupplierOffer } from '../../types';
import { ComparisonInput, ComparisonResult } from '../../services/offerComparison';

export interface EnergyOfferDetailsProps {
  comparison: ComparisonResult;
  isDemoCatalog: boolean;
  currentInput: ComparisonInput;
  onClose: () => void;
  onRequestConsultation: (offer: SupplierOffer, notes?: string) => Promise<boolean>;
}

export const EnergyOfferDetails: React.FC<EnergyOfferDetailsProps> = ({
  comparison,
  isDemoCatalog,
  currentInput,
  onClose,
  onRequestConsultation,
}) => {
  const { offer, annualCost, currentAnnualCost, savingsEur, savingsPercent } = comparison;
  const isLuce = offer.energyType === 'luce';
  const unitLabel = isLuce ? '€/kWh' : '€/Smc';
  const [customerNotes, setCustomerNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  const submitConsultation = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await onRequestConsultation(offer, customerNotes);
      if (saved) onClose();
      else setSubmitError('Non siamo riusciti a inviare la richiesta. Riprova senza perdere le tue note.');
    } catch {
      setSubmitError('Non siamo riusciti a inviare la richiesta. Riprova senza perdere le tue note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-details-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isLuce ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isLuce ? <Zap className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {offer.supplier}
                </span>
                {isDemoCatalog && <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-200 text-slate-700">Catalogo demo</span>}
              </div>
              <h2 id="offer-details-title" className="text-lg sm:text-xl font-black text-[#0a2540]">
                {offer.name}
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
            aria-label="Chiudi dettagli offerta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-7 max-h-[70vh] overflow-y-auto text-sm text-slate-700">
          {/* Box Economico Stima */}
          <div className="space-y-4">
            <h3 className="font-bold text-base text-[#0a2540] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#635bff]" />
              <span>La tua stima</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="border-l-2 border-[#635bff] pl-4">
                <span className="text-sm font-semibold text-slate-600 block">
                  Con questa offerta
                </span>
                <span className="text-3xl font-extrabold text-[#0a2540] block mt-1">
                  {annualCost !== null ? `~€${Math.round(annualCost)}` : 'Non calcolabile'}
                </span>
                <span className="text-slate-600 block text-xs mt-1">
                  Spesa annua stimata, incluse le componenti considerate nel calcolo
                </span>
              </div>

              <div className="border-l-2 border-slate-200 pl-4">
                <span className="text-sm font-semibold text-slate-600 block">
                  Con la tua tariffa attuale
                </span>
                <span className="text-3xl font-extrabold text-slate-700 block mt-1">
                  {currentAnnualCost !== null ? `~€${Math.round(currentAnnualCost)}` : 'Dato non inserito'}
                </span>
                <span className="text-slate-600 block text-xs mt-1">
                  {currentAnnualCost !== null
                    ? `Basato sulla tariffa ${currentInput.currentPricingType || 'in uso'}`
                    : 'Tariffa attuale non indicata'}
                </span>
              </div>
            </div>

            {savingsEur !== null && currentAnnualCost !== null && (
              <div
                className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                  savingsEur > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : savingsEur === 0
                    ? 'bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {savingsEur > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {savingsEur > 0
                    ? `Risparmio matematico stimato: ~€${Math.round(savingsEur)} all'anno (${savingsPercent}%)`
                    : savingsEur === 0
                    ? 'La spesa annua stimata è identica a quella della tua tariffa attuale.'
                    : `Questa offerta ha una spesa stimata superiore di ~€${Math.round(Math.abs(savingsEur))} all'anno rispetto alla tua attuale tariffa.`}
                </span>
              </div>
            )}
          </div>

          {/* Dettaglio Condizioni Economiche */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-[#0a2540]">
              Condizioni Economiche della Fornitura
            </h3>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Tipologia Prezzo</span>
                <span className="font-bold text-slate-900">
                  {offer.pricingType === 'fixed'
                    ? 'Prezzo Fisso Bloccato'
                    : `Indicizzato (${isLuce ? 'PUN' : 'PSV'})`}
                </span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Costo Materia Prima</span>
                <span className="font-bold text-slate-900">
                  {offer.pricingType === 'fixed'
                    ? `${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`
                    : `${isLuce ? 'PUN' : 'PSV'} + ${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`}
                </span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Quota Fissa Commercializzazione</span>
                <span className="font-bold text-slate-900">
                  {offer.fixedAnnualFee} €/anno ({(offer.fixedAnnualFee / 12).toFixed(2)} €/mese)
                </span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Durata Condizioni Economiche</span>
                <span className="font-bold text-slate-900">
                  {offer.durationMonths} mesi dalla data di attivazione
                </span>
              </div>
            </div>
          </div>

          {/* Metodologia e Ipotesi */}
          <details className="border-y border-slate-200 py-4 text-sm text-slate-600">
            <summary className="flex items-center gap-2 font-semibold text-[#0a2540] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#635bff]">
              <HelpCircle className="w-4 h-4 text-[#635bff]" />
              <span>Come abbiamo calcolato la stima</span>
            </summary>
            <ul className="list-disc pl-5 mt-3 space-y-2 leading-relaxed">
              <li>
                Consumo di riferimento: <strong>{currentInput.annualConsumption} {isLuce ? 'kWh' : 'Smc'}/anno</strong> ({currentInput.source === 'account' ? 'dati del profilo' : currentInput.source === 'bill-reviewed' ? 'bolletta verificata' : 'dati inseriti da te'}).
              </li>
              {isLuce && (
                <li>
                  Potenza impegnata considerata: <strong>{currentInput.powerKw || 3} kW</strong> (quota potenza regolata ARERA inclusa nella stima).
                </li>
              )}
              <li>
                Gli oneri di sistema, trasporto, gestione contatore e le imposte (IVA e accise) sono stimati sulla base dei parametri ARERA standard di settore.
              </li>
              <li>
                Questa elaborazione è uno strumento informativo e non costituisce un preventivo vincolante. Il plico contrattuale ufficiale e le schede di confrontabilità fornitore saranno forniti per presa visione prima di ogni richiesta definitiva.
              </li>
            </ul>
          </details>

          {/* Optional Notes for Consultation */}
          <div className="space-y-1.5 pt-1">
            <label htmlFor="consultation-notes" className="block text-sm font-semibold text-slate-700">
              Note o preferenze per il consulente (opzionale)
            </label>
            <input
              id="consultation-notes"
              type="text"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Es. Richiamare preferibilmente nel pomeriggio..."
              className="w-full min-h-[48px] px-3.5 py-2 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635bff] text-slate-800"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Chiudi
          </button>

          {submitError && <p role="alert" className="w-full text-sm font-medium text-red-700">{submitError}</p>}
          <button
            type="button"
            onClick={submitConsultation}
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff]"
          >
            <PhoneCall className="w-4 h-4" />
            <span>{isSubmitting ? 'Invio richiesta...' : 'Richiedi consulenza'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

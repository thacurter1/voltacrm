import React from 'react';
import { 
  X, 
  Zap, 
  Flame, 
  Leaf, 
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
  currentInput: ComparisonInput;
  onClose: () => void;
  onRequestConsultation: (offer: SupplierOffer) => void;
}

export const EnergyOfferDetails: React.FC<EnergyOfferDetailsProps> = ({
  comparison,
  currentInput,
  onClose,
  onRequestConsultation,
}) => {
  const { offer, annualCost, currentAnnualCost, savingsEur, savingsPercent } = comparison;
  const isLuce = offer.energyType === 'luce';
  const unitLabel = isLuce ? '€/kWh' : '€/Smc';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-details-title"
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
                {offer.greenCertified && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <Leaf className="w-3 h-3" />
                    100% Green
                  </span>
                )}
              </div>
              <h2 id="offer-details-title" className="text-lg sm:text-xl font-black text-[#0a2540]">
                {offer.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
            aria-label="Chiudi dettagli offerta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          {/* Box Economico Stima */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-3">
            <h3 className="font-bold text-sm text-[#0a2540] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#635bff]" />
              <span>Sintesi Economica della Stima</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Costo Annuo Nuova Offerta
                </span>
                <span className="text-2xl font-black text-[#0a2540]">
                  {annualCost !== null ? `~€${Math.round(annualCost)}` : 'Non calcolabile'}
                </span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Spesa totale stimata comprensiva di materia prima, fissa e oneri
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Costo Annuo Attuale Stimato
                </span>
                <span className="text-2xl font-black text-slate-700">
                  {currentAnnualCost !== null ? `~€${Math.round(currentAnnualCost)}` : 'Dato non inserito'}
                </span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
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
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <HelpCircle className="w-3.5 h-3.5 text-[#635bff]" />
              <span>Metodologia del Calcolo e Ipotesi Applicate</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Consumo di riferimento considerato: <strong>{currentInput.annualConsumption} {isLuce ? 'kWh' : 'Smc'}/anno</strong> (provenienza: {currentInput.source}).
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

          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestConsultation(offer);
            }}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Richiedi assistenza per questa offerta</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Zap, Flame, Leaf, ArrowRight, Info } from 'lucide-react';
import { ComparisonResult } from '../../services/offerComparison';

export interface EnergyOfferCardProps {
  comparison: ComparisonResult;
  onViewDetails: (comparison: ComparisonResult) => void;
}

export const EnergyOfferCard: React.FC<EnergyOfferCardProps> = ({
  comparison,
  onViewDetails,
}) => {
  const { offer, annualCost, savingsEur, currentAnnualCost } = comparison;
  const isLuce = offer.energyType === 'luce';
  const unitLabel = isLuce ? '€/kWh' : '€/Smc';

  const hasSavingsCalc = savingsEur !== null && currentAnnualCost !== null;
  const isCheaper = hasSavingsCalc && savingsEur > 0;
  const isSame = hasSavingsCalc && savingsEur === 0;
  const isMoreExpensive = hasSavingsCalc && savingsEur < 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-[#635bff]/50 shadow-xs hover:shadow-sm transition-all duration-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      {/* Colonna Sinistra: Icona Fornitura e Dettagli Offerta */}
      <div className="flex items-start gap-4 flex-1">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
            isLuce ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
          }`}
          aria-hidden="true"
        >
          {isLuce ? <Zap className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
        </div>

        <div className="space-y-1.5 flex-1">
          {/* Badge fornitore e caratteristiche reali */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {offer.supplier}
            </span>
            {offer.tag && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {offer.tag}
              </span>
            )}
            {offer.greenCertified && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <Leaf className="w-3 h-3" />
                100% Green
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-black text-[#0a2540] leading-snug">
            {offer.name}
          </h3>

          {/* Dettagli tariffari trasparenti */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
            <div>
              Prezzo materia prima:{' '}
              <strong className="text-slate-900 font-bold">
                {offer.pricingType === 'fixed'
                  ? `${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`
                  : `${isLuce ? 'PUN' : 'PSV'} + ${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`}
              </strong>
            </div>

            <div>
              Quota fissa:{' '}
              <strong className="text-slate-900 font-bold">
                {offer.fixedAnnualFee} €/anno ({(offer.fixedAnnualFee / 12).toFixed(2)} €/mese)
              </strong>
            </div>

            <div>
              Condizioni:{' '}
              <span className="text-slate-700 font-medium">
                {offer.durationMonths} mesi di validità
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Colonna Destra: Costo Annuo Stimato, Risparmio Reale e Azione */}
      <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-3 shrink-0">
        <div className="text-left md:text-right">
          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
            Costo Annuo Stimato
          </span>

          {annualCost !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-[#0a2540]">
                ~€{Math.round(annualCost)}
              </span>
              <span className="text-xs font-semibold text-slate-500">/ anno</span>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500">
              Stima non disponibile
            </div>
          )}

          {/* Risparmio o Differenza Matematica */}
          {hasSavingsCalc ? (
            <div className="mt-0.5 text-xs">
              {isCheaper && (
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded inline-block">
                  Risparmio stimato: ~€{Math.round(savingsEur)}/anno ({comparison.savingsPercent}%)
                </span>
              )}
              {isSame && (
                <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">
                  Spesa equivalente alla tariffa attuale
                </span>
              )}
              {isMoreExpensive && (
                <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-block">
                  Costo stimato maggiore: +€{Math.round(Math.abs(savingsEur))}/anno
                </span>
              )}
            </div>
          ) : (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <Info className="w-3 h-3 text-slate-400" />
              <span>Inserisci la spesa attuale per calcolare il risparmio</span>
            </div>
          )}
        </div>

        {/* Pulsante CTA con altezza minima 44px */}
        <button
          type="button"
          onClick={() => onViewDetails(comparison)}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
        >
          <span>Dettagli e condizioni</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

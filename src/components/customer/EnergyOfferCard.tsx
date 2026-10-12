import React from 'react';
import { ArrowRight, Info, Leaf } from 'lucide-react';
import { ComparisonResult } from '../../services/offerComparison';

export interface EnergyOfferCardProps {
  comparison: ComparisonResult;
  isDemoCatalog: boolean;
  onViewDetails: (comparison: ComparisonResult) => void;
}

export const EnergyOfferCard: React.FC<EnergyOfferCardProps> = ({
  comparison,
  isDemoCatalog,
  onViewDetails,
}) => {
  const { offer, annualCost, savingsEur, currentAnnualCost } = comparison;
  const isLuce = offer.energyType === 'luce';
  const unitLabel = isLuce ? '€/kWh' : '€/Smc';

  const monthlyCost = annualCost !== null ? Math.round(annualCost / 12) : null;

  const hasSavingsCalc = savingsEur !== null && currentAnnualCost !== null;
  const isCheaper = hasSavingsCalc && savingsEur > 0;
  const isSame = hasSavingsCalc && savingsEur === 0;
  const isMoreExpensive = hasSavingsCalc && savingsEur < 0;

  const pricingTypeLabel = offer.pricingType === 'fixed'
    ? 'Prezzo Fisso'
    : (offer.pricingType === 'indexed_pun' || isLuce)
      ? 'PUN + spread'
      : 'PSV + spread';

  return (
    <article className="bg-white rounded-2xl border border-slate-200 hover:border-[#635bff]/60 hover:shadow-[0_10px_30px_rgba(10,37,64,0.06)] transition-all p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 w-full min-w-0">
      {/* Colonna Sinistra: Badges, Titolo Offerta e Dettagli Tariffari */}
      <div className="flex-1 min-w-0 w-full">
        <div className="space-y-2.5 flex-1">
          {/* Badge fornitore, commerciale, tipo prezzo, green e demo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-800">
              {offer.supplier}
            </span>
            {offer.tag && (
              <span className="text-xs font-bold text-[#635bff] bg-[#635bff]/10 border border-[#635bff]/25 px-2.5 py-0.5 rounded-md">
                {offer.tag}
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
              offer.pricingType === 'fixed'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              {pricingTypeLabel}
            </span>
            {offer.greenCertified && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1">
                <Leaf className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>100% Green</span>
              </span>
            )}
            {isDemoCatalog && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                Catalogo demo
              </span>
            )}
          </div>

          <h3 className="text-xl font-bold text-[#0a2540] leading-snug break-words">
            {offer.name}
          </h3>

          {/* Dettagli tariffari trasparenti */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 pt-1">
            <div>
              Prezzo materia prima:{' '}
              <strong className="text-slate-900 font-bold">
                {offer.pricingType === 'fixed'
                  ? `${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`
                  : `${isLuce ? 'PUN' : 'PSV'} + ${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`}
              </strong>
            </div>

            <div>
              Quota fissa (CCV/PCV):{' '}
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

      {/* Colonna Destra: Costo Mensile Hero, Costo Annuo, Risparmio Reale e Azione */}
      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 gap-4 shrink-0">
        <div className="text-left lg:text-right">
          <span className="text-xs font-semibold text-slate-500 block mb-0.5">
            Spesa mensile stimata
          </span>

          {monthlyCost !== null && annualCost !== null ? (
            <div>
              <div className="flex items-baseline gap-1.5 lg:justify-end">
                <span className="text-3xl sm:text-4xl font-black text-[#0a2540] tracking-tight">
                  ~€{monthlyCost}
                </span>
                <span className="text-sm font-bold text-slate-500">/ mese</span>
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                ~€{Math.round(annualCost)} / anno
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500">
              Stima non disponibile
            </div>
          )}

          {/* Risparmio o Differenza Matematica */}
          {hasSavingsCalc ? (
            <div className="mt-2 text-sm">
              {isCheaper && (
                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md inline-block">
                  Risparmio stimato: ~€{Math.round(savingsEur)}/anno ({comparison.savingsPercent}%)
                </span>
              )}
              {isSame && (
                <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md inline-block">
                  Spesa equivalente alla tariffa attuale
                </span>
              )}
              {isMoreExpensive && (
                <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md inline-block">
                  Costo stimato maggiore: +€{Math.round(Math.abs(savingsEur))}/anno
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-1 text-xs text-slate-500 max-w-[240px]">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>Risparmio personale non disponibile senza il costo attuale</span>
            </div>
          )}
        </div>

        {/* Pulsante CTA con altezza minima 44px */}
        <button
          type="button"
          onClick={() => onViewDetails(comparison)}
          className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] active:bg-[#4b43d6] active:scale-[0.99] text-white text-sm font-bold transition-all shadow-xs hover:shadow-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff]"
        >
          <span>Dettagli e condizioni</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
};

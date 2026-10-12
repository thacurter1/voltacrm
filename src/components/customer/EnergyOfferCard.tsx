import React from 'react';
import { ArrowRight, Info } from 'lucide-react';
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

  const hasSavingsCalc = savingsEur !== null && currentAnnualCost !== null;
  const isCheaper = hasSavingsCalc && savingsEur > 0;
  const isSame = hasSavingsCalc && savingsEur === 0;
  const isMoreExpensive = hasSavingsCalc && savingsEur < 0;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 hover:border-[#635bff]/60 hover:shadow-[0_10px_30px_rgba(10,37,64,0.06)] transition-all p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
      {/* Colonna Sinistra: Icona Fornitura e Dettagli Offerta */}
      <div className="flex-1 min-w-0">
        <div className="space-y-2 flex-1">
          {/* Badge fornitore e caratteristiche reali */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-600">
              {offer.supplier}
            </span>
            {isDemoCatalog && <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">Catalogo demo</span>}
          </div>

          <h3 className="text-xl font-bold text-[#0a2540] leading-snug">
            {offer.name}
          </h3>

          {/* Dettagli tariffari trasparenti */}
          <p className="text-sm font-semibold text-[#0a2540]">{offer.pricingType === 'fixed' ? 'Prezzo fisso' : 'Prezzo indicizzato'}</p>
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
      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 gap-4 shrink-0">
        <div className="text-left lg:text-right">
          <span className="text-xs font-semibold text-slate-600 block">
            Spesa annua stimata
          </span>

          {annualCost !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-[#0a2540]">
                ~€{Math.round(annualCost)}
              </span>
              <span className="text-sm font-semibold text-slate-500">/anno</span>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500">
              Stima non disponibile
            </div>
          )}

          {/* Risparmio o Differenza Matematica */}
          {hasSavingsCalc ? (
            <div className="mt-1 text-sm">
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
            <div className="mt-1 flex items-start gap-1 text-xs text-slate-600 max-w-[220px]">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Risparmio personale non disponibile senza il costo attuale</span>
            </div>
          )}
        </div>

        {/* Pulsante CTA con altezza minima 44px */}
        <button
          type="button"
          onClick={() => onViewDetails(comparison)}
          className="w-full sm:w-auto min-h-[48px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff]"
        >
          <span>Dettagli e condizioni</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
};

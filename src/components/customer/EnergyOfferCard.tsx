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

  const monthlyCost = annualCost !== null ? Math.round(annualCost / 12) : null;

  const hasSavingsCalc = savingsEur !== null && currentAnnualCost !== null;
  const isCheaper = hasSavingsCalc && savingsEur > 0;
  const isSame = hasSavingsCalc && savingsEur === 0;
  const isMoreExpensive = hasSavingsCalc && savingsEur < 0;

  const pricingTypeLabel = offer.pricingType === 'fixed'
    ? 'Prezzo fisso'
    : (offer.pricingType === 'indexed_pun' || isLuce)
      ? 'Variabile PUN + spread'
      : 'Variabile PSV + spread';

  const metaParts = [
    offer.supplier,
    pricingTypeLabel,
    offer.greenCertified ? '100% rinnovabile' : null,
    isDemoCatalog ? 'Catalogo demo' : null,
  ].filter(Boolean);

  return (
    <article className="bg-white rounded-xl border border-[#DCE5E8] hover:border-[#0A6847]/60 transition-colors p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 w-full min-w-0">
      {/* Sinistra: Identità offerta e condizioni trasparenti */}
      <div className="flex-1 min-w-0 w-full space-y-3">
        <div>
          <p className="text-xs font-semibold text-[#445966]">
            {metaParts.join(' · ')}
          </p>
          <h3 className="text-xl font-bold text-[#0F222D] leading-snug mt-0.5 break-words">
            {offer.name}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#DCE5E8] text-xs sm:text-sm">
          <div>
            <span className="text-[#445966] block">Materia energia</span>
            <strong className="text-[#0A6847] font-bold tabular-nums text-base">
              {offer.pricingType === 'fixed'
                ? `${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`
                : `${isLuce ? 'PUN' : 'PSV'} + ${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`}
            </strong>
          </div>

          <div>
            <span className="text-[#445966] block">Quota fissa (CCV/PCV)</span>
            <strong className="text-[#0F222D] font-bold tabular-nums">
              {offer.fixedAnnualFee} €/anno ({(offer.fixedAnnualFee / 12).toFixed(2)} €/mese)
            </strong>
          </div>

          <div>
            <span className="text-[#445966] block">Durata condizioni</span>
            <strong className="text-[#0F222D] font-semibold">
              {offer.durationMonths} mesi
            </strong>
          </div>
        </div>
      </div>

      {/* Destra: Stima mensile/annua e azione principale */}
      <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-[#DCE5E8] gap-4 shrink-0">
        <div className="text-left lg:text-right">
          <span className="text-xs font-semibold text-[#445966] block mb-0.5">
            Spesa stimata
          </span>

          {monthlyCost !== null && annualCost !== null ? (
            <div>
              <div className="flex items-baseline gap-1.5 lg:justify-end">
                <span className="text-3xl font-extrabold text-[#0F222D] tracking-tight tabular-nums">
                  ~€{monthlyCost}
                </span>
                <span className="text-sm font-semibold text-[#445966]">/mese</span>
              </div>
              <div className="text-xs sm:text-sm font-semibold text-[#445966] mt-0.5 tabular-nums">
                ~€{Math.round(annualCost)} /anno
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-[#445966]">
              Stima non disponibile
            </div>
          )}

          {hasSavingsCalc ? (
            <div className="mt-2 text-xs font-bold">
              {isCheaper && (
                <span className="text-[#0A6847] tabular-nums">
                  Risparmio stimato: ~€{Math.round(savingsEur)}/anno ({comparison.savingsPercent}%)
                </span>
              )}
              {isSame && (
                <span className="text-[#445966]">
                  Spesa equivalente alla tariffa attuale
                </span>
              )}
              {isMoreExpensive && (
                <span className="text-[#9A4D09] tabular-nums">
                  Costo stimato maggiore: +€{Math.round(Math.abs(savingsEur))}/anno
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-[#445966] max-w-[240px]">
              <Info className="w-3.5 h-3.5 text-[#445966] shrink-0 mt-0.5" aria-hidden="true" />
              <span>Risparmio personale non disponibile senza il costo attuale</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onViewDetails(comparison)}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-md bg-[#0A6847] hover:bg-[#085238] active:scale-[0.98] text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A6847]"
        >
          <span>Dettagli e condizioni</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};

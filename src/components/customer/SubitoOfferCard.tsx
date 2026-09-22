import React from 'react';
import { Zap, Flame, ShieldCheck, ArrowRight, Leaf } from 'lucide-react';
import { SupplierOffer } from '../../types';

interface SubitoOfferCardProps {
  offer: SupplierOffer;
  estimatedSavingsEur?: number;
  onSelectOffer: (offer: SupplierOffer) => void;
}

export const SubitoOfferCard: React.FC<SubitoOfferCardProps> = ({
  offer,
  estimatedSavingsEur,
  onSelectOffer,
}) => {
  const isLuce = offer.energyType === 'luce';
  const unitLabel = isLuce ? '€/kWh' : '€/Smc';
  const hasSavings = estimatedSavingsEur !== undefined && estimatedSavingsEur > 0;
  const displaySavings = hasSavings ? Math.round(estimatedSavingsEur) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-[#635bff]/40 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group">
      {/* Left Column: Supplier badge & Energy Type */}
      <div className="flex items-start gap-4 flex-1">
        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-xs ${
          isLuce
            ? 'bg-amber-50 text-amber-600 border border-amber-200'
            : 'bg-blue-50 text-blue-600 border border-blue-200'
        }`}>
          {isLuce ? <Zap className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
          <span className="text-[10px] font-black uppercase mt-0.5 tracking-wider">
            {offer.energyType}
          </span>
        </div>

        {/* Center Details */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {offer.supplier}
            </span>
            {offer.tag && (
              <span className="px-2 py-0.5 rounded-md bg-[#635bff]/10 border border-[#635bff]/25 text-[#635bff] text-[10px] font-bold">
                {offer.tag}
              </span>
            )}
            {offer.greenCertified && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold flex items-center gap-1">
                <Leaf className="w-3 h-3" />
                100% Green
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Verificato ARERA
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-[#635bff] transition-colors leading-snug">
            {offer.name}
          </h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <div>
              Prezzo materia prima:{' '}
              <span className="font-bold text-slate-900">
                {offer.pricingType === 'fixed'
                  ? `${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`
                  : `PUN + ${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`}
              </span>
            </div>
            <div>
              Quota fissa:{' '}
              <span className="font-bold text-slate-900">
                {offer.fixedAnnualFee} €/anno ({(offer.fixedAnnualFee / 12).toFixed(2)} €/mese)
              </span>
            </div>
            <div>
              Durata:{' '}
              <span className="font-semibold text-slate-700">
                {offer.durationMonths} Mesi garantiti
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Pricing, Estimated Savings & CTA */}
      <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-3 shrink-0">
        <div className="text-left md:text-right">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
            Risparmio Stimato
          </span>
          {displaySavings !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                ~€{displaySavings}
              </span>
              <span className="text-xs font-bold text-slate-500">/ anno</span>
            </div>
          ) : (
            <div className="flex flex-col items-start md:items-end">
              <span className="text-sm font-bold text-[#635bff]">
                Da bolletta
              </span>
              <span className="text-[10px] text-slate-400">Carica PDF per calcolo</span>
            </div>
          )}
        </div>

        <button
          onClick={() => onSelectOffer(offer)}
          className="px-5 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 group-hover:scale-105 active:scale-95"
        >
          <span>Attiva questa tariffa</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

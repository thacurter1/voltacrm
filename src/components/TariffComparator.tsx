import React, { useState } from 'react';
import { 
  Zap, 
  Flame, 
  Calculator, 
  Check, 
  Sparkles,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { MARKET_OFFERS, calculateAnnualCost } from '../services/energyEngine';
import { MarketIndex } from '../types';

interface TariffComparatorProps {
  marketIndex: MarketIndex;
}

export const TariffComparator: React.FC<TariffComparatorProps> = ({ marketIndex }) => {
  const [activeType, setActiveType] = useState<'luce' | 'gas'>('luce');
  const [filterPricing, setFilterPricing] = useState<'all' | 'fixed' | 'indexed'>('all');
  
  const [simKwh, setSimKwh] = useState<number>(3200);
  const [simSmc, setSimSmc] = useState<number>(1000);
  const [currentHypotheticalPrice, setCurrentHypotheticalPrice] = useState<number>(0.165);

  const offers = MARKET_OFFERS.filter((o) => {
    const matchesType = o.energyType === activeType;
    const matchesPricing = 
      filterPricing === 'all' 
        ? true 
        : filterPricing === 'fixed' 
          ? o.pricingType === 'fixed' 
          : o.pricingType.startsWith('indexed');
    return matchesType && matchesPricing;
  });

  const consumption = activeType === 'luce' ? simKwh : simSmc;

  const simulatedCurrentAnnualCost = calculateAnnualCost(
    { type: activeType, annualConsumption: consumption },
    'fixed',
    currentHypotheticalPrice,
    144.0
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e3e8ee]">
        <div>
          <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">Catalogo Tariffe & Preventivatore</h1>
          <p className="text-xs text-[#425466] mt-0.5">
            Listini sempre aggiornati sul mercato all'ingrosso (PUN Luce {marketIndex.punEurKwh.toFixed(4)} € e PSV Gas {marketIndex.psvEurSmc.toFixed(4)} €).
          </p>
        </div>

        {/* Stripe Segmented Pill Control */}
        <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-[#e3e8ee]">
          <button
            onClick={() => {
              setActiveType('luce');
              setCurrentHypotheticalPrice(0.165);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeType === 'luce'
                ? 'bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Luce Elettrica
          </button>
          <button
            onClick={() => {
              setActiveType('gas');
              setCurrentHypotheticalPrice(0.520);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeType === 'gas'
                ? 'bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                : 'text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-sky-500" />
            Gas Naturale
          </button>
        </div>
      </div>

      {/* Stripe Simulator Card */}
      <div className="p-5 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#635bff] tracking-wider uppercase">
          <Calculator className="h-4 w-4" />
          Simulatore di Spesa & Risparmio Immediato
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-[#425466] font-medium block mb-1">
              Consumo Annuo {activeType === 'luce' ? '(kWh)' : '(Smc)'}
            </label>
            <input
              type="number"
              value={consumption}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (activeType === 'luce') setSimKwh(val);
                else setSimSmc(val);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-bold font-mono focus:outline-none focus:border-[#635bff] focus:bg-white text-xs"
            />
          </div>

          <div>
            <label className="text-[#425466] font-medium block mb-1">
              Tariffa Attuale del Cliente (€/{activeType === 'luce' ? 'kWh' : 'Smc'})
            </label>
            <input
              type="number"
              step="0.005"
              value={currentHypotheticalPrice}
              onChange={(e) => setCurrentHypotheticalPrice(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-bold font-mono focus:outline-none focus:border-[#635bff] focus:bg-white text-xs"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-[#e3e8ee]">
            <div>
              <span className="text-[10px] text-[#425466] uppercase font-bold block">
                Costo Attuale Annuo Stimato
              </span>
              <span className="text-lg font-bold text-[#0a2540] font-mono">
                € {simulatedCurrentAnnualCost.toFixed(2)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">incl. oneri & imposte</span>
          </div>
        </div>
      </div>

      {/* Offers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {offers.map((offer) => {
          const annualCost = calculateAnnualCost(
            { type: activeType, annualConsumption: consumption },
            offer.pricingType,
            offer.unitPriceOrSpread,
            offer.fixedAnnualFee
          );

          const savings = Math.max(0, simulatedCurrentAnnualCost - annualCost);
          const savingsPct = Math.round((savings / simulatedCurrentAnnualCost) * 100);

          return (
            <div 
              key={offer.id}
              className="p-5 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-[#635bff]/40 hover:shadow-[0_6px_16px_rgba(99,91,255,0.06)] transition-all flex flex-col justify-between space-y-4"
            >
              {/* Header: Tag & Supplier */}
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-[#635bff] border border-indigo-100">
                  {offer.tag}
                </span>
                <span className="text-[11px] text-[#425466] font-medium">
                  {offer.durationMonths} Mesi
                </span>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-[#425466]">{offer.supplier}</span>
                <h3 className="text-base font-bold text-[#0a2540] mt-0.5">{offer.name}</h3>
              </div>

              {/* Pricing breakdown box */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-[#e3e8ee] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#425466]">Costo Materia:</span>
                  <span className="font-bold text-[#0a2540] font-mono">
                    {offer.pricingType === 'fixed' ? (
                      `${offer.unitPriceOrSpread.toFixed(4)} €/${activeType === 'luce' ? 'kWh' : 'Smc'}`
                    ) : (
                      `${activeType === 'luce' ? 'PUN' : 'PSV'} + ${offer.unitPriceOrSpread.toFixed(4)} €`
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#425466]">Quota Fissa CCV:</span>
                  <span className="font-medium text-slate-700">€ {offer.fixedAnnualFee.toFixed(0)} / anno ({Math.round(offer.fixedAnnualFee / 12)}€/m)</span>
                </div>
                {offer.greenCertified && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold pt-1 border-t border-[#e3e8ee]">
                    <Check className="h-3 w-3 text-emerald-600" /> Energia 100% Green Certificata
                  </div>
                )}
              </div>

              {/* Total Cost & Calculated Savings */}
              <div className="pt-2 border-t border-[#e3e8ee] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#425466] block uppercase font-bold">Spesa Totale Annua</span>
                  <span className="text-xl font-bold text-[#0a2540] font-mono">€ {annualCost.toFixed(0)}</span>
                </div>

                {savings > 30 && (
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-700 font-bold block uppercase">Risparmio Netto</span>
                    <span className="text-sm font-bold text-emerald-600 font-mono">
                      - €{savings.toFixed(0)}/a ({savingsPct}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

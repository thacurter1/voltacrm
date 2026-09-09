import React, { useState } from 'react';
import { SlidersHorizontal, Zap, Flame, X, TrendingUp, TrendingDown, Check } from 'lucide-react';
import { MarketIndex } from '../types';

interface MarketSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIndex: MarketIndex;
  onApplyIndex: (newIndex: MarketIndex) => void;
}

export const MarketSimulatorModal: React.FC<MarketSimulatorModalProps> = ({
  isOpen,
  onClose,
  currentIndex,
  onApplyIndex,
}) => {
  const [pun, setPun] = useState<number>(currentIndex.punEurKwh);
  const [psv, setPsv] = useState<number>(currentIndex.psvEurSmc);

  if (!isOpen) return null;

  const handleApply = () => {
    onApplyIndex({
      punEurKwh: pun,
      psvEurSmc: psv,
      lastUpdated: 'Simulazione Utente (Live Stress Test)',
      punTrend: pun > currentIndex.punEurKwh ? 'up' : pun < currentIndex.punEurKwh ? 'down' : 'stable',
      psvTrend: psv > currentIndex.psvEurSmc ? 'up' : psv < currentIndex.psvEurSmc ? 'down' : 'stable',
    });
    onClose();
  };

  const handlePreset = (presetPun: number, presetPsv: number) => {
    setPun(presetPun);
    setPsv(presetPsv);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex items-center justify-center">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs transition-opacity" 
      />

      <div className="relative w-full max-w-lg bg-white rounded-xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] p-6 space-y-6 text-xs">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#635bff] uppercase tracking-wider">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Stress Test di Mercato
            </span>
            <h3 className="text-lg font-bold text-[#0a2540] mt-0.5">
              Simula Scenario Indici PUN & PSV
            </h3>
            <p className="text-xs text-[#425466]">
              Verifica istantaneamente l'impatto di rialzi o ribassi sul portafoglio e sugli switch raccomandati a 120 giorni.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
            Scenari Preimpostati:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handlePreset(0.0890, 0.3100)}
              className="p-2 rounded-lg border border-[#e3e8ee] bg-slate-50 hover:bg-slate-100 text-[#0a2540] font-medium text-left cursor-pointer"
            >
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <TrendingDown className="h-3 w-3" /> Ribasso (-22%)
              </div>
              <span className="text-[10px] text-slate-500 block">PUN 0.089 €</span>
            </button>

            <button
              onClick={() => handlePreset(0.1145, 0.3820)}
              className="p-2 rounded-lg border border-[#e3e8ee] bg-slate-50 hover:bg-slate-100 text-[#0a2540] font-medium text-left cursor-pointer"
            >
              <div className="flex items-center gap-1 text-[#635bff] font-bold">
                ⚖️ Reale Oggi
              </div>
              <span className="text-[10px] text-slate-500 block">PUN 0.114 €</span>
            </button>

            <button
              onClick={() => handlePreset(0.1650, 0.5400)}
              className="p-2 rounded-lg border border-[#e3e8ee] bg-slate-50 hover:bg-slate-100 text-[#0a2540] font-medium text-left cursor-pointer"
            >
              <div className="flex items-center gap-1 text-rose-600 font-bold">
                <TrendingUp className="h-3 w-3" /> Shock (+44%)
              </div>
              <span className="text-[10px] text-slate-500 block">PUN 0.165 €</span>
            </button>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4 pt-2 border-t border-[#e3e8ee]">
          {/* PUN Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#0a2540] flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                PUN Luce All'Ingrosso:
              </span>
              <span className="font-mono font-bold text-sm text-[#0a2540]">
                {pun.toFixed(4)} €/kWh
              </span>
            </div>
            <input
              type="range"
              min="0.070"
              max="0.220"
              step="0.005"
              value={pun}
              onChange={(e) => setPun(Number(e.target.value))}
              className="w-full accent-[#635bff] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.070 € (Minimo)</span>
              <span>0.220 € (Picco Crisi)</span>
            </div>
          </div>

          {/* PSV Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#0a2540] flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-sky-500" />
                PSV Gas All'Ingrosso:
              </span>
              <span className="font-mono font-bold text-sm text-[#0a2540]">
                {psv.toFixed(4)} €/Smc
              </span>
            </div>
            <input
              type="range"
              min="0.250"
              max="0.750"
              step="0.01"
              value={psv}
              onChange={(e) => setPsv(Number(e.target.value))}
              className="w-full accent-[#635bff] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.250 € (Estate)</span>
              <span>0.750 € (Inverno Severo)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e3e8ee]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[#425466] font-medium cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium shadow-xs cursor-pointer active:scale-[0.99] transition-all flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Applica & Ricalcola Portafoglio
          </button>
        </div>
      </div>
    </div>
  );
};

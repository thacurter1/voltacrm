import React, { useState } from 'react';
import { SlidersHorizontal, Zap, Flame, X, TrendingUp, TrendingDown, Check, RefreshCw, Calendar, Clock } from 'lucide-react';
import { MarketIndex } from '../types';

interface MarketSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIndex: MarketIndex;
  onApplyIndex: (newIndex: MarketIndex) => void;
  onRefreshFromGme?: () => Promise<void> | void;
  isRefreshingFromGme?: boolean;
}

export const MarketSimulatorModal: React.FC<MarketSimulatorModalProps> = ({
  isOpen,
  onClose,
  currentIndex,
  onApplyIndex,
  onRefreshFromGme,
  isRefreshingFromGme = false,
}) => {
  const [pun, setPun] = useState<number>(currentIndex.punEurKwh);
  const [psv, setPsv] = useState<number>(currentIndex.psvEurSmc);
  const [prevIndex, setPrevIndex] = useState(currentIndex);

  if (prevIndex.punEurKwh !== currentIndex.punEurKwh || prevIndex.psvEurSmc !== currentIndex.psvEurSmc) {
    setPrevIndex(currentIndex);
    setPun(currentIndex.punEurKwh);
    setPsv(currentIndex.psvEurSmc);
  }

  if (!isOpen) return null;

  // Calcolo dinamico fasce ARERA F1, F2, F3 (o dai valori ufficiali ricevuti dal feed GME)
  const f1 = currentIndex.punF1 && pun === currentIndex.punEurKwh 
    ? currentIndex.punF1 
    : Number((pun * 1.12).toFixed(4));
  const f2 = currentIndex.punF2 && pun === currentIndex.punEurKwh 
    ? currentIndex.punF2 
    : Number((pun * 1.02).toFixed(4));
  const f3 = currentIndex.punF3 && pun === currentIndex.punEurKwh 
    ? currentIndex.punF3 
    : Number((pun * 0.88).toFixed(4));

  const handleApply = () => {
    onApplyIndex({
      ...currentIndex,
      punEurKwh: pun,
      psvEurSmc: psv,
      punF1: f1,
      punF2: f2,
      punF3: f3,
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

      <div className="relative w-full max-w-xl bg-white rounded-xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] p-6 space-y-6 text-xs max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#635bff] uppercase tracking-wider">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Feed & Stress Test di Mercato
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                GME Live
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#0a2540] mt-0.5">
              Simula Scenari PUN & PSV con Fasce F1/F2/F3
            </h3>
            <p className="text-xs text-[#425466]">
              Verifica l'impatto delle oscillazioni GME all'ingrosso su portafoglio clienti e switch raccomandati.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live GME Status & Action */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-700">Feed Ufficiale GME / ARERA</span>
            </div>
            <span className="text-[11px] text-slate-500 block">
              Ultimo aggiornamento: <strong className="text-slate-700">{currentIndex.lastUpdated}</strong>
            </span>
          </div>
          {onRefreshFromGme && (
            <button
              type="button"
              onClick={onRefreshFromGme}
              disabled={isRefreshingFromGme}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-[#0a2540] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#635bff] ${isRefreshingFromGme ? 'animate-spin' : ''}`} />
              <span>{isRefreshingFromGme ? 'Aggiornamento...' : 'Sincronizza Live'}</span>
            </button>
          )}
        </div>

        {/* Fasce Orarie ARERA F1, F2, F3 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3 text-amber-500" />
              Ripartizione Fasce Orarie ARERA Elettricità (PUN):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Pesatura Standard Nazionale</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Fascia F1 (Picco)</span>
              <span className="text-[10px] text-amber-700 block mb-1">Lun-Ven 8-19</span>
              <span className="font-mono font-bold text-xs text-amber-900 block">
                {f1.toFixed(4)} €/kWh
              </span>
            </div>
            <div className="p-2.5 rounded-lg border border-sky-200 bg-sky-50/50">
              <span className="text-[10px] font-bold text-sky-800 uppercase block">Fascia F2 (Intermedia)</span>
              <span className="text-[10px] text-sky-700 block mb-1">Lun-Ven 7-8 / 19-23</span>
              <span className="font-mono font-bold text-xs text-sky-900 block">
                {f2.toFixed(4)} €/kWh
              </span>
            </div>
            <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Fascia F3 (Off-Peak)</span>
              <span className="text-[10px] text-emerald-700 block mb-1">Notti, Sab & Festivi</span>
              <span className="font-mono font-bold text-xs text-emerald-900 block">
                {f3.toFixed(4)} €/kWh
              </span>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
            Scenari Preimpostati di Stress Test:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handlePreset(0.0890, 0.3100)}
              className="p-2 rounded-lg border border-[#e3e8ee] bg-slate-50 hover:bg-slate-100 text-[#0a2540] font-medium text-left cursor-pointer"
            >
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <TrendingDown className="h-3 w-3" /> Ribasso (-22%)
              </div>
              <span className="text-[10px] text-slate-500 block">PUN 0.089 €</span>
            </button>

            <button
              type="button"
              onClick={() => handlePreset(currentIndex.punEurKwh, currentIndex.psvEurSmc)}
              className="p-2 rounded-lg border border-[#e3e8ee] bg-slate-50 hover:bg-slate-100 text-[#0a2540] font-medium text-left cursor-pointer"
            >
              <div className="flex items-center gap-1 text-[#635bff] font-bold">
                ⚖️ Live GME Oggi
              </div>
              <span className="text-[10px] text-slate-500 block">PUN {currentIndex.punEurKwh.toFixed(3)} €</span>
            </button>

            <button
              type="button"
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
                PUN Luce Monorario All'Ingrosso:
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
              <span>0.070 € (Minimo Storico)</span>
              <span>0.220 € (Picco Crisi)</span>
            </div>
          </div>

          {/* PSV Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[#0a2540] flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-sky-500" />
                PSV Gas Naturale All'Ingrosso:
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
              <span>0.250 € (Estate Minimo)</span>
              <span>0.750 € (Inverno Severo)</span>
            </div>
          </div>
        </div>

        {/* 6-Month Historical Table */}
        {currentIndex.historical6m && currentIndex.historical6m.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#e3e8ee]">
            <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[#635bff]" />
              Serie Storica Indici GME (Ultimi 6 Mesi Consuntivi):
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                  <tr>
                    <th className="py-2 px-3">Mese</th>
                    <th className="py-2 px-3 font-mono">PUN Elettrico</th>
                    <th className="py-2 px-3 font-mono">PSV Gas</th>
                    <th className="py-2 px-3 text-right">Azione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentIndex.historical6m.map((item) => (
                    <tr key={item.month} className="hover:bg-slate-50 transition-colors">
                      <td className="py-1.5 px-3 font-medium text-slate-700">{item.month}</td>
                      <td className="py-1.5 px-3 font-mono text-slate-900">{item.punEurKwh.toFixed(4)} €/kWh</td>
                      <td className="py-1.5 px-3 font-mono text-slate-900">{item.psvEurSmc.toFixed(4)} €/Smc</td>
                      <td className="py-1.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handlePreset(item.punEurKwh, item.psvEurSmc)}
                          className="text-[10px] font-bold text-[#635bff] hover:underline cursor-pointer"
                        >
                          Testa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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


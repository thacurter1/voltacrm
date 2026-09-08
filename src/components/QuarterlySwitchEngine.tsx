import React, { useState } from 'react';
import { 
  RefreshCw, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  Flame, 
  Clock,
  ArrowRight
} from 'lucide-react';
import { SwitchAudit } from '../types';
import { SwitchProposalModal } from './SwitchProposalModal';

interface QuarterlySwitchEngineProps {
  audits: SwitchAudit[];
  onTriggerGlobalAudit: () => void;
  onAuditSwitched: (auditId: string) => void;
}

export const QuarterlySwitchEngine: React.FC<QuarterlySwitchEngineProps> = ({
  audits,
  onTriggerGlobalAudit,
  onAuditSwitched,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'switch_recommended' | 'already_optimal'>('all');
  const [activeModalAudit, setActiveModalAudit] = useState<SwitchAudit | null>(null);

  const filteredAudits = audits.filter((a) => {
    if (filterStatus === 'all') return true;
    return a.status === filterStatus;
  });

  const recommendedSwitches = audits.filter((a) => a.status === 'switch_recommended');
  const totalPotentialSavings = recommendedSwitches.reduce((acc, a) => acc + a.annualSavings, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner: The 4-Month Engine Core Concept */}
      <div className="rounded-xl bg-white border border-[#e3e8ee] p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#635bff] border border-indigo-100 mb-2">
              <RefreshCw className="h-3 w-3" />
              Ciclo Continuo di Revisione (120 Giorni)
            </span>
            <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">
              Audit di Rinegoziazione Quadrimestrale
            </h1>
            <p className="text-xs text-[#425466] mt-0.5 max-w-2xl">
              Lo scanner automatico ricalcola la convenienza di tutti i contratti a portafoglio rispetto agli indici PUN e PSV aggiornati. 
              Se un nuovo fornitore offre condizioni più vantaggiose, l'account manager può applicare lo switch prima che il cliente subisca rincari.
            </p>
          </div>

          <button
            onClick={onTriggerGlobalAudit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium text-xs shadow-[0_1px_2px_rgba(99,91,255,0.3)] active:scale-[0.99] transition-all cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ricalcola Audit Globale
          </button>
        </div>

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#e3e8ee]">
          <div className="p-4 rounded-lg bg-[#f8fafc] border border-[#e3e8ee]">
            <span className="text-xs text-[#425466] block font-medium">Switch Raccomandati</span>
            <span className="text-2xl font-bold text-[#0a2540] mt-1 block font-mono">
              {recommendedSwitches.length} clienti
            </span>
            <span className="text-[11px] text-amber-700 font-medium">superano la soglia di convenienza</span>
          </div>

          <div className="p-4 rounded-lg bg-[#f8fafc] border border-[#e3e8ee]">
            <span className="text-xs text-[#425466] block font-medium">Risparmio Netto Portafoglio</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">
              € {totalPotentialSavings.toFixed(0)} <span className="text-xs text-[#425466]">/ anno</span>
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">generabile per i tuoi clienti</span>
          </div>

          <div className="p-4 rounded-lg bg-[#f8fafc] border border-[#e3e8ee]">
            <span className="text-xs text-[#425466] block font-medium">Retention Rate del Broker</span>
            <span className="text-2xl font-bold text-[#635bff] mt-1 block font-mono">
              98.2%
            </span>
            <span className="text-[11px] text-slate-500 font-medium">azzeramento del tasso di abbandono</span>
          </div>
        </div>
      </div>

      {/* Filter Segmented Control */}
      <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-[#e3e8ee]">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-[#425466] hover:text-[#0a2540]'
          }`}
        >
          Tutti gli Audit ({audits.length})
        </button>
        <button
          onClick={() => setFilterStatus('switch_recommended')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            filterStatus === 'switch_recommended'
              ? 'bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-[#425466] hover:text-[#0a2540]'
          }`}
        >
          Switch Raccomandati ({recommendedSwitches.length})
        </button>
        <button
          onClick={() => setFilterStatus('already_optimal')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            filterStatus === 'already_optimal'
              ? 'bg-white text-[#0a2540] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-[#425466] hover:text-[#0a2540]'
          }`}
        >
          Tariffa Già Ottimale ({audits.filter(a => a.status === 'already_optimal').length})
        </button>
      </div>

      {/* Audits Table */}
      <div className="rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] text-[#425466] font-semibold border-b border-[#e3e8ee]">
              <tr>
                <th className="py-3.5 px-4">Cliente & Fornitura</th>
                <th className="py-3.5 px-4">Ciclo Attivo</th>
                <th className="py-3.5 px-4">Confronto Fornitori</th>
                <th className="py-3.5 px-4 text-right">Risparmio Netto</th>
                <th className="py-3.5 px-4 text-right">Azione Retention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e8ee]">
              {filteredAudits.map((audit) => {
                const isSwitchRecommended = audit.status === 'switch_recommended';

                return (
                  <tr key={audit.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Cliente */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0a2540] text-sm">{audit.customerName}</span>
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                          {audit.utilityType === 'luce' ? <Zap className="h-2.5 w-2.5 text-amber-500 mr-1" /> : <Flame className="h-2.5 w-2.5 text-sky-500 mr-1" />}
                          {audit.utilityType}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#425466] font-mono mt-0.5 block">{audit.podOrPdr}</span>
                    </td>

                    {/* Ciclo */}
                    <td className="py-3.5 px-4 text-[11px] text-[#425466]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span><strong>{audit.daysActive} giorni</strong> attivi</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Audit ogni 120gg</span>
                    </td>

                    {/* Confronto */}
                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>Attuale:</span>
                          <span className="line-through">{audit.currentSupplier} (€{audit.currentAnnualCost.toFixed(0)})</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-[#0a2540]">
                          <span>Migliore:</span>
                          <span className="text-indigo-700 font-bold">{audit.bestOffer.supplier}</span>
                          <span>(€{audit.bestOfferAnnualCost.toFixed(0)})</span>
                        </div>
                      </div>
                    </td>

                    {/* Risparmio */}
                    <td className="py-3.5 px-4 text-right">
                      {isSwitchRecommended ? (
                        <div>
                          <span className="font-bold text-emerald-600 text-sm font-mono">
                            + €{audit.annualSavings.toFixed(0)}/a
                          </span>
                          <span className="text-[11px] text-emerald-700 font-medium block">
                            (-{audit.savingsPercent}%)
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Ottimale
                          </span>
                          <span className="text-[10px] text-slate-400 block">Nessun cambio</span>
                        </div>
                      )}
                    </td>

                    {/* Azione */}
                    <td className="py-3.5 px-4 text-right">
                      {isSwitchRecommended ? (
                        <button
                          onClick={() => setActiveModalAudit(audit)}
                          className="px-3 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium text-xs inline-flex items-center gap-1 shadow-xs cursor-pointer active:scale-[0.99] transition-all"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Dossier Switch
                        </button>
                      ) : (
                        <button
                          onClick={() => alert(`Notifica automatica inviata a ${audit.customerName}: 'Gentile cliente, la tua tariffa luce/gas è monitorata ed è tuttora la più conveniente sul mercato.'`)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-slate-600 text-xs font-medium cursor-pointer transition-colors"
                        >
                          Invia Rassicurazione
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Switch Proposal Modal */}
      {activeModalAudit && (
        <SwitchProposalModal
          audit={activeModalAudit}
          isOpen={!!activeModalAudit}
          onClose={() => setActiveModalAudit(null)}
          onConfirmSwitch={(auditId) => {
            onAuditSwitched(auditId);
          }}
        />
      )}
    </div>
  );
};

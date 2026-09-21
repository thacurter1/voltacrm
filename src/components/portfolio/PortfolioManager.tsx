import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  Zap, 
  Flame, 
  Coins, 
  Search, 
  Filter, 
  Clock, 
  Briefcase
} from 'lucide-react';
import { Customer, UserProfile } from '../../types';
import { calculatePortfolioForecast, ConsultantPortfolioSummary } from '../../services/portfolioEngine';

interface PortfolioManagerProps {
  customers: Customer[];
  profiles?: UserProfile[];
  onSelectCustomer?: (customer: Customer) => void;
  onTriggerSwitchAudit?: (customerId: string) => void;
}

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({
  customers,
  profiles: _profiles,
  onSelectCustomer,
  onTriggerSwitchAudit
}) => {
  const [selectedConsultant, setSelectedConsultant] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSwitchStatus, setFilterSwitchStatus] = useState<'all' | 'due_soon' | 'upcoming'>('all');

  const summary = useMemo(() => {
    return calculatePortfolioForecast(customers);
  }, [customers]);

  // Active consultant portfolio or global
  const activeConsultantSummary: ConsultantPortfolioSummary | null = useMemo(() => {
    if (selectedConsultant === 'all') return null;
    return summary.consultants.find(c => c.consultantName === selectedConsultant) || null;
  }, [summary, selectedConsultant]);

  // Filtered customer forecast list
  const filteredForecasts = useMemo(() => {
    const list = activeConsultantSummary ? activeConsultantSummary.customers : summary.allForecasts;
    return list.filter(item => {
      const matchesSearch = 
        item.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.accountManager.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterSwitchStatus === 'due_soon') return item.status === 'due_soon';
      if (filterSwitchStatus === 'upcoming') return item.status === 'upcoming' || item.status === 'due_soon';
      return true;
    });
  }, [summary, activeConsultantSummary, searchQuery, filterSwitchStatus]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Portafoglio Clienti & Previsione Guadagni
              </h1>
              <p className="text-xs text-slate-400">
                Monitoraggio del portafoglio per consulente, rendita ricorrente e proiezione guadagni sui prossimi switch.
              </p>
            </div>
          </div>
        </div>

        {/* Global summary badge */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Rendita Ricorrente Totale</span>
            <span className="text-sm font-bold text-emerald-400">
              €{summary.totalProjectedAnnualRecurringEur.toLocaleString('it-IT')}/anno
            </span>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Stima Upfront Prossimi Switch</span>
            <span className="text-sm font-bold text-indigo-400">
              €{summary.totalProjectedUpfrontEur.toLocaleString('it-IT')}
            </span>
          </div>
        </div>
      </div>

      {/* Top KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Customers */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Clienti in Gestione</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {activeConsultantSummary ? activeConsultantSummary.totalCustomers : summary.totalCustomers}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span>{activeConsultantSummary ? activeConsultantSummary.totalUtilityPoints : summary.totalUtilityPoints} utenze</span>
            <span>•</span>
            <span className="text-emerald-400">{summary.consultants.length} consulenti</span>
          </div>
        </div>

        {/* Managed Volumes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Volumi Energia Gestiti</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 truncate">
            {Math.round((activeConsultantSummary ? activeConsultantSummary.totalKwh : summary.totalLuceKwh) / 1000).toLocaleString('it-IT')} MWh
          </div>
          <div className="text-xs text-slate-400 mt-1">
            + {Math.round((activeConsultantSummary ? activeConsultantSummary.totalSmc : summary.totalGasSmc)).toLocaleString('it-IT')} Smc gas
          </div>
        </div>

        {/* Projected Upfront Switch Commission */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Previsione Upfront Switch</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            €{(activeConsultantSummary ? activeConsultantSummary.projectedUpfrontSwitchEur : summary.totalProjectedUpfrontEur).toLocaleString('it-IT')}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-amber-300 font-medium">
              {activeConsultantSummary ? activeConsultantSummary.switchesNext30Days : summary.switchesNext30Days} a scadenza 30gg
            </span>
          </div>
        </div>

        {/* Projected Recurring Commission */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Ricorrente Mensile</span>
            <Briefcase className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">
            €{(activeConsultantSummary ? activeConsultantSummary.projectedMonthlyRecurringEur : summary.totalProjectedMonthlyRecurringEur).toLocaleString('it-IT')}
            <span className="text-xs text-slate-400 font-normal">/mese</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            €{(activeConsultantSummary ? activeConsultantSummary.projectedAnnualRecurringEur : summary.totalProjectedAnnualRecurringEur).toLocaleString('it-IT')} all'anno
          </div>
        </div>
      </div>

      {/* Consultant Selection Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Filtra per Portafoglio Consulente</h3>
          </div>
          <span className="text-xs text-slate-400">
            {summary.consultants.length} portafogli attivi
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setSelectedConsultant('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              selectedConsultant === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>Tutti i Portafogli</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
              {customers.length}
            </span>
          </button>

          {summary.consultants.map(c => (
            <button
              key={c.consultantName}
              onClick={() => setSelectedConsultant(c.consultantName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                selectedConsultant === c.consultantName
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{c.consultantName}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
                {c.totalCustomers} clienti
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                €{c.projectedUpfrontSwitchEur}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Switch Window Pipeline Breakdown for Active Portfolio */}
      {activeConsultantSummary && (
        <div className="bg-slate-900 border border-indigo-900/40 rounded-xl p-4 bg-gradient-to-r from-indigo-950/30 to-slate-900">
          <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
            Pipeline Rinegoziazione Switch: {activeConsultantSummary.consultantName}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-amber-400 font-semibold block text-[11px]">Entro 30 Giorni</span>
              <span className="text-lg font-bold text-white">{activeConsultantSummary.switchesNext30Days} contratti</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Switch imminente, preparare proposta comparatore</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-indigo-300 font-semibold block text-[11px]">Entro 60 Giorni</span>
              <span className="text-lg font-bold text-white">{activeConsultantSummary.switchesNext60Days} contratti</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Finestra di preavviso e contatto cliente</p>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-semibold block text-[11px]">Entro 90 Giorni</span>
              <span className="text-lg font-bold text-white">{activeConsultantSummary.switchesNext90Days} contratti</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Pipeline consolidata</p>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca cliente, comune, consulente..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterSwitchStatus}
            onChange={(e) => setFilterSwitchStatus(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Tutti i Clienti ({filteredForecasts.length})</option>
            <option value="due_soon">Scadenza Switch Imminente (&lt; 30gg)</option>
            <option value="upcoming">Scadenza entro 60gg</option>
          </select>
        </div>
      </div>

      {/* Customer Forecast Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Cliente & Città</th>
                <th className="py-3 px-4">Consulente</th>
                <th className="py-3 px-4">Forniture & Consumi</th>
                <th className="py-3 px-4">Prossima Scadenza Switch</th>
                <th className="py-3 px-4 text-right">Stima Upfront</th>
                <th className="py-3 px-4 text-right">Ricorrente Annuo</th>
                <th className="py-3 px-4 text-center">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {filteredForecasts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Nessun cliente trovato per i parametri impostati.
                  </td>
                </tr>
              ) : (
                filteredForecasts.map(item => {
                  const customerObj = customers.find(c => c.id === item.customerId);

                  return (
                    <tr 
                      key={item.customerId}
                      onClick={() => customerObj && onSelectCustomer && onSelectCustomer(customerObj)}
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-medium">
                        <div className="text-white font-bold">{item.customerName}</div>
                        <div className="text-slate-400 text-[11px]">{item.city}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-800 text-indigo-300 border border-slate-700 font-medium">
                          {item.accountManager}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {item.isDualFuel ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Dual Fuel (Luce + Gas)
                            </span>
                          ) : item.utilityTypes.includes('luce') ? (
                            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                              <Zap className="w-3 h-3" /> Luce
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                              <Flame className="w-3 h-3" /> Gas
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.totalKwh > 0 && `${item.totalKwh.toLocaleString()} kWh`}
                          {item.totalKwh > 0 && item.totalSmc > 0 && ' • '}
                          {item.totalSmc > 0 && `${item.totalSmc.toLocaleString()} Smc`}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px]">
                            {item.nextSwitchDate ? new Date(item.nextSwitchDate).toLocaleDateString('it-IT') : 'Da fissare'}
                          </span>
                          {item.status === 'due_soon' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                              Scade tra {item.daysUntilSwitch}gg
                            </span>
                          ) : item.status === 'upcoming' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Tra {item.daysUntilSwitch}gg
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                              Ottimale
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        €{item.projectedUpfrontEur}
                        {item.isDualFuel && <span className="text-[10px] text-emerald-500 block font-normal">+€25 bonus</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-blue-300">
                          €{item.projectedAnnualRecurringEur}/a
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          (€{item.projectedMonthlyRecurringEur}/m)
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onTriggerSwitchAudit) onTriggerSwitchAudit(item.customerId);
                          }}
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded text-xs font-medium transition cursor-pointer"
                        >
                          Audit Switch
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

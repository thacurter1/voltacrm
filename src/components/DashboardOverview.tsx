import React from 'react';
import { 
  RefreshCw, 
  ArrowUpRight, 
  Sparkles, 
  Calendar,
  ArrowRight,
  UserPlus
} from 'lucide-react';
import { Customer, Lead, SwitchAudit } from '../types';

interface DashboardOverviewProps {
  leads: Lead[];
  customers: Customer[];
  audits: SwitchAudit[];
  onNavigate: (tab: string) => void;
  onOpenAddCustomer?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  leads,
  customers,
  audits,
  onNavigate,
  onOpenAddCustomer,
}) => {
  const pendingAudits = audits.filter(a => a.status === 'switch_recommended');
  const totalPotentialSavings = pendingAudits.reduce((acc, a) => acc + a.annualSavings, 0);

  const stats = [
    {
      title: 'Lead Inbound (Mese Corrente)',
      value: leads.length,
      change: '+24.5%',
      isPositive: true,
      subtext: 'vs. mese precedente',
      action: () => onNavigate('leads'),
    },
    {
      title: 'Appuntamenti Call Center',
      value: leads.filter(l => l.status === 'appointment_booked' || l.status === 'in_negotiation').length,
      change: '+12.0%',
      isPositive: true,
      subtext: 'fissati questa settimana',
      action: () => onNavigate('callcenter'),
    },
    {
      title: 'Contratti Gestiti a Portafoglio',
      value: customers.length,
      change: '100%',
      isPositive: true,
      subtext: 'con delega continua attiva',
      action: () => onNavigate('crm'),
    },
    {
      title: 'Switch a 4 Mesi Raccomandati',
      value: pendingAudits.length,
      change: `€ ${totalPotentialSavings.toFixed(0)}`,
      isPositive: true,
      subtext: 'risparmio annuo netto rilevato',
      action: () => onNavigate('switch4m'),
      highlight: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Page Actions (Stripe style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e3e8ee]">
        <div>
          <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">Panoramica Operativa & Vendite</h1>
          <p className="text-xs text-[#425466] mt-0.5">
            Monitoraggio pipeline commerciale, agenda telemarketing e cicli di rinegoziazione a 120 giorni.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-xs font-medium text-[#425466] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
            Settembre 2026
          </div>
          {onOpenAddCustomer && (
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] hover:bg-slate-50 text-[#0a2540] font-bold text-xs shadow-2xs active:scale-[0.99] transition-all cursor-pointer"
              title="Registra subito un nuovo cliente"
            >
              <UserPlus className="h-3.5 w-3.5 text-[#635bff]" />
              <span>+ Nuovo Cliente</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('switch4m')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#635bff] text-white font-medium text-xs shadow-[0_1px_2px_rgba(99,91,255,0.3)] hover:bg-[#5851ea] active:scale-[0.99] transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Audit 4 Mesi ({pendingAudits.length})
          </button>
        </div>
      </div>

      {/* Stripe Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            onClick={stat.action}
            className={`p-5 rounded-xl border transition-all cursor-pointer bg-white ${
              stat.highlight
                ? 'border-[#635bff]/40 shadow-[0_4px_12px_rgba(99,91,255,0.08)] ring-1 ring-[#635bff]/20'
                : 'border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-[0_4px_10px_rgba(0,0,0,0.06)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#425466]">{stat.title}</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#0a2540] tracking-tight tabular-nums">
                {stat.value}
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                {stat.change}
              </span>
              <span className="text-[#425466] text-[11px]">{stat.subtext}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Stripe-style Workflow Section: "Il Ciclo di Retention a 4 Mesi" */}
      <div className="rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 border-b border-[#e3e8ee] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-[#635bff] border border-indigo-100 mb-2">
              <Sparkles className="h-3 w-3" />
              Automazione di Portafoglio
            </div>
            <h2 className="text-base font-bold text-[#0a2540] tracking-tight">
              Flusso Integrato: Marketing → Call Center → Switch Continuo ogni 4 Mesi
            </h2>
            <p className="text-xs text-[#425466] mt-0.5 max-w-2xl">
              Ogni cliente contrattualizzato entra in un ciclo di monitoraggio ricorrente a 120 giorni. 
              Il CRM rileva in anticipo i rincari del mercato e applica la tariffa più competitiva, azzerando il tasso di abbandono.
            </p>
          </div>

          <button
            onClick={() => onNavigate('leads')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#635bff] hover:text-[#5851ea] transition-colors cursor-pointer"
          >
            Nuova Campagna Inbound <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#e3e8ee] bg-[#fafcff]">
          {/* Step 1 */}
          <div className="p-5 space-y-2">
            <span className="text-[11px] font-bold text-[#635bff] tracking-wider uppercase block">
              01 • Ingestion Lead
            </span>
            <h3 className="text-sm font-semibold text-[#0a2540]">Marketing & Webhook</h3>
            <p className="text-xs text-[#425466] leading-relaxed">
              Meta Ads e Google Ads inviano anagrafica e consumi (kWh/Smc) con parsing immediato.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-5 space-y-2">
            <span className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase block">
              02 • Telemarketing
            </span>
            <h3 className="text-sm font-semibold text-[#0a2540]">Call Center & Agenda</h3>
            <p className="text-xs text-[#425466] leading-relaxed">
              L'operatore contatta il lead e fissa l'appuntamento (call o visita) per l'Energy Specialist.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-5 space-y-2">
            <span className="text-[11px] font-bold text-indigo-600 tracking-wider uppercase block">
              03 • Onboarding CRM
            </span>
            <h3 className="text-sm font-semibold text-[#0a2540]">Attivazione POD/PDR</h3>
            <p className="text-xs text-[#425466] leading-relaxed">
              Firma del primo contratto e della delega di brokeraggio per il monitoraggio continuo.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-5 space-y-2 bg-[#f4f7fc]">
            <span className="text-[11px] font-bold text-orange-600 tracking-wider uppercase block">
              04 • 120 Giorni
            </span>
            <h3 className="text-sm font-semibold text-[#0a2540]">Switch Tariffario</h3>
            <p className="text-xs text-[#425466] leading-relaxed">
              Al 120° giorno il sistema valuta il mercato. Se c'è risparmio, si cambia fornitore in 1 click!
            </p>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Pending Audits & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Clienti con Switch Raccomandato (Stripe Table) */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-[#e3e8ee] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0a2540]">Audit Quadrimestrali Richiesti</h3>
              <p className="text-xs text-[#425466]">Clienti attivi da oltre 120 giorni con risparmio positivo riscontrato</p>
            </div>
            <button 
              onClick={() => onNavigate('switch4m')}
              className="text-xs font-semibold text-[#635bff] hover:text-[#5851ea] cursor-pointer"
            >
              Vedi Tutti ({pendingAudits.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8fafc] text-[#425466] font-semibold border-b border-[#e3e8ee]">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Fornitura</th>
                  <th className="py-3 px-4">Attuale vs Nuovo</th>
                  <th className="py-3 px-4 text-right">Risparmio Netto</th>
                  <th className="py-3 px-4 text-center">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e8ee]">
                {pendingAudits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#0a2540] block">{item.customerName}</span>
                      <span className="text-[11px] text-[#425466] font-mono">{item.podOrPdr}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {item.utilityType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      <span className="text-slate-400 line-through block">{item.currentSupplier.split(' ')[0]} (€{item.currentAnnualCost.toFixed(0)})</span>
                      <span className="font-semibold text-[#0a2540]">{item.bestOffer.supplier} (€{item.bestOfferAnnualCost.toFixed(0)})</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-emerald-600 text-sm">
                        + €{item.annualSavings.toFixed(0)}/a
                      </span>
                      <span className="text-[10px] text-slate-400 block font-medium">({item.savingsPercent}%)</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onNavigate('switch4m')}
                        className="px-2.5 py-1 rounded-md bg-[#635bff] hover:bg-[#5851ea] text-white text-[11px] font-semibold cursor-pointer shadow-xs"
                      >
                        Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Quick Status & Call Center Live Desk */}
        <div className="rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#0a2540]">Desk Commerciale Rapido</h3>
          
          <div className="p-4 rounded-lg bg-slate-50 border border-[#e3e8ee] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#425466]">Operatori Call Center Attivi:</span>
              <span className="font-bold text-[#0a2540]">3 In Turno</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#425466]">Tempo Medio Presa Lead:</span>
              <span className="font-semibold text-emerald-600">4.2 minuti</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#425466]">Conversion Rate da Lead:</span>
              <span className="font-bold text-[#0a2540]">32.8%</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => onNavigate('onboarding')}
              className="w-full py-2.5 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span>Centro Onboarding & Attivazioni</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-indigo-600" />
            </button>

            {onOpenAddCustomer && (
              <button
                type="button"
                onClick={onOpenAddCustomer}
                className="w-full py-2.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-slate-600" />
                  <span>+ Registra Nuovo Cliente & POD</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}

            <button
              onClick={() => onNavigate('leads')}
              className="w-full py-2.5 px-3 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-xs font-semibold text-[#0a2540] flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Gestisci Coda Lead Inbound</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('callcenter')}
              className="w-full py-2.5 px-3 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-xs font-semibold text-[#0a2540] flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Apri Calendario Appuntamenti</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('tariffe')}
              className="w-full py-2.5 px-3 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-xs font-semibold text-[#0a2540] flex items-center justify-between transition-colors cursor-pointer"
            >
              <span>Simulatore Preventivi Tariffe</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

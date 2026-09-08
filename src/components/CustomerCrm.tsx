import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Zap, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Building,
  User
} from 'lucide-react';
import { Customer } from '../types';

interface CustomerCrmProps {
  customers: Customer[];
  onTriggerAuditForCustomer: (customerId: string) => void;
  onSelectCustomer: (customer: Customer) => void;
}

export const CustomerCrm: React.FC<CustomerCrmProps> = ({
  customers,
  onTriggerAuditForCustomer,
  onSelectCustomer,
}) => {
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter((c) => {
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.fiscalCode.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase()) ||
      c.utilityPoints.some((u) => u.podOrPdr.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const getDaysUntilAudit = (nextDateStr: string) => {
    const target = new Date(nextDateStr).getTime();
    const now = new Date().getTime();
    return Math.round((target - now) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e3e8ee]">
        <div>
          <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">Anagrafica Clienti & Forniture (POD / PDR)</h1>
          <p className="text-xs text-[#425466] mt-0.5">
            Dati tecnici, consumi e scadenze quadrimestrali per l'applicazione della miglior tariffa di mercato.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#425466]">Mandati con Delega Continua:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 font-bold text-emerald-700 text-xs">
            {customers.filter((c) => c.hasBrokerageMandate).length} / {customers.length}
          </span>
        </div>
      </div>

      {/* Stripe Filter Bar */}
      <div className="p-3 bg-white rounded-xl border border-[#e3e8ee] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex items-center gap-3 text-xs">
        <div className="flex-1 relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cerca cliente per nome, Codice Fiscale, POD o PDR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:bg-white text-xs transition-colors"
          />
        </div>
      </div>

      {/* Customer Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-white border border-[#e3e8ee] text-slate-400 text-xs">
            Nessun cliente corrisponde ai criteri di ricerca. Prova a inserire un altro nome, POD o PDR.
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const daysToAudit = getDaysUntilAudit(customer.nextSwitchAuditDate);
            const isAuditDue = daysToAudit <= 0;

            return (
              <div 
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className="p-6 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4 hover:border-[#635bff]/40 hover:shadow-[0_4px_12px_rgba(99,91,255,0.06)] transition-all cursor-pointer group"
              >
              {/* Header: Name, CF, Delegation & 4-Month Status */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e3e8ee] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-[#0a2540]">{customer.name}</h3>
                    {customer.hasBrokerageMandate ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Delega Switch Continua Attiva
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                        Firma Singola
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#425466]">
                    <span>CF / P.IVA: <strong className="font-mono text-[#0a2540]">{customer.fiscalCode}</strong></span>
                    <span>•</span>
                    <span>{customer.city}</span>
                    <span>•</span>
                    <span>Tel: <strong className="text-[#0a2540]">{customer.phone}</strong></span>
                    <span>•</span>
                    <span>Account: <strong className="text-[#0a2540]">{customer.accountManager}</strong></span>
                  </div>
                </div>

                {/* 120 Days Badge */}
                <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-lg border border-[#e3e8ee]">
                  <Clock className={`h-4 w-4 ${isAuditDue ? 'text-orange-500' : 'text-slate-400'}`} />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#425466] block">
                      Ciclo 4 Mesi (120gg)
                    </span>
                    {isAuditDue ? (
                      <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Scadenza raggiunta ({Math.abs(daysToAudit)} gg fa)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600">
                        Prossimo audit tra {daysToAudit} giorni
                      </span>
                    )}
                  </div>

                  {isAuditDue && (
                    <button
                      onClick={() => onTriggerAuditForCustomer(customer.id)}
                      className="ml-2 px-3 py-1.5 rounded-md bg-[#635bff] hover:bg-[#5851ea] text-white font-medium text-xs shadow-xs cursor-pointer inline-flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Verifica Switch
                    </button>
                  )}
                </div>
              </div>

              {/* Utility Points Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.utilityPoints.map((utility) => (
                  <div 
                    key={utility.id}
                    className="p-4 rounded-lg bg-[#f8fafc] border border-[#e3e8ee] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {utility.type === 'luce' ? (
                          <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200/60">
                            <Zap className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-md bg-sky-50 text-sky-600 border border-sky-200/60">
                            <Flame className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-bold uppercase text-[#0a2540]">
                            Fornitura {utility.type === 'luce' ? 'Luce (POD)' : 'Gas (PDR)'}
                          </span>
                          <span className="text-xs font-mono block text-slate-600 font-semibold">
                            {utility.podOrPdr}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-[#e3e8ee] text-[#425466]">
                        {utility.currentTariffType === 'fixed' ? 'Prezzo Fisso' : 'Indicizzato PUN/PSV'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-[#e3e8ee]">
                      <div>
                        <span className="text-[10px] text-[#425466] block">Fornitore</span>
                        <span className="font-semibold text-[#0a2540] truncate block">{utility.currentSupplier}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#425466] block">Consumo Annuo</span>
                        <span className="font-semibold text-[#0a2540] font-mono">
                          {utility.annualConsumption.toLocaleString()} {utility.type === 'luce' ? 'kWh' : 'Smc'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#425466] block">Prezzo Materia</span>
                        <span className="font-bold text-[#0a2540] font-mono">
                          {utility.currentUnitCost.toFixed(4)} €
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      </div>
    </div>
  );
};

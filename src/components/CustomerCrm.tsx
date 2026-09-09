import React, { useState } from 'react';
import { 
  Search, 
  Zap, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  UserPlus,
  UploadCloud,
  FileSearch,
  Users,
  Sparkles,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { Customer } from '../types';
import { AddCustomerModal } from './AddCustomerModal';
import { ImportCustomersModal } from './ImportCustomersModal';

interface CustomerCrmProps {
  customers: Customer[];
  onTriggerAuditForCustomer: (customerId: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  onAddCustomer?: (customer: Customer) => Promise<void> | void;
  onBatchAddCustomers?: (customers: Customer[]) => Promise<void> | void;
  onOpenBillOcr?: () => void;
  onNavigateToLeads?: () => void;
  onNavigateToOnboarding?: () => void;
}

export const CustomerCrm: React.FC<CustomerCrmProps> = ({
  customers,
  onTriggerAuditForCustomer,
  onSelectCustomer,
  onAddCustomer,
  onBatchAddCustomers,
  onOpenBillOcr,
  onNavigateToLeads,
  onNavigateToOnboarding,
}) => {
  const [search, setSearch] = useState('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-[#e3e8ee]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">Anagrafica Clienti & Forniture (POD / PDR)</h1>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-[#635bff] bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200/60 transition-colors cursor-pointer"
              title="Mostra la guida sulle 4 modalità di aggiunta clienti"
            >
              <HelpCircle className="h-3 w-3" />
              <span>{showGuide ? 'Nascondi Guida' : 'Come Aggiungere Clienti?'}</span>
            </button>
          </div>
          <p className="text-xs text-[#425466] mt-0.5">
            Gestione anagrafiche contrattualizzate, mandati di brokeraggio continuo e scadenze quadrimestrali ARERA.
          </p>
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {onNavigateToOnboarding && (
            <button
              type="button"
              onClick={onNavigateToOnboarding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-[#635bff] text-xs font-bold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
              title="Avvia il percorso di onboarding guidato per un nuovo cliente"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#635bff]" />
              <span>Percorso Onboarding</span>
            </button>
          )}

          {onOpenBillOcr && (
            <button
              type="button"
              onClick={onOpenBillOcr}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
              title="Estrai anagrafica e consumi scansionando una bolletta PDF o foto"
            >
              <FileSearch className="h-3.5 w-3.5 text-[#635bff]" />
              <span className="hidden sm:inline">Estrai da</span> Bolletta (OCR)
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
            title="Importa elenchi di clienti da file CSV o Excel"
          >
            <UploadCloud className="h-3.5 w-3.5 text-emerald-600" />
            <span>Importa CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-[0.99] min-h-[38px]"
            title="Registra manualmente un nuovo cliente con relative forniture"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Nuovo Cliente</span>
          </button>
        </div>
      </div>

      {/* Guide Banner: 4 Ways to Add Customers */}
      {showGuide && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/70 via-white to-sky-50/50 border border-indigo-100/80 shadow-xs space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#635bff]" />
              <h3 className="font-bold text-xs sm:text-sm text-[#0a2540]">
                4 Modalità per Inserire Clienti in VoltaCRM:
              </h3>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ✕ Chiudi
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Card 1: Modale Diretto */}
            <div 
              onClick={() => setIsAddCustomerModalOpen(true)}
              className="p-3 bg-white rounded-xl border border-indigo-100/80 hover:border-[#635bff]/50 hover:shadow-xs transition-all cursor-pointer group space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-[#635bff]" />
                  1. Inserimento Diretto
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#635bff] transition-colors" />
              </div>
              <p className="text-[11px] text-slate-500">
                Compila i dati anagrafici, associa POD/PDR e attiva il mandato di brokeraggio.
              </p>
              <span className="text-[10px] font-bold text-[#635bff] inline-block pt-1">Apri modulo →</span>
            </div>

            {/* Card 2: OCR Bolletta */}
            <div 
              onClick={() => {
                if (onOpenBillOcr) onOpenBillOcr();
              }}
              className="p-3 bg-white rounded-xl border border-indigo-100/80 hover:border-[#635bff]/50 hover:shadow-xs transition-all cursor-pointer group space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <FileSearch className="h-3.5 w-3.5 text-[#635bff]" />
                  2. Scanner OCR Bolletta
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#635bff] transition-colors" />
              </div>
              <p className="text-[11px] text-slate-500">
                Carica PDF/foto della bolletta: l'AI estrae intestatario, POD/PDR, spesa e crea il cliente.
              </p>
              <span className="text-[10px] font-bold text-[#635bff] inline-block pt-1">Avvia OCR →</span>
            </div>

            {/* Card 3: Lead Conversion */}
            <div 
              onClick={() => {
                if (onNavigateToLeads) onNavigateToLeads();
              }}
              className="p-3 bg-white rounded-xl border border-indigo-100/80 hover:border-[#635bff]/50 hover:shadow-xs transition-all cursor-pointer group space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-600" />
                  3. Conversione Lead
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors" />
              </div>
              <p className="text-[11px] text-slate-500">
                Dai contatti telemarketing/campagne: clicca "Converti in Cliente" sul lead firmato.
              </p>
              <span className="text-[10px] font-bold text-emerald-700 inline-block pt-1">Vai ai Lead →</span>
            </div>

            {/* Card 4: Import Massivo */}
            <div 
              onClick={() => setIsImportModalOpen(true)}
              className="p-3 bg-white rounded-xl border border-indigo-100/80 hover:border-[#635bff]/50 hover:shadow-xs transition-all cursor-pointer group space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                  <UploadCloud className="h-3.5 w-3.5 text-sky-600" />
                  4. Import Massivo CSV
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-sky-600 transition-colors" />
              </div>
              <p className="text-[11px] text-slate-500">
                Carica elenchi Excel/CSV: importa centinaia di anagrafiche e punti con un solo click.
              </p>
              <span className="text-[10px] font-bold text-sky-700 inline-block pt-1">Importa file →</span>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Filter Bar */}
      <div className="p-3 bg-white rounded-xl border border-[#e3e8ee] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cerca cliente per nome, Codice Fiscale, POD o PDR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:bg-white text-xs transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-[#425466] shrink-0">
          <span>Delega Continua:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 font-bold text-emerald-700">
            {customers.filter((c) => c.hasBrokerageMandate).length} / {customers.length}
          </span>
        </div>
      </div>

      {/* Customer Cards List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center rounded-2xl bg-white border border-[#e3e8ee] shadow-xs space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-[#635bff] flex items-center justify-center mx-auto">
              <Users className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-bold text-sm text-[#0a2540]">
                {search ? 'Nessun cliente corrisponde ai criteri di ricerca' : 'Nessun cliente ancora registrato'}
              </h3>
              <p className="text-xs text-slate-500">
                {search 
                  ? 'Prova a modificare i termini di ricerca oppure aggiungi subito un nuovo cliente con questi dati.'
                  : 'Inizia subito ad inserire i tuoi clienti per attivare l\'algoritmo di audit quadrimestrale continuo.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold shadow-xs cursor-pointer active:scale-[0.99] transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>+ Inserisci Nuovo Cliente</span>
              </button>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
              >
                <UploadCloud className="h-4 w-4 text-emerald-600" />
                <span>Importa Elenco CSV</span>
              </button>
              {onOpenBillOcr && (
                <button
                  type="button"
                  onClick={onOpenBillOcr}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                >
                  <FileSearch className="h-4 w-4 text-[#635bff]" />
                  <span>Carica Bolletta OCR</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const daysToAudit = getDaysUntilAudit(customer.nextSwitchAuditDate);
            const isAuditDue = daysToAudit <= 0;

            return (
              <div 
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className="p-4 sm:p-6 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4 hover:border-[#635bff]/40 hover:shadow-[0_4px_12px_rgba(99,91,255,0.06)] transition-all cursor-pointer group"
              >
              {/* Header: Name, CF, Delegation & 4-Month Status */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-[#e3e8ee] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[#0a2540]">{customer.name}</h3>
                    {customer.hasBrokerageMandate ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>Delega Switch Attiva</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                        Firma Singola
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#425466]">
                    <span>CF: <strong className="font-mono text-[#0a2540]">{customer.fiscalCode}</strong></span>
                    <span>•</span>
                    <span>{customer.city}</span>
                    <span>•</span>
                    <span>Tel: <strong className="text-[#0a2540]">{customer.phone}</strong></span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">Account: <strong className="text-[#0a2540]">{customer.accountManager}</strong></span>
                  </div>
                </div>

                {/* 120 Days Badge */}
                <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-[#e3e8ee]">
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 shrink-0 ${isAuditDue ? 'text-orange-500' : 'text-slate-400'}`} />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#425466] block">
                        Ciclo 4 Mesi (120gg)
                      </span>
                      {isAuditDue ? (
                        <span className="text-xs font-bold text-orange-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>Scadenza raggiunta ({Math.abs(daysToAudit)} gg fa)</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600">
                          Prossimo audit tra {daysToAudit} giorni
                        </span>
                      )}
                    </div>
                  </div>

                  {isAuditDue && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTriggerAuditForCustomer(customer.id);
                      }}
                      className="px-3 py-1.5 rounded-md bg-[#635bff] hover:bg-[#5851ea] text-white font-medium text-xs shadow-xs cursor-pointer inline-flex items-center gap-1 min-h-[36px]"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Verifica Switch</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Utility Points Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {customer.utilityPoints.map((utility) => (
                  <div 
                    key={utility.id}
                    className="p-3.5 sm:p-4 rounded-lg bg-[#f8fafc] border border-[#e3e8ee] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {utility.type === 'luce' ? (
                          <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200/60 shrink-0">
                            <Zap className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-md bg-sky-50 text-sky-600 border border-sky-200/60 shrink-0">
                            <Flame className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-bold uppercase text-[#0a2540] block truncate">
                            {utility.type === 'luce' ? 'Luce (POD)' : 'Gas (PDR)'}
                          </span>
                          <span className="text-xs font-mono block text-slate-600 font-semibold truncate">
                            {utility.podOrPdr}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-[#e3e8ee] text-[#425466] shrink-0">
                        {utility.currentTariffType === 'fixed' ? 'Prezzo Fisso' : 'Indicizzato'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-[#e3e8ee]">
                      <div>
                        <span className="text-[10px] text-[#425466] block">Fornitore</span>
                        <span className="font-semibold text-[#0a2540] truncate block">{utility.currentSupplier}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#425466] block">Consumo</span>
                        <span className="font-semibold text-[#0a2540] font-mono text-[11px] block truncate">
                          {utility.annualConsumption.toLocaleString()} {utility.type === 'luce' ? 'kWh' : 'Smc'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#425466] block">Prezzo</span>
                        <span className="font-bold text-[#0a2540] font-mono text-[11px] block truncate">
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

      {/* Modal Aggiungi Nuovo Cliente */}
      <AddCustomerModal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        onSave={async (newC) => {
          if (onAddCustomer) {
            await onAddCustomer(newC);
          }
        }}
      />

      {/* Modal Importazione Massiva Clienti via CSV/Excel */}
      <ImportCustomersModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={async (newCustomers) => {
          if (onBatchAddCustomers) {
            await onBatchAddCustomers(newCustomers);
          } else if (onAddCustomer) {
            for (const c of newCustomers) {
              await onAddCustomer(c);
            }
          }
        }}
      />
    </div>
  );
};

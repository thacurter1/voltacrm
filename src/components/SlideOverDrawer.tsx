import React, { useState } from 'react';
import { 
  X, 
  Zap, 
  Flame, 
  Clock, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  RefreshCw, 
  MessageSquare,
  UserCheck
} from 'lucide-react';
import { Customer, Lead } from '../types';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  lead?: Lead | null;
  onTriggerSwitch?: (customerId: string) => void;
  onConvertLeadToCustomer?: (lead: Lead) => void;
}

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  isOpen,
  onClose,
  customer,
  lead,
  onTriggerSwitch,
  onConvertLeadToCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'documents'>('details');

  if (!isOpen || (!customer && !lead)) return null;

  const title = customer ? customer.name : lead?.name;
  const subtitle = customer ? `Codice Fiscale: ${customer.fiscalCode}` : `Lead Marketing • ${lead?.source}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#0a2540]/30 backdrop-blur-xs transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-full sm:max-w-md bg-white border-l border-[#e3e8ee] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 sm:p-6 border-b border-[#e3e8ee] flex items-start justify-between bg-[#fcfdff]">
            <div className="space-y-1 pr-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#635bff] uppercase tracking-wider">
                {customer ? 'Cliente Attivo a Portafoglio' : 'Lead Inbound Marketing'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#0a2540] break-words">{title}</h2>
              <p className="text-xs text-[#425466] font-mono break-all">{subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="px-3 sm:px-6 border-b border-[#e3e8ee] flex gap-4 text-xs overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 font-semibold border-b-2 transition-colors cursor-pointer -mb-px shrink-0 ${
                activeTab === 'details' ? 'border-[#635bff] text-[#635bff]' : 'border-transparent text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              Dati Tecnici & Forniture
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-3 font-semibold border-b-2 transition-colors cursor-pointer -mb-px shrink-0 ${
                activeTab === 'timeline' ? 'border-[#635bff] text-[#635bff]' : 'border-transparent text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              Timeline 120 Giorni
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-3 font-semibold border-b-2 transition-colors cursor-pointer -mb-px shrink-0 ${
                activeTab === 'documents' ? 'border-[#635bff] text-[#635bff]' : 'border-transparent text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              Documenti & Mandati
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
            {/* TAB 1: DETAILS */}
            {activeTab === 'details' && (
              <div className="space-y-5">
                {/* Contact Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-[#e3e8ee] space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#425466] block">Contatti & Sede</span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono font-medium">{customer?.phone || lead?.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{customer?.email || lead?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{customer?.city || lead?.city}</span>
                    </div>
                  </div>
                </div>

                {/* If Customer: Utility Points */}
                {customer && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0a2540] uppercase tracking-wider">
                        Punti di Fornitura Attivi
                      </span>
                      <span className="text-[11px] text-[#635bff] font-semibold">
                        {customer.utilityPoints.length} Punti
                      </span>
                    </div>

                    {customer.utilityPoints.map((util) => (
                      <div key={util.id} className="p-4 rounded-xl border border-[#e3e8ee] bg-white space-y-3 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {util.type === 'luce' ? (
                              <div className="p-1.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
                                <Zap className="h-4 w-4" />
                              </div>
                            ) : (
                              <div className="p-1.5 rounded-md bg-sky-50 text-sky-600 border border-sky-200">
                                <Flame className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-xs uppercase text-[#0a2540]">
                                Fornitura {util.type}
                              </span>
                              <span className="font-mono text-slate-600 block text-[11px] font-semibold">
                                {util.podOrPdr}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {util.currentTariffType === 'fixed' ? 'Fissa' : 'PUN/PSV'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#e3e8ee]">
                          <div>
                            <span className="text-[10px] text-[#425466] block">Fornitore Oggi</span>
                            <span className="font-semibold text-[#0a2540]">{util.currentSupplier}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#425466] block">Consumo Annuo</span>
                            <span className="font-semibold text-[#0a2540] font-mono">
                              {util.annualConsumption.toLocaleString()} {util.type === 'luce' ? 'kWh' : 'Smc'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#425466] block">Tariffa Materia</span>
                            <span className="font-bold text-[#0a2540] font-mono">{util.currentUnitCost.toFixed(4)} €</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#425466] block">Quota Fissa (CCV)</span>
                            <span className="font-medium text-slate-700 font-mono">€ {util.currentFixedFeeYear}/anno</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* If Lead: Marketing Details */}
                {lead && (
                  <div className="p-4 rounded-xl border border-[#e3e8ee] bg-white space-y-3">
                    <span className="font-bold text-xs text-[#0a2540] block">Dettaglio Campagna Marketing</span>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <div>Canale Inbound: <strong>{lead.source}</strong></div>
                      <div>Data Registrazione: <strong>{new Date(lead.createdAt).toLocaleString('it-IT')}</strong></div>
                      <div>Stato Corrente: <strong className="uppercase">{lead.status}</strong></div>
                      {lead.notes && (
                        <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[#425466] italic">
                          "{lead.notes}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TIMELINE 120 GIORNI */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center gap-3">
                  <Clock className="h-4 w-4 text-[#635bff]" />
                  <div>
                    <span className="font-bold text-xs text-[#0a2540] block">Ciclo Ricorrente Quadrimestrale</span>
                    <span className="text-[11px] text-[#425466]">Monitoraggio automatico ogni 120 giorni dall'attivazione</span>
                  </div>
                </div>

                <div className="relative pl-6 border-l-2 border-slate-200 space-y-6 pt-2">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                    <div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {customer?.contractStartDate || 'Data Iniziale'}
                      </span>
                      <h4 className="font-bold text-xs text-[#0a2540] mt-0.5">Contratto Iniziale Sottoscritto</h4>
                      <p className="text-[11px] text-[#425466]">Firmata delega brokeraggio continuo per monitoraggio tariffe.</p>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-[#635bff] ring-4 ring-white" />
                    <div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {customer?.nextSwitchAuditDate || '120 Giorni'}
                      </span>
                      <h4 className="font-bold text-xs text-[#0a2540] mt-0.5">Audit Quadrimestrale (Attuale)</h4>
                      <p className="text-[11px] text-[#425466]">Il motore ha verificato il listino aggiornato e ha generato il calcolo comparativo.</p>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-slate-300 ring-4 ring-white" />
                    <div>
                      <span className="text-[11px] text-slate-400 font-mono">T + 240 Giorni</span>
                      <h4 className="font-bold text-xs text-slate-400 mt-0.5">Prossima Rinegoziazione</h4>
                      <p className="text-[11px] text-slate-400">Verifica automatica successiva programmata dal cron job.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-[#e3e8ee] bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#635bff]" />
                    <div>
                      <span className="font-semibold text-xs text-[#0a2540] block">Mandato_Brokeraggio_Firmato.pdf</span>
                      <span className="text-[10px] text-[#425466]">Firma Digitale OTP • Conforme GDPR</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-bold">Valido</span>
                </div>

                <div className="p-3 rounded-lg border border-[#e3e8ee] bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-500" />
                    <div>
                      <span className="font-semibold text-xs text-[#0a2540] block">Bolletta_Storica_Precedente.pdf</span>
                      <span className="text-[10px] text-[#425466]">Estratta via OCR • 2.4 MB</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#425466] font-medium">Archiviata</span>
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-3 sm:p-4 border-t border-[#e3e8ee] bg-[#fcfdff] flex items-center gap-2">
            {customer && onTriggerSwitch && (
              <button
                onClick={() => {
                  onTriggerSwitch(customer.id);
                  onClose();
                }}
                className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.99] transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Avvia Switch Offerta</span>
              </button>
            )}

            {lead && onConvertLeadToCustomer && (
              <button
                onClick={() => {
                  onConvertLeadToCustomer(lead);
                  onClose();
                }}
                className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.99] transition-all"
                title="Trasforma questo lead in cliente attivo completando l'anagrafica e le forniture"
              >
                <UserCheck className="h-4 w-4" />
                <span>Converti in Cliente Attivo</span>
              </button>
            )}

            <button
              onClick={() => alert(`Apertura WhatsApp Web per invio messaggio a ${customer?.phone || lead?.phone}`)}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-emerald-600 font-medium text-xs flex items-center justify-center cursor-pointer transition-colors"
              title="Invia WhatsApp"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

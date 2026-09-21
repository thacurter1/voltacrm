import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, 
  Calendar as CalendarIcon, 
  Upload, 
  Search, 
  MapPin, 
  Sparkles, 
  XCircle, 
  Zap
} from 'lucide-react';
import { Appointment, AppointmentStatus, Lead, LeadStatus, UserProfile } from '../../types';
import { AppointmentCalendar } from './AppointmentCalendar';
import { BulkCsvImportModal } from './BulkCsvImportModal';

interface CallCenterWorkspaceProps {
  leads: Lead[];
  consultants: UserProfile[];
  appointments: Appointment[];
  onUpdateLeadStatus: (leadId: string, status: LeadStatus, note?: string) => Promise<void> | void;
  onScheduleAppointment: (data: Omit<Appointment, 'id'> & { id?: string }) => Promise<void> | void;
  onUpdateAppointmentStatus: (id: string, status: AppointmentStatus) => Promise<void> | void;
  onConvertToCustomer?: (app: Appointment) => Promise<void> | void;
  onBulkImportSuccess?: () => void;
}

export const CallCenterWorkspace: React.FC<CallCenterWorkspaceProps> = ({
  leads,
  consultants,
  appointments,
  onUpdateLeadStatus,
  onScheduleAppointment,
  onUpdateAppointmentStatus,
  onConvertToCustomer,
  onBulkImportSuccess,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'calendar'>('queue');
  const [statusFilter, setStatusFilter] = useState<'all' | 'to_call' | 'queue' | 'booked' | 'lost'>('to_call');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState<Lead | null>(leads[0] || null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedulingTargetLead, setSchedulingTargetLead] = useState<Lead | null>(null);

  // Filter leads based on status and search query
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.phone.includes(searchQuery) ||
        l.city.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      switch (statusFilter) {
        case 'to_call':
          return l.status === 'new' || l.status === 'call_center_queue';
        case 'queue':
          return l.status === 'call_center_queue' || l.status === 'in_negotiation';
        case 'booked':
          return l.status === 'appointment_booked' || l.status === 'contract_signed';
        case 'lost':
          return l.status === 'unreachable' || l.status === 'lost';
        case 'all':
        default:
          return true;
      }
    });
  }, [leads, statusFilter, searchQuery]);

  // KPIs
  const totalLeads = leads.length;
  const toCallCount = leads.filter(l => l.status === 'new' || l.status === 'call_center_queue').length;
  const bookedCount = leads.filter(l => l.status === 'appointment_booked' || l.status === 'contract_signed').length;
  const lostCount = leads.filter(l => l.status === 'unreachable' || l.status === 'lost').length;
  const conversionRate = totalLeads > 0 ? ((bookedCount / totalLeads) * 100).toFixed(1) : '0.0';

  const handleOpenScheduleForLead = (lead: Lead) => {
    setSchedulingTargetLead(lead);
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (data: Omit<Appointment, 'id'> & { id?: string }) => {
    await onScheduleAppointment(data);
    if (schedulingTargetLead) {
      await onUpdateLeadStatus(schedulingTargetLead.id, 'appointment_booked', `Appuntamento fissato con ${data.agentName}`);
    }
    setIsScheduleModalOpen(false);
    setSchedulingTargetLead(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Sub-navigation */}
      <div className="bg-white border border-[#e3e8ee] rounded-xl p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-[#635bff] rounded-xl border border-indigo-200/60">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">
                Call Center & Marketing Dialer
              </h1>
              <p className="text-xs text-[#425466] mt-0.5">
                Gestione outbound marketing, import liste massive CSV e fissaggio appuntamenti con consulenti.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Sub-view toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-[#e3e8ee] text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('queue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeSubTab === 'queue' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#635bff]" />
              <span>Coda Chiamate ({toCallCount})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeSubTab === 'calendar' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-[#635bff]" />
              <span>Calendario Appuntamenti ({appointments.length})</span>
            </button>
          </div>

          {/* Bulk CSV Import Button */}
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer ml-auto lg:ml-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importa CSV Massivo</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e3e8ee] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-semibold text-[#425466] uppercase tracking-wider block">Lead Totali</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-[#0a2540] font-mono">{totalLeads}</span>
            <span className="text-xs text-slate-500">nel database</span>
          </div>
        </div>

        <div className="bg-white border border-[#e3e8ee] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">Da Contattare</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-700 font-mono">{toCallCount}</span>
            <span className="text-xs text-slate-500">prioritari</span>
          </div>
        </div>

        <div className="bg-white border border-[#e3e8ee] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Appuntamenti Presi</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-700 font-mono">{bookedCount}</span>
            <span className="text-xs text-emerald-700 font-bold font-mono">{conversionRate}% conv.</span>
          </div>
        </div>

        <div className="bg-white border border-[#e3e8ee] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Non Interessati / Lost</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-700 font-mono">{lostCount}</span>
            <span className="text-xs text-slate-500">scartati</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'calendar' ? (
        <AppointmentCalendar
          appointments={appointments}
          consultants={consultants}
          onScheduleAppointment={onScheduleAppointment}
          onUpdateStatus={onUpdateAppointmentStatus}
          onConvertToCustomer={onConvertToCustomer}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Lead Queue (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter Tabs & Search Bar */}
            <div className="bg-white border border-[#e3e8ee] rounded-xl p-3 sm:p-4 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-[#e3e8ee] text-xs font-semibold">
                  <button
                    onClick={() => setStatusFilter('to_call')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      statusFilter === 'to_call' 
                        ? 'bg-white text-amber-800 border border-amber-200 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Da Chiamare ({toCallCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('queue')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      statusFilter === 'queue' 
                        ? 'bg-white text-[#635bff] border border-indigo-200 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    In Coda / Recall
                  </button>
                  <button
                    onClick={() => setStatusFilter('booked')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      statusFilter === 'booked' 
                        ? 'bg-white text-emerald-800 border border-emerald-200 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Fissati ({bookedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('lost')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      statusFilter === 'lost' 
                        ? 'bg-white text-rose-800 border border-rose-200 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Scartati
                  </button>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      statusFilter === 'all' 
                        ? 'bg-white text-[#0a2540] border border-slate-300 shadow-2xs font-bold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tutti
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca nome, telefono, città..."
                    className="w-full sm:w-60 bg-white border border-[#e3e8ee] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
              </div>
            </div>

            {/* Lead Cards List */}
            <div className="space-y-3">
              {filteredLeads.length === 0 ? (
                <div className="bg-white border border-[#e3e8ee] rounded-xl p-12 text-center text-slate-500 shadow-xs">
                  <PhoneCall className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-semibold text-[#0a2540]">Nessun contatto presente in questa lista.</p>
                  <p className="text-xs text-[#425466] mt-1">Carica nuovi lead tramite CSV o seleziona un altro filtro.</p>
                </div>
              ) : (
                filteredLeads.map(lead => {
                  const isSelected = selectedLeadForCall?.id === lead.id;

                  return (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLeadForCall(lead)}
                      className={`bg-white border rounded-xl p-4 transition cursor-pointer shadow-xs ${
                        isSelected 
                          ? 'border-[#635bff] bg-indigo-50/20 ring-1 ring-[#635bff] shadow-sm' 
                          : 'border-[#e3e8ee] hover:border-slate-300 hover:bg-slate-50/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[#0a2540]">{lead.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                              {lead.source}
                            </span>
                            {lead.status === 'appointment_booked' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                Appuntamento Fissato
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#425466] mt-1.5">
                            <span className="flex items-center gap-1 font-mono text-[#0a2540] font-semibold">
                              <PhoneCall className="w-3 h-3 text-emerald-600" />
                              {lead.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {lead.city}
                            </span>
                            {lead.estimatedConsumptionKwh && (
                              <span className="flex items-center gap-1 text-amber-700 font-semibold font-mono">
                                <Zap className="w-3 h-3 text-amber-500" />
                                {lead.estimatedConsumptionKwh.toLocaleString()} kWh/a
                              </span>
                            )}
                          </div>

                          {lead.notes && (
                            <p className="text-xs text-[#425466] mt-2 bg-slate-50 p-2.5 rounded-lg border border-[#e3e8ee]">
                              {lead.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition active:scale-[0.98]"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>Chiama</span>
                          </a>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenScheduleForLead(lead);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#635bff] hover:bg-[#5851ea] text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer active:scale-[0.98]"
                          >
                            <CalendarIcon className="w-3 h-3" />
                            <span>Fissa Appuntamento</span>
                          </button>

                          {/* Quick status dropdown */}
                          <select
                            value={lead.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateLeadStatus(lead.id, e.target.value as LeadStatus)}
                            className="bg-white border border-[#e3e8ee] text-[#0a2540] rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                          >
                            <option value="new">Nuovo</option>
                            <option value="call_center_queue">In Chiamata</option>
                            <option value="appointment_booked">Appuntamento</option>
                            <option value="unreachable">Non Risponde</option>
                            <option value="lost">Non Interessato</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Call Assistant & AIDA Script (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#e3e8ee] rounded-xl p-4 sm:p-5 shadow-xs space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-[#0a2540]">Assistente Script AIDA</h3>
                </div>
                {selectedLeadForCall && (
                  <span className="text-[10px] text-[#635bff] font-mono font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    {selectedLeadForCall.name.split(' ')[0]}
                  </span>
                )}
              </div>

              {selectedLeadForCall ? (
                <div className="space-y-3.5 text-xs">
                  {/* Lead banner in script */}
                  <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                    <p className="text-[#0a2540] font-bold text-xs">{selectedLeadForCall.name}</p>
                    <p className="text-[#425466] text-[11px] mt-0.5 font-mono">{selectedLeadForCall.phone} • {selectedLeadForCall.city}</p>
                  </div>

                  {/* Step A: Attenzione */}
                  <div className="space-y-1">
                    <span className="font-bold text-amber-700 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      1. Attenzione (Hook 10s)
                    </span>
                    <p className="bg-amber-50/40 p-3 rounded-lg border border-amber-200/60 text-[#0a2540] leading-relaxed text-[11px]">
                      "Buongiorno Sig./Sig.ra <strong className="text-[#0a2540]">{selectedLeadForCall.name.split(' ')[0]}</strong>, la contatto da <strong>Volta Energia</strong> per una verifica gratuita dell'adeguamento tariffario luce e gas previsto dalle delibere ARERA per i residenti di <strong className="text-[#0a2540]">{selectedLeadForCall.city}</strong>."
                    </p>
                  </div>

                  {/* Step I: Interesse */}
                  <div className="space-y-1">
                    <span className="font-bold text-[#635bff] flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      2. Interesse (Pain Point)
                    </span>
                    <p className="bg-indigo-50/40 p-3 rounded-lg border border-indigo-200/60 text-[#0a2540] leading-relaxed text-[11px]">
                      "Negli ultimi mesi molti utenti nella sua zona stanno pagando quote fisse CCV fino a 144€/anno senza saperlo. Con la nostra analisi indipendente, il risparmio medio verificato è di <strong className="text-[#635bff]">220€ - 380€/anno</strong>."
                    </p>
                  </div>

                  {/* Step D: Desiderio */}
                  <div className="space-y-1">
                    <span className="font-bold text-emerald-700 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      3. Desiderio (Soluzione a zero rischi)
                    </span>
                    <p className="bg-emerald-50/40 p-3 rounded-lg border border-emerald-200/60 text-[#0a2540] leading-relaxed text-[11px]">
                      "Non le sto vendendo alcun fornitore telefonico: le mettiamo a disposizione gratuitamente uno dei nostri consulenti senior dedicati per un confronto trasparente tra i 12 maggiori operatori italiani."
                    </p>
                  </div>

                  {/* Step A: Azione */}
                  <div className="space-y-1">
                    <span className="font-bold text-sky-700 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      4. Azione (Close per Appuntamento)
                    </span>
                    <p className="bg-sky-50/40 p-3 rounded-lg border border-sky-200/60 text-[#0a2540] leading-relaxed text-[11px]">
                      "Possiamo fissare una breve consulenza telefonica di 15 minuti con il nostro specialista. Le andrebbe meglio domani mattina o nel primo pomeriggio?"
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenScheduleForLead(selectedLeadForCall)}
                    className="w-full py-2.5 bg-[#635bff] hover:bg-[#5851ea] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition active:scale-[0.99] mt-2"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Fissa Subito Appuntamento</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-xs">Seleziona un contatto dalla coda per visualizzare lo script AIDA personalizzato.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      <BulkCsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImportSuccess={() => {
          setIsCsvModalOpen(false);
          if (onBulkImportSuccess) onBulkImportSuccess();
        }}
      />

      {/* Embedded Scheduling Modal for a specific lead */}
      {isScheduleModalOpen && schedulingTargetLead && (
        <div className="fixed inset-0 z-50 bg-[#0a2540]/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e3e8ee] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs text-[#0a2540]">
            <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0a2540]">Assegna Appuntamento a Consulente</h3>
                <p className="text-xs text-[#425466]">Lead: <strong className="text-[#0a2540]">{schedulingTargetLead.name}</strong> ({schedulingTargetLead.phone})</p>
              </div>
              <button 
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setSchedulingTargetLead(null);
                }} 
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as any;
                const scheduledAt = `${form.date.value}T${form.time.value}:00Z`;
                handleScheduleSubmit({
                  leadId: schedulingTargetLead.id,
                  customerName: schedulingTargetLead.name,
                  phone: schedulingTargetLead.phone,
                  city: schedulingTargetLead.city,
                  agentName: form.agentName.value,
                  scheduledAt,
                  durationMinutes: Number(form.duration.value),
                  type: form.type.value,
                  status: 'scheduled',
                  notes: form.notes.value
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-[#0a2540] mb-1 font-semibold">
                  Consulente Assegnato *
                </label>
                <select
                  name="agentName"
                  defaultValue={consultants.find(c => c.role !== 'customer')?.name || 'Matteo Riva'}
                  className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] font-medium"
                >
                  {consultants.filter(c => c.role !== 'customer').map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.role === 'admin' ? 'Broker Lead' : 'Consulente'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Data</label>
                  <input
                    type="date"
                    name="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-2.5 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Ora</label>
                  <input
                    type="time"
                    name="time"
                    required
                    defaultValue="10:30"
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-2.5 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Durata</label>
                  <select
                    name="duration"
                    defaultValue={45}
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-2 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#425466] mb-1 font-medium">Tipologia</label>
                <select
                  name="type"
                  defaultValue="phone_consultation"
                  className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                >
                  <option value="phone_consultation">Consulenza Telefonica</option>
                  <option value="field_visit">Visita / Sopralluogo Presenziale</option>
                  <option value="video_call">Video Call (Google Meet / Teams)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#425466] mb-1 font-medium">Note Consulenza</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={schedulingTargetLead.notes || ''}
                  placeholder="Obiettivo chiamata, tariffa attuale del cliente..."
                  className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e3e8ee]">
                <button
                  type="button"
                  onClick={() => {
                    setIsScheduleModalOpen(false);
                    setSchedulingTargetLead(null);
                  }}
                  className="px-4 py-2 bg-white border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 rounded-lg font-semibold cursor-pointer transition shadow-2xs"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#635bff] hover:bg-[#5851ea] text-white rounded-lg font-bold shadow-2xs cursor-pointer transition active:scale-[0.98]"
                >
                  Conferma & Fissa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallCenterWorkspace;

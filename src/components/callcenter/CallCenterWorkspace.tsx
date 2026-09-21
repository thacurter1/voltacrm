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
  onBulkImportSuccess?: () => void;
}

export const CallCenterWorkspace: React.FC<CallCenterWorkspaceProps> = ({
  leads,
  consultants,
  appointments,
  onUpdateLeadStatus,
  onScheduleAppointment,
  onUpdateAppointmentStatus,
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Call Center & Marketing Dialer
              </h1>
              <p className="text-xs text-slate-400">
                Gestione outbound marketing, import liste massive CSV e fissaggio appuntamenti con consulenti.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Sub-view toggle */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs font-medium">
            <button
              onClick={() => setActiveSubTab('queue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                activeSubTab === 'queue' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Coda Chiamate ({toCallCount})
            </button>
            <button
              onClick={() => setActiveSubTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                activeSubTab === 'calendar' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendario Appuntamenti ({appointments.length})
            </button>
          </div>

          {/* Bulk CSV Import Button */}
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer ml-auto lg:ml-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Importa CSV Massivo
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Lead Totali</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-white">{totalLeads}</span>
            <span className="text-xs text-slate-500">nel database</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Da Contattare</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-400">{toCallCount}</span>
            <span className="text-xs text-slate-500">prioritari</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Appuntamenti Presi</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400">{bookedCount}</span>
            <span className="text-xs text-emerald-400 font-semibold">{conversionRate}% conv.</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Non Interessati / Lost</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-400">{lostCount}</span>
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
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Lead Queue (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Filter Tabs & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5">
                <div className="flex flex-wrap gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setStatusFilter('to_call')}
                    className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                      statusFilter === 'to_call' ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Da Chiamare ({toCallCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('queue')}
                    className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                      statusFilter === 'queue' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    In Coda / Recall
                  </button>
                  <button
                    onClick={() => setStatusFilter('booked')}
                    className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                      statusFilter === 'booked' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Fissati ({bookedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('lost')}
                    className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                      statusFilter === 'lost' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Scartati
                  </button>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                      statusFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
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
                    className="w-full sm:w-56 bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Lead Cards List */}
            <div className="space-y-3">
              {filteredLeads.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                  <PhoneCall className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-semibold">Nessun contatto presente in questa lista.</p>
                  <p className="text-xs text-slate-500 mt-1">Carica nuovi lead tramite CSV o seleziona un altro filtro.</p>
                </div>
              ) : (
                filteredLeads.map(lead => {
                  const isSelected = selectedLeadForCall?.id === lead.id;

                  return (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLeadForCall(lead)}
                      className={`bg-slate-900 border rounded-xl p-4 transition cursor-pointer ${
                        isSelected 
                          ? 'border-indigo-500 bg-slate-900/90 shadow-lg shadow-indigo-950/30' 
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{lead.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {lead.source}
                            </span>
                            {lead.status === 'appointment_booked' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                Appuntamento Fissato
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                            <span className="flex items-center gap-1 font-mono text-slate-300">
                              <PhoneCall className="w-3 h-3 text-emerald-400" />
                              {lead.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {lead.city}
                            </span>
                            {lead.estimatedConsumptionKwh && (
                              <span className="flex items-center gap-1 text-amber-300">
                                <Zap className="w-3 h-3" />
                                {lead.estimatedConsumptionKwh.toLocaleString()} kWh/a
                              </span>
                            )}
                          </div>

                          {lead.notes && (
                            <p className="text-xs text-slate-400 mt-2 bg-slate-950/50 p-2 rounded border border-slate-800/80">
                              {lead.notes}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
                          >
                            <PhoneCall className="w-3 h-3" />
                            Chiama
                          </a>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenScheduleForLead(lead);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                          >
                            <CalendarIcon className="w-3 h-3" />
                            Fissa Appuntamento
                          </button>

                          {/* Quick status dropdown */}
                          <select
                            value={lead.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdateLeadStatus(lead.id, e.target.value as LeadStatus)}
                            className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl space-y-4 sticky top-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Assistente Script AIDA</h3>
                </div>
                {selectedLeadForCall && (
                  <span className="text-[10px] text-indigo-400 font-mono font-medium">
                    {selectedLeadForCall.name.split(' ')[0]}
                  </span>
                )}
              </div>

              {selectedLeadForCall ? (
                <div className="space-y-3.5 text-xs">
                  {/* Lead banner in script */}
                  <div className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/60">
                    <p className="text-slate-300 font-semibold">{selectedLeadForCall.name}</p>
                    <p className="text-slate-400 text-[11px]">{selectedLeadForCall.phone} • {selectedLeadForCall.city}</p>
                  </div>

                  {/* Step A: Attenzione */}
                  <div className="space-y-1">
                    <span className="font-bold text-amber-400 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      1. Attenzione (Hook 10s)
                    </span>
                    <p className="bg-slate-950/60 p-2.5 rounded border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                      "Buongiorno Sig./Sig.ra <strong className="text-white">{selectedLeadForCall.name.split(' ')[0]}</strong>, la contatto da <strong>VoltaCRM Energy</strong> per una verifica gratuita dell'adeguamento tariffario luce e gas previsto dalle delibere ARERA per i residenti di <strong className="text-white">{selectedLeadForCall.city}</strong>."
                    </p>
                  </div>

                  {/* Step I: Interesse */}
                  <div className="space-y-1">
                    <span className="font-bold text-indigo-400 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      2. Interesse (Pain Point)
                    </span>
                    <p className="bg-slate-950/60 p-2.5 rounded border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                      "Negli ultimi mesi molti utenti nella sua zona stanno pagando quote fisse CCV fino a 144€/anno senza saperlo. Con la nostra analisi indipendente, il risparmio medio verificato è di <strong>220€ - 380€/anno</strong>."
                    </p>
                  </div>

                  {/* Step D: Desiderio */}
                  <div className="space-y-1">
                    <span className="font-bold text-emerald-400 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      3. Desiderio (Soluzione a zero rischi)
                    </span>
                    <p className="bg-slate-950/60 p-2.5 rounded border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                      "Non le sto vendendo alcun fornitore telefonico: le mettiamo a disposizione gratuitamente uno dei nostri consulenti senior dedicati per un confronto trasparente tra i 12 maggiori operatori italiani."
                    </p>
                  </div>

                  {/* Step A: Azione */}
                  <div className="space-y-1">
                    <span className="font-bold text-blue-400 flex items-center gap-1 uppercase text-[10px] tracking-wider">
                      4. Azione (Close per Appuntamento)
                    </span>
                    <p className="bg-slate-950/60 p-2.5 rounded border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                      "Possiamo fissare una breve consulenza telefonica di 15 minuti con il nostro specialista. Le andrebbe meglio domani mattina o nel primo pomeriggio?"
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenScheduleForLead(selectedLeadForCall)}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg cursor-pointer transition mt-2"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    Fissa Subito Appuntamento
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Assegna Appuntamento a Consulente</h3>
                <p className="text-xs text-slate-400">Lead: <strong className="text-white">{schedulingTargetLead.name}</strong> ({schedulingTargetLead.phone})</p>
              </div>
              <button 
                onClick={() => {
                  setIsScheduleModalOpen(false);
                  setSchedulingTargetLead(null);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
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
                <label className="block text-slate-400 mb-1 font-semibold text-indigo-300">
                  Consulente Assegnato *
                </label>
                <select
                  name="agentName"
                  defaultValue={consultants.find(c => c.role !== 'customer')?.name || 'Matteo Riva'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
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
                  <label className="block text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    name="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ora</label>
                  <input
                    type="time"
                    name="time"
                    required
                    defaultValue="10:30"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Durata</label>
                  <select
                    name="duration"
                    defaultValue={45}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tipologia</label>
                <select
                  name="type"
                  defaultValue="phone_consultation"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="phone_consultation">Consulenza Telefonica</option>
                  <option value="field_visit">Visita / Sopralluogo Presenziale</option>
                  <option value="video_call">Video Call (Google Meet / Teams)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Note Consulenza</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={schedulingTargetLead.notes || ''}
                  placeholder="Obiettivo chiamata, tariffa attuale del cliente..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsScheduleModalOpen(false);
                    setSchedulingTargetLead(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow cursor-pointer"
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

import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  PhoneCall, 
  MapPin, 
  Video, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Filter,
  Sparkles,
  User,
  ArrowRight
} from 'lucide-react';
import { Appointment, AppointmentStatus, AppointmentType, Lead } from '../types';

interface CallCenterAgendaProps {
  appointments: Appointment[];
  leads: Lead[];
  onAddAppointment: (appointment: Appointment) => void;
  onUpdateStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onConvertToCustomer: (appointment: Appointment) => void;
}

export const CallCenterAgenda: React.FC<CallCenterAgendaProps> = ({
  appointments,
  onUpdateStatus,
  onConvertToCustomer,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const agents = Array.from(new Set(appointments.map((a) => a.agentName)));

  const filteredAppointments = appointments.filter((a) => {
    const matchesAgent = selectedAgent === 'all' || a.agentName === selectedAgent;
    const matchesType = selectedType === 'all' || a.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus;
    return matchesAgent && matchesType && matchesStatus;
  });

  const getTypeIcon = (type: AppointmentType) => {
    switch (type) {
      case 'phone_consultation':
        return <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />;
      case 'field_visit':
        return <MapPin className="h-3.5 w-3.5 text-amber-600" />;
      case 'video_call':
        return <Video className="h-3.5 w-3.5 text-[#635bff]" />;
    }
  };

  const getTypeLabel = (type: AppointmentType) => {
    switch (type) {
      case 'phone_consultation':
        return 'Consulenza Telefonica';
      case 'field_visit':
        return 'Visita Commerciale Presenziale';
      case 'video_call':
        return 'Video Call';
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Programmato
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Concluso / Contrattualizzato
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Annullato
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Non risponde
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e3e8ee]">
        <div>
          <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">Agenda Call Center & Appuntamenti</h1>
          <p className="text-xs text-[#425466] mt-0.5">
            Sincronizzazione tra operatori telemarketing ed Energy Specialist per visite e call commerciali.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#425466]">Appuntamenti filtrati:</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-[#e3e8ee] font-bold text-[#0a2540] text-xs">
            {filteredAppointments.length}
          </span>
        </div>
      </div>

      {/* Stripe Filter Bar */}
      <div className="p-3 bg-white rounded-xl border border-[#e3e8ee] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[#425466] font-medium">Consulente:</span>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] text-xs focus:outline-none focus:border-[#635bff] cursor-pointer"
          >
            <option value="all">Tutti i Consulenti</option>
            {agents.map((agent) => (
              <option key={agent} value={agent}>{agent}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[#425466] font-medium">Canale Incontro:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] text-xs focus:outline-none focus:border-[#635bff] cursor-pointer"
          >
            <option value="all">Tutte le Modalità</option>
            <option value="phone_consultation">Consulenza Telefonica</option>
            <option value="field_visit">Visita Presenziale</option>
            <option value="video_call">Video Call</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[#425466] font-medium">Stato:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] text-xs focus:outline-none focus:border-[#635bff] cursor-pointer"
          >
            <option value="all">Tutti gli Stati</option>
            <option value="scheduled">Programmati</option>
            <option value="completed">Conclusi</option>
            <option value="cancelled">Annullati</option>
          </select>
        </div>
      </div>

      {/* Appointments List */}
      <div className="grid grid-cols-1 gap-3.5">
        {filteredAppointments.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-white border border-[#e3e8ee] text-[#425466] text-xs">
            Nessun appuntamento corrisponde ai filtri selezionati.
          </div>
        ) : (
          filteredAppointments.map((app) => (
            <div 
              key={app.id}
              className="p-5 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Left Column: Meeting Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-slate-50 border border-slate-200">
                    {getTypeIcon(app.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#0a2540]">{app.customerName}</h3>
                    <p className="text-xs text-[#425466] flex items-center gap-2 mt-0.5">
                      <span className="font-medium text-slate-700">{getTypeLabel(app.type)}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-800 font-semibold">{app.phone}</span>
                      <span>•</span>
                      <span>{app.city}</span>
                    </p>
                  </div>
                </div>

                <div className="text-xs text-[#425466] bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 max-w-2xl">
                  <span className="font-medium text-[#0a2540]">Note Operatore:</span> "{app.notes}"
                </div>
              </div>

              {/* Middle/Right: Time & Consultant */}
              <div className="flex flex-col lg:items-end gap-1.5 min-w-[220px]">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0a2540] bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  {new Date(app.scheduledAt).toLocaleDateString('it-IT', { 
                    weekday: 'short', 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })} ({app.durationMinutes}m)
                </div>

                <div className="text-xs text-[#425466]">
                  Specialist: <strong className="text-[#0a2540]">{app.agentName}</strong>
                </div>

                <div>{getStatusBadge(app.status)}</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t lg:border-t-0 border-[#e3e8ee] pt-3 lg:pt-0">
                {app.status === 'scheduled' && (
                  <>
                    <button
                      onClick={() => onConvertToCustomer(app)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(5,150,105,0.3)] transition-all cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Chiudi Vendita & Inserisci in CRM
                    </button>

                    <button
                      onClick={() => onUpdateStatus(app.id, 'cancelled')}
                      className="p-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Annulla appuntamento"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </>
                )}

                {app.status === 'completed' && (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Attivo nel CRM (Ciclo 120gg Schedulato)
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

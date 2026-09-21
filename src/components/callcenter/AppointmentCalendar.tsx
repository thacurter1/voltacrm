import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  PhoneCall, 
  MapPin, 
  Video, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  X,
  Filter,
  Users
} from 'lucide-react';
import { Appointment, AppointmentStatus, AppointmentType, UserProfile } from '../../types';

interface AppointmentCalendarProps {
  appointments: Appointment[];
  consultants: UserProfile[];
  onScheduleAppointment: (data: Omit<Appointment, 'id'> & { id?: string }) => Promise<void> | void;
  onUpdateStatus?: (appointmentId: string, status: AppointmentStatus) => Promise<void> | void;
  onClose?: () => void;
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  consultants,
  onScheduleAppointment,
  onUpdateStatus,
  onClose
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [selectedConsultant, setSelectedConsultant] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Form state for scheduling
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    city: 'Milano',
    agentName: consultants[0]?.name || 'Matteo Riva (Broker Owner & Admin)',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '10:00',
    durationMinutes: 45,
    type: 'phone_consultation' as AppointmentType,
    notes: ''
  });

  // Filter consultants who can take appointments
  const activeConsultants = useMemo(() => {
    return consultants.filter(c => c.role !== 'customer');
  }, [consultants]);

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchConsultant = selectedConsultant === 'all' || apt.agentName.toLowerCase().includes(selectedConsultant.toLowerCase());
      const matchStatus = selectedStatus === 'all' || apt.status === selectedStatus;
      return matchConsultant && matchStatus;
    });
  }, [appointments, selectedConsultant, selectedStatus]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayOfMonth = useMemo(() => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Start Monday (0) to Sunday (6)
  }, [year, month]);

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleOpenScheduleForDate = (dayNumber: number) => {
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(dayNumber).padStart(2, '0');
    const targetDate = `${year}-${paddedMonth}-${paddedDay}`;
    setFormData(prev => ({ ...prev, scheduledDate: targetDate }));
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scheduledAt = `${formData.scheduledDate}T${formData.scheduledTime}:00Z`;
    await onScheduleAppointment({
      leadId: `lead-${Date.now()}`,
      customerName: formData.customerName,
      phone: formData.phone,
      city: formData.city,
      agentName: formData.agentName,
      scheduledAt,
      durationMinutes: Number(formData.durationMinutes),
      type: formData.type,
      status: 'scheduled',
      notes: formData.notes
    });
    setIsModalOpen(false);
    // Reset form
    setFormData({
      customerName: '',
      phone: '',
      city: 'Milano',
      agentName: consultants[0]?.name || 'Matteo Riva (Broker Owner & Admin)',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '10:00',
      durationMinutes: 45,
      type: 'phone_consultation',
      notes: ''
    });
  };

  const getTypeIcon = (type: AppointmentType) => {
    switch (type) {
      case 'phone_consultation': return <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />;
      case 'field_visit': return <MapPin className="w-3.5 h-3.5 text-amber-400" />;
      case 'video_call': return <Video className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'scheduled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">In Programma</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Completato</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">Annullato</span>;
      case 'no_show':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Non Risponde</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col">
      {/* Calendar Header */}
      <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Calendario Consulenze & Appuntamenti
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestione appuntamenti assegnati ai consulenti commerciali e tecnici
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* View mode toggle */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                viewMode === 'month' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mese
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Elenco
            </button>
          </div>

          {/* New Appointment Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            Nuovo Appuntamento
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-200 min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedConsultant}
              onChange={(e) => setSelectedConsultant(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="all">Tutti i Consulenti ({activeConsultants.length})</option>
              {activeConsultants.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 text-xs"
            >
              <option value="all">Tutti gli stati</option>
              <option value="scheduled">In Programma</option>
              <option value="completed">Completati</option>
              <option value="no_show">Non Risponde</option>
              <option value="cancelled">Annullati</option>
            </select>
          </div>
        </div>
      </div>

      {/* Month View Grid */}
      {viewMode === 'month' && (
        <div className="p-4 overflow-x-auto">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 mb-2">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mer</div>
            <div>Gio</div>
            <div>Ven</div>
            <div>Sab</div>
            <div>Dom</div>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty slots for start of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] rounded-lg bg-slate-950/30 border border-slate-800/40 p-1.5 opacity-30" />
            ))}

            {/* Days cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const paddedMonth = String(month + 1).padStart(2, '0');
              const paddedDay = String(dayNum).padStart(2, '0');
              const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
              
              const dayAppointments = filteredAppointments.filter(apt => apt.scheduledAt.startsWith(dateStr));
              const isToday = new Date().toISOString().startsWith(dateStr);

              return (
                <div 
                  key={dayNum}
                  onClick={() => handleOpenScheduleForDate(dayNum)}
                  className={`min-h-[90px] sm:min-h-[110px] rounded-lg border p-1.5 flex flex-col justify-between transition cursor-pointer hover:border-indigo-500/60 group ${
                    isToday ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-slate-800/30 border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday ? 'bg-indigo-600 text-white' : 'text-slate-400 group-hover:text-white'
                    }`}>
                      {dayNum}
                    </span>
                    {dayAppointments.length > 0 && (
                      <span className="text-[10px] px-1 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                        {dayAppointments.length}
                      </span>
                    )}
                  </div>

                  {/* Appointment cards inside cell */}
                  <div className="space-y-1 overflow-y-auto max-h-[75px] scrollbar-none">
                    {dayAppointments.slice(0, 2).map(apt => (
                      <div
                        key={apt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAppointment(apt);
                        }}
                        className={`text-[10px] p-1 rounded font-medium truncate flex items-center gap-1 border transition ${
                          apt.status === 'completed'
                            ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-300'
                            : apt.status === 'cancelled'
                            ? 'bg-rose-950/40 border-rose-700/50 text-rose-300'
                            : 'bg-indigo-950/60 border-indigo-700/50 text-indigo-200'
                        }`}
                        title={`${apt.customerName} - ${apt.agentName}`}
                      >
                        {getTypeIcon(apt.type)}
                        <span className="truncate">{apt.customerName.split(' ')[0]}</span>
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-[9px] text-slate-400 text-center font-medium">
                        +{dayAppointments.length - 2} altri
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-500 text-right opacity-0 group-hover:opacity-100 transition">
                    + Aggiungi
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="p-4 divide-y divide-slate-800 overflow-y-auto max-h-[500px]">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">Nessun appuntamento trovato per i filtri selezionati.</p>
            </div>
          ) : (
            filteredAppointments.map(apt => (
              <div 
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className="py-3 px-3 hover:bg-slate-800/40 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 cursor-pointer transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 mt-0.5">
                    {getTypeIcon(apt.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{apt.customerName}</h4>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(apt.scheduledAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} alle {new Date(apt.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ({apt.durationMinutes}m)
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {apt.city}
                      </span>
                      <span className="flex items-center gap-1 text-indigo-300">
                        <User className="w-3.5 h-3.5" />
                        {apt.agentName}
                      </span>
                    </div>
                    {apt.notes && (
                      <p className="text-xs text-slate-400 mt-1.5 italic bg-slate-950/40 px-2 py-1 rounded border border-slate-800/60 max-w-xl">
                        "{apt.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={`tel:${apt.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded border border-emerald-500/30 text-xs font-semibold transition"
                  >
                    <PhoneCall className="w-3 h-3" />
                    Chiama
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAppointment(apt);
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs font-medium transition cursor-pointer"
                  >
                    Dettagli
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Nuovo Appuntamento Consulenza</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nome Cliente / Contatto *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Es. Mario Rossi o Ristorante..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Telefono *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+39 340 0000000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Città / Comune</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Milano, Roma, Torino..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-indigo-300">Assegna a Consulente *</label>
                  <select
                    value={formData.agentName}
                    onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {activeConsultants.map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.role === 'admin' ? 'Broker Lead' : 'Consulente'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ora Inizio</label>
                  <input
                    type="time"
                    required
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Durata</label>
                  <select
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tipologia Appuntamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'phone_consultation' }))}
                    className={`p-2 rounded-lg border text-center font-medium transition cursor-pointer flex flex-col items-center gap-1 ${
                      formData.type === 'phone_consultation'
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Telefonica</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'field_visit' }))}
                    className={`p-2 rounded-lg border text-center font-medium transition cursor-pointer flex flex-col items-center gap-1 ${
                      formData.type === 'field_visit'
                        ? 'bg-amber-950/50 border-amber-500 text-amber-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Visita / Presenziale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'video_call' }))}
                    className={`p-2 rounded-lg border text-center font-medium transition cursor-pointer flex flex-col items-center gap-1 ${
                      formData.type === 'video_call'
                        ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Video Call</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Note & Dettagli Richiesta</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Es. Richiede verifica bolletta gas ristorante; interessato a tariffa fissa 12 mesi."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow cursor-pointer"
                >
                  Conferma & Assegna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Details & Status Update Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{selectedAppointment.customerName}</h3>
                <p className="text-xs text-slate-400">{selectedAppointment.city} • {selectedAppointment.phone}</p>
              </div>
              <button onClick={() => setSelectedAppointment(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Consulente Assegnato:</span>
                <span className="font-semibold text-indigo-400">{selectedAppointment.agentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Data e Ora:</span>
                <span>{new Date(selectedAppointment.scheduledAt).toLocaleString('it-IT')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Durata:</span>
                <span>{selectedAppointment.durationMinutes} minuti</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Stato Attuale:</span>
                <span>{getStatusBadge(selectedAppointment.status)}</span>
              </div>
              {selectedAppointment.notes && (
                <div className="pt-1">
                  <span className="text-slate-400 block mb-1">Note:</span>
                  <p className="bg-slate-800/60 p-2.5 rounded border border-slate-700/60 text-slate-200">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Change status actions */}
            {onUpdateStatus && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Aggiorna Esito Consulenza
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedAppointment.id, 'completed');
                      setSelectedAppointment(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completato con Successo
                  </button>

                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedAppointment.id, 'no_show');
                      setSelectedAppointment(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    Non Risponde / Recall
                  </button>

                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedAppointment.id, 'cancelled');
                      setSelectedAppointment(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Annullato dal Cliente
                  </button>

                  <a
                    href={`tel:${selectedAppointment.phone}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Chiama Subito
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

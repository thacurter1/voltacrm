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
  onConvertToCustomer?: (appointment: Appointment) => Promise<void> | void;
  onClose?: () => void;
}

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  consultants,
  onScheduleAppointment,
  onUpdateStatus,
  onConvertToCustomer,
  onClose
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
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

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 6) % 7; // Monday index 0

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

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      if (selectedConsultant !== 'all' && apt.agentName !== selectedConsultant) return false;
      if (selectedStatus !== 'all' && apt.status !== selectedStatus) return false;
      return true;
    });
  }, [appointments, selectedConsultant, selectedStatus]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scheduledAt = `${formData.scheduledDate}T${formData.scheduledTime}:00Z`;

    await onScheduleAppointment({
      leadId: `lead-direct-${Date.now()}`,
      customerName: formData.customerName,
      phone: formData.phone,
      city: formData.city,
      agentName: formData.agentName,
      scheduledAt,
      durationMinutes: formData.durationMinutes,
      type: formData.type,
      status: 'scheduled',
      notes: formData.notes
    });

    setIsModalOpen(false);
    setFormData({
      customerName: '',
      phone: '',
      city: 'Milano',
      agentName: activeConsultants[0]?.name || 'Matteo Riva',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '10:00',
      durationMinutes: 45,
      type: 'phone_consultation',
      notes: ''
    });
  };

  const handleOpenScheduleForDate = (dayNum: number) => {
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(dayNum).padStart(2, '0');
    setFormData(prev => ({
      ...prev,
      scheduledDate: `${year}-${paddedMonth}-${paddedDay}`
    }));
    setIsModalOpen(true);
  };

  const getTypeIcon = (type: AppointmentType) => {
    switch (type) {
      case 'phone_consultation':
        return <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />;
      case 'field_visit':
        return <MapPin className="w-3.5 h-3.5 text-amber-600" />;
      case 'video_call':
        return <Video className="w-3.5 h-3.5 text-[#635bff]" />;
    }
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'scheduled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-[#635bff] border border-indigo-200">In Programma</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completato</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Annullato</span>;
      case 'no_show':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Non Risponde</span>;
    }
  };

  return (
    <div className="bg-white border border-[#e3e8ee] rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Calendar Header */}
      <div className="p-4 sm:p-6 border-b border-[#e3e8ee] bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#635bff]" />
            <h2 className="text-lg font-bold text-[#0a2540] tracking-tight">
              Calendario Consulenze & Appuntamenti
            </h2>
          </div>
          <p className="text-xs text-[#425466] mt-0.5">
            Gestione appuntamenti assegnati ai consulenti commerciali e tecnici
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-[#e3e8ee] text-xs font-semibold">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'month' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              Mese
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466] hover:text-[#0a2540]'
              }`}
            >
              Elenco
            </button>
          </div>

          {/* New Appointment Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#635bff] hover:bg-[#5851ea] text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer ml-auto sm:ml-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Appuntamento</span>
          </button>

          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-4 py-3 bg-slate-50/50 border-b border-[#e3e8ee] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1 text-slate-500 hover:text-[#0a2540] hover:bg-slate-200 rounded transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-[#0a2540] min-w-[140px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 text-slate-500 hover:text-[#0a2540] hover:bg-slate-200 rounded transition cursor-pointer"
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
              className="bg-white border border-[#e3e8ee] text-[#0a2540] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] text-xs font-medium"
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
              className="bg-white border border-[#e3e8ee] text-[#0a2540] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] text-xs font-medium"
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
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-[#425466] mb-2">
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
              <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] rounded-lg bg-slate-50/50 border border-dashed border-[#e3e8ee] p-1.5 opacity-40" />
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
                  className={`min-h-[90px] sm:min-h-[110px] rounded-lg border p-1.5 flex flex-col justify-between transition cursor-pointer hover:border-[#635bff] group shadow-2xs ${
                    isToday 
                      ? 'bg-indigo-50/40 border-indigo-300' 
                      : 'bg-white border-[#e3e8ee] hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                      isToday ? 'bg-[#635bff] text-white' : 'text-slate-700 group-hover:text-[#0a2540]'
                    }`}>
                      {dayNum}
                    </span>
                    {dayAppointments.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-[#635bff] font-bold border border-indigo-200">
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
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : apt.status === 'cancelled'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : apt.status === 'no_show'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-indigo-50 border-indigo-200 text-[#635bff]'
                        }`}
                        title={`${apt.customerName} - ${apt.agentName}`}
                      >
                        {getTypeIcon(apt.type)}
                        <span className="truncate font-semibold">{apt.customerName.split(' ')[0]}</span>
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-[9px] text-[#425466] text-center font-medium">
                        +{dayAppointments.length - 2} altri
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 text-right opacity-0 group-hover:opacity-100 transition">
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
        <div className="p-4 divide-y divide-[#e3e8ee] overflow-y-auto max-h-[500px]">
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm font-semibold text-[#0a2540]">Nessun appuntamento trovato per i filtri selezionati.</p>
            </div>
          ) : (
            filteredAppointments.map(apt => (
              <div 
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className="py-3 px-3 hover:bg-slate-50/80 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 cursor-pointer transition"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 border border-[#e3e8ee] text-[#635bff] mt-0.5">
                    {getTypeIcon(apt.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#0a2540]">{apt.customerName}</h4>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#425466] mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(apt.scheduledAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} alle {new Date(apt.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ({apt.durationMinutes}m)
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {apt.city}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-[#635bff]">
                        <User className="w-3.5 h-3.5" />
                        {apt.agentName}
                      </span>
                    </div>
                    {apt.notes && (
                      <p className="text-xs text-[#425466] mt-1.5 italic bg-slate-50 px-2.5 py-1 rounded border border-[#e3e8ee] max-w-xl">
                        "{apt.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={`tel:${apt.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 text-xs font-bold transition"
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Chiama</span>
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAppointment(apt);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-[#e3e8ee] text-xs font-semibold transition cursor-pointer shadow-2xs"
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
        <div className="fixed inset-0 z-50 bg-[#0a2540]/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e3e8ee] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs text-[#0a2540]">
            <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#635bff]" />
                <h3 className="text-base font-bold text-[#0a2540]">Nuovo Appuntamento Consulenza</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Nome Cliente / Contatto *</label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Es. Mario Rossi o Ristorante..."
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Telefono *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+39 340 0000000"
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Città / Comune</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Milano, Roma, Torino..."
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
                <div>
                  <label className="block text-[#0a2540] mb-1 font-semibold">Assegna a Consulente *</label>
                  <select
                    value={formData.agentName}
                    onChange={(e) => setFormData(prev => ({ ...prev, agentName: e.target.value }))}
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] font-medium"
                  >
                    {activeConsultants.map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.role === 'admin' ? 'Broker Lead' : 'Consulente'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Data</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-2.5 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Ora Inizio</label>
                  <input
                    type="time"
                    required
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-2.5 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                </div>
                <div>
                  <label className="block text-[#425466] mb-1 font-medium">Durata</label>
                  <select
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                    className="w-full bg-white border border-[#e3e8ee] rounded-lg px-2 py-2 text-[#0a2540] focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#425466] mb-1 font-medium">Tipologia Appuntamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'phone_consultation' }))}
                    className={`p-2 rounded-lg border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                      formData.type === 'phone_consultation'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                        : 'bg-slate-50 border-[#e3e8ee] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Telefonica</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'field_visit' }))}
                    className={`p-2 rounded-lg border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                      formData.type === 'field_visit'
                        ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                        : 'bg-slate-50 border-[#e3e8ee] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Visita / Presenziale</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'video_call' }))}
                    className={`p-2 rounded-lg border text-center font-semibold transition cursor-pointer flex flex-col items-center gap-1 ${
                      formData.type === 'video_call'
                        ? 'bg-indigo-50 border-indigo-300 text-[#635bff] shadow-2xs'
                        : 'bg-slate-50 border-[#e3e8ee] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Video Call</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[#425466] mb-1 font-medium">Note & Dettagli Richiesta</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Es. Richiede verifica bolletta gas ristorante; interessato a tariffa fissa 12 mesi."
                  className="w-full bg-white border border-[#e3e8ee] rounded-lg px-3 py-2 text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e3e8ee]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 rounded-lg font-semibold cursor-pointer shadow-2xs transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#635bff] hover:bg-[#5851ea] text-white rounded-lg font-bold shadow-2xs cursor-pointer transition active:scale-[0.98]"
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
        <div className="fixed inset-0 z-50 bg-[#0a2540]/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e3e8ee] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs text-[#0a2540]">
            <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0a2540]">{selectedAppointment.customerName}</h3>
                <p className="text-xs text-[#425466]">{selectedAppointment.city} • {selectedAppointment.phone}</p>
              </div>
              <button onClick={() => setSelectedAppointment(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#425466]">Consulente Assegnato:</span>
                <span className="font-bold text-[#635bff]">{selectedAppointment.agentName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#425466]">Data e Ora:</span>
                <span className="font-mono">{new Date(selectedAppointment.scheduledAt).toLocaleString('it-IT')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#425466]">Durata:</span>
                <span>{selectedAppointment.durationMinutes} minuti</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#425466]">Stato Attuale:</span>
                <span>{getStatusBadge(selectedAppointment.status)}</span>
              </div>
              {selectedAppointment.notes && (
                <div className="pt-1">
                  <span className="text-[#425466] block mb-1">Note:</span>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-[#e3e8ee] text-slate-700">
                    {selectedAppointment.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Change status actions */}
            {onUpdateStatus && (
              <div className="pt-3 border-t border-[#e3e8ee] space-y-2">
                <span className="text-[11px] font-semibold text-[#425466] uppercase tracking-wider block">
                  Aggiorna Esito Consulenza
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedAppointment.id, 'completed');
                      setSelectedAppointment(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completato con Successo</span>
                  </button>

                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedAppointment.id, 'no_show');
                      setSelectedAppointment(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Non Risponde / Recall</span>
                  </button>

                  <button
                    onClick={async () => {
                      await onUpdateStatus(selectedAppointment.id, 'cancelled');
                      setSelectedAppointment(null);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold cursor-pointer transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Annullato dal Cliente</span>
                  </button>

                  <a
                    href={`tel:${selectedAppointment.phone}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#635bff] hover:bg-[#5851ea] text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Chiama Subito</span>
                  </a>
                </div>

                {onConvertToCustomer && (
                  <button
                    type="button"
                    onClick={async () => {
                      const app = selectedAppointment;
                      setSelectedAppointment(null);
                      await onConvertToCustomer(app);
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Perfeziona Contratto & Converti in Cliente CRM</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentCalendar;

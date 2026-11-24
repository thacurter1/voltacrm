import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Appointment, AppointmentType, Lead, UserProfile } from '../types';

interface ScheduleAppointmentModalProps {
  lead: Lead | null;
  consultants?: UserProfile[];
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (appointment: Appointment) => void;
}


const ScheduleAppointmentDialog: React.FC<{
  lead: Lead;
  consultants?: UserProfile[];
  onClose: () => void;
  onSchedule: (appointment: Appointment) => void;
}> = ({ lead, consultants, onClose, onSchedule }) => {
  const activeConsultants = (consultants || []).filter((c) => c.role !== 'customer');
  const [agentName, setAgentName] = useState(
    activeConsultants[0]?.name || 'Valentina Neri (Consulente Energetico)'
  );
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('11:00');
  const [duration, setDuration] = useState(45);
  const [type, setType] = useState<AppointmentType>('phone_consultation');
  const [notes, setNotes] = useState(lead.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const scheduledAt = `${date}T${time}:00Z`;

    const appointment: Appointment = {
      id: `app-${Date.now()}`,
      leadId: lead.id,
      customerName: lead.name,
      phone: lead.phone,
      city: lead.city,
      agentName,
      scheduledAt,
      durationMinutes: duration,
      type,
      status: 'scheduled',
      notes,
    };

    onSchedule(appointment);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#0F222D]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DCE5E8] rounded-xl w-full max-w-lg p-6 space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
        <div className="flex justify-between items-center border-b border-[#DCE5E8] pb-3">
          <div>
            <h3 className="font-bold text-base text-[#0F222D]">Fissa Appuntamento Commerciale</h3>
            <p className="text-xs text-[#425466]">Lead: <strong className="text-[#0F222D]">{lead.name}</strong> ({lead.phone})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-[#425466] font-medium block mb-1">Energy Specialist Assegnato</label>
            <select
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCE5E8] text-[#0F222D] focus:outline-none focus:border-[#0A6847]"
            >
              {activeConsultants.length > 0 ? (
                activeConsultants.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))
              ) : (
                <>
                  <option value="Matteo Riva (Broker Owner)">Matteo Riva (Broker Owner)</option>
                  <option value="Chiara Bianchi (Consulente Senior)">Chiara Bianchi (Consulente Senior)</option>
                  <option value="Valentina Neri (Consulente Energetico)">Valentina Neri (Consulente Energetico)</option>
                </>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#425466] font-medium block mb-1">Data Incontro</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCE5E8] text-[#0F222D] focus:outline-none focus:border-[#0A6847]"
              />
            </div>
            <div>
              <label className="text-[#425466] font-medium block mb-1">Orario</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCE5E8] text-[#0F222D] focus:outline-none focus:border-[#0A6847]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#425466] font-medium block mb-1">Modalità Incontro</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AppointmentType)}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCE5E8] text-[#0F222D] focus:outline-none focus:border-[#0A6847]"
              >
                <option value="phone_consultation">Consulenza Telefonica</option>
                <option value="field_visit">Visita Presenziale</option>
                <option value="video_call">Video Call (Google Meet)</option>
              </select>
            </div>
            <div>
              <label className="text-[#425466] font-medium block mb-1">Durata Prevista (minuti)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCE5E8] text-[#0F222D] focus:outline-none focus:border-[#0A6847]"
              />
            </div>
          </div>

          <div>
            <label className="text-[#425466] font-medium block mb-1">Note per il Consulente</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#DCE5E8] text-[#0F222D] focus:outline-none focus:border-[#0A6847]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#DCE5E8]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#DCE5E8] text-[#425466] hover:bg-slate-50 font-medium cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#0A6847] hover:bg-[#085238] text-white font-medium shadow-xs cursor-pointer"
            >
              Inserisci in Agenda Call Center
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  lead,
  consultants,
  isOpen,
  onClose,
  onSchedule,
}) => {
  if (!isOpen || !lead) return null;
  return <ScheduleAppointmentDialog key={lead.id} lead={lead} consultants={consultants} onClose={onClose} onSchedule={onSchedule} />;
};

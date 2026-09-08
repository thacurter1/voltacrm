import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { Appointment, AppointmentType, Lead } from '../types';

interface ScheduleAppointmentModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (appointment: Appointment) => void;
}

export const ScheduleAppointmentModal: React.FC<ScheduleAppointmentModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSchedule,
}) => {
  if (!isOpen || !lead) return null;

  const [agentName, setAgentName] = useState('Alessandro Mori (Energy Specialist)');
  const [date, setDate] = useState('2026-09-05');
  const [time, setTime] = useState('11:00');
  const [duration, setDuration] = useState(45);
  const [type, setType] = useState<AppointmentType>('phone_consultation');
  const [notes, setNotes] = useState(lead.notes || 'Verifica bolletta luce e gas.');

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
    <div className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#e3e8ee] rounded-xl w-full max-w-lg p-6 space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
        <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-3">
          <div>
            <h3 className="font-bold text-base text-[#0a2540]">Fissa Appuntamento Commerciale</h3>
            <p className="text-xs text-[#425466]">Lead: <strong className="text-[#0a2540]">{lead.name}</strong> ({lead.phone})</p>
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
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
            >
              <option value="Alessandro Mori (Energy Specialist)">Alessandro Mori (Energy Specialist)</option>
              <option value="Valentina Neri (Account Manager B2B)">Valentina Neri (Account Manager B2B)</option>
              <option value="Luca Ferri (Consulente Telefonico)">Luca Ferri (Consulente Telefonico)</option>
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
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
              />
            </div>
            <div>
              <label className="text-[#425466] font-medium block mb-1">Orario</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#425466] font-medium block mb-1">Modalità Incontro</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AppointmentType)}
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
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
                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
              />
            </div>
          </div>

          <div>
            <label className="text-[#425466] font-medium block mb-1">Note per il Consulente</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e3e8ee]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#e3e8ee] text-[#425466] hover:bg-slate-50 font-medium cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium shadow-xs cursor-pointer"
            >
              Inserisci in Agenda Call Center
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

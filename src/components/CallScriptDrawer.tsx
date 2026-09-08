import React, { useState } from 'react';
import { 
  Phone, 
  X, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  AlertCircle, 
  Zap, 
  Flame, 
  MessageSquare, 
  ChevronRight,
  User
} from 'lucide-react';
import { Lead, LeadStatus } from '../types';

interface CallScriptDrawerProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onUpdateStatus: (leadId: string, status: LeadStatus, note?: string) => void;
  onOpenSchedule: (lead: Lead) => void;
}

export const CallScriptDrawer: React.FC<CallScriptDrawerProps> = ({
  isOpen,
  lead,
  onClose,
  onUpdateStatus,
  onOpenSchedule,
}) => {
  const [callNotes, setCallNotes] = useState('');

  if (!isOpen || !lead) return null;

  const handleOutcome = (status: LeadStatus) => {
    onUpdateStatus(lead.id, status, callNotes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-2xs transition-opacity" 
      />

      <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-[#e3e8ee] flex flex-col z-10 animate-in slide-in-from-right duration-200 text-xs">
        {/* Header */}
        <div className="p-5 border-b border-[#e3e8ee] flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#635bff] flex items-center justify-center text-white">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#635bff] uppercase tracking-wider block">
                Call Center Assistant
              </span>
              <h3 className="font-bold text-sm text-[#0a2540]">{lead.name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick Lead Info */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-[#e3e8ee] grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block text-[10px]">Telefono</span>
              <a href={`tel:${lead.phone}`} className="font-mono font-bold text-[#635bff] hover:underline">
                {lead.phone}
              </a>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Città / Zona</span>
              <span className="font-semibold text-[#0a2540]">{lead.city}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Consumo Luce Stimato</span>
              <span className="font-mono font-semibold text-[#0a2540]">
                {lead.estimatedConsumptionKwh?.toLocaleString() || 3200} kWh/a
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Canale Inbound</span>
              <span className="font-semibold text-slate-700 capitalize">{lead.source.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Suggested Telemarketing Script */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
              Script Telefonico Consigliato (AIDA)
            </span>
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-slate-700 leading-relaxed space-y-2">
              <p>
                <strong>Saluto:</strong> <em>"Buongiorno Sig. {lead.name.split(' ')[0]}, sono [Nome] di Volta Energy. La contatto in merito alla sua richiesta di verifica tariffe..."</em>
              </p>
              <p>
                <strong>Gancio Risparmio:</strong> <em>"In base ai consumi di circa {lead.estimatedConsumptionKwh || 3200} kWh/anno per la sua zona di {lead.city}, con i nuovi listini all'ingrosso del PUN possiamo abbattere la spesa materia di circa 20-30%..."</em>
              </p>
              <p>
                <strong>Call to Action:</strong> <em>"Fissiamo 10 minuti di video-consulenza o le invio la proposta su WhatsApp?"</em>
              </p>
            </div>
          </div>

          {/* Operator Call Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
              Note Rapide della Chiamata
            </label>
            <textarea
              rows={3}
              placeholder="es. Chiedere copia bolletta via WhatsApp, fornitore attuale è Enel..."
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#e3e8ee] text-xs text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff]"
            />
          </div>

          {/* 1-Click Outcome Buttons */}
          <div className="space-y-2 pt-2 border-t border-[#e3e8ee]">
            <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
              Registra Esito con 1 Click:
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleOutcome('call_center_queue')}
                className="p-2.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-left cursor-pointer transition-colors"
              >
                <div className="font-bold text-[#0a2540] flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-500" /> Non Risponde
                </div>
                <span className="text-[10px] text-slate-400">Riprova tra 2 ore</span>
              </button>

              <button
                onClick={() => handleOutcome('in_negotiation')}
                className="p-2.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-left cursor-pointer transition-colors"
              >
                <div className="font-bold text-[#0a2540] flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-sky-500" /> In Trattativa
                </div>
                <span className="text-[10px] text-slate-400">Attesa bolletta</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenSchedule(lead);
                }}
                className="col-span-2 p-2.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white text-left cursor-pointer shadow-xs transition-all active:scale-[0.99]"
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Fissa Appuntamento / Visita
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] text-white/80">Inserisci subito nell'agenda commerciale</span>
              </button>

              <button
                onClick={() => handleOutcome('lost')}
                className="col-span-2 p-2 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 text-rose-600 font-medium text-center cursor-pointer transition-colors"
              >
                Non Interessato / Contatto Perso (KO)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

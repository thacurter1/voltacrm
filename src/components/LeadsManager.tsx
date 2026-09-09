import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  CalendarPlus, 
  Flame, 
  Zap, 
  X
} from 'lucide-react';
import { Lead, LeadSource, LeadStatus } from '../types';

interface LeadsManagerProps {
  leads: Lead[];
  onAddLead: (lead: Lead) => void;
  onOpenScheduleModal: (lead: Lead) => void;
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onSelectLead: (lead: Lead) => void;
  onOpenCallScript: (lead: Lead) => void;
}

export const LeadsManager: React.FC<LeadsManagerProps> = ({
  leads,
  onAddLead,
  onOpenScheduleModal,
  onUpdateStatus: _onUpdateStatus,
  onSelectLead,
  onOpenCallScript,
}) => {
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [newLeadSource, setNewLeadSource] = useState<LeadSource>('facebook_ads');
  const [newLeadNotes, setNewLeadNotes] = useState('');
  const [newLeadKwh, setNewLeadKwh] = useState(3200);
  const [newLeadSmc, setNewLeadSmc] = useState(950);

  const filteredLeads = leads.filter((l) => {
    const matchesSearch = 
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      l.city.toLowerCase().includes(search.toLowerCase());
    const matchesSource = selectedSource === 'all' || l.source === selectedSource;
    const matchesStatus = selectedStatus === 'all' || l.status === selectedStatus;
    return matchesSearch && matchesSource && matchesStatus;
  });

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName || !newLeadPhone) return;

    const lead: Lead = {
      id: `lead-${Date.now()}`,
      name: newLeadName,
      phone: newLeadPhone,
      email: newLeadEmail || 'info@lead.it',
      city: newLeadCity || 'Italia',
      source: newLeadSource,
      status: 'new',
      notes: newLeadNotes || 'Acquisito da campagna online.',
      createdAt: new Date().toISOString(),
      estimatedConsumptionKwh: newLeadKwh,
      estimatedConsumptionSmc: newLeadSmc,
    };

    onAddLead(lead);
    setIsModalOpen(false);
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadEmail('');
    setNewLeadCity('');
    setNewLeadNotes('');
  };

  const getSourceBadge = (source: LeadSource) => {
    switch (source) {
      case 'facebook_ads':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/50">Meta Ads</span>;
      case 'google_ads':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/50">Google Ads</span>;
      case 'landing_page':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">Landing Page</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200/50">Referral</span>;
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Nuovo Inbound
          </span>
        );
      case 'call_center_queue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            In Chiamata
          </span>
        );
      case 'appointment_booked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Appuntamento Fissato
          </span>
        );
      case 'in_negotiation':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#635bff]" />
            Trattativa In Corso
          </span>
        );
      case 'contract_signed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            Contratto Firmato
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Chiuso
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e3e8ee]">
        <div>
          <h1 className="text-xl font-bold text-[#0a2540] tracking-tight">Lead Inbound & Reparto Marketing</h1>
          <p className="text-xs text-[#425466] mt-0.5">
            Ricezione real-time dei contatti dalle campagne pubblicitarie per l'assegnazione al call center.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-medium shadow-[0_1px_2px_rgba(99,91,255,0.3)] active:scale-[0.99] transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Simula Webhook Inbound
        </button>
      </div>

      {/* Stripe Filter Bar */}
      <div className="p-3 bg-white rounded-xl border border-[#e3e8ee] shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtra per nome, telefono, città..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] placeholder-slate-400 focus:outline-none focus:border-[#635bff] focus:bg-white text-xs transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[#425466] font-medium">Canale:</span>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] text-xs focus:outline-none focus:border-[#635bff] cursor-pointer"
          >
            <option value="all">Tutti i Canali</option>
            <option value="facebook_ads">Meta Lead Ads</option>
            <option value="google_ads">Google Ads</option>
            <option value="landing_page">Landing Page</option>
            <option value="referral">Referral</option>
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
            <option value="new">Nuovo Inbound</option>
            <option value="call_center_queue">In Chiamata</option>
            <option value="appointment_booked">Appuntamento Fissato</option>
            <option value="in_negotiation">In Trattativa</option>
            <option value="contract_signed">Contratto Firmato</option>
          </select>
        </div>
      </div>

      {/* Stripe Table for Leads */}
      <div className="rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] text-[#425466] font-semibold border-b border-[#e3e8ee]">
              <tr>
                <th className="py-3.5 px-4">Contatto</th>
                <th className="py-3.5 px-4">Origine</th>
                <th className="py-3.5 px-4">Consumi Stimati</th>
                <th className="py-3.5 px-4">Stato Funnel</th>
                <th className="py-3.5 px-4">Operatore CC</th>
                <th className="py-3.5 px-4 text-right">Azioni Call Center</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e8ee]">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Nessun lead trovato con i filtri correnti. Prova a modificare i criteri di ricerca.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    onClick={() => onSelectLead(lead)}
                  >
                    {/* Contatto */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-[#0a2540] text-sm block group-hover:text-[#635bff] transition-colors">{lead.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-[#425466] mt-0.5">
                        <span className="font-mono text-slate-700">{lead.phone}</span>
                        <span>•</span>
                        <span>{lead.city}</span>
                      </div>
                      {lead.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-1">
                          "{lead.notes}"
                        </p>
                      )}
                    </td>

                    {/* Origine */}
                    <td className="py-3.5 px-4">
                      {getSourceBadge(lead.source)}
                    </td>

                    {/* Consumi */}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>{lead.estimatedConsumptionKwh?.toLocaleString()} kWh/a</span>
                      </div>
                      {lead.estimatedConsumptionSmc && (
                        <div className="flex items-center gap-1.5 text-slate-700 mt-0.5">
                          <Flame className="h-3 w-3 text-sky-500" />
                          <span>{lead.estimatedConsumptionSmc?.toLocaleString()} Smc/a</span>
                        </div>
                      )}
                    </td>

                    {/* Stato Funnel */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(lead.status)}
                    </td>

                    {/* Operatore */}
                    <td className="py-3.5 px-4 text-[11px] text-[#425466]">
                      {lead.assignedCallCenterAgent ? (
                        <span className="font-medium text-[#0a2540]">{lead.assignedCallCenterAgent}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Non assegnato</span>
                      )}
                    </td>

                    {/* Azioni */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onOpenCallScript(lead)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 font-medium text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Phone className="h-3 w-3 text-emerald-600" />
                          Chiama
                        </button>

                        <button
                          onClick={() => onOpenScheduleModal(lead)}
                          className="px-3 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium text-xs inline-flex items-center gap-1 shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                        >
                          <CalendarPlus className="h-3 w-3" />
                          Fissa Appuntamento
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe Modal: Ingestion Lead Simulation */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e3e8ee] rounded-xl w-full max-w-lg p-6 space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
            <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#0a2540]">Simula Webhook Inbound Marketing</h3>
                <p className="text-xs text-[#425466]">Inietta un nuovo contatto generato da Meta Lead Ads o Google Ads</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Nome o Ragione Sociale *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. Marco Rossi"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  />
                </div>
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Telefono *</label>
                  <input
                    type="text"
                    required
                    placeholder="es. +39 347 1234567"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="marco.rossi@email.it"
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  />
                </div>
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Città</label>
                  <input
                    type="text"
                    placeholder="Milano (MI)"
                    value={newLeadCity}
                    onChange={(e) => setNewLeadCity(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Campagna</label>
                  <select
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value as LeadSource)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  >
                    <option value="facebook_ads">Meta Lead Ads</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="landing_page">Landing Page</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Consumo Luce (kWh)</label>
                  <input
                    type="number"
                    value={newLeadKwh}
                    onChange={(e) => setNewLeadKwh(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  />
                </div>
                <div>
                  <label className="text-[#425466] font-medium block mb-1">Consumo Gas (Smc)</label>
                  <input
                    type="number"
                    value={newLeadSmc}
                    onChange={(e) => setNewLeadSmc(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#425466] font-medium block mb-1">Note di Marketing</label>
                <textarea
                  rows={2}
                  placeholder="es. Campagna Instagram comparatore bolletta con upload foto."
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e3e8ee]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#e3e8ee] text-[#425466] hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium shadow-xs cursor-pointer"
                >
                  Invia Lead al CRM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Users, 
  ShieldCheck, 
  RefreshCw, 
  FileSearch, 
  Plus, 
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { Customer, Lead } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  customers: Customer[];
  onSelectCustomer: (customer: Customer) => void;
  onSelectLead: (lead: Lead) => void;
  onTriggerAction: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  leads,
  customers,
  onSelectCustomer,
  onSelectLead,
  onTriggerAction,
}) => {
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose(); // toggle if already open or handled in parent
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.fiscalCode.toLowerCase().includes(query.toLowerCase()) ||
      c.utilityPoints.some((u) => u.podOrPdr.toLowerCase().includes(query.toLowerCase()))
  );

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.phone.includes(query) ||
      l.city.toLowerCase().includes(query.toLowerCase())
  );

  const quickActions = [
    { id: 'ocr_bill', label: 'Analizza Bolletta con OCR AI', icon: FileSearch, category: 'Azione' },
    { id: 'market_sim', label: 'Simula Scenario di Mercato (PUN / PSV)', icon: SlidersHorizontal, category: 'Azione' },
    { id: 'switch_4m', label: 'Vai al Motore di Switch 4 Mesi', icon: RefreshCw, category: 'Navigazione' },
    { id: 'new_lead', label: 'Simula Inbound Lead Marketing (Webhook)', icon: Plus, category: 'Azione' },
  ].filter((a) => a.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex items-start justify-center">
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs transition-opacity" 
      />

      <div className="relative w-full max-w-xl bg-white rounded-xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-[#e3e8ee]">
          <Search className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Cerca cliente, lead, POD/PDR, o digita un comando..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-3.5 text-xs text-[#0a2540] placeholder-slate-400 focus:outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 text-xs divide-y divide-[#e3e8ee]">
          {/* Quick Actions */}
          {quickActions.length > 0 && (
            <div className="py-1">
              <span className="px-3 py-1 text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
                Azioni Rapide
              </span>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      onTriggerAction(action.id);
                      onClose();
                    }}
                    className="w-full px-3 py-2 rounded-lg hover:bg-indigo-50/60 text-left flex items-center justify-between text-[#0a2540] group cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 rounded-md bg-slate-100 group-hover:bg-[#635bff] group-hover:text-white transition-colors">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-medium text-xs">{action.label}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#635bff]" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Customers */}
          {filteredCustomers.length > 0 && (
            <div className="py-1">
              <span className="px-3 py-1 text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
                Clienti & Forniture
              </span>
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectCustomer(c);
                    onClose();
                  }}
                  className="w-full px-3 py-2 rounded-lg hover:bg-slate-50 text-left flex items-center justify-between text-[#0a2540] group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#635bff]" />
                    <div>
                      <span className="font-semibold text-xs text-[#0a2540] block">{c.name}</span>
                      <span className="text-[10px] text-[#425466] font-mono">
                        {c.city} • {c.utilityPoints.map(u => u.podOrPdr).join(', ')}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Cliente CRM</span>
                </button>
              ))}
            </div>
          )}

          {/* Leads */}
          {filteredLeads.length > 0 && (
            <div className="py-1">
              <span className="px-3 py-1 text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
                Lead Marketing
              </span>
              {filteredLeads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    onSelectLead(l);
                    onClose();
                  }}
                  className="w-full px-3 py-2 rounded-lg hover:bg-slate-50 text-left flex items-center justify-between text-[#0a2540] group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="h-3.5 w-3.5 text-amber-500" />
                    <div>
                      <span className="font-semibold text-xs text-[#0a2540] block">{l.name}</span>
                      <span className="text-[10px] text-[#425466] font-mono">
                        {l.phone} • {l.source}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">Lead</span>
                </button>
              ))}
            </div>
          )}

          {filteredCustomers.length === 0 && filteredLeads.length === 0 && quickActions.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nessun risultato corrispondente alla ricerca "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

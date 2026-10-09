import React from 'react';
import { Zap, FileText, Sparkles, ShieldCheck } from 'lucide-react';
import { NotificationCenter } from '../NotificationCenter';

export interface EnergyPortalHeaderProps {
  activeView: 'offers' | 'supplies';
  onSelectView: (view: 'offers' | 'supplies') => void;
  customerName: string;
  onUploadBill?: () => void;
  onToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  onReturnToBackend?: () => void;
}

export const EnergyPortalHeader: React.FC<EnergyPortalHeaderProps> = ({
  activeView,
  onSelectView,
  customerName,
  onUploadBill: _onUploadBill,
  onToast,
  onReturnToBackend,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => onSelectView('offers')}
        >
          <div className="h-9 w-9 rounded-xl bg-[#635bff] flex items-center justify-center text-white shadow-xs shrink-0">
            <Zap className="h-5 w-5 fill-white text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base text-[#0a2540] tracking-tight">
                Volta Energia
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/25">
                PORTALE BOLLETTE
              </span>
            </div>
            <span className="hidden sm:block text-[11px] text-slate-500 font-medium">
              Confronto guidato e trasparente tariffe luce e gas
            </span>
          </div>
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-3">
          {/* View toggle (Offerte / Le mie forniture) */}
          <nav className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold" aria-label="Navigazione portale">
            <button
              type="button"
              onClick={() => onSelectView('offers')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeView === 'offers'
                  ? 'bg-white text-[#0a2540] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#635bff]" />
              <span>Confronta Offerte</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView('supplies')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeView === 'supplies'
                  ? 'bg-white text-[#0a2540] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#635bff]" />
              <span>Le mie bollette</span>
            </button>
          </nav>

          {onToast && (
            <NotificationCenter
              userRole="customer"
              onToast={onToast}
              onNavigateTab={(tab) => onSelectView(tab === 'supplies' || tab === 'inbox_bills' ? 'supplies' : 'offers')}
            />
          )}

          {/* User badge */}
          <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-200 text-xs">
            <span className="text-slate-400">Utente:</span>
            <span className="font-bold text-[#0a2540]">{customerName.split(' ')[0]}</span>
          </div>

          {/* Return to CRM button: ONLY visible when staff is impersonating */}
          {onReturnToBackend && (
            <button
              type="button"
              onClick={onReturnToBackend}
              className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a2540] hover:bg-[#1a385c] text-white text-xs font-bold transition shadow-xs cursor-pointer border border-[#635bff]/40 active:scale-95"
              title="Sessione operatore: torna al gestionale CRM"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#635bff]" />
              <span>Torna al Backend CRM</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

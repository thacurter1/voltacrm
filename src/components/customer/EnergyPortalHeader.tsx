import React from 'react';
import { FileText, ShieldCheck, LogOut, Lock, User, SlidersHorizontal } from 'lucide-react';
import { NotificationCenter } from '../NotificationCenter';

export interface EnergyPortalHeaderProps {
  activeView: 'offers' | 'supplies' | 'account';
  onSelectView: (view: 'offers' | 'supplies' | 'account') => void;
  customerName: string;
  onUploadBill?: () => void;
  onToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  onReturnToBackend?: () => void;
  onLogout?: () => void;
  isPublicVisitor?: boolean;
  onOpenCustomerLogin?: () => void;
  onOpenStaffLogin?: () => void;
}

export const EnergyPortalHeader: React.FC<EnergyPortalHeaderProps> = ({
  activeView,
  onSelectView,
  customerName,
  onUploadBill: _onUploadBill,
  onToast,
  onReturnToBackend,
  onLogout,
  isPublicVisitor = false,
  onOpenCustomerLogin,
  onOpenStaffLogin,
}) => {
  return (
    <header className="bg-white border-b border-[#DCE5E8] sticky top-0 z-30">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Mark */}
        <button
          type="button"
          aria-label="Volta Energia, torna al confronto"
          className="flex items-center gap-2.5 cursor-pointer shrink-0 text-left rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A6847]"
          onClick={() => onSelectView('offers')}
        >
          <svg className="w-8 h-8 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0A3B40" />
            <path d="M9.5 9.5L16 23L22.5 9.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 9.5L16 16L19 9.5" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <span className="font-bold text-base sm:text-lg text-[#0F222D] tracking-tight block leading-none">
              Volta Energia
            </span>
            {!isPublicVisitor && (
              <span className="text-[11px] text-[#445966] font-medium block mt-0.5">
                Portale clienti
              </span>
            )}
          </div>
        </button>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {!isPublicVisitor && (
            <nav className="flex flex-wrap sm:flex-nowrap bg-[#F6F9FA] border border-[#DCE5E8] p-1 rounded-lg text-xs font-semibold max-w-full" aria-label="Navigazione portale">
              <button
                type="button"
                onClick={() => onSelectView('offers')}
                className={`min-h-[36px] px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  activeView === 'offers'
                    ? 'bg-white text-[#0F222D] shadow-2xs'
                    : 'text-[#445966] hover:text-[#0F222D]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0A6847] shrink-0" aria-hidden="true" />
                <span>Confronta Offerte</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView('supplies')}
                className={`min-h-[36px] px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  activeView === 'supplies'
                    ? 'bg-white text-[#0F222D] shadow-2xs'
                    : 'text-[#445966] hover:text-[#0F222D]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#0A6847] shrink-0" aria-hidden="true" />
                <span>Le mie bollette</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectView('account')}
                className={`min-h-[36px] px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  activeView === 'account'
                    ? 'bg-white text-[#0F222D] shadow-2xs'
                    : 'text-[#445966] hover:text-[#0F222D]'
                }`}
              >
                <User className="w-3.5 h-3.5 text-[#0A6847] shrink-0" aria-hidden="true" />
                <span>Il mio Account</span>
              </button>
            </nav>
          )}

          {/* Area Staff & Broker link for public landing */}
          {onOpenStaffLogin && (
            <button
              type="button"
              onClick={onOpenStaffLogin}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[#445966] hover:text-[#0F222D] hover:bg-[#F6F9FA] text-xs sm:text-sm font-medium transition cursor-pointer shrink-0"
              title="Area riservata per consulenti, broker e staff"
            >
              <Lock className="w-3.5 h-3.5 text-[#445966] shrink-0" aria-hidden="true" />
              <span>Area Staff & Broker</span>
            </button>
          )}

          {/* Area Clienti primary button for public landing */}
          {onOpenCustomerLogin && (
            <button
              type="button"
              onClick={onOpenCustomerLogin}
              className="min-h-[38px] flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#0A6847] hover:bg-[#085238] text-white text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-[0.98] shrink-0"
              title="Accedi o registrati all'Area Clienti per vedere bollette e forniture"
            >
              <User className="w-4 h-4 text-white shrink-0" aria-hidden="true" />
              <span>Area Clienti</span>
            </button>
          )}

          {onToast && !isPublicVisitor && (
            <NotificationCenter
              userRole="customer"
              onToast={onToast}
              onNavigateTab={(tab) => onSelectView(tab === 'supplies' || tab === 'inbox_bills' ? 'supplies' : 'offers')}
            />
          )}

          {onLogout && !isPublicVisitor && (
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold text-[#445966] hover:bg-[#F6F9FA] hover:text-[#0F222D] focus-visible:outline-2 focus-visible:outline-[#0A6847] flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Esci</span>
            </button>
          )}

          {!isPublicVisitor && (
            <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-[#DCE5E8] text-xs">
              <span className="text-[#445966]">Utente:</span>
              <span className="font-bold text-[#0F222D]">{customerName.split(' ')[0]}</span>
            </div>
          )}

          {onReturnToBackend && (
            <button
              type="button"
              onClick={onReturnToBackend}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A3B40] hover:bg-[#072B2F] text-white text-xs font-semibold transition cursor-pointer shrink-0"
              title="Sessione operatore: torna al gestionale CRM"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#34D399] shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Torna al CRM</span>
              <span className="sm:hidden">CRM</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

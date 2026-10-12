import React, { useState } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import type { LegalTab } from './LegalModal';

export interface CookieBannerProps {
  onOpenLegal?: (tab: LegalTab) => void;
}

const STORAGE_KEY = 'volta_cookie_consent';

export const CookieBanner: React.FC<CookieBannerProps> = ({ onOpenLegal }) => {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted_' + new Date().toISOString());
    } catch {
      // ignore
    }
    setIsVisible(false);
  };

  const handleOpenDetails = () => {
    if (onOpenLegal) {
      onOpenLegal('privacy');
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 animate-in slide-in-from-bottom duration-300 pointer-events-none"
      role="region"
      aria-label="Informativa sui cookie"
    >
      <div className="mx-auto max-w-4xl rounded-2xl bg-[#0a2540] text-white p-4 sm:p-5 shadow-2xl border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pointer-events-auto">
        <div className="flex items-start gap-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#635bff] text-white shrink-0 mt-0.5">
            <Cookie className="size-5" />
          </span>
          <div className="space-y-1 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Informativa Cookie & Privacy</span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="size-3" />
                Solo Tecnici
              </span>
            </div>
            <p className="leading-relaxed">
              Volta Energia adotta esclusivamente <strong>cookie tecnici essenziali</strong> per il funzionamento sicuro del comparatore e la memorizzazione della sessione. Nessun cookie di profilazione commerciale o cessione a terzi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={handleOpenDetails}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition focus-visible:outline-2 focus-visible:outline-[#635bff]"
          >
            Dettagli privacy
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-xl bg-[#635bff] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#534be5] transition focus-visible:outline-2 focus-visible:outline-[#635bff]"
          >
            Accetta ed esplora
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="p-2 text-slate-400 hover:text-white transition sm:hidden"
            aria-label="Chiudi avviso cookie"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

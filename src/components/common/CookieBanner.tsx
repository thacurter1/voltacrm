import React, { useState } from 'react';
import { X } from 'lucide-react';
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

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 border-t border-white/15 bg-[#0A3B40] text-white shadow-lg"
      role="region"
      aria-label="Informativa sui cookie"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <p className="text-[#D7E6E8] leading-snug">
          <strong className="text-white">Solo cookie tecnici essenziali:</strong> questo sito non utilizza cookie di profilazione commerciale o cessione a terzi.
        </p>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => onOpenLegal?.('privacy')}
            className="min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold text-[#D7E6E8] hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            Informativa privacy
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="min-h-[38px] px-4 py-1.5 rounded-md bg-white hover:bg-[#F1F5F6] text-[#0A3B40] text-xs font-bold transition cursor-pointer"
          >
            Accetta ed esplora
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="p-2 text-[#D7E6E8] hover:text-white sm:hidden cursor-pointer"
            aria-label="Chiudi avviso cookie"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

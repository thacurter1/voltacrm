import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { LegalTab } from './LegalModal';

export interface CookieBannerProps {
  onOpenLegal?: (tab: LegalTab) => void;
}

const STORAGE_KEY = 'volta_cookie_consent';

/**
 * Technical-cookies notice. Only essential cookies are used, so no consent wall is needed:
 * the notice sits in the page flow (above the footer) and never covers content, the bill
 * upload entry point or the legal disclaimer.
 */
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
      // Storage unavailable: hide for this session only.
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <section aria-label="Informativa sui cookie" className="border-t border-[#DCE5E8] bg-[#F6F9FA]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="max-w-[70ch] leading-relaxed text-[#445966]">
          <strong className="text-[#0F222D]">Solo cookie tecnici essenziali.</strong> Nessun cookie di profilazione e nessuna cessione a terzi.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenLegal?.('privacy')}
            className="min-h-11 rounded-md px-3 font-semibold text-[#0A3B40] hover:bg-white cursor-pointer"
          >
            Informativa privacy
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="min-h-11 rounded-md bg-[#0A3B40] px-4 font-bold text-white hover:bg-[#072B2F] cursor-pointer"
          >
            Ho capito
          </button>
          <button
            type="button"
            onClick={handleAccept}
            aria-label="Chiudi avviso cookie"
            className="flex h-11 w-11 items-center justify-center rounded-md text-[#445966] hover:bg-white hover:text-[#0F222D] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};

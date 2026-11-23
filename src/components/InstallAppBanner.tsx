import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'VOLTA_INSTALL_BANNER_DISMISSED';

function readDismissed(): boolean {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone);
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Discreet, in-flow install hint.
 *
 * - Never `position: fixed`: it sits in the document flow (usually above the footer),
 *   so it cannot cover content, primary buttons, the Staff mobile tab bar or the cookie banner.
 * - Renders only when installation is actually possible (Chromium `beforeinstallprompt`
 *   or iOS Safari outside standalone mode) and the user has not dismissed it.
 */
export const InstallAppBanner: React.FC<{ inline?: boolean }> = ({ inline = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(readDismissed);
  const [isInstalled, setIsInstalled] = useState(isStandalone);
  const [iosEligible] = useState(isIosSafari);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installed = () => setIsInstalled(true);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (isInstalled || isDismissed) return null;
  if (!deferredPrompt && !iosEligible) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Storage can be unavailable (private mode): dismissal still applies to this session.
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowIosGuide(true);
    }
  };

  return (
    <aside
      aria-label="Installa applicazione"
      data-testid="install-app-banner"
      className={inline ? 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4' : 'w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3'}
    >
      <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#DCE5E8] bg-white py-1 pl-4 pr-1 text-[#0F222D]">
        <p className="min-w-0 text-[13px] leading-snug text-[#445966]">
          <span className="font-bold text-[#0F222D]">Volta Energia sul tuo dispositivo.</span>{' '}
          Aggiungila alla schermata Home per riaprirla in un tocco.
        </p>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[13px] font-bold text-[#0A6847] hover:bg-[#EAF4F0] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0A6847]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Installa
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Chiudi suggerimento installazione"
            className="flex h-11 w-11 items-center justify-center rounded-md text-[#445966] hover:bg-[#F6F9FA] hover:text-[#0F222D] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0A6847]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div role="note" className="mt-2 rounded-[10px] border border-[#DCE5E8] bg-white p-3 text-[13px] leading-relaxed text-[#0F222D]">
          <span className="mb-1 block font-bold">Su iPhone e iPad (Safari)</span>
          Tocca <strong>Condividi</strong> (il quadrato con la freccia verso l'alto), poi <strong>Aggiungi alla schermata Home</strong>.
          <button
            type="button"
            onClick={() => setShowIosGuide(false)}
            className="mt-1 block min-h-11 font-bold text-[#0A6847] hover:underline cursor-pointer"
          >
            Ho capito
          </button>
        </div>
      )}
    </aside>
  );
};

export default InstallAppBanner;

import React, { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallAppBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('VOLTA_INSTALL_BANNER_DISMISSED') === 'true';
  });
  const [isInstalled, setIsInstalled] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  );
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isInstalled || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('VOLTA_INSTALL_BANNER_DISMISSED', 'true');
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowIosGuide(true);
    }
  };

  return (
    <aside aria-label="Installa applicazione" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-white text-[#0a2540] p-4 rounded-2xl shadow-xl border border-[#e3e8ee] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#635bff] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-[#0a2540]">
              <span>Installa Volta Energia</span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[#635bff] text-[10px] font-bold">App</span>
            </div>
            <p className="text-[11px] text-[#425466] mt-0.5">
              Accesso istantaneo alla piattaforma dalla schermata Home.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            Installa
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Chiudi notifica installazione"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div className="mt-2 p-3 rounded-xl bg-white text-[#0a2540] border border-[#e3e8ee] shadow-lg text-[11px] leading-relaxed animate-in fade-in">
          <span className="font-bold block mb-1">Per iPhone (Safari):</span>
          Tocca l'icona <strong>Condividi</strong> (il quadrato con la freccia verso l'alto) in basso, scorri e seleziona <strong>"Aggiungi alla schermata Home"</strong>.
          <button
            onClick={() => setShowIosGuide(false)}
            className="block text-[#635bff] font-bold mt-1.5 hover:underline cursor-pointer"
          >
            Ho capito
          </button>
        </div>
      )}
    </aside>
  );
};

export default InstallAppBanner;

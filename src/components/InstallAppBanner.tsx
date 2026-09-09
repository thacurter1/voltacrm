import React, { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallAppBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // If iOS Safari or unsupported prompt, show simple instructions
      setShowIosGuide(true);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-[#0a2540] text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#635bff] flex items-center justify-center text-white shrink-0 shadow-sm">
            <Zap className="h-5 w-5 fill-white text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <span>Installa VoltaCRM</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">App</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Accesso istantaneo dalla schermata Home senza barra del browser.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 rounded-xl bg-[#635bff] hover:bg-[#534be0] text-white font-bold transition-colors cursor-pointer shadow-xs"
          >
            Installa
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showIosGuide && (
        <div className="mt-2 p-3 rounded-xl bg-slate-900/95 text-white border border-slate-700 text-[11px] leading-relaxed animate-in fade-in">
          <span className="font-bold block mb-1">Per iPhone (Safari):</span>
          Tocca l'icona <strong>Condividi</strong> (il quadratino con la freccia in su) in basso, scorri e seleziona <strong>"Aggiungi alla schermata Home"</strong>.
          <button
            onClick={() => setShowIosGuide(false)}
            className="block text-[#00d4aa] font-semibold mt-1 hover:underline cursor-pointer"
          >
            Ho capito
          </button>
        </div>
      )}
    </div>
  );
};

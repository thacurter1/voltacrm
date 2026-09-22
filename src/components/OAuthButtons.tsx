import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { api } from '../api/client';
import { X, CheckCircle2 } from 'lucide-react';

interface OAuthButtonsProps {
  role: 'customer' | 'operator';
  mode?: 'login' | 'register';
  onSuccess: (user: UserProfile) => void;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  className?: string;
}

export const OAuthButtons: React.FC<OAuthButtonsProps> = ({
  role,
  mode = 'login',
  onSuccess,
  onToast,
  className = '',
}) => {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [activeModalProvider, setActiveModalProvider] = useState<'google' | 'apple' | null>(null);

  // Custom user inputs for Google/Apple account choice
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const verb = mode === 'register' ? 'Registrati con' : 'Continua con';

  // Handle escape key to close modal
  useEffect(() => {
    if (!activeModalProvider) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModalProvider(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModalProvider]);

  const handleOAuth = async (
    provider: 'google' | 'apple',
    options?: { email?: string; name?: string; idToken?: string }
  ) => {
    setLoadingProvider(provider);
    try {
      const res = await api.auth.loginWithOAuth(provider, role, options);
      if (res?.success && res.user) {
        const actionWord = mode === 'register' ? 'Registrazione completata' : 'Accesso completato';
        onToast(
          `${actionWord} con ${provider === 'google' ? 'Google' : 'Apple'}`,
          `Benvenuto ${res.user.name}`,
          'success'
        );
        setActiveModalProvider(null);
        onSuccess(res.user);
      }
    } catch (err) {
      onToast(
        'Errore Autenticazione',
        err instanceof Error ? err.message : `Impossibile completare l'autenticazione con ${provider}.`,
        'warning'
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  const openProviderModal = (provider: 'google' | 'apple') => {
    // Check if real Google Identity Services is available with Client ID
    const googleClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    const googleGsi = (window as any).google?.accounts?.id;

    if (provider === 'google' && googleClientId && googleGsi) {
      try {
        googleGsi.initialize({
          client_id: googleClientId,
          callback: (response: any) => {
            if (response.credential) {
              handleOAuth('google', { idToken: response.credential });
            }
          }
        });
        googleGsi.prompt();
        return;
      } catch (e) {
        console.warn('Google GSI initialization error, fallback su dialogo:', e);
      }
    }

    // Set suggested default inputs
    if (provider === 'google') {
      setCustomEmail(role === 'customer' ? 'mario.rossi.demo@gmail.com' : 'matteo.riva.google@gmail.com');
      setCustomName(role === 'customer' ? 'Mario Rossi' : 'Matteo Riva (Staff)');
    } else {
      setCustomEmail(role === 'customer' ? 'alessandro.v@icloud.com' : 'chiara.bianchi@apple.com');
      setCustomName(role === 'customer' ? 'Alessandro V.' : 'Chiara Bianchi (Staff)');
    }
    setActiveModalProvider(provider);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalProvider) return;
    handleOAuth(activeModalProvider, {
      email: customEmail.trim(),
      name: customName.trim()
    });
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Google Button */}
      <button
        type="button"
        disabled={loadingProvider !== null}
        onClick={() => openProviderModal('google')}
        className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#e3e8ee] hover:bg-slate-50 text-[#0a2540] font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-2xs hover:border-slate-300 active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[42px]"
        aria-label={`${verb} Google`}
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.25C.45 8.15 0 9.97 0 12s.45 3.85 1.25 5.43l4.03-3.14z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
          />
        </svg>
        <span>
          {loadingProvider === 'google' ? 'Autenticazione in corso...' : `${verb} Google`}
        </span>
      </button>

      {/* Apple Button */}
      <button
        type="button"
        disabled={loadingProvider !== null}
        onClick={() => openProviderModal('apple')}
        className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-zinc-800 text-white font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-2xs active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[42px]"
        aria-label={`${verb} Apple`}
      >
        <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.64 1.35-.58.67-1.08 1.74-.94 2.77 1 .08 2.03-.52 2.66-1.27z" />
        </svg>
        <span>
          {loadingProvider === 'apple' ? 'Autenticazione in corso...' : `${verb} Apple`}
        </span>
      </button>

      {/* Divider */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-[#e3e8ee]"></div>
        <span className="shrink-0 px-2.5 text-[10px] text-slate-400 uppercase font-semibold">
          oppure con credenziali Volta
        </span>
        <div className="flex-grow border-t border-[#e3e8ee]"></div>
      </div>

      {/* Interactive Google / Apple Account Picker Modal */}
      {activeModalProvider && (
        <div 
          className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center bg-[#0a2540]/60 backdrop-blur-xs"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="oauth-modal-title"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModalProvider(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {activeModalProvider === 'google' ? (
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.25C.45 8.15 0 9.97 0 12s.45 3.85 1.25 5.43l4.03-3.14z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0 text-white">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.64 1.35-.58.67-1.08 1.74-.94 2.77 1 .08 2.03-.52 2.66-1.27z" />
                  </svg>
                </div>
              )}
              <div>
                <h3 id="oauth-modal-title" className="text-base font-bold text-[#0a2540]">
                  {activeModalProvider === 'google' ? 'Accedi con Google' : 'Accedi con Apple ID'}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeModalProvider === 'google' 
                    ? 'Scegli il tuo account Google per autenticarti su Volta Energia' 
                    : 'Usa il tuo account Apple ID per accedere a Volta Energia'}
                </p>
              </div>
            </div>

            {/* Quick Profile Suggestions */}
            <div className="mb-4 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Account consigliati:
              </span>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const email = activeModalProvider === 'google'
                      ? (role === 'customer' ? 'mario.rossi.demo@gmail.com' : 'matteo.riva.google@gmail.com')
                      : (role === 'customer' ? 'alessandro.v@icloud.com' : 'chiara.bianchi@apple.com');
                    const name = activeModalProvider === 'google'
                      ? (role === 'customer' ? 'Mario Rossi' : 'Matteo Riva (Staff)')
                      : (role === 'customer' ? 'Alessandro V.' : 'Chiara Bianchi (Staff)');
                    handleOAuth(activeModalProvider, { email, name });
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-[#635bff] hover:bg-slate-50 flex items-center justify-between transition-all group cursor-pointer"
                >
                  <div>
                    <span className="text-xs font-bold text-[#0a2540] block group-hover:text-[#635bff]">
                      {activeModalProvider === 'google' ? (role === 'customer' ? 'Mario Rossi' : 'Matteo Riva (Staff)') : (role === 'customer' ? 'Alessandro V.' : 'Chiara Bianchi (Staff)')}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {activeModalProvider === 'google' ? (role === 'customer' ? 'mario.rossi.demo@gmail.com' : 'matteo.riva.google@gmail.com') : (role === 'customer' ? 'alessandro.v@icloud.com' : 'chiara.bianchi@apple.com')}
                    </span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>

            {/* Custom Account Form */}
            <form onSubmit={handleModalSubmit} className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                Oppure inserisci la tua email personale:
              </span>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Email {activeModalProvider === 'google' ? 'Google (@gmail.com)' : 'Apple (@icloud.com)'}
                </label>
                <input
                  type="email"
                  required
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder={activeModalProvider === 'google' ? 'es. tuo.nome@gmail.com' : 'es. tuo.nome@icloud.com'}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nome e Cognome
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="es. Mario Rossi"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalProvider(null)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loadingProvider !== null || !customEmail || !customName}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loadingProvider ? 'Connessione...' : `Continua con ${activeModalProvider === 'google' ? 'Google' : 'Apple'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

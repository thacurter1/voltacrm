import React, { useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../api/client';

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

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoadingProvider(provider);
    try {
      const res = await api.auth.loginWithOAuth(provider, role);
      if (res?.success && res.user) {
        const actionWord = mode === 'register' ? 'Registrazione completata' : 'Accesso completato';
        onToast(
          `${actionWord} con ${provider === 'google' ? 'Google' : 'Apple'}`,
          `Benvenuto ${res.user.name}`,
          'success'
        );
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

  const verb = mode === 'register' ? 'Registrati con' : 'Continua con';

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Google Button */}
      <button
        type="button"
        disabled={loadingProvider !== null}
        onClick={() => handleOAuth('google')}
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
        onClick={() => handleOAuth('apple')}
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
    </div>
  );
};

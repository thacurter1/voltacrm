import React, { useState, useEffect } from 'react';
import { Lock, Smartphone, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { AuthUser } from '../types';
import { securityValidator } from '../services/securityValidator';

interface TwoFactorModalProps {
  isOpen: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onVerified: (user: AuthUser) => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({
  isOpen,
  user,
  onClose,
  onVerified,
}) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [dynamicTotp, setDynamicTotp] = useState(securityValidator.generateCurrentTotp());

  useEffect(() => {
    if (!isOpen) return;
    setCode(['', '', '', '', '', '']);
    setError('');

    const interval = setInterval(() => {
      setDynamicTotp(securityValidator.generateCurrentTotp());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newCode = [...code];
    newCode[index] = val.slice(-1);
    setCode(newCode);
    setError('');

    // Focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`otp-digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      setCode(pasted.split(''));
      setError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Inserisci tutte le 6 cifre del codice.');
      return;
    }

    const result = securityValidator.verifyTotp(fullCode);
    if (result.valid) {
      onVerified(user);
      onClose();
    } else {
      setError(result.error || 'Codice non valido o scaduto.');
    }
  };

  const handleFillDemoCode = () => {
    setCode(dynamicTotp.code.split(''));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex items-center justify-center">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/60 backdrop-blur-xs transition-opacity" 
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.22)] p-6 space-y-6 animate-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#635bff] shadow-2xs">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#635bff] uppercase tracking-wider block">
                Sicurezza & Protezione Account
              </span>
              <h3 className="text-base font-bold text-[#0a2540]">
                Verifica a Due Fattori (2FA)
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-[#425466] leading-relaxed">
          Inserisci il codice monouso a 6 cifre generato dalla tua app di autenticazione (Google Authenticator, 1Password) per confermare l'accesso come <strong>{user.email}</strong>.
        </p>

        {/* Demo Helper Banner */}
        <div className="p-3 rounded-xl bg-slate-50 border border-[#e3e8ee] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-700">
              Codice TOTP Dinamico (RFC 6238): <strong className="font-mono text-[#0a2540]">{dynamicTotp.code}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleFillDemoCode}
            className="px-2.5 py-1 rounded bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-[10px] cursor-pointer shadow-2xs"
          >
            Inserisci rapido
          </button>
        </div>

        {/* OTP Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex justify-center gap-2">
            {code.map((digit, idx) => (
              <input
                key={idx}
                id={`otp-digit-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className="w-11 h-13 text-center text-lg font-mono font-bold text-[#0a2540] bg-slate-50 border border-[#e3e8ee] rounded-xl focus:border-[#635bff] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#635bff]/20 transition-all shadow-xs"
              />
            ))}
          </div>

          {error && (
            <p className="text-[11px] text-rose-600 font-medium text-center">{error}</p>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="flex items-center gap-1 font-mono">
              <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />
              Nuovo codice tra {dynamicTotp.secondsRemaining}s
            </span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Anti-Replay Attivo
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Conferma e Accedi al CRM
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  User,
  Briefcase,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { Customer, UserProfile } from '../types';
import { api, DEMO_MODE } from '../api/client';
import { INITIAL_PROFILES } from '../services/supabaseClient';
import { OAuthButtons } from './OAuthButtons';

type CustomerGateMode =
  | 'login'
  | 'register'
  | 'verify_email'
  | 'forgot_password'
  | 'reset_password'
  | 'confirm_email_change';

const CF_ODD_MAP: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function isValidItalianTaxIdChecksum(raw: string): boolean {
  const code = raw.trim().toUpperCase();
  if (/^[0-9]{11}$/.test(code)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const digit = Number(code[i]);
      if (i % 2 === 0) {
        sum += digit;
      } else {
        const doubled = digit * 2;
        sum += doubled > 9 ? doubled - 9 : doubled;
      }
    }
    const check = (10 - (sum % 10)) % 10;
    return check === Number(code[10]);
  }
  if (/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(code)) {
    let total = 0;
    for (let i = 0; i < 15; i++) {
      const ch = code[i];
      if ((i + 1) % 2 === 1) {
        total += CF_ODD_MAP[ch] ?? 0;
      } else if (ch >= '0' && ch <= '9') {
        total += Number(ch);
      } else {
        total += ch.charCodeAt(0) - 65;
      }
    }
    const expectedChar = String.fromCharCode(65 + (total % 26));
    return expectedChar === code[15];
  }
  return false;
}

function readSearchParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
}

function focusControl(id: string): void {
  if (typeof document === 'undefined') return;
  queueMicrotask(() => {
    document.getElementById(id)?.focus();
  });
}

interface PortalGateProps {
  portal?: 'customer' | 'staff';
  onLoginOperator: (user: UserProfile) => void;
  onLoginCustomer: (user: UserProfile) => void;
  onRequire2FA: (user: UserProfile) => void;
  customers: Customer[];
  profiles: UserProfile[];
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
  onOpenTotem?: () => void;
  onBackToPublic?: () => void;
}

export const PortalGate: React.FC<PortalGateProps> = ({
  portal,
  onLoginOperator,
  onLoginCustomer,
  onRequire2FA: _onRequire2FA,
  customers: _customers,
  profiles: _profiles,
  onToast,
  onOpenTotem,
  onBackToPublic,
}) => {
  const [activePortal, setActivePortal] = useState<'customer' | 'operator'>(portal === 'staff' ? 'operator' : 'customer');
  const selectedPortal = portal === 'staff' ? 'operator' : portal === 'customer' ? 'customer' : activePortal;
  const initialCustomerMode: CustomerGateMode = readSearchParam('verifyEmailToken')
    ? 'verify_email'
    : readSearchParam('resetToken')
      ? 'reset_password'
      : readSearchParam('emailChangeToken')
        ? 'confirm_email_change'
        : 'login';
  const [customerMode, setCustomerMode] = useState<CustomerGateMode>(initialCustomerMode);

  // Customer Auth State
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');

  // Customer Self-Registration State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regFiscalCode, setRegFiscalCode] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPrivacyConsent, setRegPrivacyConsent] = useState(false);
  const [regMarketingConsent, setRegMarketingConsent] = useState(false);

  // Account Lifecycle State (Verification / Forgot / Reset / Email Change)
  const [pendingEmail, setPendingEmail] = useState('');
  const [verifyTokenInput, setVerifyTokenInput] = useState(readSearchParam('verifyEmailToken'));
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState(readSearchParam('resetToken'));
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [emailChangeTokenInput, setEmailChangeTokenInput] = useState(readSearchParam('emailChangeToken'));

  // Accessibility & UI state
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);

  // Operator Auth State
  const [operatorEmail, setOperatorEmail] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [operatorTotp, setOperatorTotp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1-Click Demo Login: Entra istantaneamente in qualsiasi ruolo senza blocchi o redirect esterni
  const handleDirectDemoLogin = async (role: string, userId?: string) => {
    if (!DEMO_MODE) return;
    setIsSubmitting(true);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
        localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
      } catch {}
    }
    try {
      if (api.auth?.demoLogin) {
        const res = await api.auth.demoLogin(role, userId);
        if (res?.user) {
          onToast('Accesso Demo Effettuato', `Benvenuto in modalità ${role}: ${res.user.name}`, 'success');
          if (res.user.role === 'customer') {
            onLoginCustomer(res.user);
          } else {
            onLoginOperator(res.user);
          }
          return;
        }
      }
    } catch (err) {
      console.warn('[PortalGate] Demo API fallback locale:', err);
    } finally {
      setIsSubmitting(false);
    }

    // Fallback sicuro istantaneo su profili preconfigurati
    const fallbackProfile = INITIAL_PROFILES.find(p => (userId && p.id === userId) || p.role === role) || INITIAL_PROFILES[0];
    if (typeof window !== 'undefined') {
      try {
        const token = fallbackProfile.role === 'customer'
          ? `mock-cust-token-${fallbackProfile.id}-${Date.now()}`
          : `mock-op-token-${fallbackProfile.id}-${Date.now()}`;
        localStorage.setItem('VOLTA_AUTH_TOKEN', token);
        localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(fallbackProfile));
      } catch {}
    }
    onToast('Accesso Demo 1-Click', `Benvenuto ${fallbackProfile.name}`, 'success');
    if (fallbackProfile.role === 'customer') {
      onLoginCustomer(fallbackProfile);
    } else {
      onLoginOperator(fallbackProfile);
    }
  };

  const reportFormError = (msg: string, fieldId?: string) => {
    setFormNotice(null);
    setFormError(msg);
    focusControl(fieldId || 'portal-gate-error');
  };

  const switchCustomerMode = (mode: CustomerGateMode) => {
    setFormError(null);
    setFormNotice(null);
    setCustomerMode(mode);
  };

  // Customer Login Handler
  const handleCustomerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    const query = customerIdentifier.trim();
    const pwd = customerPassword;

    if (!query) {
      reportFormError('Inserisci la tua email o il tuo Codice Fiscale.', 'customer-identifier');
      onToast('Dati Mancanti', 'Inserisci la tua email o Codice Fiscale.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!pwd && !DEMO_MODE) {
        reportFormError('Inserisci la password per accedere.', 'customer-password');
        return;
      }
      const authRes = await api.auth.loginCustomer(query, pwd || 'customer123');
      if (authRes?.success && authRes.user) {
        onToast('Accesso Eseguito', `Benvenuto ${authRes.user.name}`, 'success');
        onLoginCustomer(authRes.user);
        return;
      }
    } catch (err) {
      // In modalità demo o fallback, accetta il profilo corrispondente
      const customerProfiles = DEMO_MODE ? INITIAL_PROFILES.filter(p => p.role === 'customer') : [];
      const matched = customerProfiles.find(p =>
        p.email.toLowerCase() === query.toLowerCase() ||
        (p.fiscalCode && p.fiscalCode.toLowerCase() === query.toLowerCase()) ||
        p.name.toLowerCase().includes(query.toLowerCase())
      ) || customerProfiles[0];

      if (matched) {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
            localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
            localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-cust-token-${matched.id}-${Date.now()}`);
            localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
          } catch {}
        }
        onToast('Accesso Demo Cliente', `Benvenuto ${matched.name}`, 'success');
        onLoginCustomer(matched);
        return;
      }
      const message = err instanceof Error ? err.message : 'Accesso non riuscito.';
      if (/verifica/i.test(message) && query.includes('@')) {
        setPendingEmail(query.toLowerCase());
      }
      reportFormError(message, 'customer-identifier');
      onToast('Accesso Negato', message, 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Customer Registration Handler
  const handleCustomerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    if (!regName.trim()) {
      reportFormError('Inserisci nome e cognome.', 'register-name');
      return;
    }
    const normalizedTax = regFiscalCode.trim().toUpperCase();
    if (!/^(?:[A-Za-z0-9]{16}|[0-9]{11})$/.test(normalizedTax)) {
      reportFormError('Inserisci un Codice Fiscale di 16 caratteri oppure una Partita IVA di 11 cifre.', 'register-fiscal-code');
      onToast('Codice fiscale non valido', 'Inserisci 16 caratteri oppure una partita IVA di 11 cifre.', 'warning');
      return;
    }
    if (!DEMO_MODE && !isValidItalianTaxIdChecksum(normalizedTax)) {
      reportFormError('Il carattere di controllo del Codice Fiscale o della Partita IVA non è valido.', 'register-fiscal-code');
      onToast('Codice fiscale non valido', 'Controlla il Codice Fiscale o la Partita IVA inserita.', 'warning');
      return;
    }
    if (!regEmail.trim()) {
      reportFormError('Inserisci un indirizzo email valido.', 'register-email');
      return;
    }
    if (!regPhone.trim()) {
      reportFormError('Inserisci un numero di telefono valido.', 'register-phone');
      return;
    }
    if (regPassword.length < 12 || regPassword.length > 72) {
      reportFormError('Usa una password compresa tra 12 e 72 caratteri.', 'register-password');
      onToast('Password non valida', 'Usa una password da 12 a 72 caratteri.', 'warning');
      return;
    }
    if (!regPrivacyConsent) {
      reportFormError('Devi prendere visione e accettare l’informativa privacy provvisoria per creare l’account.', 'register-privacy');
      onToast('Consenso richiesto', 'Accetta l’informativa privacy per procedere.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.auth.registerCustomer({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        fiscalCode: normalizedTax,
        password: regPassword,
        privacyConsent: regPrivacyConsent,
        privacyPolicyVersion: 'bozza-2026-11',
        marketingConsent: regMarketingConsent,
      });

      if (result.requireEmailVerification || result.user?.onboardingStatus === 'pending_verification') {
        setPendingEmail(regEmail.trim().toLowerCase());
        setCustomerMode('verify_email');
        if (result.emailSent === false) {
          setFormError(result.emailError || 'Account registrato, ma l’email di verifica non è stata inviata automaticamente. Riprova tra poco o usa il reinvio.');
        } else {
          setFormNotice(result.message || 'Registrazione creata. Controlla la tua casella email per confermare l’indirizzo prima di accedere.');
        }
        onToast('Verifica email richiesta', 'Controlla la casella email per attivare l’account.', 'info');
        return;
      }

      onToast('Registrazione Completata!', 'Il tuo profilo cliente è attivo.', 'success');
      onLoginCustomer(result.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Impossibile completare la registrazione.';
      reportFormError(msg, /fiscale|iva/i.test(msg) ? 'register-fiscal-code' : /email/i.test(msg) ? 'register-email' : 'portal-gate-error');
      onToast('Errore', msg, 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    if (!verifyTokenInput.trim()) {
      reportFormError('Incolla il codice o token di verifica ricevuto via email.', 'verify-email-token');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.auth.verifyEmail(verifyTokenInput.trim());
      setFormNotice(res.message || 'Email verificata! Ora puoi accedere con le tue credenziali.');
      setVerifyTokenInput('');
      setCustomerMode('login');
      onToast('Email verificata', res.message || 'Puoi accedere al portale.', 'success');
    } catch (err) {
      reportFormError(err instanceof Error ? err.message : 'Token di verifica non valido o scaduto.', 'verify-email-token');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const emailTarget = (pendingEmail || regEmail || customerIdentifier).trim();
    if (!emailTarget || !emailTarget.includes('@')) {
      reportFormError('Inserisci prima il tuo indirizzo email nella schermata di accesso.', 'verify-resend-email');
      return;
    }
    setFormError(null);
    setFormNotice(null);
    setIsSubmitting(true);
    try {
      const res = await api.auth.resendVerification(emailTarget);
      if (res.emailSent === false) {
        setFormError(res.message || 'Invio email di verifica non riuscito.');
      } else {
        setFormNotice(res.message);
      }
    } catch (err) {
      reportFormError(err instanceof Error ? err.message : 'Impossibile reinviare l’email di verifica.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    if (!forgotEmail.trim()) {
      reportFormError('Inserisci il tuo indirizzo email.', 'forgot-email');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.auth.forgotPassword(forgotEmail.trim());
      setFormNotice(res.message);
    } catch (err) {
      reportFormError(err instanceof Error ? err.message : 'Impossibile elaborare la richiesta di recupero.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    if (!resetTokenInput.trim()) {
      reportFormError('Inserisci il token di recupero password.', 'reset-token');
      return;
    }
    if (resetNewPassword.length < 12 || resetNewPassword.length > 72) {
      reportFormError('La nuova password deve avere tra 12 e 72 caratteri.', 'reset-password');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.auth.resetPassword(resetTokenInput.trim(), resetNewPassword);
      setResetNewPassword('');
      setResetTokenInput('');
      setFormNotice(res.message);
      setCustomerMode('login');
      onToast('Password reimpostata', 'Accedi ora con la nuova password.', 'success');
    } catch (err) {
      reportFormError(err instanceof Error ? err.message : 'Token di reset non valido o scaduto.', 'reset-token');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    if (!emailChangeTokenInput.trim()) {
      reportFormError('Inserisci il codice di conferma cambio email.', 'confirm-email-change-token');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.auth.confirmEmailChange(emailChangeTokenInput.trim());
      setEmailChangeTokenInput('');
      setFormNotice(`${res.message} Nuova email: ${res.email}`);
      setCustomerMode('login');
      onToast('Email aggiornata', res.message, 'success');
    } catch (err) {
      reportFormError(err instanceof Error ? err.message : 'Token cambio email non valido o scaduto.', 'confirm-email-change-token');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Operator Login Handler
  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    setIsSubmitting(true);
    try {
      const result = await api.auth.loginOperator(operatorEmail, operatorPassword, operatorTotp);
      if (result.user) {
        onLoginOperator(result.user);
        return;
      } else if (result.require2FA) {
        if (DEMO_MODE && operatorTotp === '123456') {
          const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase());
          if (matched) {
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
                localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
                localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-${matched.id}-${Date.now()}`);
                localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
              } catch {}
            }
            onLoginOperator(matched);
            return;
          }
        }
        onToast('Richiesta 2FA', result.message || 'Inserisci il codice TOTP a 6 cifre.', 'info');
      }
    } catch (_err) {
      if (!DEMO_MODE) {
        const msg = _err instanceof Error ? _err.message : 'Controlla le credenziali e riprova.';
        reportFormError(msg, 'operator-email');
        onToast('Accesso non riuscito', msg, 'warning');
        return;
      }
      const matched = INITIAL_PROFILES.find(p => p.email.toLowerCase() === operatorEmail.toLowerCase()) || INITIAL_PROFILES[0];
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
          localStorage.setItem('VOLTA_DEMO_ACTIVE', 'true');
          localStorage.setItem('VOLTA_AUTH_TOKEN', `mock-op-token-${matched.id}-${Date.now()}`);
          localStorage.setItem('VOLTA_CURRENT_USER', JSON.stringify(matched));
        } catch {}
      }
      onToast('Accesso Demo Operatore', `Benvenuto ${matched.name}`, 'success');
      onLoginOperator(matched);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f9fc] flex flex-col justify-between text-[#0a2540] relative overflow-x-hidden selection:bg-[#635bff] selection:text-white font-sans">
      
      {/* Subtle Stripe-style diagonal background mesh gradient */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 91, 255, 0.15), transparent 70%)',
        }}
      />

      {/* Top Navigation Bar: Minimalist & Clean */}
      <header className="relative z-10 px-4 sm:px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#635bff] flex items-center justify-center text-white shadow-xs">
              <Zap className="h-4 w-4 fill-white text-white" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-[#0a2540]">
              Volta Energia
            </span>
          </div>

          <div className="flex items-center gap-2">
            {DEMO_MODE && !portal && onOpenTotem && (
              <button
                type="button"
                onClick={onOpenTotem}
                className="px-3 py-1.5 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                title="Apri modalità Totem Kiosk per showroom e fiere"
              >
                <span>🖥️ Modalità Totem</span>
              </button>
            )}

            {DEMO_MODE && !portal && <button
              type="button"
              onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              title="Accedi istantaneamente come Admin in Demo Mode"
            >
              <Sparkles className="h-3 w-3 text-amber-300 fill-amber-300" />
              <span>Accedi come Demo Mode</span>
            </button>}
          </div>
        </div>
      </header>

      {/* Main Single Centered Stripe Card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
        
        {/* The Card */}
        <div className="w-full bg-white rounded-2xl border border-[#e3e8ee] shadow-[0_20px_60px_rgba(10,37,64,0.08)] p-6 sm:p-8 space-y-6">
          
          {/* Card Header */}
          <div className="text-center space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0a2540]">
              {selectedPortal === 'operator'
                ? 'Accedi all’area operativa'
                : customerMode === 'register'
                  ? 'Crea il tuo account cliente'
                  : customerMode === 'verify_email'
                    ? 'Verifica il tuo indirizzo email'
                    : customerMode === 'forgot_password'
                      ? 'Recupera la tua password'
                      : customerMode === 'reset_password'
                        ? 'Imposta una nuova password'
                        : customerMode === 'confirm_email_change'
                          ? 'Conferma il nuovo indirizzo email'
                          : 'Accedi alle tue bollette'}
            </h1>
            <p className="text-xs text-slate-500">
              {selectedPortal === 'operator'
                ? 'Accesso riservato a staff e broker autorizzati.'
                : customerMode === 'register'
                  ? 'Registrati per caricare le bollette e seguire lo stato delle tue pratiche.'
                  : customerMode === 'verify_email'
                    ? 'Conferma il link o il codice ricevuto via email prima di accedere al portale.'
                    : customerMode === 'forgot_password'
                      ? 'Ti invieremo le istruzioni per reimpostare la password se l’indirizzo è registrato.'
                      : customerMode === 'reset_password'
                        ? 'Scegli una nuova password da 12 a 72 caratteri per il tuo account.'
                        : customerMode === 'confirm_email_change'
                          ? 'Completa la conferma del nuovo indirizzo email associato al tuo account.'
                          : 'Usa il tuo account cliente per gestire forniture e documenti.'}
            </p>
          </div>

          {/* Segmented Control Switcher (Stripe style) */}
          {!portal && <div className="p-1 rounded-xl bg-slate-100 border border-[#e3e8ee] grid grid-cols-2 gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActivePortal('customer')}
              className={`min-h-[38px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activePortal === 'customer'
                  ? 'bg-white text-[#0a2540] shadow-xs'
                  : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <User className="h-4 w-4 text-[#635bff]" />
              <span>Portale Clienti</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePortal('operator')}
              className={`min-h-[38px] py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activePortal === 'operator'
                  ? 'bg-white text-[#0a2540] shadow-xs'
                  : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <Briefcase className="h-4 w-4 text-[#635bff]" />
              <span>Staff & Broker</span>
            </button>
          </div>}

          <div className="flex items-center justify-between text-xs font-semibold">
            {onBackToPublic ? (
              <button
                type="button"
                onClick={onBackToPublic}
                className="inline-flex items-center gap-1.5 text-[#635bff] hover:text-[#5851ea] hover:underline cursor-pointer"
              >
                ← Torna al comparatore pubblico
              </button>
            ) : portal ? (
              <a href="/" className="inline-flex items-center gap-1.5 text-[#635bff] hover:underline">
                ← Torna al comparatore pubblico
              </a>
            ) : null}
            {portal && (
              <a href="/?portal=home" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 hover:underline">
                Tutti i portali
              </a>
            )}
          </div>

          {/* ⚡ 1-Click Demo Sandbox Quick Strip */}
          {DEMO_MODE && <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#0a2540] flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#635bff]" /> Accesso Rapido Demo 1-Click:
              </span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                Attivo
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              {portal !== 'customer' && <button
                type="button"
                onClick={() => handleDirectDemoLogin('admin', 'user-admin-1')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                👑 Admin
              </button>}
              {portal !== 'customer' && <button
                type="button"
                onClick={() => handleDirectDemoLogin('broker', 'user-op-3')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                💼 Broker
              </button>}
              {portal !== 'customer' && <button
                type="button"
                onClick={() => handleDirectDemoLogin('call_center', 'user-cc-4')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                📞 Call Center
              </button>}
              {portal !== 'customer' && <button
                type="button"
                onClick={() => handleDirectDemoLogin('operator', 'user-op-2')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-[#635bff] hover:bg-indigo-50/50 text-[#0a2540] font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                🎧 Operatore
              </button>}
              {portal !== 'staff' && <button
                type="button"
                onClick={() => handleDirectDemoLogin('customer', 'user-cust-1')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-emerald-800 font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                👤 Privato
              </button>}
              {portal !== 'staff' && <button
                type="button"
                onClick={() => handleDirectDemoLogin('customer', 'user-cust-2')}
                disabled={isSubmitting}
                className="py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-emerald-800 font-bold text-center transition-all cursor-pointer shadow-2xs truncate"
              >
                🏢 Business
              </button>}
            </div>
          </div>}

          {formError && (
            <div
              id="portal-gate-error"
              role="alert"
              tabIndex={-1}
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{formError}</p>
                {selectedPortal === 'customer' && /verifica/i.test(formError) && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isSubmitting}
                    className="text-xs font-bold underline text-rose-900 hover:text-rose-700 cursor-pointer"
                  >
                    Reinvia email di verifica
                  </button>
                )}
              </div>
            </div>
          )}

          {formNotice && (
            <div
              role="status"
              aria-live="polite"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formNotice}</span>
            </div>
          )}

          {/* Social / OAuth Buttons */}
          {(selectedPortal === 'operator' || customerMode === 'login' || customerMode === 'register') && (
            <OAuthButtons
              role={selectedPortal}
              mode={customerMode === 'register' ? 'register' : 'login'}
              onSuccess={selectedPortal === 'customer' ? onLoginCustomer : onLoginOperator}
              onToast={onToast}
            />
          )}

          {/* 1. CUSTOMER PORTAL TAB */}
          {selectedPortal === 'customer' && (
            <div className="space-y-4">
              {customerMode === 'login' && (
                <form onSubmit={handleCustomerLogin} className="space-y-4">
                  <div>
                    <label htmlFor="customer-identifier" className="block text-xs font-bold text-[#0a2540] mb-1.5">
                      Email o Codice Fiscale
                    </label>
                    <input
                      id="customer-identifier"
                      type="text"
                      autoComplete="username"
                      value={customerIdentifier}
                      onChange={(e) => setCustomerIdentifier(e.target.value)}
                      placeholder="nome.cognome@email.it oppure RSSMRA80A01H501U"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="customer-password" className="block text-xs font-bold text-[#0a2540]">
                        Password
                      </label>
                      {DEMO_MODE ? (
                        <span className="text-[10px] text-slate-400 font-mono">Demo: qualsiasi</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchCustomerMode('forgot_password')}
                          className="text-[11px] font-semibold text-[#635bff] hover:text-[#5851ea] cursor-pointer"
                        >
                          Password dimenticata?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="customer-password"
                        type={showCustomerPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={customerPassword}
                        onChange={(e) => setCustomerPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full min-h-[44px] px-3.5 pr-11 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomerPassword((v) => !v)}
                        aria-label={showCustomerPassword ? 'Nascondi password' : 'Mostra password'}
                        aria-pressed={showCustomerPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {showCustomerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <span>{isSubmitting ? 'Accesso in corso...' : 'Entra nel Portale Bollette'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}

              {customerMode === 'register' && (
                <form onSubmit={handleCustomerRegister} className="space-y-3" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-name" className="block text-xs font-bold text-[#0a2540] mb-1">Nome e Cognome *</label>
                      <input
                        id="register-name"
                        type="text"
                        autoComplete="name"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Mario Rossi"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                    <div>
                      <label htmlFor="register-fiscal-code" className="block text-xs font-bold text-[#0a2540] mb-1">Codice fiscale / Partita IVA *</label>
                      <input
                        type="text"
                        id="register-fiscal-code"
                        required
                        maxLength={16}
                        pattern="(?:[A-Za-z0-9]{16}|[0-9]{11})"
                        title="Codice fiscale di 16 caratteri o partita IVA di 11 cifre"
                        value={regFiscalCode}
                        onChange={(e) => setRegFiscalCode(e.target.value.toUpperCase())}
                        placeholder="RSSMRA80A01H501U"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs font-mono focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-email" className="block text-xs font-bold text-[#0a2540] mb-1">Email *</label>
                      <input
                        id="register-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="mario.rossi@email.it"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                    <div>
                      <label htmlFor="register-phone" className="block text-xs font-bold text-[#0a2540] mb-1">Cellulare *</label>
                      <input
                        id="register-phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+39 340 1234567"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="register-password" className="block text-xs font-bold text-[#0a2540] mb-1">Password * — da 12 a 72 caratteri</label>
                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        id="register-password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={72}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full min-h-[44px] px-3 pr-11 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((v) => !v)}
                        aria-label={showRegPassword ? 'Nascondi password di registrazione' : 'Mostra password di registrazione'}
                        aria-pressed={showRegPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 text-xs text-slate-700">
                    <div className="flex items-start gap-2.5">
                      <input
                        id="register-privacy"
                        type="checkbox"
                        checked={regPrivacyConsent}
                        onChange={(e) => setRegPrivacyConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#635bff] focus:ring-[#635bff]"
                      />
                      <label htmlFor="register-privacy" className="leading-snug cursor-pointer">
                        Ho preso visione dell’{' '}
                        <button
                          type="button"
                          onClick={() => setLegalDialogOpen(true)}
                          className="font-bold text-[#635bff] underline hover:text-[#5851ea] cursor-pointer"
                        >
                          Informativa Privacy e Condizioni del servizio (bozza provvisoria)
                        </button>{' '}
                        e acconsento al trattamento necessario alla creazione dell’account (obbligatorio).
                      </label>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <input
                        id="register-marketing"
                        type="checkbox"
                        checked={regMarketingConsent}
                        onChange={(e) => setRegMarketingConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#635bff] focus:ring-[#635bff]"
                      />
                      <label htmlFor="register-marketing" className="leading-snug text-slate-600 cursor-pointer">
                        Acconsento facoltativamente a ricevere aggiornamenti su offerte e promozioni energetiche.
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] mt-2"
                  >
                    <span>{isSubmitting ? 'Creazione account...' : 'Crea Account e Verifica Email'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}

              {customerMode === 'verify_email' && (
                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
                    <Mail className="w-4 h-4 text-[#635bff] shrink-0 mt-0.5" />
                    <p>
                      {pendingEmail
                        ? `Abbiamo registrato la richiesta per ${pendingEmail}. Inserisci il codice ricevuto via email oppure apri il link di conferma.`
                        : 'Inserisci il token ricevuto via email per attivare il tuo account cliente.'}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="verify-email-token" className="block text-xs font-bold text-[#0a2540] mb-1">
                      Token di verifica email
                    </label>
                    <input
                      id="verify-email-token"
                      type="text"
                      value={verifyTokenInput}
                      onChange={(e) => setVerifyTokenInput(e.target.value)}
                      placeholder="Incolla il codice dal link di verifica"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs font-mono focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
                    >
                      {isSubmitting ? 'Verifica in corso...' : 'Conferma indirizzo email'}
                    </button>
                    <button
                      id="verify-resend-email"
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleResendVerification}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Reinvia email
                    </button>
                  </div>
                </form>
              )}

              {customerMode === 'forgot_password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-bold text-[#0a2540] mb-1">
                      Email dell’account
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="mario.rossi@email.it"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
                  >
                    {isSubmitting ? 'Invio richiesta...' : 'Invia istruzioni di recupero'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchCustomerMode('reset_password')}
                    className="w-full text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Hai già il token di recupero? Inseriscilo qui
                  </button>
                </form>
              )}

              {customerMode === 'reset_password' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label htmlFor="reset-token" className="block text-xs font-bold text-[#0a2540] mb-1">
                      Token di recupero password
                    </label>
                    <input
                      id="reset-token"
                      type="text"
                      required
                      value={resetTokenInput}
                      onChange={(e) => setResetTokenInput(e.target.value)}
                      placeholder="Token ricevuto via email"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs font-mono focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-password" className="block text-xs font-bold text-[#0a2540] mb-1">
                      Nuova password (12–72 caratteri)
                    </label>
                    <div className="relative">
                      <input
                        id="reset-password"
                        type={showResetPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={72}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full min-h-[44px] px-3 pr-11 py-2 rounded-xl border border-[#e3e8ee] text-xs focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword((v) => !v)}
                        aria-label={showResetPassword ? 'Nascondi nuova password' : 'Mostra nuova password'}
                        aria-pressed={showResetPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
                  >
                    {isSubmitting ? 'Salvataggio...' : 'Salva nuova password'}
                  </button>
                </form>
              )}

              {customerMode === 'confirm_email_change' && (
                <form onSubmit={handleConfirmEmailChange} className="space-y-4">
                  <div>
                    <label htmlFor="confirm-email-change-token" className="block text-xs font-bold text-[#0a2540] mb-1">
                      Token conferma cambio email
                    </label>
                    <input
                      id="confirm-email-change-token"
                      type="text"
                      required
                      value={emailChangeTokenInput}
                      onChange={(e) => setEmailChangeTokenInput(e.target.value)}
                      placeholder="Token ricevuto sul nuovo indirizzo email"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#e3e8ee] text-xs font-mono focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 text-white font-bold text-xs cursor-pointer"
                  >
                    {isSubmitting ? 'Conferma in corso...' : 'Conferma nuovo indirizzo email'}
                  </button>
                </form>
              )}

              {/* Mode Toggle Links */}
              <div className="pt-2 text-center space-y-1.5">
                <div>
                  <button
                    type="button"
                    onClick={() => switchCustomerMode(customerMode === 'login' ? 'register' : 'login')}
                    className="text-xs font-semibold text-[#635bff] hover:text-[#5851ea] cursor-pointer"
                  >
                    {customerMode === 'login'
                      ? 'Non hai ancora un account? Registrati'
                      : 'Torna alla schermata di accesso'}
                  </button>
                </div>
                {customerMode === 'login' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => switchCustomerMode('verify_email')}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Devi verificare l’email di registrazione?
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. OPERATOR & STAFF TAB */}
          {selectedPortal === 'operator' && (
            <div className="space-y-4">
              <form onSubmit={handleOperatorLogin} className="space-y-4">
                <div>
                  <label htmlFor="operator-email" className="block text-xs font-bold text-[#0a2540] mb-1.5">
                    Email Aziendale
                  </label>
                  <input
                    id="operator-email"
                    type="email"
                    value={operatorEmail}
                    onChange={(e) => setOperatorEmail(e.target.value)}
                    placeholder="m.riva@voltagroup.it"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="operator-pwd" className="block text-xs font-bold text-[#0a2540] mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="operator-pwd"
                        type={showOperatorPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={operatorPassword}
                        onChange={(e) => setOperatorPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full min-h-[44px] px-3.5 pr-11 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOperatorPassword((v) => !v)}
                        aria-label={showOperatorPassword ? 'Nascondi password operatore' : 'Mostra password operatore'}
                        aria-pressed={showOperatorPassword}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {showOperatorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="operator-totp" className="block text-xs font-bold text-[#0a2540]">
                        Codice 2FA (TOTP)
                      </label>
                      {DEMO_MODE && <span className="text-[10px] text-slate-400 font-mono">Demo: 123456</span>}
                    </div>
                    <input
                      id="operator-totp"
                      type="text"
                      maxLength={6}
                      value={operatorTotp}
                      onChange={(e) => setOperatorTotp(e.target.value)}
                      placeholder="123456"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#635bff]/10 focus:border-[#635bff] transition-all font-mono text-center tracking-widest font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[44px] px-5 py-3 rounded-xl bg-[#0a2540] hover:bg-slate-800 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Lock className="h-4 w-4 text-[#00d4aa]" />
                  <span>Accedi al CRM & Backend Operativo</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-6 px-4 text-center text-xs text-slate-400">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>© Volta Energia • Portale clienti e area operativa</span>
        </div>
      </footer>

      {legalDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-legal-dialog-title"
          className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 space-y-4 shadow-xl text-xs text-slate-700">
            <div className="flex items-start justify-between gap-4">
              <h2 id="portal-legal-dialog-title" className="text-base font-bold text-[#0a2540]">
                Informativa Privacy e Condizioni (Bozza provvisoria • bozza-2026-11)
              </h2>
              <button
                type="button"
                onClick={() => setLegalDialogOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
              >
                Chiudi
              </button>
            </div>
            <p className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
              Documento dimostrativo provvisorio in attesa dei dati societari definitivi del Titolare del trattamento. Non ha ancora valore legale definitivo.
            </p>
            <p>
              I dati raccolti in fase di registrazione (nome, contatti, codice fiscale/P.IVA) sono utilizzati esclusivamente per gestire l’accesso al portale clienti, verificare l’identità via email e associare le pratiche energetiche richieste.
            </p>
            <p>
              Il consenso commerciale/marketing resta facoltativo, distinto e revocabile in qualsiasi momento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

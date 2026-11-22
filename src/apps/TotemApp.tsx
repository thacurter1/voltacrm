import '../styles/energy-staff.css';
import React, { useState } from 'react';
import { TotemKioskMode } from '../components/TotemKioskMode';
import { ToastContainer } from '../components/ToastContainer';
import { ToastNotification, Lead } from '../types';
import { api, DEMO_MODE } from '../api/client';
import { Monitor, ShieldCheck, Zap } from 'lucide-react';

export const TotemApp: React.FC = () => {
  const [sessionKey, setSessionKey] = useState(0);
  const [deviceKey, setDeviceKey] = useState<string | null>(() => DEMO_MODE ? 'demo' : localStorage.getItem('VOLTA_KIOSK_DEVICE_KEY'));
  const [pendingKey, setPendingKey] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const newToast: ToastNotification = {
      id: Date.now().toString(),
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setToasts(prev => [...prev, newToast]);
  };

  const handleLeadCaptured = async (lead: Lead, details: { supplyType: 'luce' | 'gas' | 'luce+gas'; monthlyExpenseEur: number }): Promise<boolean> => {
    try {
      const res = await api.kiosk.submitLead({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        supplyType: details.supplyType,
        monthlyExpenseEur: details.monthlyExpenseEur,
        totemId: 'TOTEM-STANDALONE',
        mallLocation: lead.city
      });
      return res.success === true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Postazione non autorizzata')) {
        localStorage.removeItem('VOLTA_KIOSK_DEVICE_KEY');
        setDeviceKey(null);
      }
      return false;
    }
  };

  const handleExit = () => {
    setSessionKey(previous => previous + 1);
  };

  if (!deviceKey) {
    return (
      <main className="volta-energy-staff flex min-h-[100dvh] items-center justify-center bg-[var(--energy-bg)] px-5 py-10 text-[var(--energy-ink)]">
        <form onSubmit={async (event) => {
          event.preventDefault();
          const value = pendingKey.trim();
          if (!value) return;
          setSetupError('');
          setIsVerifying(true);
          try {
            if (!await api.kiosk.verifyDevice(value)) throw new Error('Chiave non valida.');
            localStorage.setItem('VOLTA_KIOSK_DEVICE_KEY', value);
            setDeviceKey(value);
            setPendingKey('');
          } catch {
            setSetupError('Postazione non verificata. Controlla la chiave e la connessione al backend.');
          } finally {
            setIsVerifying(false);
          }
        }} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-[var(--energy-grid)] shadow-xs">
              <Zap className="size-6 fill-[var(--energy-spark)] text-[var(--energy-spark)]" />
            </span>
            <div>
              <span className="text-xl font-black text-[var(--energy-ink)] block leading-tight">Volta Energia</span>
              <span className="text-xs font-bold text-[var(--energy-accent)]">Postazione Totem Touch</span>
            </div>
          </div>
          <Monitor className="mb-5 size-10 text-[var(--energy-accent)]" aria-hidden="true" />
          <h1 className="text-2xl font-black text-[var(--energy-ink)]">Configura questa postazione</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">La chiave del dispositivo va inserita una sola volta dallo staff. Non compare nel sito pubblico.</p>
          <label htmlFor="device-key" className="mt-7 block text-sm font-semibold text-[var(--energy-ink)]">Chiave della postazione</label>
          <input id="device-key" type="password" autoComplete="off" required value={pendingKey} onChange={event => setPendingKey(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-[var(--energy-ink)] outline-none focus:border-[var(--energy-accent)] focus:ring-2 focus:ring-[var(--energy-accent)]/20" />
          {setupError && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">{setupError}</p>}
          <button type="submit" disabled={isVerifying} className="mt-5 min-h-12 w-full rounded-xl bg-[var(--energy-accent)] px-5 font-bold text-white hover:bg-[var(--energy-accent-hover)] disabled:opacity-60 cursor-pointer transition-colors shadow-xs">{isVerifying ? 'Verifica in corso…' : 'Attiva il totem'}</button>
          <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-emerald-600 shrink-0" aria-hidden="true" /> Usa questa pagina solo sul dispositivo dedicato e bloccato in modalità kiosk.</p>
        </form>
      </main>
    );
  }

  return (
    <div className="volta-energy-staff min-h-screen bg-[var(--energy-bg)] text-[var(--energy-ink)] select-none touch-manipulation">
      <TotemKioskMode
        key={sessionKey}
        isOpen={true}
        onExitTotem={handleExit}
        onLeadCaptured={handleLeadCaptured}
        onToast={addToast}
      />
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
};

export default TotemApp;

import React, { useState } from 'react';
import { TotemKioskMode } from '../components/TotemKioskMode';
import { ToastContainer } from '../components/ToastContainer';
import { ToastNotification, Lead } from '../types';
import { api } from '../api/client';

export const TotemApp: React.FC = () => {
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
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 4500);
  };

  const handleLeadCaptured = async (lead: Lead) => {
    try {
      const res = await api.kiosk.submitLead({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        supplyType: 'luce+gas',
        monthlyExpenseEur: 120,
        totemId: 'TOTEM-STANDALONE',
        mallLocation: lead.city
      });
      addToast('Richiesta Inviata', res.advice || 'Riceverai un SMS di conferma.', 'success');
    } catch {
      addToast('Offline Mode', 'Contatto salvato nella memoria locale del Totem.', 'info');
    }
  };

  const handleExit = () => {
    if (window.location.search.includes('mode=totem') || window.location.search.includes('app=totem')) {
      window.location.href = window.location.pathname;
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 select-none touch-manipulation">
      <TotemKioskMode
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

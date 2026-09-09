import React, { useState } from 'react';
import { CustomerPortal } from '../components/CustomerPortal';
import { SavingsProposalPdfModal } from '../components/SavingsProposalPdfModal';
import { DigitalSignatureModal } from '../components/DigitalSignatureModal';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ToastContainer } from '../components/ToastContainer';
import { dbService } from '../services/db';
import { runQuarterlyAudit } from '../services/energyEngine';
import { Customer, CustomerBill, SwitchAudit, ToastNotification, UserProfile } from '../types';
import { ShieldCheck, Zap, ArrowLeft } from 'lucide-react';
import { NotificationCenter } from '../components/NotificationCenter';

export const CustomerApp: React.FC = () => {
  const initialDb = dbService.load();
  const [customers] = useState<Customer[]>(initialDb.customers);
  const [bills, setBills] = useState<CustomerBill[]>(initialDb.bills);
  const [audits, setAudits] = useState<SwitchAudit[]>(() => runQuarterlyAudit(initialDb.customers));

  // Current customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialDb.customers[0]?.id || 'cust-1'
  );

  const activeCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  const [currentUser] = useState<UserProfile>({
    id: activeCustomer.id,
    name: activeCustomer.name,
    email: activeCustomer.email,
    role: 'customer',
    customerId: activeCustomer.id,
    phone: activeCustomer.phone,
    is2faEnabled: false
  });

  // Modal states
  const [selectedAuditForPdf, setSelectedAuditForPdf] = useState<SwitchAudit | null>(null);
  const [selectedAuditForSignature, setSelectedAuditForSignature] = useState<SwitchAudit | null>(null);
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

  const handleUploadBill = (newBill: CustomerBill) => {
    setBills(prev => [newBill, ...prev]);
    addToast('Bolletta Caricata', 'La tua bolletta è in fase di scansione e certificazione.', 'success');
  };

  const handleApproveSwitch = (auditId: string) => {
    setAudits(prev => prev.map(a => a.id === auditId ? { ...a, status: 'switched' } : a));
    addToast('Switch Confermato', 'Pratica di attivazione inviata al gestore.', 'success');
  };

  const handleSignatureCompleted = (auditId: string) => {
    setAudits(prev => prev.map(a => a.id === auditId ? { ...a, status: 'switched' } : a));
    addToast('Firma Accettata', 'Contratto e Mandato di Brokeraggio firmati digitalmente.', 'success');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <InstallAppBanner />

      {/* Customer Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">Volta</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-semibold">
                Portale Risparmio Cliente
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Monitoraggio Continuo Utenze & Rinegoziazione Automatica 120 Giorni
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationCenter userRole="customer" onToast={addToast} />

          {/* Customer Switcher for multi-account demo */}
          <select 
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
            ))}
          </select>

          <a 
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 transition"
            title="Torna all'Hub Volta"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hub</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <CustomerPortal
          customer={activeCustomer}
          currentUser={currentUser}
          audits={audits.filter(a => a.customerId === activeCustomer.id)}
          bills={bills.filter(b => b.customerId === activeCustomer.id)}
          onUploadBill={handleUploadBill}
          onApproveSwitch={handleApproveSwitch}
          onSwitchUser={() => {}}
          onOpenPdfProposal={(audit) => setSelectedAuditForPdf(audit)}
          onOpenSignature={(audit) => setSelectedAuditForSignature(audit)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Area Clienti Protetta con Crittografia Zero-Trust SHA-256 e Dati Ospitati in Conformità GDPR</span>
        </div>
        <p>© 2026 Volta Energy S.p.A. • cliente.voltacrm.it</p>
      </footer>

      {/* Modals */}
      {selectedAuditForPdf && (
        <SavingsProposalPdfModal
          isOpen={true}
          onClose={() => setSelectedAuditForPdf(null)}
          audit={selectedAuditForPdf}
          customer={activeCustomer}
          advisorName="Advisor Volta"
          onProceedToSign={() => {
            const currentAudit = selectedAuditForPdf;
            setSelectedAuditForPdf(null);
            setSelectedAuditForSignature(currentAudit);
          }}
        />
      )}

      {selectedAuditForSignature && (
        <DigitalSignatureModal
          isOpen={true}
          onClose={() => setSelectedAuditForSignature(null)}
          audit={selectedAuditForSignature}
          customerPhone={activeCustomer.phone}
          onSigned={(auditId) => handleSignatureCompleted(auditId)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
};

export default CustomerApp;

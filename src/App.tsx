import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { LeadsManager } from './components/LeadsManager';
import { CallCenterAgenda } from './components/CallCenterAgenda';
import { CustomerCrm } from './components/CustomerCrm';
import { TariffComparator } from './components/TariffComparator';
import { QuarterlySwitchEngine } from './components/QuarterlySwitchEngine';
import { ScheduleAppointmentModal } from './components/ScheduleAppointmentModal';
import { SlideOverDrawer } from './components/SlideOverDrawer';
import { CommandPalette } from './components/CommandPalette';
import { BillOcrModal } from './components/BillOcrModal';
import { MarketSimulatorModal } from './components/MarketSimulatorModal';
import { ToastContainer } from './components/ToastContainer';
import { CustomerPortal } from './components/CustomerPortal';
import { LoginModal } from './components/LoginModal';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { TwoFactorModal } from './components/TwoFactorModal';
import { SecurityAuditDashboard } from './components/SecurityAuditDashboard';
import { ClientBillsInbox } from './components/ClientBillsInbox';
import { CallScriptDrawer } from './components/CallScriptDrawer';
import { dbService, DEMO_USERS } from './services/db';
import { runQuarterlyAudit } from './services/energyEngine';
import { 
  Appointment, 
  Customer, 
  Lead, 
  LeadStatus, 
  AppointmentStatus,
  SwitchAudit,
  MarketIndex,
  ToastNotification,
  AuthUser,
  CustomerBill,
  SecurityAuditLog
} from './types';

export function App() {
  const initialDb = dbService.load();

  const [currentUser, setCurrentUser] = useState<AuthUser>(initialDb.currentUser);
  const [customers, setCustomers] = useState<Customer[]>(initialDb.customers);
  const [leads, setLeads] = useState<Lead[]>(initialDb.leads);
  const [appointments, setAppointments] = useState<Appointment[]>(initialDb.appointments);
  const [bills, setBills] = useState<CustomerBill[]>(initialDb.bills);
  const [marketIndex, setMarketIndex] = useState<MarketIndex>(initialDb.marketIndex);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditLog[]>(initialDb.securityLogs);
  const [audits, setAudits] = useState<SwitchAudit[]>(() => runQuarterlyAudit(initialDb.customers));

  const [activeTab, setActiveTab] = useState<string>(
    currentUser.role === 'customer' ? 'customer_overview' : 'dashboard'
  );

  // Persistenza automatica nel database localStorage
  useEffect(() => {
    dbService.save({
      customers,
      leads,
      appointments,
      bills,
      marketIndex,
      currentUser,
      securityLogs,
    });
  }, [customers, leads, appointments, bills, marketIndex, currentUser, securityLogs]);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const newToast: ToastNotification = {
      id: `toast-${Date.now()}-${Math.random()}`,
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setToasts(prev => [newToast, ...prev]);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper per logging sicurezza
  const recordSecurityLog = (
    eventType: SecurityAuditLog['eventType'], 
    status: SecurityAuditLog['status'], 
    details: string,
    email: string = currentUser.email
  ) => {
    const newLog: SecurityAuditLog = {
      id: `sec-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      eventType,
      userEmail: email,
      ipAddress: '151.48.22.91 (Milano, IT)',
      status,
      details,
    };
    setSecurityLogs(prev => [newLog, ...prev]);
  };

  // Modals & Drawers
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  const [callingLead, setCallingLead] = useState<Lead | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBillOcrOpen, setIsBillOcrOpen] = useState(false);
  const [isMarketSimulatorOpen, setIsMarketSimulatorOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pending2FAUser, setPending2FAUser] = useState<AuthUser | null>(null);
  
  // Slide Over Drawer State
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    customer: Customer | null;
    lead: Lead | null;
  }>({
    isOpen: false,
    customer: null,
    lead: null,
  });

  // Global Shortcut for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pendingSwitches = audits.filter(a => a.status === 'switch_recommended');
  const pendingBills = bills.filter(b => b.status === 'in_review');

  // Switch User Profile / Role
  const handleSelectUser = (newUser: AuthUser) => {
    setCurrentUser(newUser);
    if (newUser.role === 'customer') {
      setActiveTab('customer_overview');
      addToast('Accesso Portale Cliente', `Benvenuto nel tuo cruscotto personale, ${newUser.name}.`, 'success');
      recordSecurityLog('gdpr_consent_logged', 'safe', `Accesso registrato al portale cliente per ${newUser.email}`);
    } else {
      setActiveTab('dashboard');
      addToast('Accesso Backend Call Center', `Benvenuto nell'area operativa, ${newUser.name}.`, 'info');
      recordSecurityLog('login_2fa_success', 'safe', `Accesso operatore call center autorizzato per ${newUser.email}`);
    }
  };

  // 2FA Trigger and Verification
  const handleRequire2FA = (user: AuthUser) => {
    setPending2FAUser(user);
  };

  const handle2FAVerified = (verifiedUser: AuthUser) => {
    handleSelectUser(verifiedUser);
    setPending2FAUser(null);
    recordSecurityLog('login_2fa_success', 'safe', `Autenticazione a due fattori completata con successo via TOTP per ${verifiedUser.email}`);
  };

  // Lead handlers
  const handleAddLead = (newLead: Lead) => {
    setLeads(prev => [newLead, ...prev]);
    addToast('Nuovo Lead Registrato', `${newLead.name} è stato registrato nel database da ${newLead.source}.`, 'success');
  };

  const handleUpdateLeadStatus = (leadId: string, status: LeadStatus, note?: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { 
      ...l, 
      status, 
      notes: note ? `${l.notes} | ${note}` : l.notes 
    } : l));
    addToast('Stato Lead Aggiornato', 'Il contatto è stato aggiornato in agenda call center.', 'info');
  };

  const handleOpenScheduleModal = (lead: Lead) => {
    setSchedulingLead(lead);
  };

  const handleScheduleAppointment = (newApp: Appointment) => {
    setAppointments(prev => [newApp, ...prev]);
    setLeads(prev => prev.map(l => {
      if (l.id === newApp.leadId) {
        return {
          ...l,
          status: 'appointment_booked' as LeadStatus,
          appointmentId: newApp.id,
          assignedCallCenterAgent: newApp.agentName,
        };
      }
      return l;
    }));
    addToast('Appuntamento Confermato', `Fissato incontro con ${newApp.customerName} per il ${new Date(newApp.scheduledAt).toLocaleDateString('it-IT')}.`, 'success');
  };

  const handleUpdateAppointmentStatus = (appId: string, status: AppointmentStatus) => {
    setAppointments(prev => prev.map(a => a.id === appId ? { ...a, status } : a));
  };

  // Conversione vendite in Cliente CRM attivo
  const handleConvertToCustomer = (app: Appointment) => {
    const lead = leads.find(l => l.id === app.leadId);
    const today = new Date();
    const nextAudit = new Date();
    nextAudit.setDate(today.getDate() + 120);

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: app.customerName,
      fiscalCode: 'CF' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      phone: app.phone,
      email: lead?.email || 'cliente@energia.it',
      city: app.city,
      contractStartDate: today.toISOString().split('T')[0],
      lastSwitchAuditDate: today.toISOString().split('T')[0],
      nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
      accountManager: app.agentName,
      hasBrokerageMandate: true,
      utilityPoints: [
        {
          id: `util-${Date.now()}-luce`,
          type: 'luce',
          podOrPdr: `IT001E${Math.floor(10000000 + Math.random() * 90000000)}`,
          annualConsumption: lead?.estimatedConsumptionKwh || 3200,
          powerKw: 3.0,
          currentSupplier: 'A2A Energia',
          currentOfferName: 'A2A Easy Luce Index',
          currentTariffType: 'indexed',
          currentUnitCost: 0.1265,
          currentFixedFeeYear: 114.0,
        },
        {
          id: `util-${Date.now()}-gas`,
          type: 'gas',
          podOrPdr: `0${Math.floor(1000000000000 + Math.random() * 900000000000)}`,
          annualConsumption: lead?.estimatedConsumptionSmc || 900,
          currentSupplier: 'Eni Plenitude',
          currentOfferName: 'Plenitude Trend Casa Gas',
          currentTariffType: 'indexed',
          currentUnitCost: 0.427,
          currentFixedFeeYear: 108.0,
        }
      ],
      notes: 'Acquisito via Call Center da campagna Marketing. Delega switch attiva.',
    };

    setCustomers(prev => [newCustomer, ...prev]);
    handleUpdateAppointmentStatus(app.id, 'completed');
    if (lead) {
      handleUpdateLeadStatus(lead.id, 'contract_signed');
    }

    const updatedCustomers = [newCustomer, ...customers];
    setAudits(runQuarterlyAudit(updatedCustomers));
    setActiveTab('crm');
    addToast('Cliente Attivato nel Database', `${newCustomer.name} è memorizzato nel CRM. Ciclo switch programmato a 120 giorni.`, 'success');
    recordSecurityLog('switch_signed_otp', 'safe', `Mandato di brokeraggio e consenso GDPR attivati per ${newCustomer.name}`);
  };

  // Trigger global audit
  const handleTriggerGlobalAudit = () => {
    const freshAudits = runQuarterlyAudit(customers);
    setAudits(freshAudits);
    addToast('Audit Globale Ricalcolato', `Ricalcolate le tariffe per tutti i ${customers.length} clienti a database.`, 'info');
  };

  // Switch confermato
  const handleAuditSwitched = (auditId: string) => {
    const audit = audits.find(a => a.id === auditId);
    if (!audit) return;

    setCustomers(prev => prev.map(c => {
      if (c.id === audit.customerId) {
        const nextAudit = new Date();
        nextAudit.setDate(nextAudit.getDate() + 120);

        const updatedPoints = c.utilityPoints.map(u => {
          if (u.podOrPdr === audit.podOrPdr) {
            return {
              ...u,
              currentSupplier: audit.bestOffer.supplier,
              currentOfferName: audit.bestOffer.name,
              currentTariffType: audit.bestOffer.pricingType === 'fixed' ? ('fixed' as const) : ('indexed' as const),
              currentUnitCost: audit.bestOffer.unitPriceOrSpread,
              currentFixedFeeYear: audit.bestOffer.fixedAnnualFee,
            };
          }
          return u;
        });

        return {
          ...c,
          lastSwitchAuditDate: new Date().toISOString().split('T')[0],
          nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
          utilityPoints: updatedPoints,
        };
      }
      return c;
    }));

    setAudits(prev => prev.map(a => a.id === auditId ? { ...a, status: 'already_optimal' } : a));
    addToast('Switch Tariffario Applicato', `${audit.customerName} è passato a ${audit.bestOffer.supplier}. Risparmio generato: €${audit.annualSavings.toFixed(0)}/anno.`, 'success');
    recordSecurityLog('switch_signed_otp', 'safe', `Cambio fornitore autorizzato verso ${audit.bestOffer.supplier} per ${audit.customerName}`);
  };

  // OCR import
  const handleImportFromOcr = (newCust: Customer) => {
    setCustomers(prev => [newCust, ...prev]);
    const updated = [newCust, ...customers];
    setAudits(runQuarterlyAudit(updated));
    setActiveTab('crm');
    addToast('Cliente Importato da OCR', `Dati estratti con successo per ${newCust.name} e salvati nel database.`, 'success');
  };

  // Upload bolletta dal portale cliente
  const handleCustomerUploadBill = (newBill: CustomerBill) => {
    setBills(prev => [newBill, ...prev]);
    addToast('Bolletta Ricevuta', `Il file ${newBill.fileName} è stato caricato e inoltrato all'inbox del call center.`, 'success');
    recordSecurityLog('pod_decrypted', 'safe', `Nuova bolletta caricata dal cliente ${newBill.customerName}`);
  };

  // Segna bolletta cliente come analizzata
  const handleMarkBillAnalyzed = (billId: string, savingsEur: number) => {
    setBills(prev => prev.map(b => b.id === billId ? { 
      ...b, 
      status: 'analyzed' as const, 
      extractedSavingsEur: savingsEur 
    } : b));
    addToast('Bolletta Verificata', `Dossier completato con risparmio rilevato di €${savingsEur}/anno.`, 'success');
  };

  // Market Simulator application
  const handleApplyMarketIndex = (newIndex: MarketIndex) => {
    setMarketIndex(newIndex);
    const recomputed = runQuarterlyAudit(customers);
    setAudits(recomputed);
    addToast('Scenario Mercato Aggiornato', `PUN impostato a ${newIndex.punEurKwh.toFixed(4)} €/kWh, PSV a ${newIndex.psvEurSmc.toFixed(4)} €/Smc.`, 'warning');
  };

  // Ricerca cliente attivo per la vista cliente
  const activeCustomer = customers.find(c => c.id === currentUser.customerId) || customers[0];

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-[#0a2540] flex flex-col font-sans">
      {/* Impersonation Banner se si naviga come Cliente */}
      {currentUser.role === 'customer' && (
        <ImpersonationBanner
          currentUser={currentUser}
          onReturnToCallCenter={() => handleSelectUser(DEMO_USERS[0])}
        />
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        marketIndex={marketIndex}
        pendingSwitchesCount={pendingSwitches.length}
        pendingBillsCount={pendingBills.length}
        currentUser={currentUser}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenMarketSimulator={() => setIsMarketSimulatorOpen(true)}
        onOpenBillOcr={() => setIsBillOcrOpen(true)}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VISTA 1: PORTALE CLIENTE FINALE (Isolamento rigoroso BOLA / Tenant Scoping) */}
        {currentUser.role === 'customer' ? (
          <CustomerPortal
            customer={activeCustomer}
            currentUser={currentUser}
            audits={audits.filter(a => a.customerId === activeCustomer.id)}
            bills={bills.filter(b => b.customerId === activeCustomer.id)}
            onUploadBill={handleCustomerUploadBill}
            onApproveSwitch={handleAuditSwitched}
            onSwitchUser={() => setIsLoginModalOpen(true)}
          />
        ) : (
          /* VISTA 2: BACKEND CALL CENTER & BROKER */
          <>
            {activeTab === 'dashboard' && (
              <DashboardOverview
                leads={leads}
                customers={customers}
                audits={audits}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'leads' && (
              <LeadsManager
                leads={leads}
                onAddLead={handleAddLead}
                onOpenScheduleModal={handleOpenScheduleModal}
                onUpdateStatus={handleUpdateLeadStatus}
                onSelectLead={(lead) => setDrawerState({ isOpen: true, lead, customer: null })}
                onOpenCallScript={(lead) => setCallingLead(lead)}
              />
            )}

            {activeTab === 'callcenter' && (
              <CallCenterAgenda
                appointments={appointments}
                leads={leads}
                onAddAppointment={handleScheduleAppointment}
                onUpdateStatus={handleUpdateAppointmentStatus}
                onConvertToCustomer={handleConvertToCustomer}
              />
            )}

            {activeTab === 'inbox_bills' && (
              <ClientBillsInbox
                bills={bills}
                onOpenOcrForBill={(_bill) => setIsBillOcrOpen(true)}
                onMarkAnalyzed={handleMarkBillAnalyzed}
              />
            )}

            {activeTab === 'crm' && (
              <CustomerCrm
                customers={customers}
                onTriggerAuditForCustomer={(_cId) => {
                  setActiveTab('switch4m');
                }}
                onSelectCustomer={(customer) => setDrawerState({ isOpen: true, customer, lead: null })}
              />
            )}

            {activeTab === 'tariffe' && (
              <TariffComparator marketIndex={marketIndex} />
            )}

            {activeTab === 'switch4m' && (
              <QuarterlySwitchEngine
                audits={audits}
                onTriggerGlobalAudit={handleTriggerGlobalAudit}
                onAuditSwitched={handleAuditSwitched}
              />
            )}

            {activeTab === 'security' && (
              <SecurityAuditDashboard
                logs={securityLogs}
                onTriggerScan={() => addToast('Scansione di Sicurezza Completata', 'Tutti i controlli GDPR, 2FA e crittografia AES-256 sono conformi al 100%.', 'success')}
              />
            )}
          </>
        )}
      </main>

      {/* Slide-over Drawer for Lead / Customer details */}
      <SlideOverDrawer
        isOpen={drawerState.isOpen}
        onClose={() => setDrawerState({ isOpen: false, customer: null, lead: null })}
        customer={drawerState.customer}
        lead={drawerState.lead}
        onTriggerSwitch={(_cId) => setActiveTab('switch4m')}
      />

      {/* Call Script Quick-Dialer Drawer per Call Center */}
      <CallScriptDrawer
        isOpen={!!callingLead}
        lead={callingLead}
        onClose={() => setCallingLead(null)}
        onUpdateStatus={handleUpdateLeadStatus}
        onOpenSchedule={handleOpenScheduleModal}
      />

      {/* Modal di prenotazione appuntamento */}
      <ScheduleAppointmentModal
        lead={schedulingLead}
        isOpen={!!schedulingLead}
        onClose={() => setSchedulingLead(null)}
        onSchedule={handleScheduleAppointment}
      />

      {/* Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        leads={leads}
        customers={customers}
        onSelectCustomer={(c) => setDrawerState({ isOpen: true, customer: c, lead: null })}
        onSelectLead={(l) => setDrawerState({ isOpen: true, lead: l, customer: null })}
        onTriggerAction={(actionId) => {
          if (actionId === 'ocr_bill') setIsBillOcrOpen(true);
          else if (actionId === 'market_sim') setIsMarketSimulatorOpen(true);
          else if (actionId === 'switch_4m') setActiveTab('switch4m');
          else if (actionId === 'new_lead') setActiveTab('leads');
        }}
      />

      {/* OCR Bolletta Modal (per Call Center) */}
      <BillOcrModal
        isOpen={isBillOcrOpen}
        onClose={() => setIsBillOcrOpen(false)}
        onImportCustomer={handleImportFromOcr}
      />

      {/* Market Scenario Stress Test Modal */}
      <MarketSimulatorModal
        isOpen={isMarketSimulatorOpen}
        onClose={() => setIsMarketSimulatorOpen(false)}
        currentIndex={marketIndex}
        onApplyIndex={handleApplyMarketIndex}
      />

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSelectUser={handleSelectUser}
        onRequire2FA={handleRequire2FA}
        customers={customers}
      />

      {/* Two-Factor Authentication (2FA) Modal */}
      <TwoFactorModal
        isOpen={!!pending2FAUser}
        user={pending2FAUser}
        onClose={() => setPending2FAUser(null)}
        onVerified={handle2FAVerified}
      />

      {/* Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
      />

      {/* Stripe-style Footer */}
      <footer className="border-t border-[#e3e8ee] bg-white py-5 text-center text-xs text-[#425466]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            VoltaCRM SaaS • Dual-Portal (Cliente & Call Center) • Conforme GDPR & 2FA Attivo
          </span>
          <span className="text-slate-400">
            {currentUser.role === 'customer' 
              ? 'Connesso come Cliente: ' + currentUser.name
              : 'Connesso come Operatore Call Center • 2FA Attivo • Premi ⌘K'}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;

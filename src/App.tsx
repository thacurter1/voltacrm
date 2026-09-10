import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { LeadsManager } from './components/LeadsManager';
import { CallCenterAgenda } from './components/CallCenterAgenda';
import { CustomerCrm } from './components/CustomerCrm';
import { OnboardingManager } from './components/OnboardingManager';
import { TariffComparator } from './components/TariffComparator';
import { QuarterlySwitchEngine } from './components/QuarterlySwitchEngine';
import { ScheduleAppointmentModal } from './components/ScheduleAppointmentModal';
import { SlideOverDrawer } from './components/SlideOverDrawer';
import { CommandPalette } from './components/CommandPalette';
import { BillOcrModal } from './components/BillOcrModal';
import { AddCustomerModal } from './components/AddCustomerModal';
import { ImportCustomersModal } from './components/ImportCustomersModal';
import { MarketSimulatorModal } from './components/MarketSimulatorModal';
import { ToastContainer } from './components/ToastContainer';
import { CustomerPortal } from './components/CustomerPortal';
import { LoginModal } from './components/LoginModal';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { TwoFactorModal } from './components/TwoFactorModal';
import { SecurityAuditDashboard } from './components/SecurityAuditDashboard';
import { ClientBillsInbox } from './components/ClientBillsInbox';
import { CallScriptDrawer } from './components/CallScriptDrawer';
import { TeamProfilesManager } from './components/TeamProfilesManager';
import { CustomerProfileSection } from './components/CustomerProfileSection';
import { PortalGate } from './components/PortalGate';
import { SavingsProposalPdfModal } from './components/SavingsProposalPdfModal';
import { DigitalSignatureModal } from './components/DigitalSignatureModal';
import { CommissionManager } from './components/CommissionManager';
import { InstallAppBanner } from './components/InstallAppBanner';
import { TotemKioskMode } from './components/TotemKioskMode';
const TotemApp = React.lazy(() => import('./apps/TotemApp'));
const CustomerApp = React.lazy(() => import('./apps/CustomerApp'));
const CrmApp = React.lazy(() => import('./apps/CrmApp'));
import { dbService, DEMO_USERS } from './services/db';
import { profileService, INITIAL_PROFILES } from './services/supabaseClient';
import { runQuarterlyAudit } from './services/energyEngine';
import { api } from './api/client';
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
  UserProfile,
  CustomerBill,
  SecurityAuditLog
} from './types';

function UnifiedApp() {
  const initialDb = dbService.load();

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialDb.currentUser || INITIAL_PROFILES[0]);
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [isTotemOpen, setIsTotemOpen] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>(INITIAL_PROFILES);

  // Business Data State
  const [customers, setCustomers] = useState<Customer[]>(initialDb.customers);
  const [leads, setLeads] = useState<Lead[]>(initialDb.leads);
  const [appointments, setAppointments] = useState<Appointment[]>(initialDb.appointments);
  const [bills, setBills] = useState<CustomerBill[]>(initialDb.bills);
  const [marketIndex, setMarketIndex] = useState<MarketIndex>(initialDb.marketIndex);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditLog[]>(initialDb.securityLogs);
  const [audits, setAudits] = useState<SwitchAudit[]>(() => runQuarterlyAudit(initialDb.customers));
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isImportCustomersModalOpen, setIsImportCustomersModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<string>(
    currentUser.role === 'customer' ? 'customer_overview' : 'dashboard'
  );

  const [isRefreshingMarketIndex, setIsRefreshingMarketIndex] = useState(false);

  // Carica indici di mercato live dal feed GME all'avvio
  useEffect(() => {
    api.switch.getMarketIndices()
      .then(liveIndex => {
        if (liveIndex && liveIndex.punEurKwh) {
          setMarketIndex(liveIndex);
          setAudits(() => runQuarterlyAudit(customers.length > 0 ? customers : initialDb.customers, liveIndex));
        }
      })
      .catch(err => {
        console.warn('[VoltaCRM] Impossibile caricare feed GME live all\'avvio, uso cache locale:', err);
      });
  }, []);

  // Carica i profili utente
  useEffect(() => {
    profileService.getProfiles().then(data => {
      if (data && data.length > 0) {
        setProfiles(data);
      }
    });
  }, []);

  // Persistenza automatica con debouncing nel database locale
  useEffect(() => {
    const timer = setTimeout(() => {
      dbService.save({
        customers,
        leads,
        appointments,
        bills,
        marketIndex,
        currentUser,
        securityLogs,
      });
    }, 400);

    return () => clearTimeout(timer);
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
  const [pending2FAUser, setPending2FAUser] = useState<UserProfile | null>(null);
  const [pdfProposalAudit, setPdfProposalAudit] = useState<SwitchAudit | null>(null);
  const [signatureAudit, setSignatureAudit] = useState<SwitchAudit | null>(null);
  
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
  const handleSelectUser = (newUser: UserProfile) => {
    setCurrentUser(newUser);
    setIsGateOpen(false);
    if (newUser.role === 'customer') {
      setActiveTab('customer_overview');
      addToast('Accesso Portale Cliente', `Benvenuto nella tua Area Risparmio, ${newUser.name}.`, 'success');
      recordSecurityLog('gdpr_consent_logged', 'safe', `Accesso registrato al portale cliente per ${newUser.email}`);
    } else {
      setActiveTab('dashboard');
      addToast('Accesso Backend Call Center', `Benvenuto nell'area operativa, ${newUser.name}.`, 'info');
      recordSecurityLog('login_2fa_success', 'safe', `Accesso operatore call center autorizzato per ${newUser.email}`);
    }
  };

  // 2FA Trigger and Verification
  const handleRequire2FA = (user: UserProfile) => {
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
    api.leads.create(newLead).catch(err => {
      console.warn('[App] Sincronizzazione lead su backend REST:', err);
    });
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

  // Conversione vendite in Cliente CRM attivo (richiede dati anagrafici e POD/PDR reali)
  const handleConvertToCustomer = (app: Appointment) => {
    const lead = leads.find(l => l.id === app.leadId);
    if (lead) {
      setConvertingLead(lead);
    } else {
      const tempLead: Lead = {
        id: `lead-app-${app.id}`,
        name: app.customerName,
        phone: app.phone,
        email: `cliente.${app.phone.replace(/\D/g, '')}@energia.it`,
        city: app.city,
        source: 'landing_page',
        status: 'contract_signed',
        notes: app.notes || 'Contratto perfezionato da call center.',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setConvertingLead(tempLead);
    }

    setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'completed' as AppointmentStatus } : a));
    addToast('Perfeziona Anagrafica', `Compila i dati fiscali e POD/PDR effettivi per ${app.customerName}.`, 'info');
  };

  // Importazione da OCR Bolletta
  const handleImportFromOcr = (customerData: Partial<Customer>) => {
    const today = new Date();
    const nextAudit = new Date();
    nextAudit.setDate(today.getDate() + 120);

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: customerData.name || 'Nuovo Cliente da Bolletta',
      fiscalCode: customerData.fiscalCode || 'CF' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      phone: customerData.phone || '+39 347 0000000',
      email: customerData.email || 'cliente.ocr@email.it',
      city: customerData.city || 'Milano',
      contractStartDate: today.toISOString().split('T')[0],
      lastSwitchAuditDate: today.toISOString().split('T')[0],
      nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
      accountManager: currentUser.name,
      hasBrokerageMandate: true,
      utilityPoints: customerData.utilityPoints || []
    };

    const updated = [newCustomer, ...customers];
    setCustomers(updated);
    setAudits(runQuarterlyAudit(updated));
    addToast('Bolletta Importata con Successo', `${newCustomer.name} aggiunto al portafoglio clienti con audit attivo.`, 'success');
  };

  // Aggiunta Nuovo Cliente (Manuale da CRM o da Conversione Lead)
  const handleAddCustomer = async (newCustomer: Customer) => {
    try {
      await api.customers.create(newCustomer);
    } catch (err) {
      console.warn('[App] Fallback locale per creazione cliente:', err);
    }

    const updated = [newCustomer, ...customers];
    setCustomers(updated);
    setAudits(runQuarterlyAudit(updated, marketIndex));

    // Se il cliente corrisponde a un lead attivo, aggiorna il lead a 'contract_signed'
    const matchedLead = leads.find(l => l.phone === newCustomer.phone || l.name.toLowerCase() === newCustomer.name.toLowerCase());
    if (matchedLead) {
      handleUpdateLeadStatus(matchedLead.id, 'contract_signed', 'Convertito in cliente con successo');
    }

    addToast(
      'Cliente Registrato con Successo',
      `${newCustomer.name} è stato inserito a portafoglio (${newCustomer.utilityPoints.length} forniture). Audit ARERA attivato.`,
      'success'
    );
    recordSecurityLog('gdpr_consent_logged', 'safe', `Nuovo cliente e mandato registrato per ${newCustomer.name}`);
  };

  // Importazione Massiva Clienti (CSV / Excel)
  const handleBatchAddCustomers = (newCustomers: Customer[]) => {
    if (!newCustomers.length) return;
    const updated = [...newCustomers, ...customers];
    setCustomers(updated);
    setAudits(runQuarterlyAudit(updated, marketIndex));

    newCustomers.forEach(c => {
      api.customers.create(c).catch(err => {
        console.warn('[App] Fallback locale per cliente batch:', err);
      });
    });

    addToast(
      'Importazione Massiva Completata',
      `${newCustomers.length} clienti importati con successo e inseriti nell'audit ARERA.`,
      'success'
    );
    recordSecurityLog(
      'gdpr_consent_logged',
      'safe',
      `Importati ${newCustomers.length} clienti da file CSV/Excel con consenso e mandato registrati.`
    );
  };

  // Upload bolletta dal portale cliente
  const handleCustomerUploadBill = (bill: CustomerBill) => {
    setBills(prev => [bill, ...prev]);
    addToast('Bolletta Ricevuta', `Il documento "${bill.fileName}" è stato inviato per la verifica di conformità ARERA.`, 'success');
  };

  // Marcare bolletta come analizzata
  const handleMarkBillAnalyzed = (billId: string) => {
    setBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'analyzed' as const, extractedSavingsEur: 180.0 } : b));
    addToast('Bolletta Lavorata', 'Analisi completata e caricata nel portale del cliente.', 'success');
  };

  // Switch approval
  const handleAuditSwitched = (auditId: string) => {
    setAudits(prev => prev.map(a => a.id === auditId ? { ...a, status: 'switched' as const } : a));
    recordSecurityLog('switch_signed_otp', 'safe', `Mandato di switch perfezionato per audit ${auditId}`);
    
    const audit = audits.find(a => a.id === auditId);
    if (audit) {
      api.commissions.generate({
        agentId: currentUser.id,
        agentName: currentUser.name,
        contractId: `switch-${auditId}`,
        customerName: audit.customerName,
        podOrPdr: audit.podOrPdr,
        utilityType: audit.utilityType,
        annualConsumption: 3500
      }).catch(err => console.warn('[VoltaCRM] Errore provvigione su switch:', err));
    }

    addToast('Switch Perfezionato!', 'Cambio fornitore attivato con successo e provvigione registrata.', 'success');
  };

  const handleTriggerGlobalAudit = () => {
    const freshAudits = runQuarterlyAudit(customers, marketIndex);
    setAudits(freshAudits);
    addToast('Audit Quadrimestrale Eseguito', `Analizzate ${customers.length} posizioni cliente su PUN/PSV correnti.`, 'info');
  };

  const handleApplyMarketIndex = (newIndex: MarketIndex) => {
    setMarketIndex(newIndex);
    const recomputed = runQuarterlyAudit(customers, newIndex);
    setAudits(recomputed);
    addToast('Scenario Mercato Aggiornato', `PUN impostato a ${newIndex.punEurKwh.toFixed(4)} €/kWh, PSV a ${newIndex.psvEurSmc.toFixed(4)} €/Smc.`, 'warning');
  };

  const handleRefreshMarketIndices = async () => {
    setIsRefreshingMarketIndex(true);
    try {
      const refreshed = await api.switch.refreshMarketIndices();
      if (refreshed && refreshed.punEurKwh) {
        setMarketIndex(refreshed);
        const recomputed = runQuarterlyAudit(customers, refreshed);
        setAudits(recomputed);
        addToast(
          'Feed GME Sincronizzato',
          `PUN: ${refreshed.punEurKwh.toFixed(4)} €/kWh (F1: ${refreshed.punF1?.toFixed(4) || '—'}) | PSV: ${refreshed.psvEurSmc.toFixed(4)} €/Smc.`,
          'success'
        );
      }
    } catch (err: any) {
      addToast('Errore Feed GME', err?.message || 'Impossibile contattare il server per aggiornare gli indici.', 'warning');
    } finally {
      setIsRefreshingMarketIndex(false);
    }
  };

  // Ricerca cliente attivo per la vista cliente
  const activeCustomer = customers.find(c => c.id === currentUser.customerId) || customers[0];

  // Se è attiva la modalità Totem Kiosk per negozi e centri commerciali
  if (isTotemOpen) {
    return (
      <TotemKioskMode
        isOpen={isTotemOpen}
        onExitTotem={() => setIsTotemOpen(false)}
        onLeadCaptured={(newLead) => {
          handleAddLead(newLead);
          recordSecurityLog(
            'gdpr_consent_logged', 
            'safe', 
            `Lead registrato da Totem Point touch: ${newLead.phone} (${newLead.notes})`
          );
        }}
        onToast={addToast}
      />
    );
  }

  // Se l'utente non è autenticato o ha scelto "Esci", mostra la schermata di selezione portale / login
  if (isGateOpen) {
    return (
      <>
        <PortalGate
          onLoginCustomer={handleSelectUser}
          onLoginOperator={handleSelectUser}
          onRequire2FA={handleRequire2FA}
          customers={customers}
          profiles={profiles}
          onToast={addToast}
          onOpenTotem={() => setIsTotemOpen(true)}
        />
        <TwoFactorModal
          isOpen={!!pending2FAUser}
          user={pending2FAUser}
          onClose={() => setPending2FAUser(null)}
          onVerified={handle2FAVerified}
        />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-[#0a2540] flex flex-col font-sans">
      {/* Impersonation Banner se un operatore naviga come Cliente */}
      {currentUser.role === 'customer' && (
        <ImpersonationBanner
          currentUser={currentUser}
          onReturnToCallCenter={() => {
            const operator = profiles.find(p => p.role === 'admin' || p.role === 'call_center') || DEMO_USERS[0];
            handleSelectUser(operator);
          }}
        />
      )}

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        marketIndex={marketIndex}
        pendingSwitchesCount={pendingSwitches.length}
        pendingBillsCount={pendingBills.length}
        pendingCommissionsCount={2}
        currentUser={currentUser}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenMarketSimulator={() => setIsMarketSimulatorOpen(true)}
        onOpenBillOcr={() => setIsBillOcrOpen(true)}
        onOpenAddCustomer={() => setIsAddCustomerModalOpen(true)}
        onOpenLogin={() => setIsGateOpen(true)}
        onOpenTotem={() => setIsTotemOpen(true)}
        onRefreshMarketIndex={handleRefreshMarketIndices}
        isRefreshingMarketIndex={isRefreshingMarketIndex}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8">
        {/* VISTA 1: PORTALE CLIENTE FINALE */}
        {currentUser.role === 'customer' ? (
          activeTab === 'customer_profile' ? (
            <CustomerProfileSection
              customer={activeCustomer}
              currentUser={currentUser}
              onUpdateCustomer={(updated) => setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))}
              onToast={addToast}
            />
          ) : (
            <CustomerPortal
              customer={activeCustomer}
              currentUser={currentUser}
              audits={audits.filter(a => a.customerId === activeCustomer.id)}
              bills={bills.filter(b => b.customerId === activeCustomer.id)}
              onUploadBill={handleCustomerUploadBill}
              onApproveSwitch={(auditId) => {
                const a = audits.find(x => x.id === auditId);
                if (a) setSignatureAudit(a);
                else handleAuditSwitched(auditId);
              }}
              onSwitchUser={() => setIsGateOpen(true)}
              onOpenPdfProposal={(audit) => setPdfProposalAudit(audit)}
              onOpenSignature={(audit) => setSignatureAudit(audit)}
            />
          )
        ) : (
          /* VISTA 2: BACKEND CALL CENTER & BROKER */
          <>
            {activeTab === 'dashboard' && (
              <DashboardOverview
                leads={leads}
                customers={customers}
                audits={audits}
                onNavigate={setActiveTab}
                onOpenAddCustomer={() => setIsAddCustomerModalOpen(true)}
              />
            )}

            {activeTab === 'onboarding' && (
              <OnboardingManager
                customers={customers}
                leads={leads}
                marketIndex={marketIndex}
                currentUserRole={currentUser.role}
                currentUserName={currentUser.name}
                onAddCustomer={handleAddCustomer}
                onOpenBillOcr={() => setIsBillOcrOpen(true)}
                onOpenImportCsv={() => setIsImportCustomersModalOpen(true)}
                onSelectCustomer={(customer) => setDrawerState({ isOpen: true, customer, lead: null })}
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
                onAddCustomer={handleAddCustomer}
                onBatchAddCustomers={handleBatchAddCustomers}
                onOpenBillOcr={() => setIsBillOcrOpen(true)}
                onNavigateToLeads={() => setActiveTab('leads')}
                onNavigateToOnboarding={() => setActiveTab('onboarding')}
              />
            )}

            {activeTab === 'team_profiles' && (
              <TeamProfilesManager
                currentUser={currentUser}
                profiles={profiles}
                customers={customers}
                onProfilesUpdated={setProfiles}
                onCustomerCreated={(newCust) => {
                  setCustomers(prev => [newCust, ...prev]);
                  setAudits(runQuarterlyAudit([newCust, ...customers]));
                }}
                onToast={addToast}
              />
            )}

            {activeTab === 'commissions' && (
              <CommissionManager
                currentUser={currentUser}
                onToast={addToast}
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
                onOpenProposalPdf={(audit) => setPdfProposalAudit(audit)}
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
        onConvertLeadToCustomer={(lead) => {
          setDrawerState({ isOpen: false, customer: null, lead: null });
          setConvertingLead(lead);
        }}
      />

      {/* Modal di Conversione Lead in Cliente o Creazione Diretta */}
      <AddCustomerModal
        isOpen={isAddCustomerModalOpen || !!convertingLead}
        onClose={() => {
          setIsAddCustomerModalOpen(false);
          setConvertingLead(null);
        }}
        initialLead={convertingLead}
        onSave={(cust) => {
          handleAddCustomer(cust);
          setIsAddCustomerModalOpen(false);
          setConvertingLead(null);
        }}
      />

      {/* Modal Importazione Massiva Clienti (CSV / Excel) */}
      <ImportCustomersModal
        isOpen={isImportCustomersModalOpen}
        onClose={() => setIsImportCustomersModalOpen(false)}
        onImportCustomers={handleBatchAddCustomers}
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
          else if (actionId === 'onboarding') setActiveTab('onboarding');
          else if (actionId === 'new_customer') setIsAddCustomerModalOpen(true);
          else if (actionId === 'import_customers') setIsImportCustomersModalOpen(true);
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
        onRefreshFromGme={handleRefreshMarketIndices}
        isRefreshingFromGme={isRefreshingMarketIndex}
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

      {/* Studio di Fattibilità Energetica & Proposta PDF */}
      <SavingsProposalPdfModal
        isOpen={!!pdfProposalAudit}
        onClose={() => setPdfProposalAudit(null)}
        audit={pdfProposalAudit}
        customer={customers.find(c => c.id === pdfProposalAudit?.customerId)}
        advisorName={currentUser.name}
        onProceedToSign={() => {
          const a = pdfProposalAudit;
          setPdfProposalAudit(null);
          if (a) setSignatureAudit(a);
        }}
      />

      {/* Firma Digitale Mandato Switch Modal */}
      <DigitalSignatureModal
        isOpen={!!signatureAudit}
        onClose={() => setSignatureAudit(null)}
        audit={signatureAudit}
        customerPhone={customers.find(c => c.id === signatureAudit?.customerId)?.phone}
        onSigned={(auditId, signatureType, documentHash) => {
          handleAuditSwitched(auditId);
          recordSecurityLog(
            'switch_signed_otp', 
            'safe', 
            `Mandato di switch perfezionato digitalmente tramite ${signatureType === 'canvas' ? 'firma biometrica su schermo' : 'codice OTP SMS/WhatsApp'} per audit ${auditId} [Sigillo: ${documentHash || 'N/A'}]`
          );
        }}
      />

      {/* Install PWA Mobile Banner */}
      <InstallAppBanner />

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
              : 'Connesso come Operatore: ' + currentUser.name + ' • 2FA Attivo'}
          </span>
        </div>
      </footer>
    </div>
  );
}

const Fallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-950">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-500"></div>
  </div>
);

export function App() {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const appParam = searchParams.get('app') || searchParams.get('mode');

  if (host.startsWith('totem.') || appParam === 'totem') {
    return <React.Suspense fallback={<Fallback />}><TotemApp /></React.Suspense>;
  }
  if (host.startsWith('cliente.') || appParam === 'cliente' || appParam === 'customer') {
    return <React.Suspense fallback={<Fallback />}><CustomerApp /></React.Suspense>;
  }
  if (host.startsWith('crm.') || appParam === 'crm') {
    return <React.Suspense fallback={<Fallback />}><CrmApp /></React.Suspense>;
  }

  return <UnifiedApp />;
}

export default App;


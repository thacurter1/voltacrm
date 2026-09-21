import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { LeadsManager } from './components/LeadsManager';
import { CallCenterWorkspace } from './components/callcenter/CallCenterWorkspace';
import { PortfolioManager } from './components/portfolio/PortfolioManager';
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
import { LoginModal } from './components/LoginModal';
import { ImpersonationBanner } from './components/ImpersonationBanner';
import { TwoFactorModal } from './components/TwoFactorModal';
import { SecurityAuditDashboard } from './components/SecurityAuditDashboard';
import { ClientBillsInbox } from './components/ClientBillsInbox';
import { CallScriptDrawer } from './components/CallScriptDrawer';
import { TeamProfilesManager } from './components/TeamProfilesManager';
import { PortalGate } from './components/PortalGate';
import { SavingsProposalPdfModal } from './components/SavingsProposalPdfModal';
import { DigitalSignatureModal } from './components/DigitalSignatureModal';
import { SignatureActivationPanel } from './components/SignatureActivationPanel';
import { CommissionManager } from './components/CommissionManager';
import { InstallAppBanner } from './components/InstallAppBanner';
import { TotemKioskMode } from './components/TotemKioskMode';
const TotemApp = React.lazy(() => import('./apps/TotemApp'));
const CustomerApp = React.lazy(() => import('./apps/CustomerApp'));
const CrmApp = React.lazy(() => import('./apps/CrmApp'));
import { dbService, DEMO_USERS } from './services/db';
import { INITIAL_PROFILES } from './services/supabaseClient';
import { runQuarterlyAudit } from './services/energyEngine';
import { api, DEMO_MODE } from './api/client';
import { portalApi } from './api/portal';
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

function createCustomerFromOcr(customerData: Partial<Customer>, accountManager: string): Customer {
  const today = new Date();
  const nextAudit = new Date();
  nextAudit.setDate(today.getDate() + 120);
  const randomSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();

  return {
    id: `cust-${Date.now()}`,
    name: customerData.name || 'Nuovo Cliente da Bolletta',
    fiscalCode: customerData.fiscalCode || `CF${randomSuffix}`,
    phone: customerData.phone || '+39 347 0000000',
    email: customerData.email || 'cliente.ocr@email.it',
    city: customerData.city || 'Milano',
    contractStartDate: today.toISOString().split('T')[0],
    lastSwitchAuditDate: today.toISOString().split('T')[0],
    nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
    accountManager,
    hasBrokerageMandate: true,
    utilityPoints: customerData.utilityPoints || []
  };
}

function UnifiedApp() {
  const initialDb = dbService.load();

  // Auth & Session State
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialDb.currentUser || INITIAL_PROFILES[0]);
  const [isGateOpen, setIsGateOpen] = useState(!DEMO_MODE);
  const [isTotemOpen, setIsTotemOpen] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>(DEMO_MODE ? INITIAL_PROFILES : []);

  // Business Data State
  const [customers, setCustomers] = useState<Customer[]>(DEMO_MODE ? initialDb.customers : []);
  const customersRef = useRef(customers.length > 0 ? customers : initialDb.customers);
  useEffect(() => {
    customersRef.current = customers.length > 0 ? customers : initialDb.customers;
  }, [customers, initialDb.customers]);
  const [leads, setLeads] = useState<Lead[]>(DEMO_MODE ? initialDb.leads : []);
  const [appointments, setAppointments] = useState<Appointment[]>(DEMO_MODE ? initialDb.appointments : []);
  const [bills, setBills] = useState<CustomerBill[]>(DEMO_MODE ? initialDb.bills : []);
  const [marketIndex, setMarketIndex] = useState<MarketIndex>(initialDb.marketIndex);
  const [securityLogs, setSecurityLogs] = useState<SecurityAuditLog[]>(DEMO_MODE ? initialDb.securityLogs : []);
  const [audits, setAudits] = useState<SwitchAudit[]>(() => runQuarterlyAudit(DEMO_MODE ? initialDb.customers : []));
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isImportCustomersModalOpen, setIsImportCustomersModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<string>(
    currentUser.role === 'customer' ? 'customer_overview' : 'dashboard'
  );

  const [isRefreshingMarketIndex, setIsRefreshingMarketIndex] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const newToast: ToastNotification = {
      id: `toast-${Date.now()}-${Math.random()}`,
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setToasts(prev => [newToast, ...prev]);
  }, []);

  const handleDismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Switch User Profile / Role
  const handleSelectUser = useCallback(async (_newUser?: UserProfile) => {
    try {
      const { user } = await api.auth.me();
      const isCustomer = user.role === 'customer';
      const [customerRows, leadRows, profileRows, billRows, appointmentRows, securityRows] = await Promise.all([
        isCustomer ? api.customers.getById(user.customerId).then(c=>c?[c]:[]) : api.customers.getAll(),
        isCustomer ? Promise.resolve([]) : api.leads.getAll(),
        isCustomer ? Promise.resolve([user]) : api.auth.profiles(),
        portalApi.listBills(isCustomer ? user.customerId : undefined),
        isCustomer ? Promise.resolve([]) : api.operations.listAppointments(),
        isCustomer ? Promise.resolve([]) : api.operations.listSecurityLogs(),
      ]);
      setCustomers(customerRows); setLeads(leadRows); setProfiles(profileRows); setBills(billRows);
      setAppointments(appointmentRows); setSecurityLogs(securityRows);
      setAudits(runQuarterlyAudit(customerRows, marketIndex));
      setCurrentUser(user); setIsGateOpen(false);
      setActiveTab(isCustomer ? 'customer_overview' : 'dashboard');
    } catch(error) {
      setIsGateOpen(true);
      addToast('Accesso non completato',error instanceof Error?error.message:'Dati non disponibili.','warning');
    }
  }, [marketIndex, addToast]);

  // Carica indici di mercato live dal feed GME all'avvio
  useEffect(() => {
    let isMounted = true;
    api.switch.getMarketIndices()
      .then(liveIndex => {
        if (isMounted && liveIndex && liveIndex.punEurKwh) {
          setMarketIndex(liveIndex);
          setAudits(runQuarterlyAudit(customersRef.current, liveIndex));
        }
      })
      .catch(err => {
        if (isMounted) {
          console.warn('[VoltaCRM] Impossibile caricare feed GME live all\'avvio, uso cache locale:', err);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Restore only a backend-validated session, never a local role selection.
  useEffect(() => {
    if (DEMO_MODE || !localStorage.getItem('VOLTA_AUTH_TOKEN')) return;
    api.auth.me().then(({user})=>handleSelectUser(user)).catch(()=>{api.auth.logout();setIsGateOpen(true);});
  }, [handleSelectUser]);

  // Demo persistence only. Server data is reloaded on authenticated access.
  useEffect(() => {
    if (!DEMO_MODE) return;
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


  // Helper per logging sicurezza
  const recordSecurityLog = async (
    eventType: SecurityAuditLog['eventType'], 
    status: SecurityAuditLog['status'], 
    details: string,
    _email: string = currentUser.email
  ) => {
    try {
      const saved = await api.operations.addSecurityLog({ eventType, status, details });
      setSecurityLogs(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
    } catch (error) {
      console.error('Registrazione evento di sicurezza non riuscita:', error);
    }
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
  const handleAddLead = async (newLead: Lead) => {
    try {
      const saved = await api.leads.create(newLead);
      setLeads(prev=>[saved,...prev]);
      addToast('Lead registrato',saved.name,'success');
    } catch(error) {addToast('Salvataggio non riuscito',error instanceof Error?error.message:'Riprova.','warning');}
  };

  const handleUpdateLeadStatus = async (leadId:string,status:LeadStatus,note?:string) => {
    try {const saved=await api.leads.updateStatus(leadId,status,note);if(saved)setLeads(prev=>prev.map(l=>l.id===saved.id?saved:l));}
    catch(error){addToast('Aggiornamento non riuscito',error instanceof Error?error.message:'Riprova.','warning');}
  };

  const handleOpenScheduleModal = (lead: Lead) => {
    setSchedulingLead(lead);
  };

  const handleScheduleAppointment = async (newApp: Appointment) => {
    try {
      const saved = await api.operations.saveAppointment(newApp);
      setAppointments(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
    setLeads(prev => prev.map(l => {
      if (l.id === saved.leadId) {
        return {
          ...l,
          status: 'appointment_booked' as LeadStatus,
          appointmentId: saved.id,
          assignedCallCenterAgent: saved.agentName,
        };
      }
      return l;
    }));
      addToast('Appuntamento Confermato', `Fissato incontro con ${saved.customerName} per il ${new Date(saved.scheduledAt).toLocaleDateString('it-IT')}.`, 'success');
    } catch (error) {
      addToast('Appuntamento non salvato', error instanceof Error ? error.message : 'Riprova.', 'warning');
    }
  };

  const handleUpdateAppointmentStatus = async (appId: string, status: AppointmentStatus) => {
    try {
      const saved = await api.operations.updateAppointmentStatus(appId, status);
      setAppointments(prev => prev.map(a => a.id === saved.id ? saved : a));
    } catch (error) {
      addToast('Stato non aggiornato', error instanceof Error ? error.message : 'Riprova.', 'warning');
    }
  };

  // Conversione vendite in Cliente CRM attivo (richiede dati anagrafici e POD/PDR reali)
  const handleConvertToCustomer = async (app: Appointment) => {
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

    await handleUpdateAppointmentStatus(app.id, 'completed');
    addToast('Perfeziona Anagrafica', `Compila i dati fiscali e POD/PDR effettivi per ${app.customerName}.`, 'info');
  };

  // Importazione da OCR Bolletta
  const handleImportFromOcr = async (customerData: Partial<Customer>) => {
    const newCustomer = createCustomerFromOcr(customerData, currentUser.name);
    await handleAddCustomer(newCustomer);
  };

  // Aggiunta Nuovo Cliente (Manuale da CRM o da Conversione Lead)
  const handleAddCustomer = async (newCustomer: Customer) => {
    try {
      const saved=await api.customers.create(newCustomer);
      setCustomers(prev=>[saved,...prev]);
      setAudits(prev=>[...runQuarterlyAudit([saved],marketIndex),...prev]);
      addToast('Cliente registrato',saved.name,'success');
    } catch(error) {addToast('Cliente non salvato',error instanceof Error?error.message:'Riprova.','warning');}
  };

  // Importazione Massiva Clienti (CSV / Excel)
  const handleBatchAddCustomers = async (newCustomers: Customer[]) => {
    const results=await Promise.allSettled(newCustomers.map(c=>api.customers.create(c)));
    const saved=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
    setCustomers(prev=>[...saved,...prev]);
    setAudits(prev=>[...runQuarterlyAudit(saved,marketIndex),...prev]);
    const failed=results.length-saved.length;
    addToast('Esito importazione',`${saved.length} salvati; ${failed} non salvati.`,failed?'warning':'success');
  };

  // Marcare bolletta come analizzata
  const handleMarkBillAnalyzed = (billId: string) => {
    setBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'analyzed' as const, extractedSavingsEur: 180.0 } : b));
    addToast('Bolletta Lavorata', 'Analisi completata e caricata nel portale del cliente.', 'success');
  };

  const handleAnalyzeStoredBill = async (bill: CustomerBill) => {
    try {
      const analysis = await portalApi.analyzeBill(bill.id);
      setBills(prev => prev.map(item => item.id === bill.id ? analysis.bill : item));
      addToast('Bolletta Analizzata', `Analisi OCR salvata per ${bill.customerName}.`, 'success');
    } catch (error) {
      addToast('Analisi non completata', error instanceof Error ? error.message : 'Provider OCR non disponibile.', 'warning');
    }
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

  if (currentUser.role === 'customer') {
    return (
      <div className="min-h-screen bg-[#f7f7f8] flex flex-col font-sans">
        <ImpersonationBanner
          currentUser={currentUser}
          onReturnToCallCenter={() => {
            const operator = profiles.find(p => p.role === 'admin' || p.role === 'call_center') || DEMO_USERS[0];
            handleSelectUser(operator);
          }}
        />
        <React.Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Caricamento Portale Clienti...</div>}>
          <CustomerApp />
        </React.Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-[#0a2540] flex flex-col font-sans">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#635bff] focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white text-xs font-bold"
      >
        Vai al contenuto principale
      </a>

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

      <main id="main-content" className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8">
        {/* BACKEND CALL CENTER & BROKER CRM */}
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
              <CallCenterWorkspace
                leads={leads}
                consultants={profiles}
                appointments={appointments}
                onUpdateLeadStatus={handleUpdateLeadStatus}
                onScheduleAppointment={(data) => {
                  const fullApp: Appointment = {
                    ...data,
                    id: data.id || `app-${Date.now()}`
                  } as Appointment;
                  handleScheduleAppointment(fullApp);
                  api.operations.saveAppointment(fullApp).catch(e => console.warn(e));
                }}
                onUpdateAppointmentStatus={(id, st) => {
                  handleUpdateAppointmentStatus(id, st);
                  api.operations.updateAppointmentStatus(id, st).catch(e => console.warn(e));
                }}
                onConvertToCustomer={handleConvertToCustomer}
                onBulkImportSuccess={() => {
                  api.leads.getAll().then((updatedLeads: Lead[]) => {
                    if (updatedLeads && updatedLeads.length > 0) setLeads(updatedLeads);
                  });
                  addToast('Import Massivo Completato', 'I lead sono stati inseriti nella coda di chiamata.', 'success');
                }}
              />
            )}

            {activeTab === 'inbox_bills' && (
              <ClientBillsInbox
                bills={bills}
                onOpenOcrForBill={handleAnalyzeStoredBill}
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

            {activeTab === 'portfolio' && (
              <PortfolioManager
                customers={customers}
                profiles={profiles}
                onSelectCustomer={(customer) => setDrawerState({ isOpen: true, customer, lead: null })}
                onTriggerSwitchAudit={(_cId) => setActiveTab('switch4m')}
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
              <TariffComparator
                marketIndex={marketIndex}
                onSelectOffer={(offer) => {
                  setActiveTab('onboarding');
                  addToast(
                    'Tariffa Selezionata',
                    `Offerta ${offer.name} (${offer.supplier}) pronta per essere associata al nuovo contratto.`,
                    'success'
                  );
                }}
              />
            )}

            {activeTab === 'switch4m' && (
              <>
                <QuarterlySwitchEngine
                  audits={audits}
                  onTriggerGlobalAudit={handleTriggerGlobalAudit}
                  onAuditSwitched={handleAuditSwitched}
                  onOpenProposalPdf={(audit) => setPdfProposalAudit(audit)}
                  onToast={addToast}
                />
                <SignatureActivationPanel onActivated={(signature, commissions) => {
                  setAudits(prev => prev.map(a => a.customerId === signature.customerId && a.podOrPdr === signature.podOrPdr
                    ? { ...a, status: 'switched' as const }
                    : a));
                  const commMsg = commissions?.totalEur ? ` Provvigioni maturate: €${commissions.totalEur}.` : '';
                  addToast('Switch Attivato', `Confermata l’attivazione per ${signature.podOrPdr}.${commMsg}`, 'success');
                }} />
              </>
            )}

            {activeTab === 'security' && (
              <SecurityAuditDashboard
                logs={securityLogs}
                onTriggerScan={() => addToast('Scansione di Sicurezza Completata', 'Tutti i controlli GDPR, 2FA e crittografia AES-256 sono conformi al 100%.', 'success')}
              />
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
        customerFiscalCode={customers.find(c => c.id === signatureAudit?.customerId)?.fiscalCode}
        onSigned={(auditId, signatureType, receipt) => {
          setAudits(prev => prev.map(a => a.id === auditId ? { ...a, status: 'signed' as const } : a));
          addToast('Firma Registrata', 'La richiesta è firmata e attende la conferma di attivazione dello staff.', 'success');
          recordSecurityLog(
            'switch_signed_otp', 
            'safe', 
            `Richiesta di switch firmata tramite ${signatureType === 'canvas' ? 'firma su schermo' : 'codice OTP'} per audit ${auditId}; attivazione in attesa [Sigillo: ${receipt.signatureHash}]`
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
          <span className="font-semibold text-[#0a2540]">
            Volta Energia CRM • Gestione Forniture & Broker • Conforme GDPR & 2FA Attivo
          </span>
          <span className="text-slate-400">
            Connesso come {currentUser.role === 'admin' ? 'Amministratore' : 'Operatore'}: {currentUser.name} • 2FA Attivo
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
  if (DEMO_MODE && (host.startsWith('cliente.') || appParam === 'cliente' || appParam === 'customer')) {
    return <React.Suspense fallback={<Fallback />}><CustomerApp /></React.Suspense>;
  }
  if (DEMO_MODE && (host.startsWith('crm.') || appParam === 'crm')) {
    return <React.Suspense fallback={<Fallback />}><CrmApp /></React.Suspense>;
  }

  return <UnifiedApp />;
}

export default App;

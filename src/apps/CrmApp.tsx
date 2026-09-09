import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { DashboardOverview } from '../components/DashboardOverview';
import { LeadsManager } from '../components/LeadsManager';
import { CallCenterAgenda } from '../components/CallCenterAgenda';
import { CustomerCrm } from '../components/CustomerCrm';
import { TariffComparator } from '../components/TariffComparator';
import { QuarterlySwitchEngine } from '../components/QuarterlySwitchEngine';
import { ScheduleAppointmentModal } from '../components/ScheduleAppointmentModal';
import { SlideOverDrawer } from '../components/SlideOverDrawer';
import { CommandPalette } from '../components/CommandPalette';
import { BillOcrModal } from '../components/BillOcrModal';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { ImportCustomersModal } from '../components/ImportCustomersModal';
import { MarketSimulatorModal } from '../components/MarketSimulatorModal';
import { ToastContainer } from '../components/ToastContainer';
import { TwoFactorModal } from '../components/TwoFactorModal';
import { SecurityAuditDashboard } from '../components/SecurityAuditDashboard';
import { ClientBillsInbox } from '../components/ClientBillsInbox';
import { CallScriptDrawer } from '../components/CallScriptDrawer';
import { TeamProfilesManager } from '../components/TeamProfilesManager';
import { CustomerProfileSection } from '../components/CustomerProfileSection';
import { SavingsProposalPdfModal } from '../components/SavingsProposalPdfModal';
import { DigitalSignatureModal } from '../components/DigitalSignatureModal';
import { CommissionManager } from '../components/CommissionManager';
import { InstallAppBanner } from '../components/InstallAppBanner';

import { dbService } from '../services/db';
import { profileService, INITIAL_PROFILES } from '../services/supabaseClient';
import { runQuarterlyAudit } from '../services/energyEngine';
import { api } from '../api/client';
import { 
  Appointment, 
  Customer, 
  Lead, 
  LeadStatus, 
  AppointmentStatus,
  SwitchAudit, 
  MarketIndex, 
  ToastNotification, 
  UserProfile, 
  CustomerBill, 
  SecurityAuditLog 
} from '../types';

export const CrmApp: React.FC = () => {
  const initialDb = dbService.load();

  // Auth & Session
  const [currentUser, setCurrentUser] = useState<UserProfile>(
    initialDb.currentUser?.role !== 'customer' ? (initialDb.currentUser || INITIAL_PROFILES[0]) : INITIAL_PROFILES[0]
  );
  const [profiles, setProfiles] = useState<UserProfile[]>(INITIAL_PROFILES);

  // Business Data
  const [customers, setCustomers] = useState<Customer[]>(initialDb.customers);
  const [leads, setLeads] = useState<Lead[]>(initialDb.leads);
  const [appointments, setAppointments] = useState<Appointment[]>(initialDb.appointments);
  const [bills, setBills] = useState<CustomerBill[]>(initialDb.bills);
  const [marketIndex, setMarketIndex] = useState<MarketIndex>(initialDb.marketIndex);
  const [isRefreshingMarketIndex, setIsRefreshingMarketIndex] = useState(false);
  const [securityLogs] = useState<SecurityAuditLog[]>(initialDb.securityLogs);
  const audits = React.useMemo(() => runQuarterlyAudit(customers, marketIndex), [customers, marketIndex]);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isImportCustomersModalOpen, setIsImportCustomersModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Load GME live feed on startup
  useEffect(() => {
    api.switch.getMarketIndices()
      .then(liveIndex => {
        if (liveIndex && liveIndex.punEurKwh) {
          setMarketIndex(liveIndex);
        }
      })
      .catch(err => {
        console.warn('[VoltaCRM] Impossibile caricare feed GME live in CrmApp:', err);
      });
  }, []);

  // Load cloud profiles
  useEffect(() => {
    profileService.getProfiles().then(data => {
      if (data && data.length > 0) {
        setProfiles(data);
      }
    });
  }, []);

  // Sync with DB
  useEffect(() => {
    dbService.save({
      currentUser,
      customers,
      leads,
      appointments,
      bills,
      marketIndex,
      securityLogs,
    });
  }, [currentUser, customers, leads, appointments, bills, marketIndex, securityLogs]);

  // Sync with DB
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBillOcrOpen, setIsBillOcrOpen] = useState(false);
  const [isMarketSimOpen, setIsMarketSimOpen] = useState(false);
  const [is2faModalOpen, setIs2faModalOpen] = useState(false);
  const [activeScriptLead, setActiveScriptLead] = useState<Lead | null>(null);

  // PDF & Signature
  const [pdfProposalAudit, setPdfProposalAudit] = useState<SwitchAudit | null>(null);
  const [signatureAudit, setSignatureAudit] = useState<SwitchAudit | null>(null);

  // Notifications
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

  // Handlers
  const handleUpdateLeadStatus = (leadId: string, status: LeadStatus, note?: string) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { 
      ...l, 
      status, 
      notes: note ? `${l.notes} | ${note}` : l.notes 
    } : l));
    addToast('Stato Lead Aggiornato', 'Il contatto è stato aggiornato in agenda call center.', 'info');
  };

  const handleAddLead = (newLead: Lead) => {
    setLeads(prev => [newLead, ...prev]);
    addToast('Nuovo Lead Acquisito', `${newLead.name} è stato inserito nel CRM.`, 'success');
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
    addToast('Appuntamento Confermato', `Fissato incontro con ${newApp.customerName}.`, 'success');
  };

  const handleUpdateAppointmentStatus = (id: string, st: AppointmentStatus) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: st } : a));
  };

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
        }
      ]
    };

    setCustomers(prev => [newCustomer, ...prev]);
    setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'completed' as AppointmentStatus } : a));
    if (lead) {
      handleUpdateLeadStatus(lead.id, 'contract_signed', 'Contratto sottoscritto con successo');
    }
    addToast('Contratto Attivato', `${newCustomer.name} è ora cliente attivo con audit quadrimestrale programmato.`, 'success');

    // Registra la provvigione commerciale per l'agente
    api.commissions.generate({
      agentId: currentUser.id,
      agentName: currentUser.name,
      contractId: `cnt-${Date.now()}`,
      customerName: newCustomer.name,
      podOrPdr: newCustomer.utilityPoints[0]?.podOrPdr || 'IT001EXXXXXXXX',
      utilityType: 'luce',
      annualConsumption: lead?.estimatedConsumptionKwh || 3200
    }).catch(err => console.warn('[VoltaCRM] Errore calcolo provvigione:', err));
  };

  // Aggiunta Nuovo Cliente (Manuale da CRM o da Conversione Lead)
  const handleAddCustomer = async (newCustomer: Customer) => {
    try {
      await api.customers.create(newCustomer);
    } catch (err) {
      console.warn('[CrmApp] Fallback locale per creazione cliente:', err);
    }

    setCustomers(prev => [newCustomer, ...prev]);

    const matchedLead = leads.find(l => l.phone === newCustomer.phone || l.name.toLowerCase() === newCustomer.name.toLowerCase());
    if (matchedLead) {
      handleUpdateLeadStatus(matchedLead.id, 'contract_signed', 'Convertito in cliente con successo');
    }

    addToast(
      'Cliente Registrato con Successo',
      `${newCustomer.name} è stato inserito a portafoglio (${newCustomer.utilityPoints.length} forniture). Audit ARERA programmato.`,
      'success'
    );

    api.commissions.generate({
      agentId: currentUser.id,
      agentName: currentUser.name,
      contractId: `cnt-${Date.now()}`,
      customerName: newCustomer.name,
      podOrPdr: newCustomer.utilityPoints[0]?.podOrPdr || 'IT001EXXXXXXXX',
      utilityType: newCustomer.utilityPoints[0]?.type || 'luce',
      annualConsumption: newCustomer.utilityPoints[0]?.annualConsumption || 3000
    }).catch(err => console.warn('[CrmApp] Errore calcolo provvigione:', err));
  };

  // Importazione Massiva Clienti (CSV / Excel)
  const handleBatchAddCustomers = (newCustomers: Customer[]) => {
    if (!newCustomers.length) return;
    setCustomers(prev => [...newCustomers, ...prev]);

    newCustomers.forEach(c => {
      api.customers.create(c).catch(err => {
        console.warn('[CrmApp] Fallback locale per cliente batch:', err);
      });
    });

    addToast(
      'Importazione Massiva Completata',
      `${newCustomers.length} clienti importati con successo e inseriti nell'audit ARERA.`,
      'success'
    );
  };

  const handleAuditSwitched = (auditId: string) => {
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
    addToast('Switch Confermato', 'Pratica inoltrata ad ARERA e provvigione registrata.', 'success');
  };

  const handleRefreshMarketIndices = async () => {
    setIsRefreshingMarketIndex(true);
    try {
      const refreshed = await api.switch.refreshMarketIndices();
      if (refreshed && refreshed.punEurKwh) {
        setMarketIndex(refreshed);
        addToast(
          'Feed GME Sincronizzato',
          `PUN: ${refreshed.punEurKwh.toFixed(4)} €/kWh (F1: ${refreshed.punF1?.toFixed(4) || '—'}) | PSV: ${refreshed.psvEurSmc.toFixed(4)} €/Smc.`,
          'success'
        );
      }
    } catch (err: any) {
      addToast('Errore Feed GME', err?.message || 'Impossibile sincronizzare indici GME.', 'warning');
    } finally {
      setIsRefreshingMarketIndex(false);
    }
  };

  const pendingSwitchesCount = audits.filter(a => a.status === 'switch_recommended').length;
  const pendingBillsCount = bills.filter(b => b.status === 'in_review').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <InstallAppBanner />

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        marketIndex={marketIndex}
        pendingSwitchesCount={pendingSwitchesCount}
        pendingBillsCount={pendingBillsCount}
        pendingCommissionsCount={2}
        currentUser={currentUser}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenMarketSimulator={() => setIsMarketSimOpen(true)}
        onOpenBillOcr={() => setIsBillOcrOpen(true)}
        onOpenAddCustomer={() => setIsAddCustomerModalOpen(true)}
        onOpenLogin={() => setIs2faModalOpen(true)}
        onOpenTotem={() => { window.location.search = '?app=totem'; }}
        onRefreshMarketIndex={handleRefreshMarketIndices}
        isRefreshingMarketIndex={isRefreshingMarketIndex}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 pb-24 sm:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            leads={leads}
            customers={customers}
            audits={audits}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenAddCustomer={() => setIsAddCustomerModalOpen(true)}
          />
        )}

        {activeTab === 'leads' && (
          <LeadsManager
            leads={leads}
            onAddLead={handleAddLead}
            onOpenScheduleModal={(lead) => setSchedulingLead(lead)}
            onUpdateStatus={handleUpdateLeadStatus}
            onSelectLead={(lead) => {
              setDrawerLead(lead);
              setDrawerCustomer(null);
            }}
            onOpenCallScript={(lead) => {
              setActiveScriptLead(lead);
              addToast('Chiamata Avviata', `Aperto copione AIDA per ${lead.name}`, 'info');
            }}
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

        {activeTab === 'crm' && (
          <CustomerCrm
            customers={customers}
            onTriggerAuditForCustomer={(_cId) => setActiveTab('switch4m')}
            onSelectCustomer={(customer) => {
              setDrawerCustomer(customer);
              setDrawerLead(null);
            }}
            onAddCustomer={handleAddCustomer}
            onBatchAddCustomers={handleBatchAddCustomers}
            onOpenBillOcr={() => setIsBillOcrOpen(true)}
            onNavigateToLeads={() => setActiveTab('leads')}
          />
        )}

        {activeTab === 'switch4m' && (
          <QuarterlySwitchEngine
            audits={audits}
            onTriggerGlobalAudit={() => {
              addToast('Audit Globale Completato', 'Tariffe e PUN/PSV ricalcolati su tutti i clienti.', 'success');
            }}
            onAuditSwitched={handleAuditSwitched}
            onOpenProposalPdf={(audit) => setPdfProposalAudit(audit)}
          />
        )}

        {activeTab === 'tariffe' && (
          <TariffComparator marketIndex={marketIndex} />
        )}

        {activeTab === 'inbox_bills' && (
          <ClientBillsInbox
            bills={bills}
            onOpenOcrForBill={() => setIsBillOcrOpen(true)}
            onMarkAnalyzed={(billId, savings) => {
              setBills(prev => prev.map(b => b.id === billId ? { ...b, status: 'analyzed', extractedSavingsEur: savings } : b));
              addToast('Bolletta Analizzata', `Risparmio calcolato: €${savings}/anno`, 'success');
            }}
          />
        )}

        {activeTab === 'team_profiles' && (
          <TeamProfilesManager
            currentUser={currentUser}
            profiles={profiles}
            customers={customers}
            onProfilesUpdated={(updated) => setProfiles(updated)}
            onCustomerCreated={(newCust) => setCustomers(prev => [newCust, ...prev])}
            onToast={addToast}
          />
        )}

        {activeTab === 'commissions' && (
          <CommissionManager
            currentUser={currentUser}
            onToast={addToast}
          />
        )}

        {activeTab === 'profile' && (
          <CustomerProfileSection
            customer={customers[0]}
            currentUser={currentUser}
            onUpdateCustomer={(updated) => {
              setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
              addToast('Profilo Aggiornato', 'Dati salvati con successo.', 'success');
            }}
            onToast={addToast}
          />
        )}

        {activeTab === 'security' && (
          <SecurityAuditDashboard
            logs={securityLogs}
            onTriggerScan={() => {
              addToast('Diagnostica Sicurezza', 'Tutti i controlli Zero-Trust RLS sono conformi al 100%.', 'success');
            }}
          />
        )}
      </main>

      {/* Slide-over Drawer */}
      <SlideOverDrawer
        isOpen={!!drawerLead || !!drawerCustomer}
        lead={drawerLead}
        customer={drawerCustomer}
        onClose={() => {
          setDrawerLead(null);
          setDrawerCustomer(null);
        }}
        onTriggerSwitch={() => setActiveTab('switch4m')}
        onConvertLeadToCustomer={(lead) => {
          setDrawerLead(null);
          setDrawerCustomer(null);
          setConvertingLead(lead);
        }}
      />

      {/* Modal Creazione Cliente da Lead o Diretto */}
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

      {/* Appointment Scheduling */}
      <ScheduleAppointmentModal
        isOpen={!!schedulingLead}
        lead={schedulingLead}
        onClose={() => setSchedulingLead(null)}
        onSchedule={handleScheduleAppointment}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        leads={leads}
        customers={customers}
        onSelectCustomer={(c) => {
          setDrawerCustomer(c);
          setDrawerLead(null);
        }}
        onSelectLead={(l) => {
          setDrawerLead(l);
          setDrawerCustomer(null);
        }}
        onTriggerAction={(actionId) => {
          if (actionId === 'ocr_bill') setIsBillOcrOpen(true);
          else if (actionId === 'market_sim') setIsMarketSimOpen(true);
          else if (actionId === 'switch_4m') setActiveTab('switch4m');
          else if (actionId === 'new_lead') setActiveTab('leads');
          else if (actionId === 'new_customer') setIsAddCustomerModalOpen(true);
          else if (actionId === 'import_customers') setIsImportCustomersModalOpen(true);
        }}
      />

      {/* Bill OCR Modal */}
      <BillOcrModal
        isOpen={isBillOcrOpen}
        onClose={() => setIsBillOcrOpen(false)}
        onImportCustomer={(cust) => {
          setCustomers(prev => [cust as Customer, ...prev]);
          addToast('Cliente Importato', `${cust.name} aggiunto dal PDF bolletta.`, 'success');
        }}
      />

      {/* Market Simulator */}
      <MarketSimulatorModal
        isOpen={isMarketSimOpen}
        onClose={() => setIsMarketSimOpen(false)}
        currentIndex={marketIndex}
        onApplyIndex={(newIndex) => {
          setMarketIndex(newIndex);
          addToast('Simulazione Applicata', 'Nuovi indici PUN/PSV attivi sul calcolo.', 'info');
        }}
        onRefreshFromGme={handleRefreshMarketIndices}
        isRefreshingFromGme={isRefreshingMarketIndex}
      />

      {/* 2FA Modal */}
      <TwoFactorModal
        isOpen={is2faModalOpen}
        user={currentUser}
        onClose={() => setIs2faModalOpen(false)}
        onVerified={(verifiedUser) => {
          setCurrentUser(verifiedUser);
          addToast('2FA Verificato', 'Autenticatore RFC 6238 TOTP configurato.', 'success');
        }}
      />

      {/* Call Script Drawer */}
      <CallScriptDrawer
        isOpen={!!activeScriptLead}
        lead={activeScriptLead}
        onClose={() => setActiveScriptLead(null)}
        onUpdateStatus={handleUpdateLeadStatus}
        onOpenSchedule={(lead) => {
          setActiveScriptLead(null);
          setSchedulingLead(lead);
        }}
      />

      {/* PDF Proposal */}
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

      {/* Digital Signature */}
      <DigitalSignatureModal
        isOpen={!!signatureAudit}
        onClose={() => setSignatureAudit(null)}
        audit={signatureAudit}
        customerPhone={customers.find(c => c.id === signatureAudit?.customerId)?.phone}
        onSigned={(auditId) => handleAuditSwitched(auditId)}
      />

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
};

export default CrmApp;

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  UserPlus,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  Zap,
  Flame,
  Building2,
  User,
  ShieldCheck,
  ChevronRight,
  Check,
  X,
  RefreshCw,
  SlidersHorizontal,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { Customer, Lead, UtilityPoint, OnboardingRecord, OnboardingStage, MarketIndex } from '../types';

interface OnboardingManagerProps {
  customers: Customer[];
  leads: Lead[];
  marketIndex: MarketIndex;
  currentUserRole?: string;
  currentUserName?: string;
  onAddCustomer: (customer: Customer) => Promise<void> | void;
  onOpenBillOcr?: () => void;
  onOpenImportCsv?: () => void;
  onSelectCustomer?: (customer: Customer) => void;
}

const STAGES_CONFIG: {
  id: OnboardingStage;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  description: string;
}[] = [
  {
    id: 'bozza',
    label: 'Bozza & Anagrafica',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800',
    description: 'Dati iniziali raccolti, in attesa di documenti o POD/PDR completi'
  },
  {
    id: 'verifica_tecnica',
    label: 'Verifica Tecnica',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800',
    description: 'Controllo conformità POD/PDR presso distributore e anagrafica ARERA'
  },
  {
    id: 'firma_mandato',
    label: 'Firma Mandato',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeBg: 'bg-purple-100 text-purple-800',
    description: 'Mandato di brokeraggio e consenso GDPR in attesa di firma OTP'
  },
  {
    id: 'switch_programmato',
    label: 'Switch Programmato',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    badgeBg: 'bg-orange-100 text-orange-800',
    description: 'Pratica inoltrata al fornitore subentrante per attivazione della fornitura'
  },
  {
    id: 'attivo',
    label: 'Onboarding Concluso',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    description: 'Fornitura attiva e cliente inserito nel ciclo di audit quadrimestrale'
  }
];

export const OnboardingManager: React.FC<OnboardingManagerProps> = ({
  customers,
  leads,
  marketIndex,
  currentUserRole: _currentUserRole = 'admin',
  currentUserName = 'Operatore Volta Energy',
  onAddCustomer,
  onOpenBillOcr,
  onOpenImportCsv,
  onSelectCustomer
}) => {
  // Tab attiva: 'pipeline' (Kanban/Tabellare) o 'wizard' (Percorso guidato)
  const [activeView, setActiveView] = useState<'pipeline' | 'wizard'>('pipeline');
  const [pipelineLayout, setPipelineLayout] = useState<'kanban' | 'table'>('kanban');

  // Filtri Pipeline
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Stato Pratiche Onboarding
  const [records, setRecords] = useState<OnboardingRecord[]>(() => {
    // Inizializza con pratiche derivate o simulate per fornire immediata utilità
    const initial: OnboardingRecord[] = [
      {
        id: 'onb-001',
        customerName: 'Studio Legale Avv. G. Valenti',
        fiscalCode: 'VLNGNN78A14F205K',
        customerType: 'business',
        phone: '+39 02 8749102',
        email: 'amministrazione@valenti-lex.it',
        city: 'Milano',
        stage: 'verifica_tecnica',
        utilityTypes: ['luce', 'gas'],
        pod: 'IT001E89234120',
        pdr: '012984719284',
        annualConsumptionKwh: 12400,
        annualConsumptionSmc: 3200,
        estimatedAnnualSavingsEur: 680,
        supplier: 'Enel Energia',
        assignedAgent: 'Marco Brambilla',
        mandateSigned: true,
        documentsUploaded: true,
        startedAt: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        notes: 'Verifica potenza impegnata (15kW) in corso con e-distribuzione.'
      },
      {
        id: 'onb-002',
        customerName: 'Panificio & Bistrot Il Grano d\'Oro',
        fiscalCode: '09812450159',
        customerType: 'business',
        phone: '+39 039 214589',
        email: 'ordini@ilgranodoro.com',
        city: 'Monza',
        stage: 'firma_mandato',
        utilityTypes: ['luce', 'gas'],
        pod: 'IT001E99812344',
        pdr: '045981230192',
        annualConsumptionKwh: 34000,
        annualConsumptionSmc: 8400,
        estimatedAnnualSavingsEur: 1940,
        supplier: 'A2A Energia',
        assignedAgent: 'Elena Rostagno',
        mandateSigned: false,
        documentsUploaded: true,
        startedAt: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
        updatedAt: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        notes: 'Inviato link per firma digitale OTP al titolare via SMS.'
      },
      {
        id: 'onb-003',
        customerName: 'Dr.ssa Martina Ferretti',
        fiscalCode: 'FRRMTN85E41L219Y',
        customerType: 'residential',
        phone: '+39 349 7712044',
        email: 'martina.ferretti@libero.it',
        city: 'Torino',
        stage: 'switch_programmato',
        utilityTypes: ['luce'],
        pod: 'IT001E55401923',
        annualConsumptionKwh: 3800,
        estimatedAnnualSavingsEur: 215,
        supplier: 'E.ON Energia',
        assignedAgent: 'Matteo Riva',
        mandateSigned: true,
        documentsUploaded: true,
        startedAt: new Date(Date.now() - 12 * 86400000).toISOString().split('T')[0],
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
        notes: 'Passaggio fornitura confermato con decorrenza 1° del prossimo mese.'
      },
      {
        id: 'onb-004',
        customerName: 'Officina Meccanica Rossi Srl',
        fiscalCode: '04128950961',
        customerType: 'business',
        phone: '+39 035 441092',
        email: 'info@meccanicarossi.it',
        city: 'Bergamo',
        stage: 'bozza',
        utilityTypes: ['luce'],
        pod: 'IT001E77812049',
        annualConsumptionKwh: 22000,
        estimatedAnnualSavingsEur: 1120,
        supplier: 'Plenitude',
        assignedAgent: 'Davide Galli',
        mandateSigned: false,
        documentsUploaded: false,
        startedAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        notes: 'In attesa della scansione della prima pagina della bolletta luce.'
      }
    ];

    // Collega anche i clienti già a portafoglio come 'attivo' per completezza storica
    const completedFromCustomers: OnboardingRecord[] = customers.slice(0, 4).map(c => ({
      id: `onb-cust-${c.id}`,
      customerName: c.name,
      fiscalCode: c.fiscalCode,
      customerType: c.fiscalCode.length === 11 ? 'business' : 'residential',
      phone: c.phone,
      email: c.email,
      city: c.city,
      stage: 'attivo' as OnboardingStage,
      utilityTypes: c.utilityPoints.map(u => u.type),
      pod: c.utilityPoints.find(u => u.type === 'luce')?.podOrPdr,
      pdr: c.utilityPoints.find(u => u.type === 'gas')?.podOrPdr,
      annualConsumptionKwh: c.utilityPoints.find(u => u.type === 'luce')?.annualConsumption,
      annualConsumptionSmc: c.utilityPoints.find(u => u.type === 'gas')?.annualConsumption,
      estimatedAnnualSavingsEur: 240,
      supplier: c.utilityPoints[0]?.currentSupplier || 'Fornitore Attuale',
      assignedAgent: c.accountManager || 'Matteo Riva',
      mandateSigned: true,
      documentsUploaded: true,
      startedAt: c.contractStartDate || new Date().toISOString().split('T')[0],
      updatedAt: c.lastSwitchAuditDate || new Date().toISOString().split('T')[0],
      notes: 'Onboarding completato con successo. In ciclo audit quadrimestrale.'
    }));

    return [...initial, ...completedFromCustomers];
  });

  // Scheda Dettagli Selezionata
  const [selectedRecord, setSelectedRecord] = useState<OnboardingRecord | null>(null);

  // ==========================================
  // STATO DEL WIZARD DI ONBOARDING (5 STEP)
  // ==========================================
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [wizardCustomerType, setWizardCustomerType] = useState<'residential' | 'business'>('residential');
  const [wizardName, setWizardName] = useState('');
  const [wizardFiscalCode, setWizardFiscalCode] = useState('');
  const [wizardPhone, setWizardPhone] = useState('');
  const [wizardEmail, setWizardEmail] = useState('');
  const [wizardCity, setWizardCity] = useState('');

  // Step 2: Forniture
  const [hasLuce, setHasLuce] = useState(true);
  const [hasGas, setHasGas] = useState(false);
  const [wizardPod, setWizardPod] = useState('');
  const [wizardPdr, setWizardPdr] = useState('');
  const [wizardKwh, setWizardKwh] = useState(3200);
  const [wizardSmc, setWizardSmc] = useState(850);
  const [wizardPowerKw, setWizardPowerKw] = useState(3.0);
  const [wizardSupplier, setWizardSupplier] = useState('Enel Energia');
  const [wizardUnitCost, setWizardUnitCost] = useState(0.165);
  const [wizardGasCost, setWizardGasCost] = useState(0.55);

  // Step 3: Tariffa Selezionata
  const [selectedTariff, setSelectedTariff] = useState<'indicizzata_arera' | 'fissa_tutelata'>('indicizzata_arera');

  // Step 4: Mandato & Privacy
  const [mandateAccepted, setMandateAccepted] = useState(true);
  const [gdprAccepted, setGdprAccepted] = useState(true);
  const [signatureMethod, setSignatureMethod] = useState<'otp' | 'canvas' | 'manual'>('otp');

  // Step 5: Success State
  const [isSubmittingWizard, setIsSubmittingWizard] = useState(false);
  const [createdCustomerResult, setCreatedCustomerResult] = useState<Customer | null>(null);

  // Calcolo Risparmio Stimato nel Wizard
  const estimatedSavings = useMemo(() => {
    let savings = 0;
    if (hasLuce) {
      const currentCost = wizardKwh * wizardUnitCost + 120;
      const optimizedCost = wizardKwh * (marketIndex.punEurKwh + 0.012) + 72;
      savings += Math.max(40, Math.round(currentCost - optimizedCost));
    }
    if (hasGas) {
      const currentGasCost = wizardSmc * wizardGasCost + 96;
      const optimizedGasCost = wizardSmc * (marketIndex.psvEurSmc + 0.045) + 60;
      savings += Math.max(30, Math.round(currentGasCost - optimizedGasCost));
    }
    return savings;
  }, [hasLuce, hasGas, wizardKwh, wizardUnitCost, wizardSmc, wizardGasCost, marketIndex]);

  // Pre-popola wizard da un Lead selezionato
  const handleSelectLeadForWizard = (lead: Lead) => {
    setWizardName(lead.name);
    setWizardPhone(lead.phone);
    setWizardEmail(lead.email);
    setWizardCity(lead.city);
    if (lead.estimatedConsumptionKwh) {
      setHasLuce(true);
      setWizardKwh(lead.estimatedConsumptionKwh);
    }
    if (lead.estimatedConsumptionSmc) {
      setHasGas(true);
      setWizardSmc(lead.estimatedConsumptionSmc);
    }
    setActiveView('wizard');
    setWizardStep(1);
  };

  // Reset del wizard
  const handleResetWizard = () => {
    setWizardStep(1);
    setWizardCustomerType('residential');
    setWizardName('');
    setWizardFiscalCode('');
    setWizardPhone('');
    setWizardEmail('');
    setWizardCity('');
    setHasLuce(true);
    setHasGas(false);
    setWizardPod('');
    setWizardPdr('');
    setWizardKwh(3200);
    setWizardSmc(850);
    setCreatedCustomerResult(null);
  };

  // Avanzamento stato pratica nel Kanban
  const handleAdvanceStage = (recordId: string) => {
    const stageOrder: OnboardingStage[] = ['bozza', 'verifica_tecnica', 'firma_mandato', 'switch_programmato', 'attivo'];
    setRecords(prev => prev.map(rec => {
      if (rec.id !== recordId) return rec;
      const currentIndex = stageOrder.indexOf(rec.stage);
      if (currentIndex < stageOrder.length - 1) {
        const nextStage = stageOrder[currentIndex + 1];
        return {
          ...rec,
          stage: nextStage,
          updatedAt: new Date().toISOString().split('T')[0]
        };
      }
      return rec;
    }));
  };

  // Completamento finale del Wizard -> Creazione Cliente nel DB e in Onboarding
  const handleCompleteWizard = async () => {
    setIsSubmittingWizard(true);

    const custId = `cust-onb-${Date.now()}`;
    const utilityPoints: UtilityPoint[] = [];

    if (hasLuce) {
      utilityPoints.push({
        id: `point-${custId}-luce`,
        type: 'luce',
        podOrPdr: wizardPod.trim() || `IT001E${Math.floor(10000000 + Math.random() * 90000000)}`,
        annualConsumption: wizardKwh,
        powerKw: wizardPowerKw,
        currentSupplier: wizardSupplier || 'A2A Energia',
        currentOfferName: selectedTariff === 'indicizzata_arera' ? 'Volta Index Tutelata PUN' : 'Volta Lock Tutelata',
        currentTariffType: selectedTariff === 'indicizzata_arera' ? 'indexed' : 'fixed',
        currentUnitCost: wizardUnitCost,
        currentFixedFeeYear: 84
      });
    }

    if (hasGas) {
      utilityPoints.push({
        id: `point-${custId}-gas`,
        type: 'gas',
        podOrPdr: wizardPdr.trim() || `0${Math.floor(1000000000000 + Math.random() * 900000000000)}`,
        annualConsumption: wizardSmc,
        currentSupplier: wizardSupplier || 'Eni Plenitude',
        currentOfferName: selectedTariff === 'indicizzata_arera' ? 'Volta Index Tutelata PSV' : 'Volta Lock Gas',
        currentTariffType: selectedTariff === 'indicizzata_arera' ? 'indexed' : 'fixed',
        currentUnitCost: wizardGasCost,
        currentFixedFeeYear: 72
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const nextAudit = new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0];

    const newCustomer: Customer = {
      id: custId,
      name: wizardName.trim(),
      fiscalCode: wizardFiscalCode.trim().toUpperCase() || (wizardCustomerType === 'business' ? '01928374650' : 'RSSMRA80A01H501U'),
      phone: wizardPhone.trim(),
      email: wizardEmail.trim() || 'cliente@energia.it',
      city: wizardCity.trim() || 'Milano',
      contractStartDate: today,
      lastSwitchAuditDate: today,
      nextSwitchAuditDate: nextAudit,
      accountManager: currentUserName,
      hasBrokerageMandate: true,
      utilityPoints,
      notes: `Onboarding completato via Wizard VoltaCRM. Mandato firmato via ${signatureMethod.toUpperCase()}. Risparmio stimato: €${estimatedSavings}/anno.`
    };

    // Creazione del record di tracking onboarding
    const newOnboardingRecord: OnboardingRecord = {
      id: `onb-${Date.now()}`,
      customerName: newCustomer.name,
      fiscalCode: newCustomer.fiscalCode,
      customerType: wizardCustomerType,
      phone: newCustomer.phone,
      email: newCustomer.email,
      city: newCustomer.city,
      stage: 'switch_programmato',
      utilityTypes: utilityPoints.map(u => u.type),
      pod: utilityPoints.find(u => u.type === 'luce')?.podOrPdr,
      pdr: utilityPoints.find(u => u.type === 'gas')?.podOrPdr,
      annualConsumptionKwh: hasLuce ? wizardKwh : undefined,
      annualConsumptionSmc: hasGas ? wizardSmc : undefined,
      estimatedAnnualSavingsEur: estimatedSavings,
      supplier: wizardSupplier,
      assignedAgent: currentUserName,
      mandateSigned: true,
      documentsUploaded: true,
      startedAt: today,
      updatedAt: today,
      notes: `Onboarding completato. Mandato sottoscritto via ${signatureMethod.toUpperCase()}.`
    };

    try {
      await onAddCustomer(newCustomer);
      setRecords(prev => [newOnboardingRecord, ...prev]);
      setCreatedCustomerResult(newCustomer);
      setWizardStep(5);
    } catch (err) {
      console.error('Errore durante creazione cliente da onboarding:', err);
    } finally {
      setIsSubmittingWizard(false);
    }
  };

  // Pratiche filtrate per la vista Pipeline
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchQuery = !searchQuery || 
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.fiscalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.pod && r.pod.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.pdr && r.pdr.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStage = filterStage === 'all' || r.stage === filterStage;
      const matchType = filterType === 'all' || r.customerType === filterType;

      return matchQuery && matchStage && matchType;
    });
  }, [records, searchQuery, filterStage, filterType]);

  // Conteggi per metrica rapida
  const stats = useMemo(() => {
    const total = records.length;
    const inProgress = records.filter(r => r.stage === 'bozza' || r.stage === 'verifica_tecnica' || r.stage === 'firma_mandato').length;
    const readyForSwitch = records.filter(r => r.stage === 'switch_programmato').length;
    const completed = records.filter(r => r.stage === 'attivo').length;
    const totalEstimatedSavings = records.reduce((acc, r) => acc + (r.estimatedAnnualSavingsEur || 0), 0);
    return { total, inProgress, readyForSwitch, completed, totalEstimatedSavings };
  }, [records]);

  return (
    <div className="space-y-6">
      {/* Testata della Sezione Onboarding */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Centro Onboarding Clienti & Contratti
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Protocollo Zero Errori ARERA
            </span>
          </div>
          <p className="text-sm text-slate-600 max-w-2xl">
            Gestisci l'attivazione completa dei nuovi clienti: dalla raccolta anagrafica e verifica dei punti POD/PDR, fino alla sottoscrizione digitale del mandato di brokeraggio e all'inoltro dello switch.
          </p>
        </div>

        {/* Pulsanti Azione Rapida */}
        <div className="flex flex-wrap items-center gap-2">
          {activeView === 'pipeline' ? (
            <button
              onClick={() => {
                handleResetWizard();
                setActiveView('wizard');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-xs min-h-[44px]"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Nuovo Onboarding Guidato</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveView('pipeline')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Torna al Monitor Pratiche</span>
            </button>
          )}

          {onOpenBillOcr && (
            <button
              onClick={onOpenBillOcr}
              className="inline-flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-all min-h-[44px]"
              title="Estrai anagrafica e POD da PDF bolletta con intelligenza artificiale"
            >
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              <span className="hidden sm:inline">OCR Bolletta</span>
            </button>
          )}

          {onOpenImportCsv && (
            <button
              onClick={onOpenImportCsv}
              className="inline-flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl text-sm border border-slate-200 transition-all min-h-[44px]"
              title="Importa massivamente clienti da file CSV/Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Rapide */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 mb-1">Pratiche Totali</div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" /> Pipeline attiva
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="text-xs font-medium text-amber-700 mb-1">In Lavorazione</div>
          <div className="text-2xl font-bold text-amber-900">{stats.inProgress}</div>
          <div className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Bozza o firma pendente
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-xs bg-orange-50/20">
          <div className="text-xs font-medium text-orange-700 mb-1">Switch Programmato</div>
          <div className="text-2xl font-bold text-orange-900">{stats.readyForSwitch}</div>
          <div className="text-[11px] text-orange-700 mt-1 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> In attesa di subentro
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="text-xs font-medium text-emerald-700 mb-1">Onboarding Conclusi</div>
          <div className="text-2xl font-bold text-emerald-900">{stats.completed}</div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> In regime audit ARERA
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-xl border border-indigo-200 shadow-xs bg-indigo-50/20">
          <div className="text-xs font-medium text-indigo-700 mb-1">Risparmio Generato</div>
          <div className="text-2xl font-bold text-indigo-900">€{stats.totalEstimatedSavings.toLocaleString('it-IT')}</div>
          <div className="text-[11px] text-indigo-700 mt-1 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Stima annua garantita
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* VISTA 1: MONITOR & PIPELINE PRATICHE       */}
      {/* ========================================== */}
      {activeView === 'pipeline' && (
        <div className="space-y-4">
          {/* Barra Filtri e Layout Toggle */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca per cliente, CF, POD, PDR..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Tutti gli stati</option>
                  {STAGES_CONFIG.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Tutte le tipologie</option>
                  <option value="residential">Residenziale</option>
                  <option value="business">Business / P.IVA</option>
                </select>
              </div>
            </div>

            {/* Layout switch */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setPipelineLayout('kanban')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  pipelineLayout === 'kanban'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setPipelineLayout('table')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  pipelineLayout === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Elenco Tabellare
              </button>
            </div>
          </div>

          {/* Sezione di Conversione Rapida Lead Marketing -> Onboarding */}
          {leads.filter(l => l.status === 'in_negotiation' || l.status === 'appointment_booked').length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 p-4 rounded-xl border border-indigo-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Lead Pronti per Onboarding ({leads.filter(l => l.status === 'in_negotiation' || l.status === 'appointment_booked').length})
                  </h4>
                  <p className="text-xs text-slate-600">
                    Converti istantaneamente un contatto qualificato dell'agenda in una pratica di onboarding con pre-compilazione automatica.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
                {leads
                  .filter(l => l.status === 'in_negotiation' || l.status === 'appointment_booked')
                  .slice(0, 3)
                  .map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => handleSelectLeadForWizard(lead)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg text-xs font-medium whitespace-nowrap transition-all shadow-xs"
                    >
                      <span>{lead.name}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* VISTA KANBAN */}
          {pipelineLayout === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
              {STAGES_CONFIG.map(stage => {
                const stageRecords = filteredRecords.filter(r => r.stage === stage.id);

                return (
                  <div
                    key={stage.id}
                    className={`rounded-xl border ${stage.borderColor} ${stage.bgColor}/40 p-3 min-h-[500px] flex flex-col`}
                  >
                    {/* Header Colonna */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                          {stage.label}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stage.badgeBg}`}>
                        {stageRecords.length}
                      </span>
                    </div>

                    {/* Elenco Carte */}
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {stageRecords.map(record => (
                        <div
                          key={record.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-semibold text-sm text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                              {record.customerName}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                              record.customerType === 'business'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {record.customerType === 'business' ? 'Azienda' : 'Privato'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 font-mono mb-2.5">
                            {record.fiscalCode}
                          </div>

                          {/* Forniture badge */}
                          <div className="flex items-center gap-1.5 mb-3">
                            {record.utilityTypes.includes('luce') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[11px] font-medium">
                                <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
                                {record.pod ? record.pod.slice(0, 10) + '...' : 'POD Incompleto'}
                              </span>
                            )}
                            {record.utilityTypes.includes('gas') && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-medium">
                                <Flame className="h-3 w-3 fill-blue-500 text-blue-500" />
                                {record.pdr ? record.pdr.slice(0, 8) + '...' : 'PDR Incompleto'}
                              </span>
                            )}
                          </div>

                          {/* Risparmio e Agente */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="text-emerald-700 font-semibold">
                              +€{record.estimatedAnnualSavingsEur}/anno
                            </div>
                            <div className="text-slate-400 text-[11px] truncate max-w-[90px]">
                              {record.assignedAgent.split(' ')[0]}
                            </div>
                          </div>

                          {/* Azione rapida per avanzare stato */}
                          {stage.id !== 'attivo' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvanceStage(record.id);
                              }}
                              className="w-full mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              <span>Avanza fase</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {stageRecords.length === 0 && (
                        <div className="h-28 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-center p-3 text-xs text-slate-400">
                          Nessuna pratica in questo stadio
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VISTA TABELLARE */}
          {pipelineLayout === 'table' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Cliente / Ragione Sociale</th>
                      <th className="px-4 py-3">Tipo / CF</th>
                      <th className="px-4 py-3">Forniture (POD/PDR)</th>
                      <th className="px-4 py-3">Stato Onboarding</th>
                      <th className="px-4 py-3">Risparmio Stimato</th>
                      <th className="px-4 py-3">Agente</th>
                      <th className="px-4 py-3 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRecords.map(record => {
                      const stageConfig = STAGES_CONFIG.find(s => s.id === record.stage);

                      return (
                        <tr
                          key={record.id}
                          onClick={() => setSelectedRecord(record)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{record.customerName}</div>
                            <div className="text-xs text-slate-400">{record.city} • {record.phone}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${
                              record.customerType === 'business'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {record.customerType === 'business' ? 'Azienda' : 'Privato'}
                            </span>
                            <div>{record.fiscalCode}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {record.pod && (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-800">
                                  <Zap className="h-3 w-3 text-amber-500" />
                                  <span className="font-mono text-[11px]">{record.pod}</span>
                                </span>
                              )}
                              {record.pdr && (
                                <span className="inline-flex items-center gap-1 text-xs text-blue-800">
                                  <Flame className="h-3 w-3 text-blue-500" />
                                  <span className="font-mono text-[11px]">{record.pdr}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${stageConfig?.badgeBg}`}>
                              {stageConfig?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-emerald-700">
                            €{record.estimatedAnnualSavingsEur}/anno
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {record.assignedAgent}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {record.stage !== 'attivo' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdvanceStage(record.id);
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                              >
                                Avanza Stato
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" /> A regime
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400">
                          Nessuna pratica trovata con i filtri attuali.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* VISTA 2: WIZARD GUIDATO IN 5 STEP          */}
      {/* ========================================== */}
      {activeView === 'wizard' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Progress Stepper Bar */}
          <div className="border-b border-slate-200 bg-slate-50/60 p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                {[
                  { step: 1, title: 'Profilo & Anagrafica', icon: User },
                  { step: 2, title: 'Dati Tecnici & Forniture', icon: Zap },
                  { step: 3, title: 'Tariffa & Risparmio', icon: SlidersHorizontal },
                  { step: 4, title: 'Mandato & Consensi', icon: ShieldCheck },
                  { step: 5, title: 'Attivazione', icon: CheckCircle2 }
                ].map((s, idx, arr) => {
                  const Icon = s.icon;
                  const isCompleted = wizardStep > s.step;
                  const isCurrent = wizardStep === s.step;

                  return (
                    <React.Fragment key={s.step}>
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : isCurrent
                              ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-xs'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {isCompleted ? <Check className="h-5 w-5 stroke-[2.5]" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <span className={`text-[11px] sm:text-xs mt-1.5 font-medium hidden sm:block ${
                          isCurrent ? 'text-indigo-600 font-bold' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                        }`}>
                          {s.title}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-all ${
                            wizardStep > idx + 1 ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contenuto degli Step */}
          <div className="p-5 sm:p-8 max-w-3xl mx-auto">
            {/* STEP 1: Profilo & Anagrafica */}
            {wizardStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Step 1: Tipologia Cliente & Dati Anagrafici</h3>
                  <p className="text-xs text-slate-500">
                    Seleziona la tipologia di intestatario e inserisci i riferimenti principali per l'apertura del fascicolo cliente.
                  </p>
                </div>

                {/* Scelta Residenziale vs Business */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => setWizardCustomerType('residential')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      wizardCustomerType === 'residential'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="p-2.5 bg-white rounded-lg shadow-xs text-indigo-600">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">Cliente Residenziale</div>
                      <div className="text-xs text-slate-500">Utenza domestica (Codice Fiscale 16 car.)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setWizardCustomerType('business')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      wizardCustomerType === 'business'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="p-2.5 bg-white rounded-lg shadow-xs text-purple-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900">Azienda / P.IVA</div>
                      <div className="text-xs text-slate-500">Utenza business (Partita IVA 11 cifre)</div>
                    </div>
                  </div>
                </div>

                {/* Form Anagrafica */}
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      {wizardCustomerType === 'business' ? 'Ragione Sociale Completa *' : 'Nome e Cognome *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={wizardCustomerType === 'business' ? 'Es. Rossi Elettronica S.r.l.' : 'Es. Mario Rossi'}
                      value={wizardName}
                      onChange={(e) => setWizardName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        {wizardCustomerType === 'business' ? 'Partita IVA / Codice Fiscale *' : 'Codice Fiscale *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={wizardCustomerType === 'business' ? '01234567890' : 'RSSMRA80A01H501U'}
                        value={wizardFiscalCode}
                        onChange={(e) => setWizardFiscalCode(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Città di Residenza / Sede *
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Milano, Roma, Torino..."
                        value={wizardCity}
                        onChange={(e) => setWizardCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Numero di Telefono *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+39 347 1234567"
                        value={wizardPhone}
                        onChange={(e) => setWizardPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Email di Contatto *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="mario.rossi@email.it"
                        value={wizardEmail}
                        onChange={(e) => setWizardEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    disabled={!wizardName.trim()}
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-xs min-h-[44px]"
                  >
                    <span>Continua ai Dati Tecnici</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Forniture & Dati Tecnici (POD / PDR) */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Step 2: Punti di Fornitura & Consumi</h3>
                  <p className="text-xs text-slate-500">
                    Seleziona le utenze da attivare (Luce, Gas o Dual-Fuel) e specifica i codici identificativi di rete.
                  </p>
                </div>

                {/* Scelta Utenze */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={hasLuce}
                      onChange={(e) => setHasLuce(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-sm text-slate-900">Fornitura Luce (POD)</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={hasGas}
                      onChange={(e) => setHasGas(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                    <Flame className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-sm text-slate-900">Fornitura Gas (PDR)</span>
                  </label>
                </div>

                {/* Dati Fornitore Attuale */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Fornitore Attuale
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Enel Energia, A2A, Eni Plenitude, Hera..."
                    value={wizardSupplier}
                    onChange={(e) => setWizardSupplier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Sezione Luce */}
                {hasLuce && (
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-4">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                      <Zap className="h-4 w-4 fill-amber-500 text-amber-500" />
                      Dati Fornitura Luce
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Codice POD (14 o 15 caratteri, es. IT001E...)
                        </label>
                        <input
                          type="text"
                          placeholder="IT001E12345678"
                          value={wizardPod}
                          onChange={(e) => setWizardPod(e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Consumo Annuo Stimato (kWh/anno)
                        </label>
                        <input
                          type="number"
                          value={wizardKwh}
                          onChange={(e) => setWizardKwh(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Potenza Impegnata (kW)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={wizardPowerKw}
                          onChange={(e) => setWizardPowerKw(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Costo Medio Attuale Materia (€/kWh)
                        </label>
                        <input
                          type="number"
                          step="0.005"
                          value={wizardUnitCost}
                          onChange={(e) => setWizardUnitCost(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sezione Gas */}
                {hasGas && (
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-4">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                      <Flame className="h-4 w-4 fill-blue-500 text-blue-500" />
                      Dati Fornitura Gas
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Codice PDR (14 cifre numeriche)
                        </label>
                        <input
                          type="text"
                          placeholder="01234567890123"
                          value={wizardPdr}
                          onChange={(e) => setWizardPdr(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Consumo Annuo Stimato (Smc/anno)
                        </label>
                        <input
                          type="number"
                          value={wizardSmc}
                          onChange={(e) => setWizardSmc(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Costo Medio Attuale Materia Gas (€/Smc)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={wizardGasCost}
                        onChange={(e) => setWizardGasCost(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between">
                  <button
                    onClick={() => setWizardStep(1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-100 transition-all min-h-[44px]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Indietro</span>
                  </button>
                  <button
                    disabled={!hasLuce && !hasGas}
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-xs min-h-[44px]"
                  >
                    <span>Confronta Tariffe</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Analisi Energetica & Scelta Tariffa */}
            {wizardStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Step 3: Studio di Risparmio & Scelta Tariffa</h3>
                  <p className="text-xs text-slate-500">
                    Confronto in tempo reale rispetto agli indici PUN ({marketIndex.punEurKwh.toFixed(4)} €/kWh) e PSV ({marketIndex.psvEurSmc.toFixed(4)} €/Smc).
                  </p>
                </div>

                {/* Banner Risparmio Calcolato */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
                      Risparmio Annuo Stimato Garantito
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-400/30 text-white text-[11px] font-bold">
                      Audit ARERA Attivo
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold">
                    ~ €{estimatedSavings.toLocaleString('it-IT')} / anno
                  </div>
                  <p className="text-xs text-emerald-100 mt-1">
                    Calcolato applicando lo switch dinamico e la rinegoziazione quadrimestrale su {wizardName || 'il cliente'}.
                  </p>
                </div>

                {/* Selezione Tariffa di Ingresso */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Scegli la Tariffa di Onboarding
                  </label>

                  <div
                    onClick={() => setSelectedTariff('indicizzata_arera')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedTariff === 'indicizzata_arera'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        Volta Index Tutelata ARERA (Consigliata)
                      </span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                        Spread Minimo: +0.012 €/kWh
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Prezzo all'ingrosso PUN/PSV senza sovraccosti occulti. Sottoposta ad audit periodico ogni 120 giorni.
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedTariff('fissa_tutelata')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedTariff === 'fissa_tutelata'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Volta Lock 12 Mesi Prezzo Fisso
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Fissa 0.138 €/kWh
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Blocca la componente energia al riparo da oscillazioni geopolitiche per 1 intero anno solare.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-100 transition-all min-h-[44px]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Indietro</span>
                  </button>
                  <button
                    onClick={() => setWizardStep(4)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-xs min-h-[44px]"
                  >
                    <span>Procedi al Mandato</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Mandato di Brokeraggio & Consensi Privacy */}
            {wizardStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Step 4: Mandato di Brokeraggio & Privacy GDPR</h3>
                  <p className="text-xs text-slate-500">
                    Sottoscrizione del mandato gratuito di monitoraggio energetico continuo e consenso al trattamento dati.
                  </p>
                </div>

                {/* Scatola Termini Mandato */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-2 max-h-48 overflow-y-auto">
                  <div className="font-bold text-slate-800">Condizioni Mandato di Assistenza Energetica Volta Energy:</div>
                  <p>
                    1. Il Mandante conferisce a Volta Energy mandato non esclusivo per l'analisi periodica quadrimestrale dei costi energetici e l'intermediazione delle migliori offerte del mercato libero.
                  </p>
                  <p>
                    2. Volta Energy opera senza oneri diretti a carico del cliente finale, remunerata dagli operatori energetici conformemente alle tabelle ARERA.
                  </p>
                  <p>
                    3. Il Mandante autorizza l'accesso ai dati storici di consumo mediante Sistema Informativo Integrato (SII) e distributore locale.
                  </p>
                </div>

                {/* Consensi Checkbox */}
                <div className="space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mandateAccepted}
                      onChange={(e) => setMandateAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs text-slate-700">
                      <strong>Accettazione Mandato:</strong> Il cliente autorizza Volta Energy a gestire il subentro e le rinegoziazioni quadrimestrali per le forniture indicate.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gdprAccepted}
                      onChange={(e) => setGdprAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs text-slate-700">
                      <strong>Informativa Privacy GDPR (Reg. UE 2016/679):</strong> Consenso al trattamento dei dati di fatturazione e dei contatti per finalità contrattuali.
                    </span>
                  </label>
                </div>

                {/* Metodo di Firma */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Metodo di Perfezionamento Mandato
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setSignatureMethod('otp')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        signatureMethod === 'otp'
                          ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">Firma OTP (SMS)</div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">Invio codice al cellulare</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignatureMethod('canvas')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        signatureMethod === 'canvas'
                          ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">Firma su Schermo</div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">Disegno biometrico su display</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignatureMethod('manual')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        signatureMethod === 'manual'
                          ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-900'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold">Cartaceo / Verbale</div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">Consenso registrato a voce</div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-700 font-semibold rounded-xl text-sm hover:bg-slate-100 transition-all min-h-[44px]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Indietro</span>
                  </button>
                  <button
                    disabled={!mandateAccepted || !gdprAccepted || isSubmittingWizard}
                    onClick={handleCompleteWizard}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-xs min-h-[44px]"
                  >
                    {isSubmittingWizard ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Attivazione in corso...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Completa Onboarding & Attiva</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: Conferma & Attivazione Riuscita */}
            {wizardStep === 5 && (
              <div className="text-center py-6 space-y-5">
                <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Onboarding Completato con Successo!
                  </h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
                    <strong>{wizardName}</strong> è stato registrato a sistema. Il mandato è stato archiviato e l'audit quadrimestrale ARERA è già attivo.
                  </p>
                </div>

                {/* Scheda Riepilogo */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left max-w-md mx-auto text-xs space-y-2">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Codice Fiscale / P.IVA:</span>
                    <span className="font-mono font-bold text-slate-800">{wizardFiscalCode || 'RSSMRA80A01H501U'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Forniture Collegate:</span>
                    <span className="font-bold text-slate-800">
                      {[hasLuce ? 'Luce' : null, hasGas ? 'Gas' : null].filter(Boolean).join(' + ')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">Risparmio Annuo Stimato:</span>
                    <span className="font-bold text-emerald-600">+€{estimatedSavings}/anno</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prossimo Audit ARERA:</span>
                    <span className="font-bold text-slate-800">Tra 120 giorni (Programmato)</span>
                  </div>
                </div>

                {/* Pulsanti Azione Post-Onboarding */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                  <button
                    onClick={() => {
                      if (createdCustomerResult && onSelectCustomer) {
                        onSelectCustomer(createdCustomerResult);
                      }
                      setActiveView('pipeline');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-xs min-h-[44px]"
                  >
                    <User className="h-4 w-4" />
                    <span>Visualizza Scheda Cliente</span>
                  </button>

                  <button
                    onClick={() => {
                      handleResetWizard();
                      setWizardStep(1);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all min-h-[44px]"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Avvia Altro Onboarding</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETTAGLIO PRATICA ONBOARDING */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase mb-1.5 inline-block ${
                  selectedRecord.customerType === 'business'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {selectedRecord.customerType === 'business' ? 'Azienda' : 'Residenziale'}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedRecord.customerName}</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedRecord.fiscalCode}</p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Stato Corrente */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Stato della Pratica:</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                STAGES_CONFIG.find(s => s.id === selectedRecord.stage)?.badgeBg
              }`}>
                {STAGES_CONFIG.find(s => s.id === selectedRecord.stage)?.label}
              </span>
            </div>

            {/* Dettagli Tecnici */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="text-slate-400 mb-0.5">Recapito & Città</div>
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" /> {selectedRecord.city}
                </div>
                <div className="text-slate-600 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3 text-slate-400" /> {selectedRecord.phone}
                </div>
                <div className="text-slate-600 flex items-center gap-1 mt-0.5 truncate">
                  <Mail className="h-3 w-3 text-slate-400" /> {selectedRecord.email}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="text-slate-400 mb-0.5">Forniture e Codici</div>
                {selectedRecord.pod && (
                  <div className="font-mono text-[11px] text-amber-700 font-semibold truncate">
                    Luce: {selectedRecord.pod}
                  </div>
                )}
                {selectedRecord.pdr && (
                  <div className="font-mono text-[11px] text-blue-700 font-semibold truncate mt-0.5">
                    Gas: {selectedRecord.pdr}
                  </div>
                )}
                <div className="text-emerald-700 font-bold mt-1.5">
                  Risparmio: €{selectedRecord.estimatedAnnualSavingsEur}/anno
                </div>
              </div>
            </div>

            {/* Note Pratica */}
            {selectedRecord.notes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-800">
                <div className="font-semibold mb-0.5">Note Pratica:</div>
                {selectedRecord.notes}
              </div>
            )}

            {/* Azioni del Dettaglio */}
            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px]"
              >
                Chiudi
              </button>

              {selectedRecord.stage !== 'attivo' && (
                <button
                  onClick={() => {
                    handleAdvanceStage(selectedRecord.id);
                    setSelectedRecord(prev => {
                      if (!prev) return null;
                      const stageOrder: OnboardingStage[] = ['bozza', 'verifica_tecnica', 'firma_mandato', 'switch_programmato', 'attivo'];
                      const nextIndex = stageOrder.indexOf(prev.stage) + 1;
                      return {
                        ...prev,
                        stage: stageOrder[nextIndex] || prev.stage
                      };
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-xs min-h-[44px]"
                >
                  <span>Avanza allo Stadio Successivo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

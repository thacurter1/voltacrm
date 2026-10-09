import React, { useState, useMemo, useEffect } from 'react';
import { EnergyPortalHeader } from '../components/customer/EnergyPortalHeader';
import { EnergyBillIntake } from '../components/customer/EnergyBillIntake';
import { EnergyOfferCard } from '../components/customer/EnergyOfferCard';
import { EnergyOfferDetails } from '../components/customer/EnergyOfferDetails';
import { SubitoMySupplies } from '../components/customer/SubitoMySupplies';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ToastContainer } from '../components/ToastContainer';
import { api } from '../api/client';
import { portalApi } from '../api/portal';
import { MARKET_OFFERS, CURRENT_MARKET_INDEX } from '../services/energyEngine';
import { 
  ComparisonInput, 
  ComparisonResult, 
  compareOffer 
} from '../services/offerComparison';
import { 
  AuthUser, 
  Customer, 
  CustomerBill, 
  MarketIndex, 
  SupplierOffer, 
  ToastNotification 
} from '../types';
import { 
  Zap, 
  Flame, 
  ShieldCheck, 
  Filter, 
  Sliders, 
  ArrowRight
} from 'lucide-react';

export interface CustomerAppProps {
  currentUser?: AuthUser;
  customer?: Customer | null;
  bills?: CustomerBill[];
  isLoading?: boolean;
  loadError?: string | null;
  onReloadBills?: () => void | Promise<void>;
  onReturnToBackend?: () => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({
  currentUser: _currentUser,
  customer = null,
  bills = [],
  isLoading = false,
  loadError = null,
  onReloadBills,
  onReturnToBackend,
}) => {
  const activeCustomer = customer;
  const myBills = bills;

  // View state: 'offers' | 'supplies'
  const [activeView, setActiveView] = useState<'offers' | 'supplies'>('offers');

  // Stepper state: 'intake' (Step 1) | 'comparison' (Step 2)
  const defaultPoint = activeCustomer?.utilityPoints?.[0];
  const [currentStep, setCurrentStep] = useState<'intake' | 'comparison'>(() => {
    return defaultPoint && defaultPoint.annualConsumption && defaultPoint.annualConsumption > 0 ? 'comparison' : 'intake';
  });

  // Intake / Comparison Input (honestly initialized without fake 2700/1000 default)
  const [comparisonInput, setComparisonInput] = useState<ComparisonInput>(() => ({
    utilityType: defaultPoint?.type || 'luce',
    annualConsumption: defaultPoint?.annualConsumption || 0,
    powerKw: defaultPoint?.powerKw || 3,
    f1Kwh: defaultPoint?.f1Kwh,
    f2Kwh: defaultPoint?.f2Kwh,
    f3Kwh: defaultPoint?.f3Kwh,
    currentSupplier: defaultPoint?.currentSupplier,
    currentPricingType: defaultPoint?.currentTariffType === 'fixed' ? 'fixed' : 'indexed',
    currentUnitCost: defaultPoint?.currentUnitCost,
    currentFixedFeeYear: defaultPoint?.currentFixedFeeYear,
    source: defaultPoint?.annualConsumption ? 'account' : 'manual',
    asOf: 'Benchmark Q1 2026',
  }));

  // Sync if customer props arrive later
  useEffect(() => {
    if (activeCustomer?.utilityPoints && activeCustomer.utilityPoints.length > 0) {
      setComparisonInput((prev) => {
        if (prev.source === 'manual' || prev.source === 'bill-reviewed') return prev;
        const points = activeCustomer.utilityPoints || [];
        const match = points.find((p) => p.type === prev.utilityType) || points[0];
        return {
          ...prev,
          utilityType: match.type,
          annualConsumption: match.annualConsumption || prev.annualConsumption,
          powerKw: match.powerKw || 3,
          f1Kwh: match.f1Kwh,
          f2Kwh: match.f2Kwh,
          f3Kwh: match.f3Kwh,
          currentSupplier: match.currentSupplier,
          currentPricingType: match.currentTariffType === 'fixed' ? 'fixed' : 'indexed',
          currentUnitCost: match.currentUnitCost,
          currentFixedFeeYear: match.currentFixedFeeYear,
          source: match.annualConsumption ? 'account' : prev.source,
        };
      });
    }
  }, [activeCustomer]);

  // Catalog offers & Market indices
  const [offers, setOffers] = useState<SupplierOffer[]>(MARKET_OFFERS);
  const [marketIndex, setMarketIndex] = useState<MarketIndex>(CURRENT_MARKET_INDEX);
  const [pricingFilter, setPricingFilter] = useState<'all' | 'fixed' | 'indexed'>('all');
  const [sortBy, setSortBy] = useState<'cost_asc' | 'savings_desc'>('cost_asc');

  // Details Modal
  const [activeComparisonForDetails, setActiveComparisonForDetails] = useState<ComparisonResult | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const newToast: ToastNotification = {
      id: Date.now().toString(),
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setToasts((prev) => [...prev, newToast]);
  };

  // Load catalog and market indices from backend
  useEffect(() => {
    let isMounted = true;
    api.switch.getOffers()
      .then((loaded) => {
        if (isMounted && loaded && loaded.length > 0) setOffers(loaded);
      })
      .catch((err) => console.warn('[CustomerApp] Uso catalogo locale:', err));

    api.switch.getMarketIndices()
      .then((liveIdx) => {
        if (isMounted && liveIdx) setMarketIndex(liveIdx);
      })
      .catch((err) => console.warn('[CustomerApp] Uso indici di mercato locali:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute honest comparisons
  const comparisons: ComparisonResult[] = useMemo(() => {
    return offers
      .filter((offer) => offer.energyType === comparisonInput.utilityType)
      .filter((offer) => {
        if (pricingFilter === 'all') return true;
        if (pricingFilter === 'fixed') return offer.pricingType === 'fixed';
        if (pricingFilter === 'indexed') return offer.pricingType.startsWith('indexed');
        return true;
      })
      .map((offer) => compareOffer(comparisonInput, offer, marketIndex))
      .sort((a, b) => {
        if (sortBy === 'cost_asc') {
          return (a.annualCost || Infinity) - (b.annualCost || Infinity);
        }
        if (sortBy === 'savings_desc') {
          return (b.savingsEur || -Infinity) - (a.savingsEur || -Infinity);
        }
        return 0;
      });
  }, [offers, comparisonInput, marketIndex, pricingFilter, sortBy]);

  // Handle bill uploaded
  const handleBillUploaded = (uploadedBill: CustomerBill) => {
    if (onReloadBills) {
      onReloadBills();
    }
    setComparisonInput((prev) => ({
      ...prev,
      utilityType: uploadedBill.utilityType,
      source: 'bill-reviewed',
    }));
    setCurrentStep('comparison');
    addToast(
      'Bolletta Caricata con Successo',
      `Fattura ${uploadedBill.fileName} registrata nel tuo archivio. Parametri aggiornati per il confronto ${uploadedBill.utilityType.toUpperCase()}.`,
      'success'
    );
  };

  // Handle manual input update from intake
  const handleManualInputApplied = (input: ComparisonInput) => {
    setComparisonInput(input);
    setCurrentStep('comparison');
    addToast(
      'Parametri Aggiornati',
      `Stime ricalcolate per fornitura ${input.utilityType.toUpperCase()} con consumo ${input.annualConsumption} ${input.utilityType === 'luce' ? 'kWh' : 'Smc'}.`,
      'info'
    );
  };

  // Handle consultation request with real persistence
  const handleRequestConsultation = async (offer: SupplierOffer, notes?: string) => {
    if (!activeCustomer) return;
    try {
      const result = await portalApi.requestConsultation({
        customerId: activeCustomer.id,
        offerId: offer.id,
        offerName: offer.name,
        supplier: offer.supplier,
        utilityType: comparisonInput.utilityType,
        annualConsumption: comparisonInput.annualConsumption > 0 ? comparisonInput.annualConsumption : undefined,
        notes: notes || 'Richiesta di consulenza e assistenza dal portale clienti',
        preferredContact: 'phone',
      });
      addToast(
        'Richiesta Assistenza Registrata',
        `Pratica #${result.leadId.slice(-8).toUpperCase()} registrata con successo nel CRM. Il tuo consulente Volta ti ricontatterà al ${activeCustomer.phone || 'tuo recapito'}.`,
        'success'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la registrazione della richiesta.';
      addToast('Errore Registrazione', msg, 'warning');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f6f9fc] flex flex-col justify-center items-center p-6 text-slate-600 font-sans">
        <div className="w-10 h-10 border-4 border-[#635bff] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-[#0a2540]">Caricamento della tua fornitura...</h2>
        <p className="text-xs text-slate-400 mt-1">Stiamo recuperando i dettagli del tuo account e delle tue bollette.</p>
      </div>
    );
  }

  // Null customer recovery view
  if (!activeCustomer) {
    return (
      <div className="min-h-screen bg-[#f6f9fc] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-black text-[#0a2540]">Non riusciamo a trovare la tua fornitura</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {loadError || 'Non è stata trovata alcuna fornitura energetica associata al tuo profilo. Verifica le tue credenziali o contatta l\'assistenza clienti Volta Energia.'}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            {onReturnToBackend && (
              <button
                type="button"
                onClick={onReturnToBackend}
                className="w-full min-h-[44px] px-4 bg-[#0a2540] hover:bg-[#1a385c] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                Torna al Backend CRM
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="w-full min-h-[44px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center"
            >
              Riprova caricamento
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f9fc] text-slate-900 flex flex-col font-sans">
      <InstallAppBanner />

      {/* Modern Volta Energy Portal Header */}
      <EnergyPortalHeader
        activeView={activeView}
        onSelectView={setActiveView}
        customerName={activeCustomer.name || 'Cliente'}
        onToast={addToast}
        onReturnToBackend={onReturnToBackend}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32 sm:pb-24 space-y-6">
        {activeView === 'offers' ? (
          <div className="space-y-6">
            {/* Guided Journey Stepper (Facile.it inspired, Volta branded) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Steps indicator */}
                <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 md:pb-0" role="navigation" aria-label="Percorso guidato tariffe">
                  <button
                    type="button"
                    onClick={() => setCurrentStep('intake')}
                    className={`flex items-center gap-2 shrink-0 p-1 rounded-lg transition cursor-pointer text-left ${
                      currentStep === 'intake' ? 'text-[#635bff]' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 ${
                      currentStep === 'intake' ? 'bg-[#635bff] ring-2 ring-[#635bff]/30' : 'bg-emerald-600'
                    }`}>
                      {currentStep === 'comparison' ? '✓' : '1'}
                    </span>
                    <span className="text-xs font-bold">
                      1. Fornitura & Consumi
                    </span>
                  </button>

                  <span className="text-slate-300">→</span>

                  <button
                    type="button"
                    onClick={() => {
                      if (comparisonInput.annualConsumption > 0) {
                        setCurrentStep('comparison');
                      } else {
                        addToast('Consumo Richiesto', 'Seleziona o inserisci prima i consumi della tua fornitura per procedere al confronto.', 'info');
                      }
                    }}
                    className={`flex items-center gap-2 shrink-0 p-1 rounded-lg transition cursor-pointer text-left ${
                      currentStep === 'comparison' ? 'text-[#635bff]' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 ${
                      currentStep === 'comparison' ? 'bg-[#635bff] ring-2 ring-[#635bff]/30' : 'bg-slate-300'
                    }`}>
                      2
                    </span>
                    <span className="text-xs font-bold">
                      2. Confronto Offerte {comparisonInput.annualConsumption > 0 ? `(${comparisons.length})` : ''}
                    </span>
                  </button>

                  <span className="text-slate-300">→</span>

                  <div className="flex items-center gap-2 shrink-0 p-1 text-slate-400">
                    <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span className="text-xs font-semibold">
                      3. Consulenza & Attivazione
                    </span>
                  </div>
                </div>

                {/* Dual Fuel Disablement Explanation */}
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
                  <span className="text-slate-400">Opzione Luce + Gas:</span>
                  <span className="font-semibold text-slate-700">
                    Gestita con consulenza dedicata
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 1: Intake & Data Entry (Caricamento bolletta o inserimento reale) */}
            {currentStep === 'intake' ? (
              <div className="space-y-6">
                {/* Profile quick-select banner if customer has saved utility points */}
                {activeCustomer?.utilityPoints && activeCustomer.utilityPoints.length > 0 && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-[#635bff]/20 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#635bff] bg-white px-2 py-0.5 rounded border border-[#635bff]/20">
                          Dati Profilo Volta Rilevati
                        </span>
                        <span className="text-xs text-slate-600 font-medium">
                          {activeCustomer.utilityPoints[0].type === 'luce' ? 'Fornitura Luce' : 'Fornitura Gas'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">
                        Punto POD/PDR: <strong className="font-bold text-[#0a2540]">{activeCustomer.utilityPoints[0].podOrPdr}</strong>
                        {activeCustomer.utilityPoints[0].annualConsumption ? ` • Consumo registrato: ${activeCustomer.utilityPoints[0].annualConsumption} ${activeCustomer.utilityPoints[0].type === 'luce' ? 'kWh' : 'Smc'}/anno` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const pt = activeCustomer.utilityPoints![0];
                        setComparisonInput({
                          utilityType: pt.type,
                          annualConsumption: pt.annualConsumption || (pt.type === 'gas' ? 1000 : 2700),
                          powerKw: pt.powerKw || 3,
                          f1Kwh: pt.f1Kwh,
                          f2Kwh: pt.f2Kwh,
                          f3Kwh: pt.f3Kwh,
                          currentSupplier: pt.currentSupplier,
                          currentPricingType: pt.currentTariffType === 'fixed' ? 'fixed' : 'indexed',
                          currentUnitCost: pt.currentUnitCost,
                          currentFixedFeeYear: pt.currentFixedFeeYear,
                          source: 'account',
                          asOf: 'Benchmark Q1 2026',
                        });
                        setCurrentStep('comparison');
                        addToast('Dati Profilo Caricati', `Utilizzati i parametri contrattuali registrati per ${pt.type.toUpperCase()}.`, 'info');
                      }}
                      className="min-h-[44px] px-5 py-2.5 bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-xs"
                    >
                      <span>Usa fornitura salvata</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* EnergyBillIntake Form as the primary intake screen */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#635bff] bg-[#635bff]/10 border border-[#635bff]/25 px-2 py-0.5 rounded">
                      Fase 1 di 3 • Inserimento Fornitura
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-[#0a2540]">
                      Carica la bolletta o specifica i tuoi consumi reali
                    </h2>
                    <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                      Come nel percorso di comparazione Facile.it, puoi caricare la tua ultima fattura energetica (PDF, JPEG, PNG fino a 10MB) per far analizzare i dati o inserire manualmente il consumo annuo. I risultati del confronto saranno generati esclusivamente sulla base dei parametri che confermi.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <EnergyBillIntake
                      customer={activeCustomer}
                      selectedUtilityType={comparisonInput.utilityType}
                      onUploaded={handleBillUploaded}
                      onManualInput={handleManualInputApplied}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* STEP 2: Offers Comparison View */
              <div className="space-y-6">
                {/* Editable Summary Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#635bff] bg-[#635bff]/10 border border-[#635bff]/25 px-2 py-0.5 rounded">
                          Parametri di Calcolo in Uso
                        </span>
                        <span className="text-xs text-slate-500">
                          (Origine: {comparisonInput.source === 'account' ? 'Dati Profilo' : comparisonInput.source === 'bill-reviewed' ? 'Bolletta Caricata' : 'Inserimento Manuale'})
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-[#0a2540]">
                        Riepilogo consumi per il confronto offerte
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep('intake')}
                      className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Sliders className="w-4 h-4 text-[#635bff]" />
                      <span>Modifica dati o carica altra bolletta</span>
                    </button>
                  </div>

                  {/* Current parameter pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[11px] text-slate-500 block font-semibold">Tipologia Fornitura</span>
                      <span className="font-bold text-slate-900 capitalize flex items-center gap-1 mt-0.5">
                        {comparisonInput.utilityType === 'luce' ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : <Flame className="w-3.5 h-3.5 text-blue-500" />}
                        Solo {comparisonInput.utilityType}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block font-semibold">Consumo Annuo Riferimento</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">
                        {comparisonInput.annualConsumption > 0 ? `${comparisonInput.annualConsumption} ${comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'}` : 'Non specificato'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block font-semibold">Costo Materia Prima Attuale</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">
                        {comparisonInput.currentUnitCost !== undefined
                          ? `${comparisonInput.currentUnitCost.toFixed(4)} €/${comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'}`
                          : 'Non specificato'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block font-semibold">Quota Fissa Commercializzazione</span>
                      <span className="font-bold text-slate-900 mt-0.5 block">
                        {comparisonInput.currentFixedFeeYear !== undefined
                          ? `${comparisonInput.currentFixedFeeYear} €/anno`
                          : 'Non specificata'}
                      </span>
                    </div>
                  </div>

                  {/* Honest Benchmark Disclosure Banner */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Catalogo Dimostrativo • Benchmark Indicativo Q1 2026:</span>{' '}
                      Le tariffe e i risparmi indicati rappresentano stime a scopo comparativo calcolate sui parametri PUN/PSV di riferimento. Nessuna attivazione automatica: le schede di confrontabilità ufficiali e i contratti definitivi vengono illustrati da un consulente Volta dedicato prima di qualsiasi firma.
                    </div>
                  </div>
                </div>

                {/* Filter and Sorting Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" />
                      <span>Tipo Tariffa:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPricingFilter('all')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        pricingFilter === 'all'
                          ? 'bg-[#0a2540] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Tutte
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingFilter('fixed')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        pricingFilter === 'fixed'
                          ? 'bg-[#0a2540] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Prezzo Fisso
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingFilter('indexed')}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        pricingFilter === 'indexed'
                          ? 'bg-[#0a2540] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Indicizzato (PUN/PSV)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs font-semibold text-slate-600">Ordina:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="min-h-[44px] bg-slate-50 border border-slate-200 text-xs text-slate-800 font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#635bff] cursor-pointer"
                    >
                      <option value="cost_asc">Costo annuo stimato (più conveniente)</option>
                      <option value="savings_desc">Risparmio stimato (maggiore)</option>
                    </select>
                  </div>
                </div>

                {/* Offer Listing Cards */}
                <div className="space-y-3">
                  {comparisons.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3 shadow-xs">
                      <Filter className="w-8 h-8 mx-auto text-slate-300" />
                      <h3 className="text-base font-bold text-slate-800">
                        Nessuna offerta trovata con i filtri correnti
                      </h3>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Prova a selezionare "Tutte" per visualizzare tutte le tariffe {comparisonInput.utilityType} disponibili.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPricingFilter('all')}
                        className="min-h-[44px] px-5 py-2.5 bg-[#635bff] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#5851ea] transition cursor-pointer"
                      >
                        Mostra tutte le offerte {comparisonInput.utilityType}
                      </button>
                    </div>
                  ) : (
                    comparisons.map((comp) => (
                      <EnergyOfferCard
                        key={comp.offer.id}
                        comparison={comp}
                        onViewDetails={(c) => setActiveComparisonForDetails(c)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* "Le mie forniture e bollette" View */
          <SubitoMySupplies
            customer={activeCustomer}
            bills={myBills.filter((b) => b.customerId === activeCustomer.id)}
            onUploadBill={() => {
              setActiveView('offers');
              setCurrentStep('intake');
            }}
            onOpenBillDetails={(bill) => {
              const savingsText = bill.extractedSavingsEur
                ? ` • Risparmio stimato da verifica: €${Math.round(bill.extractedSavingsEur)}/anno`
                : '';
              addToast(
                'Dettaglio Bolletta',
                `${bill.fileName} (${bill.utilityType.toUpperCase()}) caricata il ${bill.uploadDate}${savingsText}. Stato: ${bill.status === 'analyzed' ? 'Analizzata' : 'In verifica'}.`,
                'info'
              );
            }}
          />
        )}
      </main>

      {/* Offer Details Modal */}
      {activeComparisonForDetails && (
        <EnergyOfferDetails
          comparison={activeComparisonForDetails}
          currentInput={comparisonInput}
          onClose={() => setActiveComparisonForDetails(null)}
          onRequestConsultation={handleRequestConsultation}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0a2540]">Volta Energia</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">
              Trasparenza Tariffe
            </span>
            <span>• Confronto tariffe luce e gas per clienti finali</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Tariffe e stime a scopo comparativo basate su benchmark indicativi PUN/PSV (Q1 2026). Condizioni definitive verificate prima della sottoscrizione.</span>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
};

export default CustomerApp;

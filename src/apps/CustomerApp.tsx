import React, { useState, useMemo, useEffect } from 'react';
import { EnergyPortalHeader } from '../components/customer/EnergyPortalHeader';
import { EnergyBillIntake } from '../components/customer/EnergyBillIntake';
import { EnergyOfferCard } from '../components/customer/EnergyOfferCard';
import { EnergyOfferDetails } from '../components/customer/EnergyOfferDetails';
import { SubitoMySupplies } from '../components/customer/SubitoMySupplies';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ToastContainer } from '../components/ToastContainer';
import { LegalFooter } from '../components/common/LegalFooter';
import { LegalModal, type LegalTab } from '../components/common/LegalModal';
import { CookieBanner } from '../components/common/CookieBanner';
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
  Leaf
} from 'lucide-react';

export interface CustomerAppProps {
  currentUser?: AuthUser;
  customer?: Customer | null;
  bills?: CustomerBill[];
  isLoading?: boolean;
  loadError?: string | null;
  onReloadBills?: () => void | Promise<void>;
  onReturnToBackend?: () => void;
  onLogout?: () => void;
  isPublicVisitor?: boolean;
  isGuest?: boolean;
  onOpenStaffLogin?: () => void;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({
  currentUser: _currentUser,
  customer = null,
  bills = [],
  isLoading = false,
  loadError = null,
  onReloadBills,
  onReturnToBackend,
  onLogout,
  isPublicVisitor = false,
  isGuest = false,
  onOpenStaffLogin,
}) => {
  const activeCustomer = customer;
  const myBills = bills;

  // Marketing UTM Campaign Attribution Parsing
  const utmParams = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source') || undefined;
    const utmCampaign = params.get('utm_campaign') || undefined;
    const utmMedium = params.get('utm_medium') || undefined;
    if (!utmSource && !utmCampaign && !utmMedium) return undefined;
    return { utmSource, utmCampaign, utmMedium };
  }, []);

  // View state: 'offers' | 'supplies'
  const [activeView, setActiveView] = useState<'offers' | 'supplies'>('offers');

  // Stepper state: 'intake' (Step 1) | 'comparison' (Step 2)
  const defaultPoint = activeCustomer?.utilityPoints?.[0];
  const [currentStep, setCurrentStep] = useState<'intake' | 'comparison'>('intake');

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView, currentStep]);

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
    asOf: undefined,
  }));

  // Sync if customer props arrive later
  useEffect(() => {
    if (activeCustomer?.utilityPoints && activeCustomer.utilityPoints.length > 0) {
      queueMicrotask(() => {
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
      });
    }
  }, [activeCustomer]);

  // Catalog offers & Market indices
  const [offers, setOffers] = useState<SupplierOffer[]>(MARKET_OFFERS);
  // The backend currently serves the same static sample catalog as the local fallback.
  const isDemoCatalog = true;
  const [marketIndex, setMarketIndex] = useState<MarketIndex>(CURRENT_MARKET_INDEX);
  const [pricingFilter, setPricingFilter] = useState<'all' | 'fixed' | 'indexed'>('all');
  const [onlyGreen, setOnlyGreen] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'cost_asc' | 'savings_desc'>('cost_asc');

  // Details Modal
  const [activeComparisonForDetails, setActiveComparisonForDetails] = useState<ComparisonResult | null>(null);
  const [selectedBill, setSelectedBill] = useState<CustomerBill | null>(null);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab | null>(null);

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
        if (isMounted && loaded && loaded.length > 0) {
          setOffers(loaded);
        }
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
      .filter((offer) => !onlyGreen || offer.greenCertified)
      .filter((offer) => {
        if (pricingFilter === 'all') return true;
        if (pricingFilter === 'fixed') return offer.pricingType === 'fixed';
        if (pricingFilter === 'indexed') return offer.pricingType.startsWith('indexed');
        return true;
      })
      .map((offer) => compareOffer(comparisonInput, offer, marketIndex))
      .sort((a, b) => {
        if (sortBy === 'cost_asc') {
          return (a.annualCost ?? Infinity) - (b.annualCost ?? Infinity);
        }
        if (sortBy === 'savings_desc') {
          return (b.savingsEur ?? -Infinity) - (a.savingsEur ?? -Infinity);
        }
        return 0;
      });
  }, [offers, comparisonInput, marketIndex, pricingFilter, sortBy, onlyGreen]);

  // Handle bill uploaded
  const handleBillUploaded = (uploadedBill: CustomerBill) => {
    if (onReloadBills) {
      onReloadBills();
    }
    // Upload and analysis are separate operations. Never use parameters from a
    // different utility as if they had been extracted from this bill.
    setComparisonInput((prev) => prev.utilityType === uploadedBill.utilityType ? prev : {
      utilityType: uploadedBill.utilityType,
      annualConsumption: 0,
      powerKw: uploadedBill.utilityType === 'luce' ? 3 : undefined,
      source: 'manual',
    });
    setCurrentStep('intake');
    addToast(
      'Bolletta Caricata con Successo',
      `Fattura ${uploadedBill.fileName} salvata. È in verifica: per confrontare subito le offerte, seleziona una fornitura già registrata o inserisci i consumi.`,
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
  const handleRequestConsultation = async (offer: SupplierOffer, notes?: string): Promise<boolean> => {
    if (!activeCustomer) return false;
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
        utmSource: utmParams?.utmSource,
        utmCampaign: utmParams?.utmCampaign,
        utmMedium: utmParams?.utmMedium,
      });
      addToast(
        'Richiesta Assistenza Registrata',
        `Pratica #${result.leadId.slice(-8).toUpperCase()} registrata con successo nel CRM. Il tuo consulente Volta ti ricontatterà al ${activeCustomer.phone || 'tuo recapito'}.`,
        'success'
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la registrazione della richiesta.';
      addToast('Errore Registrazione', msg, 'warning');
      return false;
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

  // Null customer recovery view (for authenticated sessions with missing customer record)
  if (!activeCustomer && !isPublicVisitor && !isGuest) {
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
            {onLogout && <button type="button" onClick={onLogout} className="min-h-[44px] rounded-xl border border-slate-200 text-sm font-bold cursor-pointer">Esci</button>}
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
      {/* Modern Volta Energy Portal Header */}
      <EnergyPortalHeader
        activeView={activeView}
        onSelectView={setActiveView}
        customerName={activeCustomer?.name || 'Visitatore'}
        onToast={addToast}
        onReturnToBackend={onReturnToBackend}
        onLogout={onLogout}
        isPublicVisitor={isPublicVisitor || isGuest || !activeCustomer}
        onOpenStaffLogin={onOpenStaffLogin}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-32 sm:pb-24 space-y-6">
        {activeView === 'offers' ? (
          <div className="space-y-6">
            {/* Guided Journey Stepper (Facile.it inspired, Volta branded) */}
            <div className="border-b border-slate-200 pb-4">
              <div className="sm:hidden mb-4" aria-live="polite">
                <p className="text-sm font-semibold text-[#0a2540]">Passaggio {currentStep === 'intake' ? '1' : '2'} di 2</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true"><div className={`h-full rounded-full bg-[#635bff] transition-all ${currentStep === 'intake' ? 'w-1/2' : 'w-full'}`} /></div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Steps indicator */}
                <div className="hidden sm:flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 md:pb-0" role="navigation" aria-label="Percorso guidato tariffe">
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

                </div>

                {/* Dual Fuel Disablement Explanation */}
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg shrink-0">
                  <span className="text-slate-400">Opzione Luce + Gas:</span>
                  <span className="font-semibold text-slate-700">
                    Gestita con consulenza dedicata
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 1: Intake & Data Entry (Caricamento bolletta o inserimento reale) */}
            {currentStep === 'intake' ? (
              <section className="space-y-7" aria-labelledby="intake-title">
                <div className="max-w-3xl space-y-3 pt-1">
                  <p className="text-sm font-bold text-[#635bff]">Confronto luce e gas</p>
                  <h1 id="intake-title" className="text-[2rem] sm:text-[2.75rem] font-extrabold tracking-tight leading-[1.12] text-[#0a2540]">
                    Trova l'offerta giusta per i tuoi consumi.
                  </h1>
                  <p className="text-base leading-relaxed text-slate-600 max-w-2xl">
                    Usa la tua fornitura, carica una bolletta oppure inserisci i consumi. Vedrai come viene calcolata ogni stima.
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_250px] gap-6 lg:gap-8 items-start">
                  <EnergyBillIntake
                    customer={activeCustomer}
                    selectedUtilityType={comparisonInput.utilityType}
                    onUploaded={handleBillUploaded}
                    onManualInput={handleManualInputApplied}
                    onOpenPrivacy={() => setLegalModalTab('privacy')}
                    utmParams={utmParams}
                  />
                  <aside className="lg:sticky lg:top-24 border-t-2 border-[#635bff] pt-5 text-sm text-slate-600" aria-label="Come funziona il confronto">
                    <h2 className="text-lg font-bold text-[#0a2540]">Come funziona</h2>
                    <ol className="mt-5 space-y-5">
                      <li className="flex gap-3"><span className="font-bold text-[#635bff]">01</span><span>Partiamo dai consumi della tua fornitura.</span></li>
                      <li className="flex gap-3"><span className="font-bold text-[#635bff]">02</span><span>Confronti i costi annui stimati e le condizioni.</span></li>
                      <li className="flex gap-3"><span className="font-bold text-[#635bff]">03</span><span>Se ti interessa un'offerta, chiedi una consulenza.</span></li>
                    </ol>
                    <p className="mt-6 pt-5 border-t border-slate-200 text-xs leading-relaxed">Nessun contratto viene attivato durante il confronto.</p>
                  </aside>
                </div>
              </section>
            ) : (
              /* STEP 2: Offers Comparison View */
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#635bff]">Risultati del confronto</p>
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0a2540]">Le offerte per te</h1>
                  <p className="text-sm sm:text-base text-slate-600">{comparisons.length} {comparisons.length === 1 ? 'offerta' : 'offerte'} per {comparisonInput.annualConsumption.toLocaleString('it-IT')} {comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'} annui.</p>
                </div>
                {/* Editable Summary Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
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
                      <h2 className="text-base sm:text-lg font-bold text-[#0a2540]">
                        {comparisonInput.utilityType === 'luce' ? 'Luce' : 'Gas'} · {comparisonInput.annualConsumption.toLocaleString('it-IT')} {comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'} all'anno
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentStep('intake')}
                      className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                    >
                      <Sliders className="w-4 h-4 text-[#635bff]" />
                      <span>Modifica dati</span>
                    </button>
                  </div>

                  {/* Current parameter pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
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
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{isDemoCatalog ? 'Catalogo dimostrativo' : 'Offerte dal catalogo Volta'} · benchmark PUN/PSV Q1 2026.</span>{' '}
                      Le cifre sono stime comparative, non condizioni contrattuali definitive. Un consulente verifica schede e contratto prima della firma.
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
                      aria-pressed={pricingFilter === 'all'}
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
                      aria-pressed={pricingFilter === 'fixed'}
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
                      aria-pressed={pricingFilter === 'indexed'}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        pricingFilter === 'indexed'
                          ? 'bg-[#0a2540] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Indicizzato (PUN/PSV)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlyGreen(!onlyGreen)}
                      aria-pressed={onlyGreen}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        onlyGreen
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <Leaf className="w-3.5 h-3.5" />
                      <span>Solo 100% Green</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <label htmlFor="offer-sort" className="text-sm font-semibold text-slate-600">Ordina:</label>
                    <select
                      id="offer-sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'cost_asc' | 'savings_desc')}
                      className="min-h-[44px] max-w-full bg-white border border-slate-300 text-sm text-slate-800 font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#635bff] cursor-pointer"
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
                        isDemoCatalog={isDemoCatalog}
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
          activeCustomer ? (
            <SubitoMySupplies
              customer={activeCustomer}
              bills={myBills.filter((b) => b.customerId === activeCustomer.id)}
              onUploadBill={() => {
                setActiveView('offers');
                setCurrentStep('intake');
              }}
              onOpenBillDetails={setSelectedBill}
            />
          ) : null
        )}
      </main>

      <InstallAppBanner inline />

      {/* Offer Details Modal */}
      {activeComparisonForDetails && (
        <EnergyOfferDetails
          comparison={activeComparisonForDetails}
          isDemoCatalog={isDemoCatalog}
          currentInput={comparisonInput}
          isGuest={isPublicVisitor || isGuest || !activeCustomer}
          onClose={() => setActiveComparisonForDetails(null)}
          onRequestConsultation={handleRequestConsultation}
          onOpenPrivacy={() => setLegalModalTab('privacy')}
          utmParams={utmParams}
        />
      )}

      {selectedBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="bill-details-title" onKeyDown={(event) => { if (event.key === 'Escape') setSelectedBill(null); }}>
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#635bff]">La tua bolletta</p>
                <h2 id="bill-details-title" className="text-xl font-bold text-[#0a2540] break-all">{selectedBill.fileName}</h2>
              </div>
              <button type="button" onClick={() => setSelectedBill(null)} className="min-h-[44px] px-3 rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[#635bff]" aria-label="Chiudi dettagli bolletta">Chiudi</button>
            </div>
            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
              <div className="flex justify-between gap-3 py-3"><dt className="text-slate-600">Fornitura</dt><dd className="font-semibold capitalize">{selectedBill.utilityType}</dd></div>
              <div className="flex justify-between gap-3 py-3"><dt className="text-slate-600">Caricata il</dt><dd className="font-semibold">{selectedBill.uploadDate}</dd></div>
              <div className="flex justify-between gap-3 py-3"><dt className="text-slate-600">Stato</dt><dd className="font-semibold">{selectedBill.status === 'analyzed' ? 'Analizzata' : selectedBill.status === 'archived' ? 'Archiviata' : 'In verifica'}</dd></div>
            </dl>
            <p className="text-sm leading-relaxed text-slate-600">{selectedBill.status === 'in_review' ? 'Il team Volta deve ancora verificare i dati di questa bolletta. Per un confronto immediato puoi inserire i consumi a mano.' : 'L’analisi è stata registrata. Per dettagli sul documento contatta il team Volta.'}</p>
          </div>
        </div>
      )}

      {/* Institutional Legal Footer & Compliance */}
      <LegalFooter onOpenLegal={(tab) => setLegalModalTab(tab)} />

      {/* Technical Cookie Notice */}
      <CookieBanner onOpenLegal={(tab) => setLegalModalTab(tab)} />

      {/* Legal & Compliance Modal (GDPR, ARERA, Terms) */}
      <LegalModal
        isOpen={legalModalTab !== null}
        initialTab={legalModalTab || 'privacy'}
        onClose={() => setLegalModalTab(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
};

export default CustomerApp;

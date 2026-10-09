import React, { useState, useMemo, useEffect } from 'react';
import { EnergyPortalHeader } from '../components/customer/EnergyPortalHeader';
import { EnergyBillIntake } from '../components/customer/EnergyBillIntake';
import { EnergyOfferCard } from '../components/customer/EnergyOfferCard';
import { EnergyOfferDetails } from '../components/customer/EnergyOfferDetails';
import { SubitoMySupplies } from '../components/customer/SubitoMySupplies';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ToastContainer } from '../components/ToastContainer';
import { api } from '../api/client';
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
  ChevronDown, 
  ChevronUp
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

  // Intake / Comparison Input
  const defaultPoint = activeCustomer?.utilityPoints?.[0];
  const [comparisonInput, setComparisonInput] = useState<ComparisonInput>(() => ({
    utilityType: defaultPoint?.type || 'luce',
    annualConsumption: defaultPoint?.annualConsumption || (defaultPoint?.type === 'gas' ? 1000 : 2700),
    powerKw: defaultPoint?.powerKw || 3,
    f1Kwh: defaultPoint?.f1Kwh,
    f2Kwh: defaultPoint?.f2Kwh,
    f3Kwh: defaultPoint?.f3Kwh,
    currentSupplier: defaultPoint?.currentSupplier,
    currentPricingType: defaultPoint?.currentTariffType === 'fixed' ? 'fixed' : 'indexed',
    currentUnitCost: defaultPoint?.currentUnitCost,
    currentFixedFeeYear: defaultPoint?.currentFixedFeeYear,
    source: defaultPoint ? 'account' : 'manual',
    asOf: new Date().toISOString().split('T')[0],
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
          annualConsumption: match.annualConsumption || (match.type === 'gas' ? 1000 : 2700),
          powerKw: match.powerKw || 3,
          f1Kwh: match.f1Kwh,
          f2Kwh: match.f2Kwh,
          f3Kwh: match.f3Kwh,
          currentSupplier: match.currentSupplier,
          currentPricingType: match.currentTariffType === 'fixed' ? 'fixed' : 'indexed',
          currentUnitCost: match.currentUnitCost,
          currentFixedFeeYear: match.currentFixedFeeYear,
          source: 'account',
        };
      });
    }
  }, [activeCustomer]);

  // Is intake form expanded
  const [isIntakeExpanded, setIsIntakeExpanded] = useState<boolean>(!defaultPoint);

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
    addToast(
      'Bolletta Caricata con Successo',
      `Fattura ${uploadedBill.fileName} registrata nel tuo archivio. L'analisi è in verifica dal team Volta.`,
      'success'
    );
  };

  // Handle manual input update from intake
  const handleManualInputApplied = (input: ComparisonInput) => {
    setComparisonInput(input);
    setIsIntakeExpanded(false);
    addToast(
      'Parametri Aggiornati',
      `Stime ricalcolate per fornitura ${input.utilityType.toUpperCase()} con consumo ${input.annualConsumption} ${input.utilityType === 'luce' ? 'kWh' : 'Smc'}.`,
      'info'
    );
  };

  // Handle consultation request
  const handleRequestConsultation = (offer: SupplierOffer) => {
    addToast(
      'Richiesta Assistenza Registrata',
      `Un consulente Volta Energia ti contatterà senza impegno per illustrarti le condizioni dell'offerta ${offer.name} (${offer.supplier}).`,
      'success'
    );
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeView === 'offers' ? (
          <div className="space-y-6">
            {/* Guided Journey Stepper (Facile.it inspired, Volta branded) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Steps indicator */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-[#635bff] text-white font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <span className="text-xs font-bold text-[#0a2540]">
                      Fornitura: {comparisonInput.utilityType === 'luce' ? 'Solo Luce' : 'Solo Gas'}
                    </span>
                  </div>

                  <span className="text-slate-300">→</span>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-[#635bff] text-white font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs font-bold text-[#0a2540]">
                      Dati: {comparisonInput.annualConsumption} {comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'}
                    </span>
                  </div>

                  <span className="text-slate-300">→</span>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      3
                    </span>
                    <span className="text-xs font-bold text-emerald-800">
                      Offerte ({comparisons.length})
                    </span>
                  </div>
                </div>

                {/* Dual Fuel Disablement Explanation */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
                  <span className="text-slate-400">Opzione Luce + Gas:</span>
                  <span className="font-semibold text-slate-600">
                    Non disponibile (catalogo separato)
                  </span>
                </div>
              </div>
            </div>

            {/* Editable Summary Panel / Toggle Intake */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#635bff] bg-[#635bff]/10 border border-[#635bff]/25 px-2 py-0.5 rounded">
                      Parametri di Confronto in Uso
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (Origine: {comparisonInput.source === 'account' ? 'Dati Profilo' : 'Inserimento Manuale'})
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[#0a2540]">
                    I tuoi dati di riferimento per il calcolo
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsIntakeExpanded((prev) => !prev)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
                >
                  <Sliders className="w-4 h-4 text-[#635bff]" />
                  <span>{isIntakeExpanded ? 'Chiudi impostazioni' : 'Modifica dati o carica bolletta'}</span>
                  {isIntakeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Current parameter pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Tipologia</span>
                  <span className="font-bold text-slate-900 capitalize flex items-center gap-1">
                    {comparisonInput.utilityType === 'luce' ? <Zap className="w-3.5 h-3.5 text-amber-500" /> : <Flame className="w-3.5 h-3.5 text-blue-500" />}
                    {comparisonInput.utilityType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Consumo Annuo</span>
                  <span className="font-bold text-slate-900">
                    {comparisonInput.annualConsumption} {comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Prezzo Attuale Materia Prima</span>
                  <span className="font-bold text-slate-900">
                    {comparisonInput.currentUnitCost !== undefined
                      ? `${comparisonInput.currentUnitCost.toFixed(4)} €/${comparisonInput.utilityType === 'luce' ? 'kWh' : 'Smc'}`
                      : 'Non specificato'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Quota Fissa Attuale</span>
                  <span className="font-bold text-slate-900">
                    {comparisonInput.currentFixedFeeYear !== undefined
                      ? `${comparisonInput.currentFixedFeeYear} €/anno`
                      : 'Non specificata'}
                  </span>
                </div>
              </div>

              {/* Collapsible EnergyBillIntake Form */}
              {isIntakeExpanded && (
                <div className="pt-2 border-t border-slate-100">
                  <EnergyBillIntake
                    customer={activeCustomer}
                    selectedUtilityType={comparisonInput.utilityType}
                    onUploaded={handleBillUploaded}
                    onManualInput={handleManualInputApplied}
                  />
                </div>
              )}
            </div>

            {/* Filter and Sorting Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Tipo Tariffa:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPricingFilter('all')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pricingFilter === 'indexed'
                      ? 'bg-[#0a2540] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Indicizzato (PUN/PSV)
                </button>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-semibold text-slate-500">Ordina:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="min-h-[36px] bg-slate-50 border border-slate-200 text-xs text-slate-700 font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#635bff]"
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
        ) : (
          /* "Le mie forniture e bollette" View */
          <SubitoMySupplies
            customer={activeCustomer}
            bills={myBills.filter((b) => b.customerId === activeCustomer.id)}
            onUploadBill={() => {
              setActiveView('offers');
              setIsIntakeExpanded(true);
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
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">
              Trasparenza Tariffe
            </span>
            <span>• Confronto tariffe luce e gas per clienti finali</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Stime calcolate con metodologie e indici GME/ARERA vigenti.</span>
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
};

export default CustomerApp;

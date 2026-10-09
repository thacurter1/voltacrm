import React, { useState, useMemo } from 'react';
import { SubitoHeader } from '../components/customer/SubitoHeader';
import { SubitoOfferCard } from '../components/customer/SubitoOfferCard';
import { SubitoMySupplies } from '../components/customer/SubitoMySupplies';
import { BillOcrModal } from '../components/BillOcrModal';
import { DigitalSignatureModal } from '../components/DigitalSignatureModal';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ToastContainer } from '../components/ToastContainer';
import { MARKET_OFFERS, calculateAnnualCost } from '../services/energyEngine';
import { AuthUser, Customer, CustomerBill, SupplierOffer, SwitchAudit, ToastNotification } from '../types';
import { ShieldCheck, Filter } from 'lucide-react';

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

  // Subito UI states
  const [activeView, setActiveView] = useState<'marketplace' | 'supplies'>('marketplace');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [activeAuditForSignature, setActiveAuditForSignature] = useState<SwitchAudit | null>(null);
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

  const handleUploadBillSuccess = (_importedCustomer: Customer) => {
    setIsUploadModalOpen(false);
    if (onReloadBills) {
      onReloadBills();
    }
    addToast('Bolletta Caricata con Successo', 'Abbiamo preso in carico la tua bolletta. L\'analisi è in verifica.', 'success');
  };

  // Filtered market offers
  const filteredOffers = useMemo(() => {
    return MARKET_OFFERS.filter((offer) => {
      // Category filter
      if (selectedCategory === 'luce' && offer.energyType !== 'luce') return false;
      if (selectedCategory === 'gas' && offer.energyType !== 'gas') return false;
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = offer.name.toLowerCase().includes(q);
        const matchSupplier = offer.supplier.toLowerCase().includes(q);
        const matchTag = offer.tag?.toLowerCase().includes(q);
        if (!matchName && !matchSupplier && !matchTag) return false;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  // Handle offer selection
  const handleSelectOffer = (offer: SupplierOffer) => {
    if (!activeCustomer) return;
    // Find matching utility point
    const matchingPoint = activeCustomer.utilityPoints?.find((p) => p.type === offer.energyType) || activeCustomer.utilityPoints?.[0];
    if (matchingPoint) {
      const currentCost = calculateAnnualCost(matchingPoint, matchingPoint.currentTariffType, matchingPoint.currentUnitCost, matchingPoint.currentFixedFeeYear);
      const proposedCost = calculateAnnualCost(matchingPoint, offer.pricingType, offer.unitPriceOrSpread, offer.fixedAnnualFee);
      const annualSavings = Math.max(120, Math.round(currentCost - proposedCost));
      const syntheticAudit: SwitchAudit = {
        id: `audit-subito-${Date.now()}`,
        customerId: activeCustomer.id,
        customerName: activeCustomer.name || 'Cliente',
        utilityType: offer.energyType,
        podOrPdr: matchingPoint.podOrPdr,
        currentSupplier: matchingPoint.currentSupplier,
        currentAnnualCost: currentCost,
        bestOffer: offer,
        bestOfferAnnualCost: proposedCost,
        annualSavings: annualSavings,
        savingsPercent: currentCost > 0 ? Math.round((annualSavings / currentCost) * 100) : 15,
        daysActive: 30,
        status: 'proposal_sent',
        scheduledAuditDate: new Date().toISOString().split('T')[0],
      };
      setActiveAuditForSignature(syntheticAudit);
    } else {
      addToast('Attenzione', 'Nessuna fornitura associata a questa tipologia energetica.', 'warning');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f6f9fc] flex flex-col justify-center items-center p-6 text-slate-600 font-sans">
        <div className="w-10 h-10 border-4 border-[#635bff] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-base font-bold text-[#0a2540]">Caricamento della tua fornitura...</h2>
        <p className="text-xs text-slate-400 mt-1">Stiamo recuperando i dettagli del tuo account e delle tue bollette.</p>
      </div>
    );
  }

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
                onClick={onReturnToBackend}
                className="w-full py-2.5 px-4 bg-[#0a2540] hover:bg-[#1a385c] text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Torna al Backend CRM
              </button>
            )}
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
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

      {/* Subito-style Header */}
      <SubitoHeader
        category={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUploadBill={() => setIsUploadModalOpen(true)}
        customerName={activeCustomer.name || 'Cliente'}
        customers={[activeCustomer]}
        selectedCustomerId={activeCustomer.id}
        onSelectCustomer={() => {}}
        activeView={activeView}
        onSelectView={setActiveView}
        onToast={addToast}
        onReturnToBackend={onReturnToBackend}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'marketplace' ? (
          <div className="space-y-6">
            {/* Marketplace Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#635bff] bg-[#635bff]/10 border border-[#635bff]/25 px-2.5 py-1 rounded-md">
                  Offerte Certificate dal Broker
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#0a2540] mt-2">
                  Risparmia subito sulle tue bollette luce e gas
                </h1>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Tariffe trasparenti a prezzo fisso o indicizzato PUN/PSV senza costi nascosti. Scegli l'offerta ideale e attiva in 2 minuti.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-slate-400 block">Trovate</span>
                <span className="text-2xl font-black text-slate-900">{filteredOffers.length}</span>
                <span className="text-xs font-medium text-slate-500"> tariffe attive</span>
              </div>
            </div>

            {/* Offer Listing Cards (Subito classifieds style) */}
            <div className="space-y-3">
              {filteredOffers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
                  <Filter className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">Nessuna offerta corrisponde ai filtri impostati</p>
                  <button
                    onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                    className="text-xs text-[#635bff] font-bold hover:underline"
                  >
                    Reimposta filtri di ricerca
                  </button>
                </div>
              ) : (
                filteredOffers.map((offer) => {
                  // Calculate customized savings for this customer
                  const matchingPoint = activeCustomer?.utilityPoints?.find((p) => p.type === offer.energyType);
                  let customSavings: number | undefined = undefined;
                  if (matchingPoint) {
                    const currentCost = calculateAnnualCost(matchingPoint, matchingPoint.currentTariffType, matchingPoint.currentUnitCost, matchingPoint.currentFixedFeeYear);
                    const proposedCost = calculateAnnualCost(matchingPoint, offer.pricingType, offer.unitPriceOrSpread, offer.fixedAnnualFee);
                    customSavings = Math.max(80, Math.round(currentCost - proposedCost));
                  }
                  return (
                    <SubitoOfferCard
                      key={offer.id}
                      offer={offer}
                      estimatedSavingsEur={customSavings}
                      onSelectOffer={handleSelectOffer}
                    />
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* "Le mie forniture" View */
          <SubitoMySupplies
            customer={activeCustomer}
            bills={bills.filter((b) => b.customerId === activeCustomer?.id)}
            onUploadBill={() => setIsUploadModalOpen(true)}
            onOpenBillDetails={(bill) => {
              const savingsText = bill.extractedSavingsEur
                ? ` • Risparmio certificato: €${Math.round(bill.extractedSavingsEur)}/anno`
                : '';
              addToast(
                'Dettaglio Bolletta',
                `${bill.fileName} (${bill.utilityType.toUpperCase()}) caricata il ${bill.uploadDate}${savingsText}. I parametri contrattuali sono costantemente monitorati.`,
                'info'
              );
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0a2540]">Volta Energia</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">
              Portale Trasparenza
            </span>
            <span>• Portale Trasparenza Tariffe & Risparmio Certificato</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Connessione HTTPS. La demo non certifica la conformità GDPR.</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {isUploadModalOpen && (
        <BillOcrModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onImportCustomer={handleUploadBillSuccess}
        />
      )}

      {activeAuditForSignature && (
        <DigitalSignatureModal
          isOpen={true}
          onClose={() => setActiveAuditForSignature(null)}
          audit={activeAuditForSignature}
          customerPhone={activeCustomer?.phone || ''}
          customerFiscalCode={activeCustomer?.fiscalCode || ''}
          onSigned={() => {
            setActiveAuditForSignature(null);
            addToast('Attivazione Inviata', 'La tua richiesta è stata registrata con successo e presa in carico.', 'success');
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
};

export default CustomerApp;

import React, { useState, useMemo } from 'react';
import { SubitoHeader } from '../components/customer/SubitoHeader';
import { SubitoOfferCard } from '../components/customer/SubitoOfferCard';
import { SubitoMySupplies } from '../components/customer/SubitoMySupplies';
import { BillOcrModal } from '../components/BillOcrModal';
import { DigitalSignatureModal } from '../components/DigitalSignatureModal';
import { InstallAppBanner } from '../components/InstallAppBanner';
import { ToastContainer } from '../components/ToastContainer';
import { dbService } from '../services/db';
import { MARKET_OFFERS, calculateAnnualCost } from '../services/energyEngine';
import { Customer, CustomerBill, SupplierOffer, SwitchAudit, ToastNotification } from '../types';
import { ShieldCheck, Filter } from 'lucide-react';

export const CustomerApp: React.FC = () => {
  const initialDb = dbService.load();
  const [customers, setCustomers] = useState<Customer[]>(initialDb.customers);
  const [bills] = useState<CustomerBill[]>(initialDb.bills);

  // Active customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialDb.customers[0]?.id || 'cust-1'
  );
  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || customers[0] || initialDb.customers[0],
    [customers, selectedCustomerId, initialDb.customers]
  );

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

  const handleUploadBillSuccess = (importedCustomer: Customer) => {
    setIsUploadModalOpen(false);
    setCustomers((prev) => [importedCustomer, ...prev.filter((c) => c.id !== importedCustomer.id)]);
    setSelectedCustomerId(importedCustomer.id);
    addToast('Bolletta Caricata con Successo', 'Abbiamo analizzato i tuoi consumi e aggiornato le stime di risparmio.', 'success');
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
    // Find matching utility point
    const matchingPoint = activeCustomer?.utilityPoints?.find((p) => p.type === offer.energyType) || activeCustomer?.utilityPoints?.[0];
    if (matchingPoint) {
      const currentCost = calculateAnnualCost(matchingPoint, matchingPoint.currentTariffType, matchingPoint.currentUnitCost, matchingPoint.currentFixedFeeYear);
      const proposedCost = calculateAnnualCost(matchingPoint, offer.pricingType, offer.unitPriceOrSpread, offer.fixedAnnualFee);
      const annualSavings = Math.max(120, Math.round(currentCost - proposedCost));
      const syntheticAudit: SwitchAudit = {
        id: `audit-subito-${Date.now()}`,
        customerId: activeCustomer?.id || 'cust-1',
        customerName: activeCustomer?.name || 'Cliente',
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

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-900 flex flex-col font-sans">
      <InstallAppBanner />

      {/* Subito-style Header */}
      <SubitoHeader
        category={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUploadBill={() => setIsUploadModalOpen(true)}
        customerName={activeCustomer?.name || 'Cliente'}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        onSelectCustomer={setSelectedCustomerId}
        activeView={activeView}
        onSelectView={setActiveView}
        onToast={addToast}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'marketplace' ? (
          <div className="space-y-6">
            {/* Marketplace Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e02424] bg-red-50 px-2.5 py-1 rounded-md">
                  Offerte Certificate dal Broker
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
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
                    className="text-xs text-[#e02424] font-bold hover:underline"
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
            <span className="font-black text-[#e02424]">subito energia</span>
            <span>• Portale Trasparenza Tariffe & Risparmio Certificato</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Crittografia di grado bancario SHA-256 e conformità GDPR</span>
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

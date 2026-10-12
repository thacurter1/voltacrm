import React from 'react';
import { 
  X, 
  Zap, 
  Flame, 
  HelpCircle, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  PhoneCall,
  PieChart
} from 'lucide-react';
import { SupplierOffer } from '../../types';
import { ComparisonInput, ComparisonResult } from '../../services/offerComparison';
import { portalApi } from '../../api/portal';

export interface GuestConsultationData {
  customerName: string;
  phone: string;
  email?: string;
  preferredContact?: string;
  privacyConsent: boolean;
}

export interface EnergyOfferDetailsProps {
  comparison: ComparisonResult;
  isDemoCatalog: boolean;
  currentInput: ComparisonInput;
  onClose: () => void;
  onRequestConsultation: (
    offer: SupplierOffer,
    notes?: string,
    guestData?: GuestConsultationData
  ) => Promise<boolean>;
  isGuest?: boolean;
  onOpenPrivacy?: () => void;
}

export const EnergyOfferDetails: React.FC<EnergyOfferDetailsProps> = ({
  comparison,
  isDemoCatalog,
  currentInput,
  onClose,
  onRequestConsultation,
  isGuest,
  onOpenPrivacy,
}) => {
  const { offer, annualCost, currentAnnualCost, savingsEur, savingsPercent } = comparison;
  const isLuce = offer.energyType === 'luce';
  const unitLabel = isLuce ? '€/kWh' : '€/Smc';
  const monthlyCost = annualCost !== null ? Math.round(annualCost / 12) : null;
  const currentMonthlyCost = currentAnnualCost !== null ? Math.round(currentAnnualCost / 12) : null;
  const isGuestMode = isGuest !== undefined ? isGuest : (!currentInput.source || currentInput.source !== 'account');
  const [customerNotes, setCustomerNotes] = React.useState('');
  const [guestName, setGuestName] = React.useState('');
  const [guestPhone, setGuestPhone] = React.useState('');
  const [guestEmail, setGuestEmail] = React.useState('');
  const [preferredTime, setPreferredTime] = React.useState<'Mattina (9-13)' | 'Pomeriggio (14-18)' | 'Qualsiasi'>('Qualsiasi');
  const [privacyConsent, setPrivacyConsent] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // ARERA 4-component breakdown percentages (~55% luce, ~60% gas etc.)
  const areraBreakdown = React.useMemo(() => {
    const percentages = isLuce
      ? { materia: 55, trasporto: 18, oneri: 12, imposte: 15 }
      : { materia: 60, trasporto: 15, oneri: 8, imposte: 17 };

    const calculateAmount = (pct: number) => {
      if (annualCost === null) return null;
      return Math.round((annualCost * pct) / 100);
    };

    return [
      {
        id: 'materia',
        name: isLuce ? 'Spesa Materia Energia' : 'Spesa Materia Gas Naturale',
        percentage: percentages.materia,
        annualAmount: calculateAmount(percentages.materia),
        description: isLuce
          ? "Acquisto energia, dispacciamento e commercializzazione al dettaglio"
          : 'Approvvigionamento gas all’ingrosso e commercializzazione al dettaglio',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        barBg: 'bg-[#635bff]',
      },
      {
        id: 'trasporto',
        name: 'Spesa Trasporto e Gestione Contatore',
        percentage: percentages.trasporto,
        annualAmount: calculateAmount(percentages.trasporto),
        description: 'Servizi di trasmissione, distribuzione e misura su rete locale',
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
        barBg: 'bg-sky-500',
      },
      {
        id: 'oneri',
        name: 'Spesa Oneri di Sistema',
        percentage: percentages.oneri,
        annualAmount: calculateAmount(percentages.oneri),
        description: 'Costi per attività di interesse generale del sistema energetico',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        barBg: 'bg-amber-500',
      },
      {
        id: 'imposte',
        name: 'Imposte stimate (IVA e accise)',
        percentage: percentages.imposte,
        annualAmount: calculateAmount(percentages.imposte),
        description: 'Accise erariali sul consumo e imposta sul valore aggiunto (IVA)',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        barBg: 'bg-emerald-500',
      },
    ];
  }, [isLuce, annualCost]);

  React.useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  const submitConsultation = async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    if (isGuestMode) {
      const trimmedName = guestName.trim();
      if (!trimmedName) {
        setSubmitError('Inserisci nome e cognome per richiedere la consulenza.');
        return;
      }

      const trimmedPhone = guestPhone.trim();
      const phoneDigits = trimmedPhone.replace(/\D/g, '');
      if (!trimmedPhone || phoneDigits.length < 8) {
        setSubmitError('Inserisci un recapito telefonico valido (almeno 8 cifre) per essere ricontattato.');
        return;
      }

      if (!privacyConsent) {
        setSubmitError("È necessario accettare l'informativa sulla privacy per procedere con la consulenza.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const guestData: GuestConsultationData | undefined = isGuestMode
        ? {
            customerName: guestName.trim(),
            phone: guestPhone.trim(),
            email: guestEmail.trim() || undefined,
            preferredContact: preferredTime,
            privacyConsent,
          }
        : undefined;

      const notesPayload = [
        customerNotes.trim() || null,
        isGuestMode && preferredTime ? `Fascia oraria preferita: ${preferredTime}` : null,
      ].filter(Boolean).join(' • ') || undefined;

      let saved = await onRequestConsultation(offer, notesPayload, guestData);
      if (!saved && isGuestMode && guestData) {
        try {
          const fallbackRes = await portalApi.requestConsultation({
            offerId: offer.id,
            offerName: offer.name,
            supplier: offer.supplier,
            utilityType: currentInput.utilityType,
            annualConsumption: currentInput.annualConsumption > 0 ? currentInput.annualConsumption : undefined,
            notes: notesPayload,
            customerName: guestData.customerName,
            phone: guestData.phone,
            email: guestData.email,
            privacyConsent: guestData.privacyConsent,
            preferredContact: guestData.preferredContact,
          });
          saved = fallbackRes.success;
        } catch {
          // ignore fallback error
        }
      }

      if (saved) {
        if (isGuestMode) {
          setIsSubmitted(true);
        } else {
          onClose();
        }
      } else {
        setSubmitError('Non siamo riusciti a inviare la richiesta. Riprova senza perdere le tue note.');
      }
    } catch {
      setSubmitError('Non siamo riusciti a inviare la richiesta. Riprova senza perdere le tue note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-success-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>

          <div className="space-y-2">
            <h2 id="offer-success-title" className="text-xl sm:text-2xl font-black text-[#0a2540]">
              Richiesta inviata con successo!
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              Un consulente Volta Energia ti ricontatterà al <strong className="text-slate-900">{guestPhone || 'tuo recapito'}</strong> entro 24 ore per illustrarti tutti i dettagli dell'offerta <strong className="text-slate-900">{offer.name}</strong> ({offer.supplier}) e guidarti senza impegno nel confronto.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Offerta:</span>
              <span className="font-bold text-slate-900">{offer.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Fornitore:</span>
              <span className="font-semibold text-slate-800">{offer.supplier}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Fascia oraria preferita:</span>
              <span className="font-semibold text-slate-800">{preferredTime}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff]"
          >
            <span>Torna al confronto</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-details-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isLuce ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isLuce ? <Zap className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {offer.supplier}
                </span>
                {isDemoCatalog && <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-200 text-slate-700">Catalogo demo</span>}
              </div>
              <h2 id="offer-details-title" className="text-lg sm:text-xl font-black text-[#0a2540]">
                {offer.name}
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
            aria-label="Chiudi dettagli offerta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-7 max-h-[70vh] overflow-y-auto text-sm text-slate-700">
          {/* Sintesi Economica della Stima */}
          <div className="space-y-4">
            <h3 className="font-bold text-base text-[#0a2540] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#635bff]" />
              <span>Sintesi Economica della Stima</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="border-l-2 border-[#635bff] pl-4">
                <span className="text-sm font-semibold text-slate-600 block">
                  Con questa offerta
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-[#0a2540]">
                    {monthlyCost !== null ? `~€${monthlyCost}` : 'Non calcolabile'}
                  </span>
                  {monthlyCost !== null && (
                    <span className="text-sm font-semibold text-slate-500">/mese</span>
                  )}
                </div>
                <span className="text-slate-600 block text-xs mt-1 font-medium">
                  {annualCost !== null ? `~€${Math.round(annualCost)}/anno` : 'Spesa annua non calcolabile'}
                </span>
                <span className="text-slate-500 block text-xs mt-0.5">
                  Spesa annua stimata, incluse le componenti considerate nel calcolo
                </span>
              </div>

              <div className="border-l-2 border-slate-200 pl-4">
                <span className="text-sm font-semibold text-slate-600 block">
                  Con la tua tariffa attuale
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold text-slate-700">
                    {currentMonthlyCost !== null ? `~€${currentMonthlyCost}` : 'Dato non inserito'}
                  </span>
                  {currentMonthlyCost !== null && (
                    <span className="text-sm font-semibold text-slate-500">/mese</span>
                  )}
                </div>
                <span className="text-slate-600 block text-xs mt-1 font-medium">
                  {currentAnnualCost !== null ? `~€${Math.round(currentAnnualCost)}/anno` : 'Tariffa attuale non indicata'}
                </span>
                <span className="text-slate-500 block text-xs mt-0.5">
                  {currentAnnualCost !== null
                    ? `Basato sulla tariffa ${currentInput.currentPricingType || 'in uso'}`
                    : 'Tariffa attuale non indicata'}
                </span>
              </div>
            </div>

            {savingsEur !== null && currentAnnualCost !== null && (
              <div
                className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                  savingsEur > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : savingsEur === 0
                    ? 'bg-slate-100 border-slate-200 text-slate-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {savingsEur > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {savingsEur > 0
                    ? `Risparmio matematico stimato: ~€${Math.round(savingsEur)} all'anno (${savingsPercent}%)`
                    : savingsEur === 0
                    ? 'La spesa annua stimata è identica a quella della tua tariffa attuale.'
                    : `Questa offerta ha una spesa stimata superiore di ~€${Math.round(Math.abs(savingsEur))} all'anno rispetto alla tua attuale tariffa.`}
                </span>
              </div>
            )}
          </div>

          {/* Scomposizione Spesa Bolletta (Standard ARERA) */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-[#0a2540] flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#635bff]" />
                <span>Scomposizione Spesa Stimata (Standard ARERA)</span>
              </h3>
              <span className="text-xs text-slate-500 hidden sm:inline">
                4 componenti standard ARERA
              </span>
            </div>

            {/* Visual breakdown bar */}
            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 p-0.5 gap-0.5" role="progressbar" aria-label="Ripartizione componenti ARERA">
              {areraBreakdown.map((item) => (
                <div
                  key={item.id}
                  className={`h-full rounded-xs ${item.barBg} transition-all duration-300`}
                  style={{ width: `${item.percentage}%` }}
                  title={`${item.name}: ~${item.percentage}%`}
                />
              ))}
            </div>

            {/* Component cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {areraBreakdown.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-900 block truncate">
                        {item.name}
                      </span>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-md border shrink-0 ${item.badgeBg}`}
                    >
                      ~{item.percentage}%
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-600">Stima annua:</span>
                    <span className="font-extrabold text-sm text-[#0a2540]">
                      {item.annualAmount !== null
                        ? `~€${item.annualAmount}/anno`
                        : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * La ripartizione percentuale riflette le stime standard ARERA ({isLuce ? '~55% materia, ~18% trasporto, ~12% oneri, ~15% imposte' : '~60% materia, ~15% trasporto, ~8% oneri, ~17% imposte'}) per forniture domestiche tipo.
            </p>
          </div>

          {/* Dettaglio Condizioni Economiche */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-[#0a2540]">
              Condizioni Economiche della Fornitura
            </h3>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Tipologia Prezzo</span>
                <span className="font-bold text-slate-900">
                  {offer.pricingType === 'fixed'
                    ? 'Prezzo Fisso Bloccato'
                    : `Indicizzato (${isLuce ? 'PUN' : 'PSV'})`}
                </span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Costo Materia Prima</span>
                <span className="font-bold text-slate-900">
                  {offer.pricingType === 'fixed'
                    ? `${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`
                    : `${isLuce ? 'PUN' : 'PSV'} + ${offer.unitPriceOrSpread.toFixed(4)} ${unitLabel}`}
                </span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Quota Fissa Commercializzazione</span>
                <span className="font-bold text-slate-900">
                  {offer.fixedAnnualFee} €/anno ({(offer.fixedAnnualFee / 12).toFixed(2)} €/mese)
                </span>
              </div>

              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500">Durata Condizioni Economiche</span>
                <span className="font-bold text-slate-900">
                  {offer.durationMonths} mesi dalla data di attivazione
                </span>
              </div>
            </div>
          </div>

          {/* Metodologia e Ipotesi */}
          <details className="border-y border-slate-200 py-4 text-sm text-slate-600">
            <summary className="flex items-center gap-2 font-semibold text-[#0a2540] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#635bff]">
              <HelpCircle className="w-4 h-4 text-[#635bff]" />
              <span>Come abbiamo calcolato la stima</span>
            </summary>
            <ul className="list-disc pl-5 mt-3 space-y-2 leading-relaxed">
              <li>
                Consumo di riferimento: <strong>{currentInput.annualConsumption} {isLuce ? 'kWh' : 'Smc'}/anno</strong> ({currentInput.source === 'account' ? 'dati del profilo' : currentInput.source === 'bill-reviewed' ? 'bolletta verificata' : 'dati inseriti da te'}).
              </li>
              {isLuce && (
                <li>
                  Potenza impegnata considerata: <strong>{currentInput.powerKw || 3} kW</strong> (quota potenza regolata ARERA inclusa nella stima).
                </li>
              )}
              <li>
                Gli oneri di sistema, trasporto, gestione contatore e le imposte (IVA e accise) sono stimati sulla base dei parametri ARERA standard di settore.
              </li>
              <li>
                Questa elaborazione è uno strumento informativo e non costituisce un preventivo vincolante. Il plico contrattuale ufficiale e le schede di confrontabilità fornitore saranno forniti per presa visione prima di ogni richiesta definitiva.
              </li>
            </ul>
          </details>

          {/* Consultation Intake Section */}
          {isGuestMode ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#635bff]" />
                <h3 className="font-bold text-sm text-[#0a2540]">
                  Richiedi consulenza gratuita con un esperto Volta
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nessun vincolo né costo. Ti ricontattiamo per chiarire ogni voce della tariffa e guidarti nel passaggio se decidi di procedere.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="guest-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Nome e Cognome <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Mario Rossi"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635bff] text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="guest-phone" className="block text-xs font-bold text-slate-700 mb-1">
                    Numero di Telefono <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="guest-phone"
                    type="tel"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+39 347 1234567"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635bff] text-slate-800 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="guest-email" className="block text-xs font-bold text-slate-700 mb-1">
                  Email (opzionale)
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="mario.rossi@email.it"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635bff] text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-700 mb-1.5">
                  Orario di ricontatto preferito
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Orario di ricontatto preferito">
                  {(['Mattina (9-13)', 'Pomeriggio (14-18)', 'Qualsiasi'] as const).map((timeOption) => {
                    const isSelected = preferredTime === timeOption;
                    return (
                      <button
                        key={timeOption}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setPreferredTime(timeOption)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#635bff] text-white border-[#635bff] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {timeOption}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="consultation-notes" className="block text-xs font-bold text-slate-700">
                  Note o preferenze per il consulente (opzionale)
                </label>
                <input
                  id="consultation-notes"
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Es. Richiamare preferibilmente su WhatsApp..."
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635bff] text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-[#635bff] border-slate-300 focus:ring-[#635bff] cursor-pointer"
                    required
                  />
                  <span>
                    Dichiaro di aver preso visione dell'{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenPrivacy?.();
                      }}
                      className="text-[#635bff] font-semibold underline hover:text-[#534be5] cursor-pointer"
                    >
                      informativa privacy (GDPR)
                    </button>{' '}
                    e acconsento al trattamento dei dati per la consulenza gratuita sulle offerte Volta Energia. <span className="text-red-500 font-bold">*</span>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <label htmlFor="consultation-notes" className="block text-sm font-semibold text-slate-700">
                Note o preferenze per il consulente (opzionale)
              </label>
              <input
                id="consultation-notes"
                type="text"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Es. Richiamare preferibilmente nel pomeriggio..."
                className="w-full min-h-[48px] px-3.5 py-2 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#635bff] text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Chiudi
          </button>

          {submitError && <p role="alert" className="w-full text-sm font-medium text-red-700">{submitError}</p>}
          <button
            type="button"
            onClick={submitConsultation}
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:opacity-60 text-white font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff]"
          >
            <PhoneCall className="w-4 h-4" />
            <span>{isSubmitting ? 'Invio richiesta...' : (isGuestMode ? 'Richiedi consulenza gratuita' : 'Richiedi consulenza')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

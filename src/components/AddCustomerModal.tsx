import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Zap, 
  Flame, 
  ShieldCheck, 
  CheckCircle2, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles
} from 'lucide-react';
import { Customer, UtilityPoint, Lead } from '../types';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void> | void;
  initialLead?: Lead | null;
  accountManagers?: string[];
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLead,
  accountManagers = ['Matteo Riva (Broker Owner)', 'Chiara Neri (Consulente PMI)', 'Luca Bianchi (Agente Territorio)']
}) => {
  const [activeTab, setActiveTab] = useState<'anagrafica' | 'forniture'>('anagrafica');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anagrafica State
  const [name, setName] = useState('');
  const [fiscalCode, setFiscalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [accountManager, setAccountManager] = useState(accountManagers[0]);
  const [hasBrokerageMandate, setHasBrokerageMandate] = useState(true);
  const [notes, setNotes] = useState('');

  // Forniture State
  const [enableLuce, setEnableLuce] = useState(true);
  const [lucePod, setLucePod] = useState('');
  const [luceAnnualKwh, setLuceAnnualKwh] = useState(3000);
  const [lucePowerKw, setLucePowerKw] = useState(3.0);
  const [luceSupplier, setLuceSupplier] = useState('Enel Energia');
  const [luceUnitCost, setLuceUnitCost] = useState(0.165);
  const [luceFixedFee, setLuceFixedFee] = useState(120);

  const [enableGas, setEnableGas] = useState(false);
  const [gasPdr, setGasPdr] = useState('');
  const [gasAnnualSmc, setGasAnnualSmc] = useState(950);
  const [gasSupplier, setGasSupplier] = useState('Eni Plenitude');
  const [gasUnitCost, setGasUnitCost] = useState(0.680);
  const [gasFixedFee, setGasFixedFee] = useState(96);

  // Pre-popolamento quando si converte un Lead
  useEffect(() => {
    if (initialLead) {
      setName(initialLead.name || '');
      setPhone(initialLead.phone || '');
      setEmail(initialLead.email || '');
      setCity(initialLead.city || '');
      setNotes(initialLead.notes ? `Convertito da lead (${initialLead.source}): ${initialLead.notes}` : `Acquisito tramite ${initialLead.source}`);
      
      if (initialLead.estimatedConsumptionKwh) {
        setEnableLuce(true);
        setLuceAnnualKwh(initialLead.estimatedConsumptionKwh);
      }
      if (initialLead.estimatedConsumptionSmc) {
        setEnableGas(true);
        setGasAnnualSmc(initialLead.estimatedConsumptionSmc);
      }
    } else {
      // Valori di default
      setName('');
      setFiscalCode('');
      setPhone('+39 ');
      setEmail('');
      setCity('');
      setNotes('');
      setEnableLuce(true);
      setEnableGas(false);
      setLucePod('');
      setGasPdr('');
    }
    setError(null);
  }, [initialLead, isOpen]);

  if (!isOpen) return null;

  // Generatore codici POD/PDR fittizi conformi per demo rapida
  const handleAutoGeneratePod = () => {
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    setLucePod(`IT001E${randomSuffix}`);
  };

  const handleAutoGeneratePdr = () => {
    const random14 = Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
    setGasPdr(random14);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validazioni base
    if (!name.trim()) {
      setError('Inserisci il nome o la ragione sociale del cliente.');
      setActiveTab('anagrafica');
      return;
    }
    if (!phone.trim() || phone.trim() === '+39') {
      setError('Inserisci un numero di telefono valido per i contatti e le notifiche OTP.');
      setActiveTab('anagrafica');
      return;
    }
    if (!enableLuce && !enableGas) {
      setError('Seleziona almeno un punto di fornitura attivo (Luce, Gas o Dual Fuel).');
      setActiveTab('forniture');
      return;
    }

    const utilityPoints: UtilityPoint[] = [];

    if (enableLuce) {
      const finalPod = lucePod.trim() || `IT001E${Math.floor(10000000 + Math.random() * 90000000)}`;
      utilityPoints.push({
        id: `point-luce-${Date.now()}`,
        type: 'luce',
        podOrPdr: finalPod,
        annualConsumption: Number(luceAnnualKwh) || 3000,
        powerKw: Number(lucePowerKw) || 3.0,
        f1Kwh: Math.round((luceAnnualKwh || 3000) * 0.38),
        f2Kwh: Math.round((luceAnnualKwh || 3000) * 0.32),
        f3Kwh: Math.round((luceAnnualKwh || 3000) * 0.30),
        currentSupplier: luceSupplier.trim() || 'Fornitore di Maggior Tutela',
        currentOfferName: 'Offerta Iniziale Libero Mercato',
        currentTariffType: 'indexed',
        currentUnitCost: Number(luceUnitCost) || 0.165,
        currentFixedFeeYear: Number(luceFixedFee) || 120
      });
    }

    if (enableGas) {
      const finalPdr = gasPdr.trim() || Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
      utilityPoints.push({
        id: `point-gas-${Date.now()}`,
        type: 'gas',
        podOrPdr: finalPdr,
        annualConsumption: Number(gasAnnualSmc) || 950,
        currentSupplier: gasSupplier.trim() || 'Fornitore Storico Gas',
        currentOfferName: 'Tariffa Gas Base Mercato',
        currentTariffType: 'indexed',
        currentUnitCost: Number(gasUnitCost) || 0.680,
        currentFixedFeeYear: Number(gasFixedFee) || 96
      });
    }

    const customerId = `cust-${Date.now()}`;
    const generatedCf = fiscalCode.trim().toUpperCase() || `CF${Date.now().toString().slice(-8)}`;
    const generatedEmail = email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@cliente-volta.it`;

    const newCustomer: Customer = {
      id: customerId,
      name: name.trim(),
      fiscalCode: generatedCf,
      phone: phone.trim(),
      email: generatedEmail,
      city: city.trim() || 'Milano',
      utilityPoints,
      contractStartDate: new Date().toISOString().split('T')[0],
      lastSwitchAuditDate: new Date().toISOString().split('T')[0],
      nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
      accountManager,
      hasBrokerageMandate,
      notes: notes.trim()
    };

    setIsSubmitting(true);
    try {
      await onSave(newCustomer);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio del nuovo cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-10 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs transition-opacity" 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#e3e8ee] bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#635bff] uppercase tracking-wider">
                <UserPlus className="h-4 w-4" />
                Registrazione Anagrafica & Portafoglio
              </span>
              {initialLead && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                  Conversione da Lead Inbound
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-[#0a2540] tracking-tight mt-1">
              Nuovo Cliente & Forniture Energetiche
            </h2>
            <p className="text-xs text-[#425466] mt-0.5">
              Inserisci i dati anagrafici e associa i punti di fornitura Luce e Gas per l'audit quadrimestrale continuo.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#e3e8ee] px-6 text-xs bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('anagrafica')}
            className={`py-3 px-4 font-bold border-b-2 transition-all cursor-pointer -mb-px flex items-center gap-2 ${
              activeTab === 'anagrafica'
                ? 'border-[#635bff] text-[#635bff] bg-white rounded-t-lg'
                : 'border-transparent text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>1. Dati Anagrafici & Mandato</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('forniture')}
            className={`py-3 px-4 font-bold border-b-2 transition-all cursor-pointer -mb-px flex items-center gap-2 ${
              activeTab === 'forniture'
                ? 'border-[#635bff] text-[#635bff] bg-white rounded-t-lg'
                : 'border-transparent text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>2. Forniture (Luce & Gas)</span>
            {(enableLuce || enableGas) && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-[#635bff] text-[10px] font-bold">
                {(enableLuce ? 1 : 0) + (enableGas ? 1 : 0)} attive
              </span>
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: ANAGRAFICA */}
          {activeTab === 'anagrafica' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Nome e Cognome / Ragione Sociale *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Es. Mario Rossi o Rossi Consulting S.r.l."
                    className="w-full px-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:bg-white focus:outline-none focus:border-[#635bff] text-xs font-semibold text-[#0a2540]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Codice Fiscale / Partita IVA
                  </label>
                  <input
                    type="text"
                    value={fiscalCode}
                    onChange={(e) => setFiscalCode(e.target.value.toUpperCase())}
                    placeholder="Es. RSSMRA80A01H501U"
                    className="w-full px-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:bg-white focus:outline-none focus:border-[#635bff] text-xs font-mono text-[#0a2540]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Città / Comune di Fornitura
                  </label>
                  <div className="relative">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Es. Milano (MI)"
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:bg-white focus:outline-none focus:border-[#635bff] text-xs text-[#0a2540]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Telefono / Cellulare *
                  </label>
                  <div className="relative">
                    <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+39 340 1234567"
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:bg-white focus:outline-none focus:border-[#635bff] text-xs font-mono text-[#0a2540]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Indirizzo Email
                  </label>
                  <div className="relative">
                    <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="mario.rossi@email.it"
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:bg-white focus:outline-none focus:border-[#635bff] text-xs text-[#0a2540]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Consulente Commerciale Assegnato
                  </label>
                  <select
                    value={accountManager}
                    onChange={(e) => setAccountManager(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:bg-white focus:outline-none focus:border-[#635bff] text-xs font-medium text-[#0a2540]"
                  >
                    {accountManagers.map((am) => (
                      <option key={am} value={am}>{am}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Delega Brokeraggio Switch Continuo */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBrokerageMandate}
                    onChange={(e) => setHasBrokerageMandate(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Delega di Brokeraggio Continuo ARERA Attiva
                    </span>
                    <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                      Autorizza VoltaCRM a verificare periodicamente (ogni 120 giorni) le offerte di mercato e proporre o eseguire il passaggio alla migliore tariffa garantendo il massimo risparmio.
                    </p>
                  </div>
                </label>
              </div>

              {/* Note interne */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Note Operatore / Provenienza
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informazioni aggiuntive, orari preferiti di contatto, ecc."
                  className="w-full px-3.5 py-2 rounded-lg border border-[#e3e8ee] bg-white focus:outline-none focus:border-[#635bff] text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          {/* TAB 2: FORNITURE (LUCE & GAS) */}
          {activeTab === 'forniture' && (
            <div className="space-y-5">
              {/* Fornitura Luce */}
              <div className={`p-4 rounded-xl border transition-all ${
                enableLuce ? 'bg-amber-50/30 border-amber-200 shadow-xs' : 'bg-slate-50/50 border-slate-200 opacity-80'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableLuce}
                      onChange={(e) => setEnableLuce(e.target.checked)}
                      className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#0a2540]">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span>Fornitura Energia Elettrica (Luce)</span>
                    </div>
                  </label>

                  {enableLuce && (
                    <button
                      type="button"
                      onClick={handleAutoGeneratePod}
                      className="inline-flex items-center gap-1 text-[11px] text-[#635bff] font-semibold hover:underline cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      Auto-genera POD demo
                    </button>
                  )}
                </div>

                {enableLuce && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Codice POD (14 o 15 caratteri) *
                      </label>
                      <input
                        type="text"
                        value={lucePod}
                        onChange={(e) => setLucePod(e.target.value.toUpperCase())}
                        placeholder="IT001E12345678"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Fornitore Attuale
                      </label>
                      <input
                        type="text"
                        value={luceSupplier}
                        onChange={(e) => setLuceSupplier(e.target.value)}
                        placeholder="Es. Enel Energia / A2A"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Consumo Annuo Stimato (kWh/anno)
                      </label>
                      <input
                        type="number"
                        min="500"
                        max="50000"
                        step="100"
                        value={luceAnnualKwh}
                        onChange={(e) => setLuceAnnualKwh(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Potenza Impegnata (kW)
                      </label>
                      <input
                        type="number"
                        min="1.5"
                        max="30"
                        step="0.5"
                        value={lucePowerKw}
                        onChange={(e) => setLucePowerKw(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Costo Attuale Materia (€/kWh)
                      </label>
                      <input
                        type="number"
                        min="0.05"
                        max="0.80"
                        step="0.005"
                        value={luceUnitCost}
                        onChange={(e) => setLuceUnitCost(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Quota Fissa Commercializzazione (€/anno)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="300"
                        step="6"
                        value={luceFixedFee}
                        onChange={(e) => setLuceFixedFee(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Fornitura Gas */}
              <div className={`p-4 rounded-xl border transition-all ${
                enableGas ? 'bg-sky-50/30 border-sky-200 shadow-xs' : 'bg-slate-50/50 border-slate-200 opacity-80'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableGas}
                      onChange={(e) => setEnableGas(e.target.checked)}
                      className="rounded border-sky-300 text-sky-600 focus:ring-sky-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#0a2540]">
                      <Flame className="h-4 w-4 text-sky-500" />
                      <span>Fornitura Gas Naturale</span>
                    </div>
                  </label>

                  {enableGas && (
                    <button
                      type="button"
                      onClick={handleAutoGeneratePdr}
                      className="inline-flex items-center gap-1 text-[11px] text-[#635bff] font-semibold hover:underline cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      Auto-genera PDR demo
                    </button>
                  )}
                </div>

                {enableGas && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Codice PDR (14 cifre) *
                      </label>
                      <input
                        type="text"
                        value={gasPdr}
                        onChange={(e) => setGasPdr(e.target.value)}
                        placeholder="01234567890123"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Fornitore Attuale Gas
                      </label>
                      <input
                        type="text"
                        value={gasSupplier}
                        onChange={(e) => setGasSupplier(e.target.value)}
                        placeholder="Es. Eni Plenitude / Edison"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Consumo Annuo Stimato (Smc/anno)
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="10000"
                        step="50"
                        value={gasAnnualSmc}
                        onChange={(e) => setGasAnnualSmc(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Costo Attuale Materia Gas (€/Smc)
                      </label>
                      <input
                        type="number"
                        min="0.20"
                        max="2.50"
                        step="0.01"
                        value={gasUnitCost}
                        onChange={(e) => setGasUnitCost(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Quota Fissa Commercializzazione Gas (€/anno)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="250"
                        step="6"
                        value={gasFixedFee}
                        onChange={(e) => setGasFixedFee(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#e3e8ee]">
            {activeTab === 'forniture' ? (
              <button
                type="button"
                onClick={() => setActiveTab('anagrafica')}
                className="px-3.5 py-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[#425466] font-semibold cursor-pointer"
              >
                ← Indietro a Dati Anagrafici
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[#425466] font-semibold cursor-pointer"
              >
                Annulla
              </button>
            )}

            {activeTab === 'anagrafica' ? (
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    setError('Inserisci il nome del cliente prima di procedere.');
                    return;
                  }
                  if (!phone.trim() || phone.trim() === '+39') {
                    setError('Inserisci il recapito telefonico.');
                    return;
                  }
                  setError(null);
                  setActiveTab('forniture');
                }}
                className="px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-semibold shadow-xs cursor-pointer active:scale-[0.99] transition-all flex items-center gap-1.5"
              >
                <span>Avanti: Configura Forniture →</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-semibold shadow-xs cursor-pointer active:scale-[0.99] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isSubmitting ? 'Salvataggio in corso...' : 'Salva & Attiva Cliente'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

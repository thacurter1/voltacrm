import React, { useState, useRef } from 'react';
import { 
  Zap, 
  Flame, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sliders, 
  ArrowRight,
  ShieldCheck,
  Info,
  User,
  Users,
  Home,
  Check
} from 'lucide-react';
import { Customer, CustomerBill, UtilityPoint } from '../../types';
import { portalApi } from '../../api/portal';
import { 
  ComparisonInput, 
  UtilityType, 
  validateBillUploadFile,
  estimateLifestyleConsumption
} from '../../services/offerComparison';

export interface EnergyBillIntakeProps {
  customer: Customer;
  onUploaded: (bill: CustomerBill) => void;
  onManualInput: (input: ComparisonInput) => void;
  selectedUtilityType?: UtilityType;
}

export type IntakeMode = 'profile' | 'wizard' | 'upload' | 'manual';

export const EnergyBillIntake: React.FC<EnergyBillIntakeProps> = ({
  customer,
  onUploaded,
  onManualInput,
  selectedUtilityType = 'luce',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customerPoints = customer.utilityPoints || [];
  const hasProfilePoints = customerPoints.length > 0;
  const [activeMode, setActiveMode] = useState<IntakeMode>(() => (hasProfilePoints ? 'profile' : 'wizard'));
  const [utilityType, setUtilityType] = useState<UtilityType>(selectedUtilityType);

  // Wizard state (Stima da profilo casa)
  const [householdSize, setHouseholdSize] = useState<'single' | 'couple' | 'family'>('couple');
  const [hasHeatPumpOrAc, setHasHeatPumpOrAc] = useState<boolean>(false);
  const [hasElectricBoiler, setHasElectricBoiler] = useState<boolean>(false);
  const [hasInduction, setHasInduction] = useState<boolean>(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<CustomerBill | null>(null);

  // Manual input state
  const [manualConsumption, setManualConsumption] = useState<string>('');
  const [manualPowerKw, setManualPowerKw] = useState<string>('3.0');
  const [manualF1, setManualF1] = useState<string>('');
  const [manualF2, setManualF2] = useState<string>('');
  const [manualF3, setManualF3] = useState<string>('');
  const [manualUnitCost, setManualUnitCost] = useState<string>('');
  const [manualFixedFeeYear, setManualFixedFeeYear] = useState<string>('');
  const [manualSupplier, setManualSupplier] = useState<string>('');
  const [manualPricingType, setManualPricingType] = useState<'fixed' | 'indexed'>('fixed');

  const matchingPoints = customerPoints.filter((p) => p.type === utilityType);

  // Computed consumption for lifestyle wizard
  const estimatedConsumption = estimateLifestyleConsumption({
    householdSize,
    utilityType,
    hasHeatPumpOrAc: utilityType === 'luce' ? hasHeatPumpOrAc : false,
    hasElectricBoiler: utilityType === 'luce' ? hasElectricBoiler : false,
    hasInduction: utilityType === 'luce' ? hasInduction : false,
  });

  const handleWizardSubmit = () => {
    onManualInput({
      utilityType,
      annualConsumption: estimatedConsumption,
      powerKw: utilityType === 'luce' ? 3 : undefined,
      source: 'manual',
      asOf: 'Stima Abitudini Q1 2026',
    });
  };

  // Handle selecting an existing profile point directly
  const handleSelectExistingPoint = (point: UtilityPoint) => {
    if (!point.annualConsumption || point.annualConsumption <= 0) {
      setUtilityType(point.type);
      setActiveMode('manual');
      setUploadError('Questa fornitura non ha un consumo annuo registrato. Inseriscilo per confrontare le offerte.');
      return;
    }
    const input: ComparisonInput = {
      utilityType: point.type,
      annualConsumption: point.annualConsumption,
      powerKw: point.powerKw || 3,
      f1Kwh: point.f1Kwh,
      f2Kwh: point.f2Kwh,
      f3Kwh: point.f3Kwh,
      currentSupplier: point.currentSupplier,
      currentPricingType: (point.currentTariffType === 'fixed' ? 'fixed' : 'indexed'),
      currentUnitCost: point.currentUnitCost,
      currentFixedFeeYear: point.currentFixedFeeYear,
      source: 'account',
      asOf: undefined,
    };
    onManualInput(input);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadSuccess(null);

    const validation = validateBillUploadFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'File non valido.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  // Handle bill upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Seleziona prima un file da caricare.');
      return;
    }

    const validation = validateBillUploadFile(selectedFile);
    if (!validation.valid) {
      setUploadError(validation.error || 'File non valido.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadedBill = await portalApi.uploadBill({
        customerId: customer.id,
        file: selectedFile,
        fileName: selectedFile.name,
        utilityType,
        notes: `Caricata dal portale clienti per confronto ${utilityType.toUpperCase()}`,
      });

      setUploadSuccess(uploadedBill);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploaded(uploadedBill);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore imprevisto durante il caricamento del file.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle manual input form submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const annualConsumptionNum = parseFloat(manualConsumption.replace(',', '.'));
    if (isNaN(annualConsumptionNum) || annualConsumptionNum <= 0) {
      setUploadError('Inserisci un consumo annuo valido maggiore di zero.');
      return;
    }

    const unitCostNum = manualUnitCost ? parseFloat(manualUnitCost.replace(',', '.')) : undefined;
    const fixedFeeNum = manualFixedFeeYear ? parseFloat(manualFixedFeeYear.replace(',', '.')) : undefined;
    const powerKwNum = utilityType === 'luce' ? (parseFloat(manualPowerKw.replace(',', '.')) || 3) : undefined;
    const f1Num = manualF1 ? parseFloat(manualF1.replace(',', '.')) : undefined;
    const f2Num = manualF2 ? parseFloat(manualF2.replace(',', '.')) : undefined;
    const f3Num = manualF3 ? parseFloat(manualF3.replace(',', '.')) : undefined;

    const input: ComparisonInput = {
      utilityType,
      annualConsumption: annualConsumptionNum,
      powerKw: powerKwNum,
      f1Kwh: f1Num,
      f2Kwh: f2Num,
      f3Kwh: f3Num,
      currentSupplier: manualSupplier.trim() || undefined,
      currentPricingType: manualPricingType,
      currentUnitCost: unitCostNum && unitCostNum > 0 ? unitCostNum : undefined,
      currentFixedFeeYear: fixedFeeNum && fixedFeeNum >= 0 ? fixedFeeNum : undefined,
      source: 'manual',
      asOf: new Date().toISOString().split('T')[0],
    };

    setUploadError(null);
    onManualInput(input);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_rgba(10,37,64,0.04)]">
      {/* Utility Type Selector */}
      <div className="p-5 sm:p-7 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0a2540]">
              Quale fornitura vuoi confrontare?
            </h2>
            <p className="text-sm text-slate-600 mt-1">Puoi cambiare scelta prima di vedere i risultati.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto" role="group" aria-label="Tipo di fornitura">
            <button
              type="button"
              onClick={() => {
                setUtilityType('luce');
                setManualConsumption('');
              }}
              aria-pressed={utilityType === 'luce'}
              className={`min-h-[48px] px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                utilityType === 'luce'
                  ? 'bg-[#635bff] text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-[#635bff]'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Solo Luce</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUtilityType('gas');
                setManualConsumption('');
              }}
              aria-pressed={utilityType === 'gas'}
              className={`min-h-[48px] px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                utilityType === 'gas'
                  ? 'bg-[#635bff] text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:border-[#635bff]'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Solo Gas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Choice of data source: each option changes the form beneath it. */}
      <div className="p-5 sm:p-7 pb-0 sm:pb-0">
        <h3 className="text-lg font-bold text-[#0a2540] mb-3">Come vuoi iniziare?</h3>
        <div
          className={`grid grid-cols-1 ${hasProfilePoints ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}
          role="group"
          aria-label="Scegli i dati da usare"
        >
          {hasProfilePoints && (
            <button
              type="button"
              onClick={() => {
                setActiveMode('profile');
                setUploadError(null);
              }}
              aria-pressed={activeMode === 'profile'}
              className={`min-h-[82px] p-4 rounded-xl border-2 text-left transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                activeMode === 'profile' ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540]' : 'border-slate-200 text-slate-700 hover:border-[#635bff]'
              }`}
            >
              <span className="block text-sm font-bold">Usa la mia fornitura</span>
              <span className="block text-xs text-slate-600 mt-1">
                {matchingPoints.length} {matchingPoints.length === 1 ? 'fornitura disponibile' : 'forniture disponibili'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveMode('wizard');
              setUploadError(null);
            }}
            aria-pressed={activeMode === 'wizard'}
            className={`min-h-[82px] p-4 rounded-xl border-2 text-left transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
              activeMode === 'wizard' ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540]' : 'border-slate-200 text-slate-700 hover:border-[#635bff]'
            }`}
          >
            <span className="block text-sm font-bold">Stima da profilo casa</span>
            <span className="block text-xs text-slate-600 mt-1">Senza bolletta · Calcolo guidato</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('upload');
              setUploadError(null);
            }}
            aria-pressed={activeMode === 'upload'}
            className={`min-h-[82px] p-4 rounded-xl border-2 text-left transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
              activeMode === 'upload' ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540]' : 'border-slate-200 text-slate-700 hover:border-[#635bff]'
            }`}
          >
            <span className="block text-sm font-bold">Carica una bolletta</span>
            <span className="block text-xs text-slate-600 mt-1">PDF, JPG o PNG · max 10 MB</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('manual');
              setUploadError(null);
            }}
            aria-pressed={activeMode === 'manual'}
            className={`min-h-[82px] p-4 rounded-xl border-2 text-left transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
              activeMode === 'manual' ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540]' : 'border-slate-200 text-slate-700 hover:border-[#635bff]'
            }`}
          >
            <span className="block text-sm font-bold">Inserisci i consumi</span>
            <span className="block text-xs text-slate-600 mt-1">Se hai i dati già a portata di mano</span>
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {/* Mode 1: Existing Profile Point */}
        {activeMode === 'profile' && (
          <div className="space-y-4">
            {matchingPoints.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                <Info className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  Nessuna fornitura {utilityType.toUpperCase()} registrata attualmente nel tuo profilo.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveMode('wizard')}
                    className="px-4 py-2 bg-[#635bff] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#5851ea] transition cursor-pointer"
                  >
                    Stima profilo casa
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('upload')}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    Carica bolletta
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('manual')}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition cursor-pointer"
                  >
                    Inserisci a mano
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchingPoints.map((point) => (
                  <div
                    key={point.id}
                    className="border border-slate-200 rounded-xl p-5 hover:border-[#635bff] transition space-y-5 relative group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            point.type === 'luce'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {point.type === 'luce' ? <Zap className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                            {point.type === 'luce' ? 'POD · Fornitura luce' : 'PDR · Fornitura gas'}
                          </span>
                          <h4 className="text-sm font-mono font-bold text-[#0a2540] break-all">
                            {point.podOrPdr}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Profilo
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600 bg-slate-50 p-4 rounded-lg">
                      <div>
                        <span className="text-xs text-slate-600 block">Consumo annuo</span>
                        <span className="font-bold text-slate-900">
                          {point.annualConsumption || 0} {point.type === 'luce' ? 'kWh' : 'Smc'}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-600 block">Fornitore attuale</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {point.currentSupplier || 'Non specificato'}
                        </span>
                      </div>
                      {point.currentUnitCost !== undefined && (
                        <div>
                          <span className="text-xs text-slate-600 block">Prezzo materia prima</span>
                          <span className="font-bold text-slate-900">
                            {point.currentUnitCost.toFixed(4)} {point.type === 'luce' ? '€/kWh' : '€/Smc'}
                          </span>
                        </div>
                      )}
                      {point.currentFixedFeeYear !== undefined && (
                        <div>
                          <span className="text-xs text-slate-600 block">Quota fissa</span>
                          <span className="font-bold text-slate-900">
                            {point.currentFixedFeeYear} €/anno
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectExistingPoint(point)}
                      className="w-full min-h-[48px] py-2 px-3 bg-[#635bff] hover:bg-[#5851ea] text-white text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Usa questi dati per il confronto</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode: Wizard (Stima da profilo casa) */}
        {activeMode === 'wizard' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Info className="w-4 h-4 text-[#635bff]" />
                <span>Stima guidata basata sul tuo stile di vita</span>
              </div>
              <p>
                Non hai la bolletta a portata di mano? Seleziona il numero di persone in casa e gli elettrodomestici principali per ottenere una stima affidabile dei consumi annuali {utilityType === 'luce' ? 'elettrici' : 'del gas'}.
              </p>
            </div>

            {/* Household size selection */}
            <div className="space-y-2.5">
              <label className="block text-sm font-bold text-[#0a2540]">
                Quante persone vivono nell'abitazione?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4" role="radiogroup" aria-label="Componenti nucleo familiare">
                {/* Single */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={householdSize === 'single'}
                  onClick={() => setHouseholdSize('single')}
                  className={`min-h-[88px] p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                    householdSize === 'single'
                      ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-[#635bff]/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        householdSize === 'single' ? 'bg-[#635bff] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    {householdSize === 'single' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#635bff]/10 text-[#635bff]">
                        Selezionato
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-[#0a2540]">1 Persona</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Base {utilityType === 'luce' ? '1.500 kWh' : '600 Smc'}
                    </span>
                  </div>
                </button>

                {/* Couple */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={householdSize === 'couple'}
                  onClick={() => setHouseholdSize('couple')}
                  className={`min-h-[88px] p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                    householdSize === 'couple'
                      ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-[#635bff]/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        householdSize === 'couple' ? 'bg-[#635bff] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    {householdSize === 'couple' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#635bff]/10 text-[#635bff]">
                        Selezionato
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-[#0a2540]">Coppia</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Base {utilityType === 'luce' ? '2.400 kWh' : '950 Smc'}
                    </span>
                  </div>
                </button>

                {/* Family */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={householdSize === 'family'}
                  onClick={() => setHouseholdSize('family')}
                  className={`min-h-[88px] p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                    householdSize === 'family'
                      ? 'border-[#635bff] bg-[#f3f1ff] text-[#0a2540] shadow-xs'
                      : 'border-slate-200 bg-white hover:border-[#635bff]/50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        householdSize === 'family' ? 'bg-[#635bff] text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Home className="w-4 h-4" />
                    </div>
                    {householdSize === 'family' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#635bff]/10 text-[#635bff]">
                        Selezionato
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="block text-sm font-bold text-[#0a2540]">Famiglia (3+)</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Base {utilityType === 'luce' ? '3.400 kWh' : '1.300 Smc'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Appliance toggles (when utilityType === 'luce') */}
            {utilityType === 'luce' && (
              <div className="space-y-3 pt-1">
                <div>
                  <span className="block text-sm font-bold text-[#0a2540]">
                    Elettrodomestici ad alto assorbimento
                  </span>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Seleziona gli apparecchi presenti in casa per affinare la stima del consumo annuo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5" role="group" aria-label="Elettrodomestici ad alto assorbimento">
                  <button
                    type="button"
                    onClick={() => setHasHeatPumpOrAc(!hasHeatPumpOrAc)}
                    aria-pressed={hasHeatPumpOrAc}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                      hasHeatPumpOrAc
                        ? 'border-[#635bff] bg-[#f3f1ff] text-[#635bff] font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#635bff]/50'
                    }`}
                  >
                    {hasHeatPumpOrAc ? (
                      <Check className="w-4 h-4 text-[#635bff]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                    <span>Climatizzatore / Pompa di calore</span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      +400 kWh
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasElectricBoiler(!hasElectricBoiler)}
                    aria-pressed={hasElectricBoiler}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                      hasElectricBoiler
                        ? 'border-[#635bff] bg-[#f3f1ff] text-[#635bff] font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#635bff]/50'
                    }`}
                  >
                    {hasElectricBoiler ? (
                      <Check className="w-4 h-4 text-[#635bff]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                    <span>Scaldabagno elettrico</span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      +800 kWh
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasInduction(!hasInduction)}
                    aria-pressed={hasInduction}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-2 border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#635bff] ${
                      hasInduction
                        ? 'border-[#635bff] bg-[#f3f1ff] text-[#635bff] font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#635bff]/50'
                    }`}
                  >
                    {hasInduction ? (
                      <Check className="w-4 h-4 text-[#635bff]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                    )}
                    <span>Piano a induzione</span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      +350 kWh
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Real-time calculation card and CTA */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Stima Consumo Annuo
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Stima Abitudini Q1 2026
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-[#0a2540]">
                    {estimatedConsumption.toLocaleString('it-IT')}
                  </span>
                  <span className="text-base font-bold text-slate-600">
                    {utilityType === 'luce' ? 'kWh/anno' : 'Smc/anno'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {utilityType === 'luce'
                    ? `Profilo ${householdSize === 'single' ? '1 persona' : householdSize === 'couple' ? 'coppia' : 'famiglia'}${
                        (hasHeatPumpOrAc || hasElectricBoiler || hasInduction)
                          ? ` con elettrodomestici extra (+${
                              (hasHeatPumpOrAc ? 400 : 0) +
                              (hasElectricBoiler ? 800 : 0) +
                              (hasInduction ? 350 : 0)
                            } kWh)`
                          : ''
                      }`
                    : `Profilo standard ${householdSize === 'single' ? '1 persona' : householdSize === 'couple' ? 'coppia' : 'famiglia'} (riscaldamento + cottura cibi)`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleWizardSubmit}
                className="min-h-[44px] px-6 py-3 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <span>Confronta offerte con questa stima</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Mode 2: Real Upload via portalApi.uploadBill */}
        {activeMode === 'upload' && (
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-[#635bff]" />
                <span>Caricamento Sicuro della Bolletta</span>
              </div>
              <p>
                Carica l'ultima fattura per la tua fornitura <strong>{utilityType.toUpperCase()}</strong>.
                Formati ammessi: <strong>PDF, JPG, PNG</strong>. Dimensione massima: <strong>10 MB</strong>.
              </p>
              <p className="text-[11px] text-slate-500">
                La bolletta viene salvata nel tuo archivio protetto e contrassegnata come <em>In verifica</em>. Non vengono attivati contratti o mandati automatici.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Seleziona il file da caricare:
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                disabled={isUploading}
                className="block w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#635bff]/10 file:text-[#635bff] hover:file:bg-[#635bff]/20 cursor-pointer"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-[#635bff] shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">{selectedFile.name}</span>
                  <span className="text-slate-400 text-[10px]">
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-red-500 font-bold hover:underline cursor-pointer ml-2"
                >
                  Rimuovi
                </button>
              </div>
            )}

            {uploadError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Bolletta caricata con successo ({uploadSuccess.fileName}).
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Stato attuale: <strong>In verifica</strong> dal team Volta. Nel frattempo puoi confrontare le offerte utilizzando i dati manuali o quelli del tuo profilo.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] disabled:bg-slate-300 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Caricamento in corso...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Conferma e Salva Bolletta</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Mode 3: Manual Input */}
        {activeMode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {uploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="annual-consumption" className="block text-sm font-semibold text-slate-700 mb-1">
                  Consumo Annuo Stimato ({utilityType === 'luce' ? 'kWh' : 'Smc'}) *
                </label>
                <input
                  id="annual-consumption"
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={manualConsumption}
                  onChange={(e) => setManualConsumption(e.target.value)}
                  placeholder={utilityType === 'luce' ? 'es. 2700' : 'es. 1000'}
                  className="w-full min-h-[48px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/30"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Media nazionale: {utilityType === 'luce' ? '~2.700 kWh/anno' : '~1.000 Smc/anno'}
                </span>
              </div>

              {utilityType === 'luce' && (
                <div>
                  <label htmlFor="power-kw" className="block text-sm font-semibold text-slate-700 mb-1">
                    Potenza Impegnata (kW)
                  </label>
                  <input
                    id="power-kw"
                    type="number"
                    step="0.5"
                    min="1"
                    max="50"
                    value={manualPowerKw}
                    onChange={(e) => setManualPowerKw(e.target.value)}
                    placeholder="es. 3.0"
                    className="w-full min-h-[48px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/30"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Residenziale tipico: 3.0 kW (o 4.5 kW)
                  </span>
                </div>
              )}

              <div>
                <label htmlFor="current-supplier" className="block text-sm font-semibold text-slate-700 mb-1">
                  Fornitore Attuale (facoltativo)
                </label>
                <input
                  id="current-supplier"
                  type="text"
                  value={manualSupplier}
                  onChange={(e) => setManualSupplier(e.target.value)}
                  placeholder="es. Enel, Eni, A2A, Hera"
                  className="w-full min-h-[48px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/30"
                />
              </div>

              <div>
                <label htmlFor="current-unit-cost" className="block text-sm font-semibold text-slate-700 mb-1">
                  Costo Materia Prima Attuale ({utilityType === 'luce' ? '€/kWh' : '€/Smc'})
                </label>
                <input
                  id="current-unit-cost"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={manualUnitCost}
                  onChange={(e) => setManualUnitCost(e.target.value)}
                  placeholder={utilityType === 'luce' ? 'es. 0.1850' : 'es. 0.5500'}
                  className="w-full min-h-[48px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/30"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Necessario per calcolare il risparmio personalizzato
                </span>
              </div>

              <div>
                <label htmlFor="current-fixed-fee" className="block text-sm font-semibold text-slate-700 mb-1">
                  Quota Fissa Annuale (€/anno)
                </label>
                <input
                  id="current-fixed-fee"
                  type="number"
                  step="1"
                  min="0"
                  value={manualFixedFeeYear}
                  onChange={(e) => setManualFixedFeeYear(e.target.value)}
                  placeholder="es. 120"
                  className="w-full min-h-[48px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/30"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Commercializzazione e vendita (€/anno)
                </span>
              </div>

              <div>
                <label htmlFor="current-pricing-type" className="block text-sm font-semibold text-slate-700 mb-1">
                  Tipologia Tariffa Attuale
                </label>
                <select
                  id="current-pricing-type"
                  value={manualPricingType}
                  onChange={(e) => setManualPricingType(e.target.value as 'fixed' | 'indexed')}
                  className="w-full min-h-[48px] px-3 py-2 bg-white border border-slate-300 rounded-xl text-base text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-2 focus:ring-[#635bff]/30"
                >
                  <option value="fixed">Prezzo Fisso</option>
                  <option value="indexed">Prezzo Indicizzato (PUN / PSV)</option>
                </select>
              </div>
            </div>

            {/* Optional time bands for electricity */}
            {utilityType === 'luce' && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Ripartizione fasce orarie kWh (facoltativa per stime avanzate F1/F2/F3)
                </span>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  <div>
                    <label htmlFor="manual-f1" className="block text-sm font-semibold text-slate-600 mb-1">F1 (Picco)</label>
                    <input
                      id="manual-f1"
                      type="number"
                      value={manualF1}
                      onChange={(e) => setManualF1(e.target.value)}
                      placeholder="kWh"
                      className="w-full min-h-11 px-3 py-2 bg-white border border-slate-300 rounded-lg text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="manual-f2" className="block text-sm font-semibold text-slate-600 mb-1">F2 (Intermedia)</label>
                    <input
                      id="manual-f2"
                      type="number"
                      value={manualF2}
                      onChange={(e) => setManualF2(e.target.value)}
                      placeholder="kWh"
                      className="w-full min-h-11 px-3 py-2 bg-white border border-slate-300 rounded-lg text-base"
                    />
                  </div>
                  <div>
                    <label htmlFor="manual-f3" className="block text-sm font-semibold text-slate-600 mb-1">F3 (Fuori picco)</label>
                    <input
                      id="manual-f3"
                      type="number"
                      value={manualF3}
                      onChange={(e) => setManualF3(e.target.value)}
                      placeholder="kWh"
                      className="w-full min-h-11 px-3 py-2 bg-white border border-slate-300 rounded-lg text-base"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Sliders className="w-4 h-4" />
              <span>Confronta le offerte con questi dati</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

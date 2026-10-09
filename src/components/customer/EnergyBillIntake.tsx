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
  Info
} from 'lucide-react';
import { Customer, CustomerBill, UtilityPoint } from '../../types';
import { portalApi } from '../../api/portal';
import { 
  ComparisonInput, 
  UtilityType, 
  validateBillUploadFile 
} from '../../services/offerComparison';

export interface EnergyBillIntakeProps {
  customer: Customer;
  onUploaded: (bill: CustomerBill) => void;
  onManualInput: (input: ComparisonInput) => void;
  selectedUtilityType?: UtilityType;
}

export const EnergyBillIntake: React.FC<EnergyBillIntakeProps> = ({
  customer,
  onUploaded,
  onManualInput,
  selectedUtilityType = 'luce',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMode, setActiveMode] = useState<'profile' | 'upload' | 'manual'>('profile');
  const [utilityType, setUtilityType] = useState<UtilityType>(selectedUtilityType);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<CustomerBill | null>(null);

  // Manual input state
  const [manualConsumption, setManualConsumption] = useState<string>('2700');
  const [manualPowerKw, setManualPowerKw] = useState<string>('3.0');
  const [manualF1, setManualF1] = useState<string>('');
  const [manualF2, setManualF2] = useState<string>('');
  const [manualF3, setManualF3] = useState<string>('');
  const [manualUnitCost, setManualUnitCost] = useState<string>('');
  const [manualFixedFeeYear, setManualFixedFeeYear] = useState<string>('');
  const [manualSupplier, setManualSupplier] = useState<string>('');
  const [manualPricingType, setManualPricingType] = useState<'fixed' | 'indexed'>('fixed');

  const customerPoints = customer.utilityPoints || [];
  const matchingPoints = customerPoints.filter((p) => p.type === utilityType);

  // Handle selecting an existing profile point directly
  const handleSelectExistingPoint = (point: UtilityPoint) => {
    const input: ComparisonInput = {
      utilityType: point.type,
      annualConsumption: point.annualConsumption || (point.type === 'luce' ? 2700 : 1000),
      powerKw: point.powerKw || 3,
      f1Kwh: point.f1Kwh,
      f2Kwh: point.f2Kwh,
      f3Kwh: point.f3Kwh,
      currentSupplier: point.currentSupplier,
      currentPricingType: (point.currentTariffType === 'fixed' ? 'fixed' : 'indexed'),
      currentUnitCost: point.currentUnitCost,
      currentFixedFeeYear: point.currentFixedFeeYear,
      source: 'account',
      asOf: new Date().toISOString().split('T')[0],
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Utility Type Selector */}
      <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#635bff]">
              Passo 1: Seleziona Fornitura
            </span>
            <h3 className="text-lg font-black text-[#0a2540] mt-0.5">
              Cosa desideri confrontare oggi?
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUtilityType('luce');
                if (manualConsumption === '1000') setManualConsumption('2700');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                utilityType === 'luce'
                  ? 'bg-[#635bff] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Solo Luce</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setUtilityType('gas');
                if (manualConsumption === '2700') setManualConsumption('1000');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                utilityType === 'gas'
                  ? 'bg-[#635bff] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>Solo Gas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold bg-white px-4 sm:px-6 pt-3 gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={() => {
            setActiveMode('profile');
            setUploadError(null);
          }}
          className={`pb-3 relative transition cursor-pointer shrink-0 ${
            activeMode === 'profile' ? 'text-[#635bff]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>La mia fornitura registrata ({matchingPoints.length})</span>
          {activeMode === 'profile' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#635bff] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode('upload');
            setUploadError(null);
          }}
          className={`pb-3 relative transition cursor-pointer shrink-0 ${
            activeMode === 'upload' ? 'text-[#635bff]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Carica bolletta (PDF, JPG, PNG)</span>
          {activeMode === 'upload' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#635bff] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode('manual');
            setUploadError(null);
          }}
          className={`pb-3 relative transition cursor-pointer shrink-0 ${
            activeMode === 'manual' ? 'text-[#635bff]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Inserisci consumi a mano</span>
          {activeMode === 'manual' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#635bff] rounded-full" />
          )}
        </button>
      </div>

      <div className="p-4 sm:p-6">
        {/* Mode 1: Existing Profile Point */}
        {activeMode === 'profile' && (
          <div className="space-y-4">
            {matchingPoints.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                <Info className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-medium">
                  Nessuna fornitura {utilityType.toUpperCase()} registrata attualmente nel tuo profilo.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveMode('upload')}
                    className="px-4 py-2 bg-[#635bff] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#5851ea] transition cursor-pointer"
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
                    className="border border-slate-200 rounded-xl p-4 hover:border-[#635bff] transition space-y-3 relative group"
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
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            Punto di Prelievo
                          </span>
                          <h4 className="text-xs font-mono font-black text-[#0a2540]">
                            {point.podOrPdr}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Profilo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Consumo Annuo</span>
                        <span className="font-bold text-slate-900">
                          {point.annualConsumption || 0} {point.type === 'luce' ? 'kWh' : 'Smc'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Fornitore Attuale</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {point.currentSupplier || 'Non specificato'}
                        </span>
                      </div>
                      {point.currentUnitCost !== undefined && (
                        <div>
                          <span className="text-[10px] text-slate-400 block">Costo Materia Prima</span>
                          <span className="font-bold text-slate-900">
                            {point.currentUnitCost.toFixed(4)} {point.type === 'luce' ? '€/kWh' : '€/Smc'}
                          </span>
                        </div>
                      )}
                      {point.currentFixedFeeYear !== undefined && (
                        <div>
                          <span className="text-[10px] text-slate-400 block">Quota Fissa</span>
                          <span className="font-bold text-slate-900">
                            {point.currentFixedFeeYear} €/anno
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectExistingPoint(point)}
                      className="w-full py-2 px-3 bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Consumo Annuo Stimato ({utilityType === 'luce' ? 'kWh' : 'Smc'}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={manualConsumption}
                  onChange={(e) => setManualConsumption(e.target.value)}
                  placeholder={utilityType === 'luce' ? 'es. 2700' : 'es. 1000'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Media nazionale: {utilityType === 'luce' ? '~2.700 kWh/anno' : '~1.000 Smc/anno'}
                </span>
              </div>

              {utilityType === 'luce' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Potenza Impegnata (kW)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="50"
                    value={manualPowerKw}
                    onChange={(e) => setManualPowerKw(e.target.value)}
                    placeholder="es. 3.0"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Residenziale tipico: 3.0 kW (o 4.5 kW)
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fornitore Attuale (facoltativo)
                </label>
                <input
                  type="text"
                  value={manualSupplier}
                  onChange={(e) => setManualSupplier(e.target.value)}
                  placeholder="es. Enel, Eni, A2A, Hera"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Costo Materia Prima Attuale ({utilityType === 'luce' ? '€/kWh' : '€/Smc'})
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={manualUnitCost}
                  onChange={(e) => setManualUnitCost(e.target.value)}
                  placeholder={utilityType === 'luce' ? 'es. 0.1850' : 'es. 0.5500'}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Necessario per calcolare il risparmio personalizzato
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quota Fissa Annuale (€/anno)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={manualFixedFeeYear}
                  onChange={(e) => setManualFixedFeeYear(e.target.value)}
                  placeholder="es. 120"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Commercializzazione e vendita (€/anno)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipologia Tariffa Attuale
                </label>
                <select
                  value={manualPricingType}
                  onChange={(e) => setManualPricingType(e.target.value as 'fixed' | 'indexed')}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff]"
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
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">F1 (Picco)</label>
                    <input
                      type="number"
                      value={manualF1}
                      onChange={(e) => setManualF1(e.target.value)}
                      placeholder="kWh"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">F2 (Intermedia)</label>
                    <input
                      type="number"
                      value={manualF2}
                      onChange={(e) => setManualF2(e.target.value)}
                      placeholder="kWh"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">F3 (Fuori picco)</label>
                    <input
                      type="number"
                      value={manualF3}
                      onChange={(e) => setManualF3(e.target.value)}
                      placeholder="kWh"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
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

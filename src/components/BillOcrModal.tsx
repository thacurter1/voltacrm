import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  X,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  FileUp,
  Zap
} from 'lucide-react';
import { BillOcrResult, Customer } from '../types';
import { api } from '../api/client';
import { securityValidator } from '../services/securityValidator';

interface BillOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCustomer: (customer: Customer) => void;
}

const SAMPLE_BILLS: BillOcrResult[] = [
  {
    fileName: 'Bolletta_Enel_Energia_Luce_Residenziale.pdf',
    utilityType: 'luce',
    podOrPdr: 'IT001E99882233',
    supplier: 'Enel Energia (Tariffa Bloccata 2024)',
    customerName: 'Claudio Marchi',
    fiscalCode: 'MRCCLD79H12F205K',
    annualConsumption: 3800,
    f1Kwh: 1400,
    f2Kwh: 1200,
    f3Kwh: 1200,
    powerKw: 4.5,
    rawCostTotal: 840.0,
    currentUnitCost: 0.195,
    currentFixedFeeYear: 144.0,
    estimatedSavingEur: 215.0,
    confidenceScore: 99.2,
  },
  {
    fileName: 'Fattura_Gas_Eni_Plenitude_Casa.pdf',
    utilityType: 'gas',
    podOrPdr: '02581900112233',
    supplier: 'Eni Plenitude Gas',
    customerName: 'Federica Morelli',
    fiscalCode: 'MRLFDR85T45H501Y',
    annualConsumption: 1250,
    rawCostTotal: 680.0,
    currentUnitCost: 0.58,
    currentFixedFeeYear: 120.0,
    estimatedSavingEur: 148.0,
    confidenceScore: 98.6,
  },
  {
    fileName: 'Estratto_Acea_PMI_Business_Trifase.pdf',
    utilityType: 'luce',
    podOrPdr: 'IT001E77665544',
    supplier: 'Acea Business Relax',
    customerName: 'Officina Meccanica Valenti Srl',
    fiscalCode: '08765430582',
    annualConsumption: 22000,
    f1Kwh: 10000,
    f2Kwh: 6500,
    f3Kwh: 5500,
    powerKw: 15.0,
    rawCostTotal: 4120.0,
    currentUnitCost: 0.185,
    currentFixedFeeYear: 240.0,
    estimatedSavingEur: 790.0,
    confidenceScore: 99.7,
  }
];

export const BillOcrModal: React.FC<BillOcrModalProps> = ({
  isOpen,
  onClose,
  onImportCustomer,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedSample, setSelectedSample] = useState<BillOcrResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<BillOcrResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    if (!file) return;

    const validation = await securityValidator.validateFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Formato non supportato o file non valido (ammessi PDF, JPG, PNG, WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('La dimensione del file supera il limite massimo consentito di 15MB.');
      return;
    }

    setErrorMessage(null);
    setIsScanning(true);
    setSelectedSample(null);
    setScanResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Url = (reader.result as string) || '';
          const base64Data = base64Url.split(',')[1] || '';
          const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          const result = await api.ocr.analyzeBill({
            fileName: file.name,
            mimeType,
            base64Data,
          });

          setScanResult(result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setErrorMessage(`Errore durante l'analisi OCR: ${msg}`);
        } finally {
          setIsScanning(false);
        }
      };

      reader.onerror = () => {
        setErrorMessage('Impossibile leggere il file locale selezionato.');
        setIsScanning(false);
      };

      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Errore inatteso: ${msg}`);
      setIsScanning(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleRunScan = (bill: BillOcrResult) => {
    setSelectedSample(bill);
    setErrorMessage(null);
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      setScanResult(bill);
    }, 1000);
  };

  const handleConfirmImport = () => {
    if (!scanResult) return;

    const today = new Date();
    const nextAudit = new Date();
    nextAudit.setDate(today.getDate() + 120);

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: scanResult.customerName,
      fiscalCode: scanResult.fiscalCode,
      phone: '+39 33' + Math.floor(10000000 + Math.random() * 90000000),
      email: scanResult.customerName.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@email.it',
      city: 'Milano (MI)',
      contractStartDate: today.toISOString().split('T')[0],
      lastSwitchAuditDate: today.toISOString().split('T')[0],
      nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
      accountManager: 'Alessandro Mori (Energy Specialist)',
      hasBrokerageMandate: true,
      utilityPoints: [
        {
          id: `util-${Date.now()}-${scanResult.utilityType}`,
          type: scanResult.utilityType,
          podOrPdr: scanResult.podOrPdr,
          annualConsumption: scanResult.annualConsumption,
          powerKw: scanResult.utilityType === 'luce' ? (scanResult.powerKw || 4.5) : undefined,
          f1Kwh: scanResult.f1Kwh,
          f2Kwh: scanResult.f2Kwh,
          f3Kwh: scanResult.f3Kwh,
          currentSupplier: scanResult.supplier,
          currentOfferName: scanResult.period ? `Offerta rilevata (${scanResult.period})` : 'Tariffa Rilevata da Bolletta',
          currentTariffType: scanResult.f1Kwh ? 'indexed' : 'fixed',
          currentUnitCost: scanResult.currentUnitCost || (scanResult.utilityType === 'luce' ? 0.168 : 0.54),
          currentFixedFeeYear: scanResult.currentFixedFeeYear || 120.0,
        }
      ],
      notes: `Importato da scansione OCR Vision AI: ${scanResult.fileName}. Risparmio stimato di €${scanResult.estimatedSavingEur.toFixed(2)}/anno.`
    };

    onImportCustomer(newCustomer);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex items-center justify-center">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs transition-opacity" 
      />

      <div className="relative w-full max-w-2xl bg-white rounded-xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#635bff] uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              Gemini Vision AI • ARERA Parser
            </span>
            <h3 className="text-lg font-bold text-[#0a2540] mt-0.5">
              Analisi & Estrazione Automatica Bolletta
            </h3>
            <p className="text-xs text-[#425466]">
              Carica una bolletta PDF o immagine: Gemini Vision AI estrae automaticamente POD/PDR, consumi, fornitore e potenziale di risparmio.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileInputChange} 
          accept="application/pdf,image/png,image/jpeg,image/webp" 
          className="hidden" 
        />

        {/* Error message alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dropzone & Sample Picker */}
        <div className="space-y-3 text-xs">
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              dragActive 
                ? 'border-[#635bff] bg-indigo-50/50 scale-[1.01]' 
                : 'border-[#e3e8ee] bg-[#f8fafc] hover:border-[#635bff] hover:bg-slate-50'
            }`}
          >
            <UploadCloud className={`h-8 w-8 mx-auto mb-2 transition-colors ${dragActive ? 'text-[#635bff] animate-bounce' : 'text-[#635bff]'}`} />
            <span className="font-semibold text-[#0a2540] block">
              Trascina qui la bolletta PDF o immagine oppure clicca per scegliere
            </span>
            <span className="text-[11px] text-[#425466] block mt-1">
              Formati supportati: PDF, JPG, PNG, WebP (Max 15MB)
            </span>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e3e8ee] rounded-md text-[11px] font-semibold text-[#0a2540] shadow-2xs hover:border-[#635bff]">
              <FileUp className="h-3.5 w-3.5 text-[#635bff]" />
              Sfoglia File dal Computer
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-[#425466] uppercase tracking-wider block">
              Oppure testa una bolletta campione:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SAMPLE_BILLS.map((bill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunScan(bill)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                    selectedSample?.fileName === bill.fileName
                      ? 'bg-indigo-50/70 border-[#635bff] text-[#0a2540] ring-1 ring-[#635bff]'
                      : 'bg-white border-[#e3e8ee] text-[#425466] hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-[#0a2540] text-[11px] truncate">
                    <FileText className="h-3.5 w-3.5 text-[#635bff] shrink-0" />
                    <span className="truncate">{bill.customerName}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono block mt-1">
                    {bill.utilityType.toUpperCase()} • {bill.annualConsumption.toLocaleString()} {bill.utilityType === 'luce' ? 'kWh' : 'Smc'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scanning progress */}
        {isScanning && (
          <div className="p-8 rounded-xl bg-slate-50 border border-[#e3e8ee] text-center space-y-3">
            <RefreshCw className="h-6 w-6 text-[#635bff] animate-spin mx-auto" />
            <span className="text-xs font-semibold text-[#0a2540] block">
              Analisi OCR con Vision AI in corso...
            </span>
            <p className="text-[11px] text-[#425466]">Rilevazione codice POD/PDR, spesa materia energia e curve di consumo.</p>
          </div>
        )}

        {/* Result Box */}
        {scanResult && !isScanning && (
          <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] space-y-4 shadow-xs text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-[#0a2540]">Dati Estratti con Successo</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Accuratezza OCR {scanResult.confidenceScore}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-[#425466] block">Intestatario</span>
                <span className="font-bold text-[#0a2540] truncate block">{scanResult.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#425466] block">Codice Fiscale</span>
                <span className="font-mono font-semibold text-[#0a2540]">{scanResult.fiscalCode}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#425466] block">Fornitore Rilevato</span>
                <span className="font-medium text-[#0a2540] truncate block">{scanResult.supplier}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#425466] block">POD / PDR</span>
                <span className="font-mono font-bold text-[#635bff]">{scanResult.podOrPdr}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#425466] block">Consumo Annuo</span>
                <span className="font-mono font-bold text-[#0a2540]">
                  {scanResult.annualConsumption.toLocaleString()} {scanResult.utilityType === 'luce' ? 'kWh' : 'Smc'}
                </span>
              </div>
              {scanResult.utilityType === 'luce' && scanResult.f1Kwh !== undefined && (
                <div>
                  <span className="text-[10px] text-[#425466] block">Fasce F1 / F2 / F3</span>
                  <span className="font-mono text-[11px] text-[#0a2540]">
                    {scanResult.f1Kwh} / {scanResult.f2Kwh} / {scanResult.f3Kwh} kWh
                  </span>
                </div>
              )}
              {scanResult.powerKw !== undefined && (
                <div>
                  <span className="text-[10px] text-[#425466] block">Potenza Impegnata</span>
                  <span className="font-mono text-[11px] text-[#0a2540] flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    {scanResult.powerKw} kW
                  </span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-[#425466] block">Spesa Fattura</span>
                <span className="font-mono font-semibold text-[#0a2540]">
                  € {scanResult.rawCostTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Savings Callout */}
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                  Risparmio Rilevato rispetto al Mercato Attuale
                </span>
                <span className="text-base font-bold text-emerald-700 font-mono">
                  € {scanResult.estimatedSavingEur.toFixed(2)} / anno
                </span>
              </div>
              <button
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.99] transition-all"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Crea Cliente & Attiva Switch 120gg
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-[#e3e8ee]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[#425466] text-xs font-medium cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

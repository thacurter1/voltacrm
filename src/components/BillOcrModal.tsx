import React, { useState } from 'react';
import { 
  FileSearch, 
  UploadCloud, 
  CheckCircle2, 
  FileText, 
  Zap, 
  Flame, 
  Sparkles, 
  ArrowRight, 
  X,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { BillOcrResult, Customer } from '../types';

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
    rawCostTotal: 840.0,
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
    rawCostTotal: 4120.0,
    estimatedSavingEur: 790.0,
    confidenceScore: 99.7,
  }
];

export const BillOcrModal: React.FC<BillOcrModalProps> = ({
  isOpen,
  onClose,
  onImportCustomer,
}) => {
  const [selectedSample, setSelectedSample] = useState<BillOcrResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<BillOcrResult | null>(null);

  if (!isOpen) return null;

  const handleRunScan = (bill: BillOcrResult) => {
    setSelectedSample(bill);
    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      setScanResult(bill);
    }, 1200);
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
      email: scanResult.customerName.toLowerCase().replace(/\s+/g, '.') + '@email.it',
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
          powerKw: scanResult.utilityType === 'luce' ? 4.5 : undefined,
          f1Kwh: scanResult.f1Kwh,
          f2Kwh: scanResult.f2Kwh,
          f3Kwh: scanResult.f3Kwh,
          currentSupplier: scanResult.supplier,
          currentOfferName: 'Tariffa Rilevata da Bolletta',
          currentTariffType: 'fixed',
          currentUnitCost: scanResult.utilityType === 'luce' ? 0.168 : 0.54,
          currentFixedFeeYear: 120.0,
        }
      ],
      notes: `Importato da scansione OCR bolletta: ${scanResult.fileName}. Risparmio stimato di €${scanResult.estimatedSavingEur}/a.`
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
              OCR & Document AI
            </span>
            <h3 className="text-lg font-bold text-[#0a2540] mt-0.5">
              Analisi & Estrazione Automatica Bolletta
            </h3>
            <p className="text-xs text-[#425466]">
              Trascina una bolletta PDF per estrarre POD/PDR, consumi e fornitore attuale in pochi secondi.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dropzone & Sample Picker */}
        <div className="space-y-3 text-xs">
          <div className="border-2 border-dashed border-[#e3e8ee] rounded-xl p-6 text-center hover:border-[#635bff] transition-colors bg-[#f8fafc]">
            <UploadCloud className="h-8 w-8 text-[#635bff] mx-auto mb-2" />
            <span className="font-semibold text-[#0a2540] block">
              Trascina qui la bolletta PDF o immagine
            </span>
            <span className="text-[11px] text-[#425466]">Formati supportati: PDF, JPG, PNG (Max 15MB)</span>
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
                    {bill.utilityType.toUpperCase()} • {bill.annualConsumption} {bill.utilityType === 'luce' ? 'kWh' : 'Smc'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scanning progress or Result Box */}
        {isScanning && (
          <div className="p-8 rounded-xl bg-slate-50 border border-[#e3e8ee] text-center space-y-3">
            <RefreshCw className="h-6 w-6 text-[#635bff] animate-spin mx-auto" />
            <span className="text-xs font-semibold text-[#0a2540] block">
              Analisi OCR con Vision AI in corso...
            </span>
            <p className="text-[11px] text-[#425466]">Rilevazione codice POD/PDR, spesa materia energia e curve di consumo.</p>
          </div>
        )}

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
                <span className="font-bold text-[#0a2540]">{scanResult.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#425466] block">Codice Fiscale</span>
                <span className="font-mono font-semibold text-[#0a2540]">{scanResult.fiscalCode}</span>
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

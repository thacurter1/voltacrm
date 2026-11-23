import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Loader2, PencilLine, X } from 'lucide-react';
import { BillOcrResult, Customer } from '../types';
import { api } from '../api/client';
import { securityValidator } from '../services/securityValidator';
import { describeOcrFailure, toOcrFailure, type OcrFailure } from './ocr/ocrFailure';

interface BillOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCustomer: (customer: Customer) => void;
  /** Pre-filled result (e.g. a stored bill analysed from the inbox). */
  initialResult?: BillOcrResult | null;
  /** Failure from an analysis started elsewhere: the modal opens on manual entry. */
  initialError?: OcrFailure | null;
}

interface ReviewForm {
  utilityType: 'luce' | 'gas';
  customerName: string;
  fiscalCode: string;
  supplier: string;
  podOrPdr: string;
  annualConsumption: string;
  powerKw: string;
  f1Kwh: string;
  f2Kwh: string;
  f3Kwh: string;
  currentUnitCost: string;
  currentFixedFeeYear: string;
  rawCostTotal: string;
  period: string;
  phone: string;
  email: string;
  city: string;
}

const EMPTY_FORM: ReviewForm = {
  utilityType: 'luce', customerName: '', fiscalCode: '', supplier: '', podOrPdr: '',
  annualConsumption: '', powerKw: '', f1Kwh: '', f2Kwh: '', f3Kwh: '',
  currentUnitCost: '', currentFixedFeeYear: '', rawCostTotal: '', period: '',
  phone: '', email: '', city: '',
};

const str = (v: number | string | undefined) => (v === undefined || v === null ? '' : String(v));

function formFromResult(result: BillOcrResult): ReviewForm {
  return {
    ...EMPTY_FORM,
    utilityType: result.utilityType,
    customerName: str(result.customerName),
    fiscalCode: str(result.fiscalCode),
    supplier: str(result.supplier),
    podOrPdr: str(result.podOrPdr),
    annualConsumption: str(result.annualConsumption),
    powerKw: str(result.powerKw),
    f1Kwh: str(result.f1Kwh),
    f2Kwh: str(result.f2Kwh),
    f3Kwh: str(result.f3Kwh),
    currentUnitCost: str(result.currentUnitCost),
    currentFixedFeeYear: str(result.currentFixedFeeYear),
    rawCostTotal: str(result.rawCostTotal),
    period: str(result.period),
  };
}

function toNumber(value: string): number | undefined {
  const v = value.trim().replace(/\s/g, '');
  if (!v) return undefined;
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const FIELD_LABELS: Record<string, string> = {
  podOrPdr: 'POD / PDR', supplier: 'Fornitore', customerName: 'Intestatario', fiscalCode: 'Codice fiscale / P.IVA',
  annualConsumption: 'Consumo annuo', rawCostTotal: 'Totale bolletta', currentUnitCost: 'Prezzo materia energia', period: 'Periodo',
};

const inputCls =
  'mt-1 block w-full min-h-11 rounded-md border border-[#DCE5E8] bg-white px-3 text-sm text-[#0F222D] placeholder:text-[#6B7F8A] focus:border-[#0A6847] focus:outline-none focus:ring-2 focus:ring-[#0A6847]/20';
const monoCls = `${inputCls} font-mono tabular-nums`;

/** Mount it only while open (`{open && <BillOcrModal …/>}`) so each opening starts from its initial props. */
export const BillOcrModal: React.FC<BillOcrModalProps> = ({ isOpen, onClose, onImportCustomer, initialResult = null, initialError = null }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<BillOcrResult | null>(initialResult);
  const [failure, setFailure] = useState<OcrFailure | null>(initialError);
  const [fileError, setFileError] = useState<string | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(initialResult ? formFromResult(initialResult) : initialError ? { ...EMPTY_FORM } : null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    const validation = await securityValidator.validateFile(file);
    if (!validation.isValid) {
      setFileError(validation.error || 'Formato non supportato (ammessi PDF, JPG, PNG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Il file supera il limite di 10 MB.');
      return;
    }
    setFileError(null);
    setFailure(null);
    setResult(null);
    setForm(null);
    setIsScanning(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = String(reader.result || '').split(',')[1] || '';
        const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const extracted = await api.ocr.analyzeBill({ fileName: file.name, mimeType, base64Data });
        setResult(extracted);
        setForm(formFromResult(extracted));
      } catch (err) {
        const f = toOcrFailure(err);
        setFailure(f);
        setForm({ ...EMPTY_FORM, utilityType: /gas/i.test(file.name) ? 'gas' : 'luce' });
      } finally {
        setIsScanning(false);
      }
    };
    reader.onerror = () => {
      setFileError('Impossibile leggere il file selezionato.');
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileProcess(file);
  };

  const update = (key: keyof ReviewForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));

  const missing = new Set(result?.missingFields || []);
  const flag = (key: string) => (result && missing.has(key) ? ' border-[#9A4D09] bg-[#FFF8F0]' : '');

  const handleConfirmImport = () => {
    if (!form) return;
    const name = form.customerName.trim();
    const fiscalCode = form.fiscalCode.trim().toUpperCase();
    const podOrPdr = form.podOrPdr.trim().toUpperCase();
    const annualConsumption = toNumber(form.annualConsumption);
    const currentUnitCost = toNumber(form.currentUnitCost);
    const currentFixedFeeYear = toNumber(form.currentFixedFeeYear);
    const problems: string[] = [];
    if (name.length < 2) problems.push('intestatario');
    if (!/^(?:[A-Z0-9]{16}|\d{11})$/.test(fiscalCode)) problems.push('codice fiscale o P.IVA');
    if (!podOrPdr) problems.push(form.utilityType === 'luce' ? 'POD' : 'PDR');
    if (!annualConsumption) problems.push('consumo annuo');
    if (currentUnitCost === undefined) problems.push('prezzo materia energia');
    if (currentFixedFeeYear === undefined) problems.push('quota fissa annua');
    if (problems.length) {
      setFormError(`Completa prima: ${problems.join(', ')}.`);
      return;
    }
    setFormError(null);

    const today = new Date();
    const nextAudit = new Date();
    nextAudit.setDate(today.getDate() + 120);
    const isLuce = form.utilityType === 'luce';
    const source = result ? `lettura automatica (${result.model || 'OCR'}) verificata manualmente` : 'inserimento manuale da bolletta';

    onImportCustomer({
      id: `cust-${Date.now()}`,
      name,
      fiscalCode,
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      contractStartDate: today.toISOString().split('T')[0],
      lastSwitchAuditDate: today.toISOString().split('T')[0],
      nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
      accountManager: '',
      // A brokerage mandate requires the customer's signature: never assumed from a bill.
      hasBrokerageMandate: false,
      utilityPoints: [{
        id: `util-${Date.now()}-${form.utilityType}`,
        type: form.utilityType,
        podOrPdr,
        annualConsumption: annualConsumption as number,
        powerKw: isLuce ? toNumber(form.powerKw) : undefined,
        f1Kwh: isLuce ? toNumber(form.f1Kwh) : undefined,
        f2Kwh: isLuce ? toNumber(form.f2Kwh) : undefined,
        f3Kwh: isLuce ? toNumber(form.f3Kwh) : undefined,
        currentSupplier: form.supplier.trim(),
        currentOfferName: form.period.trim() ? `Offerta in bolletta (${form.period.trim()})` : 'Offerta in bolletta',
        currentTariffType: 'fixed',
        currentUnitCost: currentUnitCost as number,
        currentFixedFeeYear: currentFixedFeeYear as number,
      }],
      notes: `Dati da ${source}${result?.fileName ? `: ${result.fileName}` : ''}.`,
    });
    onClose();
  };

  const unit = form?.utilityType === 'gas' ? 'Smc' : 'kWh';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div onClick={onClose} className="fixed inset-0 bg-[#0F222D]/45" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-ocr-title"
        className="relative w-full max-w-2xl rounded-[12px] border border-[#DCE5E8] bg-white shadow-[0_25px_60px_rgba(15,34,45,0.18)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#DCE5E8] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 id="bill-ocr-title" className="text-lg font-bold text-[#0F222D]">Leggi una bolletta</h3>
            <p className="mt-1 text-sm text-[#445966]">
              Carica PDF o foto: i dati letti vanno sempre verificati prima di creare il cliente o avviare un confronto.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#445966] hover:bg-[#F6F9FA] cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileProcess(f); e.target.value = ''; }}
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
          />

          {!form && !isScanning && (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`rounded-[10px] border-2 border-dashed p-6 text-center transition-colors ${dragActive ? 'border-[#0A6847] bg-[#EAF4F0]' : 'border-[#DCE5E8] bg-[#F6F9FA]'}`}
            >
              <p className="text-sm font-semibold text-[#0F222D]">Trascina qui la bolletta oppure scegli un file</p>
              <p className="mt-1 text-[13px] text-[#445966]">PDF, JPG o PNG fino a 10 MB</p>
              <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#0A6847] px-5 text-sm font-bold text-white hover:bg-[#085238] cursor-pointer"
                >
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  Scegli file
                </button>
                <button
                  type="button"
                  onClick={() => { setResult(null); setFailure(null); setForm({ ...EMPTY_FORM }); }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-bold text-[#0A3B40] hover:bg-white cursor-pointer"
                >
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  Inserisci a mano
                </button>
              </div>
            </div>
          )}

          {fileError && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-[#F3C9C9] bg-[#FDF3F3] px-3 py-2.5 text-sm text-[#B91C1C]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {fileError}
            </p>
          )}

          {isScanning && (
            <div role="status" className="flex items-center gap-3 rounded-[10px] border border-[#DCE5E8] bg-[#F6F9FA] px-4 py-5 text-sm text-[#0F222D]">
              <Loader2 className="h-5 w-5 shrink-0 motion-safe:animate-spin text-[#0A6847]" aria-hidden="true" />
              Lettura del documento in corso. Di solito richiede meno di 30 secondi.
            </div>
          )}

          {failure && form && (
            <div role="alert" data-testid="ocr-manual-fallback" className="rounded-[10px] border border-[#E9CFA9] bg-[#FFF8F0] px-4 py-3 text-sm text-[#5C3206]">
              <p className="font-bold text-[#9A4D09]">Lettura automatica non disponibile</p>
              <p className="mt-1">{describeOcrFailure(failure)}</p>
            </div>
          )}

          {result && form && (
            <div data-testid="ocr-review-summary" className="rounded-[10px] border border-[#D5E6DF] bg-[#EAF4F0] px-4 py-3 text-sm text-[#0F222D]">
              <p className="flex items-center gap-2 font-bold text-[#0A6847]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Letti <span className="font-mono tabular-nums">{8 - missing.size}/8</span> campi principali
              </p>
              <p className="mt-1 text-[#445966]">
                {missing.size
                  ? <>Da completare: {[...missing].map((k) => FIELD_LABELS[k] || k).join(', ')}. I campi evidenziati non sono stati trovati nel documento.</>
                  : 'Controlla comunque ogni valore con la bolletta originale.'}
              </p>
              {result.model === 'demo' && <p className="mt-1 font-semibold text-[#9A4D09]">Dati dimostrativi: non provengono dal documento caricato.</p>}
            </div>
          )}

          {form && (
            <form onSubmit={(e) => { e.preventDefault(); handleConfirmImport(); }} className="space-y-5" noValidate>
              <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-bold text-[#0F222D]">Fornitura</legend>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Tipo
                  <select value={form.utilityType} onChange={update('utilityType')} className={inputCls}>
                    <option value="luce">Luce</option>
                    <option value="gas">Gas</option>
                  </select>
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  {form.utilityType === 'luce' ? 'POD' : 'PDR'}
                  <input value={form.podOrPdr} onChange={update('podOrPdr')} className={monoCls + flag('podOrPdr')} autoComplete="off" />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Fornitore attuale
                  <input value={form.supplier} onChange={update('supplier')} className={inputCls + flag('supplier')} />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Periodo fatturato
                  <input value={form.period} onChange={update('period')} className={inputCls + flag('period')} />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Consumo annuo ({unit})
                  <input inputMode="decimal" value={form.annualConsumption} onChange={update('annualConsumption')} className={monoCls + flag('annualConsumption')} />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Totale bolletta (€)
                  <input inputMode="decimal" value={form.rawCostTotal} onChange={update('rawCostTotal')} className={monoCls + flag('rawCostTotal')} />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Prezzo materia energia (€/{unit})
                  <input inputMode="decimal" value={form.currentUnitCost} onChange={update('currentUnitCost')} className={monoCls + flag('currentUnitCost')} />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Quota fissa (€/anno)
                  <input inputMode="decimal" value={form.currentFixedFeeYear} onChange={update('currentFixedFeeYear')} className={monoCls} />
                </label>
                {form.utilityType === 'luce' && (
                  <>
                    <label className="text-[13px] font-semibold text-[#445966]">
                      Potenza impegnata (kW)
                      <input inputMode="decimal" value={form.powerKw} onChange={update('powerKw')} className={monoCls} />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['f1Kwh', 'f2Kwh', 'f3Kwh'] as const).map((k, i) => (
                        <label key={k} className="text-[13px] font-semibold text-[#445966]">
                          F{i + 1} kWh
                          <input inputMode="decimal" value={form[k]} onChange={update(k)} className={monoCls} />
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>

              <fieldset className="grid grid-cols-1 gap-4 border-t border-[#DCE5E8] pt-5 sm:grid-cols-2">
                <legend className="sr-only">Intestatario</legend>
                <p className="text-sm font-bold text-[#0F222D] sm:col-span-2">Intestatario</p>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Nome e cognome / ragione sociale
                  <input value={form.customerName} onChange={update('customerName')} className={inputCls + flag('customerName')} autoComplete="off" />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Codice fiscale / P.IVA
                  <input value={form.fiscalCode} onChange={update('fiscalCode')} className={monoCls + flag('fiscalCode')} autoComplete="off" />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Telefono (facoltativo)
                  <input type="tel" value={form.phone} onChange={update('phone')} className={inputCls} autoComplete="off" />
                </label>
                <label className="text-[13px] font-semibold text-[#445966]">
                  Email (facoltativa)
                  <input type="email" value={form.email} onChange={update('email')} className={inputCls} autoComplete="off" />
                </label>
                <label className="text-[13px] font-semibold text-[#445966] sm:col-span-2">
                  Comune (facoltativo)
                  <input value={form.city} onChange={update('city')} className={inputCls} />
                </label>
              </fieldset>

              {formError && <p role="alert" className="text-sm font-semibold text-[#B91C1C]">{formError}</p>}

              <div className="flex flex-col-reverse gap-2 border-t border-[#DCE5E8] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => { setForm(null); setResult(null); setFailure(null); setFormError(null); }}
                  className="min-h-11 rounded-md px-4 text-sm font-bold text-[#0A3B40] hover:bg-[#F6F9FA] cursor-pointer"
                >
                  Carica un altro documento
                </button>
                <button type="submit" className="min-h-11 rounded-md bg-[#0A6847] px-5 text-sm font-bold text-white hover:bg-[#085238] cursor-pointer">
                  Crea cliente con questi dati
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

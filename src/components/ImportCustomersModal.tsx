import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Users, 
  Sparkles
} from 'lucide-react';
import { Customer, UtilityPoint } from '../types';

interface ImportCustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport?: (customers: Customer[]) => Promise<void> | void;
  onImportCustomers?: (customers: Customer[]) => Promise<void> | void;
  accountManager?: string;
}

interface ParsedCustomerRow {
  name: string;
  fiscalCode: string;
  phone: string;
  email: string;
  city: string;
  utilityType: 'luce' | 'gas';
  podOrPdr: string;
  annualConsumption: number;
  supplier: string;
  unitCost: number;
  isValid: boolean;
  errors: string[];
}

export const ImportCustomersModal: React.FC<ImportCustomersModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onImportCustomers,
  accountManager = 'Matteo Riva (Broker Owner)'
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCustomerRow[]>([]);
  const [, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Template CSV da scaricare
  const handleDownloadTemplate = () => {
    const csvContent = 
      'Nome,CodiceFiscale,Telefono,Email,Citta,TipoFornitura,POD_o_PDR,ConsumoAnnuo,FornitoreAttuale,PrezzoMateria\n' +
      'Mario Rossi,RSSMRA80A01H501U,+39 347 1234567,mario.rossi@email.it,Milano,luce,IT001E12345678,3200,Enel Energia,0.165\n' +
      'Giulia Bianchi,BNCGLI85B41F205Z,+39 338 9876543,giulia.bianchi@email.it,Roma,gas,01234567891234,950,Eni Plenitude,0.680\n' +
      'Rossi Consulting Srl,01234567890,+39 02 87654321,amministrazione@rossiconsulting.it,Torino,luce,IT001E98765432,6500,A2A Energia,0.158\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template_importazione_clienti_volta.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parser flessibile CSV (gestisce virgole, punti e virgola, tabulazioni)
  const parseCsvContent = (content: string) => {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      setParsedRows([]);
      return;
    }

    // Auto-detect delimiter (, o ;)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');

    const rows: ParsedCustomerRow[] = [];

    // Ignora la prima riga se contiene header (es. Nome, CodiceFiscale...)
    const startIndex = (firstLine.toLowerCase().includes('nome') || firstLine.toLowerCase().includes('cf') || firstLine.toLowerCase().includes('fiscal')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const name = cols[0] ? cols[0].trim() : '';
      const fiscalCode = cols[1] ? cols[1].trim().toUpperCase() : '';
      const phone = cols[2] ? cols[2].trim() : '';
      const email = cols[3] ? cols[3].trim() : (name ? `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@email.it` : '');
      const city = cols[4] ? cols[4].trim() : 'Milano';
      const typeRaw = (cols[5] || 'luce').toLowerCase();
      const utilityType: 'luce' | 'gas' = typeRaw.includes('gas') ? 'gas' : 'luce';
      const podOrPdr = cols[6] ? cols[6].trim().toUpperCase() : '';
      const annualConsumption = Number(cols[7]) || (utilityType === 'luce' ? 3200 : 950);
      const supplier = cols[8] ? cols[8].trim() : (utilityType === 'luce' ? 'Enel Energia' : 'Eni Plenitude');
      const unitCost = Number(cols[9]) || (utilityType === 'luce' ? 0.165 : 0.680);

      const errors: string[] = [];
      if (!name || name.length < 3) errors.push('Nome o Ragione Sociale non valido (min 3 caratteri)');
      if (!fiscalCode || fiscalCode.length < 11) errors.push('Codice Fiscale o P.IVA mancante o incompleto (min 11 caratteri)');
      if (!podOrPdr || podOrPdr.length < 10) errors.push(`Codice ${utilityType === 'luce' ? 'POD' : 'PDR'} mancante o incompleto`);

      rows.push({
        name: name || `Cliente Riga ${i}`,
        fiscalCode,
        phone,
        email,
        city,
        utilityType,
        podOrPdr,
        annualConsumption,
        supplier,
        unitCost,
        isValid: errors.length === 0,
        errors
      });
    }

    setParsedRows(rows);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setRawText(text);
        parseCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handlePasteDemoData = () => {
    const demoData = 
      'Marco Ferrari;FRRMRA78L12F205K;+39 349 1122334;marco.ferrari@gmail.com;Monza;luce;IT001E55443322;3800;Enel Energia;0.172\n' +
      'Studio Associato Bellini;02987654321;+39 039 554433;amministrazione@studiobellini.it;Milano;luce;IT001E88776655;8500;Edison Energia;0.168\n' +
      'Elena Fontana;FNTLNE82C45F205W;+39 335 6677889;elena.fontana@outlook.it;Bergamo;gas;01122334455667;1250;Eni Plenitude;0.710\n' +
      'Bar Pasticceria San Marco;09876543210;+39 02 4433221;info@barsanmarco.it;Milano;luce;IT001E99887711;14200;A2A Energia;0.164\n';
    
    setRawText(demoData);
    setFileName('dati_esempio_broker.csv');
    parseCsvContent(demoData);
  };

  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsProcessing(true);

    const newCustomers: Customer[] = validRows.map((row, idx) => {
      const custId = `cust-csv-${Date.now()}-${idx}`;
      const utility: UtilityPoint = {
        id: `point-${custId}-1`,
        type: row.utilityType,
        podOrPdr: row.podOrPdr,
        currentSupplier: row.supplier,
        currentOfferName: `${row.supplier} Tariffa Base`,
        annualConsumption: row.annualConsumption,
        currentUnitCost: row.unitCost,
        currentFixedFeeYear: row.utilityType === 'luce' ? 120 : 96,
        currentTariffType: 'fixed',
      };

      return {
        id: custId,
        name: row.name,
        fiscalCode: row.fiscalCode.toUpperCase(),
        phone: row.phone,
        email: row.email,
        city: row.city,
        utilityPoints: [utility],
        contractStartDate: new Date().toISOString().split('T')[0],
        lastSwitchAuditDate: new Date().toISOString().split('T')[0],
        nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
        accountManager,
        hasBrokerageMandate: true,
        notes: `Importato massivamente via CSV (${fileName || 'file batch'})`
      };
    });

    try {
      if (onImportCustomers) {
        await onImportCustomers(newCustomers);
      } else if (onImport) {
        await onImport(newCustomers);
      }
      setImportSuccess(true);
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
        setImportSuccess(false);
        setParsedRows([]);
        setFileName('');
        setRawText('');
      }, 1200);
    } catch (err) {
      console.error('Errore durante importazione massiva:', err);
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-6 md:p-10 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#0a2540]/50 backdrop-blur-xs transition-opacity" 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#e3e8ee] bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#635bff] uppercase tracking-wider">
                <FileSpreadsheet className="h-4 w-4" />
                Importazione Massiva Portafoglio
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                CSV / Excel Ready
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#0a2540] tracking-tight mt-1">
              Importa Clienti & Punti POD/PDR
            </h2>
            <p className="text-xs text-[#425466] mt-0.5">
              Carica una lista anagrafiche in formato CSV. I clienti verranno registrati con mandato attivo e audit a 120 giorni immediato.
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Quick Actions & Template */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-2 text-indigo-900">
              <Sparkles className="h-4 w-4 text-[#635bff] shrink-0" />
              <span className="font-medium text-xs">
                Hai un file da altri gestionali o vuoi testare subito?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-[#635bff] font-semibold text-xs transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Scarica Modello CSV</span>
              </button>
              <button
                type="button"
                onClick={handlePasteDemoData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-semibold text-xs transition-all shadow-2xs cursor-pointer"
              >
                <span>Carica 4 Clienti Demo</span>
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? 'border-[#635bff] bg-indigo-50/40 scale-[0.99]' 
                : 'border-[#e3e8ee] hover:border-slate-300 hover:bg-slate-50/50'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv,.txt"
              className="hidden" 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-[#635bff] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="font-bold text-[#0a2540] text-sm mb-1">
              {fileName ? fileName : 'Trascina qui il tuo file CSV o clicca per sfogliare'}
            </p>
            <p className="text-slate-500 text-xs">
              Formati supportati: file .csv separati da virgola (,) o punto e virgola (;)
            </p>
          </div>

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#0a2540]">Anteprima Dati Rilevati</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                    {validCount} su {parsedRows.length} record pronti
                  </span>
                </div>
                {parsedRows.length > validCount && (
                  <span className="text-amber-600 text-xs flex items-center gap-1 font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {parsedRows.length - validCount} righe con anomalie
                  </span>
                )}
              </div>

              <div className="border border-[#e3e8ee] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] text-[#425466] font-semibold border-b border-[#e3e8ee] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">CF / P.IVA</th>
                      <th className="py-2.5 px-3">Città & Tel</th>
                      <th className="py-2.5 px-3">Fornitura (POD/PDR)</th>
                      <th className="py-2.5 px-3">Consumo</th>
                      <th className="py-2.5 px-3 text-center">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3e8ee]">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/30'}>
                        <td className="py-2 px-3 font-semibold text-[#0a2540]">{row.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-700">{row.fiscalCode}</td>
                        <td className="py-2 px-3 text-slate-500">{row.city} • {row.phone}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mr-1.5 ${
                            row.utilityType === 'luce' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {row.utilityType}
                          </span>
                          <span className="font-mono text-slate-700">{row.podOrPdr}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">
                          {row.annualConsumption.toLocaleString()} {row.utilityType === 'luce' ? 'kWh' : 'Smc'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <span className="inline-flex items-center text-emerald-600 font-semibold gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-rose-600 font-semibold gap-1" title={row.errors.join(', ')}>
                              <AlertCircle className="h-3.5 w-3.5" />
                              Errore
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-[#e3e8ee] bg-slate-50/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-100 text-[#425466] font-semibold cursor-pointer text-center"
          >
            Annulla
          </button>

          <button
            type="button"
            disabled={validCount === 0 || isProcessing || importSuccess}
            onClick={handleConfirmImport}
            className="min-h-[44px] px-6 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-semibold shadow-xs cursor-pointer active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>Clienti Importati con Successo!</span>
              </>
            ) : isProcessing ? (
              <span>Importazione in corso...</span>
            ) : (
              <>
                <Users className="h-4 w-4" />
                <span>Conferma Importazione ({validCount} Clienti)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

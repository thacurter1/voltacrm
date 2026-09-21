import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { parseLeadCsv, CsvParseResult, ParsedLeadInput } from '../../services/csvImporter';
import { api } from '../../api/client';
import { Lead } from '../../types';

interface BulkCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (importedLeads: Lead[]) => void;
  onToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const BulkCsvImportModal: React.FC<BulkCsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onToast,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const processFile = (f: File) => {
    setFile(f);
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const result = parseLeadCsv(text, `CSV: ${f.name}`);
        setParseResult(result);
        if (result.valid.length > 0) {
          onToast?.('CSV Analizzato', `Rilevati ${result.valid.length} lead validi su ${result.totalRows} righe.`, 'info');
        } else {
          onToast?.('Attenzione', 'Nessun lead valido trovato nel file. Verifica le intestazioni.', 'warning');
        }
      } catch (err: any) {
        onToast?.('Errore Formato CSV', err.message || 'Impossibile leggere il file.', 'warning');
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      onToast?.('Errore Lettura', 'Errore durante la lettura del file.', 'warning');
      setIsParsing(false);
    };
    reader.readAsText(f, 'UTF-8');
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;
    setIsSubmitting(true);
    try {
      const created = await api.leads.bulkImport(parseResult.valid);
      onToast?.('Importazione Completata', `${created.length} lead caricati con successo nella coda Call Center!`, 'success');
      onImportSuccess?.(created);
      onClose();
    } catch (err: any) {
      onToast?.('Errore Importazione', err.message || 'Impossibile salvare i lead.', 'warning');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Import Massivo Lead da File CSV
              </h3>
              <p className="text-xs text-slate-500">
                Supporta separatori virgola (,) e punto e virgola (;), esportazioni Excel e liste marketing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">
                {file ? file.name : 'Trascina qui il file CSV oppure clicca per sfogliare'}
              </p>
              <p className="text-slate-400 text-[11px] mt-1">
                Colonne supportate: Nome, Telefono/Cellulare, Email, Città, Consumo kWh/Smc, Note
              </p>
            </div>
          </div>

          {/* Parsing summary */}
          {isParsing && (
            <div className="p-4 bg-blue-50 rounded-xl text-blue-700 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analisi e mappatura del file in corso...</span>
            </div>
          )}

          {parseResult && !isParsing && (
            <div className="space-y-4">
              {/* Stats Banner */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Righe Lette</span>
                  <span className="text-lg font-black text-slate-900">{parseResult.totalRows}</span>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Lead Validi</span>
                  <span className="text-lg font-black text-emerald-700">{parseResult.valid.length}</span>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] uppercase font-bold text-amber-600 block">Scarti / Errori</span>
                  <span className="text-lg font-black text-amber-700">{parseResult.errors.length}</span>
                </div>
              </div>

              {/* Error messages if any */}
              {parseResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-[11px] text-amber-800 max-h-24 overflow-y-auto">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Avvisi di validazione ({parseResult.errors.length}):</span>
                  </div>
                  {parseResult.errors.slice(0, 4).map((err, idx) => (
                    <div key={idx} className="pl-4">• {err}</div>
                  ))}
                  {parseResult.errors.length > 4 && (
                    <div className="pl-4 text-amber-600 italic">...e altri {parseResult.errors.length - 4} avvisi.</div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              <div>
                <span className="font-bold text-slate-700 text-xs block mb-2">
                  Anteprima primi contatti rilevati ({Math.min(5, parseResult.valid.length)} di {parseResult.valid.length}):
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Nome</th>
                        <th className="p-2.5">Telefono</th>
                        <th className="p-2.5">Città</th>
                        <th className="p-2.5">Consumo Stima</th>
                        <th className="p-2.5">Fonte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {parseResult.valid.slice(0, 5).map((lead: ParsedLeadInput, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-bold text-slate-900">{lead.name}</td>
                          <td className="p-2.5 font-mono text-slate-700">{lead.phone}</td>
                          <td className="p-2.5 text-slate-600">{lead.city}</td>
                          <td className="p-2.5 text-slate-600">
                            {lead.estimatedConsumptionKwh ? `${lead.estimatedConsumptionKwh} kWh` : '-'}
                          </td>
                          <td className="p-2.5 text-slate-500">{lead.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parseResult || parseResult.valid.length === 0 || isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importazione in corso...</span>
              </>
            ) : (
              <>
                <span>Conferma e Importa in Call Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

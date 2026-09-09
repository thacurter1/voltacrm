import React, { useState } from 'react';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Search, 
  Eye, 
  Zap, 
  Flame
} from 'lucide-react';
import { CustomerBill } from '../types';

interface ClientBillsInboxProps {
  bills: CustomerBill[];
  onOpenOcrForBill: (bill: CustomerBill) => void;
  onMarkAnalyzed: (billId: string, savingsEur: number) => void;
}

export const ClientBillsInbox: React.FC<ClientBillsInboxProps> = ({
  bills,
  onOpenOcrForBill,
  onMarkAnalyzed: _onMarkAnalyzed,
}) => {
  const [filter, setFilter] = useState<'all' | 'in_review' | 'analyzed'>('all');
  const [search, setSearch] = useState('');

  const filteredBills = bills.filter((b) => {
    const matchesFilter = filter === 'all' || b.status === filter;
    const matchesSearch = 
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.fileName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount = bills.filter(b => b.status === 'in_review').length;

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner */}
      <div className="rounded-2xl bg-white border border-[#e3e8ee] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#635bff] border border-indigo-100">
            <FileText className="h-3.5 w-3.5" />
            Inbox Bollette Clienti
          </div>
          <h1 className="text-2xl font-bold text-[#0a2540] tracking-tight">
            Documenti & Bollette Caricate dai Clienti
          </h1>
          <p className="text-xs text-[#425466]">
            File ricevuti in tempo reale tramite l'area riservata cliente. Esegui la scansione OCR per calcolare il risparmio.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">Da Lavorare</span>
            <span className="text-lg font-black text-amber-700 font-mono">
              {pendingCount} {pendingCount === 1 ? 'bolletta' : 'bollette'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-80 relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cerca per cliente o nome file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] text-xs placeholder-slate-400 focus:outline-none focus:border-[#635bff]"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-[#e3e8ee]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              filter === 'all' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466]'
            }`}
          >
            Tutte ({bills.length})
          </button>
          <button
            onClick={() => setFilter('in_review')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              filter === 'in_review' ? 'bg-white text-amber-700 shadow-xs' : 'text-[#425466]'
            }`}
          >
            In Revisione ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('analyzed')}
            className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              filter === 'analyzed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-[#425466]'
            }`}
          >
            Analizzate ({bills.length - pendingCount})
          </button>
        </div>
      </div>

      {/* Table of Bills */}
      <div className="rounded-2xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e3e8ee] bg-slate-50 text-[#425466] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Documento / File</th>
                <th className="py-3 px-4">Fornitura</th>
                <th className="py-3 px-4">Data Upload</th>
                <th className="py-3 px-4">Stato Lavorazione</th>
                <th className="py-3 px-4 text-right">Azioni OCR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e8ee]">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Nessuna bolletta trovata con i filtri correnti.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[#0a2540] block">{bill.customerName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {bill.customerId}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#635bff] shrink-0" />
                        <div>
                          <span className="font-semibold text-[#0a2540] block truncate max-w-xs">
                            {bill.fileName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {bill.fileSizeKb} KB
                          </span>
                        </div>
                      </div>
                      {bill.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5 max-w-sm">
                          "{bill.notes}"
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        bill.utilityType === 'luce' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}>
                        {bill.utilityType === 'luce' ? <Zap className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                        {bill.utilityType.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {bill.uploadDate}
                    </td>

                    <td className="py-3.5 px-4">
                      {bill.status === 'analyzed' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Analizzata (+€{bill.extractedSavingsEur || 180}/a)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          In Attesa di Verifica
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {bill.status === 'in_review' ? (
                          <button
                            onClick={() => onOpenOcrForBill(bill)}
                            className="px-3 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Lancia OCR AI
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenOcrForBill(bill)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            Rivedi Dati
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

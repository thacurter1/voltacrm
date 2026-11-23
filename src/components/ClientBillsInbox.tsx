import React, { useState } from 'react';
import { FileText, Loader2, Search } from 'lucide-react';
import { CustomerBill } from '../types';

interface ClientBillsInboxProps {
  bills: CustomerBill[];
  /** Starts the OCR analysis of a stored bill; the review opens in BillOcrModal. */
  onOpenOcrForBill: (bill: CustomerBill) => void | Promise<void>;
  onMarkAnalyzed: (billId: string, savingsEur?: number) => void;
}

type Filter = 'all' | 'in_review' | 'needs_info' | 'analyzed';

const STATUS: Record<CustomerBill['status'], { label: string; cls: string }> = {
  in_review: { label: 'Ricevuta / In verifica', cls: 'text-[#145374] bg-[#EAF2F7] border-[#C9DCE8]' },
  needs_info: { label: 'Richiesta informazioni', cls: 'text-[#9A4D09] bg-[#FFF8F0] border-[#E9CFA9]' },
  analyzed: { label: 'Analizzata', cls: 'text-[#0A6847] bg-[#EAF4F0] border-[#D5E6DF]' },
  archived: { label: 'Archiviata', cls: 'text-[#445966] bg-[#F6F9FA] border-[#DCE5E8]' },
};

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function StatusLabel({ bill }: { bill: CustomerBill }) {
  const s = STATUS[bill.status] || STATUS.in_review;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.label}
      {bill.status === 'analyzed' && typeof bill.extractedSavingsEur === 'number' && bill.extractedSavingsEur > 0 && (
        <span className="ml-1 font-mono tabular-nums">· {eur.format(bill.extractedSavingsEur)}/anno</span>
      )}
    </span>
  );
}

export const ClientBillsInbox: React.FC<ClientBillsInboxProps> = ({ bills, onOpenOcrForBill }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filteredBills = bills.filter((b) =>
    (filter === 'all' || b.status === filter) &&
    (!q || b.customerName.toLowerCase().includes(q) || b.fileName.toLowerCase().includes(q)),
  );
  const count = (status: CustomerBill['status']) => bills.filter((b) => b.status === status).length;
  const pendingCount = count('in_review');

  const runAnalysis = async (bill: CustomerBill) => {
    setBusyId(bill.id);
    try {
      await onOpenOcrForBill(bill);
    } finally {
      setBusyId(null);
    }
  };

  const filters: Array<{ id: Filter; label: string; n: number }> = [
    { id: 'all', label: 'Tutte', n: bills.length },
    { id: 'in_review', label: 'In verifica', n: pendingCount },
    { id: 'needs_info', label: 'Info richieste', n: count('needs_info') },
    { id: 'analyzed', label: 'Analizzate', n: count('analyzed') },
  ];

  const actionButton = (bill: CustomerBill, full = false) => {
    const busy = busyId === bill.id;
    const primary = bill.status === 'in_review' || bill.status === 'needs_info';
    return (
      <button
        type="button"
        onClick={() => void runAnalysis(bill)}
        disabled={busy}
        aria-busy={busy}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold cursor-pointer disabled:cursor-wait disabled:opacity-70 ${full ? 'w-full' : ''} ${
          primary ? 'bg-[#0A6847] text-white hover:bg-[#085238]' : 'border border-[#DCE5E8] bg-white text-[#0A3B40] hover:bg-[#F6F9FA]'
        }`}
      >
        {busy && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
        {busy ? 'Lettura in corso' : primary ? 'Leggi dati bolletta' : 'Rileggi dati'}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-[12px] border border-[#DCE5E8] bg-white p-5 sm:p-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F222D]">Bollette ricevute</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#445966]">
            Documenti caricati dai clienti dall'area riservata. La lettura automatica propone i dati, che vanno sempre verificati prima del confronto.
          </p>
        </div>
        <p className="shrink-0 text-sm text-[#445966]">
          Da lavorare <span className="ml-1 font-mono text-2xl font-bold tabular-nums text-[#0F222D]">{pendingCount}</span>
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:w-80">
          <span className="sr-only">Cerca per cliente o nome file</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7F8A]" aria-hidden="true" />
          <input
            type="search"
            placeholder="Cerca per cliente o file"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-h-11 w-full rounded-md border border-[#DCE5E8] bg-white pl-9 pr-3 text-sm text-[#0F222D] placeholder:text-[#6B7F8A] focus:border-[#0A6847] focus:outline-none focus:ring-2 focus:ring-[#0A6847]/20"
          />
        </label>

        <div role="tablist" aria-label="Filtra per stato" className="flex gap-1 overflow-x-auto rounded-md border border-[#DCE5E8] bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 shrink-0 rounded px-3 text-sm font-semibold cursor-pointer ${
                filter === f.id ? 'bg-[#0A3B40] text-white' : 'text-[#445966] hover:bg-[#F6F9FA]'
              }`}
            >
              {f.label} <span className="font-mono tabular-nums">{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      {filteredBills.length === 0 ? (
        <p className="rounded-[12px] border border-[#DCE5E8] bg-white px-6 py-12 text-center text-sm text-[#445966]">
          Nessuna bolletta con i filtri correnti.
        </p>
      ) : (
        <>
          {/* Phones and tablets: one row per bill, no horizontal scroll */}
          <ul className="space-y-3 lg:hidden">
            {filteredBills.map((bill) => (
              <li key={bill.id} className="rounded-[12px] border border-[#DCE5E8] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#0F222D]">{bill.customerName}</p>
                    <p className="mt-0.5 truncate text-[13px] text-[#445966]">{bill.fileName}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold uppercase text-[#0A3B40]">{bill.utilityType === 'luce' ? 'Luce' : 'Gas'}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[#445966]">
                  <StatusLabel bill={bill} />
                  <span className="font-mono tabular-nums">{bill.uploadDate}</span>
                  <span className="font-mono tabular-nums">{bill.fileSizeKb} KB</span>
                </div>
                {bill.notes && <p className="mt-2 text-[13px] text-[#445966]">Nota cliente: {bill.notes}</p>}
                <div className="mt-3">{actionButton(bill, true)}</div>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[12px] border border-[#DCE5E8] bg-white lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#DCE5E8] bg-[#F6F9FA] text-[13px] font-semibold text-[#445966]">
                  <th scope="col" className="px-4 py-3">Cliente</th>
                  <th scope="col" className="px-4 py-3">Documento</th>
                  <th scope="col" className="px-4 py-3">Fornitura</th>
                  <th scope="col" className="px-4 py-3">Caricata il</th>
                  <th scope="col" className="px-4 py-3">Stato</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Azioni</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE5E8]">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="align-top hover:bg-[#F6F9FA]/60">
                    <td className="px-4 py-3.5">
                      <span className="block font-bold text-[#0F222D]">{bill.customerName}</span>
                      <span className="font-mono text-xs tabular-nums text-[#6B7F8A]">{bill.customerId}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[#0A6847]" aria-hidden="true" />
                        <span className="max-w-xs truncate font-semibold text-[#0F222D]">{bill.fileName}</span>
                      </span>
                      <span className="ml-6 font-mono text-xs tabular-nums text-[#6B7F8A]">{bill.fileSizeKb} KB</span>
                      {bill.notes && <p className="ml-6 mt-1 max-w-sm text-[13px] text-[#445966]">Nota cliente: {bill.notes}</p>}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#0A3B40]">{bill.utilityType === 'luce' ? 'Luce' : 'Gas'}</td>
                    <td className="px-4 py-3.5 font-mono text-[13px] tabular-nums text-[#445966]">{bill.uploadDate}</td>
                    <td className="px-4 py-3.5"><StatusLabel bill={bill} /></td>
                    <td className="px-4 py-3.5 text-right">{actionButton(bill)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

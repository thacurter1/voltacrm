import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ArrowUpRight, 
  Search, 
  RefreshCw, 
  X, 
  Zap, 
  Flame, 
  Award,
  Wallet,
  User,
  Download
} from 'lucide-react';
import { api } from '../api/client';
import { CommissionRecord, AgentCommissionSummary, SettlementBatch, AuthUser } from '../types';

interface CommissionManagerProps {
  currentUser: AuthUser;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CommissionManager: React.FC<CommissionManagerProps> = ({ currentUser: _currentUser, onToast }) => {
  const [summaries, setSummaries] = useState<AgentCommissionSummary[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtri tabella
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal Liquidazione
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAgentId, setSettleAgentId] = useState<string>('');
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [settleNotes, setSettleNotes] = useState<string>('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Caricamento dati
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, commRes, batchRes] = await Promise.all([
        api.commissions.getSummaries(),
        api.commissions.getAll(),
        api.commissions.getBatches(),
      ]);
      setSummaries(sumRes);
      setCommissions(commRes);
      setBatches(batchRes);
    } catch (err: any) {
      onToast('Errore Provvigioni', err.message || 'Impossibile caricare i dati provvigionali.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Apertura modal liquidazione per agente
  const handleOpenSettleModal = (agentId: string) => {
    setSettleAgentId(agentId);
    // Seleziona di default tutte le provvigioni in stato 'accrued' dell'agente
    const agentAccrued = commissions.filter(c => c.agentId === agentId && c.status === 'accrued');
    setSelectedCommissionIds(agentAccrued.map(c => c.id));
    
    const now = new Date();
    const period = now.toISOString().slice(0, 7);
    const suffix = Math.floor(1000 + Math.random() * 9000);
    setPaymentReference(`DIST-${period}-${agentId.slice(-4).toUpperCase()}-${suffix}`);
    setSettleNotes(`Liquidazione provvigioni maturate ${now.toLocaleDateString('it-IT')}`);
    setIsSettleModalOpen(true);
  };

  // Conferma liquidazione
  const handleConfirmSettle = async () => {
    if (!settleAgentId || selectedCommissionIds.length === 0) {
      onToast('Nessuna Voce Selezionata', 'Seleziona almeno una provvigione da liquidare.', 'warning');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      const res = await api.commissions.settle({
        agentId: settleAgentId,
        commissionIds: selectedCommissionIds,
        paymentReference,
        notes: settleNotes
      });

      onToast(
        'Distinta Emessa!', 
        `Liquidati €${res.batch.totalAmountEur.toFixed(2)} su distinta ${res.batch.paymentReference}.`, 
        'success'
      );

      setIsSettleModalOpen(false);
      await loadData();
    } catch (err: any) {
      onToast('Errore Liquidazione', err.message || 'Impossibile completare la distinta.', 'warning');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Helper esportazione CSV compatibile Excel / Home Banking SEPA (UTF-8 con BOM, delimitatore ;)
  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escapeCell = (val: string | number | undefined | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = '\uFEFF' + [
      headers.map(escapeCell).join(';'),
      ...rows.map(row => row.map(escapeCell).join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Esportazione CSV per singola distinta (SEPA bonifico / payroll)
  const handleExportBatchCsv = (batch: SettlementBatch) => {
    const batchCommissions = commissions.filter(c => c.paymentReference === batch.paymentReference);
    const headers = [
      'Protocollo Distinta',
      'Data Liquidazione',
      'Periodo Competenza',
      'Consulente Commerciale',
      'Cliente Fornitura',
      'Tipo Utenza',
      'POD / PDR',
      'Tipologia Provvigione',
      'Importo Lordo (€)',
      'Note Contabili'
    ];

    const targetList = batchCommissions.length > 0 
      ? batchCommissions 
      : commissions.filter(c => c.agentId === batch.agentId && c.status === 'settled');

    const rows: (string | number)[][] = targetList.map(c => [
      batch.paymentReference,
      batch.settlementDate,
      batch.period,
      batch.agentName,
      c.customerName,
      c.utilityType.toUpperCase(),
      c.podOrPdr,
      c.type === 'upfront' ? 'Gettone Attivazione' : c.type === 'recurring' ? 'Ricorrente Consumo' : 'Bonus Dual Fuel',
      c.amountEur.toFixed(2),
      c.notes || ''
    ]);

    // Riga di riepilogo totale distinta
    rows.push([
      'TOTALE DISTINTA',
      batch.settlementDate,
      batch.period,
      batch.agentName,
      `${batch.commissionCount} voci liquidate`,
      '',
      '',
      'TOTALE BONIFICO',
      batch.totalAmountEur.toFixed(2),
      batch.notes || 'Disposizione SEPA approvata'
    ]);

    const sanitizedAgent = batch.agentName.replace(/\s+/g, '_').toLowerCase();
    const filename = `distinta_sepa_${batch.paymentReference}_${sanitizedAgent}.csv`;
    downloadCsv(filename, headers, rows);
    onToast('Export Distinta', `Distinta ${batch.paymentReference} esportata con successo in CSV.`, 'success');
  };

  // Esportazione CSV registro filtrato
  const handleExportLedgerCsv = () => {
    if (filteredCommissions.length === 0) {
      onToast('Nessun Dato', 'Nessuna voce da esportare con i filtri correnti.', 'warning');
      return;
    }

    const headers = [
      'ID Registrazione',
      'Data Maturazione',
      'Periodo Competenza',
      'Consulente Commerciale',
      'Cliente Finale',
      'Tipo Utenza',
      'Codice POD / PDR',
      'Tipologia Compenso',
      'Importo Lordo (€)',
      'Stato Voce',
      'Protocollo Distinta',
      'Note'
    ];

    const rows: (string | number)[][] = filteredCommissions.map(c => [
      c.id,
      c.accrualDate,
      c.period,
      c.agentName,
      c.customerName,
      c.utilityType.toUpperCase(),
      c.podOrPdr,
      c.type === 'upfront' ? 'Gettone Attivazione' : c.type === 'recurring' ? 'Ricorrente Consumo' : 'Bonus Dual Fuel',
      c.amountEur.toFixed(2),
      c.status === 'settled' ? 'Liquidata' : c.status === 'accrued' ? 'Maturata' : 'In attivazione',
      c.paymentReference || '',
      c.notes || ''
    ]);

    const filename = `registro_provvigioni_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    onToast('Export Registro', `Esportate ${rows.length} voci provvigionali in CSV.`, 'success');
  };

  // Calcolo KPI Globali
  const totalAccruedEur = summaries.reduce((s, a) => s + a.accruedAmountEur, 0);
  const totalSettledEur = summaries.reduce((s, a) => s + a.settledAmountEur, 0);
  const totalContracts = summaries.reduce((s, a) => s + a.contractsCount, 0);
  const totalPendingEur = summaries.reduce((s, a) => s + a.pendingAmountEur, 0);

  // Filtraggio righe registro
  const filteredCommissions = commissions.filter(c => {
    if (selectedAgentFilter !== 'all' && c.agentId !== selectedAgentFilter) return false;
    if (selectedStatusFilter !== 'all' && c.status !== selectedStatusFilter) return false;
    if (selectedTypeFilter !== 'all' && c.type !== selectedTypeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchCust = c.customerName.toLowerCase().includes(term);
      const matchPod = c.podOrPdr.toLowerCase().includes(term);
      const matchAgent = c.agentName.toLowerCase().includes(term);
      if (!matchCust && !matchPod && !matchAgent) return false;
    }
    return true;
  });

  // Agente selezionato per la modal
  const targetAgentSummary = summaries.find(s => s.agentId === settleAgentId);
  const targetAgentAccruedList = commissions.filter(c => c.agentId === settleAgentId && c.status === 'accrued');
  const selectedSettleAmount = targetAgentAccruedList
    .filter(c => selectedCommissionIds.includes(c.id))
    .reduce((s, c) => s + c.amountEur, 0);

  return (
    <div className="space-y-6">
      {/* Intestazione Sezione */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e3e8ee]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#635bff] uppercase tracking-wider">
              <Coins className="h-4 w-4" />
              Modulo Provvigioni & Compensi
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#635bff] text-[10px] font-bold">
              Energy Compensation 2026
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#0a2540] tracking-tight mt-1">
            Registro Provvigioni & Liquidazione Distinte Agenti
          </h1>
          <p className="text-xs text-[#425466] mt-0.5">
            Calcolo automatico gettoni di attivazione (Luce/Gas/Dual Fuel) e margini ricorrenti a consumo sul portafoglio clienti.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-xs font-medium text-[#0a2540] transition-colors cursor-pointer shadow-2xs"
            title="Ricarica dati provvigionali dal backend"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>

          {summaries.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenSettleModal(summaries[0].agentId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Nuova Liquidazione</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium text-[#425466]">Maturato da Liquidare</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[#0a2540]">
            € {totalAccruedEur.toFixed(2)}
          </div>
          <span className="text-[11px] font-medium text-amber-700 block">
            Pronto per distinte di bonifico
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium text-[#425466]">Già Liquidato (Anno)</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[#0a2540]">
            € {totalSettledEur.toFixed(2)}
          </div>
          <span className="text-[11px] font-medium text-emerald-700 block">
            {batches.length} distinte contabili saldate
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium text-[#425466]">In Attivazione (Stima)</span>
            <div className="p-1.5 rounded-md bg-sky-50 text-sky-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[#0a2540]">
            € {totalPendingEur.toFixed(2)}
          </div>
          <span className="text-[11px] font-medium text-sky-700 block">
            In validazione presso i distributori
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-medium text-[#425466]">Contratti a Premio</span>
            <div className="p-1.5 rounded-md bg-indigo-50 text-[#635bff]">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-[#0a2540]">
            {totalContracts}
          </div>
          <span className="text-[11px] font-medium text-indigo-700 block">
            Media € {(totalContracts > 0 ? (totalAccruedEur + totalSettledEur) / totalContracts : 0).toFixed(2)} / fornitura
          </span>
        </div>
      </div>

      {/* Sezione Agenti / Leaderboard */}
      <div className="p-5 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#635bff]" />
            <h2 className="text-sm font-bold text-[#0a2540]">
              Performance & Saldo Provvigionale Consulenti Commerciali
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {summaries.length} account manager attivi
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summaries.map((agent) => (
            <div 
              key={agent.agentId}
              className="p-4 rounded-xl border border-[#e3e8ee] bg-slate-50/50 hover:bg-slate-50 hover:border-[#635bff]/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-[#635bff] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    {agent.agentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0a2540] leading-snug">
                      {agent.agentName}
                    </h3>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      {agent.role === 'admin' ? 'Broker Director' : 'Consulente Vendite'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {agent.contractsCount} contratti
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Da Liquidare:</span>
                  <span className="font-mono font-bold text-amber-700">
                    € {agent.accruedAmountEur.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Già Liquidato:</span>
                  <span className="font-mono font-bold text-slate-700">
                    € {agent.settledAmountEur.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenSettleModal(agent.agentId)}
                disabled={agent.accruedAmountEur === 0}
                className="w-full py-1.5 px-3 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-100 text-xs font-semibold text-[#0a2540] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              >
                <Wallet className="h-3.5 w-3.5 text-[#635bff]" />
                <span>Emetti Distinta Liquidazione</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Registro Dettagliato Provvigioni */}
      <div className="p-5 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        {/* Barra Filtri e Ricerca */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#635bff]" />
            <h2 className="text-sm font-bold text-[#0a2540]">
              Registro Singole Voci Provvigionali
            </h2>
            <span className="text-xs text-slate-400">({filteredCommissions.length} record)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Cerca */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca cliente, POD o agente..."
                className="pl-8 pr-3 py-1.5 rounded-lg border border-[#e3e8ee] bg-slate-50 focus:bg-white focus:outline-none focus:border-[#635bff] text-xs w-48 sm:w-56"
              />
            </div>

            {/* Filtro Agente */}
            <select
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-[#e3e8ee] bg-white text-slate-700 text-xs focus:outline-none focus:border-[#635bff]"
            >
              <option value="all">Tutti gli agenti</option>
              {summaries.map(s => (
                <option key={s.agentId} value={s.agentId}>{s.agentName}</option>
              ))}
            </select>

            {/* Filtro Stato */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-[#e3e8ee] bg-white text-slate-700 text-xs focus:outline-none focus:border-[#635bff]"
            >
              <option value="all">Tutti gli stati</option>
              <option value="accrued">Maturata (da liquidare)</option>
              <option value="pending">In attivazione</option>
              <option value="settled">Liquidata</option>
            </select>

            {/* Filtro Tipo */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border border-[#e3e8ee] bg-white text-slate-700 text-xs focus:outline-none focus:border-[#635bff]"
            >
              <option value="all">Tutte le tipologie</option>
              <option value="upfront">Gettone Upfront</option>
              <option value="recurring">Ricorrente Mensile</option>
              <option value="bonus">Bonus Dual Fuel</option>
            </select>

            {/* Esporta CSV Registro */}
            <button
              type="button"
              onClick={handleExportLedgerCsv}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
              title="Esporta registro provvigionale filtrato in formato CSV (Excel / Contabilità)"
            >
              <Download className="h-3.5 w-3.5 text-[#635bff]" />
              <span>Esporta CSV</span>
            </button>
          </div>
        </div>

        {/* Tabella Dati */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
              <tr>
                <th className="py-2.5 px-3">Agente</th>
                <th className="py-2.5 px-3">Cliente & Fornitura</th>
                <th className="py-2.5 px-3">Tipologia Compenso</th>
                <th className="py-2.5 px-3 font-mono">Importo</th>
                <th className="py-2.5 px-3">Periodo / Data</th>
                <th className="py-2.5 px-3">Stato</th>
                <th className="py-2.5 px-3 font-mono">Riferimento Distinta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nessuna provvigione trovata con i filtri selezionati.
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {c.agentName}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[#0a2540]">{c.customerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        {c.utilityType === 'luce' ? (
                          <Zap className="h-3 w-3 text-amber-500 inline" />
                        ) : (
                          <Flame className="h-3 w-3 text-sky-500 inline" />
                        )}
                        {c.podOrPdr}
                        {c.customerType === 'business' && (
                          <span className="px-1 rounded bg-slate-100 text-slate-600 text-[9px] font-bold">PMI</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.type === 'upfront'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : c.type === 'recurring'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {c.type === 'upfront' ? 'Gettone Attivazione' : c.type === 'recurring' ? 'Ricorrente Consumo' : 'Bonus Dual Fuel'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-sm text-[#0a2540] whitespace-nowrap">
                      € {c.amountEur.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      <div>{c.period}</div>
                      <div className="text-[10px] text-slate-400">{c.accrualDate}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {c.status === 'accrued' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" /> Maturata
                        </span>
                      )}
                      {c.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          In attivazione
                        </span>
                      )}
                      {c.status === 'settled' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Liquidata
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {c.paymentReference ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                          {c.paymentReference}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Storico Distinte di Liquidazione & Bonifici SEPA */}
      <div className="p-5 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#635bff]" />
            <h2 className="text-sm font-bold text-[#0a2540]">
              Distinte di Liquidazione & Ordini di Bonifico SEPA
            </h2>
            <span className="text-xs text-slate-400">({batches.length} distinte emesse)</span>
          </div>
          <span className="text-xs text-slate-500">
            Formato compatibile con tracciato bancario SEPA CBI e sistemi paghe
          </span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
              <tr>
                <th className="py-2.5 px-3 font-mono">Protocollo Distinta</th>
                <th className="py-2.5 px-3">Data Emessa</th>
                <th className="py-2.5 px-3">Consulente Commerciale</th>
                <th className="py-2.5 px-3">Periodo</th>
                <th className="py-2.5 px-3">Voci Saldate</th>
                <th className="py-2.5 px-3 font-mono">Totale Bonifico</th>
                <th className="py-2.5 px-3">Note</th>
                <th className="py-2.5 px-3 text-right">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nessuna distinta contabile ancora registrata. Clicca su &quot;Emetti Distinta Liquidazione&quot; per generare un ordine di pagamento.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#0a2540] whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[#635bff]">
                        {b.paymentReference}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {b.settlementDate}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {b.agentName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {b.period}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                        {b.commissionCount} voci
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-sm text-emerald-700 whitespace-nowrap">
                      € {b.totalAmountEur.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                      {b.notes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleExportBatchCsv(b)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#e3e8ee] hover:bg-slate-100 text-[#0a2540] text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Scarica distinta in formato CSV per bonifico bancario SEPA"
                      >
                        <Download className="h-3 w-3 text-[#635bff]" />
                        <span>Esporta CSV</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Emetti Distinta di Liquidazione */}
      {isSettleModalOpen && targetAgentSummary && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-12 flex items-center justify-center">
          <div 
            onClick={() => setIsSettleModalOpen(false)}
            className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs transition-opacity" 
          />

          <div className="relative w-full max-w-2xl bg-white rounded-xl border border-[#e3e8ee] shadow-[0_25px_60px_rgba(0,0,0,0.18)] p-6 space-y-6 text-xs max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#635bff] uppercase tracking-wider">
                    <Wallet className="h-3.5 w-3.5" />
                    Emissione Distinta Contabile
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                    Approvazione Pagamento
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#0a2540] mt-0.5">
                  Liquidazione Competenze per {targetAgentSummary.agentName}
                </h3>
                <p className="text-xs text-[#425466]">
                  Seleziona le provvigioni maturate da includere nella distinta di bonifico o autofattura.
                </p>
              </div>
              <button onClick={() => setIsSettleModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Riepilogo Selezionato */}
            <div className="p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#425466] font-medium block">
                  Totale Selezionato per il Pagamento:
                </span>
                <span className="text-2xl font-bold font-mono text-[#635bff]">
                  € {selectedSettleAmount.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-700 block">
                  {selectedCommissionIds.length} voci selezionate
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCommissionIds.length === targetAgentAccruedList.length) {
                      setSelectedCommissionIds([]);
                    } else {
                      setSelectedCommissionIds(targetAgentAccruedList.map(c => c.id));
                    }
                  }}
                  className="text-[11px] text-[#635bff] font-semibold hover:underline cursor-pointer"
                >
                  {selectedCommissionIds.length === targetAgentAccruedList.length ? 'Deseleziona Tutto' : 'Seleziona Tutte'}
                </button>
              </div>
            </div>

            {/* Lista Provvigioni Maturate Spuntabili */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#425466] uppercase tracking-wider block">
                Seleziona Provvigioni Maturate:
              </span>
              <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                {targetAgentAccruedList.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">
                    Nessuna provvigione maturata disponibile per questo agente.
                  </div>
                ) : (
                  targetAgentAccruedList.map((c) => {
                    const isChecked = selectedCommissionIds.includes(c.id);
                    return (
                      <label 
                        key={c.id} 
                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCommissionIds(prev => [...prev, c.id]);
                              } else {
                                setSelectedCommissionIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                            className="rounded border-slate-300 text-[#635bff] focus:ring-[#635bff]"
                          />
                          <div>
                            <div className="font-semibold text-slate-800">{c.customerName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {c.utilityType.toUpperCase()} • {c.podOrPdr} • {c.notes}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          € {c.amountEur.toFixed(2)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Dati Distinta & Riferimento Contabile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Codice Distinta / Protocollo Bonifico:
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs font-bold text-[#0a2540] focus:outline-none focus:border-[#635bff]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Note Contabili:
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Es. Bonifico competenze settimanali"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-[#635bff]"
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-[#e3e8ee]">
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[#425466] font-medium cursor-pointer"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={handleConfirmSettle}
                disabled={isSubmittingSettle || selectedCommissionIds.length === 0}
                className="px-4 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium shadow-xs cursor-pointer active:scale-[0.99] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isSubmittingSettle ? 'Registrazione...' : `Conferma & Salda € ${selectedSettleAmount.toFixed(2)}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

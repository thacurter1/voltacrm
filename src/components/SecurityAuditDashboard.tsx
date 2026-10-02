import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Download
} from 'lucide-react';
import { SecurityAuditLog, SecurityCheckItem } from '../types';
import { INITIAL_SECURITY_CHECKS } from '../services/db';

interface SecurityAuditDashboardProps {
  logs: SecurityAuditLog[];
  onTriggerScan?: () => void;
}

export const SecurityAuditDashboard: React.FC<SecurityAuditDashboardProps> = ({
  logs,
  onTriggerScan,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [checks, _setChecks] = useState<SecurityCheckItem[]>(INITIAL_SECURITY_CHECKS);

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      if (onTriggerScan) onTriggerScan();
    }, 1200);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'all') return true;
    return log.status === filterType;
  });

  const getEventBadge = (status: SecurityAuditLog['status']) => {
    switch (status) {
      case 'safe':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Safe
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3 w-3" /> Warning
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" /> Critical
          </span>
        );
    }
  };

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `security_audit_log_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner & Security Score */}
      <div className="rounded-2xl bg-white border border-[#e3e8ee] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#635bff] border border-indigo-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Riepilogo dimostrativo della sicurezza
          </div>
          <h1 className="text-2xl font-bold text-[#0a2540] tracking-tight">
            Stato illustrativo, non auditato
          </h1>
          <p className="text-xs text-[#425466]">
            I valori mostrati sono statici: questa schermata non esegue scansioni né certifica requisiti tecnici o legali.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold uppercase text-slate-600 block">Security Score</span>
            <span className="text-2xl font-black text-slate-600 font-mono">N/D</span>
            <span className="text-[10px] text-slate-500 block font-semibold">Nessun audit eseguito</span>
          </div>

          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="px-4 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Simulazione in corso...' : 'Simula controllo'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#425466] font-medium">Autenticazione 2FA</span>
            <KeyRound className="h-4 w-4 text-[#635bff]" />
          </div>
          <div className="text-xl font-bold text-[#0a2540]">Non verificata</div>
          <span className="text-[11px] text-slate-500 font-semibold block">Verificare la configurazione effettiva</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#425466] font-medium">Mascheramento POD/PDR</span>
            <Lock className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-[#0a2540]">Solo interfaccia</div>
          <span className="text-[11px] text-slate-500 font-semibold block">Nasconde parte dei codici nella vista demo</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#425466] font-medium">Conformità GDPR</span>
            <FileCheck className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-[#0a2540]">Verifica richiesta</div>
          <span className="text-[11px] text-slate-500 font-medium block">La schermata non certifica conformità legale</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#425466] font-medium">Minacce Rilevate</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-[#0a2540]">Non verificato</div>
          <span className="text-[11px] text-slate-500 font-medium block">I contatori in questa demo non sono live</span>
        </div>
      </div>

      {/* Security Controls Checklist */}
      <div className="rounded-2xl bg-white border border-[#e3e8ee] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
        <h2 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Verifiche di Conformità e Controlli di Sicurezza Attivi
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checks.map((chk) => (
            <div key={chk.id} className="p-4 rounded-xl bg-slate-50 border border-[#e3e8ee] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#635bff] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  {chk.category}
                </span>
                <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Conforme ({chk.score}/100)
                </span>
              </div>
              <h3 className="font-bold text-xs text-[#0a2540]">{chk.title}</h3>
              <p className="text-[11px] text-[#425466] leading-relaxed">{chk.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl bg-white border border-[#e3e8ee] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden space-y-0">
        <div className="p-4 border-b border-[#e3e8ee] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-[#0a2540]">Registro Eventi di Sicurezza (Audit Log)</h3>
            <p className="text-[11px] text-[#425466]">Tracciamento immutabile per ispezioni e adempimenti DPO</p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-[#e3e8ee] text-[#0a2540] text-xs font-medium"
            >
              <option value="all">Tutti i Livelli</option>
              <option value="safe">Solo Safe</option>
              <option value="warning">Solo Warning</option>
            </select>

            <button
              onClick={handleExportLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-[#0a2540] font-semibold text-xs shadow-2xs cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Esporta JSON
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#e3e8ee] bg-slate-50 text-[#425466] font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Utente / Email</th>
                <th className="py-3 px-4">Indirizzo IP</th>
                <th className="py-3 px-4">Stato</th>
                <th className="py-3 px-4">Dettagli Operazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e3e8ee]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-[#0a2540]">
                    {log.eventType}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#0a2540]">
                    {log.userEmail}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.ipAddress}
                  </td>
                  <td className="py-3 px-4">
                    {getEventBadge(log.status)}
                  </td>
                  <td className="py-3 px-4 text-[#425466] max-w-xs truncate" title={log.details}>
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

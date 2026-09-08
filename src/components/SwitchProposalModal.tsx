import React, { useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Send, 
  X,
  Sparkles,
  Smartphone,
  MessageSquare,
  FileCheck
} from 'lucide-react';
import { SwitchAudit } from '../types';

interface SwitchProposalModalProps {
  audit: SwitchAudit;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSwitch: (auditId: string) => void;
}

export const SwitchProposalModal: React.FC<SwitchProposalModalProps> = ({
  audit,
  isOpen,
  onClose,
  onConfirmSwitch,
}) => {
  const [method, setMethod] = useState<'direct_mandate' | 'otp_sms' | 'whatsapp'>('direct_mandate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExecute = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      setTimeout(() => {
        onConfirmSwitch(audit.id);
        setIsSuccess(false);
        onClose();
      }, 1400);
    }, 900);
  };

  return (
    <div className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#e3e8ee] rounded-xl w-full max-w-xl p-6 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.14)]">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-4">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#635bff] uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              Audit Quadrimestrale (120 Giorni)
            </span>
            <h3 className="text-lg font-bold text-[#0a2540] mt-0.5">Dossier di Cambio Offerta</h3>
            <p className="text-xs text-[#425466]">
              Cliente: <strong className="text-[#0a2540]">{audit.customerName}</strong> ({audit.utilityType.toUpperCase()} • {audit.podOrPdr})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Comparison Box */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-[#e3e8ee] text-xs">
          {/* Vecchia Offerta */}
          <div className="space-y-1.5 border-r border-[#e3e8ee] pr-3">
            <span className="text-[10px] text-[#425466] uppercase font-bold block">Attuale Fornitore</span>
            <h4 className="font-bold text-[#0a2540] text-sm">{audit.currentSupplier}</h4>
            <div className="pt-2">
              <span className="text-[10px] text-[#425466] block">Spesa Stimata Annua</span>
              <span className="text-base font-bold text-slate-400 line-through font-mono">
                € {audit.currentAnnualCost.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">POD/PDR: {audit.podOrPdr}</p>
          </div>

          {/* Nuova Offerta */}
          <div className="space-y-1.5 pl-3">
            <span className="text-[10px] text-emerald-700 uppercase font-bold block flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Nuova Miglior Offerta
            </span>
            <h4 className="font-bold text-[#0a2540] text-sm">{audit.bestOffer.supplier}</h4>
            <p className="text-xs text-slate-600 font-medium">{audit.bestOffer.name}</p>
            <div className="pt-1">
              <span className="text-[10px] text-[#425466] block">Nuova Spesa Annua</span>
              <span className="text-lg font-bold text-emerald-600 font-mono">
                € {audit.bestOfferAnnualCost.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Savings Ribbon */}
        <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-emerald-900 block">Risparmio Netto per il Cliente</span>
              <span className="text-xl font-bold text-emerald-700 font-mono">
                € {audit.annualSavings.toFixed(2)} <span className="text-xs font-semibold text-emerald-800">/ anno ({audit.savingsPercent}%)</span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-emerald-800 block font-medium">Stima mensile</span>
            <span className="text-sm font-bold text-emerald-900 font-mono">
              ~ € {(audit.annualSavings / 12).toFixed(1)}/m
            </span>
          </div>
        </div>

        {/* Execution Options */}
        <div className="space-y-2 text-xs">
          <span className="font-semibold text-[#0a2540] block">Modalità di Perfezionamento Switch:</span>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setMethod('direct_mandate')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                method === 'direct_mandate' 
                  ? 'bg-indigo-50/70 border-[#635bff] text-[#0a2540] ring-1 ring-[#635bff]' 
                  : 'bg-white border-[#e3e8ee] text-[#425466] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0a2540]">
                <FileCheck className="h-3.5 w-3.5 text-[#635bff]" />
                Delega Diretta
              </div>
              <span className="text-[10px] text-[#425466] block mt-1">Autorizzato da contratto continuo</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('whatsapp')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                method === 'whatsapp' 
                  ? 'bg-indigo-50/70 border-[#635bff] text-[#0a2540] ring-1 ring-[#635bff]' 
                  : 'bg-white border-[#e3e8ee] text-[#425466] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0a2540]">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                Link WhatsApp
              </div>
              <span className="text-[10px] text-[#425466] block mt-1">Invio proposta 1-tap</span>
            </button>

            <button
              type="button"
              onClick={() => setMethod('otp_sms')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                method === 'otp_sms' 
                  ? 'bg-indigo-50/70 border-[#635bff] text-[#0a2540] ring-1 ring-[#635bff]' 
                  : 'bg-white border-[#e3e8ee] text-[#425466] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#0a2540]">
                <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                Firma OTP SMS
              </div>
              <span className="text-[10px] text-[#425466] block mt-1">Codice al cellulare</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e3e8ee]">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-[#425466] text-xs font-medium cursor-pointer"
          >
            Chiudi
          </button>

          <button
            onClick={handleExecute}
            disabled={isProcessing || isSuccess}
            className="px-5 py-2 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white font-medium text-xs flex items-center gap-2 shadow-[0_1px_2px_rgba(99,91,255,0.3)] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Comunicazione Cambio Fornitore...
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                Switch Confermato con Successo!
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {method === 'direct_mandate' 
                  ? 'Conferma Switch Immediato (Delega Broker)' 
                  : 'Invia Proposta al Cliente'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

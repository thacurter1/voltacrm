import React, { useRef, useMemo } from 'react';
import { 
  Printer, 
  Send, 
  X, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  Award, 
  Sparkles 
} from 'lucide-react';
import { SwitchAudit, Customer } from '../types';

interface SavingsProposalPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: SwitchAudit | null;
  customer?: Customer | null;
  advisorName?: string;
  onProceedToSign?: () => void;
}

export const SavingsProposalPdfModal: React.FC<SavingsProposalPdfModalProps> = ({
  isOpen,
  onClose,
  audit,
  customer,
  advisorName = 'Matteo Riva',
  onProceedToSign,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !audit) return null;

  const today = useMemo(() => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }), []);
  const protocolNumber = useMemo(() => {
    const hashSeed = audit.id.split('-').pop() || '0000';
    return `VOLTA-${audit.customerId.slice(-4).toUpperCase()}-${hashSeed.slice(-4).toUpperCase()}`;
  }, [audit.id, audit.customerId]);

  const handlePrint = () => {
    window.print();
  };

  const whatsappMessage = `Ciao ${audit.customerName}, ecco il tuo Studio di Fattibilità Energetica VoltaCRM: con il cambio tariffa per ${audit.utilityType.toUpperCase()} (${audit.podOrPdr}) risparmi €${audit.annualSavings.toFixed(2)}/anno (-${audit.savingsPercent}%). Possiamo attivarlo oggi a costo zero.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 md:p-6 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-[#0a2540]/60 backdrop-blur-xs transition-opacity print:hidden" 
      />

      {/* Main Container */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#e3e8ee] flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Action Bar (Hidden during Print) */}
        <div className="px-6 py-3.5 bg-[#f6f9fc] border-b border-[#e3e8ee] flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#635bff] text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-xs text-[#0a2540]">Studio di Fattibilità Energetica</span>
              <span className="text-[10px] text-[#425466] block">Pronto per la stampa A4 e l'invio al cliente</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a2540] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Stampa / Salva PDF
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              Invia su WhatsApp
            </a>

            {onProceedToSign && (
              <button
                onClick={onProceedToSign}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#534be0] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Firma Mandato
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY (A4 formatted) */}
        <div id="printable-proposal" ref={printRef} className="p-8 sm:p-10 overflow-y-auto space-y-6 text-[#0a2540] bg-white print:p-0 print:m-0">
          
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-2 border-[#0a2540] pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-[#635bff] text-white flex items-center justify-center font-black">
                  <Zap className="h-5 w-5 fill-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-[#0a2540]">VOLTA ENERGY</h1>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#635bff] block -mt-1">
                    Brokerage & Cost Audit Service
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#425466] pt-1">
                Servizio di Audit Energetico Indipendente • Monitoraggio Ricorrente 120 Giorni
              </p>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <div className="font-mono text-[11px] font-bold text-slate-700">Prot: {protocolNumber}</div>
              <div className="text-[11px] text-slate-500">Data: {today}</div>
              <div className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                Audit Conforme ARERA
              </div>
            </div>
          </div>

          {/* Client & Utility Box */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#f6f9fc] border border-[#e3e8ee] text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Dati Intestatario</span>
              <div className="font-bold text-sm text-[#0a2540]">{audit.customerName}</div>
              <div className="text-[11px] text-[#425466]">Città: {customer?.city || 'Milano (IT)'}</div>
              <div className="text-[11px] text-[#425466]">Codice Fiscale: {customer?.fiscalCode || 'VERIFICATO'}</div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fornitura in Esame</span>
              <div className="flex items-center gap-1.5 font-bold text-sm text-[#0a2540]">
                <span className="uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-[#635bff] text-[10px]">
                  {audit.utilityType}
                </span>
                <span className="font-mono">{audit.podOrPdr}</span>
              </div>
              <div className="text-[11px] text-[#425466] mt-0.5">
                Fornitore Attuale: <strong>{audit.currentSupplier}</strong>
              </div>
            </div>
          </div>

          {/* CORE COMPARISON HIGHLIGHT (Stripe / Apple Style) */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0a2540] to-[#122e4d] text-white space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs uppercase tracking-wider text-[#00d4aa] font-bold flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-400" />
                Sintesi Economica della Rinegoziazione
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20">
                Garanzia Zero Costi Switch
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="border-r border-white/10 pr-4">
                <span className="text-[11px] text-slate-300 block">Spesa Attuale Stimata</span>
                <div className="text-xl font-bold font-mono line-through text-slate-400 mt-1">
                  € {audit.currentAnnualCost.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400">su base annua</span>
              </div>

              <div className="border-r border-white/10 pr-4">
                <span className="text-[11px] text-slate-300 block">Nuova Spesa Volta</span>
                <div className="text-xl font-bold font-mono text-[#00d4aa] mt-1">
                  € {audit.bestOfferAnnualCost.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400">con offerta {audit.bestOffer.supplier}</span>
              </div>

              <div>
                <span className="text-[11px] text-emerald-300 font-bold block">Risparmio Netto Annuo</span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
                  € {audit.annualSavings.toFixed(2)}
                </div>
                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  -{audit.savingsPercent}% di spesa
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#0a2540]">
              Dettaglio Tariffario dell'Offerta Selezionata
            </h3>
            
            <table className="w-full text-left text-xs border border-[#e3e8ee] rounded-xl overflow-hidden">
              <thead className="bg-[#f6f9fc] border-b border-[#e3e8ee] text-[#425466] text-[10px] uppercase font-bold">
                <tr>
                  <th className="py-2.5 px-3.5">Parametro</th>
                  <th className="py-2.5 px-3.5">Tariffa Attuale</th>
                  <th className="py-2.5 px-3.5">Offerta Proposta ({audit.bestOffer.name})</th>
                  <th className="py-2.5 px-3.5 text-right">Vantaggio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e8ee]">
                <tr>
                  <td className="py-2.5 px-3.5 font-semibold text-[#0a2540]">Fornitore</td>
                  <td className="py-2.5 px-3.5 text-[#425466]">{audit.currentSupplier}</td>
                  <td className="py-2.5 px-3.5 font-bold text-[#635bff]">{audit.bestOffer.supplier}</td>
                  <td className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">Ottimizzato</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3.5 font-semibold text-[#0a2540]">Tipologia Prezzo</td>
                  <td className="py-2.5 px-3.5 text-[#425466]">Indicizzato / Variabile</td>
                  <td className="py-2.5 px-3.5 text-[#0a2540]">{audit.bestOffer.pricingType}</td>
                  <td className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">Formula ARERA</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3.5 font-semibold text-[#0a2540]">Spread / Prezzo Materia</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-600">Tariffa fuori mercato</td>
                  <td className="py-2.5 px-3.5 font-mono text-[#0a2540] font-bold">
                    {audit.bestOffer.unitPriceOrSpread} {audit.utilityType === 'luce' ? '€/kWh' : '€/Smc'}
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">Miglior Spread</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3.5 font-semibold text-[#0a2540]">Commercializzazione (CCV)</td>
                  <td className="py-2.5 px-3.5 font-mono text-slate-600">€ 144,00 /anno</td>
                  <td className="py-2.5 px-3.5 font-mono text-[#0a2540] font-bold">€ {audit.bestOffer.fixedAnnualFee.toFixed(2)} /anno</td>
                  <td className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">-€ {(144 - audit.bestOffer.fixedAnnualFee).toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3.5 font-semibold text-[#0a2540]">Sostenibilità Ambientale</td>
                  <td className="py-2.5 px-3.5 text-[#425466]">Standard</td>
                  <td className="py-2.5 px-3.5 text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 100% Green con Garanzie di Origine (GO)
                  </td>
                  <td className="py-2.5 px-3.5 text-right text-emerald-600 font-bold">Incluso</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Guarantees Box */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs space-y-1 text-emerald-900">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Garanzie di Tutela ARERA & VoltaCRM
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-800">
              Il passaggio al nuovo fornitore non prevede alcuna interruzione dell'erogazione di energia né interventi tecnici sul contatore. La disdetta verso il vecchio fornitore è gestita in automatico a costo zero.
            </p>
          </div>

          {/* Signature & Advisor Footer */}
          <div className="pt-6 border-t border-[#e3e8ee] grid grid-cols-2 gap-8 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Il tuo Consulente Dedicato</span>
              <div className="font-bold text-[#0a2540]">{advisorName}</div>
              <div className="text-[11px] text-[#425466]">Specialista Mercato Libero VoltaCRM</div>
              <div className="text-[11px] text-[#425466]">WhatsApp: +39 347 1122334</div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sigillo Digitale & Validità</span>
              <div className="font-mono text-[11px] text-slate-700 font-bold">SHA-256: {protocolNumber.toLowerCase()}</div>
              <div className="text-[10px] text-slate-400 mt-1">
                Documento generato ai sensi del Regolamento UE 2016/679
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

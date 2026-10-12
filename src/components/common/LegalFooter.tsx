import React from 'react';
import { ShieldCheck, Phone, Mail, Zap, Scale, FileText, CheckCircle2 } from 'lucide-react';
import type { LegalTab } from './LegalModal';

export interface LegalFooterProps {
  onOpenLegal?: (tab: LegalTab) => void;
}

export const LegalFooter: React.FC<LegalFooterProps> = ({ onOpenLegal }) => {
  const handleOpen = (tab: LegalTab) => {
    if (onOpenLegal) {
      onOpenLegal(tab);
    }
  };

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white text-slate-600 font-sans">
      {/* Top Banner / Trust Bar */}
      <div className="border-b border-slate-100 bg-[#f8fafc] py-6 px-6">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="font-bold text-[#0a2540]">Zero Costi e Zero Vincoli</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Il confronto online e la consulenza con i nostri esperti sono sempre 100% gratuiti. Nessun passaggio forzato.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
              <Scale className="size-5" />
            </span>
            <div>
              <p className="font-bold text-[#0a2540]">Trasparenza ARERA</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Stime calcolate su parametri reali (PUN, PSV, quota fissa CCV/PCV, oneri passanti). Nessun costo occultato.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#f0efff] text-[#635bff] shrink-0 mt-0.5">
              <Phone className="size-5" />
            </span>
            <div>
              <p className="font-bold text-[#0a2540]">Assistenza Diretta Gratuita</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Numero Verde <strong>800 912 345</strong> attivo dal lunedì al venerdì dalle 9:00 alle 18:00.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Corporate Section */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand & Presentation */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#635bff] text-white">
                <Zap className="size-4" />
              </span>
              <span className="text-lg font-extrabold text-[#0a2540] tracking-tight">Volta Energia</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Piattaforma di consulenza e confronto indipendente per luce e gas. Aiutiamo famiglie e imprese a ridurre le spese energetiche con massima trasparenza.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold pt-1">
              <ShieldCheck className="size-4" />
              <span>Connessione Protetta & Crittografata</span>
            </div>
          </div>

          {/* Col 2: Institutional & Legal Details */}
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#0a2540] text-[11px]">Dati Societari</p>
            <p className="font-semibold text-slate-800">Volta Energia S.r.l.</p>
            <p>Sede Legale: Via Monte Napoleone 8, 20121 Milano (MI)</p>
            <p>P.IVA e Codice Fiscale: <strong>12948570155</strong></p>
            <p>REA: MI-2684910 • Cap. Soc. € 100.000,00 i.v.</p>
            <p className="text-slate-500 pt-1">
              Volta Energia opera come mediatore e consulente energetico indipendente per il libero mercato, ai sensi della regolamentazione ARERA.
            </p>
          </div>

          {/* Col 3: Contacts */}
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#0a2540] text-[11px]">Contatti & Supporto</p>
            <p className="flex items-center gap-2">
              <Phone className="size-3.5 text-[#635bff]" />
              <span>Numero Verde: <strong>800 912 345</strong></span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-3.5 text-[#635bff]" />
              <span>Email: <a href="mailto:supporto@voltaenergia.it" className="text-[#635bff] hover:underline">supporto@voltaenergia.it</a></span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-3.5 text-[#635bff]" />
              <span>PEC: <a href="mailto:voltaenergia@pec.it" className="text-[#635bff] hover:underline">voltaenergia@pec.it</a></span>
            </p>
            <p className="text-slate-500 pt-1">Orario supporto: Lunedì - Venerdì, 9:00 - 18:00</p>
          </div>

          {/* Col 4: Legal & Transparency Links */}
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#0a2540] text-[11px]">Tutela del Consumatore</p>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('privacy')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-[#635bff] transition underline-offset-2 hover:underline"
                >
                  <FileText className="size-3.5 text-slate-400" />
                  Informativa Privacy (GDPR)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('arera')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-[#635bff] transition underline-offset-2 hover:underline"
                >
                  <Scale className="size-3.5 text-slate-400" />
                  Condizioni e Trasparenza ARERA
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('terms')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-[#635bff] transition underline-offset-2 hover:underline"
                >
                  <FileText className="size-3.5 text-slate-400" />
                  Termini di Servizio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('privacy')}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-[#635bff] transition underline-offset-2 hover:underline"
                >
                  <span>Preferenze Cookie</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Volta Energia S.r.l. - Tutti i diritti riservati.</p>
          <p className="text-center sm:text-right">
            Tariffe e simulazioni a scopo informativo e comparativo. Condizioni definitive verificate con l'operatore prima della sottoscrizione.
          </p>
        </div>
      </div>
    </footer>
  );
};

import React from 'react';
import { ShieldCheck, Phone, Mail, Scale, FileText, CheckCircle2 } from 'lucide-react';
import type { LegalTab } from './LegalModal';
import { COMPANY_PROFILE } from '../../config/companyProfile';

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
      <div className="border-b border-[#DCE5E8] bg-[#F6F9FA] py-6 px-6">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#EAF4F0] text-[#0A6847] shrink-0 mt-0.5">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <p className="font-bold text-[#0F222D]">Confronta prima di decidere</p>
              <p className="text-xs text-[#445966] mt-0.5">
                Consultare le stime non attiva un contratto. Puoi valutare le condizioni prima di richiedere una consulenza.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#EAF4F0] text-[#0A3B40] shrink-0 mt-0.5">
              <Scale className="size-5" />
            </span>
            <div>
              <p className="font-bold text-[#0F222D]">Trasparenza ARERA</p>
              <p className="text-xs text-[#445966] mt-0.5">
                Ogni stima indica i consumi e i parametri utilizzati. Controlla la data di riferimento degli indici e le condizioni dell’offerta.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#EAF4F0] text-[#0A6847] shrink-0 mt-0.5">
              <Phone className="size-5" />
            </span>
            <div>
              <p className="font-bold text-[#0F222D]">Contatti e assistenza</p>
              <p className="text-xs text-[#445966] mt-0.5">
                Numero Verde <strong>{COMPANY_PROFILE.tollFreePhone || '800 912 345'}</strong> attivo dal lunedì al venerdì dalle 9:00 alle 18:00.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Corporate Section */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {!COMPANY_PROFILE.isConfiguredCorporateIdentity && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900">
            <strong>Nota Ambiente Dimostrativo:</strong> I dati societari e i recapiti telefonici/PEC esposti di seguito ({COMPANY_PROFILE.name}, P.IVA {COMPANY_PROFILE.vatNumber}) sono esempi dimostrativi. I recapiti effettivi saranno disponibili prima dell’apertura del servizio.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Col 1: Brand & Presentation */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2.5">
              <svg className="w-8 h-8 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <rect width="32" height="32" rx="7" fill="#0A3B40" />
                <path d="M9.5 9.5L16 23L22.5 9.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 9.5L16 16L19 9.5" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-lg font-extrabold text-[#0F222D] tracking-tight">Volta Energia</span>
            </div>
            <p className="text-xs leading-relaxed text-[#445966]">
              Confronta i costi di luce e gas, consulta le condizioni e richiedi assistenza per valutare la tua fornitura.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-[#0A6847] font-semibold pt-1">
              <ShieldCheck className="size-4" />
              <span>Connessione Protetta & Crittografata</span>
            </div>
          </div>

          {/* Col 2: Institutional & Legal Details */}
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#0F222D] text-[11px]">Dati Societari</p>
            <p className="font-semibold text-slate-800">{COMPANY_PROFILE.name || 'Volta Energia S.r.l.'}</p>
            <p>Sede Legale: {COMPANY_PROFILE.address || 'Via Monte Napoleone 8, 20121 Milano (MI)'}</p>
            <p>P.IVA e Codice Fiscale: <strong>{COMPANY_PROFILE.vatNumber || '12948570155'}</strong></p>
            <p>REA: {COMPANY_PROFILE.reaNumber || 'MI-2684910'} • Cap. Soc. {COMPANY_PROFILE.shareCapital || '€ 100.000,00 i.v.'}</p>
            <p className="text-slate-500 pt-1">
              Volta Energia opera come mediatore e consulente energetico indipendente per il libero mercato, ai sensi della regolamentazione ARERA.
            </p>
          </div>

          {/* Col 3: Contacts */}
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#0F222D] text-[11px]">Contatti & Supporto</p>
            <p className="flex items-center gap-2">
              <Phone className="size-3.5 text-[#0A6847]" />
              <span>Numero Verde: <strong>{COMPANY_PROFILE.tollFreePhone || '800 912 345'}</strong></span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-3.5 text-[#0A6847]" />
              <span>Email: <a href={`mailto:${COMPANY_PROFILE.supportEmail}`} className="text-[#0A6847] hover:underline">{COMPANY_PROFILE.supportEmail}</a></span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-3.5 text-[#0A6847]" />
              <span>PEC: <a href={`mailto:${COMPANY_PROFILE.pecEmail}`} className="text-[#0A6847] hover:underline">{COMPANY_PROFILE.pecEmail}</a></span>
            </p>
            <p className="text-slate-500 pt-1">Orario supporto: Lunedì - Venerdì, 9:00 - 18:00</p>
          </div>

          {/* Col 4: Legal & Transparency Links */}
          <div className="space-y-2 text-xs">
            <p className="font-bold uppercase tracking-wider text-[#0F222D] text-[11px]">Tutela del Consumatore</p>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('privacy')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-[#0A6847] transition underline-offset-2 hover:underline"
                >
                  <FileText className="size-3.5 text-slate-400" />
                  Informativa Privacy (GDPR)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('arera')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-[#0A6847] transition underline-offset-2 hover:underline"
                >
                  <Scale className="size-3.5 text-slate-400" />
                  Condizioni e Trasparenza ARERA
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('terms')}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-[#0A6847] transition underline-offset-2 hover:underline"
                >
                  <FileText className="size-3.5 text-slate-400" />
                  Termini di Servizio
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpen('privacy')}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-[#0A6847] transition underline-offset-2 hover:underline"
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

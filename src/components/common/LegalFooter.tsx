import React from 'react';
import { Phone, Mail, Info } from 'lucide-react';
import type { LegalTab } from './LegalModal';
import { COMPANY_PROFILE } from '../../config/companyProfile';
import { VoltaBrandMark } from './VoltaBrandMark';

export interface LegalFooterProps {
  onOpenLegal?: (tab: LegalTab) => void;
}

const linkCls =
  'inline-flex min-h-11 items-center text-left text-sm text-[#0F222D] underline decoration-[#DCE5E8] underline-offset-4 hover:text-[#0A6847] hover:decoration-[#0A6847] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0A6847]';

export const LegalFooter: React.FC<LegalFooterProps> = ({ onOpenLegal }) => {
  const handleOpen = (tab: LegalTab) => onOpenLegal?.(tab);
  const phone = COMPANY_PROFILE.tollFreePhone || '800 912 345';

  return (
    <footer className="mt-auto border-t border-[#DCE5E8] bg-white text-[#445966]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {!COMPANY_PROFILE.isConfiguredCorporateIdentity && (
          // Kept visible until real company data is configured (no flag hides it).
          <p className="mb-8 flex items-start gap-2.5 rounded-[10px] border border-[#C9DCE8] bg-[#EAF2F7] px-4 py-3 text-sm text-[#0F3D57]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#145374]" aria-hidden="true" />
            <span>
              <strong>Dati societari dimostrativi.</strong> Ragione sociale, P.IVA e recapiti qui sotto ({COMPANY_PROFILE.name}, P.IVA {COMPANY_PROFILE.vatNumber}) sono esempi: quelli effettivi saranno pubblicati prima dell’apertura del servizio.
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <VoltaBrandMark className="h-8 w-8" />
              <span className="text-lg font-bold tracking-tight text-[#0F222D]">Volta Energia</span>
            </div>
            <p className="max-w-[40ch] text-sm leading-relaxed">
              Confronta i costi di luce e gas, consulta le condizioni e chiedi assistenza prima di decidere. Consultare le stime non attiva un contratto.
            </p>
          </div>

          <div className="space-y-1.5 text-sm">
            <h2 className="mb-2 text-base font-bold text-[#0F222D]">Dati societari</h2>
            <p className="font-semibold text-[#0F222D]">{COMPANY_PROFILE.name || 'Volta Energia S.r.l.'}</p>
            <p>Sede legale: {COMPANY_PROFILE.address || 'Via Monte Napoleone 8, 20121 Milano (MI)'}</p>
            <p>P.IVA e C.F.: <span className="font-mono tabular-nums text-[#0F222D]">{COMPANY_PROFILE.vatNumber || '12948570155'}</span></p>
            <p>REA {COMPANY_PROFILE.reaNumber || 'MI-2684910'} · Cap. Soc. {COMPANY_PROFILE.shareCapital || '€ 100.000,00 i.v.'}</p>
            <p className="pt-1">
              Volta Energia opera come mediatore e consulente energetico indipendente per il libero mercato, ai sensi della regolamentazione ARERA.
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <h2 className="mb-2 text-base font-bold text-[#0F222D]">Contatti e assistenza</h2>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-[#0A6847]" aria-hidden="true" />
              <span>Numero Verde <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-mono font-semibold tabular-nums text-[#0F222D] underline-offset-4 hover:underline">{phone}</a></span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[#0A6847]" aria-hidden="true" />
              <a href={`mailto:${COMPANY_PROFILE.supportEmail}`} className={linkCls}>{COMPANY_PROFILE.supportEmail}</a>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-[#0A6847]" aria-hidden="true" />
              <span className="inline-flex items-center gap-1">PEC <a href={`mailto:${COMPANY_PROFILE.pecEmail}`} className={linkCls}>{COMPANY_PROFILE.pecEmail}</a></span>
            </p>
            <p>Lunedì – venerdì, 9:00 – 18:00</p>
          </div>

          <nav aria-label="Informazioni legali" className="text-sm">
            <h2 className="mb-2 text-base font-bold text-[#0F222D]">Tutela del consumatore</h2>
            <ul>
              <li><button type="button" onClick={() => handleOpen('privacy')} className={linkCls}>Informativa privacy (GDPR)</button></li>
              <li><button type="button" onClick={() => handleOpen('arera')} className={linkCls}>Condizioni e trasparenza ARERA</button></li>
              <li><button type="button" onClick={() => handleOpen('terms')} className={linkCls}>Termini di servizio</button></li>
              <li><button type="button" onClick={() => handleOpen('privacy')} className={linkCls}>Cookie: solo tecnici</button></li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[#DCE5E8] pt-6 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p className="shrink-0">© {new Date().getFullYear()} Volta Energia S.r.l.</p>
          <p className="max-w-[70ch] sm:text-right">
            Tariffe e simulazioni a scopo informativo e comparativo. Le condizioni definitive vengono verificate con l’operatore prima della sottoscrizione.
          </p>
        </div>
      </div>
    </footer>
  );
};

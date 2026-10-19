import React, { useEffect, useState, useCallback } from 'react';
import { X, ShieldCheck, FileText, Scale, CheckCircle2, Phone, Mail, Building2 } from 'lucide-react';
import { COMPANY_PROFILE } from '../../config/companyProfile';

export type LegalTab = 'privacy' | 'arera' | 'terms';

export interface LegalModalProps {
  isOpen: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTabOverride, setActiveTabOverride] = useState<LegalTab | null>(null);
  const activeTab = activeTabOverride ?? initialTab;

  const handleClose = useCallback(() => {
    setActiveTabOverride(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-[#635bff] text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 id="legal-modal-title" className="text-lg font-bold text-[#0a2540]">
                Informazioni Legali & Trasparenza
              </h2>
              <p className="text-xs text-slate-500">
                {COMPANY_PROFILE.name || 'Volta Energia S.r.l.'} • P.IVA {COMPANY_PROFILE.vatNumber || '12948570155'}
                {!COMPANY_PROFILE.isConfiguredCorporateIdentity && ' (Profilo Dimostrativo)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition focus-visible:outline-2 focus-visible:outline-[#635bff]"
            aria-label="Chiudi finestra modale"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => setActiveTabOverride('privacy')}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'privacy'
                ? 'border-[#635bff] text-[#635bff]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="size-4" />
            Informativa Privacy (GDPR)
          </button>
          <button
            type="button"
            onClick={() => setActiveTabOverride('arera')}
            className={`ml-6 flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'arera'
                ? 'border-[#635bff] text-[#635bff]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="size-4" />
            Trasparenza ARERA & Criteri
          </button>
          <button
            type="button"
            onClick={() => setActiveTabOverride('terms')}
            className={`ml-6 flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'terms'
                ? 'border-[#635bff] text-[#635bff]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="size-4" />
            Termini di Servizio
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-700 space-y-6 leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 text-xs flex gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold">Zero Telemarketing Aggressivo e Nessuna Cessione a Terzi</p>
                  <p className="mt-0.5">
                    Volta Energia rifiuta pratiche di telemarketing aggressivo e non effettua alcuna cessione a terzi dei tuoi recapiti o delle tue bollette. I tuoi dati vengono impiegati unicamente dal nostro team per l'elaborazione del confronto energetico richiesto.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">
                  1. Titolare del Trattamento (Art. 13-14 Regolamento UE 2016/679 - GDPR)
                </h3>
                <p>
                  Il Titolare del trattamento è <strong>Volta Energia S.r.l.</strong>, con sede legale in Via Monte Napoleone 8, 20121 Milano (MI), P.IVA e Codice Fiscale 12948570155. Contatto privacy:{' '}
                  <a href="mailto:privacy@voltaenergia.it" className="text-[#635bff] underline">privacy@voltaenergia.it</a>.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">2. Finalità e Base Giuridica del Trattamento</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>Erogazione della simulazione e preventivo:</strong> calcolo del risparmio energetico stimato e confronto tariffe per la fornitura luce e gas. Base giuridica: esecuzione di misure precontrattuali su richiesta dell'interessato (Art. 6.1.b GDPR).
                  </li>
                  <li>
                    <strong>Ricontatto consulenziale:</strong> risposta alla richiesta esplicita di assistenza tramite telefono, WhatsApp o email con un consulente dedicato.
                  </li>
                  <li>
                    <strong>Analisi bolletta caricata:</strong> verifica tecnica dei parametri di consumo (POD/PDR, potenza contrattuale, fasce orarie F1/F2/F3) per individuare la tariffa più conveniente.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">3. Conservazione dei Dati e Cookie</h3>
                <p>
                  I dati raccolti vengono conservati per il tempo strettamente necessario all'evasione della consulenza energetica e non oltre 24 mesi, salvo consenso esplicito per il monitoraggio continuativo del mercato. Questo sito fa uso esclusivo di <strong>cookie tecnici essenziali</strong> per il corretto funzionamento del comparatore e non impiega cookie di profilazione commerciale invasiva.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">4. Diritti dell'Interessato (Art. 15-22 GDPR)</h3>
                <p>
                  Puoi in qualsiasi momento esercitare i diritti di accesso, rettifica, cancellazione, limitazione e revoca del consenso inviando una comunicazione a <a href="mailto:privacy@voltaenergia.it" className="text-[#635bff] underline">privacy@voltaenergia.it</a>. Hai inoltre diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'arera' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-blue-900 text-xs flex gap-3">
                <Scale className="size-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold">Trasparenza ARERA & Confrontabilità delle Offerte</p>
                  <p className="mt-0.5">
                    Tutti i calcoli esposti nel comparatore Volta Energia rispettano le linee guida dell'Autorità di Regolazione per Energia Reti e Ambiente (ARERA) in materia di confrontabilità della spesa energetica.
                  </p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">1. Parametri di Mercato e Indici di Riferimento (PUN e PSV)</h3>
                <p>
                  Per le offerte a prezzo variabile o indicizzato, la stima della spesa fa riferimento ai valori di benchmark ufficiali:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    <strong>PUN (Prezzo Unico Nazionale):</strong> indice all'ingrosso dell'energia elettrica espresso in €/kWh calcolato dal GME (Gestore dei Mercati Energetici).
                  </li>
                  <li>
                    <strong>PSV (Punto di Scambio Virtuale):</strong> indice all'ingrosso del gas naturale in Italia espresso in €/Smc.
                  </li>
                  <li>
                    <strong>Spread / Corrispettivo di commercializzazione:</strong> il margine applicato dal fornitore viene chiaramente evidenziato nella scheda offerta.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">2. Scomposizione della Spesa in 4 Componenti</h3>
                <p>
                  La spesa annua stimata include tutte e 4 le voci previste dalla bolletta 2.0 ARERA:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                  <li><strong>Spesa per la Materia Energia:</strong> quota fissa (CCV/PCV) e quota energia al consumo.</li>
                  <li><strong>Spesa per il Trasporto e Gestione Contatore:</strong> componenti passanti determinate da ARERA.</li>
                  <li><strong>Spesa per gli Oneri di Sistema:</strong> componenti tariffarie generali fissate per legge.</li>
                  <li><strong>Imposte e IVA:</strong> accise e IVA agevolata secondo la normativa fiscale vigente.</li>
                </ol>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">3. Nessun Costo Nascosto e Condizioni Contrattuali</h3>
                <p>
                  Il confronto effettuato è gratuito e non vincolante. Prima di procedere all'eventuale sottoscrizione di qualsiasi contratto, il cliente riceverà la <em>Scheda di Confrontabilità</em> e la <em>Scheda Sintetica</em> approvate da ARERA per la conferma definitiva delle condizioni economiche.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">1. Oggetto del Servizio</h3>
                <p>
                  Volta Energia offre un servizio gratuito di comparazione, orientamento e consulenza indipendente per tariffe di energia elettrica e gas naturale dedicate a clienti domestici e piccole imprese.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">2. Assenza di Vincoli Contrattuali Immediati</h3>
                <p>
                  L'utilizzo del comparatore online e l'invio della richiesta di preventivo o della bolletta non comportano alcun vincolo né l'attivazione immediata di contratti di fornitura. Il cambio fornitore (switch) viene avviato esclusivamente a seguito di espressa conferma del cliente tramite firma elettronica o registrazione vocale certificata.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">3. Accuratezza delle Stime</h3>
                <p>
                  Le stime di spesa e risparmio sono elaborate sulla base dei consumi dichiarati dall'utente o rilevati dalla bolletta caricata. Volta Energia applica rigorosi algoritmi di benchmark ma consiglia sempre la verifica puntuale della propria fattura recente con l'ausilio di un consulente.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base font-bold text-[#0a2540]">4. Contatti Istituzionali</h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5 text-xs">
                  <p className="flex items-center gap-2">
                    <Phone className="size-4 text-[#635bff]" /> Numero Verde Gratuito: <strong>800 912 345</strong> (Lun-Ven 9:00 - 18:00)
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="size-4 text-[#635bff]" /> Email di supporto: <strong>supporto@voltaenergia.it</strong>
                  </p>
                  <p className="flex items-center gap-2">
                    <Building2 className="size-4 text-[#635bff]" /> PEC: <strong>voltaenergia@pec.it</strong>
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3.5 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-[#635bff] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#534be5] transition focus-visible:outline-2 focus-visible:outline-[#635bff]"
          >
            Ho compreso e chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

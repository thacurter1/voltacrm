import { useState } from 'react';
import { ArrowRight, FileText, Zap, Flame, Plus, Check } from 'lucide-react';
import type { UtilityType } from '../../services/offerComparison';
import { CURRENT_MARKET_INDEX } from '../../services/energyEngine';

interface Props {
  onStart: (utility: UtilityType, mode: 'wizard' | 'upload') => void;
}
const faqs = [
  ['Serve una bolletta per iniziare?', 'No. Puoi stimare i consumi dalle caratteristiche della casa. Con una bolletta hai invece un punto di partenza più preciso.'],
  ['Il confronto attiva un contratto?', 'No. Puoi consultare le stime e chiedere una consulenza. Un’eventuale attivazione richiede un passaggio separato e la tua conferma.'],
  ['Posso confrontare luce e gas?', 'Sì, una fornitura alla volta. Parti dalla luce o dal gas; per valutare entrambe puoi richiedere assistenza durante il percorso.'],
  ['Quali file posso caricare?', 'Una bolletta in PDF, JPG o PNG, fino a 10 MB. Dopo il caricamento, la richiesta passa in verifica.'],
  ['Il prezzo mostrato è definitivo?', 'È una stima basata sui consumi inseriti e sulle condizioni disponibili. Controlla sempre la data dei parametri e i dettagli dell’offerta: le condizioni definitive vengono confermate prima della sottoscrizione.'],
];

export function EnergyWelcome({ onStart }: Props) {
  const [utility, setUtility] = useState<UtilityType>('luce');
  const [both, setBoth] = useState(false);
  const action = 'min-h-12 px-5 py-3 rounded-xl font-bold text-sm inline-flex items-center justify-center gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand transition-colors';
  return (
    <div className="space-y-14 sm:space-y-20 py-1 sm:py-4">
      <section className="relative overflow-hidden rounded-3xl bg-ink text-white" aria-labelledby="welcome-title">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 800 400">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth="0.6" /></pattern></defs>
          <rect width="800" height="400" fill="url(#grid)" />
          <path d="M0 300 C 120 300, 160 120, 280 120 S 440 260, 560 200 S 720 60, 800 80" fill="none" stroke="var(--color-spark)" strokeWidth="2" />
        </svg>
        <div className="relative grid gap-10 p-6 sm:p-10 lg:p-14 lg:grid-cols-[1.1fr_1fr] lg:gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-spark mb-5"><Zap className="w-4 h-4 fill-spark" aria-hidden="true" /> Luce e gas, con Volta</p>
            <h1 id="welcome-title" className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.04]">La tua prossima offerta parte dalla tua bolletta.</h1>
            <p className="mt-6 text-lg leading-relaxed text-white/75 max-w-lg">Confronta i costi per i tuoi consumi e valuta le condizioni. Se ti serve una mano, puoi chiedere una consulenza.</p>
            <p className="mt-6 flex items-center gap-2 text-sm text-white/75"><Check className="w-4 h-4 text-spark" aria-hidden="true" /> Nessun contratto attivato durante il confronto.</p>
            <dl className="mt-10 grid grid-cols-2 gap-px max-w-md overflow-hidden rounded-xl bg-white/15 text-sm">
              <div className="bg-ink px-4 py-3"><dt className="text-white/60 text-xs">PUN luce</dt><dd className="font-display text-xl font-semibold tabular-nums">{CURRENT_MARKET_INDEX.punEurKwh.toFixed(4).replace('.', ',')} <span className="text-xs font-normal text-white/60">€/kWh</span></dd></div>
              <div className="bg-ink px-4 py-3"><dt className="text-white/60 text-xs">PSV gas</dt><dd className="font-display text-xl font-semibold tabular-nums">{CURRENT_MARKET_INDEX.psvEurSmc.toFixed(4).replace('.', ',')} <span className="text-xs font-normal text-white/60">€/Smc</span></dd></div>
            </dl>
            <p className="mt-2 text-xs text-white/50">{CURRENT_MARKET_INDEX.lastUpdated}</p>
          </div>
          <div className="bg-white text-ink rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-bold">Da quale fornitura partiamo?</h2>
            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Scegli la fornitura</legend>
              {([{ label: 'Solo luce', value: 'luce', Icon: Zap }, { label: 'Solo gas', value: 'gas', Icon: Flame }, { label: 'Luce e gas', value: 'both', Icon: Plus }] as const).map(({ label, value, Icon }) => {
                const selected = value === 'both' ? both : !both && utility === value;
                return (
                  <label key={value} className={`flex items-center gap-3 min-h-14 px-4 rounded-xl border-2 cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${selected ? 'border-brand bg-brand-soft' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="welcome-utility" className="accent-brand" checked={selected} onChange={() => { setBoth(value === 'both'); setUtility(value === 'gas' ? 'gas' : 'luce'); }} />
                    <Icon className="w-5 h-5 text-brand" aria-hidden="true" /><span className="font-semibold">{label}</span>
                  </label>
                );
              })}
            </fieldset>
            <p className="text-sm text-slate-500 mt-4 min-h-10" aria-live="polite">{both ? 'Confrontiamo una fornitura alla volta: iniziamo dalla luce, poi puoi passare al gas.' : 'Non hai la bolletta? Ti aiutiamo a stimare i consumi.'}</p>
            <button type="button" onClick={() => onStart(utility, 'wizard')} className={`${action} mt-4 w-full bg-brand hover:bg-brand-hover text-white`}>Confronta le offerte <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
      </section>

      <section className="border-2 border-ink rounded-2xl p-6 sm:p-9 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between" aria-labelledby="bill-entry-title">
        <div className="flex gap-5 items-start">
          <span className="hidden sm:flex w-12 h-12 shrink-0 items-center justify-center rounded-xl bg-spark text-ink"><FileText className="w-6 h-6" aria-hidden="true" /></span>
          <div><p className="text-sm text-slate-600 mb-2">Hai già una bolletta?</p><h2 id="bill-entry-title" className="text-2xl font-bold text-ink">Partiamo dai tuoi consumi reali.</h2><p className="text-sm text-slate-600 mt-3">Carica un PDF o una foto. La richiesta verrà verificata prima della consulenza.</p></div>
        </div>
        <button type="button" onClick={() => onStart(utility, 'upload')} className={`${action} shrink-0 bg-ink text-white hover:bg-ink-soft`}>Analizza la tua bolletta <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
      </section>

      <section aria-labelledby="how-title">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand mb-3">Dal consumo alla scelta</p><h2 id="how-title" className="text-3xl sm:text-4xl font-bold text-ink">Come funziona</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            ['I tuoi consumi', 'Carica una bolletta oppure parti da una stima della casa. Puoi anche inserire i dati a mano.'],
            ['Il confronto', 'Guarda il costo annuo stimato, le quote fisse e le condizioni di ogni offerta.'],
            ['La tua decisione', 'Se trovi una proposta interessante, chiedi una consulenza per verificare i dettagli.'],
          ].map(([title, description], index) => <li key={title} className="relative border-t-2 border-ink pt-6"><span className="absolute -top-[9px] left-0 h-4 w-4 rounded-full bg-spark ring-4 ring-canvas" aria-hidden="true" /><span className="font-display text-sm font-semibold text-brand">0{index + 1}</span><h3 className="mt-2 text-xl font-bold text-ink">{title}</h3><p className="mt-2 text-slate-600 leading-relaxed text-sm">{description}</p></li>)}
        </ol>
      </section>

      <section className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] border-t border-slate-300 pt-10" aria-labelledby="faq-title">
        <div><h2 id="faq-title" className="text-3xl sm:text-4xl font-bold text-ink">Domande frequenti</h2><p className="mt-4 text-slate-600 leading-relaxed">Prima di iniziare, qualche risposta utile.</p></div>
        <div className="divide-y divide-slate-300">{faqs.map(([question, answer]) => <details key={question} className="group py-5 first:pt-0"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink rounded focus-visible:outline-2 focus-visible:outline-brand">{question}<Plus className="w-5 h-5 shrink-0 text-brand transition-transform group-open:rotate-45" aria-hidden="true" /></summary><p className="mt-3 text-sm leading-relaxed text-slate-600">{answer}</p></details>)}</div>
      </section>
    </div>
  );
}

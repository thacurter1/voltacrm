import { useState } from 'react';
import { ArrowRight, FileText, Zap, Flame, Plus, Check } from 'lucide-react';
import type { UtilityType } from '../../services/offerComparison';

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
    <div className="space-y-14 sm:space-y-20 py-3 sm:py-8">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16 items-center" aria-labelledby="welcome-title">
        <div>
          <p className="text-sm font-semibold text-brand mb-4">Luce e gas, con Volta</p>
          <h1 id="welcome-title" className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-ink">La tua prossima offerta parte dalla tua bolletta.</h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600 max-w-lg">Confronta i costi per i tuoi consumi e valuta le condizioni. Se ti serve una mano, puoi chiedere una consulenza.</p>
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Check className="w-4 h-4 text-brand" aria-hidden="true" /> Nessun contratto attivato durante il confronto.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-ink">Da quale fornitura partiamo?</h2>
          <fieldset className="mt-5 space-y-3">
            <legend className="sr-only">Scegli la fornitura</legend>
            {([{ label: 'Solo luce', value: 'luce', Icon: Zap }, { label: 'Solo gas', value: 'gas', Icon: Flame }, { label: 'Luce e gas', value: 'both', Icon: Plus }] as const).map(({ label, value, Icon }) => (
              <label key={value} className={`flex items-center gap-3 min-h-14 px-4 rounded-xl border cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${value === 'both' ? (both ? 'border-brand bg-brand/5' : 'border-slate-200') : (!both && utility === value ? 'border-brand bg-brand/5' : 'border-slate-200')}`}>
                <input type="radio" name="welcome-utility" className="accent-brand" checked={value === 'both' ? both : !both && utility === value} onChange={() => { setBoth(value === 'both'); setUtility(value === 'gas' ? 'gas' : 'luce'); }} />
                <Icon className="w-5 h-5 text-brand" aria-hidden="true" /><span className="font-semibold">{label}</span>
              </label>
            ))}
          </fieldset>
          <p className="text-sm text-slate-500 mt-4 min-h-10" aria-live="polite">{both ? 'Confrontiamo una fornitura alla volta: iniziamo dalla luce, poi puoi passare al gas.' : 'Non hai la bolletta? Ti aiutiamo a stimare i consumi.'}</p>
          <button type="button" onClick={() => onStart(utility, 'wizard')} className={`${action} mt-4 w-full bg-brand hover:bg-brand-hover text-white`}>Confronta le offerte <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
        </div>
      </section>

      <section className="bg-ink text-white rounded-2xl p-6 sm:p-9 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between" aria-labelledby="bill-entry-title">
        <div className="flex gap-5 items-start">
          <FileText className="hidden sm:block w-10 h-10 shrink-0 text-emerald-200" aria-hidden="true" />
          <div><p className="text-sm text-slate-300 mb-2">Hai già una bolletta?</p><h2 id="bill-entry-title" className="text-2xl font-bold">Partiamo dai tuoi consumi reali.</h2><p className="text-sm text-slate-300 mt-3">Carica un PDF o una foto. La richiesta verrà verificata prima della consulenza.</p></div>
        </div>
        <button type="button" onClick={() => onStart(utility, 'upload')} className={`${action} shrink-0 bg-white text-ink hover:bg-emerald-50`}>Analizza la tua bolletta <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
      </section>

      <section aria-labelledby="how-title">
        <p className="text-sm text-brand font-semibold mb-2">Dal consumo alla scelta</p><h2 id="how-title" className="text-3xl font-bold tracking-tight text-ink">Come funziona</h2>
        <ol className="mt-8 grid gap-7 md:grid-cols-3">
          {[
            ['I tuoi consumi', 'Carica una bolletta oppure parti da una stima della casa. Puoi anche inserire i dati a mano.'],
            ['Il confronto', 'Guarda il costo annuo stimato, le quote fisse e le condizioni di ogni offerta.'],
            ['La tua decisione', 'Se trovi una proposta interessante, chiedi una consulenza per verificare i dettagli.'],
          ].map(([title, description], index) => <li key={title} className="border-t border-slate-300 pt-5"><span className="text-sm font-semibold text-brand">0{index + 1}</span><h3 className="mt-3 text-lg font-bold text-ink">{title}</h3><p className="mt-2 text-slate-600 leading-relaxed text-sm">{description}</p></li>)}
        </ol>
      </section>

      <section className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] border-t border-slate-200 pt-10" aria-labelledby="faq-title">
        <div><h2 id="faq-title" className="text-3xl font-bold tracking-tight text-ink">Domande frequenti</h2><p className="mt-4 text-slate-600 leading-relaxed">Prima di iniziare, qualche risposta utile.</p></div>
        <div className="divide-y divide-slate-200">{faqs.map(([question, answer]) => <details key={question} className="group py-5 first:pt-0"><summary className="cursor-pointer font-semibold text-ink rounded focus-visible:outline-2 focus-visible:outline-brand">{question}</summary><p className="mt-3 text-sm leading-relaxed text-slate-600">{answer}</p></details>)}</div>
      </section>
    </div>
  );
}

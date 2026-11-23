import { useState } from 'react';
import { ArrowRight, Check, FileUp, Home } from 'lucide-react';
import type { UtilityType } from '../../services/offerComparison';

interface Props {
  onStart: (utility: UtilityType, mode: 'wizard' | 'upload') => void;
}

interface PreviewTariff {
  name: string;
  subtitle: string;
  unitPrice: string;
  unitNote: string;
  fixedFee: string;
  annualEstimate: string;
}

const PREVIEW_OFFERS: Record<UtilityType, { heading: string; basis: string; items: PreviewTariff[] }> = {
  luce: {
    heading: 'Confronta le tariffe Luce',
    basis: 'Stima indicativa su 2.700 kWh/anno (3 kW) · Indice di riferimento Q1 2026',
    items: [
      {
        name: 'Fissa Luce 12 Mesi',
        subtitle: 'Prezzo materia energia bloccato per 12 mesi',
        unitPrice: '0,118 €/kWh',
        unitNote: 'Materia energia · 100% rinnovabile',
        fixedFee: '8 €/POD/mese (96 €/anno)',
        annualEstimate: '684 €/anno',
      },
      {
        name: 'Variabile PUN Luce',
        subtitle: 'Tariffa indicizzata al mercato all’ingrosso',
        unitPrice: 'PUN + 0,015 €/kWh',
        unitNote: 'Spread fisso per 12 mesi',
        fixedFee: '9 €/POD/mese (108 €/anno)',
        annualEstimate: '712 €/anno',
      },
      {
        name: 'Fissa Casa 24 Mesi',
        subtitle: 'Prezzo materia prima bloccato per 24 mesi',
        unitPrice: '0,126 €/kWh',
        unitNote: 'Condizioni trasparenti ARERA',
        fixedFee: '7 €/POD/mese (84 €/anno)',
        annualEstimate: '718 €/anno',
      },
    ],
  },
  gas: {
    heading: 'Confronta le tariffe Gas',
    basis: 'Stima indicativa su 1.000 Smc/anno · Indice PSV Q1 2026',
    items: [
      {
        name: 'Fissa Gas 12 Mesi',
        subtitle: 'Prezzo materia prima gas bloccato per 12 mesi',
        unitPrice: '0,445 €/Smc',
        unitNote: 'Componente materia prima fissa',
        fixedFee: '9 €/PDR/mese (108 €/anno)',
        annualEstimate: '1.140 €/anno',
      },
      {
        name: 'Variabile PSV Gas',
        subtitle: 'Tariffa variabile legata all’indice italiano PSV',
        unitPrice: 'PSV + 0,045 €/Smc',
        unitNote: 'Spread fisso per 12 mesi',
        fixedFee: '8 €/PDR/mese (96 €/anno)',
        annualEstimate: '1.105 €/anno',
      },
      {
        name: 'Fissa Gas 24 Mesi',
        subtitle: 'Stabilità biennale sulla materia prima gas',
        unitPrice: '0,468 €/Smc',
        unitNote: 'Condizioni verificate prima della firma',
        fixedFee: '8 €/PDR/mese (96 €/anno)',
        annualEstimate: '1.164 €/anno',
      },
    ],
  },
};

const faqs = [
  ['Serve una bolletta per iniziare?', 'No. Puoi stimare i consumi dalle caratteristiche della casa. Con una bolletta hai invece un punto di partenza più preciso.'],
  ['Il confronto attiva un contratto?', 'No. Puoi consultare le stime e chiedere una consulenza. Un’eventuale attivazione richiede un passaggio separato e la tua conferma.'],
  ['Posso confrontare luce e gas?', 'Sì, una fornitura alla volta. Parti dalla luce o dal gas; per valutare entrambe puoi completare prima un confronto e poi l’altro.'],
  ['Quali file posso caricare?', 'Una bolletta in PDF, JPG o PNG, fino a 10 MB. Dopo il caricamento, la richiesta passa in stato In verifica.'],
  ['Il prezzo mostrato è definitivo?', 'È una stima basata sui consumi inseriti e sulle condizioni disponibili. Controlla sempre la data dei parametri e i dettagli dell’offerta: le condizioni definitive vengono confermate prima della sottoscrizione.'],
];

export function EnergyWelcome({ onStart }: Props) {
  const [utility, setUtility] = useState<UtilityType>('luce');
  const [both, setBoth] = useState(false);

  const activeCatalog = PREVIEW_OFFERS[utility];
  const chooseUtility = (value: UtilityType | 'both') => {
    setBoth(value === 'both');
    setUtility(value === 'gas' ? 'gas' : 'luce');
  };

  return (
    <div className="w-full">
      {/* Hero: la bolletta come punto di partenza */}
      <section className="w-full bg-[#0A3B40] text-white" aria-labelledby="welcome-title">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-8 px-4 py-9 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-16">
          <div className="lg:col-span-7">
            <h1
              id="welcome-title"
              className="max-w-[18ch] text-[clamp(1.85rem,3.8vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.025em] text-white"
            >
              Confronta luce e gas partendo dalla tua bolletta
            </h1>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-[#D7E6E8]">
              Leggiamo consumi e quota fissa dal documento, tu verifichi i dati e vedi le stime. Nessuna attivazione automatica, nessun vincolo.
            </p>

            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold text-[#D7E6E8]">Che fornitura vuoi confrontare?</legend>
              <div className="inline-flex flex-wrap gap-1 rounded-lg border border-white/15 bg-[#072B2F] p-1">
                {([
                  { label: 'Solo luce', value: 'luce' },
                  { label: 'Solo gas', value: 'gas' },
                  { label: 'Luce e gas', value: 'both' },
                ] as const).map(({ label, value }) => {
                  const selected = value === 'both' ? both : !both && utility === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseUtility(value)}
                      className={`min-h-11 rounded-md px-4 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                        selected ? 'bg-white text-[#0A3B40]' : 'text-[#D7E6E8] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {both && (
                <p className="mt-2 max-w-[52ch] text-sm text-[#A7F3D0]" aria-live="polite">
                  Luce e gas restano due confronti separati: partiamo dalla luce, poi passi al gas.
                </p>
              )}
            </fieldset>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onStart(utility, 'upload')}
                className="group flex min-h-[112px] flex-col justify-between gap-3 rounded-[12px] bg-white p-5 text-left text-[#0F222D] shadow-[0_8px_24px_rgba(7,43,47,0.35)] transition-colors hover:bg-[#F6F9FA] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EAF4F0] text-[#0A6847]">
                    <FileUp className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-base font-bold">Analizza la tua bolletta</span>
                </span>
                <span className="flex items-end justify-between gap-3 text-sm text-[#445966]">
                  <span>Hai la bolletta: carica PDF o foto, verifichi tu i dati letti.</span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#0A6847] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onStart(utility, 'wizard')}
                className="group flex min-h-[112px] flex-col justify-between gap-3 rounded-[12px] border border-white/25 bg-[#072B2F] p-5 text-left text-white transition-colors hover:border-white/50 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-[#A7F3D0]">
                    <Home className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-base font-bold">Stima i tuoi consumi</span>
                </span>
                <span className="flex items-end justify-between gap-3 text-sm text-[#D7E6E8]">
                  <span>Non hai la bolletta: poche domande sulla casa, circa un minuto.</span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#A7F3D0] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>

          <figure className="lg:col-span-5">
            <img
              src="/images/volta-hero-home.jpg"
              alt="Una cucina di casa illuminata dalla luce del giorno"
              width={1024}
              height={684}
              decoding="async"
              className="block aspect-[21/9] w-full rounded-[12px] object-cover lg:aspect-[4/3]"
            />
          </figure>
        </div>
      </section>

      {/* Barra trasparenza */}
      <div className="border-b border-[#DCE5E8] bg-white px-4 py-3.5 sm:px-6 lg:px-8">
        <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-[#445966]">
          {['Confronto gratuito', 'Nessun contratto attivato online', 'Luce e gas confrontati separatamente', 'Indici PUN / PSV dichiarati'].map((item) => (
            <li key={item} className="inline-flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-[#0A6847]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Anteprima offerte: un solo controllo condiviso con l'hero */}
      <section className="bg-[#F6F9FA] px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="offers-preview-title">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 id="offers-preview-title" className="text-2xl font-bold tracking-tight text-[#0F222D] sm:text-3xl">
                Confronta le offerte {utility === 'luce' ? 'luce' : 'gas'}
              </h2>
              <p className="mt-1.5 text-sm text-[#445966] tabular-nums">{activeCatalog.basis}</p>
              {both && (
                <p className="mt-1.5 text-sm font-semibold text-[#145374]">
                  Hai scelto luce e gas: qui vedi la luce, passa a Gas per la seconda fornitura.
                </p>
              )}
            </div>
            <div className="inline-flex self-start rounded-lg border border-[#DCE5E8] bg-white p-1 md:self-auto" role="tablist" aria-label="Fornitura delle offerte">
              {(['luce', 'gas'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={utility === value}
                  onClick={() => setUtility(value)}
                  className={`min-h-11 rounded-md px-5 text-sm font-bold transition-colors cursor-pointer ${
                    utility === value ? 'bg-[#0A3B40] text-white' : 'text-[#445966] hover:text-[#0F222D]'
                  }`}
                >
                  {value === 'luce' ? 'Luce' : 'Gas'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {activeCatalog.items.map((item) => (
              <article key={item.name} className="flex flex-col rounded-[12px] border border-[#DCE5E8] bg-white p-5">
                <h3 className="text-lg font-bold text-[#0F222D]">{item.name}</h3>
                <p className="mt-1 text-sm text-[#445966]">{item.subtitle}</p>
                <p className="mt-5 font-mono text-2xl font-semibold leading-tight tracking-tight text-[#0A6847] tabular-nums">{item.unitPrice}</p>
                <p className="mt-1 text-sm text-[#445966]">{item.unitNote}</p>
                <dl className="mt-5 space-y-2 border-t border-[#DCE5E8] pt-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="text-[#445966]">Quota fissa</dt>
                    <dd className="font-mono font-semibold text-[#0F222D] tabular-nums">{item.fixedFee}</dd>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="text-[#445966]">Spesa annua stimata</dt>
                    <dd className="font-mono font-semibold text-[#0F222D] tabular-nums">{item.annualEstimate}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-[12px] border border-[#DCE5E8] bg-white p-5 md:flex-row md:items-center md:justify-between">
            <p className="max-w-[60ch] text-sm leading-relaxed text-[#445966]">
              Sono stime su un consumo tipo. Con i tuoi consumi vedi quanto spenderesti davvero con ciascuna offerta.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
              <button
                type="button"
                onClick={() => onStart(utility, 'upload')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#0A6847] px-5 text-sm font-bold text-white transition-colors hover:bg-[#085238] cursor-pointer"
              >
                Usa la tua bolletta
              </button>
              <button
                type="button"
                onClick={() => onStart(utility, 'wizard')}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#DCE5E8] px-5 text-sm font-bold text-[#0A3B40] transition-colors hover:bg-[#F6F9FA] cursor-pointer"
              >
                Stima senza bolletta
              </button>
            </div>
          </div>

          <dl className="mt-8 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            {[
              ['PUN e PSV', 'Prezzi all’ingrosso di luce (PUN) e gas (PSV). Le offerte variabili li seguono, più uno spread fisso.'],
              ['Quota fissa', 'Costo mensile che paghi anche senza consumare, indicato per POD (luce) o PDR (gas).'],
              ['POD e PDR', 'Codici che identificano il tuo punto di fornitura: li trovi nella prima pagina della bolletta.'],
              ['Spesa annua stimata', 'Materia energia più quota fissa sul consumo indicato sopra, senza imposte e oneri di rete.'],
            ].map(([term, def]) => (
              <div key={term} className="border-t border-[#DCE5E8] pt-3">
                <dt className="font-bold text-[#0F222D]">{term}</dt>
                <dd className="mt-1 leading-relaxed text-[#445966]">{def}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Come funziona */}
      <section className="bg-white border-t border-[#DCE5E8] px-4 sm:px-6 lg:px-8 py-12 sm:py-14" aria-labelledby="how-title">
        <div className="max-w-6xl mx-auto">
          <h2 id="how-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F222D]">
            Come funziona
          </h2>
          <ol className="mt-8 grid gap-7 md:grid-cols-3">
            {[
              ['I tuoi consumi', 'Carica una bolletta oppure parti da una stima della casa. Puoi anche inserire i kWh o Smc a mano.'],
              ['Il confronto', 'Guarda il costo annuo stimato, le quote fisse e le condizioni di ogni offerta in modo trasparente.'],
              ['La tua decisione', 'Se trovi una proposta interessante, chiedi una consulenza dedicata per verificare i dettagli.'],
            ].map(([title, description], index) => (
              <li key={title} className="border-t border-[#DCE5E8] pt-5">
                <span className="font-mono text-sm font-semibold text-[#0A6847]">Passo {index + 1}</span>
                <h3 className="mt-2 text-lg font-bold text-[#0F222D]">{title}</h3>
                <p className="mt-2 text-[#445966] leading-relaxed text-sm">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Domande frequenti (5 <details> nativi accessibili) */}
      <section className="bg-[#F6F9FA] border-t border-[#DCE5E8] px-4 sm:px-6 lg:px-8 py-12 sm:py-14" aria-labelledby="faq-title">
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <h2 id="faq-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F222D]">
              Domande frequenti
            </h2>
            <p className="mt-3 text-sm text-[#445966] leading-relaxed">
              Prima di iniziare, le risposte ai dubbi più comuni sul confronto luce e gas.
            </p>
          </div>
          <div className="bg-white border border-[#DCE5E8] rounded-xl px-5 sm:px-6 divide-y divide-[#DCE5E8]">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-2">
                <summary className="flex min-h-11 cursor-pointer items-center rounded py-2 text-base font-semibold text-[#0F222D] focus-visible:outline-2 focus-visible:outline-[#0A6847]">
                  {question}
                </summary>
                <p className="max-w-[65ch] pb-3 text-sm leading-relaxed text-[#445966]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

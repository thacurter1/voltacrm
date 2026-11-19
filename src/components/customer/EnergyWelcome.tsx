import { useState } from 'react';
import { ArrowRight, Check, FileUp, SlidersHorizontal } from 'lucide-react';
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
  const [segment, setSegment] = useState<'domestico' | 'piva'>('domestico');

  const activeCatalog = PREVIEW_OFFERS[utility];

  return (
    <div className="w-full">
      {/* Fascia Hero a tutta larghezza blu petrolio (#0A3B40) */}
      <section
        className="w-full bg-[#0A3B40] text-white overflow-hidden"
        aria-labelledby="welcome-title"
      >
        <div className="max-w-[1380px] mx-auto pl-4 sm:pl-6 lg:pl-8 pr-4 sm:pr-6 lg:pr-0 py-8 sm:py-11 grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-5 items-center">
          {/* Sinistra: Headline, selettore fornitura e CTA bianca */}
          <div className="lg:col-span-4 space-y-4">
            <h1
              id="welcome-title"
              className="text-[28px] sm:text-[38px] lg:text-[40px] font-bold leading-[1.08] tracking-[-0.025em] text-white"
            >
              Confronta Luce e Gas partendo dai tuoi consumi reali
            </h1>
            <p className="text-sm sm:text-base text-[#D7E6E8] leading-relaxed max-w-[40ch]">
              Stime trasparenti su parametri ARERA, senza attivazioni automatiche né vincoli.
            </p>

            {/* Selettore fornitura compatto */}
            <fieldset className="pt-1">
              <legend className="sr-only">Scegli la fornitura</legend>
              <div className="inline-flex flex-wrap gap-1.5 bg-[#072B2F] p-1 rounded-lg border border-white/15 text-xs font-semibold">
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
                      onClick={() => {
                        setBoth(value === 'both');
                        setUtility(value === 'gas' ? 'gas' : 'luce');
                      }}
                      className={`min-h-[38px] px-3 py-1.5 rounded-md transition cursor-pointer ${
                        selected
                          ? 'bg-white text-[#0A3B40] font-bold'
                          : 'text-[#D7E6E8] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {both && (
                <p className="text-xs text-[#A7F3D0] mt-2" aria-live="polite">
                  Confrontiamo una fornitura alla volta: iniziamo dalla luce, poi passi al gas.
                </p>
              )}
            </fieldset>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onStart(utility, 'wizard')}
                className="min-h-[46px] px-6 py-3 rounded-md bg-white hover:bg-[#F1F5F6] text-[#0A3B40] font-bold text-sm inline-flex items-center gap-2.5 cursor-pointer transition active:scale-[0.98]"
              >
                <span>Confronta le offerte</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Centro: Fotografia d'interni reale (nessun hover zoom) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[470px] rounded-xl overflow-hidden border border-white/15 bg-[#072B2F] shadow-md">
              <img
                src="/images/volta-hero-home.jpg"
                alt="Interno domestico luminoso in stile contemporaneo"
                className="w-full h-[220px] sm:h-[268px] object-cover block"
              />
            </div>
          </div>

          {/* Destra: Linguette bianche ancorate al bordo destro per i due percorsi */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onStart(utility, 'upload')}
              className="w-full text-left bg-white hover:bg-[#F6F9FA] text-[#0F222D] px-5 py-4 rounded-xl lg:rounded-l-2xl lg:rounded-r-none shadow-sm flex items-center gap-3.5 cursor-pointer transition min-h-[72px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="w-10 h-10 rounded-lg bg-[#EAF4F0] text-[#0A6847] flex items-center justify-center shrink-0">
                <FileUp className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#0F222D]">
                  Analizza la tua bolletta
                </span>
                <span className="block text-xs text-[#445966] mt-0.5">
                  PDF o foto · consumi reali
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => onStart(utility, 'wizard')}
              className="w-full text-left bg-white hover:bg-[#F6F9FA] text-[#0F222D] px-5 py-4 rounded-xl lg:rounded-l-2xl lg:rounded-r-none shadow-sm flex items-center gap-3.5 cursor-pointer transition min-h-[72px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span className="w-10 h-10 rounded-lg bg-[#EDF3F5] text-[#0A3B40] flex items-center justify-center shrink-0">
                <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#0F222D]">
                  Stima i tuoi consumi
                </span>
                <span className="block text-xs text-[#445966] mt-0.5">
                  Senza bolletta · 60 secondi
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Barra trasparenza lineare */}
      <div className="bg-white border-b border-[#DCE5E8] px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs sm:text-sm font-medium text-[#445966]">
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-[#0A6847] shrink-0" aria-hidden="true" />
            Confronto gratuito
          </span>
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-[#0A6847] shrink-0" aria-hidden="true" />
            Nessun contratto attivato online
          </span>
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-[#0A6847] shrink-0" aria-hidden="true" />
            Luce e gas confrontati separatamente
          </span>
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-[#0A6847] shrink-0" aria-hidden="true" />
            Indici PUN / PSV dichiarati
          </span>
        </div>
      </div>

      {/* Sezione Offerte commerciali centrata con toggle Offerte Luce | Offerte Gas */}
      <section className="bg-[#F6F9FA] px-4 sm:px-6 lg:px-8 py-12 sm:py-14" aria-labelledby="offers-preview-title">
        <div className="max-w-6xl mx-auto space-y-7">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="inline-flex rounded-lg bg-white border border-[#DCE5E8] p-1" role="tablist" aria-label="Scegli fornitura tariffe">
              <button
                type="button"
                role="tab"
                aria-selected={utility === 'luce'}
                onClick={() => {
                  setBoth(false);
                  setUtility('luce');
                }}
                className={`min-h-[40px] px-5 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition ${
                  utility === 'luce'
                    ? 'bg-[#0A6847] text-white'
                    : 'text-[#445966] hover:text-[#0F222D]'
                }`}
              >
                Offerte Luce
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={utility === 'gas'}
                onClick={() => {
                  setBoth(false);
                  setUtility('gas');
                }}
                className={`min-h-[40px] px-5 py-2 rounded-md text-xs sm:text-sm font-bold cursor-pointer transition ${
                  utility === 'gas'
                    ? 'bg-[#0A6847] text-white'
                    : 'text-[#445966] hover:text-[#0F222D]'
                }`}
              >
                Offerte Gas
              </button>
            </div>

            <div>
              <h2 id="offers-preview-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F222D]">
                {activeCatalog.heading}
              </h2>
              <p className="text-xs sm:text-sm text-[#445966] mt-1 tabular-nums">
                {activeCatalog.basis}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {activeCatalog.items.map((item) => (
              <article
                key={item.name}
                className="bg-white rounded-xl border border-[#DCE5E8] p-5 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F222D]">{item.name}</h3>
                    <p className="text-xs font-medium text-[#0A6847] mt-0.5">{item.subtitle}</p>
                  </div>

                  <div className="grid grid-cols-2 border border-[#DCE5E8] rounded-md overflow-hidden text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setSegment('domestico')}
                      className={`py-2 px-2 cursor-pointer transition ${
                        segment === 'domestico'
                          ? 'bg-[#0A3B40] text-white'
                          : 'bg-white text-[#445966] hover:text-[#0F222D]'
                      }`}
                    >
                      Uso domestico
                    </button>
                    <button
                      type="button"
                      onClick={() => setSegment('piva')}
                      className={`py-2 px-2 border-l border-[#DCE5E8] cursor-pointer transition ${
                        segment === 'piva'
                          ? 'bg-[#0A3B40] text-white'
                          : 'bg-white text-[#445966] hover:text-[#0F222D]'
                      }`}
                    >
                      Partita IVA
                    </button>
                  </div>

                  <div className="pt-1">
                    <p className="text-2xl font-extrabold text-[#0A6847] tabular-nums">{item.unitPrice}</p>
                    <p className="text-xs text-[#445966] mt-0.5">{item.unitNote}</p>
                  </div>

                  <div className="border-t border-[#DCE5E8] pt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#445966]">Quota fissa</span>
                      <span className="font-bold text-[#0F222D] tabular-nums">{item.fixedFee}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#445966]">Spesa annua stimata</span>
                      <span className="font-bold text-[#0F222D] tabular-nums">{item.annualEstimate}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1 space-y-2 text-center">
                  <button
                    type="button"
                    onClick={() => onStart(utility, 'wizard')}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-[#0A6847] hover:bg-[#085238] text-white text-sm font-bold cursor-pointer transition"
                  >
                    Personalizza sui tuoi consumi
                  </button>
                </div>
              </article>
            ))}
          </div>
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
                <span className="font-mono text-xs font-semibold text-[#0A6847]">Passo {index + 1}</span>
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
              <details key={question} className="group py-4">
                <summary className="cursor-pointer font-semibold text-sm sm:text-base text-[#0F222D] rounded focus-visible:outline-2 focus-visible:outline-[#0A6847]">
                  {question}
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-[#445966]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

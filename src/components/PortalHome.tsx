import React from 'react';
import { ArrowRight, BriefcaseBusiness, Monitor, ShieldCheck, UserRound } from 'lucide-react';
import { DEMO_MODE } from '../api/client';
import { VoltaBrandMark } from './common/VoltaBrandMark';

const portals = [
  {
    title: 'Portale clienti',
    description: 'Controlla le forniture, carica una bolletta e confronta le tariffe luce e gas con stime chiare.',
    href: '?portal=customer',
    action: 'Entra nell’area clienti',
    icon: UserRound,
  },
  {
    title: 'Area staff e broker',
    description: 'Gestisci clienti, lead, appuntamenti, bollette in verifica e provvigioni dal CRM operativo.',
    href: '?portal=staff',
    action: 'Accedi al CRM',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Totem punto vendita',
    description: 'Percorso dedicato a schermo intero per le postazioni fisiche abilitate.',
    href: '?portal=totem',
    action: 'Apri modalità totem',
    icon: Monitor,
  },
] as const;

export const PortalHome: React.FC = () => (
  <div className="min-h-[100dvh] bg-[#F6F9FA] text-[#0F222D] flex flex-col">
    <header className="border-b border-[#DCE5E8] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 h-16 sm:px-8">
        <div className="flex items-center gap-2.5">
          <VoltaBrandMark className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight text-[#0F222D]">Volta Energia</span>
        </div>
        <a
          href="/"
          className="text-xs sm:text-sm font-semibold text-[#0A6847] hover:underline"
        >
          Torna al comparatore pubblico
        </a>
      </div>
    </header>

    <main className="mx-auto max-w-6xl w-full flex-1 px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="max-w-2xl text-3xl sm:text-5xl font-bold leading-[1.08] tracking-tight text-[#0F222D]">
        Scegli il portale di accesso.
      </h1>
      <p className="mt-4 max-w-xl text-sm sm:text-base leading-relaxed text-[#445966]">
        Ogni area espone esclusivamente gli strumenti e i dati previsti per il proprio profilo.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3" aria-label="Scegli il portale">
        {portals.map(({ title, description, href, action, icon: Icon }) => {
          const disabled = href === '?portal=totem' && !DEMO_MODE;
          return (
            <a
              key={href}
              href={disabled ? undefined : href}
              aria-disabled={disabled ? true : undefined}
              className={`group flex flex-col justify-between rounded-xl border border-[#DCE5E8] bg-white p-6 min-h-[240px] ${
                disabled
                  ? 'opacity-70 cursor-not-allowed'
                  : 'transition hover:border-[#0A6847] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A6847]'
              }`}
            >
              <div>
                <div className="inline-flex size-10 items-center justify-center rounded-lg bg-[#EAF4F0] text-[#0A3B40]">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="mt-5 text-xl font-bold tracking-tight text-[#0F222D]">{title}</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-[#445966]">{description}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0A6847]">
                <span>{disabled ? 'Solo su postazione dedicata' : action}</span>
                {!disabled && <ArrowRight className="size-4" aria-hidden="true" />}
              </span>
            </a>
          );
        })}
      </div>

      <p className="mt-8 flex items-center gap-2 text-xs text-[#445966]">
        <ShieldCheck className="size-4 text-[#0A6847] shrink-0" aria-hidden="true" />
        <span>Accessi e sessioni restano separati tra portale clienti, CRM staff e postazione totem.</span>
      </p>
    </main>
  </div>
);

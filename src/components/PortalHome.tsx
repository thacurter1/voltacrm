import React from 'react';
import { ArrowRight, BriefcaseBusiness, Monitor, ShieldCheck, UserRound, Zap } from 'lucide-react';
import { DEMO_MODE } from '../api/client';

const portals = [
  {
    title: 'Le tue bollette',
    audience: 'PER I CLIENTI',
    description: 'Controlla le forniture, carica una bolletta e confronta le offerte con stime spiegate.',
    href: '?portal=customer',
    action: 'Entra nel portale clienti',
    icon: UserRound,
    number: '01',
  },
  {
    title: 'Area operativa',
    audience: 'PER STAFF E BROKER',
    description: 'Gestisci clienti, lead, appuntamenti e pratiche dal CRM riservato.',
    href: '?portal=staff',
    action: 'Accedi al CRM',
    icon: BriefcaseBusiness,
    number: '02',
  },
  {
    title: 'Totem punto vendita',
    audience: 'PER LA POSTAZIONE TOUCH',
    description: 'Un percorso guidato a schermo intero per chi visita il tuo punto vendita.',
    href: '?portal=totem',
    action: 'Accedi al totem',
    icon: Monitor,
    number: '03',
  },
] as const;

export const PortalHome: React.FC = () => (
  <div className="min-h-[100dvh] bg-[#f6f9fc] text-[#0a2540] font-sans">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#635bff] text-white"><Zap className="size-5" aria-hidden="true" /></span>
          <span className="text-lg font-extrabold tracking-tight">Volta Energia</span>
        </div>
        <span className="hidden text-sm font-medium text-slate-500 sm:block">Un accesso chiaro per ogni esigenza</span>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#635bff]">Accessi Volta Energia</p>
      <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">Scegli il tuo spazio.</h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">Tre percorsi dedicati, ciascuno con strumenti e accessi adatti a chi lo usa.</p>

      <div className="mt-12 grid gap-4 lg:grid-cols-3" aria-label="Scegli il portale">
        {portals.map(({ title, audience, description, href, action, icon: Icon, number }) => (
          <a key={href} href={href === '?portal=totem' && !DEMO_MODE ? undefined : href} aria-disabled={href === '?portal=totem' && !DEMO_MODE ? true : undefined} className={`group flex min-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_12px_32px_rgba(10,37,64,0.04)] ${href === '?portal=totem' && !DEMO_MODE ? '' : 'transition hover:-translate-y-1 hover:border-[#635bff]/50 hover:shadow-[0_18px_40px_rgba(10,37,64,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#635bff]'}`}>
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center rounded-xl bg-[#f0efff] text-[#635bff]"><Icon className="size-6" aria-hidden="true" /></span>
              <span className="font-mono text-sm text-slate-400">{number}</span>
            </div>
            <p className="mt-9 text-[11px] font-bold tracking-[0.14em] text-[#635bff]">{audience}</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{description}</p>
            <span className="mt-7 inline-flex items-center gap-2 font-bold text-[#0a2540] group-hover:text-[#635bff]">{href === '?portal=totem' ? DEMO_MODE ? 'Apri anteprima totem' : 'Solo sulla postazione dedicata' : action}{(href !== '?portal=totem' || DEMO_MODE) && <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden="true" />}</span>
          </a>
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4" aria-hidden="true" /> Ogni portale mostra soltanto le funzioni previste per il suo ruolo.</p>
    </main>
  </div>
);

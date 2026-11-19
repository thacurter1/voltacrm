---
name: Volta Energia
description: Sistema visivo Energy-Tech per il comparatore luce/gas, Portale Clienti, Totem e CRM Staff/Broker.
colors:
  petrol: "#0A3B40"
  petrol-deep: "#072B2F"
  emerald: "#0A6847"
  emerald-hover: "#085238"
  emerald-tint: "#EAF4F0"
  emerald-highlight: "#34D399"
  ink: "#0F222D"
  sub: "#445966"
  ground: "#F6F9FA"
  surface: "#FFFFFF"
  border: "#DCE5E8"
  status-review: "#145374"
  status-warn: "#9A4D09"
  status-error: "#B91C1C"
typography:
  display:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: "clamp(1.85rem, 3.8vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "normal"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.emerald}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.emerald-hover}"
  hero-cta:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.petrol}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
---

## Overview

Volta Energia adotta un'identità visiva commerciale chiara da operatore energetico europeo: barra superiore bianca essenziale, fascia hero blu petrolio a tutta larghezza con linguette operative ancorate a destra (*Carica la tua bolletta* / *Stima i tuoi consumi*), schede tariffarie scansionabili e un back-office CRM Staff/Broker perfettamente allineato per colori, tipografia e stati pratica.

## Colors

- **Petrolio istituzionale (`#0A3B40` / `#072B2F`):** fascia Hero pubblica, header operativo CRM Staff/Broker e controlli selezionati ad alto contrasto.
- **Smeraldo primario (`#0A6847`, hover `#085238`):** unico colore d'azione per i pulsanti principali e i prezzi unitari (`€/kWh`, `€/Smc`), con contrasto WCAG AA superiore a 6.5:1 su testo bianco.
- **Superfici chiare (`#FFFFFF` su `#F6F9FA`, bordi `#DCE5E8`):** leggibilità elevata in moduli, tabelle CRM e schede offerte.
- **Stati semantici coerenti tra Clienti e CRM:** `Analizzata` (`#0A6847`), `Ricevuta / In verifica` (`#145374`), `Richiesta informazioni` (`#9A4D09`), `Errore / Bloccato` (`#B91C1C`).

## Typography

- **Titoli (`Bricolage Grotesque`):** peso 700–800, `text-wrap: balance`, crenatura contenuta (`-0.025em`).
- **UI e contenuti (`Manrope`):** peso 400–700, leggibile sia su landing che su tabelle dense del CRM.
- **Dati numerici (`JetBrains Mono` + `tabular-nums`):** prezzi, `kWh`, `Smc`, `POD`, `PDR`, indici `PUN`/`PSV` e date.
- Tutti i font sono caricati localmente via `@fontsource/*` (nessuna chiamata CDN esterna in produzione).

## Elevation

- Gerarchia costruita con contrasto di superficie (`#0A3B40` vs `#FFFFFF` vs `#F6F9FA`) e filetti da `1px` (`#DCE5E8`).
- Ombre contenute e mai nere pure; nessuna card annidata dentro card; scala z-index semantica (`sticky: 30`, `modal: 50`, `toast: 60`).

## Components

- **Marchio (`VoltaBrandMark`):** emblema geometrico `V` in `#0A3B40` + accento `#34D399` al posto di icone generiche.
- **Hero & Bivio:** 3 colonne su desktop (titolo + CTA bianca | foto reale domestica `/images/volta-hero-home.jpg` | due linguette bianche ancorate a destra per upload bolletta e stima guidata), impilate pulite su tablet e mobile (`390px`).
- **Schede Offerta:** titolo, sottotitolo tariffario, prezzo unitario in evidenza, filetti per `Quota fissa` e `Spesa annua stimata`, una sola CTA primaria.
- **Selettore Demo:** assente su pagine pubbliche, Portale Clienti e produzione; integrato come `<select>` discreto nell'header Staff solo quando `VITE_DEMO_MODE=true`.

## Do's and Don'ts

- **Do:** mantenere Luce e Gas come confronti separati, preservare target touch `>= 44px`, rispettare `prefers-reduced-motion`, usare solo testo semantico per gli stati pratica.
- **Don't:** usare viola/indaco AI (`#635bff`), gradienti decorativi, scintille, emoji nei menu, badge a pillola ripetuti, eyebrow in maiuscoletto sopra ogni sezione, finti Trustpilot o sconti barrati inventati, né barre demo flottanti sopra contenuti o banner cookie.

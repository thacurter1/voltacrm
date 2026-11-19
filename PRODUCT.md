# Product

## Register

brand

## Users

- **Utenti finali / Famiglie e PMI (Portale Pubblico & Area Clienti):** visitatori che cercano chiarezza sulle tariffe luce e gas senza telefonate aggressive, vogliono caricare una bolletta reale (PDF/foto) o stimare rapidamente i consumi domestici, confrontare stime trasparenti e seguire lo stato della propria pratica e del proprio account.
- **Consulenti, Broker, Call Center e Admin (Area Staff / CRM):** operatori commerciali e amministratori che gestiscono coda lead, agenda appuntamenti, analisi bollette caricate, switch trimestrali ARERA, mandati di firma e provvigioni su desktop, tablet e postazioni operative.
- **Visitatori in sede / Totem Kiosk:** utenti su postazione dedicata provisionata che consultano rapidamente il comparatore e inviano una richiesta di ricontatto assistita.

## Product Purpose

Trasformare il confronto luce e gas e la gestione operativa post-acquisizione in un percorso digitale trasparente, leggibile e coerente dalla prima schermata pubblica fino al back-office CRM, eliminando promesse commerciali non verificate, sovrapposizioni visive e attrito sui flussi mobile/desktop.

## Brand Personality

- **3 parole:** Chiaro, Solido, Tecnico-accessibile.
- **Tono di voce:** Diretto e trasparente; spiega ogni stima, separazione luce/gas e stato pratica in italiano concreto senza sensazionalismi.
- **Riferimenti:** Chiarezza consumer nel settore energia (stile Octopus Energy / Sorgenia per leggibilità del percorso e delle scelte energetiche) unita a rigore e pulizia operativa di tabelle/moduli (stile Linear / Stripe).

## Anti-references

- Niente estetica generica AI viola/neon, scintille decorative, gradienti gratuiti o card ripetitive tutte uguali.
- Nessun badge, numero di risparmio garantito, recensione o logo partner non dimostrato (e nessuna copia di marchi/claim di comparatori terzi come Facile.it).
- Mai mostrare barre o controlli demo (`1-CLICK DEMO`) nell'esperienza normale del cliente o in produzione; mai coprire contenuti, pulsanti primari o footer con banner flottanti.
- Evitare layout compressi su mobile (`390px`) o tablet (`768px`), placeholder-as-label, o testi troncati nei pulsanti principali.

## Design Principles

1. **Chiarezza immediata al primo sguardo:** nella schermata iniziale l'utente capisce subito cosa offre Volta Energia, sceglie la fornitura (luce, gas, o percorso separato) e distingue a colpo d'occhio *Carica bolletta* vs *Stima consumi*.
2. **Coerenza integrale da cima a fondo:** area pubblica, Portale Clienti, autenticazione, Totem e Area Staff/Broker condividono lo stesso sistema di token (blu profondo + verde smeraldo/ottanio su fondo chiaro), stessa tipografia, stessi stati cromatici e stessa cura dei componenti.
3. **Trasparenza e onestà operativa:** luce e gas restano confronti distinti; nessun contratto si attiva durante il confronto; le bollette mostrano stati reali (`Ricevuta / In verifica`, `Richiesta informazioni`, `Analizzata`); l'ambiente dimostrativo resta confinato alle sole superfici demo.
4. **Accessibilità e comodità reale multi-dispositivo:** contrasto >= WCAG AA (4.5:1), focus visibile, aree cliccabili >= 44px su mobile/tablet, tabelle adattive senza overflow orizzontale e rispetto di `prefers-reduced-motion`.

## Accessibility & Inclusion

- Conformità target **WCAG AA** (contrasto testo/sfondo >= 4.5:1, testo grande e controlli >= 3:1; placeholder leggibili >= 4.5:1).
- Navigazione completa da tastiera con focus ring ad alto contrasto, `<label htmlFor>` collegate su ogni campo, messaggi d'errore inline annunciati con `role="alert"` e gestione esplicita del focus.
- Supporto `@media (prefers-reduced-motion: reduce)` per disattivare transizioni superflue mantenendo sempre visibili i contenuti di default.
- Collaudo obbligatorio sui breakpoint `390px` (smartphone), `768px` (tablet) e `1440px` (desktop) senza overflow orizzontale.

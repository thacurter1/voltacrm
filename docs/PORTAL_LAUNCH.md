# Portali Volta Energia — preparazione al rilascio

## Percorsi

- `/`: scelta del portale quando non è presente una sessione.
- `/?portal=customer`: login clienti e area bollette.
- `/?portal=staff`: login staff/broker e CRM secondo i privilegi dell'account.
- Hostname `totem.<dominio>`: postazione touch autonoma. Alla prima apertura lo staff inserisce la chiave della postazione; le aperture successive sono dirette.
- `/?portal=totem`: anteprima disponibile solo nelle build demo. Nella build reale questo percorso pubblico non apre il totem.

I vecchi parametri `app=customer`, `app=cliente` e `app=crm` passano dal login previsto. La separazione riguarda percorsi e accessi, non tre copie indipendenti del database.

## Configurazione

La build di produzione usa `VITE_DEMO_MODE=false`. Controllare che le variabili Vercel non la sovrascrivano con `true`. La demo locale può continuare a usare `true` nel file `.env` non tracciato.

Configurare il dominio dedicato del totem e il backend HTTPS. Aggiungere l'origine del totem a `CORS_ORIGIN` quando il browser chiama direttamente il backend.

Impostare `TOTEM_KIOSK_DEVICE_KEY` tra i segreti del backend. Inserire lo stesso valore una sola volta nella configurazione del browser della postazione. La verifica avviene sul backend prima del salvataggio locale. Non inserire questa chiave in `VITE_*`, nel repository o nei link. La chiave del dispositivo è distinta da `TOTEM_KIOSK_API_KEY` usata dal gateway messaggi.

Il browser conserva la chiave sul dispositivo: è una credenziale revocabile, non un vincolo hardware. Bloccare il computer in modalità kiosk e limitare strumenti di sviluppo, navigazione e accesso al sistema. Per più postazioni serve una gestione di chiavi individuali e revoca per dispositivo: l'implementazione attuale prevede una postazione.

Senza chiave configurata il backend rifiuta le richieste reali del totem. Chiavi mancanti o errate non producono un falso successo.

## Verifiche prima dell'apertura agli utenti

1. Distribuire frontend e backend compatibili su staging; verificare login cliente, login staff con TOTP e privilegi per ruolo.
2. Provisionare il dispositivo e verificare riapertura diretta, invio del contatto, errore di rete e reset dei dati tra visitatori.
3. Verificare la UI su display reale del totem, telefono e desktop. La compilazione non sostituisce questa verifica.
4. Completare informativa privacy e gestione del consenso per il ricontatto prima di raccogliere dati reali.
5. Confermare la persistenza Supabase e i provider di messaggistica reali. Il totem registra una richiesta di contatto; non promette un risparmio o un messaggio non verificato.

Non sono necessarie migrazioni SQL per queste modifiche. Domini, segreti del backend e provisioning del dispositivo restano operazioni di distribuzione da completare.

## Correzioni audit e verifica del 12 ottobre

- Uscita cliente disponibile nel portale e anche quando manca la fornitura.
- Login conserva la password esattamente come registrata, spazi inclusi.
- Richieste HTTP limitate a 90 secondi inclusa la lettura della risposta; il piano Render Free può impiegare oltre 50 secondi a riattivarsi. Nessun reinvio automatico delle richieste di scrittura.
- Errori di archiviazione demo propagati alle operazioni; avviso per persistenza automatica, avvio demo ancora disponibile.
- Registrazione con codice fiscale/partita IVA obbligatorio e password da 12 a 72 caratteri, senza password predefinite.

Verifica locale: frontend e backend compilati; 37 suite superate; lint senza errori, 6 avvisi preesistenti. Il rilascio online e il dispositivo totem devono essere verificati separatamente.

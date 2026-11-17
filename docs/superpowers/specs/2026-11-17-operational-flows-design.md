# VoltaCRM — Specifica di Architettura Flussi Operativi (Sezioni A–E)

**Data:** 17 Novembre 2026  
**Base Git:** `67ca93a090edb208e887f1a324a4aa1f45b7f36f` (`origin/main`)  
**Scope:** Completamento flussi operativi end-to-end: affidabilità/idempotenza bollette (`A`), collegamenti/OAuth/accessibilità (`B`), ciclo di vita account e sicurezza sessioni (`C`), primo accesso/claim guest/richieste/account management (`D`), collaudo, migrazioni incrementali e identificativo release (`E`).

---

## 1. Decisioni Architetturali e Vincoli

- **Autenticazione su `crm_accounts` + JWT versionato (no Supabase Auth rewrite):** Si mantiene l'architettura esistente (`crm_accounts`, `customers`, `bcryptjs`, JWT applicativo, TOTP 2FA staff, RPC `SECURITY DEFINER`), potenziandola con `tokenVersion` per revoca server-side, token crittografici monouso (SHA-256 digest) per verifica email, reset password, cambio email e claim bollette guest.
- **Regola CF / P.IVA (confermata):** Validazione matematica ufficiale italiana (carattere di controllo CF 16 caratteri incluse omocodie, oppure cifra di controllo P.IVA 11 cifre) + normalizzazione (`trim().toUpperCase()`) + unicità 1:1 per tutte le **nuove registrazioni fuori da `VOLTA_DEMO_MODE`** (`register-customer`, `invitations` cliente), preservando la retrocompatibilità per i record storici/demo già presenti nel DB.
- **OAuth Google / Apple in produzione (confermato):** I pulsanti OAuth vengono mostrati in produzione esclusivamente per i provider effettivamente configurati (`VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID`); se assenti fuori demo mode vengono nascosti (senza divisore orfano né toast di errore post-click). In `DEMO_MODE` restano attivi per dimostrazione.
- **Servizi esterni e staging:** Implementazione completa di `emailService` con supporto adapter HTTP (Resend), SMTP configurabile e adapter test in-memory locale per collaudi deterministici. In produzione senza provider email configurato, il backend non simula invii riusciti: registra errore esplicito e segnala stato bloccante documentato.

---

## 2. Sezione A — Assegnazione Broker e Idempotenza Bollette (`P1`)

### A.1 Assegnazione sicura senza fallback fantasma
- **File:** `server/src/routes/portal.ts`, `server/src/services/dataStore.ts`.
- Sostituire `resolveDefaultBrokerId()` (che oggi ripiega sul literal `'user-op-2'` e non filtra gli stati):
  - Nuovo helper `isActiveStaffAccount(user)`: verifica `['broker', 'operator'].includes(user.role)` e `user.onboardingStatus !== 'suspended' && user.onboardingStatus !== 'invited' && user.onboardingStatus !== 'pending_verification'`.
  - Nuovo helper `resolveActiveBrokerId(preferredId?)`:
    1. Se `preferredId` corrisponde a un utente attivo in `users` (con `isActiveStaffAccount`), restituisce `preferredId`.
    2. Nel ramo **autenticato** `POST /api/portal/bills`: usa solo `customer.assignedBrokerId` se valido e attivo; altrimenti lascia `assignedBrokerId = undefined` (coda non assegnata). Rimozione completa del fallback `'user-op-2'`.
    3. Nel ramo **guest** (`POST /api/portal/bills` / `/consultations` senza auth): `resolveDefaultBrokerId()` seleziona un operatore/broker attivo reale se presente (solo come assegnatario iniziale ove esistente), altrimenti `undefined` (coda non assegnata visibile ad `admin` e `call_center`).
- `admin` continua a vedere tutte le pratiche/bollette; `call_center` vede i lead non assegnati in coda lead per smistarli; qualsiasi `broker`/`operator` non assegnato riceve `403`.

### A.2 Idempotenza persistente e compensazione su upload autenticato
- **File:** `server/src/routes/portal.ts`, `server/src/services/portalService.ts`.
- Estendere il meccanismo già esistente del ramo guest al ramo autenticato `POST /api/portal/bills`:
  - Calcolo SHA-256 canonico comprensivo di `accountScope: customer.id`, `utilityType`, `fileName` sanitizzato, `mimeType` normalizzato e `bytesSha256`.
  - Chiave `idempotencyKey` scoped all'account (`acct:${customer.id}:key:${idempotencyKey}` per in-flight lock; in memoria + DB su `leads.idempotency_key` con prefisso o scope coerente su `idempotency_fingerprint`).
  - Lookup preventivo su `leads` esistenti (`source='bill_upload'`) e coda `inFlightAuthenticatedBills`:
    - Stessa chiave + stesso fingerprint -> `200 OK` (`idempotent: true`) con `bill` e `lead` esistenti, senza creare secondo file né secondo lead.
    - Stessa chiave + fingerprint/contenuto diverso (o account diverso sulla stessa chiave scoped) -> `409 Conflict`.
  - Compenso atomico:
    - Se `addLead` fallisce o il worker perde la gara su `23505` contro un altro worker con stesso `idempotencyKey`: elimina **esclusivamente** il record/file creato dal worker perdente (`portalService.deleteBill(bill.id)`), gestendo esplicitamente eventuali errori di `deleteBill`/`removeBill` senza mai cancellare il file del worker vincente e senza mascherare errori di Storage (`portalService.uploadBill` fallito propaga errore HTTP 500/503).

---

## 3. Sezione B — Collegamenti, OAuth e Accessibilità Registrazione (`P2`)

- **Link diretto upload da "Le mie forniture" (`CustomerApp.tsx`, `EnergyBillIntake.tsx`, `SubitoMySupplies.tsx`):**
  - `CustomerApp` mantiene `intakeInitialMode?: IntakeMode` (azzerato o impostato su `'upload'` quando `SubitoMySupplies.onUploadBill` viene invocato, mentre resta `undefined` negli ingressi normali così `EnergyBillIntake` usa `'profile'` per clienti con forniture e `'wizard'` per nuovi utenti senza forniture).
  - `EnergyBillIntake` riceve `key` o sincronizza l'effetto controllato su `initialMode` esplicito in ingresso quando si cambia flusso verso upload.
- **Disponibilità OAuth (`OAuthButtons.tsx`):**
  - Verificare `isGoogleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)` e `isAppleConfigured = Boolean(import.meta.env.VITE_APPLE_CLIENT_ID)`.
  - In `!DEMO_MODE`: renderizzare solo i provider configurati; se nessuno è configurato, restituire `null` (nessun bottone finto, nessun errore post-click).
- **Accessibilità & UI Registrazione (`PortalGate.tsx`):**
  - Titolo card dinamico coerente con la vista: `"Accedi alle tue bollette"`, `"Crea il tuo account"`, `"Verifica la tua email"`, `"Recupera la password"`, `"Imposta nuova password"`.
  - Tutte le `<label htmlFor="...">` associate ai rispettivi `id` (`register-name`, `register-fiscal-code`, `register-email`, `register-phone`, `register-password`, `register-privacy`, `register-marketing`, ecc.).
  - Attributi `autoComplete` appropriati (`name`, `email`, `tel`, `current-password`, `new-password`, `one-time-code`).
  - Pulsante accessibile mostra/nascondi password (`type="button"`, `aria-pressed`, `aria-label="Mostra password"` / `"Nascondi password"`).
  - Messaggi di errore specifici annunciati in `<div role="alert" aria-live="assertive">` + gestione focus sul primo campo invalido o sull'alert di errore + pulsante submit con `disabled={isSubmitting}` e indicazione testuale/visiva di invio in corso.

---

## 4. Sezione C — Ciclo Completo Account, Verifica Email, Reset Password e Sessioni (`P1`)

### C.1 Modello Dati & Migrazione Incrementale (`20261117_01_account_lifecycle_and_tokens.sql`)
- Aggiungere tabella `public.auth_action_tokens` (RLS attivo, `revoke all from public, anon, authenticated; grant all to service_role;`):
  - `id uuid primary key default gen_random_uuid()`
  - `account_id text not null references public.crm_accounts(id) on delete cascade`
  - `purpose text not null check (purpose in ('verify_email', 'reset_password', 'change_email'))`
  - `token_hash text not null unique` (SHA-256 hex 64 char)
  - `target_email text` (per verifica o cambio email)
  - `expires_at timestamptz not null`
  - `consumed_at timestamptz`
  - `revoked_at timestamptz`
  - `created_at timestamptz not null default timezone('utc', now())`
- Aggiungere colonna `token_version integer not null default 1` e `email_verified boolean not null default false` su `public.crm_accounts` (i record già esistenti con `profile->>'onboardingStatus' = 'active'` o senza campo vengono considerati `email_verified = true` nella migrazione compatibile).
- Aggiungere su `public.crm_accounts.profile` i metadati consenso registrazione: `privacyConsentAccepted`, `privacyConsentTimestamp`, `privacyPolicyVersion`, `marketingConsent`, `marketingConsentTimestamp`.
- Aggiungere `claim_token_hash text` su `public.portal_bills` e `public.leads` per l'associazione sicura guest -> cliente (Sezione D).
- Creare indice parziale `customers_fiscal_code_unique` (previa query di controllo duplicati, escludendo placeholder `OAUTHUSER*` / vuoti; `register_customer_account` verifica unicità CF/P.IVA e email in transazione con `pg_advisory_xact_lock`).
- Nuove RPC `SECURITY DEFINER` (`set search_path = public, pg_temp`, `revoke all from public, anon, authenticated; grant execute to service_role;`):
  - `consume_auth_action_token(p_token_hash text, p_purpose text)` (consumo atomico con `FOR UPDATE`: rifiuta se scaduto, revocato o già consumato).
  - `complete_password_reset(...)`, `complete_email_verification(...)`, `bump_account_token_version(p_account_id text)`.

### C.2 Registrazione, Verifica Email e Login
- `POST /api/auth/register-customer`:
  - Valida con `registerCustomerSchema`: nome, email, telefono, CF/P.IVA (con **checksum ufficiale italiano** fuori da `VOLTA_DEMO_MODE`), password (12–72 char), `privacyConsent: true`, `privacyPolicyVersion` (opzionale con default esplicito `'bozza-2026-11'`), `marketingConsent: boolean().default(false)`.
  - Crea utente con `onboardingStatus: 'pending_verification'`, `emailVerified: false`, `tokenVersion: 1`. **Non restituisce token JWT di accesso completo** in stato `pending_verification` (o blocca accesso alle rotte portale finché non verificato); invia email con link monouso contenente token 256-bit verso `APP_PUBLIC_URL` / origine consentita.
  - Se l'invio email fallisce (es. provider assente in produzione o errore SMTP/API), **non dichiara invio riuscito** (`emailSent: false`, HTTP 201 o 503 coerente con messaggio esplicito sul blocco consegna email e possibilità di reinvio).
- `POST /api/auth/verify-email`: consuma atomicamente il token (`verify_email`), imposta `emailVerified: true` e `onboardingStatus: 'active'`, e registra evento in `security_logs`.
- `POST /api/auth/resend-verification`: rate-limited (`loginLimiter`), revoca eventuali token `verify_email` precedenti ancora attivi per quell'account ed emette nuovo token con nuova scadenza (24h). Risposta generica per evitare enumerazione email.
- Login (`POST /api/auth/login-customer`): se `onboardingStatus === 'pending_verification'`, rifiuta con `403` e flag `requireEmailVerification: true`. Account legacy `active` continuano ad accedere normalmente.

### C.3 Recupero / Cambio Password e Revoca Sessioni Server-Side
- `POST /api/auth/forgot-password` (rate-limited): cerca account `customer` (e non rivela mai se esiste: risponde sempre `200` generico). Genera token `reset_password` (scadenza 1h), revoca precedenti token di reset non consumati e invia email transazionale senza password né segreti.
- `POST /api/auth/reset-password`: consuma atomicamente il token monouso, aggiorna `password_hash` (bcrypt cost 12), **incrementa `tokenVersion` (`+1`)** invalidando immediatamente tutti i JWT esistenti, e registra audit log.
- `POST /api/auth/change-password` (autenticato): verifica password attuale, aggiorna `password_hash`, incrementa `tokenVersion` (`+1`) ed emette nuovo JWT aggiornato per la sessione corrente (le altre sessioni decadono subito).
- `POST /api/auth/logout-all` (autenticato): incrementa `tokenVersion` (`+1`), revocando tutte le sessioni JWT attive ovunque.
- `authenticateToken` in `server/src/middleware/auth.ts`: verifica `Number(decoded.tokenVersion ?? 1) === Number(current.tokenVersion ?? 1)`; documentare in UI e codice che il solo `logout()` locale rimuove `localStorage`, mentre la revoca reale usa `POST /api/auth/logout-all`.

### C.4 Provider Email Transazionale (`server/src/services/emailService.ts`)
- Supporto `EMAIL_PROVIDER`: `'resend'` (via API HTTPS `https://api.resend.com/emails`), `'smtp'` (o webhook/JSON transport senza dipendenze fragili — es. implementazione client SMTP/TLS o Nodemailer se aggiunto, oppure Resend + SMTP/test adapter verificabile), `'memory'` (solo in `NODE_ENV === 'test' || VOLTA_DEMO_MODE === 'true'`).
- Gestione retry limitati (es. 2 retry su errori 5xx/rete transitori) ed esito esplicito `{ sent: boolean; provider: string; error?: string }` senza mascherare fallimenti in produzione.

### C.5 Consenso & Informativa Contestuale (`PortalGate.tsx`)
- Vicino al form di registrazione: link diretti al modale Informativa Privacy e Condizioni di Servizio, checkbox obbligatoria privacy (con nota chiara che i testi societari restano provvisori finché non confermati dal titolare), checkbox separata facoltativa non preselezionata per comunicazioni promozionali/marketing.

---

## 5. Sezione D — Primo Accesso, Claim Bolletta Guest, Richieste e Gestione Account (`P2`)

- **Nuovo cliente senza forniture (`SubitoMySupplies.tsx`, `CustomerApp.tsx`):**
  - Invito chiaro a caricare la prima bolletta + visualizzazione elenco bollette già caricate con stati leggibili backend-driven (`Ricevuta / In verifica`, `Richiesta informazioni`, `Analizzata`, `Archiviata`), **senza** numeri/risparmi o monitoraggi fittizi prima dell'analisi.
  - Sezione "Il tuo consulente": mostrata **solo** quando `customer.assignedBrokerId` / `accountManager` corrisponde a un consulente assegnato reale (mai un fallback inventato).
- **Area "Il mio Account" per il cliente (`CustomerAccountView` in `CustomerApp.tsx` + backend routes):**
  - Modifica recapiti (`telefono`, `città`) tramite `PATCH /api/customers/:id` esistente; se si cambia `email`, nuovo flusso di verifica (`POST /api/auth/request-email-change` + token `change_email` -> `POST /api/auth/confirm-email-change`) prima di sostituire l'email di accesso su `crm_accounts` e `customers`!
  - Cambio password (`POST /api/auth/change-password`) e revoca tutte le sessioni (`POST /api/auth/logout-all`) con spiegazione trasparente su cosa fa il logout locale vs revoca globale.
  - **Richiesta assistenza (`POST /api/portal/support-requests`):** crea un lead/ticket tracciato con stato consultabile dal cliente e notifica staff.
  - **Esportazione dati (`GET /api/portal/account/export`):** restituisce JSON strutturato con anagrafica, forniture, metadati bollette, autoletture e consensi GDPR dell'utente autenticato.
  - **Richiesta chiusura account (`POST /api/portal/account/closure-request`):** richiede conferma password (per account a credenziali), imposta stato sospeso/in chiusura revocando i token (`tokenVersion + 1`), registra evento GDPR su `security_logs` e **conserva** documenti contrattuali (`signature_logs`, `portal_bills`) secondo gli obblighi di legge, senza cancellazione automatica distruttiva.
- **Passaggio Bolletta Guest -> Account (`POST /api/portal/bills/claim`):**
  - Al momento dell'upload guest `POST /api/portal/bills`, generare un `claimToken` crittografico casuale (restituito una sola volta nella risposta di conferma upload al guest + salvato come digest `claimTokenHash` su `portal_bills`/`leads`, ed emesso anche nell'eventuale email riepilogativa se fornita).
  - Un utente autenticato (`customer`) può associare quella bolletta al proprio account **solo** inviando il `claimToken` valido (prova di possesso, consumo atomico monouso `claimTokenHash -> null`, riassegnazione sicura `customer_id = actor.customerId`), mai tramite semplice corrispondenza email/telefono.
- **Inviti Staff (`invitationService.ts`, `TeamProfilesManager.tsx`):**
  - Verificare creazione, scadenza, rinnovo, attivazione, setup 2FA TOTP, e collegare la consegna email tramite `emailService` restituendo esplicitamente `{ emailSent, deliveryError? }` senza confondere generazione token con invio email riuscito.

---

## 6. Sezione E — Rilascio, Identificativo Versione e Collaudo (`P1 operativo`)

- **Identificativo non sensibile su `/health` (`server/src/index.ts`):** esporre `release: { commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT_SHA || BUILD_COMMIT, buildTimestamp }` così da poter verificare oggettivamente quale commit è attivo su Render.
- **Migrazioni e SQL verification (`supabase/migrations/20261117_01_account_lifecycle_and_tokens.sql` + allineamento `supabase/schema.sql`):**
  - Controllare presenza migrazioni `20261019_01`, `20261019_02`, `20261023_01` e `20261117_01`.
  - Tutte le RPC `SECURITY DEFINER` hanno `set search_path = public, pg_temp`, `revoke all from public, anon, authenticated` e `grant execute to service_role`.
  - Controllare eventuali duplicati `fiscal_code` prima di creare l'indice parziale univoco.
- **Collaudo completo:**
  - Nuovo test E2E completo (su server Express + adapter email in-memory locale) che copre: registrazione -> blocco login prima della verifica -> verifica email -> primo login -> caricamento bolletta -> presa in carico staff assegnato -> analisi -> visualizzazione stato cliente -> cambio email verificato -> reset password -> blocco vecchia password e vecchi JWT -> nuovo login, più isolamento parallelo di secondo cliente e secondo broker.
  - Verifiche browser reali (desktop ~1440px e mobile ~390px) con screenshot reali dei flussi modificati (registrazione, recupero password, area account, collegamento "Carica la tua prima bolletta").
  - `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run server:build`, `npm.cmd test`.

---

## Checklist Self-Review della Specifica
- Nessun placeholder (`TBD`, `TODO`) presente.
- Regola CF/P.IVA coerente con la risposta utente (`A1`: checksum + unicità 1:1 solo fuori `VOLTA_DEMO_MODE`, seed storici intatti).
- OAuth coerente con risposta utente (`A2`: nascosti in produzione se non configurati).
- Servizi esterni coerenti con risposta utente (`A3`: provider email con adapter test locale, blocco consegna esplicito in produzione senza credenziali, nessun SQL cloud applicato senza autorizzazione).

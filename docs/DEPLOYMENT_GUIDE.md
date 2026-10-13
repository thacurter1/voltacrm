# Guida Operativa al Rilascio in Produzione — VoltaCRM SaaS

Questa guida descrive la procedura completa per il deploy e la messa online pubblica di **VoltaCRM SaaS**, inclusi il Comparatore Energetico pubblico, l'Area Clienti, il Portale Staff & Broker e il motore di acquisizione lead.

---

## 1. Architettura di Produzione

```
                          [ VISITATORI PUBBLICI & CLIENTI ]
                                          │
                        HTTPS / DNS (es. voltacrm.it)
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │          Frontend SPA (Vite)          │
                      │  Hosting: Vercel / Netlify / VPS      │
                      │  - Root `/`: Comparatore Pubblico     │
                      │  - Footer Legale & Banner Cookie      │
                      │  - Modal Trasparenza GDPR / ARERA     │
                      └───────────────────┬───────────────────┘
                                          │ API REST (HTTPS)
                                          ▼
                      ┌───────────────────────────────────────┐
                      │       Backend API Express (Node)      │
                      │  Hosting: Render / Fly.io / VPS       │
                      │  - Rate Limiting & Helmet HSTS        │
                      │  - Router `/api/portal/*`             │
                      │  - Sessioni JWT & 2FA TOTP            │
                      └───────────────────┬───────────────────┘
                                          │ Service Role Key
                                          ▼
                      ┌───────────────────────────────────────┐
                      │        Supabase PostgreSQL DB         │
                      │  - Tabelle: leads, customers, bills   │
                      │  - Tabelle: signature_logs, notifs    │
                      │  - Tabella: crm_accounts              │
                      └───────────────────────────────────────┘
```

---

## 2. Configurazione Variabili d'Ambiente

### 2.1 Backend (`server/.env`)
Configura le seguenti variabili nel pannello di controllo dell'hosting backend (es. Render Environment Variables o file `.env` su VPS). Fai riferimento al file di esempio [`server/.env.production.example`](file:///server/.env.production.example).

| Variabile | Valore / Descrizione | Obbligatoria |
|---|---|:---:|
| `NODE_ENV` | `production` | **Sì** |
| `VOLTA_DEMO_MODE` | `false` (categorico: disabilita mock e forza la persistenza su database) | **Sì** |
| `PORT` | `5000` (o porta assegnata dal provider PaaS) | **Sì** |
| `CORS_ORIGIN` | Domini autorizzati separati da virgola (es. `https://voltacrm.it,https://app.voltacrm.it`) | **Sì** |
| `JWT_SECRET` | Chiave crittografica casuale $\ge 32$ caratteri | **Sì** |
| `SUPABASE_URL` | Endpoint del progetto Supabase (es. `https://wobbcdurpamtbkicqzhx.supabase.co`) | **Sì** |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave privata `service_role` (da Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API) | **Sì** |
| `ADMIN_EMAIL` | Email dell'amministratore per il bootstrap iniziale (es. `amministrazione@voltacrm.it`) | Al primo avvio |
| `ADMIN_INITIAL_PASSWORD` | Password sicura ($\ge 12$ caratteri, maiuscole, numeri, simboli) | Al primo avvio |
| `ADMIN_2FA_SECRET` | Segreto TOTP Base32 ($\ge 20$ caratteri, es. `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP`) | Al primo avvio |
| `GEMINI_API_KEY` | Chiave Google Gemini Vision API per OCR avanzato bollette | Consigliata |
| `WHATSAPP_CLOUD_API_TOKEN` | Token permanente Meta Graph API per messaggistica | Opzionale |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone ID WhatsApp Business API | Opzionale |

> [!IMPORTANT]
> **Generazione Segreti Crittografici**:
> Puoi generare un `JWT_SECRET` sicuro direttamente da terminale con il comando:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

### 2.2 Frontend (`.env.production` / Vercel Environment Variables)

| Variabile | Valore / Descrizione | Obbligatoria |
|---|---|:---:|
| `VITE_API_URL` | URL pubblico delle API backend (es. `https://api.voltacrm.it/api` o `/api` con reverse proxy) | **Sì** |
| `VITE_DEMO_MODE` | `false` | **Sì** |
| `VITE_SUPABASE_URL` | Endpoint Supabase (es. `https://wobbcdurpamtbkicqzhx.supabase.co`) | **Sì** |
| `VITE_SUPABASE_ANON_KEY` | Chiave anonima/publishable (es. `sb_publishable_...`) | **Sì** |
| `VITE_GOOGLE_CLIENT_ID` | Client ID Google OAuth (se si abilita login social clienti) | Opzionale |
| `VITE_APPLE_CLIENT_ID` | Client ID Apple Sign-In | Opzionale |

---

## 3. Pre-Flight Check Automatizzato

Prima di avviare il traffico verso la produzione, esegui il tool di verifica integrato:

```bash
# Verifica rapida con test suite integrata
node scripts/verify_production_readiness.cjs --test

# Verifica di un file d'ambiente specifico (es. server/.env)
node scripts/verify_production_readiness.cjs --env-file=server/.env
```

Il tool verificherà:
1. Disattivazione categorica della modalità demo (`VOLTA_DEMO_MODE=false`).
2. Entropia e lunghezza del `JWT_SECRET`.
3. Validità dell'endpoint e dei privilegi `service_role` di Supabase.
4. Robustezza della password e del segreto 2FA TOTP di bootstrap.
5. Correttezza dei domini CORS autorizzati.

---

## 4. Procedura di Deploy

### 4.1 Deploy Frontend (su Vercel)
1. Connetti il repository Git a Vercel.
2. Imposta il Framework Preset su **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Aggiungi le variabili d'ambiente di produzione (`VITE_API_URL`, `VITE_DEMO_MODE=false`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
6. Deploy.

### 4.2 Deploy Backend (su Render / VPS)
1. **Build Command**: `npm run server:build`.
2. **Start Command**: `npm run server:start`.
3. Inserisci tutte le variabili d'ambiente descritte nella sezione 2.1.
4. Assicurati che l'Health Check sia impostato su `/api/health`.

---

## 5. Primo Accesso Amministratore (Bootstrap 2FA)

Al primo avvio, se la tabella `crm_accounts` non contiene alcun amministratore:
1. Il backend esegue la funzione `bootstrapAdmin()` registrando l'utente definito da `ADMIN_EMAIL` e `ADMIN_INITIAL_PASSWORD`.
2. L'account è configurato nativamente con l'autenticazione a due fattori attiva (`is2faEnabled: true`).
3. Inserisci la chiave manuale fornita in `ADMIN_2FA_SECRET` (o scansiona il codice TOTP corrispondente) nell'app **Google Authenticator** o **Authy**.
4. Apri la pagina di login staff (`https://voltacrm.it/?portal=staff` o clicca su **"Area Staff & Broker"**).
5. Inserisci email e password, poi inserisci il codice a 6 cifre generato dall'app per entrare nella console CRM.
6. Una volta effettuato il primo accesso, rimuovi o azzera le variabili `ADMIN_INITIAL_PASSWORD` e `ADMIN_2FA_SECRET` dall'ambiente per massima sicurezza (l'utente è ora memorizzato in modo persistente e protetto con hash bcrypt su Supabase).

---

## 6. Smoke-Test di Collaudo Live Post-Deploy

Esegui questa rapida sequenza di test sul dominio di produzione per convalidare l'intero funnel:

- [ ] **Test 1 - Comparatore Pubblico (`/`)**:
  - Apri la homepage in una scheda anonima.
  - Verifica che appaia direttamente il comparatore ufficiale Volta Energia con selettore Luce/Gas e opzioni di calcolo (senza barriere di login).
- [ ] **Test 2 - Stima Profilo Casa**:
  - Seleziona "Stima da profilo casa", scegli "Coppia (2 persone)" e attiva "Pompa di calore / Clima".
  - Clicca su "Confronta offerte con questa stima" e verifica i risultati con prezzo mensile in evidenza (`~€.../mese`).
- [ ] **Test 3 - Richiesta Consulenza Ospite**:
  - Clicca su un'offerta, compila il form con Nome, Telefono e spunta la privacy.
  - Invia e verifica la schermata di conferma con ricontatto garantito entro 24 ore.
- [ ] **Test 4 - Caricamento Bolletta Ospite**:
  - Torna al modulo iniziale, clicca su "Carica la tua bolletta", inserisci un file PDF/JPG e i dati di contatto.
  - Invia e verifica il completamento dell'acquisizione.
- [ ] **Test 5 - Ricezione Lead nel CRM**:
  - Accedi all'area riservata Staff (`/?portal=staff`).
  - Verifica che la campanella delle notifiche segnali i 2 nuovi lead urgenti con badge `public_comparator` e `bill_upload`.
  - Clicca sul pulsante **WhatsApp** del lead appena inserito: verifica che apra la chat con il messaggio precompilato.
- [ ] **Test 6 - Conformità e Trasparenza Legale**:
  - Scorri il footer: verifica la presenza di ragione sociale, P.IVA, REA, numero verde 800 912 345 e link privacy.
  - Apri il modal Trasparenza e verifica le 3 schede (Informativa Privacy GDPR, Criteri di Calcolo ARERA, Termini di Servizio).

---

## 7. Manutenzione, Backup e Monitoraggio

- **Backup Database**: Supabase effettua snapshot automatici giornalieri. È consigliabile impostare un backup periodico via `pg_dump`.
- **Rotazione Credenziali**: In caso di sospetta compromissione di un operatore, l'amministratore può revocare la sessione o aggiornare la password direttamente dalla tabella `crm_accounts`.
- **Test di Non-Regressione**: Prima di ogni futuro deploy o aggiornamento del codice, esegui sempre localmente:
  ```bash
  npm run lint && npm run build && npm run server:build && npm test
  ```
  Tutte le 45 suite di test devono terminare con esito positivo (**45/45 PASS**).

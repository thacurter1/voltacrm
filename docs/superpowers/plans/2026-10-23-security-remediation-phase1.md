# Fase 1: Bonifica Vulnerabilità Critiche di Sicurezza (SEC-01, SEC-02, SEC-03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bonificare immediatamente le 3 vulnerabilità a severità CRITICAL individuate nel security audit: il bypass CORS su prefissi dominio arbitrari, la vulnerabilità di IP spoofing in `proxy-addr` (CVSS 9.1) e il segreto 2FA TOTP di default RFC 3548 hardcoded/documentato.

**Architecture:** 
- Rafforzamento della logica CORS in `server/src/index.ts`: vincolare i sottodomini `clienti-`, `staff-`, `crm-` esclusivamente al dominio genitore configurato o a pattern specifici e limitati di Vercel (`.vercel.app`), bloccando qualsiasi dominio terzo che inizi con tali prefissi.
- Aggiornamento della dipendenza transitiva `proxy-addr` alla versione patchata `>=2.0.8` nel `server/package-lock.json`.
- Neutralizzazione del seed 2FA di default `JBSWY3DPEHPK3PXP`: generazione di un seed casuale crittograficamente forte (Base32) per `ADMIN_2FA_SECRET`, aggiornamento di `server/.env` e aggiunta del blocco esplicito di questo test vector nei validatori `runtimeConfig.ts` e `verify_production_readiness.cjs`.

**Tech Stack:** Node.js, Express, CORS, Helmet, crypto (CSPRNG), npm audit.

**Spec:** `brain/7badb234-2ab3-40ff-9748-a44736212863/security_audit_report_2026_10_23.md`

## Global Constraints

- Non stampare mai valori di segreti in chiaro nei log, nelle asserzioni o nei report.
- Non rompere la compatibilità con i domini leciti di sviluppo (`localhost`, `*.localhost`) e di produzione (`voltagroup.it`, `clienti.voltagroup.it`, `staff.voltagroup.it`, `crm.voltagroup.it`).
- Ogni fix deve essere accompagnato da test automatizzati che ne dimostrino l'efficacia (Red/Green TDD).

---

### Task 1: Bonifica Vulnerabilità CORS su prefissi dominio arbitrari (SEC-01)

**Files:**
- Modify: `server/src/index.ts:45-68`
- Test: `tests/test_cors_security_hardening.cjs`

**Interfaces:**
- Consumes: `origin` header da richiesta HTTP.
- Produces: `callback(null, true)` solo se l'origine è esattamente nell'elenco `allowedOrigins` o è un sottodominio valido del rootDomain (es. `clienti.rootDomain`, `staff.rootDomain`) o un preview deployment Vercel legittimo ancorato a `.vercel.app`. Rifiuta qualsiasi dominio tipo `https://clienti-attacker.com` o `https://staff-evil.org`.

- [x] **Step 1: Scrivere il test per verificare il fallimento (Red)**
Creare `tests/test_cors_security_hardening.cjs` che simula richieste CORS con origin legittimi (`http://localhost:5173`, `http://clienti.localhost:5173`, `https://clienti.voltagroup.it`) e con origin ostili (`https://clienti-evil.com`, `https://staff-phishing.org`, `https://crm-attacker.net`). Verificare che attualmente gli origin ostili vengano erroneamente ammessi.

- [x] **Step 2: Eseguire il test per verificare che fallisce**
Eseguire: `node tests/test_cors_security_hardening.cjs`
Atteso: FAIL (gli origin malevoli vengono ammessi da `startsWith('clienti-')`).

- [x] **Step 3: Correggere la logica CORS in `server/src/index.ts`**
Rimuovere il matching aperto `parsed.hostname.startsWith('clienti-')` che non controlla il dominio genitore, sostituendolo con controlli rigorosi:
```typescript
const isAllowedProdSubdomain = allowedOrigins.some(allowed => {
  try {
    const base = new URL(allowed);
    const rootDomain = base.hostname.replace(/^(www|clienti|cliente|staff|crm)\./, '');
    const isExactSub = (
      parsed.hostname === rootDomain ||
      parsed.hostname === `clienti.${rootDomain}` ||
      parsed.hostname === `cliente.${rootDomain}` ||
      parsed.hostname === `staff.${rootDomain}` ||
      parsed.hostname === `crm.${rootDomain}`
    );
    // Allow vercel preview deployments only if base origin itself is or targets vercel.app
    const isVercelPreview = base.hostname.endsWith('.vercel.app') && (
      (parsed.hostname.startsWith('clienti-') || parsed.hostname.startsWith('staff-') || parsed.hostname.startsWith('crm-')) &&
      parsed.hostname.endsWith('.vercel.app')
    );
    return parsed.protocol === base.protocol && (isExactSub || isVercelPreview);
  } catch {
    return false;
  }
});
```

- [x] **Step 4: Eseguire il test per verificare che passa (Green)**
Eseguire: `node tests/test_cors_security_hardening.cjs`
Atteso: PASS (tutti i test di ammissione legittima passano, tutti i test di domini malevoli vengono respinti).

- [x] **Step 5: Commit delle modifiche CORS**
```bash
git add server/src/index.ts tests/test_cors_security_hardening.cjs
git commit -m "fix(security): sanitize CORS subdomain matching against malicious domain prefixes (SEC-01)"
```

---

### Task 2: Aggiornamento della dipendenza `proxy-addr` (SEC-02)

**Files:**
- Modify: `server/package-lock.json`
- Test: `npm audit --prefix server --json`

**Interfaces:**
- Consumes: dipendenza `proxy-addr` in `server/package-lock.json`.
- Produces: `proxy-addr >= 2.0.8` priva di GHSA-jqcg-44mw-7w3h.

- [x] **Step 1: Verificare l'advisory attuale di vulnerabilità critica**
Eseguire: `npm.cmd audit --prefix server --json`
Atteso: 1 vulnerabilità critical (`proxy-addr`).

- [x] **Step 2: Aggiornare la dipendenza `proxy-addr` nel package-lock del server**
Eseguire l'aggiornamento mirato della dipendenza nel server senza toccare i contratti di versione di produzione.
Verificare che la versione installata di `proxy-addr` sia `>= 2.0.8`.

- [x] **Step 3: Verificare con `npm audit` l'azzeramento della vulnerabilità critica**
Eseguire: `npm.cmd audit --prefix server --json`
Atteso: 0 vulnerabilità critical.

- [x] **Step 4: Commit delle modifiche alle dipendenze**
```bash
git add server/package-lock.json
git commit -m "fix(security): update proxy-addr to patch GHSA-jqcg-44mw-7w3h IP spoofing (SEC-02)"
```

---

### Task 3: Neutralizzazione del segreto 2FA di default RFC 3548 (SEC-03)

**Files:**
- Modify: `server/src/services/runtimeConfig.ts`
- Modify: `scripts/verify_production_readiness.cjs`
- Modify: `server/.env.production.example`
- Modify: `docs/DEPLOYMENT_GUIDE.md`
- Modify: `server/.env` (aggiornamento con un segreto TOTP casuale forte crittograficamente)
- Test: `tests/test_totp_secret_validation.cjs`

**Interfaces:**
- Consumes: `process.env.ADMIN_2FA_SECRET`.
- Produces: blocco esplicito di `JBSWY3DPEHPK3PXP` in `runtimeConfig.ts` e `verify_production_readiness.cjs`, e sostituzione nel file `.env` con un segreto crittograficamente sicuro a 32 caratteri Base32 senza stampare il segreto nei log.

- [x] **Step 1: Scrivere il test per la validazione del segreto 2FA**
Creare `tests/test_totp_secret_validation.cjs` che verifica che la funzione di validazione:
- Rifiuti `JBSWY3DPEHPK3PXP` e sue ripetizioni come segreto non sicuro.
- Rifiuti stringhe più corte di 20 caratteri o contenenti `VOLTA_`.
- Accetti un segreto casuale Base32 ad alta entropia.

- [x] **Step 2: Eseguire il test per verificare il fallimento attuale**
Eseguire: `node tests/test_totp_secret_validation.cjs`
Atteso: FAIL (perché `JBSWY3DPEHPK3PXP` attualmente viene accettato da `runtimeConfig.ts`).

- [x] **Step 3: Aggiornare `runtimeConfig.ts` e `verify_production_readiness.cjs`**
Aggiungere il controllo esplicito per bloccare il test vector pubblico RFC 3548 / Google Authenticator (`JBSWY3DPEHPK3PXP`).
Aggiornare `docs/DEPLOYMENT_GUIDE.md` e `server/.env.production.example` per rimuovere il seed statico di default e documentare il comando di generazione sicura:
`node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"` o script Base32 dedicato.

- [x] **Step 4: Generare un segreto Base32 casuale forte e aggiornare `server/.env`**
Generare un segreto crittograficamente casuale (32 caratteri Base32) e aggiornare `ADMIN_2FA_SECRET` in `server/.env` in modo programmatico senza stamparlo nei log.

- [x] **Step 5: Verificare il superamento del test e del pre-flight check**
Eseguire: `node tests/test_totp_secret_validation.cjs` e `node scripts/verify_production_readiness.cjs --env-file=server/.env`
Atteso: Entrambi completati con successo (PASS).

- [x] **Step 6: Commit delle modifiche di validazione e documentazione**
```bash
git add server/src/services/runtimeConfig.ts scripts/verify_production_readiness.cjs server/.env.production.example docs/DEPLOYMENT_GUIDE.md tests/test_totp_secret_validation.cjs
git commit -m "fix(security): forbid known RFC 3548 TOTP example seed and enforce random admin 2FA secret (SEC-03)"
```

---

### Task 4: Verifica Finale di Regressione della Fase 1

- [x] **Step 1: Esecuzione di tutti i test della suite**
Eseguire `node run_all_tests.cjs` per verificare che nessuna funzionalità preesistente sia stata impattata.
- [x] **Step 2: Verifica con `scripts/verify_production_readiness.cjs`**
Verificare il passaggio di tutti i check di produzione.

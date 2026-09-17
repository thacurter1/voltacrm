# ⚡ VoltaCRM — Energy Brokerage & Management SaaS

[![CI Pipeline](https://github.com/thacurter1/voltacrm/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/thacurter1/voltacrm/actions/workflows/ci.yml)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Production-success?logo=vercel)](https://voltacrm-n4ooiko3f-matteo-curti-s-projects.vercel.app)
[![Node.js Version](https://img.shields.io/badge/Node.js-22%20LTS-brightgreen?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](#)

> **VoltaCRM** è una piattaforma SaaS di ultima generazione per broker energetici, agenzie multiservizio e clienti finali (B2B e B2C), conforme agli standard di mercato e alle delibere **ARERA**. Include motore di rinegoziazione a 120 giorni (Switch Quadrimestrale), feed live GME (PUN/PSV), firma elettronica avanzata (FEA), portale clienti self-service e modulo Totem Kiosk Retail.

---

## 🚀 Live Demo in Produzione

- **Frontend Web App (Vercel):** [https://voltacrm-n4ooiko3f-matteo-curti-s-projects.vercel.app](https://voltacrm-n4ooiko3f-matteo-curti-s-projects.vercel.app)
- **CI Pipeline (GitHub Actions):** [Workflow Run Status](https://github.com/thacurter1/voltacrm/actions)

---

## 👥 Credenziali di Accesso Pronte all'Uso (Demo & Testing)

La schermata di login include pulsanti rapidi a 1-click per testare immediatamente ogni ruolo e permessi:

| Ruolo / Tipologia | Utente / Azienda | Email / Identificativo | Password | Note & 2FA |
| :--- | :--- | :--- | :--- | :--- |
| 🛡️ **Broker Owner & Admin** | Matteo Riva | `m.riva@voltagroup.it` | `admin123` | TOTP: `123456` (RFC 6238) |
| 🎧 **Operatore Call Center** | Chiara Bianchi | `c.bianchi@voltagroup.it` | `operator123` | TOTP: `123456` |
| 💼 **Consulente Energetico** | Valerio Neri | `v.neri@voltagroup.it` | `operator123` | TOTP: `123456` |
| 🏠 **Cliente B2C Dual Fuel** | Andrea Moretti | `andrea.moretti@email.it`<br>*(CF: `MRTNRA82M15F205X`)* | `customer123` | Fornitura Luce + Gas attiva |
| 🏢 **Cliente B2B Aziendale** | Ristorante La Terrazza Srl | `amministrazione@laterrazzaroma.it`<br>*(P.IVA: `09876540152`)* | `customer123` | Trifase Business 15 kW |
| ⚡ **Cliente B2C Monoutenza** | Elena Fontana | `elena.fontana@libero.it`<br>*(CF: `FNTLNE88A41L219Z`)* | `customer123` | Fornitura Monoraria Luce |

---

## 🏗️ Architettura Tecnologica

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend API:** Node.js 22 LTS, Express ESM, Zod Schema Validation, Helmet, Rate Limiter.
- **Data & Persistence:** Supabase PostgreSQL con RLS policies e in-memory transactional cache.
- **Sicurezza & Conformità:**
  - 2FA TOTP conforme RFC 6238 HMAC-SHA1.
  - Firma Elettronica Avanzata (FEA) con validazione strutturale PNG (CRC32, inflate), tracciamento OTP CSPRNG e marca temporale server-side immutabile.
  - Isolamento IDOR e BOLA rigoroso su tutte le rotte clienti, lead e provvigioni.
  - Conformità ARERA per calcolo PUN fasce orarie F1/F2/F3 con perdite di rete del 10%.

---

## 🛠️ Installazione Locale & Esecuzione Test

### 1. Clonare il repository e installare le dipendenze
```bash
git clone https://github.com/thacurter1/voltacrm.git
cd voltacrm
npm ci
cd server && npm ci && cd ..
```

### 2. Eseguire la suite di test completa (9/9 Suites)
```bash
npm run server:build
node run_all_tests.cjs
```

### 3. Avviare in ambiente di sviluppo
```bash
# Terminale 1 (Backend API su porta 5000)
npm run server:dev

# Terminale 2 (Frontend Vite su porta 5173 con reverse proxy verso /api)
npm run dev
```

---

## 📦 Pipeline CI/CD (GitHub Actions & Vercel)

La pipeline automatica su `.github/workflows/ci.yml` garantisce che ogni commit rispetti i massimi standard qualitativi:
1. `npm ci` (root e server)
2. `npm --prefix server run build` (Typecheck & compilazione TypeScript Backend)
3. `npm run build` (Vite client bundling)
4. `node run_all_tests.cjs` (Esecuzione delle 9 test suite end-to-end e di sicurezza)
5. Deploy automatico istantaneo su **Vercel** con SPA rewrite a `/index.html`.

# Design Specification — Subito.it-Style Customer Portal, Call Center Marketing CRM & Portfolio Revenue Forecast

- **Document:** `docs/superpowers/specs/2026-09-21-subito-style-portal-callcenter-portfolio-design.md`
- **Date:** 2026-09-21
- **Status:** Approved Draft for Implementation Plan
- **Target Platform:** VoltaCRM SaaS (React 19, TypeScript 5.8, Express 4 ESM, Tailwind CSS v4)

---

## 1. Executive Summary

This specification outlines three major functional evolutions for VoltaCRM:
1. **Subito.it-Style Customer Portal:** A complete visual and UX redesign of the customer-facing interface modeled after Italy's leading classifieds marketplace (Subito.it), prioritizing clean card listings, high contrast, category filtering (*Luce, Gas, Dual Fuel*), and immediate savings visibility, while **strictly eliminating any mention or exposure of the 4-month switch frequency** to the end customer.
2. **Marketing to Call Center CRM Pipeline & Bulk CSV Ingestion:** A high-throughput CSV importer capable of handling large lead lists from marketing campaigns, feeding a dedicated Call Center dialer interface with call status tracking and an interactive calendar to book and assign qualified appointments to field/phone energy consultants.
3. **Client Portfolio Manager with Switch Revenue Forecast:** An executive and operational dashboard grouping active contracts by consultant/broker portfolio, calculating precise financial projections of upcoming switch cycles (upfront commissions and recurring annual portfolio maintenance fees).

---

## 2. Architectural Structure & Component Breakdown

```
src/
├── apps/
│   ├── CustomerApp.tsx             # Redesigned Subito.it-style customer marketplace & space
│   ├── CrmApp.tsx                  # Operator & admin CRM container
│   └── TotemApp.tsx                # Kiosk mode
├── components/
│   ├── customer/
│   │   ├── SubitoHeader.tsx        # Subito.it-style navigation bar & search filters
│   │   ├── SubitoOfferCard.tsx     # Classifieds-style offer listing card
│   │   └── SubitoMySupplies.tsx    # Customer private area ("Le mie forniture")
│   ├── callcenter/
│   │   ├── CallCenterWorkspace.tsx # Dedicated call center operator queue & dialer
│   │   ├── BulkCsvImportModal.tsx  # High-volume CSV lead ingestion modal
│   │   └── AppointmentCalendar.tsx # Calendar with consultant assignment
│   └── portfolio/
│       ├── PortfolioManager.tsx    # Consultant portfolio grouping & KPI dashboard
│       └── SwitchEarningsForecast.tsx # Projected revenue calculator on upcoming switch
└── services/
    ├── csvImporter.ts              # Robust CSV parsing & column normalization
    ├── portfolioEngine.ts          # Switch commission forecast calculations
    └── energyEngine.ts             # ARERA calculation engine
```

---

## 3. Detailed Subsystem Specifications

### Subsystem 1: Subito.it-Style Customer Portal (`CustomerApp.tsx`)

#### Visual Identity & Design Language
- **Palette:** Clean white `#ffffff` canvas, subtle slate container backgrounds `#f7f7f8`, crisp borders `#e5e7eb`, and Subito's signature coral/red accent `#e02424` / `#eb483b` for primary CTAs and badges.
- **Header (`SubitoHeader.tsx`):**
  - Brand identity with modern Italian marketplace aesthetics.
  - Search input: *"Cosa cerchi? Cerca tariffa o fornitore..."*.
  - Category selector pills: **Tutte**, **Luce**, **Gas**, **Dual Fuel**.
  - Prominent Action Button: **"Carica Bolletta"** (triggering fast OCR upload).
  - Quick switch to user private area (*"Le mie forniture"* / *"Documenti"*).
- **Marketplace Listing Feed (`SubitoOfferCard.tsx`):**
  - Structured horizontally like classified ads:
    - **Left:** Supplier logo & energy type icon badge (Luce / Gas / Dual).
    - **Center:** Offer title (e.g. *"Octopus Fissa 12M — 100% Green"*), supplier name, pricing structure (Fixed / PUN indexed), ARERA verification badge.
    - **Right:** Highlighted annual estimated savings in bold coral text (e.g. *"Risparmio stimato: € 204/anno"*), unit cost tag, and primary button *"Richiedi attivazione"*.
- **Omission of 4-Month Switch:**
  - The customer sees transparent savings, price stability, and ongoing monitoring.
  - All labels mentioning *"Switch ogni 120 giorni"*, *"Audit quadrimestrale"*, or *"Cambio fornitore ogni 4 mesi"* are strictly omitted from customer-facing views and components.

---

### Subsystem 2: Bulk CSV Ingestion & Call Center CRM (`CallCenterWorkspace.tsx`)

#### High-Volume CSV Importer (`csvImporter.ts` & `BulkCsvImportModal.tsx`)
- Supports drag-and-drop file upload of `.csv` and `.txt` files.
- Automatically handles Windows CRLF (`\r\n`) and UNIX LF (`\n`).
- Auto-detects delimiters: comma `,` or semicolon `;` (standard in Italian Excel exports).
- Flexible column header mapping:
  - **Name:** `Nome`, `Nome e Cognome`, `Ragione Sociale`, `Cliente`
  - **Phone:** `Telefono`, `Cellulare`, `Tel`, `Phone`
  - **Email:** `Email`, `E-mail`, `Posta`
  - **City:** `Città`, `Comune`, `Provincia`, `CAP`
  - **Consumption/Power:** `Consumo`, `Consumo Annuo`, `kWh`, `Smc`, `Potenza`
  - **Notes/Campaign:** `Note`, `Fonte`, `Campagna`, `Marketing`
- Preview grid showing the first 5 records with validation status before confirming ingestion.
- Automatically pushes validated records to the Call Center queue as `status: 'new'`.

#### Operator Dialer Workspace & Call Pipeline
- Focused workspace designed for fast calling:
  - Lead contact card with clickable phone dialer (`tel:` protocol).
  - AIDA script assistance on screen (Attenzione, Interesse, Desiderio, Azione).
  - Quick outcome buttons:
    - 🔴 **Non risponde** (reschedules retry in 2 hours)
    - 🟡 **Da richiamare** (sets specific callback time)
    - 🟢 **Fissa Appuntamento** (opens the appointment modal)
    - ⚪ **Non interessato / Scartato** (archives lead)
- **Interactive Calendar & Consultant Assignment (`AppointmentCalendar.tsx`):**
  - Weekly and monthly calendar grid displaying scheduled appointments.
  - Modal to schedule date, time slot, duration, and type (*Chiamata di approfondimento, Visita sul posto, Video consulenza*).
  - Assignee selector pulling active consultants from `profiles` (e.g. Chiara Bianchi, Valentina Neri, Matteo Riva).
  - Automatically updates the lead record and persists the appointment in `public.appointments`.

---

### Subsystem 3: Client Portfolio Manager & Revenue Forecast (`PortfolioManager.tsx`)

#### Portfolio Aggregation by Consultant/Broker
- Groups existing active clients (`customers`) by their assigned `accountManager` or consultant ID.
- Displays summary metrics per portfolio:
  - **Clienti totali gestiti**
  - **Punti di prelievo attivi** (Totale POD Luce + Totale PDR Gas)
  - **Consumo aggregato annuo** (kWh totali + Smc totali)

#### Switch Earnings Forecast Engine (`portfolioEngine.ts`)
- Computes forecasted broker revenues generated when client contracts reach their next scheduled switch:
  1. **Upfront Commission Projections:**
     - Residential Luce: €45 per activated POD (Business: €95)
     - Residential Gas: €40 per activated PDR (Business: €85)
     - Dual Fuel Bonus: €25 per dual-fuel contract
  2. **Portfolio Recurring Maintenance Projections:**
     - Luce: `(annualConsumption * 0.0025) / 12` per month
     - Gas: `(annualConsumption * 0.015) / 12` per month
  3. **Timing & Pipeline Projection:**
     - Highlights contracts due for switch in the next 30, 60, and 90 days.
     - Displays total expected revenue pipeline for the brokerage and individual agent.

---

## 4. API Endpoints & Data Model

### New / Enhanced Endpoints:
1. `POST /api/leads/bulk-import`
   - Accepts an array of normalized lead objects from CSV parsing.
   - Validates required fields (`name`, `phone`).
   - Inserts records in bulk into `dataStore` / `public.leads`.
2. `GET /api/portfolio/summary`
   - Returns aggregated portfolio metrics and switch earnings forecast grouped by consultant.
3. `POST /api/operations/appointments`
   - Creates a calendar appointment linked to a lead/customer and assigned to a consultant.

---

## 5. Verification & Testing Strategy

1. **Automated Unit & Integration Tests (`test_fase5_subito_callcenter_portfolio.cjs`):**
   - **CSV Ingestion:** Test parsing comma and semicolon CSV payloads with dirty headers and verify bulk lead creation.
   - **Call Center Workflow:** Test updating lead call outcomes and scheduling an appointment assigned to an operator.
   - **Portfolio Forecast:** Validate mathematical precision of upfront, recurring, and dual fuel revenue projections.
   - **Customer Portal Masking:** Ensure public customer endpoints and rendered data do not leak internal 120-day switch scheduling fields.
2. **Regression Verification:**
   - Execute full test suite `node run_all_tests.cjs` (all 11 existing test suites must continue to pass 100% green).
3. **Build & Lint Verification:**
   - `npm run server:build`, `npm run build`, and `npm run lint` must pass with 0 errors.

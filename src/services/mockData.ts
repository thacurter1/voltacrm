import { Appointment, Customer, Lead } from '../types';

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-1',
    name: 'Marco Rossi',
    phone: '+39 347 1234567',
    email: 'marco.rossi@gmail.com',
    city: 'Milano (MI)',
    source: 'facebook_ads',
    status: 'appointment_booked',
    notes: 'Campagna "Stop Bollette Gonfiate". Vuole verificare bolletta Enel casa.',
    createdAt: '2026-09-01T10:30:00Z',
    assignedCallCenterAgent: 'Sara Conti',
    appointmentId: 'app-1',
    estimatedConsumptionKwh: 3200,
    estimatedConsumptionSmc: 950,
  },
  {
    id: 'lead-2',
    name: 'Giulia Bianchi',
    phone: '+39 338 9876543',
    email: 'giulia.bianchi@libero.it',
    city: 'Roma (RM)',
    source: 'google_ads',
    status: 'call_center_queue',
    notes: 'Ricerca "miglior tariffa luce business studio dentistico". Richiamare pom.',
    createdAt: '2026-09-02T14:15:00Z',
    assignedCallCenterAgent: 'Luca Ferri',
    estimatedConsumptionKwh: 6500,
  },
  {
    id: 'lead-3',
    name: 'Studio Legale Santoro',
    phone: '+39 02 8765432',
    email: 'avv.santoro@santorolex.it',
    city: 'Milano (MI)',
    source: 'landing_page',
    status: 'in_negotiation',
    notes: 'Consumi alti aria condizionata. Inviata comparazione preliminare.',
    createdAt: '2026-08-28T09:00:00Z',
    assignedCallCenterAgent: 'Sara Conti',
    appointmentId: 'app-2',
    estimatedConsumptionKwh: 11200,
    estimatedConsumptionSmc: 1800,
  },
  {
    id: 'lead-4',
    name: 'Matteo Colombo',
    phone: '+39 349 5551234',
    email: 'm.colombo@outlook.it',
    city: 'Monza (MB)',
    source: 'facebook_ads',
    status: 'new',
    notes: 'Lead appena entrato da Meta Form. Necessita prima presa di contatto.',
    createdAt: '2026-09-03T11:20:00Z',
  },
  {
    id: 'lead-5',
    name: 'Pasticceria Bellini Snc',
    phone: '+39 051 443322',
    email: 'ordini@pasticceriabellini.it',
    city: 'Bologna (BO)',
    source: 'referral',
    status: 'contract_signed',
    notes: 'Cliente acquisito e contrattualizzato. Passato al CRM clienti attivi.',
    createdAt: '2026-08-15T16:00:00Z',
    assignedCallCenterAgent: 'Matteo Riva',
    estimatedConsumptionKwh: 24000,
    estimatedConsumptionSmc: 4200,
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'app-1',
    leadId: 'lead-1',
    customerName: 'Marco Rossi',
    phone: '+39 347 1234567',
    city: 'Milano (MI)',
    agentName: 'Alessandro Mori (Energy Specialist)',
    scheduledAt: '2026-09-04T15:00:00Z',
    durationMinutes: 45,
    type: 'phone_consultation',
    status: 'scheduled',
    notes: 'Analisi bolletta congiunta Luce & Gas. Ha bolletta Enel in mano.',
  },
  {
    id: 'app-2',
    leadId: 'lead-3',
    customerName: 'Studio Legale Santoro',
    phone: '+39 02 8765432',
    city: 'Milano (MI) - Via Monte Napoleone 12',
    agentName: 'Valentina Neri (Account Manager B2B)',
    scheduledAt: '2026-09-05T10:30:00Z',
    durationMinutes: 60,
    type: 'field_visit',
    status: 'scheduled',
    notes: 'Visita in loco per firma mandato e raccolta mandati di pagamento RID.',
  },
  {
    id: 'app-3',
    leadId: 'lead-5',
    customerName: 'Pasticceria Bellini Snc',
    phone: '+39 051 443322',
    city: 'Bologna (BO)',
    agentName: 'Alessandro Mori (Energy Specialist)',
    scheduledAt: '2026-08-20T11:00:00Z',
    durationMinutes: 45,
    type: 'video_call',
    status: 'completed',
    notes: 'Call completata con successo: chiusa offerta A2A Index.',
  }
];

// Clienti già a portafoglio nel CRM con monitoraggio quadrimestrale (4 mesi)
export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Andrea Moretti',
    fiscalCode: 'MRTNRA82M15F205X',
    phone: '+39 335 1122334',
    email: 'andrea.moretti@email.it',
    city: 'Torino (TO)',
    contractStartDate: '2026-05-01', // Attivato 4 mesi fa (125 giorni fa) -> SCADUTO IL QUADRIMESTRE!
    lastSwitchAuditDate: '2026-05-01',
    nextSwitchAuditDate: '2026-09-01', // Da verificare subito!
    accountManager: 'Valentina Neri',
    hasBrokerageMandate: true,
    utilityPoints: [
      {
        id: 'util-1-luce',
        type: 'luce',
        podOrPdr: 'IT001E00459821',
        annualConsumption: 3400,
        powerKw: 3.5,
        f1Kwh: 1200,
        f2Kwh: 1100,
        f3Kwh: 1100,
        currentSupplier: 'Enel Energia (Vecchia Tariffa)',
        currentOfferName: 'Open Luce Sicura 2024',
        currentTariffType: 'fixed',
        currentUnitCost: 0.178, // Molto alto rispetto al PUN attuale (0.114) o offerte a 0.118!
        currentFixedFeeYear: 144.0, // 12€ al mese
      },
      {
        id: 'util-1-gas',
        type: 'gas',
        podOrPdr: '02581100984321',
        annualConsumption: 1100,
        currentSupplier: 'Eni Plenitude',
        currentOfferName: 'Link Gas Basic',
        currentTariffType: 'fixed',
        currentUnitCost: 0.58, // Costoso vs mercato attuale (0.44 o PSV+0.045)
        currentFixedFeeYear: 132.0,
      }
    ],
    notes: 'Cliente domestico fedele. Ha dato delega di brokeraggio continua per cambio ogni 4 mesi.'
  },
  {
    id: 'cust-2',
    name: 'Ristorante La Terrazza Srl',
    fiscalCode: '09876540152',
    phone: '+39 06 6543210',
    email: 'amministrazione@laterrazzaroma.it',
    city: 'Roma (RM)',
    contractStartDate: '2026-05-05', // Attivato esattamente 120 giorni fa -> IN SCADENZA 4 MESI!
    lastSwitchAuditDate: '2026-05-05',
    nextSwitchAuditDate: '2026-09-03',
    accountManager: 'Alessandro Mori',
    hasBrokerageMandate: true,
    utilityPoints: [
      {
        id: 'util-2-luce',
        type: 'luce',
        podOrPdr: 'IT001E88776655',
        annualConsumption: 18500,
        powerKw: 15.0,
        currentSupplier: 'Acea Energia',
        currentOfferName: 'Acea Business Fix',
        currentTariffType: 'fixed',
        currentUnitCost: 0.165,
        currentFixedFeeYear: 180.0,
      }
    ],
    notes: 'Ristorante con consumi cospicui: ogni centesimo di risparmio genera oltre 400€/anno.'
  },
  {
    id: 'cust-3',
    name: 'Elena Fontana',
    fiscalCode: 'FNTLNE88A41L219Z',
    phone: '+39 340 7788990',
    email: 'elena.fontana@libero.it',
    city: 'Firenze (FI)',
    contractStartDate: '2026-07-15', // Attivato solo 50 giorni fa (prossimo controllo a metà Novembre)
    lastSwitchAuditDate: '2026-07-15',
    nextSwitchAuditDate: '2026-11-15',
    accountManager: 'Valentina Neri',
    hasBrokerageMandate: false,
    utilityPoints: [
      {
        id: 'util-3-luce',
        type: 'luce',
        podOrPdr: 'IT001E11223344',
        annualConsumption: 2600,
        powerKw: 3.0,
        currentSupplier: 'Octopus Energy',
        currentOfferName: 'Octopus Fissa 12M',
        currentTariffType: 'fixed',
        currentUnitCost: 0.118,
        currentFixedFeeYear: 96.0,
      }
    ],
    notes: 'Attualmente sull\'offerta più competitiva. Verifica programmata per Novembre.'
  }
];

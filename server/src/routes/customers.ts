import { Router, Request, Response } from 'express';
import { Customer, UtilityPoint } from '../types.js';

export const customersRouter = Router();

// In-memory demo data (mirror of INITIAL_CUSTOMERS)
let customers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Andrea Moretti',
    fiscalCode: 'MRTNRA82M15F205X',
    phone: '+39 335 1122334',
    email: 'andrea.moretti@email.it',
    city: 'Torino (TO)',
    contractStartDate: '2026-05-01',
    lastSwitchAuditDate: '2026-05-01',
    nextSwitchAuditDate: '2026-09-01',
    accountManager: 'Valentina Neri',
    hasBrokerageMandate: true,
    utilityPoints: [
      {
        id: 'util-1-luce',
        type: 'luce',
        podOrPdr: 'IT001E00459821',
        annualConsumption: 3400,
        powerKw: 3.5,
        currentSupplier: 'Enel Energia (Vecchia Tariffa)',
        currentOfferName: 'Open Luce Sicura 2024',
        currentTariffType: 'fixed',
        currentUnitCost: 0.178,
        currentFixedFeeYear: 144.0,
      },
      {
        id: 'util-1-gas',
        type: 'gas',
        podOrPdr: '02581100984321',
        annualConsumption: 1100,
        currentSupplier: 'Eni Plenitude',
        currentOfferName: 'Link Gas Basic',
        currentTariffType: 'fixed',
        currentUnitCost: 0.58,
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
    contractStartDate: '2026-05-05',
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
    contractStartDate: '2026-07-15',
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

// GET /api/customers
customersRouter.get('/', (_req: Request, res: Response): void => {
  res.json({ success: true, customers });
});

// GET /api/customers/:id
customersRouter.get('/:id', (req: Request, res: Response): void => {
  const customer = customers.find(c => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }
  res.json({ success: true, customer });
});

// POST /api/customers
customersRouter.post('/', (req: Request, res: Response): void => {
  const { name, fiscalCode, phone, email, city, utilityPoints, hasBrokerageMandate, accountManager, notes } = req.body;

  if (!name || !fiscalCode) {
    res.status(400).json({ success: false, message: 'Ragione Sociale/Nome e Codice Fiscale sono obbligatori.' });
    return;
  }

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    name,
    fiscalCode: fiscalCode.toUpperCase(),
    phone: phone || '',
    email: email || '',
    city: city || '',
    utilityPoints: utilityPoints || [],
    contractStartDate: new Date().toISOString().split('T')[0],
    lastSwitchAuditDate: new Date().toISOString().split('T')[0],
    nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
    accountManager: accountManager || 'Assegnazione Automatica',
    hasBrokerageMandate: hasBrokerageMandate ?? true,
    notes: notes || ''
  };

  customers.unshift(newCustomer);
  res.status(201).json({ success: true, customer: newCustomer });
});

// POST /api/customers/:id/utility-point
customersRouter.post('/:id/utility-point', (req: Request, res: Response): void => {
  const customer = customers.find(c => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }

  const point: UtilityPoint = {
    id: `util-${Date.now()}`,
    ...req.body
  };

  customer.utilityPoints.push(point);
  res.status(201).json({ success: true, utilityPoint: point, customer });
});

import { Router, Request, Response } from 'express';
import { Lead } from '../types.js';

export const leadsRouter = Router();

let leads: Lead[] = [
  {
    id: 'lead-1',
    name: 'Marco Bellini',
    phone: '+39 347 1234567',
    email: 'm.bellini@gmail.com',
    city: 'Milano',
    source: 'facebook_ads',
    status: 'new',
    notes: 'Ha visto la sponsorizzata sul caro bollette Enel. Consumo annuo circa 2800 kWh.',
    createdAt: '2026-09-08',
    estimatedConsumptionKwh: 2800,
  },
  {
    id: 'lead-2',
    name: 'Elena Santoro (Pasticceria Alba)',
    phone: '+39 333 8976543',
    email: 'info@pasticceriaalba.it',
    city: 'Monza',
    source: 'google_ads',
    status: 'call_center_queue',
    notes: 'Piccola impresa B2B, spende circa 650€ al mese di luce per forni e frigoriferi.',
    createdAt: '2026-09-08',
    estimatedConsumptionKwh: 8500,
  }
];

// GET /api/leads
leadsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, leads });
});

// POST /api/leads
leadsRouter.post('/', (req: Request, res: Response): void => {
  const { name, phone, email, city, source, notes, estimatedConsumptionKwh, estimatedConsumptionSmc } = req.body;

  if (!name || !phone) {
    res.status(400).json({ success: false, message: 'Nome e telefono sono obbligatori.' });
    return;
  }

  const newLead: Lead = {
    id: `lead-${Date.now()}`,
    name,
    phone,
    email: email || 'lead@voltagroup.it',
    city: city || 'Milano',
    source: source || 'landing_page',
    status: 'new',
    notes: notes || 'Lead acquisito da canale digitale.',
    createdAt: new Date().toISOString().split('T')[0],
    estimatedConsumptionKwh,
    estimatedConsumptionSmc,
  };

  leads.unshift(newLead);
  res.status(201).json({ success: true, lead: newLead });
});

// PATCH /api/leads/:id/status
leadsRouter.patch('/:id/status', (req: Request, res: Response): void => {
  const { id } = req.params;
  const { status, note } = req.body;

  const lead = leads.find(l => l.id === id);
  if (!lead) {
    res.status(404).json({ success: false, message: 'Lead non trovato.' });
    return;
  }

  lead.status = status;
  if (note) {
    lead.notes = `${lead.notes} | ${note}`;
  }

  res.json({ success: true, lead });
});

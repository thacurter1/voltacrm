import { Router, Request, Response } from 'express';
import { getLeads, addLead } from '../services/dataStore.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, createLeadSchema } from '../middleware/validate.js';
import { Lead } from '../types.js';

export const leadsRouter = Router();

// GET /api/leads
leadsRouter.get('/', authenticateToken, (_req: Request, res: Response) => {
  res.json({ success: true, leads: getLeads() });
});

// POST /api/leads
leadsRouter.post('/', authenticateToken, requireRole('admin', 'call_center'), validate(createLeadSchema), (req: Request, res: Response): void => {
  const { name, phone, email, city, source, notes, estimatedConsumptionKwh, estimatedConsumptionSmc } = req.body;

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

  addLead(newLead);
  res.status(201).json({ success: true, lead: newLead });
});

// PATCH /api/leads/:id/status
leadsRouter.patch('/:id/status', authenticateToken, requireRole('admin', 'call_center'), (req: Request, res: Response): void => {
  const { id } = req.params;
  const { status, note } = req.body;

  const leads = getLeads();
  const lead = leads.find((l: Lead) => l.id === id);
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

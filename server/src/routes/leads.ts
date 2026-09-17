import { Router, Request, Response } from 'express';
import { getLeads, addLead, updateLead } from '../services/dataStore.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, createLeadSchema } from '../middleware/validate.js';
import { Lead } from '../types.js';

export const leadsRouter = Router();

// GET /api/leads (Riservato a Call Center e Admin)
leadsRouter.get('/', authenticateToken, requireRole('admin', 'call_center', 'operator'), (_req: Request, res: Response) => {
  res.json({ success: true, leads: getLeads() });
});

// POST /api/leads
leadsRouter.post('/', authenticateToken, requireRole('admin', 'call_center', 'operator'), validate(createLeadSchema), async (req: Request, res: Response): Promise<void> => {
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

  await addLead(newLead);
  res.status(201).json({ success: true, lead: newLead });
});

// PATCH /api/leads/:id/status
leadsRouter.patch('/:id/status', authenticateToken, requireRole('admin', 'call_center', 'operator'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, note } = req.body;

  const leads = getLeads();
  const lead = leads.find((l: Lead) => l.id === id);
  if (!lead) {
    res.status(404).json({ success: false, message: 'Lead non trovato.' });
    return;
  }

  const updated = { ...lead, status, notes: note ? `${lead.notes} | ${note}` : lead.notes };
  await updateLead(updated);

  res.json({ success: true, lead: updated });
});

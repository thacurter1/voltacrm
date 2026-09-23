import { Router, Request, Response } from 'express';
import { getLeads, addLead, updateLead } from '../services/dataStore.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, createLeadSchema, bulkImportLeadsSchema } from '../middleware/validate.js';
import { Lead } from '../types.js';

export const leadsRouter = Router();
function parseSafeNumber(val: any): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') return Number.isFinite(val) && val > 0 ? val : undefined;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

// POST /api/leads/bulk-import (Import massivo da CSV per campagne marketing con validazione Zod)
leadsRouter.post('/bulk-import', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), validate(bulkImportLeadsSchema), async (req: Request, res: Response): Promise<void> => {
  const { leads: importedLeads } = req.body;
  if (!Array.isArray(importedLeads) || importedLeads.length === 0) {
    res.status(400).json({ success: false, message: 'Array di lead vuoto o non valido.' });
    return;
  }

  const addedLeads: Lead[] = [];
  for (let i = 0; i < importedLeads.length; i++) {
    const item = importedLeads[i];
    if (!item.name || !item.phone) continue;
    const newLead: Lead = {
      id: `lead-bulk-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      name: item.name.trim(),
      phone: item.phone.trim(),
      email: item.email?.trim() || '',
      city: item.city?.trim() || 'Italia',
      source: item.source || 'Import CSV Marketing',
      status: 'new',
      notes: item.notes || 'Importato massivamente da lista marketing.',
      createdAt: new Date().toISOString().split('T')[0],
      estimatedConsumptionKwh: parseSafeNumber(item.estimatedConsumptionKwh),
      estimatedConsumptionSmc: parseSafeNumber(item.estimatedConsumptionSmc),
    };
    await addLead(newLead);
    addedLeads.push(newLead);
  }

  res.status(201).json({
    success: true,
    message: `${addedLeads.length} lead importati con successo nella coda Call Center.`,
    count: addedLeads.length,
    leads: addedLeads
  });
});


// GET /api/leads (Riservato a Call Center e Admin)
leadsRouter.get('/', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), (_req: Request, res: Response) => {
  res.json({ success: true, leads: getLeads() });
});

// POST /api/leads
leadsRouter.post('/', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), validate(createLeadSchema), async (req: Request, res: Response): Promise<void> => {
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
leadsRouter.patch('/:id/status', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), async (req: Request, res: Response): Promise<void> => {
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

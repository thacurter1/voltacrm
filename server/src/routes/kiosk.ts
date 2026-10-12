import { Router, Request, Response } from 'express';
import { addLead } from '../services/dataStore.js';
import { kioskLimiter } from '../middleware/rateLimiter.js';
import { validate, kioskLeadSchema } from '../middleware/validate.js';
import { Lead } from '../types.js';
import { requireKioskDevice } from '../middleware/kioskDevice.js';
import { randomUUID } from 'node:crypto';

export const kioskRouter = Router();

kioskRouter.get('/device-status', kioskLimiter, requireKioskDevice, (_req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true });
});

// POST /api/kiosk/lead
kioskRouter.post('/lead', kioskLimiter, requireKioskDevice, validate(kioskLeadSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, firstName, lastName, phone, email, supplyType, monthlyExpenseEur, totemId, mallLocation } = req.body;

  const expense = monthlyExpenseEur;
  const fullName = name || (firstName ? `${firstName} ${lastName || ''}`.trim() : 'Visitatore Totem');

  const newLead: Lead = {
    id: `totem-${randomUUID()}`,
    name: fullName,
    phone: phone.trim(),
    email: email || '',
    city: mallLocation || 'Punto Totem Centro Commerciale',
    source: 'totem_kiosk',
    status: 'new',
    notes: `Acquisito da Totem [${totemId || 'KIOSK-01'}]. Fascia di spesa mensile indicata: circa €${expense}/mese. Fornitura: ${supplyType || 'luce+gas'}. Risparmio da verificare sulla bolletta.`,
    createdAt: new Date().toISOString().split('T')[0],
  };

  await addLead(newLead);

  res.status(201).json({
    success: true,
    message: 'Lead acquisito con successo dal Totem.',
    leadId: newLead.id,
    estimatedSavingsAnnualEur: null,
    advice: 'Richiesta registrata. Un consulente verificherà la bolletta e ricontatterà il cliente.',
    capturedAt: new Date().toISOString()
  });
});

// GET /api/kiosk/status
kioskRouter.get('/status', async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    kioskStatus: 'online',
    version: '1.0.0-totem',
    serverTime: new Date().toISOString(),
    minIdleResetSeconds: 60
  });
});

import { Router, Request, Response } from 'express';
import { Lead } from '../types.js';

export const kioskRouter = Router();

// POST /api/kiosk/lead
kioskRouter.post('/lead', (req: Request, res: Response): void => {
  const { name, phone, email, supplyType, monthlyExpenseEur, totemId, mallLocation } = req.body;

  if (!phone || phone.replace(/\D/g, '').length < 8) {
    res.status(400).json({ 
      success: false, 
      message: 'Numero di telefono non valido. Inserire almeno 9 cifre.' 
    });
    return;
  }

  const expense = Number(monthlyExpenseEur) || 120;
  // Calcolo stima risparmio immediata per il display del Totem
  const estimatedAnnualCost = expense * 12;
  const estimatedSavings = Math.round(estimatedAnnualCost * 0.28); // Stima media Volta CRM ~28%

  const newLead: Lead = {
    id: `totem-${Date.now()}`,
    name: name || 'Visitatore Totem',
    phone: phone.trim(),
    email: email || '',
    city: mallLocation || 'Punto Totem Centro Commerciale',
    source: 'totem_kiosk',
    status: 'new',
    notes: `Acquisito da Totem [${totemId || 'KIOSK-01'}]. Spesa mensile dichiarata: €${expense}/mese. Fornitura: ${supplyType || 'luce+gas'}. Risparmio stimato a video: €${estimatedSavings}/anno.`,
    createdAt: new Date().toISOString().split('T')[0],
    estimatedConsumptionKwh: supplyType === 'gas' ? 0 : Math.round((expense * 12 * 0.6) / 0.25),
    estimatedConsumptionSmc: supplyType === 'luce' ? 0 : Math.round((expense * 12 * 0.4) / 1.10),
  };

  res.status(201).json({
    success: true,
    message: 'Lead acquisito con successo dal Totem.',
    leadId: newLead.id,
    estimatedSavingsAnnualEur: estimatedSavings,
    advice: 'Un Energy Specialist contatterà il cliente entro 15 minuti.',
    capturedAt: new Date().toISOString()
  });
});

// GET /api/kiosk/status
kioskRouter.get('/status', (req: Request, res: Response): void => {
  res.json({
    success: true,
    kioskStatus: 'online',
    version: '1.0.0-totem',
    serverTime: new Date().toISOString(),
    minIdleResetSeconds: 60
  });
});

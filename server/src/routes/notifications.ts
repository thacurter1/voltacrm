import { Router, Request, Response } from 'express';
import { AppNotification } from '../types.js';

export const notificationsRouter = Router();

let notifications: AppNotification[] = [
  {
    id: 'notif-1',
    type: 'totem_lead',
    title: 'Nuovo Lead da Totem Kiosk',
    message: 'Acquisito visitatore al Totem Centro Commerciale Milano. Risparmio stimato a video: €340/anno.',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isRead: false,
    priority: 'urgent',
    targetRole: 'call_center',
    actionTab: 'leads',
    meta: {
      leadId: 'lead-1',
      phone: '+39 347 1234567',
      savingsEur: 340
    }
  },
  {
    id: 'notif-2',
    type: 'switch_due',
    title: 'Audit 120 Giorni Scaduto!',
    message: 'Il contratto di Andrea Moretti ha superato i 120 giorni. Risparmio annuo calcolato: €204,00 (-17.8%) con Octopus Energy.',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    isRead: false,
    priority: 'high',
    targetRole: 'call_center',
    actionTab: 'switch4m',
    meta: {
      customerId: 'cust-1',
      savingsEur: 204.0,
      auditId: 'audit-cust-1-util-1-luce'
    }
  },
  {
    id: 'notif-3',
    type: 'bill_uploaded',
    title: 'Nuova Bolletta da Analizzare',
    message: 'Ristorante La Terrazza Srl ha caricato la fattura "Bolletta_Acea_Business_Aprile2026.pdf". OCR pronto per convalida.',
    timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    isRead: false,
    priority: 'normal',
    targetRole: 'call_center',
    actionTab: 'inbox_bills',
    meta: {
      customerId: 'cust-2'
    }
  },
  {
    id: 'notif-4',
    type: 'security_alert',
    title: 'Accesso 2FA Convalidato',
    message: 'Operatore Matteo Riva autenticato tramite RFC 6238 TOTP Authenticator con IP certificato.',
    timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    isRead: true,
    priority: 'info',
    targetRole: 'admin',
    actionTab: 'security'
  }
];

// GET /api/notifications
notificationsRouter.get('/', (req: Request, res: Response): void => {
  const role = req.query.role as string;
  let filtered = notifications;
  if (role) {
    filtered = notifications.filter(n => !n.targetRole || n.targetRole === 'all' || n.targetRole === role);
  }
  const unreadCount = filtered.filter(n => !n.isRead).length;

  res.json({
    success: true,
    notifications: filtered,
    unreadCount
  });
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', (req: Request, res: Response): void => {
  const { id } = req.params;
  const notif = notifications.find(n => n.id === id);
  if (!notif) {
    res.status(404).json({ success: false, message: 'Notifica non trovata.' });
    return;
  }
  notif.isRead = true;
  res.json({ success: true, notification: notif });
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', (_req: Request, res: Response): void => {
  notifications.forEach(n => { n.isRead = true; });
  res.json({ success: true, message: 'Tutte le notifiche sono state contrassegnate come lette.' });
});

// POST /api/notifications/trigger
notificationsRouter.post('/trigger', (req: Request, res: Response): void => {
  const { type, title, message, priority, targetRole, actionTab, meta } = req.body;

  if (!title || !message) {
    res.status(400).json({ success: false, message: 'Titolo e messaggio sono obbligatori.' });
    return;
  }

  const newNotification: AppNotification = {
    id: `notif-${Date.now()}`,
    type: type || 'switch_due',
    title,
    message,
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: priority || 'normal',
    targetRole: targetRole || 'all',
    actionTab,
    meta
  };

  notifications.unshift(newNotification);
  res.status(201).json({ success: true, notification: newNotification });
});

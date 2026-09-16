import { Router, Request, Response } from 'express';
import { getNotifications, addNotification } from '../services/dataStore.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { validate, triggerNotificationSchema } from '../middleware/validate.js';
import { AppNotification } from '../types.js';

export const notificationsRouter = Router();

// GET /api/notifications (Protetta: restituisce solo le notifiche consentite al ruolo utente)
notificationsRouter.get('/', authenticateToken, (req: Request, res: Response): void => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';
  let filtered = getNotifications();

  if (userRole === 'admin') {
    const requestedRole = req.query.role as string;
    if (requestedRole) {
      filtered = filtered.filter((n: AppNotification) => !n.targetRole || n.targetRole === 'all' || n.targetRole === requestedRole);
    }
  } else {
    // Utenti non-admin vedono esclusivamente notifiche globali 'all' o specifiche per il proprio ruolo
    filtered = filtered.filter((n: AppNotification) => !n.targetRole || n.targetRole === 'all' || n.targetRole === userRole);
  }

  const unreadCount = filtered.filter((n: AppNotification) => !n.isRead).length;

  res.json({
    success: true,
    count: filtered.length,
    notifications: filtered,
    unreadCount
  });
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', authenticateToken, (req: Request, res: Response): void => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';
  const { id } = req.params;
  const notif = getNotifications().find((n: AppNotification) => n.id === id);
  if (!notif) {
    res.status(404).json({ success: false, message: 'Notifica non trovata.' });
    return;
  }

  // Prevenzione IDOR: l'utente può marcare come letta solo una notifica indirizzata a lui o al suo ruolo
  if (userRole !== 'admin' && notif.targetRole && notif.targetRole !== 'all' && notif.targetRole !== userRole) {
    res.status(403).json({ success: false, message: 'Non autorizzato a modificare lo stato di questa notifica.' });
    return;
  }

  notif.isRead = true;
  res.json({ success: true, notification: notif });
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', authenticateToken, (req: Request, res: Response): void => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';

  // Solo l'admin può marcare tutte le notifiche del sistema; gli altri marcano solo le proprie
  let count = 0;
  getNotifications().forEach((n: AppNotification) => {
    if (userRole === 'admin' || !n.targetRole || n.targetRole === 'all' || n.targetRole === userRole) {
      n.isRead = true;
      count++;
    }
  });

  res.json({ success: true, message: `${count} notifiche contrassegnate come lette.` });
});

// POST /api/notifications/trigger
notificationsRouter.post('/trigger', authenticateToken, requireRole('admin', 'call_center', 'operator'), validate(triggerNotificationSchema), (req: Request, res: Response): void => {
  const { type, title, message, priority, targetRole, actionTab, meta } = req.body;

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

  addNotification(newNotification);
  res.status(201).json({ success: true, notification: newNotification });
});

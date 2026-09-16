import { Router, Request, Response } from 'express';
import { getNotifications, addNotification, markNotificationsRead } from '../services/dataStore.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { validate, triggerNotificationSchema } from '../middleware/validate.js';
import { AppNotification } from '../types.js';

export const notificationsRouter = Router();

// GET /api/notifications (Protetta: restituisce solo le notifiche consentite al ruolo utente)
notificationsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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
notificationsRouter.patch('/:id/read', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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

  await markNotificationsRead([notif.id]);
  res.json({ success: true, notification: { ...notif, isRead: true } });
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';

  // Solo l'admin può marcare tutte le notifiche del sistema; gli altri marcano solo le proprie
  const ids = getNotifications().filter((n:AppNotification)=>userRole==='admin'||!n.targetRole||n.targetRole==='all'||n.targetRole===userRole).map(n=>n.id);
  await markNotificationsRead(ids);
  const count = ids.length;

  res.json({ success: true, message: `${count} notifiche contrassegnate come lette.` });
});

// POST /api/notifications/trigger
notificationsRouter.post('/trigger', authenticateToken, requireRole('admin', 'call_center', 'operator'), validate(triggerNotificationSchema), async (req: Request, res: Response): Promise<void> => {
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

  await addNotification(newNotification);
  res.status(201).json({ success: true, notification: newNotification });
});

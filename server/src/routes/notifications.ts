import { Router, Request, Response } from 'express';
import { getNotifications, addNotification } from '../services/dataStore.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, triggerNotificationSchema } from '../middleware/validate.js';
import { AppNotification } from '../types.js';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', (req: Request, res: Response): void => {
  const role = req.query.role as string;
  let filtered = getNotifications();
  if (role) {
    filtered = filtered.filter((n: AppNotification) => !n.targetRole || n.targetRole === 'all' || n.targetRole === role);
  }
  const unreadCount = filtered.filter((n: AppNotification) => !n.isRead).length;

  res.json({
    success: true,
    notifications: filtered,
    unreadCount
  });
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', authenticateToken, (req: Request, res: Response): void => {
  const { id } = req.params;
  const notif = getNotifications().find((n: AppNotification) => n.id === id);
  if (!notif) {
    res.status(404).json({ success: false, message: 'Notifica non trovata.' });
    return;
  }
  notif.isRead = true;
  res.json({ success: true, notification: notif });
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', authenticateToken, (_req: Request, res: Response): void => {
  getNotifications().forEach((n: AppNotification) => { n.isRead = true; });
  res.json({ success: true, message: 'Tutte le notifiche sono state contrassegnate come lette.' });
});

// POST /api/notifications/trigger
notificationsRouter.post('/trigger', authenticateToken, validate(triggerNotificationSchema), (req: Request, res: Response): void => {
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

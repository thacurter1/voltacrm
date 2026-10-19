import { Router, Request, Response } from 'express';
import { getNotifications, addNotification, markNotificationsRead, getCustomers, getLeads, users } from '../services/dataStore.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { validate, triggerNotificationSchema } from '../middleware/validate.js';
import { AppNotification, UserProfile } from '../types.js';
import { canActorAccessCustomer } from '../services/customerOwnership.js';

export const notificationsRouter = Router();

function canUserAccessNotification(
  n: AppNotification,
  authUser: { userId: string; role: string },
  profile?: UserProfile
): boolean {
  if (authUser.role === 'admin') return true;

  // 1. Role check
  const roleMatches =
    !n.targetRole ||
    n.targetRole === 'all' ||
    n.targetRole === authUser.role ||
    (authUser.role === 'operator' && n.targetRole === 'broker') ||
    (authUser.role === 'broker' && n.targetRole === 'operator');

  if (!roleMatches) return false;

  // 2. Explicit targetUserId check
  if (n.targetUserId && n.targetUserId !== authUser.userId) {
    return false;
  }

  // 3. Recipient isolation for customers
  if (authUser.role === 'customer') {
    const recipientCustomerId = n.targetCustomerId || n.meta?.customerId;
    if (recipientCustomerId) {
      const actorCustomerId = profile?.customerId || authUser.userId;
      return recipientCustomerId === actorCustomerId || recipientCustomerId === authUser.userId;
    }
    return true;
  }

  // 4. Recipient isolation for brokers / operators
  if ((authUser.role === 'broker' || authUser.role === 'operator') && profile) {
    const recipientCustomerId = n.targetCustomerId || n.meta?.customerId;
    if (recipientCustomerId) {
      const customer = getCustomers().find((c) => c.id === recipientCustomerId);
      if (!customer || !canActorAccessCustomer(customer, profile)) {
        return false;
      }
    }
    if (n.meta?.leadId) {
      const lead = getLeads().find((l) => l.id === n.meta?.leadId);
      if (lead && lead.assignedBrokerId && lead.assignedBrokerId !== profile.id && lead.assignedAgent !== profile.id) {
        return false;
      }
    }
  }

  return true;
}

function projectNotificationForUser(n: AppNotification, userId?: string): AppNotification {
  const isReadForUser = Boolean(n.isRead || (userId && Array.isArray(n.readBy) && n.readBy.includes(userId)));
  return {
    ...n,
    isRead: isReadForUser,
  };
}

// GET /api/notifications (Protetta: restituisce solo le notifiche consentite al ruolo e al destinatario)
notificationsRouter.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';
  const userId = authReq.user?.userId || '';
  const profile = users.find((u) => u.id === userId);
  let filtered = getNotifications();

  if (userRole === 'admin') {
    const requestedRole = req.query.role as string;
    if (requestedRole) {
      filtered = filtered.filter((n: AppNotification) => !n.targetRole || n.targetRole === 'all' || n.targetRole === requestedRole);
    }
  } else {
    filtered = filtered.filter((n: AppNotification) => canUserAccessNotification(n, { userId, role: userRole }, profile));
  }

  const projected = filtered.map((n: AppNotification) => projectNotificationForUser(n, userId));
  const unreadCount = projected.filter((n: AppNotification) => !n.isRead).length;

  res.json({
    success: true,
    count: projected.length,
    notifications: projected,
    unreadCount
  });
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';
  const userId = authReq.user?.userId || '';
  const profile = users.find((u) => u.id === userId);
  const { id } = req.params;
  const notif = getNotifications().find((n: AppNotification) => n.id === id);
  if (!notif) {
    res.status(404).json({ success: false, message: 'Notifica non trovata.' });
    return;
  }

  // Prevenzione IDOR: l'utente può marcare come letta solo una notifica indirizzata a lui
  if (!canUserAccessNotification(notif, { userId, role: userRole }, profile)) {
    res.status(403).json({ success: false, message: 'Non autorizzato a modificare lo stato di questa notifica.' });
    return;
  }

  await markNotificationsRead([notif.id], userRole === 'admin' ? undefined : userId);
  res.json({ success: true, notification: { ...notif, isRead: true } });
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthRequest;
  const userRole = authReq.user?.role || 'customer';
  const userId = authReq.user?.userId || '';
  const profile = users.find((u) => u.id === userId);

  // Solo l'admin può marcare tutte le notifiche del sistema; gli altri marcano solo le proprie
  const ids = getNotifications()
    .filter((n: AppNotification) => canUserAccessNotification(n, { userId, role: userRole }, profile))
    .map((n) => n.id);
  await markNotificationsRead(ids, userRole === 'admin' ? undefined : userId);
  const count = ids.length;

  res.json({ success: true, message: `${count} notifiche contrassegnate come lette.` });
});

// POST /api/notifications/trigger
notificationsRouter.post('/trigger', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), validate(triggerNotificationSchema), async (req: Request, res: Response): Promise<void> => {
  const { type, title, message, priority, targetRole, targetUserId, targetCustomerId, actionTab, meta } = req.body;

  const newNotification: AppNotification = {
    id: `notif-${Date.now()}`,
    type: type || 'switch_due',
    title,
    message,
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: priority || 'normal',
    targetRole: targetRole || 'all',
    targetUserId,
    targetCustomerId: targetCustomerId || meta?.customerId,
    actionTab,
    meta
  };

  await addNotification(newNotification);
  res.status(201).json({ success: true, notification: newNotification });
});

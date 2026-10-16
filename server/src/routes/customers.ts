import { Router, Response } from 'express';
import { getCustomers, addCustomer, updateCustomer, updateCustomerContact, users } from '../services/dataStore.js';
import { authenticateToken, generateToken, requireRole } from '../middleware/auth.js';
import { validate, createCustomerSchema, createUtilityPointSchema, updateCustomerContactSchema } from '../middleware/validate.js';
import { Customer, UtilityPoint } from '../types.js';

export const customersRouter = Router();
import { canActorAccessCustomer, isBrokerAssigned } from '../services/customerOwnership.js';

// GET /api/customers (Filtro rigoroso in base al ruolo RBAC)
customersRouter.get('/', authenticateToken, (req: any, res: Response): void => {
  const actor = users.find(u => u.id === req.user?.userId);
  if (!actor) {
    res.status(403).json({ success: false, message: 'Utente non autorizzato.' });
    return;
  }

  if (actor.role === 'call_center') {
    res.json({ success: true, customers: [] });
    return;
  }

  if (!['admin', 'operator', 'broker', 'customer'].includes(actor.role)) {
    res.status(403).json({ success: false, message: 'Ruolo non autorizzato.' });
    return;
  }

  const customers = getCustomers().filter((c: Customer) => canActorAccessCustomer(c, actor));
  res.json({ success: true, customers });
});

// GET /api/customers/:id (Dettaglio cliente con prevenzione IDOR)
customersRouter.get('/:id', authenticateToken, (req: any, res: Response): void => {
  const actor = users.find(u => u.id === req.user?.userId);
  if (!actor) {
    res.status(403).json({ success: false, message: 'Utente non autorizzato.' });
    return;
  }

  const customer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }

  if (!canActorAccessCustomer(customer, actor)) {
    const message =
      actor.role === 'operator' || actor.role === 'broker'
        ? 'Accesso negato. È possibile consultare esclusivamente la propria clientela assegnata.'
        : actor.role === 'customer'
          ? 'Accesso negato. È possibile consultare esclusivamente la propria anagrafica.'
          : actor.role === 'call_center'
            ? 'Accesso negato. Il Call Center opera esclusivamente sulla coda lead.'
            : 'Accesso non autorizzato.';
    res.status(403).json({ success: false, message });
    return;
  }

  res.json({ success: true, customer });
});

// PATCH /api/customers/:id
customersRouter.patch('/:id', authenticateToken, validate(updateCustomerContactSchema), async (req: any, res: Response): Promise<void> => {
  const actor = users.find(user => user.id === req.user?.userId);
  if (!actor) {
    res.status(403).json({ success: false, message: 'Utente non autorizzato.' });
    return;
  }

  const targetCustomer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!targetCustomer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }

  if (!canActorAccessCustomer(targetCustomer, actor)) {
    res.status(403).json({ success: false, message: 'Accesso negato alla modifica del cliente.' });
    return;
  }

  const customer = await updateCustomerContact(req.params.id, actor.id, req.body);
  const linkedSelf = actor.customerId === customer.id;
  const token = linkedSelf
    ? generateToken({ userId: actor.id, email: actor.email, role: actor.role })
    : undefined;
  res.json({ success: true, customer, ...(token ? { token } : {}) });
});

// POST /api/customers
customersRouter.post('/', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), validate(createCustomerSchema), async (req: any, res: Response): Promise<void> => {
  const { name, fiscalCode, phone, email, city, utilityPoints, hasBrokerageMandate, accountManager, notes } = req.body;
  const actor = users.find(u => u.id === req.user?.userId);

  const finalAccountManager = (actor && (actor.role === 'operator' || actor.role === 'broker'))
    ? actor.name.split(' (')[0].trim()
    : (accountManager || actor?.name || 'Assegnazione Automatica');

  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    name,
    fiscalCode: (fiscalCode || 'CF' + Math.random().toString(36).substring(2, 10)).toUpperCase(),
    phone: phone || '',
    email: email || '',
    city: city || '',
    utilityPoints: utilityPoints || [],
    contractStartDate: new Date().toISOString().split('T')[0],
    lastSwitchAuditDate: new Date().toISOString().split('T')[0],
    nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
    accountManager: finalAccountManager,
    assignedBrokerId: actor && (actor.role === 'operator' || actor.role === 'broker') ? actor.id : undefined,
    hasBrokerageMandate: hasBrokerageMandate ?? true,
    notes: notes || ''
  };

  await addCustomer(newCustomer);
  res.status(201).json({ success: true, customer: newCustomer });
});

// POST /api/customers/:id/utility-point
customersRouter.post('/:id/utility-point', authenticateToken, requireRole('admin', 'operator', 'broker'), validate(createUtilityPointSchema), async (req: any, res: Response): Promise<void> => {
  const actor = users.find(u => u.id === req.user?.userId);
  const customer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }

  if (actor && (actor.role === 'operator' || actor.role === 'broker') && !isBrokerAssigned(customer, actor)) {
    res.status(403).json({ success: false, message: 'Accesso negato. Non puoi aggiungere punti fornitura a clienti di altri consulenti.' });
    return;
  }

  const point: UtilityPoint = {
    id: `util-${Date.now()}`,
    ...req.body
  };

  const updated = { ...customer, utilityPoints: [...customer.utilityPoints, point] };
  await updateCustomer(updated);
  res.status(201).json({ success: true, utilityPoint: point, customer: updated });
});

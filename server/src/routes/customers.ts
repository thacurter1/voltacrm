import { Router, Response } from 'express';
import { getCustomers, addCustomer, updateCustomer, updateCustomerContact, users } from '../services/dataStore.js';
import { authenticateToken, generateToken, requireRole } from '../middleware/auth.js';
import { validate, createCustomerSchema, createUtilityPointSchema, updateCustomerContactSchema } from '../middleware/validate.js';
import { Customer, UtilityPoint } from '../types.js';

export const customersRouter = Router();

function isBrokerAssigned(customer: Customer, actor: any): boolean {
  if (!actor || !customer) return false;

  // ID-based match takes absolute priority
  if (customer.assignedBrokerId) {
    return customer.assignedBrokerId === actor.id;
  }

  // Fallback to name matching only when assignedBrokerId is not set
  if (!customer.accountManager) return false;

  const actorName = (actor.name || '').trim();
  const brokerSimpleName = actorName.split(' (')[0].trim();
  const mgr = (customer.accountManager || '').trim();
  const mgrSimpleName = mgr.split(' (')[0].trim();

  // Guard against empty name bypass — empty string .includes('') is always true
  if (!brokerSimpleName || !mgrSimpleName) return false;

  // Strict equality only — no substring matching to prevent "Marco" matching "Gianmarco"
  return (
    mgrSimpleName.toLowerCase() === brokerSimpleName.toLowerCase()
  );
}

// GET /api/customers (Filtro rigoroso in base al ruolo RBAC)
customersRouter.get('/', authenticateToken, (req: any, res: Response): void => {
  const user = req.user;
  const actor = users.find(u => u.id === user?.userId);
  if (!actor) {
    res.status(403).json({ success: false, message: 'Utente non autorizzato.' });
    return;
  }

  // 1. Admin: visibilità totale su tutti i clienti dell'agenzia
  if (actor.role === 'admin') {
    res.json({ success: true, customers: getCustomers() });
    return;
  }

  // 2. Broker / Operatore Consulente: visibilità rigorosamente isolata sui soli clienti assegnati
  if (actor.role === 'operator' || actor.role === 'broker') {
    const brokerCustomers = getCustomers().filter((c: Customer) => isBrokerAssigned(c, actor));
    res.json({ success: true, customers: brokerCustomers });
    return;
  }

  // 3. Cliente Finale: visibilità solo sulla propria utenza
  if (actor.role === 'customer') {
    const customer = getCustomers().find((c: Customer) => c.id === actor.customerId || c.id === actor.id);
    res.json({ success: true, customers: customer ? [customer] : [] });
    return;
  }

  // 4. Call Center: non consulta anagrafiche massive per preservare la privacy; opera sulla coda lead
  if (actor.role === 'call_center') {
    res.json({ success: true, customers: [] });
    return;
  }

  res.status(403).json({ success: false, message: 'Ruolo non autorizzato.' });
});

// GET /api/customers/:id (Dettaglio cliente con prevenzione IDOR)
customersRouter.get('/:id', authenticateToken, (req: any, res: Response): void => {
  const user = req.user;
  const actor = users.find(u => u.id === user?.userId);
  if (!actor) {
    res.status(403).json({ success: false, message: 'Utente non autorizzato.' });
    return;
  }

  const customer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }

  if (actor.role === 'admin') {
    res.json({ success: true, customer });
    return;
  }

  if (actor.role === 'operator' || actor.role === 'broker') {
    if (!isBrokerAssigned(customer, actor)) {
      res.status(403).json({ success: false, message: 'Accesso negato. È possibile consultare esclusivamente la propria clientela assegnata.' });
      return;
    }
    res.json({ success: true, customer });
    return;
  }

  if (actor.role === 'customer') {
    const isOwner = actor.id === req.params.id || (actor.customerId && actor.customerId === req.params.id);
    if (!isOwner) {
      res.status(403).json({ success: false, message: 'Accesso negato. È possibile consultare esclusivamente la propria anagrafica.' });
      return;
    }
    res.json({ success: true, customer });
    return;
  }

  if (actor.role === 'call_center') {
    res.status(403).json({ success: false, message: 'Accesso negato. Il Call Center opera esclusivamente sulla coda lead.' });
    return;
  }

  res.status(403).json({ success: false, message: 'Accesso non autorizzato.' });
});

// PATCH /api/customers/:id
customersRouter.patch('/:id', authenticateToken, validate(updateCustomerContactSchema), async (req: any, res: Response): Promise<void> => {
  const authUser = req.user;
  const actor = users.find(user => user.id === authUser?.userId);
  if (!actor) {
    res.status(403).json({ success: false, message: 'Utente non autorizzato.' });
    return;
  }

  const targetCustomer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!targetCustomer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }

  const isAdmin = actor.role === 'admin';
  const isBrokerOwner = (actor.role === 'operator' || actor.role === 'broker') && isBrokerAssigned(targetCustomer, actor);
  const isCustomerSelf = actor.role === 'customer' && (actor.customerId === req.params.id || actor.id === req.params.id);
  const isCallCenter = actor.role === 'call_center';

  if (!isAdmin && !isBrokerOwner && !isCustomerSelf && !isCallCenter) {
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
customersRouter.post('/:id/utility-point', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), validate(createUtilityPointSchema), async (req: any, res: Response): Promise<void> => {
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

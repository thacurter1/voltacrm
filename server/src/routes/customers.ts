import { Router, Request, Response } from 'express';
import { getCustomers, addCustomer, updateCustomer, updateCustomerContact, users } from '../services/dataStore.js';
import { authenticateToken, generateToken, requireRole } from '../middleware/auth.js';
import { validate, createCustomerSchema, createUtilityPointSchema, updateCustomerContactSchema } from '../middleware/validate.js';
import { Customer, UtilityPoint } from '../types.js';

export const customersRouter = Router();

// GET /api/customers (Solo Staff Operatore & Admin)
customersRouter.get('/', authenticateToken, requireRole('admin', 'call_center', 'operator'), (_req: Request, res: Response): void => {
  res.json({ success: true, customers: getCustomers() });
});

// GET /api/customers/:id (Staff o Proprietario Account Cliente)
customersRouter.get('/:id', authenticateToken, (req: any, res: Response): void => {
  const user = req.user;
  const isStaff = user && (user.role === 'admin' || user.role === 'call_center' || user.role === 'operator');
  
  // Risoluzione relazione utente-cliente per prevenzione IDOR
  const userProfile = users.find(u => u.id === user?.userId);
  const userCustomerId = userProfile?.customerId;
  const isOwner = user?.userId === req.params.id || (userCustomerId && userCustomerId === req.params.id);

  if (!isStaff && !isOwner) {
    res.status(403).json({ success: false, message: 'Accesso negato. È possibile consultare esclusivamente la propria anagrafica.' });
    return;
  }

  const customer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
    return;
  }
  res.json({ success: true, customer });
});

customersRouter.patch('/:id', authenticateToken, validate(updateCustomerContactSchema), async (req: any, res: Response): Promise<void> => {
  const authUser = req.user;
  const actor = users.find(user => user.id === authUser?.userId);
  const isStaff = actor && ['admin', 'call_center', 'operator'].includes(actor.role);
  if (!actor || (!isStaff && actor.customerId !== req.params.id)) {
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
customersRouter.post('/', authenticateToken, requireRole('admin', 'call_center', 'operator'), validate(createCustomerSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, fiscalCode, phone, email, city, utilityPoints, hasBrokerageMandate, accountManager, notes } = req.body;

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
    accountManager: accountManager || 'Assegnazione Automatica',
    hasBrokerageMandate: hasBrokerageMandate ?? true,
    notes: notes || ''
  };

  await addCustomer(newCustomer);
  res.status(201).json({ success: true, customer: newCustomer });
});

// POST /api/customers/:id/utility-point
customersRouter.post('/:id/utility-point', authenticateToken, requireRole('admin', 'call_center', 'operator'), validate(createUtilityPointSchema), async (req: Request, res: Response): Promise<void> => {
  const customer = getCustomers().find((c: Customer) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, message: 'Cliente non trovato.' });
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

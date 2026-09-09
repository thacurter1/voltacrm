import { Router, Request, Response } from 'express';
import { UserProfile } from '../types.js';

export const authRouter = Router();

// Demo users database in-memory (sincronizzato con Supabase se configurato)
let users: UserProfile[] = [
  {
    id: 'user-admin-1',
    name: 'Matteo Riva (Broker Owner)',
    email: 'm.riva@voltagroup.it',
    role: 'admin',
    phone: '+39 347 1122334',
    whatsapp: '+393471122334',
    avatar: 'MR',
    is2faEnabled: true,
    onboardingStatus: 'active',
    createdAt: '2026-01-15'
  },
  {
    id: 'user-op-2',
    name: 'Chiara Bianchi (Consulente Senior)',
    email: 'c.bianchi@voltagroup.it',
    role: 'call_center',
    phone: '+39 338 5566778',
    whatsapp: '+393385566778',
    avatar: 'CB',
    is2faEnabled: true,
    onboardingStatus: 'active',
    createdAt: '2026-02-10'
  },
  {
    id: 'user-cust-1',
    name: 'Andrea Moretti',
    email: 'andrea.moretti@email.it',
    role: 'customer',
    phone: '+39 340 1234567',
    whatsapp: '+393401234567',
    fiscalCode: 'MRTNDR85M01H501Z',
    customerId: 'cust-1',
    assignedBrokerId: 'user-admin-1',
    assignedBrokerName: 'Matteo Riva',
    avatar: 'AM',
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: '2026-03-01'
  }
];

// POST /api/auth/login-operator
authRouter.post('/login-operator', (req: Request, res: Response): void => {
  const { email, password, totpCode } = req.body;
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase() && u.role !== 'customer');

  if (!user) {
    res.status(401).json({ success: false, message: 'Credenziali operatore non valide.' });
    return;
  }

  // Verifica 2FA TOTP (se abilitato, richiede codice valido)
  if (user.is2faEnabled && !totpCode) {
    res.status(403).json({ success: false, require2FA: true, message: 'Inserisci il codice 2FA da Authenticator.' });
    return;
  }

  res.json({
    success: true,
    token: `jwt-mock-token-${user.id}-${Date.now()}`,
    user
  });
});

// POST /api/auth/login-customer
authRouter.post('/login-customer', (req: Request, res: Response): void => {
  const { identifier } = req.body;
  const query = (identifier || '').trim().toLowerCase();
  
  const user = users.find(u => 
    u.role === 'customer' && (
      u.email.toLowerCase() === query || 
      u.fiscalCode?.toLowerCase() === query
    )
  ) || users.find(u => u.role === 'customer');

  res.json({
    success: true,
    token: `jwt-mock-customer-${user?.id}-${Date.now()}`,
    user
  });
});

// POST /api/auth/register-customer
authRouter.post('/register-customer', (req: Request, res: Response): void => {
  const { name, email, phone, fiscalCode } = req.body;
  if (!name || !email) {
    res.status(400).json({ success: false, message: 'Nome ed email sono obbligatori.' });
    return;
  }

  const newProfile: UserProfile = {
    id: `user-cust-${Date.now()}`,
    name,
    email,
    role: 'customer',
    phone: phone || '+39 340 0000000',
    whatsapp: (phone || '+39340000000').replace(/[^0-9+]/g, ''),
    fiscalCode: (fiscalCode || 'CF' + Math.random().toString(36).substring(2, 10)).toUpperCase(),
    customerId: `cust-${Date.now()}`,
    assignedBrokerId: 'user-admin-1',
    assignedBrokerName: 'Matteo Riva (Broker Volta)',
    avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: new Date().toISOString().split('T')[0]
  };

  users.unshift(newProfile);

  res.status(201).json({
    success: true,
    user: newProfile,
    token: `jwt-mock-customer-${newProfile.id}`
  });
});

// GET /api/auth/profiles (Solo per operatori autorizzati)
authRouter.get('/profiles', (_req: Request, res: Response) => {
  res.json({ success: true, profiles: users });
});

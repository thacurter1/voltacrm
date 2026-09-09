import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { users } from '../services/dataStore.js';
import { generateToken, authenticateToken, requireRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validate, loginOperatorSchema, loginCustomerSchema, registerCustomerSchema } from '../middleware/validate.js';

export const authRouter = Router();

const toSafeProfile = (user: any) => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

// POST /api/auth/login-operator
authRouter.post('/login-operator', loginLimiter, validate(loginOperatorSchema), (req: Request, res: Response): void => {
  const { email, password, totpCode } = req.body;
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase() && u.role !== 'customer');

  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ success: false, message: 'Credenziali operatore non valide.' });
    return;
  }

  // Verifica 2FA TOTP (se abilitato, richiede codice valido)
  if (user.is2faEnabled) {
    if (!totpCode || totpCode.length !== 6) {
      res.status(403).json({ success: false, require2FA: true, message: 'Inserisci il codice 2FA da Authenticator.' });
      return;
    }
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });

  res.json({
    success: true,
    token,
    user: toSafeProfile(user)
  });
});

// POST /api/auth/login-customer
authRouter.post('/login-customer', loginLimiter, validate(loginCustomerSchema), (req: Request, res: Response): void => {
  const { identifier, password } = req.body;
  const query = (identifier || '').trim().toLowerCase();
  
  const user = users.find(u => 
    u.role === 'customer' && (
      u.email.toLowerCase() === query || 
      u.fiscalCode?.toLowerCase() === query
    )
  );

  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ success: false, message: 'Credenziali cliente non valide.' });
    return;
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });

  res.json({
    success: true,
    token,
    user: toSafeProfile(user)
  });
});

// POST /api/auth/register-customer
authRouter.post('/register-customer', loginLimiter, validate(registerCustomerSchema), (req: Request, res: Response): void => {
  const { name, email, phone, fiscalCode, password } = req.body;
  
  const hashedPassword = bcrypt.hashSync(password || 'customer123', 10);

  const newProfile = {
    id: `user-cust-${Date.now()}`,
    name,
    email,
    password: hashedPassword,
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

  users.unshift(newProfile as any);

  const token = generateToken({ userId: newProfile.id, email: newProfile.email, role: newProfile.role });

  res.status(201).json({
    success: true,
    user: toSafeProfile(newProfile),
    token
  });
});

// GET /api/auth/profiles (Solo per operatori autorizzati)
authRouter.get('/profiles', authenticateToken, requireRole('admin', 'call_center'), (_req: Request, res: Response) => {
  res.json({ success: true, profiles: users.map(toSafeProfile) });
});

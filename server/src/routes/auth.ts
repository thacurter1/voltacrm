import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { users, registerAccount } from '../services/dataStore.js';
import { generateToken, authenticateToken, requireRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { validate, loginOperatorSchema, loginCustomerSchema, registerCustomerSchema, oauthAuthSchema } from '../middleware/validate.js';

import { verifyTotp } from '../utils/totp.js';

export const authRouter = Router();

const toSafeProfile = (user: any) => {
  const { password: _password, twoFactorSecret: _secret, ...safeUser } = user;
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

    const secret = user.twoFactorSecret;
    if (!secret || (process.env.NODE_ENV === 'production' && secret.startsWith('VOLTA_'))) {
      res.status(503).json({ success: false, message: 'Secondo fattore non configurato. Contattare un amministratore.' });
      return;
    }
    const isTotpValid = verifyTotp(totpCode, secret, 1);
    const isDevMock = process.env.VOLTA_DEMO_MODE === 'true' && process.env.NODE_ENV === 'test' && totpCode === '123456';

    if (!isTotpValid && !isDevMock) {
      res.status(403).json({ success: false, message: 'Codice 2FA non valido o scaduto.' });
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
authRouter.post('/register-customer', loginLimiter, validate(registerCustomerSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, fiscalCode, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFiscalCode = fiscalCode.trim().toUpperCase();

  const existingUser = users.find(u => 
    u.email.toLowerCase() === normalizedEmail || 
    (u.fiscalCode && u.fiscalCode.toUpperCase() === normalizedFiscalCode)
  );
  if (existingUser) {
    res.status(409).json({ success: false, message: 'Email o Codice Fiscale già registrato nel sistema.' });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const customerId = crypto.randomUUID();
  const profile = {
    id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail,
    password: await bcrypt.hash(password, 12), role: 'customer', phone,
    fiscalCode: normalizedFiscalCode, customerId,
    avatar: name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase(),
    is2faEnabled: false, onboardingStatus:'active', createdAt:today
  };
  await registerAccount(profile, {
    id:customerId,name:profile.name,email:profile.email,phone,fiscalCode:profile.fiscalCode,
    city:'',utilityPoints:[],contractStartDate:today,lastSwitchAuditDate:today,
    nextSwitchAuditDate:new Date(Date.now()+120*86400000).toISOString().split('T')[0],
    accountManager:'',hasBrokerageMandate:false,notes:''
  });
  const token=generateToken({userId:profile.id,email:profile.email,role:profile.role});
  res.status(201).json({success:true,user:toSafeProfile(profile),token});
});

// POST /api/auth/oauth (Google & Apple OAuth login / registration)
authRouter.post('/oauth', loginLimiter, validate(oauthAuthSchema), async (req: Request, res: Response): Promise<void> => {
  const { provider, role, email, name } = req.body;
  const userRole = role || 'customer';
  const targetEmail = (email || `${provider}.${userRole === 'customer' ? 'cliente' : 'staff'}@voltagroup.it`).trim().toLowerCase();
  const targetName = (name || (provider === 'google' ? 'Utente Google' : 'Utente Apple')).trim();

  // Check if user already exists
  let user = users.find(u => u.email.toLowerCase() === targetEmail);

  if (!user) {
    const today = new Date().toISOString().split('T')[0];
    const customerId = userRole === 'customer' ? crypto.randomUUID() : undefined;
    const profile = {
      id: crypto.randomUUID(),
      name: targetName,
      email: targetEmail,
      password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12),
      role: userRole,
      phone: '+39 340 0000000',
      fiscalCode: userRole === 'customer' ? 'OAUTHUSER00A00A0' : undefined,
      customerId,
      avatar: targetName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'OU',
      is2faEnabled: false,
      onboardingStatus: 'active',
      createdAt: today,
      authProvider: provider
    };

    if (userRole === 'customer' && customerId) {
      await registerAccount(profile, {
        id: customerId,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        fiscalCode: profile.fiscalCode || 'OAUTHUSER00A00A0',
        city: 'Milano',
        utilityPoints: [],
        contractStartDate: today,
        lastSwitchAuditDate: today,
        nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
        accountManager: 'Matteo Riva',
        hasBrokerageMandate: true,
        notes: `Registrato via ${provider.toUpperCase()} OAuth`
      });
    } else {
      users.push(profile);
    }
    user = profile;
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    success: true,
    token,
    user: toSafeProfile(user),
    provider
  });
});

// GET /api/auth/profiles (Solo per operatori autorizzati)
authRouter.get('/me', authenticateToken, (req: any, res: Response): void => {
  const user = users.find(u => u.id === req.user?.userId && u.role === req.user?.role);
  if (!user) { res.status(401).json({success:false,message:'Sessione non più valida.'}); return; }
  res.json({success:true,user:toSafeProfile(user)});
});

authRouter.get('/profiles', authenticateToken, requireRole('admin', 'call_center', 'operator'), (_req: Request, res: Response) => {
  res.json({ success: true, profiles: users.map(toSafeProfile) });
});

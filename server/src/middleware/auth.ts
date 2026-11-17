import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { users } from '../services/dataStore.js';
import { addSecurityLog } from '../services/operationsService.js';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VOLTA_DEMO_MODE !== 'true') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET è obbligatoria in produzione o fuori dalla modalità demo.');
    }
    console.warn('⚠️ [SECURITY WARNING] JWT_SECRET non impostato! Utilizzo di fallback temporaneo per sviluppo locale.');
    return 'volta-dev-secret-change-in-production';
  }
  return secret;
};

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    tokenVersion?: number;
  };
}

export const generateToken = (payload: { userId: string; email: string; role: string; tokenVersion?: number }) => {
  return jwt.sign({ ...payload, tokenVersion: payload.tokenVersion ?? 1 }, getJwtSecret(), { expiresIn: '8h' });
};

/** Demo shortcuts are allowed only in explicit demo mode AND outside production. */
export const isDemoAllowed = (): boolean =>
  process.env.VOLTA_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Autenticazione richiesta.' });
    return;
  }

  if (token.startsWith('mock-')) {
    if (!isDemoAllowed()) {
      res.status(403).json({ success: false, message: 'Token non valido o scaduto.' });
      return;
    }
    const current = users
      .filter(u => token.includes(`-${u.id}-`))
      .sort((a, b) => b.id.length - a.id.length)[0];
    if (!current) {
      res.status(403).json({ success: false, message: 'Token demo non valido.' });
      return;
    }
    if (current.onboardingStatus === 'pending_verification') {
      res.status(403).json({ success: false, requireEmailVerification: true, message: 'Verifica prima il tuo indirizzo email tramite il link inviato.' });
      return;
    }
    if (current.onboardingStatus === 'suspended') {
      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      addSecurityLog({
        eventType: 'suspended_account_access_attempt',
        userEmail: current.email,
        ipAddress: clientIp,
        status: 'warning',
        details: 'Tentativo di accesso con token valido ma account sospeso'
      }).catch(err => console.error('[SecurityLog Error]', err));
      res.status(403).json({ success: false, message: 'Account sospeso. Contattare l’amministratore.' });
      return;
    }
    req.user = { userId: current.id, email: current.email, role: current.role, tokenVersion: Number(current.tokenVersion ?? 1) };
    next();
    return;
  }

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) {
      res.status(403).json({ success: false, message: 'Token non valido o scaduto.' });
      return;
    }
    const decoded = user as { userId?: string; email?: string; role?: string; tokenVersion?: number };
    const current = users.find(account => account.id === decoded.userId);
    if (!current || current.role !== decoded.role || current.email?.toLowerCase() !== decoded.email?.toLowerCase()) {
      res.status(403).json({ success: false, message: 'Sessione non più valida o privilegi modificati.' });
      return;
    }
    if (Number(decoded.tokenVersion ?? 1) !== Number(current.tokenVersion ?? 1)) {
      res.status(403).json({ success: false, message: 'Sessione revocata. Effettua nuovamente l’accesso.' });
      return;
    }
    if (current.onboardingStatus === 'pending_verification') {
      res.status(403).json({ success: false, requireEmailVerification: true, message: 'Verifica prima il tuo indirizzo email per accedere alle funzioni del portale.' });
      return;
    }
    if (current.onboardingStatus === 'suspended') {
      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      addSecurityLog({
        eventType: 'suspended_account_access_attempt',
        userEmail: current.email,
        ipAddress: clientIp,
        status: 'warning',
        details: 'Tentativo di accesso con token valido ma account sospeso'
      }).catch(err => console.error('[SecurityLog Error]', err));
      res.status(403).json({ success: false, message: 'Account sospeso. Contattare l’amministratore.' });
      return;
    }
    req.user = { userId: current.id, email: current.email, role: current.role, tokenVersion: Number(current.tokenVersion ?? 1) };
    next();
  });
};

export const requireRole = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !roles.includes(req.user.role)) {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
      await addSecurityLog({
        eventType: 'rbac_violation',
        userEmail: req.user?.email || 'unknown',
        ipAddress: clientIp,
        status: 'warning',
        details: `Accesso negato: ruolo '${req.user?.role || 'unknown'}' non autorizzato per ${req.originalUrl || req.url}`,
      }).catch(err => console.error('[SecurityLog Error]', err));
      res.status(403).json({ success: false, message: 'Accesso negato. Privilegi insufficienti.' });
      return;
    }
    next();
  };
};

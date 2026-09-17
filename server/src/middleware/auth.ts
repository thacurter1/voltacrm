import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { users } from '../services/dataStore.js';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.VOLTA_DEMO_MODE !== 'true') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET è obbligatoria fuori dalla modalità demo.');
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
  };
}

export const generateToken = (payload: { userId: string; email: string; role: string }) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
};

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Autenticazione richiesta.' });
    return;
  }

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) {
      res.status(403).json({ success: false, message: 'Token non valido o scaduto.' });
      return;
    }
    const decoded = user as { userId?: string; email?: string; role?: string };
    const current = users.find(account => account.id === decoded.userId);
    if (!current || current.role !== decoded.role || current.email?.toLowerCase() !== decoded.email?.toLowerCase()) {
      res.status(403).json({ success: false, message: 'Sessione non più valida o privilegi modificati.' });
      return;
    }
    req.user = { userId: current.id, email: current.email, role: current.role };
    next();
  });
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Accesso negato. Privilegi insufficienti.' });
      return;
    }
    next();
  };
};

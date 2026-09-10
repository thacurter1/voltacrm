import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is mandatory in production.');
    }
    console.warn('⚠️ [SECURITY WARNING] JWT_SECRET non impostato! Utilizzo di fallback temporaneo per sviluppo locale.');
    return 'volta-dev-secret-change-in-production';
  }
  return secret;
};

const JWT_SECRET = getJwtSecret();

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const generateToken = (payload: { userId: string; email: string; role: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
};

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Autenticazione richiesta.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ success: false, message: 'Token non valido o scaduto.' });
      return;
    }
    req.user = user as any;
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

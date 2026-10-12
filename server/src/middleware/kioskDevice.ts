import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { isDemoAllowed } from './auth.js';

/** Provision the key on the dedicated kiosk only; never bundle it in Vite. */
export const requireKioskDevice = (req: Request, res: Response, next: NextFunction): void => {
  if (isDemoAllowed()) {
    next();
    return;
  }

  const expected = process.env.TOTEM_KIOSK_DEVICE_KEY;
  if (!expected) {
    res.status(503).json({ success: false, message: 'Totem non configurato.' });
    return;
  }

  const provided = req.headers['x-kiosk-device-key'];
  if (typeof provided !== 'string') {
    res.status(401).json({ success: false, message: 'Postazione non autorizzata.' });
    return;
  }

  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    res.status(401).json({ success: false, message: 'Postazione non autorizzata.' });
    return;
  }

  next();
};

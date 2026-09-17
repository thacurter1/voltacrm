import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { sendOtp, verifyOtp, sendOfferWhatsApp } from '../services/messagingService.js';
import { otpLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

export const messagingRouter = Router();

const getTotemKey = () => process.env.TOTEM_KIOSK_API_KEY || (process.env.VOLTA_DEMO_MODE === 'true' ? 'KIOSK-TOKEN-RETAIL-01' : '');

// Middleware per Totem Kiosk: ammesso SOLO per invio scheda offerta WhatsApp
const authenticateOrValidTotem = (req: Request, res: Response, next: NextFunction): void => {
  const totemToken = req.headers['x-totem-token'];
  if (totemToken && typeof totemToken === 'string') {
    const inputBuf = Buffer.from(totemToken);
    const expectedBuf = Buffer.from(getTotemKey());
    if (expectedBuf.length > 0 && inputBuf.length === expectedBuf.length && crypto.timingSafeEqual(inputBuf, expectedBuf)) {
      return next();
    }
    res.status(401).json({
      success: false,
      message: 'Token Totem Kiosk non valido o non autorizzato.'
    });
    return;
  }

  const authHeader = req.headers['authorization'];
  if (authHeader) {
    return authenticateToken(req as any, res, next);
  }

  res.status(401).json({
    success: false,
    message: 'Autenticazione operatore o token Totem certificato richiesto.'
  });
};

// POST /api/messaging/send-otp (Rigorosamente riservato a utenti autenticati con JWT)
messagingRouter.post('/send-otp', otpLimiter, authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { phone, channel, reason } = req.body;

  if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
    res.status(400).json({
      success: false,
      message: 'Numero di telefono non valido o mancante.'
    });
    return;
  }

  const selectedChannel = channel === 'whatsapp' ? 'whatsapp' : 'sms';
  const result = await sendOtp(phone, selectedChannel, reason || 'digital_signature');

  res.status(200).json({
    message: `Codice OTP inviato con successo via ${selectedChannel.toUpperCase()}.`,
    ...result
  });
});

// POST /api/messaging/verify-otp (Rigorosamente riservato a utenti autenticati con JWT)
messagingRouter.post('/verify-otp', otpLimiter, authenticateToken, (req: Request, res: Response): void => {
  const { phone, code } = req.body;

  if (!phone || !code || typeof code !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Parametri phone e code obbligatori.'
    });
    return;
  }

  const result = verifyOtp(phone, code);

  if (!result.verified) {
    res.status(400).json(result);
    return;
  }

  res.status(200).json(result);
});

// POST /api/messaging/send-offer-whatsapp (Ammesso con JWT o con Token Totem Kiosk certificato)
messagingRouter.post('/send-offer-whatsapp', otpLimiter, authenticateOrValidTotem, async (req: Request, res: Response): Promise<void> => {
  const { phone, customerName, savingsEur, utilityType, offerName } = req.body;

  if (!phone || !customerName || savingsEur === undefined || !utilityType) {
    res.status(400).json({
      success: false,
      message: 'Parametri incompleti (richiesti phone, customerName, savingsEur, utilityType).'
    });
    return;
  }

  const result = await sendOfferWhatsApp({
    phone,
    customerName,
    savingsEur: Number(savingsEur),
    utilityType,
    offerName
  });

  res.status(200).json({
    message: 'Scheda offerta inviata su WhatsApp.',
    ...result
  });
});

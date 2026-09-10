import { Router, Request, Response } from 'express';
import { sendOtp, verifyOtp, sendOfferWhatsApp } from '../services/messagingService.js';
import { otpLimiter } from '../middleware/rateLimiter.js';

export const messagingRouter = Router();

// POST /api/messaging/send-otp
messagingRouter.post('/send-otp', otpLimiter, async (req: Request, res: Response): Promise<void> => {
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

// POST /api/messaging/verify-otp
messagingRouter.post('/verify-otp', (req: Request, res: Response): void => {
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

// POST /api/messaging/send-offer-whatsapp
messagingRouter.post('/send-offer-whatsapp', otpLimiter, async (req: Request, res: Response): Promise<void> => {
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

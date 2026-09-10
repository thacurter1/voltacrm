import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, message: 'Troppi tentativi di accesso. Riprova più tardi.' }
});

export const kioskLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Troppe richieste dal chiosco. Riprova tra poco.' }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, message: 'Limite di richieste superato.' }
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Troppe richieste di invio codice OTP o notifiche. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

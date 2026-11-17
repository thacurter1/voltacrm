import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { users, getCustomers, registerAccount } from '../services/dataStore.js';
import { generateToken, authenticateToken, requireRole, AuthRequest, isDemoAllowed } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import {
  validate,
  loginOperatorSchema,
  loginCustomerSchema,
  registerCustomerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  requestEmailChangeSchema,
  confirmEmailChangeSchema,
  oauthAuthSchema,
  createInvitationSchema,
  inspectInvitationSchema,
  acceptInvitationSchema,
} from '../middleware/validate.js';
import {
  createAccountInvitation,
  inspectAccountInvitation,
  acceptAccountInvitation,
  renewAccountInvitation,
} from '../services/invitationService.js';
import {
  issueAuthActionToken,
  verifyAccountEmailWithToken,
  resetAccountPasswordWithToken,
  bumpAccountTokenVersion,
  confirmEmailChangeWithToken,
} from '../services/authTokenService.js';
import { sendTransactionalEmail, resolveAllowedAppBaseUrl } from '../services/emailService.js';
import {
  normalizeFiscalCode,
  shouldEnforceStrictFiscalChecksum,
  validateItalianFiscalCodeOrVat,
} from '../utils/fiscalCode.js';
import { verifyTotp } from '../utils/totp.js';
import { verifyOAuthToken } from '../services/oauthVerifier.js';
import { addSecurityLog } from '../services/operationsService.js';

export const authRouter = Router();

const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
};

const toSafeProfile = (user: any) => {
  const { password: _password, twoFactorSecret: _secret, oauthSubject: _oauthSubject,
    inviteTokenHash: _inviteHash, inviteExpiresAt: _inviteExpires,
    inviteTotpSecret: _inviteTotp, ...safeUser } = user;
  return safeUser;
};

const rejectIfSuspended = async (user: any, req: Request, res: Response): Promise<boolean> => {
  if (user?.onboardingStatus !== 'suspended') return false;
  await addSecurityLog({
    eventType: 'suspended_account_access_attempt',
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: 'warning',
    details: `Tentativo di accesso al login con account sospeso su ${req.originalUrl || req.url}`,
  }).catch(err => console.error('[SecurityLog Error]', err));
  res.status(403).json({ success: false, message: 'Account sospeso. Contattare l’amministratore.' });
  return true;
};

const rejectIfPendingVerification = (user: any, res: Response): boolean => {
  if (user?.onboardingStatus !== 'pending_verification' && user?.emailVerified !== false) return false;
  if (user?.onboardingStatus === 'invited') return false;
  res.status(403).json({
    success: false,
    requireEmailVerification: true,
    message: 'Indirizzo email non ancora verificato. Controlla la tua casella o richiedi un nuovo link di verifica.',
  });
  return true;
};

function buildVerificationEmailUrl(rawToken: string): string {
  return `${resolveAllowedAppBaseUrl()}/?portal=customer&verifyEmailToken=${encodeURIComponent(rawToken)}`;
}

function buildResetPasswordUrl(rawToken: string): string {
  return `${resolveAllowedAppBaseUrl()}/?portal=customer&resetToken=${encodeURIComponent(rawToken)}`;
}

function buildEmailChangeUrl(rawToken: string): string {
  return `${resolveAllowedAppBaseUrl()}/?portal=customer&emailChangeToken=${encodeURIComponent(rawToken)}`;
}

async function sendVerificationEmailForUser(user: { id: string; name: string; email: string }) {
  const issued = await issueAuthActionToken({
    accountId: user.id,
    purpose: 'verify_email',
    targetEmail: user.email,
    ttlMs: 24 * 3600_000,
    revokePrevious: true,
  });
  const verifyUrl = buildVerificationEmailUrl(issued.rawToken);
  return sendTransactionalEmail({
    to: user.email,
    category: 'verify_email',
    subject: 'Verifica il tuo indirizzo email — VoltaCRM',
    text: `Ciao ${user.name},\n\nConferma il tuo indirizzo email per attivare l'accesso a VoltaCRM:\n${verifyUrl}\n\nIl link è valido per 24 ore ed è utilizzabile una sola volta.`,
  });
}

// POST /api/auth/demo-login (Accesso rapido 1-click in modalità demo / testing)
authRouter.post('/demo-login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  if (!isDemoAllowed()) {
    res.status(404).json({ success: false, message: 'Endpoint non trovato.' });
    return;
  }
  const { role, userId } = req.body || {};
  const user = (userId && users.find(u => u.id === userId)) || (role && users.find(u => u.role === role));
  if (!user) {
    res.status(404).json({ success: false, message: 'Account demo non trovato.' });
    return;
  }
  if (await rejectIfSuspended(user, req, res)) return;
  if (rejectIfPendingVerification(user, res)) return;
  const token = generateToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: Number(user.tokenVersion ?? 1) });
  res.json({
    success: true,
    token,
    user: toSafeProfile(user)
  });
});

// POST /api/auth/login-operator
authRouter.post('/login-operator', loginLimiter, validate(loginOperatorSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password, totpCode } = req.body;
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase() && u.role !== 'customer');

  if (!user || !bcrypt.compareSync(password, user.password)) {
    await addSecurityLog({
      eventType: 'login_failed_operator',
      userEmail: (email || 'unknown').toLowerCase(),
      ipAddress: getClientIp(req),
      status: 'warning',
      details: 'Credenziali operatore errate'
    }).catch(err => console.error('[SecurityLog Error]', err));
    res.status(401).json({ success: false, message: 'Credenziali operatore non valide.' });
    return;
  }
  if (user.onboardingStatus === 'invited') {
    res.status(403).json({ success: false, message: 'Completa prima l’attivazione del tuo invito.' });
    return;
  }
  if (await rejectIfSuspended(user, req, res)) return;

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
    const isDevMock = isDemoAllowed() && totpCode === '123456';

    if (!isTotpValid && !isDevMock) {
      await addSecurityLog({
        eventType: 'totp_failed_operator',
        userEmail: user.email,
        ipAddress: getClientIp(req),
        status: 'warning',
        details: 'Codice 2FA non valido o scaduto'
      }).catch(err => console.error('[SecurityLog Error]', err));
      res.status(403).json({ success: false, message: 'Codice 2FA non valido o scaduto.' });
      return;
    }
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: Number(user.tokenVersion ?? 1) });

  await addSecurityLog({
    eventType: 'login_success_operator',
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: 'safe',
    details: 'Autenticazione operatore completata con successo'
  }).catch(err => console.error('[SecurityLog Error]', err));

  res.json({
    success: true,
    token,
    user: toSafeProfile(user)
  });
});

// POST /api/auth/login-customer
authRouter.post('/login-customer', loginLimiter, validate(loginCustomerSchema), async (req: Request, res: Response): Promise<void> => {
  const { identifier, password } = req.body;
  const query = (identifier || '').trim().toLowerCase();

  const user = users.find(u =>
    u.role === 'customer' && (
      u.email.toLowerCase() === query ||
      u.fiscalCode?.toLowerCase() === query
    )
  );

  if (!user || !bcrypt.compareSync(password, user.password)) {
    await addSecurityLog({
      eventType: 'login_failed_customer',
      userEmail: query || 'unknown',
      ipAddress: getClientIp(req),
      status: 'warning',
      details: 'Credenziali cliente non valide'
    }).catch(err => console.error('[SecurityLog Error]', err));
    res.status(401).json({ success: false, message: 'Credenziali cliente non valide.' });
    return;
  }
  if (user.onboardingStatus === 'invited') {
    res.status(403).json({ success: false, message: 'Completa prima l’attivazione del tuo invito.' });
    return;
  }
  if (await rejectIfSuspended(user, req, res)) return;
  if (rejectIfPendingVerification(user, res)) return;

  const token = generateToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: Number(user.tokenVersion ?? 1) });

  await addSecurityLog({
    eventType: 'login_success_customer',
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: 'safe',
    details: 'Autenticazione cliente completata con successo'
  }).catch(err => console.error('[SecurityLog Error]', err));

  res.json({
    success: true,
    token,
    user: toSafeProfile(user)
  });
});

// POST /api/auth/register-customer
authRouter.post('/register-customer', loginLimiter, validate(registerCustomerSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, fiscalCode, password, privacyPolicyVersion, marketingConsent } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFiscalCode = normalizeFiscalCode(fiscalCode);

  if (shouldEnforceStrictFiscalChecksum()) {
    const cfCheck = validateItalianFiscalCodeOrVat(normalizedFiscalCode);
    if (!cfCheck.valid) {
      res.status(400).json({ success: false, message: cfCheck.reason || 'Codice Fiscale o Partita IVA non valido.' });
      return;
    }
  }

  const existingUser = users.find(u =>
    u.email.toLowerCase() === normalizedEmail ||
    (u.fiscalCode && u.fiscalCode.toUpperCase() === normalizedFiscalCode)
  );
  const existingCustomer = getCustomers().find(c =>
    (c.fiscalCode && c.fiscalCode.toUpperCase() === normalizedFiscalCode) ||
    (c.email && c.email.toLowerCase() === normalizedEmail)
  );
  if (existingUser || existingCustomer) {
    res.status(409).json({ success: false, message: 'Email o Codice Fiscale/P.IVA già registrato nel sistema.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];
  const customerId = crypto.randomUUID();
  const profile = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    role: 'customer',
    phone,
    fiscalCode: normalizedFiscalCode,
    customerId,
    avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    is2faEnabled: false,
    onboardingStatus: 'pending_verification' as const,
    emailVerified: false,
    tokenVersion: 1,
    privacyConsentAccepted: true,
    privacyConsentTimestamp: nowIso,
    privacyPolicyVersion: privacyPolicyVersion || 'bozza-2026-11',
    marketingConsent: Boolean(marketingConsent),
    marketingConsentTimestamp: Boolean(marketingConsent) ? nowIso : undefined,
    createdAt: today,
  };

  await registerAccount(profile, {
    id: customerId,
    name: profile.name,
    email: profile.email,
    phone,
    fiscalCode: profile.fiscalCode,
    city: '',
    utilityPoints: [],
    contractStartDate: today,
    lastSwitchAuditDate: today,
    nextSwitchAuditDate: new Date(Date.now() + 120 * 86400000).toISOString().split('T')[0],
    accountManager: '',
    hasBrokerageMandate: false,
    notes: `Registrato da portale clienti (Informativa ${profile.privacyPolicyVersion}${profile.marketingConsent ? ' + consenso marketing' : ''})`,
  });

  const emailResult = await sendVerificationEmailForUser({ id: profile.id, name: profile.name, email: profile.email });

  await addSecurityLog({
    eventType: 'customer_registration_pending_verification',
    userEmail: profile.email,
    ipAddress: getClientIp(req),
    status: emailResult.sent ? 'safe' : 'warning',
    details: emailResult.sent
      ? `Registrazione creata in attesa verifica email (informativa ${profile.privacyPolicyVersion})`
      : 'Registrazione creata ma consegna email verifica non riuscita',
  }).catch(err => console.error('[SecurityLog Error]', err));

  res.status(201).json({
    success: true,
    requireEmailVerification: true,
    emailSent: emailResult.sent,
    ...(emailResult.error ? { emailError: emailResult.error } : {}),
    message: emailResult.sent
      ? 'Account creato. Controlla la tua casella email e clicca sul link di verifica per accedere.'
      : 'Account registrato, ma il servizio email non ha completato l’invio. Riprova a inviare il link di verifica o contatta l’assistenza.',
    user: toSafeProfile(profile),
  });
});

// POST /api/auth/verify-email
authRouter.post('/verify-email', loginLimiter, validate(verifyEmailSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const verified = await verifyAccountEmailWithToken(req.body.token);
    await addSecurityLog({
      eventType: 'email_verified',
      userEmail: verified.email || verified.accountId,
      ipAddress: getClientIp(req),
      status: 'safe',
      details: 'Indirizzo email verificato con token monouso',
    }).catch(err => console.error('[SecurityLog Error]', err));
    res.json({ success: true, message: 'Email verificata con successo. Ora puoi accedere con le tue credenziali.' });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, message: err.message || 'Link di verifica non valido o scaduto.' });
  }
});

// POST /api/auth/resend-verification
authRouter.post('/resend-verification', loginLimiter, validate(resendVerificationSchema), async (req: Request, res: Response): Promise<void> => {
  const email = req.body.email.trim().toLowerCase();
  const user = users.find(u => u.role === 'customer' && u.email.toLowerCase() === email);
  const genericMessage = 'Se l’indirizzo è registrato ed è in attesa di verifica, abbiamo inviato un nuovo link di attivazione.';

  if (!user || (user.onboardingStatus !== 'pending_verification' && user.emailVerified !== false)) {
    res.json({ success: true, message: genericMessage });
    return;
  }

  const emailResult = await sendVerificationEmailForUser({ id: user.id, name: user.name, email: user.email });
  if (!emailResult.sent) {
    res.status(503).json({
      success: false,
      emailSent: false,
      message: emailResult.error || 'Invio email di verifica non disponibile al momento.',
    });
    return;
  }
  res.json({ success: true, emailSent: true, message: genericMessage });
});

// POST /api/auth/forgot-password (anti-enumerazione)
authRouter.post('/forgot-password', loginLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  const email = req.body.email.trim().toLowerCase();
  const genericMessage = 'Se l’indirizzo è associato a un account attivo, riceverai a breve un link per reimpostare la password.';
  const user = users.find(u => u.role === 'customer' && u.email.toLowerCase() === email && u.onboardingStatus !== 'suspended' && u.onboardingStatus !== 'invited');

  if (!user) {
    res.json({ success: true, message: genericMessage });
    return;
  }

  const issued = await issueAuthActionToken({
    accountId: user.id,
    purpose: 'reset_password',
    targetEmail: user.email,
    ttlMs: 3600_000,
    revokePrevious: true,
  });
  const resetUrl = buildResetPasswordUrl(issued.rawToken);
  const emailResult = await sendTransactionalEmail({
    to: user.email,
    category: 'reset_password',
    subject: 'Reimposta la tua password — VoltaCRM',
    text: `Ciao ${user.name},\n\nAbbiamo ricevuto una richiesta di ripristino password. Apri questo link monouso (valido 1 ora):\n${resetUrl}\n\nSe non hai richiesto il ripristino, puoi ignorare questo messaggio: la password attuale resterà invariata.`,
  });

  await addSecurityLog({
    eventType: 'password_reset_requested',
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: emailResult.sent ? 'safe' : 'warning',
    details: emailResult.sent
      ? 'Link ripristino password inviato via email'
      : 'Richiesta reset password con consegna email fallita',
  }).catch(err => console.error('[SecurityLog Error]', err));

  if (!emailResult.sent && process.env.VOLTA_DEMO_MODE !== 'true' && process.env.NODE_ENV === 'production') {
    res.status(503).json({
      success: false,
      emailSent: false,
      message: 'Servizio email per il recupero password non configurato o temporaneamente non disponibile.',
    });
    return;
  }

  res.json({ success: true, message: genericMessage });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', loginLimiter, validate(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const newHash = await bcrypt.hash(req.body.password, 12);
    const result = await resetAccountPasswordWithToken(req.body.token, newHash);
    await addSecurityLog({
      eventType: 'password_reset_completed',
      userEmail: result.email || result.accountId,
      ipAddress: getClientIp(req),
      status: 'safe',
      details: 'Password reimpostata e tutte le sessioni precedenti revocate',
    }).catch(err => console.error('[SecurityLog Error]', err));
    res.json({ success: true, message: 'Password aggiornata. Tutte le sessioni precedenti sono state revocate.' });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, message: err.message || 'Link di ripristino non valido o scaduto.' });
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', authenticateToken, validate(changePasswordSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const user = users.find(u => u.id === req.user?.userId);
  if (!user) {
    res.status(403).json({ success: false, message: 'Account non trovato.' });
    return;
  }
  if (!bcrypt.compareSync(req.body.currentPassword, user.password)) {
    res.status(403).json({ success: false, message: 'La password attuale non è corretta.' });
    return;
  }
  const newHash = await bcrypt.hash(req.body.newPassword, 12);
  const nextVersion = await bumpAccountTokenVersion(user.id, newHash);
  const freshToken = generateToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: nextVersion });

  await addSecurityLog({
    eventType: 'password_changed',
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: 'safe',
    details: 'Password aggiornata e sessioni precedenti revocate',
  }).catch(err => console.error('[SecurityLog Error]', err));

  res.json({
    success: true,
    token: freshToken,
    message: 'Password aggiornata. Le sessioni su altri dispositivi sono state revocate.',
  });
});

// POST /api/auth/logout-all
authRouter.post('/logout-all', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = users.find(u => u.id === req.user?.userId);
  if (!user) {
    res.status(403).json({ success: false, message: 'Account non trovato.' });
    return;
  }
  await bumpAccountTokenVersion(user.id);
  await addSecurityLog({
    eventType: 'sessions_revoked_all',
    userEmail: user.email,
    ipAddress: getClientIp(req),
    status: 'safe',
    details: 'Revoca globale di tutte le sessioni JWT eseguita dall’utente',
  }).catch(err => console.error('[SecurityLog Error]', err));

  res.json({
    success: true,
    message: 'Tutte le sessioni attive sono state revocate sul server. Sarà necessario accedere nuovamente.',
  });
});

// POST /api/auth/request-email-change
authRouter.post('/request-email-change', authenticateToken, validate(requestEmailChangeSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  const user = users.find(u => u.id === req.user?.userId);
  if (!user) {
    res.status(403).json({ success: false, message: 'Account non trovato.' });
    return;
  }
  if (!user.authProvider && (!req.body.password || !bcrypt.compareSync(req.body.password, user.password))) {
    res.status(403).json({ success: false, message: 'Inserisci la password attuale per confermare il cambio email.' });
    return;
  }
  const newEmail = req.body.newEmail.trim().toLowerCase();
  if (newEmail === user.email.toLowerCase()) {
    res.status(400).json({ success: false, message: 'La nuova email coincide con quella già attiva.' });
    return;
  }
  if (users.some(u => u.id !== user.id && u.email.toLowerCase() === newEmail)) {
    res.status(409).json({ success: false, message: 'Questo indirizzo email è già associato a un altro account.' });
    return;
  }

  const issued = await issueAuthActionToken({
    accountId: user.id,
    purpose: 'change_email',
    targetEmail: newEmail,
    ttlMs: 24 * 3600_000,
    revokePrevious: true,
  });
  const confirmUrl = buildEmailChangeUrl(issued.rawToken);
  const emailResult = await sendTransactionalEmail({
    to: newEmail,
    category: 'change_email',
    subject: 'Conferma il nuovo indirizzo email — VoltaCRM',
    text: `Ciao ${user.name},\n\nConferma il cambio email sul tuo account VoltaCRM aprendo questo link monouso (valido 24 ore):\n${confirmUrl}\n\nSe non hai richiesto questo cambio, ignora il messaggio.`,
  });

  if (!emailResult.sent) {
    res.status(503).json({
      success: false,
      emailSent: false,
      message: emailResult.error || 'Impossibile inviare il link di conferma al nuovo indirizzo email.',
    });
    return;
  }

  res.json({
    success: true,
    emailSent: true,
    message: `Abbiamo inviato un link di conferma al nuovo indirizzo ${newEmail}. Il cambio sarà effettivo dopo la verifica.`,
  });
});

// POST /api/auth/confirm-email-change
authRouter.post('/confirm-email-change', loginLimiter, validate(confirmEmailChangeSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await confirmEmailChangeWithToken(req.body.token);
    await addSecurityLog({
      eventType: 'email_changed',
      userEmail: result.email,
      ipAddress: getClientIp(req),
      status: 'safe',
      details: 'Indirizzo email account aggiornato dopo verifica del nuovo indirizzo',
    }).catch(err => console.error('[SecurityLog Error]', err));
    res.json({
      success: true,
      email: result.email,
      message: 'Nuovo indirizzo email confermato. Effettua nuovamente l’accesso con la nuova email.',
    });
  } catch (err: any) {
    res.status(err.status || 400).json({ success: false, message: err.message || 'Token cambio email non valido o scaduto.' });
  }
});

authRouter.post('/invitations', authenticateToken, requireRole('admin'), validate(createInvitationSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actor = users.find(user => user.id === req.user?.userId);
    if (!actor) { res.status(403).json({ success: false, message: 'Account amministratore non trovato.' }); return; }
    const invitation = await createAccountInvitation(actor, req.body);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ success: true, ...invitation });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Errore durante la creazione dell\'invito.' });
  }
});

authRouter.post('/invitations/:id/renew', authenticateToken, requireRole('admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invitation = await renewAccountInvitation(req.params.id);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, ...invitation });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Errore durante il rinnovo dell\'invito.' });
  }
});

authRouter.post('/invitations/inspect', loginLimiter, validate(inspectInvitationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const invitation = await inspectAccountInvitation(req.body.token);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, invitation });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Errore durante la verifica dell\'invito.' });
  }
});

authRouter.post('/invitations/accept', loginLimiter, validate(acceptInvitationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const accepted = await acceptAccountInvitation(req.body.token, req.body.password, req.body.totpCode);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, ...accepted });
  } catch (error: any) {
    res.status(error.status || 500).json({ success: false, message: error.message || 'Errore durante l\'accettazione dell\'invito.' });
  }
});

// POST /api/auth/oauth (Google & Apple OAuth login / registration con verifica crittografica token)
authRouter.post('/oauth', loginLimiter, validate(oauthAuthSchema), async (req: Request, res: Response): Promise<void> => {
  const { provider, name, idToken } = req.body;

  let verifiedClaims;
  try {
    verifiedClaims = await verifyOAuthToken(provider, idToken);
  } catch (err: any) {
    res.status(401).json({
      success: false,
      message: `Autenticazione OAuth fallita: ${err.message || 'token non valido'}`
    });
    return;
  }

  const targetEmail = verifiedClaims.email;
  const targetName = (verifiedClaims.name || name || (provider === 'google' ? 'Utente Google' : 'Utente Apple')).trim();
  const tokenAvatar = verifiedClaims.picture;

  // The provider subject is the stable identity; email can change or be reused.
  let user = users.find(u => u.authProvider === provider && u.oauthSubject === verifiedClaims.sub);
  const emailOwner = users.find(u => u.email.toLowerCase() === targetEmail);

  if (user && await rejectIfSuspended(user, req, res)) return;
  if (user && user.role !== 'customer') {
    res.status(403).json({ success: false, message: 'Per lo staff è richiesto l’accesso con credenziali aziendali e 2FA.' });
    return;
  }
  if (!user && emailOwner?.role !== undefined && emailOwner.role !== 'customer') {
    res.status(403).json({ success: false, message: 'Per lo staff è richiesto l’accesso con credenziali aziendali e 2FA.' });
    return;
  }
  if (!user && emailOwner) {
    res.status(409).json({ success: false, message: 'Account già presente. Accedi con il metodo associato o contatta l’assistenza.' });
    return;
  }

  if (!user) {
    const safeRole = 'customer';
    const today = new Date().toISOString().split('T')[0];
    const customerId = crypto.randomUUID();
    const profile = {
      id: crypto.randomUUID(),
      name: targetName,
      email: targetEmail,
      password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 12),
      role: safeRole,
      phone: '+39 340 0000000',
      fiscalCode: 'OAUTHUSER00A00A0',
      customerId,
      avatar: tokenAvatar || (targetName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'OU'),
      is2faEnabled: false,
      onboardingStatus: 'active' as const,
      emailVerified: true,
      tokenVersion: 1,
      createdAt: today,
      authProvider: provider,
      oauthSubject: verifiedClaims.sub
    };

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
      accountManager: '',
      hasBrokerageMandate: false,
      notes: `Registrato via ${provider.toUpperCase()} OAuth`
    });

    user = profile;
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: Number(user.tokenVersion ?? 1) });
  res.json({
    success: true,
    token,
    user: toSafeProfile(user),
    provider
  });
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, (req: any, res: Response): void => {
  const user = users.find(u => u.id === req.user?.userId && u.role === req.user?.role);
  if (!user) { res.status(401).json({ success: false, message: 'Sessione non più valida.' }); return; }
  res.json({ success: true, user: toSafeProfile(user) });
});

authRouter.get('/profiles', authenticateToken, requireRole('admin', 'call_center', 'operator', 'broker'), (req: any, res: Response) => {
  if (req.user?.role === 'admin') {
    res.json({ success: true, profiles: users.map(toSafeProfile) });
    return;
  }
  res.json({
    success: true,
    profiles: users.filter(user => user.role !== 'customer').map(user => ({
      id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar
    }))
  });
});

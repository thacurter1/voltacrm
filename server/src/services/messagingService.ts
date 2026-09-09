import dotenv from 'dotenv';
import { addNotification } from './dataStore.js';

dotenv.config();

export interface PendingOtp {
  code: string;
  expiresAt: number; // epoch ms
  attempts: number;
  channel: 'sms' | 'whatsapp';
  reason: string;
}

export interface SendOtpResult {
  success: boolean;
  messageId: string;
  expiresAt: string;
  channel: 'sms' | 'whatsapp';
  debugOtp?: string;
  sandboxMode: boolean;
}

export interface VerifyOtpResult {
  success: boolean;
  verified: boolean;
  message: string;
}

export interface SendOfferPayload {
  phone: string;
  customerName: string;
  savingsEur: number;
  utilityType: string;
  offerName?: string;
}

// Map per memorizzare gli OTP in attesa (TTL 5 minuti)
const pendingOtps = new Map<string, PendingOtp>();

function sanitizePhone(rawPhone: string): string {
  let cleaned = rawPhone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('39')) {
      cleaned = '+' + cleaned;
    } else {
      cleaned = '+39' + cleaned;
    }
  }
  return cleaned;
}

/**
 * Invia un codice OTP sicuro a 6 cifre via SMS o WhatsApp.
 * Supporta Twilio REST API, Meta WhatsApp Cloud API e Dev Sandbox Fallback.
 */
export async function sendOtp(
  phone: string,
  channel: 'sms' | 'whatsapp' = 'sms',
  reason = 'digital_signature'
): Promise<SendOtpResult> {
  const cleanPhone = sanitizePhone(phone);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const ttlMs = 5 * 60 * 1000; // 5 minuti
  const expiresAtMs = Date.now() + ttlMs;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  // Salva in-memory con azzeramento tentativi
  pendingOtps.set(cleanPhone, {
    code,
    expiresAt: expiresAtMs,
    attempts: 0,
    channel,
    reason
  });

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromSms = process.env.TWILIO_PHONE_NUMBER;
  const twilioFromWa = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

  const metaToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const metaPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // 1. Prova Twilio (se configurato)
  if (twilioSid && twilioToken) {
    try {
      const isWa = channel === 'whatsapp';
      const from = isWa ? `whatsapp:${twilioFromWa}` : twilioFromSms;
      const to = isWa ? `whatsapp:${cleanPhone}` : cleanPhone;
      const text = isWa
        ? `⚡ *VoltaCRM*: Il tuo codice di verifica per la firma digitale è *${code}*.\nValido per 5 minuti. Non condividerlo con nessuno.`
        : `VoltaCRM: Codice OTP per firma digitale: ${code}. Valido 5 min.`;

      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', from || '');
      params.append('To', to);
      params.append('Body', text);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (response.ok) {
        const data = (await response.json()) as { sid: string };
        console.log(`[Twilio ${channel.toUpperCase()}] OTP inviato con successo a ${cleanPhone}. SID: ${data.sid}`);
        return {
          success: true,
          messageId: data.sid,
          expiresAt: expiresAtIso,
          channel,
          sandboxMode: false
        };
      } else {
        const errText = await response.text();
        console.warn(`[Twilio] Errore risposta: ${errText}. Attivazione sandbox fallback.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Twilio] Errore di rete: ${msg}. Attivazione sandbox fallback.`);
    }
  }

  // 2. Prova Meta WhatsApp Cloud API (se configurato e canale whatsapp)
  if (channel === 'whatsapp' && metaToken && metaPhoneId) {
    try {
      const waRecipient = cleanPhone.replace('+', '');
      const response = await fetch(`https://graph.facebook.com/v19.0/${metaPhoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: `⚡ *VoltaCRM*: Il tuo codice OTP per la firma del mandato è: *${code}*.\nScade tra 5 minuti.`
          }
        })
      });

      if (response.ok) {
        const data = (await response.json()) as { messages?: Array<{ id: string }> };
        const msgId = data.messages?.[0]?.id || `meta-${Date.now()}`;
        console.log(`[Meta WhatsApp] OTP inviato con successo a ${cleanPhone}. ID: ${msgId}`);
        return {
          success: true,
          messageId: msgId,
          expiresAt: expiresAtIso,
          channel,
          sandboxMode: false
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Meta WhatsApp] Errore: ${msg}. Fallback su sandbox.`);
    }
  }

  // 3. Dev Sandbox Fallback Mode
  console.log(`\n======================================================`);
  console.log(`📲 [DEV SANDBOX ${channel.toUpperCase()}] OTP Generato`);
  console.log(`Destinatario: ${cleanPhone}`);
  console.log(`Codice OTP:   ${code}`);
  console.log(`Scadenza:     ${expiresAtIso} (5 minuti)`);
  console.log(`======================================================\n`);

  // Notifica interna visibile nel Notification Center per facilitare i test dell'operatore
  addNotification({
    id: `notif-otp-${Date.now()}`,
    type: 'signature_completed',
    title: `Nuovo OTP Generato (${channel.toUpperCase()})`,
    message: `Codice ${code} generato per ${cleanPhone}. Valido per 5 minuti.`,
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: 'info',
    targetRole: 'all',
    actionTab: 'security'
  });

  return {
    success: true,
    messageId: `sandbox-${Date.now()}`,
    expiresAt: expiresAtIso,
    channel,
    debugOtp: code,
    sandboxMode: true
  };
}

/**
 * Verifica il codice OTP fornito per un dato numero di cellulare.
 */
export function verifyOtp(phone: string, code: string): VerifyOtpResult {
  const cleanPhone = sanitizePhone(phone);
  const pending = pendingOtps.get(cleanPhone);

  if (!pending) {
    return {
      success: false,
      verified: false,
      message: 'Nessun codice OTP in attesa trovato per questo numero o codice scaduto.'
    };
  }

  if (Date.now() > pending.expiresAt) {
    pendingOtps.delete(cleanPhone);
    return {
      success: false,
      verified: false,
      message: 'Codice OTP scaduto. Richiedi un nuovo codice.'
    };
  }

  pending.attempts += 1;

  if (pending.attempts > 3) {
    pendingOtps.delete(cleanPhone);
    return {
      success: false,
      verified: false,
      message: 'Troppi tentativi errati. Il codice è stato invalidato per sicurezza.'
    };
  }

  if (pending.code !== code.trim()) {
    return {
      success: false,
      verified: false,
      message: `Codice OTP non valido. Tentativi rimasti: ${3 - pending.attempts}`
    };
  }

  // Codice corretto: consuma l'OTP
  pendingOtps.delete(cleanPhone);
  return {
    success: true,
    verified: true,
    message: 'Codice OTP verificato con successo.'
  };
}

/**
 * Invia una scheda offerta/preventivo su WhatsApp a un visitatore del Totem Kiosk.
 */
export async function sendOfferWhatsApp(
  payload: SendOfferPayload
): Promise<{ success: boolean; messageId: string; deliveryChannel: string }> {
  const cleanPhone = sanitizePhone(payload.phone);
  const messageBody = `⚡ *Ciao ${payload.customerName}!*

Ecco il riassunto dell'analisi energetica effettuata al Totem Volta:
💰 *Risparmio stimato:* €${payload.savingsEur.toFixed(2)}/anno sulla fornitura ${payload.utilityType.toUpperCase()}.
🏷️ *Offerta consigliata:* ${payload.offerName || 'Miglior Tariffa Mercato Libero'}.

👉 Clicca qui per visualizzare la scheda interattiva e attivare il mandato:
https://voltacrm.it/preventivo?tel=${encodeURIComponent(cleanPhone)}&eur=${payload.savingsEur}

Un nostro Energy Specialist dedicato resta a tua disposizione.`;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromWa = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

  if (twilioSid && twilioToken) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', `whatsapp:${twilioFromWa}`);
      params.append('To', `whatsapp:${cleanPhone}`);
      params.append('Body', messageBody);

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (res.ok) {
        const data = (await res.json()) as { sid: string };
        console.log(`[Twilio WhatsApp] Scheda offerta inviata a ${cleanPhone} (SID: ${data.sid})`);
        return { success: true, messageId: data.sid, deliveryChannel: 'twilio_whatsapp' };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Twilio WhatsApp] Errore invio scheda offerta: ${msg}`);
    }
  }

  // Sandbox Mode
  console.log(`\n======================================================`);
  console.log(`💬 [DEV SANDBOX WHATSAPP] Preventivo Inviato`);
  console.log(`Destinatario: ${cleanPhone}`);
  console.log(`Cliente:      ${payload.customerName}`);
  console.log(`Risparmio:    €${payload.savingsEur}/anno (${payload.utilityType})`);
  console.log(`======================================================\n`);

  addNotification({
    id: `notif-kiosk-wa-${Date.now()}`,
    type: 'totem_lead',
    title: `Preventivo WhatsApp Inviato (${payload.customerName})`,
    message: `Inviato link offerta €${payload.savingsEur}/a a ${cleanPhone} dal Totem.`,
    timestamp: new Date().toISOString(),
    isRead: false,
    priority: 'high',
    targetRole: 'call_center',
    actionTab: 'leads'
  });

  return {
    success: true,
    messageId: `sandbox-wa-${Date.now()}`,
    deliveryChannel: 'sandbox_whatsapp'
  };
}

export interface TransactionalEmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  category?: string;
}

export interface TransactionalEmailResult {
  sent: boolean;
  provider: string;
  messageId?: string;
  attempts: number;
  error?: string;
}

export type EmailTestAdapter = (
  message: TransactionalEmailMessage
) => Promise<{ messageId?: string; accepted?: string[] }>;

export interface StoredOutboxEmail extends TransactionalEmailMessage {
  messageId: string;
  sentAt: string;
  provider: string;
}

let customTestAdapter: EmailTestAdapter | null = null;
const testEmailOutbox: StoredOutboxEmail[] = [];
const MAX_OUTBOX_ITEMS = 50;

export function configureEmailTestAdapter(adapter: EmailTestAdapter | null): void {
  customTestAdapter = adapter;
}

export function getTestEmailOutbox(): StoredOutboxEmail[] {
  return [...testEmailOutbox];
}

export function clearTestEmailOutbox(): void {
  testEmailOutbox.splice(0, testEmailOutbox.length);
}

function recordOutboxMessage(message: TransactionalEmailMessage, messageId: string, provider: string): void {
  testEmailOutbox.unshift({
    ...message,
    messageId,
    provider,
    sentAt: new Date().toISOString(),
  });
  if (testEmailOutbox.length > MAX_OUTBOX_ITEMS) {
    testEmailOutbox.splice(MAX_OUTBOX_ITEMS);
  }
}

function createTransientError(message: string): Error & { transient: boolean } {
  return Object.assign(new Error(message), { transient: true });
}

export function resolveAllowedAppBaseUrl(): string {
  const explicit = process.env.APP_PUBLIC_URL?.trim();
  if (explicit) {
    try {
      const parsed = new URL(explicit);
      if (parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return parsed.origin;
      }
    } catch {}
  }

  const rawCors = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const nonLocalCors = rawCors.find((origin) => {
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && !u.hostname.endsWith('.localhost');
    } catch {
      return false;
    }
  });
  if (nonLocalCors) {
    try {
      return new URL(nonLocalCors).origin;
    } catch {}
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://voltacrm.vercel.app';
  }
  return 'http://localhost:5173';
}

async function deliverViaResend(message: TransactionalEmailMessage): Promise<{ messageId: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'VoltaCRM <noreply@voltagroup.it>';
  if (!apiKey) {
    throw new Error('RESEND_API_KEY non configurata.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const msg = `Resend HTTP ${response.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`;
    if (response.status >= 500 || response.status === 429) {
      throw createTransientError(msg);
    }
    throw new Error(msg);
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { messageId: data.id || `resend-${Date.now()}` };
}

async function deliverViaWebhook(message: TransactionalEmailMessage): Promise<{ messageId: string }> {
  const webhookUrl = process.env.EMAIL_WEBHOOK_URL?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'VoltaCRM <noreply@voltagroup.it>';
  if (!webhookUrl) {
    throw new Error('EMAIL_WEBHOOK_URL non configurato.');
  }

  const secret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      category: message.category || 'transactional',
    }),
  });

  if (!response.ok) {
    const msg = `Webhook email HTTP ${response.status}`;
    if (response.status >= 500 || response.status === 429) {
      throw createTransientError(msg);
    }
    throw new Error(msg);
  }

  const data = (await response.json().catch(() => ({}))) as { messageId?: string; id?: string };
  return { messageId: data.messageId || data.id || `webhook-${Date.now()}` };
}

export async function sendTransactionalEmail(
  message: TransactionalEmailMessage
): Promise<TransactionalEmailResult> {
  const isTestOrDemo = process.env.NODE_ENV === 'test' || process.env.VOLTA_DEMO_MODE === 'true';
  const configuredProvider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();

  let provider = configuredProvider;
  if (customTestAdapter) {
    provider = 'test-adapter';
  } else if (!provider) {
    provider = isTestOrDemo ? 'memory' : 'unconfigured';
  }

  if (provider === 'unconfigured' || provider === 'disabled') {
    return {
      sent: false,
      provider: 'unconfigured',
      attempts: 0,
      error: 'Provider email transazionale non configurato in produzione (impostare EMAIL_PROVIDER e credenziali).',
    };
  }

  const maxAttempts = 3;
  let lastError = 'Errore sconosciuto invio email';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (customTestAdapter) {
        const res = await customTestAdapter(message);
        const messageId = res?.messageId || `adapter-${Date.now()}-${attempt}`;
        recordOutboxMessage(message, messageId, provider);
        return { sent: true, provider, messageId, attempts: attempt };
      }

      if (provider === 'memory') {
        if (!isTestOrDemo) {
          return {
            sent: false,
            provider,
            attempts: attempt,
            error: 'Adapter email in-memory non consentito fuori da test/demo.',
          };
        }
        const messageId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        recordOutboxMessage(message, messageId, provider);
        return { sent: true, provider, messageId, attempts: attempt };
      }

      if (provider === 'resend') {
        const res = await deliverViaResend(message);
        return { sent: true, provider, messageId: res.messageId, attempts: attempt };
      }

      if (provider === 'webhook') {
        const res = await deliverViaWebhook(message);
        return { sent: true, provider, messageId: res.messageId, attempts: attempt };
      }

      return {
        sent: false,
        provider,
        attempts: attempt,
        error: `Provider email non supportato: ${provider}`,
      };
    } catch (err: any) {
      lastError = err?.message || 'Errore invio email';
      const isTransient = Boolean(err?.transient) || err?.name === 'TypeError' || /timeout|ECONNRESET|5\d\d/i.test(lastError);
      if (!isTransient || attempt === maxAttempts) {
        console.error(`[EmailService] Consegna fallita (${provider}, tentativo ${attempt}/${maxAttempts}, categoria: ${message.category || 'general'})`);
        return { sent: false, provider, attempts: attempt, error: lastError };
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
    }
  }

  return { sent: false, provider, attempts: maxAttempts, error: lastError };
}

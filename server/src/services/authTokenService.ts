import crypto from 'crypto';
import { isSupabaseConfigured, supabase } from './dbClient.js';
import { users, getCustomers, initDataStore } from './dataStore.js';

export type AuthActionPurpose = 'verify_email' | 'reset_password' | 'change_email';

export interface IssuedAuthActionToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
}

export interface ConsumedAuthActionToken {
  accountId: string;
  purpose: AuthActionPurpose;
  targetEmail?: string;
}

interface MemoryAuthToken {
  id: string;
  accountId: string;
  purpose: AuthActionPurpose;
  tokenHash: string;
  targetEmail?: string;
  expiresAtMs: number;
  consumedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

const memoryTokens: MemoryAuthToken[] = [];

export function hashActionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function tokenError(message: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

export function listAccountTokensForTest(accountId: string) {
  return memoryTokens
    .filter((t) => t.accountId === accountId)
    .map(({ ...rest }) => ({ ...rest }));
}

export function clearAuthActionTokensForTest(): void {
  memoryTokens.splice(0, memoryTokens.length);
}

export async function issueAuthActionToken(params: {
  accountId: string;
  purpose: AuthActionPurpose;
  targetEmail?: string;
  ttlMs?: number;
  revokePrevious?: boolean;
}): Promise<IssuedAuthActionToken> {
  const ttlMs = params.ttlMs ?? (params.purpose === 'reset_password' ? 3600_000 : 24 * 3600_000);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashActionToken(rawToken);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const normalizedTarget = params.targetEmail?.trim().toLowerCase();

  if (isSupabaseConfigured && supabase) {
    if (params.revokePrevious !== false) {
      const { error: revokeErr } = await supabase
        .from('auth_action_tokens')
        .update({ revoked_at: nowIso })
        .eq('account_id', params.accountId)
        .eq('purpose', params.purpose)
        .is('consumed_at', null)
        .is('revoked_at', null);
      if (revokeErr) throw revokeErr;
    }

    const { error: insertErr } = await supabase.from('auth_action_tokens').insert({
      account_id: params.accountId,
      purpose: params.purpose,
      token_hash: tokenHash,
      target_email: normalizedTarget || null,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;
    return { rawToken, tokenHash, expiresAt };
  }

  if (process.env.VOLTA_DEMO_MODE !== 'true' && process.env.NODE_ENV !== 'test') {
    throw tokenError('Archivio token non configurato.', 503);
  }

  if (params.revokePrevious !== false) {
    for (const existing of memoryTokens) {
      if (
        existing.accountId === params.accountId &&
        existing.purpose === params.purpose &&
        !existing.consumedAt &&
        !existing.revokedAt
      ) {
        existing.revokedAt = nowIso;
      }
    }
  }

  memoryTokens.push({
    id: crypto.randomUUID(),
    accountId: params.accountId,
    purpose: params.purpose,
    tokenHash,
    targetEmail: normalizedTarget,
    expiresAtMs: Date.now() + ttlMs,
    createdAt: nowIso,
  });

  return { rawToken, tokenHash, expiresAt };
}

export async function consumeAuthActionToken(params: {
  rawToken: string;
  purpose: AuthActionPurpose;
}): Promise<ConsumedAuthActionToken> {
  if (typeof params.rawToken !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(params.rawToken.trim())) {
    throw tokenError('Token non valido o scaduto.', 400);
  }
  const tokenHash = hashActionToken(params.rawToken.trim());

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('consume_auth_action_token', {
      p_token_hash: tokenHash,
      p_purpose: params.purpose,
    });
    if (error || !data) {
      throw tokenError('Token non valido, già utilizzato o scaduto.', 400);
    }
    return {
      accountId: String((data as any).accountId),
      purpose: params.purpose,
      targetEmail: (data as any).targetEmail || undefined,
    };
  }

  const record = memoryTokens.find((t) => t.tokenHash === tokenHash && t.purpose === params.purpose);
  if (!record || record.consumedAt || record.revokedAt || record.expiresAtMs <= Date.now()) {
    throw tokenError('Token non valido, già utilizzato, revocato o scaduto.', 400);
  }
  record.consumedAt = new Date().toISOString();
  return {
    accountId: record.accountId,
    purpose: record.purpose,
    targetEmail: record.targetEmail,
  };
}

export async function verifyAccountEmailWithToken(rawToken: string): Promise<{ accountId: string; email?: string }> {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(rawToken.trim())) {
    throw tokenError('Token di verifica non valido.', 400);
  }
  const tokenHash = hashActionToken(rawToken.trim());

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('complete_email_verification', { p_token_hash: tokenHash });
    if (error || !data) {
      throw tokenError('Link di verifica non valido, già utilizzato o scaduto.', 400);
    }
    await initDataStore(true);
    const updatedUser = users.find((u) => u.id === data);
    return { accountId: String(data), email: updatedUser?.email };
  }

  const consumed = await consumeAuthActionToken({ rawToken, purpose: 'verify_email' });
  const user = users.find((u) => u.id === consumed.accountId);
  if (!user) throw tokenError('Account non trovato.', 404);
  if (user.onboardingStatus !== 'suspended') {
    user.onboardingStatus = 'active';
  }
  user.emailVerified = true;
  return { accountId: user.id, email: user.email };
}

export async function resetAccountPasswordWithToken(
  rawToken: string,
  newPasswordHash: string
): Promise<{ accountId: string; email?: string; tokenVersion: number }> {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(rawToken.trim())) {
    throw tokenError('Token di recupero non valido.', 400);
  }
  const tokenHash = hashActionToken(rawToken.trim());

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('complete_password_reset', {
      p_token_hash: tokenHash,
      p_password_hash: newPasswordHash,
    });
    if (error || !data) {
      throw tokenError('Link di reset non valido, già utilizzato o scaduto.', 400);
    }
    await initDataStore(true);
    const updatedUser = users.find((u) => u.id === data);
    return {
      accountId: String(data),
      email: updatedUser?.email,
      tokenVersion: Number(updatedUser?.tokenVersion ?? 2),
    };
  }

  const consumed = await consumeAuthActionToken({ rawToken, purpose: 'reset_password' });
  const user = users.find((u) => u.id === consumed.accountId);
  if (!user) throw tokenError('Account non trovato.', 404);
  user.password = newPasswordHash;
  user.tokenVersion = Number(user.tokenVersion ?? 1) + 1;
  user.emailVerified = true;
  if (user.onboardingStatus !== 'suspended') {
    user.onboardingStatus = 'active';
  }
  return { accountId: user.id, email: user.email, tokenVersion: user.tokenVersion };
}

export async function bumpAccountTokenVersion(
  accountId: string,
  newPasswordHash?: string
): Promise<number> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('bump_account_token_version', {
      p_account_id: accountId,
      p_new_password_hash: newPasswordHash || null,
    });
    if (error || typeof data !== 'number') {
      throw tokenError('Impossibile aggiornare le sessioni dell’account.', 500);
    }
    await initDataStore(true);
    return data;
  }

  const user = users.find((u) => u.id === accountId);
  if (!user) throw tokenError('Account non trovato.', 404);
  if (newPasswordHash) {
    user.password = newPasswordHash;
  }
  user.tokenVersion = Number(user.tokenVersion ?? 1) + 1;
  return user.tokenVersion;
}

export async function confirmEmailChangeWithToken(
  rawToken: string
): Promise<{ accountId: string; customerId?: string; email: string }> {
  if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(rawToken.trim())) {
    throw tokenError('Token cambio email non valido.', 400);
  }
  const tokenHash = hashActionToken(rawToken.trim());

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('confirm_account_email_change', { p_token_hash: tokenHash });
    if (error || !data) {
      if ((error as any)?.code === '23505') {
        throw tokenError('Indirizzo email già registrato su un altro account.', 409);
      }
      throw tokenError('Token cambio email non valido, già utilizzato o scaduto.', 400);
    }
    await initDataStore(true);
    return {
      accountId: String((data as any).accountId),
      customerId: (data as any).customerId || undefined,
      email: String((data as any).email),
    };
  }

  const consumed = await consumeAuthActionToken({ rawToken, purpose: 'change_email' });
  const newEmail = (consumed.targetEmail || '').trim().toLowerCase();
  if (!newEmail) throw tokenError('Nuovo indirizzo email mancante.', 400);
  if (users.some((u) => u.id !== consumed.accountId && u.email.toLowerCase() === newEmail)) {
    throw tokenError('Indirizzo email già registrato.', 409);
  }
  const user = users.find((u) => u.id === consumed.accountId);
  if (!user) throw tokenError('Account non trovato.', 404);
  user.email = newEmail;
  user.emailVerified = true;
  user.tokenVersion = Number(user.tokenVersion ?? 1) + 1;
  if (user.customerId) {
    const customer = getCustomers().find((c) => c.id === user.customerId);
    if (customer) customer.email = newEmail;
  }
  return { accountId: user.id, customerId: user.customerId, email: newEmail };
}

export async function suspendAccountForClosure(accountId: string, reason?: string): Promise<number> {
  const closedAt = new Date().toISOString();
  if (isSupabaseConfigured && supabase) {
    const user = users.find((u) => u.id === accountId);
    if (!user) throw tokenError('Account non trovato.', 404);
    const nextVersion = Number(user.tokenVersion ?? 1) + 1;
    const { data: currentRow, error: fetchErr } = await supabase
      .from('crm_accounts')
      .select('profile')
      .eq('id', accountId)
      .single();
    if (fetchErr) throw fetchErr;
    const updatedProfile = {
      ...((currentRow?.profile as Record<string, unknown>) || {}),
      onboardingStatus: 'suspended',
      tokenVersion: nextVersion,
      closureRequestedAt: closedAt,
      closureReason: reason || 'Richiesta chiusura account da portale cliente',
    };
    const { error: updErr } = await supabase
      .from('crm_accounts')
      .update({ token_version: nextVersion, profile: updatedProfile })
      .eq('id', accountId);
    if (updErr) throw updErr;
    await initDataStore(true);
    return nextVersion;
  }

  const user = users.find((u) => u.id === accountId);
  if (!user) throw tokenError('Account non trovato.', 404);
  user.onboardingStatus = 'suspended';
  user.closureRequestedAt = closedAt;
  user.closureReason = reason || 'Richiesta chiusura account da portale cliente';
  user.tokenVersion = Number(user.tokenVersion ?? 1) + 1;
  return user.tokenVersion;
}

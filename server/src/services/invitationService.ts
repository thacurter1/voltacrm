import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Customer } from '../types.js';
import { registerAccount, users, initDataStore } from './dataStore.js';
import { isSupabaseConfigured, supabase } from './dbClient.js';
import { generateTotpSecret, verifyTotp } from '../utils/totp.js';

export type InvitationRole = 'customer' | 'admin' | 'call_center';

export interface InvitationInput {
  role: InvitationRole;
  name: string;
  email: string;
  phone: string;
  fiscalCode?: string;
  city?: string;
}

interface PendingAccount {
  id: string;
  email: string;
  role: InvitationRole;
  profile: Record<string, unknown>;
}

function invitationError(): Error & { status: number } {
  return Object.assign(new Error('Invito non valido o scaduto.'), { status: 404 });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function findPendingAccount(token: string): Promise<PendingAccount> {
  if (!isSupabaseConfigured || !supabase || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invitationError();
  const { data, error } = await supabase.from('crm_accounts')
    .select('id,email,role,profile')
    .contains('profile', { inviteTokenHash: hashToken(token) })
    .maybeSingle();
  if (error) throw error;
  const expiresAt = typeof data?.profile?.inviteExpiresAt === 'string'
    ? Date.parse(data.profile.inviteExpiresAt) : NaN;
  if (!data || data.profile?.onboardingStatus !== 'invited' ||
      !Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw invitationError();
  return data as PendingAccount;
}

export async function createAccountInvitation(actor: { id: string; name: string }, input: InvitationInput) {
  if (!isSupabaseConfigured || !supabase) throw Object.assign(new Error('Database non configurato.'), { status: 503 });
  const email = input.email.trim().toLowerCase();
  if (users.some(user => user.email.toLowerCase() === email)) {
    throw Object.assign(new Error('Email già registrata.'), { status: 409 });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const today = new Date();
  const expiresAt = new Date(today.getTime() + 7 * 86400000).toISOString();
  const id = crypto.randomUUID();
  const customerId = input.role === 'customer' ? crypto.randomUUID() : undefined;
  const totpSecret = input.role === 'customer' ? undefined : generateTotpSecret();
  const profile = {
    id, name: input.name.trim(), email, phone: input.phone.trim(), role: input.role,
    fiscalCode: input.fiscalCode?.trim().toUpperCase(), customerId,
    assignedBrokerId: customerId ? actor.id : undefined,
    assignedBrokerName: customerId ? actor.name : undefined,
    avatar: input.name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    is2faEnabled: false, onboardingStatus: 'invited', createdAt: today.toISOString().slice(0, 10),
    inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt,
    inviteTotpSecret: totpSecret,
    password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
  };

  if (customerId) {
    const customer: Customer = {
      id: customerId, name: profile.name, email, phone: profile.phone,
      fiscalCode: profile.fiscalCode || '', city: input.city?.trim() || '',
      utilityPoints: [], contractStartDate: today.toISOString().slice(0, 10),
      lastSwitchAuditDate: today.toISOString().slice(0, 10),
      nextSwitchAuditDate: new Date(today.getTime() + 120 * 86400000).toISOString().slice(0, 10),
      hasBrokerageMandate: false, accountManager: actor.name, assignedBrokerId: actor.id,
    };
    await registerAccount(profile, customer);
    return { token, expiresAt, profile: publicInvitationProfile(profile), customer };
  }

  const { error } = await supabase.from('crm_accounts').insert({
    id, email, password_hash: profile.password, role: input.role,
    is_2fa_enabled: false, profile: publicDatabaseProfile(profile),
  });
  if (error) {
    if (error.code === '23505') throw Object.assign(new Error('Email già registrata.'), { status: 409 });
    throw error;
  }
  await initDataStore(true);
  return { token, expiresAt, profile: publicInvitationProfile(profile) };
}

function publicDatabaseProfile(profile: Record<string, unknown>) {
  const { password: _password, ...rest } = profile;
  return rest;
}

function publicInvitationProfile(profile: Record<string, unknown>) {
  const { password: _password, inviteTokenHash: _hash, inviteExpiresAt: _expires,
    inviteTotpSecret: _totp, ...rest } = profile;
  return rest;
}

export async function inspectAccountInvitation(token: string) {
  const account = await findPendingAccount(token);
  return {
    name: String(account.profile.name || ''), email: account.email, role: account.role,
    expiresAt: account.profile.inviteExpiresAt,
    totpSecret: account.role === 'customer' ? undefined : String(account.profile.inviteTotpSecret || '').replace(/^b32:/, ''),
  };
}

export async function renewAccountInvitation(accountId: string) {
  if (!isSupabaseConfigured || !supabase) throw Object.assign(new Error('Database non configurato.'), { status: 503 });
  const { data, error } = await supabase.from('crm_accounts')
    .select('id,email,role,profile').eq('id', accountId).maybeSingle();
  if (error) throw error;
  if (!data || data.profile?.onboardingStatus !== 'invited') throw invitationError();
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const { data: updated, error: updateError } = await supabase.from('crm_accounts').update({
    profile: { ...data.profile, inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt },
  }).eq('id', accountId).select('id').maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw invitationError();
  await initDataStore(true);
  return { token, expiresAt, profile: publicInvitationProfile(data.profile) };
}

export async function acceptAccountInvitation(token: string, password: string, totpCode?: string) {
  const account = await findPendingAccount(token);
  const totpSecret = account.role === 'customer' ? null : String(account.profile.inviteTotpSecret || '');
  if (totpSecret && !verifyTotp(totpCode || '', totpSecret)) {
    throw Object.assign(new Error('Codice Authenticator non valido.'), { status: 400 });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const { data, error } = await supabase!.rpc('accept_crm_invitation', {
    p_token_hash: hashToken(token), p_password_hash: passwordHash, p_totp_secret: totpSecret,
  });
  if (error || data !== account.id) throw invitationError();
  await initDataStore(true);
  return { email: account.email, role: account.role };
}

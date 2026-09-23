import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface VerifiedOAuthClaims {
  provider: 'google' | 'apple';
  email: string;
  name?: string;
  picture?: string;
  sub: string;
}

interface JwksKey {
  kty: string;
  kid: string;
  use?: string;
  n: string;
  e: string;
  alg?: string;
}

interface JwksResponse {
  keys: JwksKey[];
}

// Cache in memoria per le chiavi pubbliche JWKS di Google e Apple (TTL 1 ora)
const jwksCache: Record<string, { keys: JwksKey[]; fetchedAt: number }> = {};
const CACHE_TTL_MS = 60 * 60 * 1000;

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

const GOOGLE_ISSUERS: [string, ...string[]] = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_ISSUERS: [string, ...string[]] = ['https://appleid.apple.com'];

export const OAUTH_TEST_SECRET = process.env.OAUTH_TEST_SECRET || process.env.JWT_SECRET || 'oauth-test-secret-at-least-32-characters-long';

async function fetchJwks(url: string): Promise<JwksKey[]> {
  const cached = jwksCache[url];
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) {
    throw new Error(`Impossibile recuperare JWKS da ${url}: HTTP ${response.status}`);
  }

  const data = (await response.json()) as JwksResponse;
  if (!data || !Array.isArray(data.keys)) {
    throw new Error(`Risposta JWKS non valida da ${url}`);
  }

  jwksCache[url] = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function jwkToPem(jwk: JwksKey): string {
  const publicKey = crypto.createPublicKey({
    key: jwk as any,
    format: 'jwk'
  });
  return publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

/**
 * Verifica crittograficamente un token OAuth (Google / Apple).
 * In produzione: valida firma RS256 con JWKS ufficiale, scadenza ed emittente.
 * In test (NODE_ENV === 'test'): valida firma crittografica con chiave simmetrica/asimmetrica di test.
 * Rifiuta categoricamente token forgiati, privi di firma o non validi.
 */
export async function verifyOAuthToken(provider: 'google' | 'apple', idToken: string): Promise<VerifiedOAuthClaims> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('idToken non fornito o non valido.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato idToken OAuth non valido: atteso JWT a 3 parti.');
  }

  let header: { kid?: string; alg?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Header JWT OAuth malformato.');
  }

  // Ambiente di TEST: verifica crittografica con chiave di test dedicata
  if (process.env.NODE_ENV === 'test') {
    let payload: any;
    try {
      // Supporta verifica HMAC con OAUTH_TEST_SECRET
      payload = jwt.verify(idToken, OAUTH_TEST_SECRET, { algorithms: ['HS256', 'HS384', 'HS512'] });
    } catch (testVerifyErr: any) {
      // Se non passa con la chiave simmetrica di test, lancia errore di autenticazione
      throw new Error(`Verifica crittografica idToken fallita (test): ${testVerifyErr.message}`);
    }

    if (!payload || typeof payload !== 'object' || !payload.email || typeof payload.email !== 'string') {
      throw new Error('Token OAuth privo di campo email valido nei claim.');
    }

    return {
      provider,
      email: payload.email.trim().toLowerCase(),
      name: payload.name?.trim(),
      picture: payload.picture || payload.avatar,
      sub: payload.sub || payload.email
    };
  }

  // Runtime di Produzione / Staging: verifica crittografica RS256 tramite JWKS ufficiali
  const jwksUrl = provider === 'google' ? GOOGLE_JWKS_URL : APPLE_JWKS_URL;
  const validIssuers = provider === 'google' ? GOOGLE_ISSUERS : APPLE_ISSUERS;

  const keys = await fetchJwks(jwksUrl);
  const matchedKey = keys.find(k => k.kid === header.kid);
  if (!matchedKey) {
    throw new Error(`Chiave pubblica con kid "${header.kid}" non trovata nel JWKS di ${provider}.`);
  }

  const pem = jwkToPem(matchedKey);
  let payload: any;
  try {
    payload = jwt.verify(idToken, pem, {
      algorithms: ['RS256'],
      issuer: validIssuers
    });
  } catch (verifyErr: any) {
    throw new Error(`Firma o claim idToken ${provider} non validi: ${verifyErr.message}`);
  }

  if (!payload || typeof payload !== 'object' || !payload.email || typeof payload.email !== 'string') {
    throw new Error(`Il token ${provider} non contiene un indirizzo email verificato.`);
  }

  return {
    provider,
    email: payload.email.trim().toLowerCase(),
    name: (payload.name || (provider === 'google' ? 'Utente Google' : 'Utente Apple')).trim(),
    picture: payload.picture,
    sub: payload.sub || payload.email
  };
}

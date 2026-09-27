const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local')
);

function resolveApiBaseUrl(): string | null {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) {
    if (!isLocalhost && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) return null;
    return envUrl.trim();
  }
  return isLocalhost ? 'http://localhost:5000/api' : null;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
export const isStandaloneDemo = DEMO_MODE;

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error('Servizio non configurato. Contatta un amministratore.');
  const token = typeof window !== 'undefined' ? localStorage.getItem('VOLTA_AUTH_TOKEN') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Errore HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const message = (error as Error)?.message || '';
  return ['fetch', 'Failed to fetch', 'NetworkError', 'ECONNREFUSED'].some(part => message.includes(part));
}

export interface ApiConfigurationStatus {
  isConfigured: boolean;
  isCloudEnvironment: boolean;
  apiBaseUrl: string | null;
  statusMessage?: string;
}

export function evaluateApiConfiguration(hostname?: string, envApiUrl?: string): ApiConfigurationStatus {
  const currentHostname = hostname !== undefined 
    ? hostname 
    : (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
    
  const isLocal = currentHostname === 'localhost' || 
                  currentHostname === '127.0.0.1' || 
                  currentHostname.endsWith('.local');

  const rawEnv = envApiUrl !== undefined 
    ? envApiUrl 
    : (typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_API_URL : '');
  const envUrl = typeof rawEnv === 'string' ? rawEnv.trim() : '';

  if (envUrl) {
    if (!isLocal && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return {
        isConfigured: false,
        isCloudEnvironment: true,
        apiBaseUrl: null,
        statusMessage: 'Ambiente cloud rilevato ma VITE_API_URL punta a localhost. Configurare l\'URL del backend nelle impostazioni di deployment (es. Vercel).'
      };
    }
    return {
      isConfigured: true,
      isCloudEnvironment: !isLocal,
      apiBaseUrl: envUrl,
    };
  }

  if (isLocal) {
    return {
      isConfigured: true,
      isCloudEnvironment: false,
      apiBaseUrl: 'http://localhost:5000/api',
    };
  }

  return {
    isConfigured: false,
    isCloudEnvironment: true,
    apiBaseUrl: null,
    statusMessage: 'Backend non configurato. Impostare la variabile d\'ambiente VITE_API_URL.'
  };
}

export const apiConfigStatus = evaluateApiConfiguration();
export const API_BASE_URL = apiConfigStatus.apiBaseUrl;
export const DEMO_MODE = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DEMO_MODE === 'true';
export const isStandaloneDemo = DEMO_MODE;

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error(apiConfigStatus.statusMessage || 'Servizio non configurato. Contatta un amministratore.');
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

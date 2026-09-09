import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

/**
 * Esegue un ping reale verso Supabase per verificare lo stato della connessione PostgreSQL
 */
export async function testDatabaseConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { connected: false, error: 'Variabili SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non configurate (attiva modalita in-memory)' };
  }

  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const latencyMs = Date.now() - start;
    if (error && error.code !== 'PGRST116') {
      return { connected: false, latencyMs, error: error.message };
    }
    return { connected: true, latencyMs };
  } catch (err: any) {
    return { connected: false, latencyMs: Date.now() - start, error: err.message };
  }
}

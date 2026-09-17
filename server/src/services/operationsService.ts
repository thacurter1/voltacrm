import { isSupabaseConfigured, supabase } from './dbClient.js';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentType = 'phone_consultation' | 'field_visit' | 'video_call';

export interface AppointmentRecord {
  id: string;
  leadId: string;
  customerName: string;
  phone: string;
  city: string;
  agentName: string;
  scheduledAt: string;
  durationMinutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string;
}

export interface SecurityLogRecord {
  id: string;
  timestamp: string;
  eventType: string;
  userEmail: string;
  ipAddress: string;
  status: 'safe' | 'warning' | 'critical';
  details: string;
}

export type NewSecurityLog = Omit<SecurityLogRecord, 'id' | 'timestamp'>;

const demoAppointments: AppointmentRecord[] = [];
const demoSecurityLogs: SecurityLogRecord[] = [];

function requireBackend() {
  if (isSupabaseConfigured && supabase) return supabase;
  if (process.env.VOLTA_DEMO_MODE === 'true') return null;
  throw Object.assign(new Error('Archivio operativo non configurato.'), { status: 503 });
}

function mapAppointment(row: any): AppointmentRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    customerName: row.customer_name,
    phone: row.phone,
    city: row.city,
    agentName: row.agent_name,
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes),
    type: row.type,
    status: row.status,
    notes: row.notes || '',
  };
}

function mapSecurityLog(row: any): SecurityLogRecord {
  return {
    id: row.id,
    timestamp: row.created_at,
    eventType: row.event_type,
    userEmail: row.user_email,
    ipAddress: row.ip_address,
    status: row.status,
    details: row.details,
  };
}

export async function listAppointments(): Promise<AppointmentRecord[]> {
  const db = requireBackend();
  if (!db) return [...demoAppointments].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const { data, error } = await db.from('crm_appointments').select('*').order('scheduled_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function saveAppointment(input: AppointmentRecord): Promise<AppointmentRecord> {
  const db = requireBackend();
  if (!db) {
    const index = demoAppointments.findIndex(item => item.id === input.id);
    if (index >= 0) demoAppointments[index] = { ...input };
    else demoAppointments.unshift({ ...input });
    return { ...input };
  }
  const row = {
    id: input.id, lead_id: input.leadId, customer_name: input.customerName, phone: input.phone,
    city: input.city, agent_name: input.agentName, scheduled_at: input.scheduledAt,
    duration_minutes: input.durationMinutes, type: input.type, status: input.status, notes: input.notes,
  };
  const { data, error } = await db.from('crm_appointments').upsert(row).select('*').single();
  if (error) throw error;
  return mapAppointment(data);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<AppointmentRecord> {
  const db = requireBackend();
  if (!db) {
    const item = demoAppointments.find(entry => entry.id === id);
    if (!item) throw Object.assign(new Error('Appuntamento non trovato.'), { status: 404 });
    item.status = status;
    return { ...item };
  }
  const { data, error } = await db.from('crm_appointments').update({ status }).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Appuntamento non trovato.'), { status: 404 });
  return mapAppointment(data);
}

export async function listSecurityLogs(): Promise<SecurityLogRecord[]> {
  const db = requireBackend();
  if (!db) return [...demoSecurityLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const { data, error } = await db.from('security_logs').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return (data || []).map(mapSecurityLog);
}

export async function addSecurityLog(input: NewSecurityLog): Promise<SecurityLogRecord> {
  const db = requireBackend();
  if (!db) {
    const record = { ...input, id: `sec-${crypto.randomUUID()}`, timestamp: new Date().toISOString() };
    demoSecurityLogs.unshift(record);
    return record;
  }
  const { data, error } = await db.from('security_logs').insert({
    event_type: input.eventType, user_email: input.userEmail, ip_address: input.ipAddress,
    status: input.status, details: input.details,
  }).select('*').single();
  if (error) throw error;
  return mapSecurityLog(data);
}

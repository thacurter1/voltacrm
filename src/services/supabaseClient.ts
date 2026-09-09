import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../types';

// Credenziali lette dalle variabili d'ambiente (configurabili su Vercel e in locale)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co'
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Storage key per i profili salvati in locale / offline-first
const PROFILES_STORAGE_KEY = 'VOLTA_CRM_PROFILES_V1';

export const INITIAL_PROFILES: UserProfile[] = [
  {
    id: 'user-admin-1',
    name: 'Matteo Riva (Broker Owner)',
    email: 'm.riva@voltagroup.it',
    role: 'admin',
    phone: '+39 347 1122334',
    whatsapp: '+393471122334',
    avatar: 'MR',
    is2faEnabled: true,
    onboardingStatus: 'active',
    createdAt: '2026-01-15'
  },
  {
    id: 'user-op-2',
    name: 'Chiara Bianchi (Consulente Senior)',
    email: 'c.bianchi@voltagroup.it',
    role: 'call_center',
    phone: '+39 338 5566778',
    whatsapp: '+393385566778',
    avatar: 'CB',
    is2faEnabled: true,
    onboardingStatus: 'active',
    createdAt: '2026-02-10'
  },
  {
    id: 'user-cust-1',
    name: 'Andrea Moretti',
    email: 'andrea.moretti@email.it',
    role: 'customer',
    phone: '+39 340 1234567',
    whatsapp: '+393401234567',
    fiscalCode: 'MRTNDR85M01H501Z',
    customerId: 'cust-1',
    assignedBrokerId: 'user-admin-1',
    assignedBrokerName: 'Matteo Riva',
    avatar: 'AM',
    is2faEnabled: false,
    onboardingStatus: 'active',
    createdAt: '2026-03-01'
  },
  {
    id: 'user-cust-2',
    name: 'Ristorante La Terrazza Srl',
    email: 'amministrazione@laterrazzaroma.it',
    role: 'customer',
    phone: '+39 06 6988231',
    whatsapp: '+393339988776',
    fiscalCode: '08945621008',
    customerId: 'cust-2',
    assignedBrokerId: 'user-op-2',
    assignedBrokerName: 'Chiara Bianchi',
    avatar: 'LT',
    is2faEnabled: true,
    onboardingStatus: 'active',
    createdAt: '2026-03-12'
  }
];

class ProfileService {
  private getLocalProfiles(): UserProfile[] {
    try {
      const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(INITIAL_PROFILES));
        return INITIAL_PROFILES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_PROFILES;
    }
  }

  private saveLocalProfiles(profiles: UserProfile[]) {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error('Error saving profiles:', e);
    }
  }

  // Lista tutti i profili
  async getProfiles(): Promise<UserProfile[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data) {
        return data.map(p => ({
          id: p.id,
          name: p.full_name,
          email: p.email,
          role: p.role,
          phone: p.phone,
          whatsapp: p.whatsapp,
          fiscalCode: p.fiscal_code,
          assignedBrokerId: p.assigned_broker_id,
          avatar: p.avatar_initials,
          onboardingStatus: 'active',
          createdAt: p.created_at?.split('T')[0]
        }));
      }
    }
    return this.getLocalProfiles();
  }

  // Crea o registra nuovo Operatore / Consulente
  async createOperatorProfile(operator: {
    name: string;
    email: string;
    role: 'admin' | 'call_center';
    phone: string;
    whatsapp: string;
  }): Promise<UserProfile> {
    const initials = operator.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const newProfile: UserProfile = {
      id: `user-op-${Date.now()}`,
      name: operator.name,
      email: operator.email,
      role: operator.role,
      phone: operator.phone,
      whatsapp: operator.whatsapp,
      avatar: initials,
      is2faEnabled: true,
      onboardingStatus: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').insert({
        email: operator.email,
        full_name: operator.name,
        role: operator.role,
        phone: operator.phone,
        whatsapp: operator.whatsapp,
        avatar_initials: initials
      });
    }

    const current = this.getLocalProfiles();
    const updated = [newProfile, ...current];
    this.saveLocalProfiles(updated);
    return newProfile;
  }

  // Crea Profilo Cliente con Invito Onboarding da Call Center
  async createCustomerProfileAndInvite(params: {
    name: string;
    email: string;
    phone: string;
    fiscalCode: string;
    assignedBrokerId: string;
    assignedBrokerName: string;
  }): Promise<{ profile: UserProfile; inviteLink: string; whatsappShareUrl: string }> {
    const initials = params.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const customerId = `cust-${Date.now()}`;
    const newProfile: UserProfile = {
      id: `user-${customerId}`,
      name: params.name,
      email: params.email,
      role: 'customer',
      phone: params.phone,
      whatsapp: params.phone.replace(/[^0-9+]/g, ''),
      fiscalCode: params.fiscalCode.toUpperCase(),
      customerId,
      assignedBrokerId: params.assignedBrokerId,
      assignedBrokerName: params.assignedBrokerName,
      avatar: initials,
      is2faEnabled: false,
      onboardingStatus: 'invited',
      createdAt: new Date().toISOString().split('T')[0]
    };

    const current = this.getLocalProfiles();
    this.saveLocalProfiles([newProfile, ...current]);

    // Generazione Link Univoco di Onboarding / Attivazione
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}?invite=${newProfile.id}&portal=customer&email=${encodeURIComponent(params.email)}`;
    
    // Messaggio precompilato WhatsApp per il cliente
    const rawMessage = `Ciao ${params.name}! Sono ${params.assignedBrokerName}, il tuo consulente energetico Volta. Abbiamo creato la tua Area Risparmio dedicata per monitorare le tue bollette e il controllo quadrimestrale dei costi: ${inviteLink}`;
    const whatsappClean = params.phone.replace(/[^0-9]/g, '');
    const whatsappShareUrl = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(rawMessage)}`;

    return {
      profile: newProfile,
      inviteLink,
      whatsappShareUrl
    };
  }

  // Registrazione autonoma del Cliente (Self-Service)
  async registerCustomerSelfService(params: {
    name: string;
    email: string;
    phone: string;
    fiscalCode: string;
  }): Promise<UserProfile> {
    const initials = params.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const customerId = `cust-${Date.now()}`;
    const newProfile: UserProfile = {
      id: `user-${customerId}`,
      name: params.name,
      email: params.email,
      role: 'customer',
      phone: params.phone,
      whatsapp: params.phone.replace(/[^0-9+]/g, ''),
      fiscalCode: params.fiscalCode.toUpperCase(),
      customerId,
      assignedBrokerId: 'user-admin-1',
      assignedBrokerName: 'Matteo Riva (Broker Volta)',
      avatar: initials,
      is2faEnabled: false,
      onboardingStatus: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };

    const current = this.getLocalProfiles();
    this.saveLocalProfiles([newProfile, ...current]);
    return newProfile;
  }

  // Aggiorna profilo utente (es. cambio telefono, consulente assegnato)
  async updateProfile(id: string, updates: Partial<UserProfile>): Promise<UserProfile[]> {
    const current = this.getLocalProfiles();
    const updated = current.map(p => p.id === id ? { ...p, ...updates } : p);
    this.saveLocalProfiles(updated);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('profiles').update({
        phone: updates.phone,
        whatsapp: updates.whatsapp,
        full_name: updates.name,
        fiscal_code: updates.fiscalCode
      }).eq('id', id);
    }

    return updated;
  }
}

export const profileService = new ProfileService();

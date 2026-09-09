import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Send, 
  Copy, 
  Check, 
  Phone, 
  Sparkles, 
  Building2, 
  MessageSquare, 
  X, 
  UserCheck 
} from 'lucide-react';
import { UserProfile, Customer } from '../types';
import { profileService } from '../services/supabaseClient';

interface TeamProfilesManagerProps {
  currentUser: UserProfile;
  profiles: UserProfile[];
  customers: Customer[];
  onProfilesUpdated: (updated: UserProfile[]) => void;
  onCustomerCreated?: (customer: Customer) => void;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const TeamProfilesManager: React.FC<TeamProfilesManagerProps> = ({
  currentUser,
  profiles,
  customers,
  onProfilesUpdated,
  onCustomerCreated,
  onToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'operators' | 'customers'>('operators');
  const [isAddOperatorOpen, setIsAddOperatorOpen] = useState(false);
  const [isInviteCustomerOpen, setIsInviteCustomerOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State: Nuovo Operatore
  const [newOpName, setNewOpName] = useState('');
  const [newOpEmail, setNewOpEmail] = useState('');
  const [newOpPhone, setNewOpPhone] = useState('');
  const [newOpRole, setNewOpRole] = useState<'admin' | 'call_center'>('call_center');

  // Form State: Invito Cliente
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteFiscalCode, setInviteFiscalCode] = useState('');
  const [inviteCity, setInviteCity] = useState('Milano');
  const [generatedInvite, setGeneratedInvite] = useState<{
    link: string;
    whatsappUrl: string;
    clientName: string;
  } | null>(null);

  const operators = profiles.filter(p => p.role === 'admin' || p.role === 'call_center');
  const customerProfiles = profiles.filter(p => p.role === 'customer');

  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onToast('Link Copiato!', 'Il link di onboarding è pronto da incollare o inviare.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpName || !newOpEmail) return;

    try {
      const created = await profileService.createOperatorProfile({
        name: newOpName,
        email: newOpEmail,
        phone: newOpPhone || '+39 333 0000000',
        whatsapp: newOpPhone || '+393330000000',
        role: newOpRole,
      });

      const updated = await profileService.getProfiles();
      onProfilesUpdated(updated);
      setIsAddOperatorOpen(false);
      setNewOpName('');
      setNewOpEmail('');
      setNewOpPhone('');
      onToast('Operatore Aggiunto', `Profilo per ${created.name} creato con successo. Accesso 2FA abilitato.`, 'success');
    } catch {
      onToast('Errore', 'Impossibile creare il profilo operatore.', 'warning');
    }
  };

  const handleCreateCustomerInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail || !invitePhone) return;

    try {
      const result = await profileService.createCustomerProfileAndInvite({
        name: inviteName,
        email: inviteEmail,
        phone: invitePhone,
        fiscalCode: inviteFiscalCode || 'CF' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        assignedBrokerId: currentUser.id,
        assignedBrokerName: currentUser.name,
      });

      // Se richiesto, crea anche il record cliente in anagrafica
      if (onCustomerCreated) {
        const today = new Date().toISOString().split('T')[0];
        const nextAudit = new Date();
        nextAudit.setDate(nextAudit.getDate() + 120);

        const newCust: Customer = {
          id: result.profile.customerId || `cust-${Date.now()}`,
          name: inviteName,
          email: inviteEmail,
          phone: invitePhone,
          fiscalCode: inviteFiscalCode || 'CF' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          city: inviteCity,
          contractStartDate: today,
          lastSwitchAuditDate: today,
          nextSwitchAuditDate: nextAudit.toISOString().split('T')[0],
          accountManager: currentUser.name,
          hasBrokerageMandate: true,
          utilityPoints: [
            {
              id: `util-${Date.now()}-luce`,
              type: 'luce',
              podOrPdr: `IT001E${Math.floor(10000000 + Math.random() * 90000000)}`,
              annualConsumption: 2800,
              currentSupplier: 'Fornitore Precedente',
              currentOfferName: 'Offerta Base',
              currentTariffType: 'indexed',
              currentUnitCost: 0.145,
              currentFixedFeeYear: 120.0,
            }
          ]
        };
        onCustomerCreated(newCust);
      }

      const updated = await profileService.getProfiles();
      onProfilesUpdated(updated);
      setGeneratedInvite({
        link: result.inviteLink,
        whatsappUrl: result.whatsappShareUrl,
        clientName: inviteName,
      });
      onToast('Profilo Cliente Creato', `Link di onboarding generato per ${inviteName}.`, 'success');
    } catch {
      onToast('Errore', 'Impossibile generare il profilo cliente.', 'warning');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#e3e8ee] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-[#635bff]">
              <Users className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-[#0a2540]">Gestione Team & Profili Accessi</h1>
          </div>
          <p className="text-xs text-[#425466]">
            Configura gli operatori del call center, assegna i consulenti energetici e gestisci gli inviti di accesso al portale cliente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddOperatorOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a2540] text-white text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Nuovo Operatore
          </button>
          <button
            onClick={() => setIsInviteCustomerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#635bff] text-white text-xs font-semibold hover:bg-[#534be0] transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Crea Profilo Cliente & Invita
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e3e8ee] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#425466] mb-2 font-medium">
            <span>Operatori & Broker</span>
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-[#0a2540]">{operators.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Tutti con 2FA TOTP abilitato</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e3e8ee] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#425466] mb-2 font-medium">
            <span>Profili Clienti Attivi</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {customerProfiles.filter(c => c.onboardingStatus === 'active').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Con credenziali e accesso garantito</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e3e8ee] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#425466] mb-2 font-medium">
            <span>Inviti In Attesa Onboarding</span>
            <MessageSquare className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {customerProfiles.filter(c => c.onboardingStatus === 'invited').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Link WhatsApp inviato da completare</p>
        </div>
      </div>

      {/* Sub-tabs: Operatori vs Clienti */}
      <div className="flex border-b border-[#e3e8ee] gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('operators')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'operators'
              ? 'text-[#635bff] border-b-2 border-[#635bff]'
              : 'text-[#425466] hover:text-[#0a2540]'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Operatori & Commerciali ({operators.length})
        </button>
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`pb-3 transition-colors cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'customers'
              ? 'text-[#635bff] border-b-2 border-[#635bff]'
              : 'text-[#425466] hover:text-[#0a2540]'
          }`}
        >
          <Users className="h-4 w-4" />
          Profili Clienti & Accessi Portale ({customerProfiles.length})
        </button>
      </div>

      {/* TAB 1: OPERATORI */}
      {activeSubTab === 'operators' && (
        <div className="bg-white rounded-2xl border border-[#e3e8ee] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f6f9fc] border-b border-[#e3e8ee] text-[#425466] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Consulente / Operatore</th>
                  <th className="py-3 px-4">Ruolo</th>
                  <th className="py-3 px-4">Contatto WhatsApp</th>
                  <th className="py-3 px-4">Sicurezza 2FA</th>
                  <th className="py-3 px-4">Data Creazione</th>
                  <th className="py-3 px-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e8ee]">
                {operators.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#635bff]/10 text-[#635bff] font-bold flex items-center justify-center text-xs">
                          {op.avatar || op.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#0a2540]">{op.name}</div>
                          <div className="text-[11px] text-[#425466]">{op.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        op.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-indigo-100 text-[#635bff]'
                      }`}>
                        {op.role === 'admin' ? 'Super Admin' : 'Consulente Call Center'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#425466]">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>{op.phone || '+39 333 0000000'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" /> TOTP RFC 6238
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {op.createdAt || '2026-02-01'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <a
                        href={`https://wa.me/${op.whatsapp?.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0a2540] font-medium text-[11px] transition-colors"
                      >
                        <MessageSquare className="h-3 w-3 text-emerald-600" /> WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILI CLIENTI & INVITI */}
      {activeSubTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-[#e3e8ee] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#e3e8ee] flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-[#425466]">
              I clienti possono accedere al loro cruscotto personale tramite email o codice fiscale.
            </span>
            <button
              onClick={() => setIsInviteCustomerOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#635bff] text-white text-xs font-semibold hover:bg-[#534be0] transition-colors cursor-pointer"
            >
              + Genera Nuovo Invito
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f6f9fc] border-b border-[#e3e8ee] text-[#425466] uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Cliente / Intestatario</th>
                  <th className="py-3 px-4">Codice Fiscale / P.IVA</th>
                  <th className="py-3 px-4">Consulente Assegnato</th>
                  <th className="py-3 px-4">Stato Accesso Portale</th>
                  <th className="py-3 px-4 text-right">Invito Onboarding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3e8ee]">
                {customerProfiles.map((cust) => {
                  const inviteLink = `${window.location.origin}?invite=${cust.id}&portal=customer`;
                  const rawMsg = `Ciao ${cust.name}, ecco il tuo accesso sicuro all'Area Risparmio VoltaCRM per le tue forniture: ${inviteLink}`;
                  const waUrl = `https://wa.me/${cust.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(rawMsg)}`;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0a2540]">{cust.name}</div>
                        <div className="text-[11px] text-[#425466] flex items-center gap-2 mt-0.5">
                          <span>{cust.email}</span>
                          <span>•</span>
                          <span>{cust.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                        {cust.fiscalCode || 'NON SPECIFICATO'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[#0a2540] text-[11px] font-medium">
                          <UserCheck className="h-3 w-3 text-[#635bff]" />
                          {cust.assignedBrokerName || 'Matteo Riva'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {cust.onboardingStatus === 'active' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="h-3 w-3" /> Portale Attivo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Invito Inviato (In attesa)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopyLink(inviteLink, cust.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#e3e8ee] hover:bg-slate-100 text-[#0a2540] font-medium text-[11px] cursor-pointer transition-colors"
                          >
                            {copiedId === cust.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            {copiedId === cust.id ? 'Copiato' : 'Copia Link'}
                          </button>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] transition-colors"
                          >
                            <Send className="h-3 w-3" /> Invia WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: AGGIUNGI OPERATORE */}
      {isAddOperatorOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div onClick={() => setIsAddOperatorOpen(false)} className="fixed inset-0 bg-[#0a2540]/50 backdrop-blur-xs" />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#e3e8ee] shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#635bff] text-white">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0a2540]">Nuovo Account Operatore / Consulente</h3>
              </div>
              <button onClick={() => setIsAddOperatorOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOperator} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Nome e Cognome</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Marco Rossi"
                  value={newOpName}
                  onChange={e => setNewOpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Email Aziendale</label>
                <input
                  type="email"
                  required
                  placeholder="m.rossi@voltagroup.it"
                  value={newOpEmail}
                  onChange={e => setNewOpEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Cellulare / WhatsApp Dedicato</label>
                <input
                  type="tel"
                  placeholder="+39 340 9988776"
                  value={newOpPhone}
                  onChange={e => setNewOpPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">Questo numero apparirà nella card "Il tuo Consulente Dedicato" dei clienti assegnati.</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Livello di Accesso</label>
                <select
                  value={newOpRole}
                  onChange={e => setNewOpRole(e.target.value as 'admin' | 'call_center')}
                  className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden bg-white"
                >
                  <option value="call_center">Consulente Call Center / Commerciale</option>
                  <option value="admin">Super Admin / Amministratore Agenzia</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOperatorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#e3e8ee] text-[#425466] font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#635bff] text-white font-semibold hover:bg-[#534be0] cursor-pointer shadow-xs"
                >
                  Crea Profilo Operatore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREA PROFILO CLIENTE & INVITA */}
      {isInviteCustomerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div onClick={() => { setIsInviteCustomerOpen(false); setGeneratedInvite(null); }} className="fixed inset-0 bg-[#0a2540]/50 backdrop-blur-xs" />
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[#e3e8ee] shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#e3e8ee] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-[#0a2540]">Crea Profilo Cliente & Invia Invito</h3>
              </div>
              <button onClick={() => { setIsInviteCustomerOpen(false); setGeneratedInvite(null); }} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!generatedInvite ? (
              <form onSubmit={handleCreateCustomerInvite} className="space-y-3.5">
                <p className="text-[#425466]">
                  Inserisci i dati del cliente acquisito telefonicamente per generare istantaneamente il suo link di accesso all'Area Personale Volta.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Nome e Cognome / Ragione Sociale</label>
                    <input
                      type="text"
                      required
                      placeholder="Es. Mario Rossi"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Codice Fiscale / P.IVA</label>
                    <input
                      type="text"
                      placeholder="RSSMRA80A01H501U"
                      value={inviteFiscalCode}
                      onChange={e => setInviteFiscalCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Email del Cliente</label>
                    <input
                      type="email"
                      required
                      placeholder="mario.rossi@email.it"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Cellulare (per WhatsApp)</label>
                    <input
                      type="tel"
                      required
                      placeholder="+39 349 1234567"
                      value={invitePhone}
                      onChange={e => setInvitePhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Città di Fornitura</label>
                  <input
                    type="text"
                    placeholder="Milano"
                    value={inviteCity}
                    onChange={e => setInviteCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] text-[#425466]">
                  <span>Consulente dedicato assegnato:</span>
                  <span className="font-bold text-[#0a2540]">{currentUser.name}</span>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteCustomerOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[#e3e8ee] text-[#425466] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#635bff] text-white font-semibold hover:bg-[#534be0] cursor-pointer shadow-xs"
                  >
                    Genera Link & Invito
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Profilo per {generatedInvite.clientName} Creato!
                  </div>
                  <p className="text-xs text-emerald-700">
                    Il cliente è stato registrato ed è associato a te come consulente dedicato.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Link di Attivazione / Onboarding:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.link}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-[#e3e8ee] text-[11px] font-mono text-slate-700"
                    />
                    <button
                      onClick={() => handleCopyLink(generatedInvite.link, 'modal-link')}
                      className="px-3 py-2 rounded-xl border border-[#e3e8ee] hover:bg-slate-100 font-semibold cursor-pointer shrink-0"
                    >
                      {copiedId === 'modal-link' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                  <a
                    href={generatedInvite.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <Send className="h-4 w-4" />
                    Invia Subito su WhatsApp
                  </a>
                  <button
                    onClick={() => {
                      setIsInviteCustomerOpen(false);
                      setGeneratedInvite(null);
                      setInviteName('');
                      setInviteEmail('');
                      setInvitePhone('');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#e3e8ee] text-[#425466] font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

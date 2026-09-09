import React, { useState } from 'react';
import { 
  User, 
  KeyRound, 
  Download, 
  Check, 
  MessageSquare, 
  Save 
} from 'lucide-react';
import { Customer, UserProfile } from '../types';
import { profileService } from '../services/supabaseClient';

interface CustomerProfileSectionProps {
  customer: Customer;
  currentUser: UserProfile;
  onUpdateCustomer: (updated: Customer) => void;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CustomerProfileSection: React.FC<CustomerProfileSectionProps> = ({
  customer,
  currentUser,
  onUpdateCustomer,
  onToast,
}) => {
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email);
  const [city, setCity] = useState(customer.city);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await profileService.updateProfile(currentUser.id, {
        phone,
        email,
      });

      const updatedCustomer: Customer = {
        ...customer,
        phone,
        email,
        city,
      };

      onUpdateCustomer(updatedCustomer);
      setSavedSuccess(true);
      onToast('Profilo Aggiornato', 'I tuoi recapiti sono stati salvati con successo.', 'success');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      onToast('Errore', 'Impossibile salvare i dati del profilo.', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportGdpr = () => {
    const exportData = {
      profilo: {
        nome: customer.name,
        codiceFiscale: customer.fiscalCode,
        email: customer.email,
        telefono: customer.phone,
        citta: customer.city,
      },
      fornitureAttive: customer.utilityPoints,
      dataContratto: customer.contractStartDate,
      consulenteAssegnato: customer.accountManager,
      esportatoIl: new Date().toISOString(),
      regolamento: 'GDPR EU 2016/679 Art. 15 e 20 (Diritto di Accesso e Portabilità)'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoltaCRM_Export_GDPR_${customer.fiscalCode}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Export GDPR Completato', 'Tutti i tuoi dati personali sono stati scaricati in formato JSON aperto.', 'success');
  };

  return (
    <div className="space-y-6 text-xs max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-[#e3e8ee] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#635bff] text-white font-bold flex items-center justify-center text-base shadow-sm">
            {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0a2540]">{customer.name}</h2>
            <div className="flex items-center gap-2 text-[#425466] mt-0.5">
              <span>Codice Fiscale / P.IVA: <strong className="font-mono text-slate-700">{customer.fiscalCode}</strong></span>
              <span>•</span>
              <span className="text-emerald-600 font-semibold">Account Attivo</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleExportGdpr}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e3e8ee] hover:bg-slate-50 text-[#0a2540] font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          Scarica Dati GDPR (Art. 20)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COL 1 & 2: FORM DATI PERSONALI */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#e3e8ee] shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#e3e8ee] pb-3">
              <User className="h-4 w-4 text-[#635bff]" />
              <h3 className="font-bold text-sm text-[#0a2540]">Dati Anagrafici e Contatti</h3>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Intestatario Forniture</label>
                <input
                  type="text"
                  disabled
                  value={customer.name}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-[#e3e8ee] text-[#425466] cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400 mt-1">Per modificare l'intestatario contatta il tuo consulente dedicato.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Email per Fatture & Notifiche</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Telefono Cellulare</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">Città di Residenza / Sede Legale</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] focus:border-[#635bff] focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#534be0] text-white font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savedSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Salvataggio...' : savedSuccess ? 'Dati Salvati!' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>

          {/* SICUREZZA & PASSWORD */}
          <div className="bg-white p-6 rounded-2xl border border-[#e3e8ee] shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#e3e8ee] pb-3">
              <KeyRound className="h-4 w-4 text-[#635bff]" />
              <h3 className="font-bold text-sm text-[#0a2540]">Sicurezza Accesso</h3>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-[#e3e8ee]">
              <div>
                <div className="font-bold text-[#0a2540]">Password di Accesso</div>
                <div className="text-[11px] text-[#425466]">Ultima modifica: al momento della prima attivazione</div>
              </div>
              <button
                onClick={() => onToast('Link Inviato', `Abbiamo inviato un link sicuro per reimpostare la password a ${customer.email}.`, 'info')}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#e3e8ee] hover:bg-slate-100 font-semibold text-[#0a2540] transition-colors cursor-pointer"
              >
                Reimposta Password
              </button>
            </div>
          </div>
        </div>

        {/* COL 3: ADVISOR CARD & FORNITURE SINTESI */}
        <div className="space-y-6">
          {/* Consulente Assegnato */}
          <div className="bg-[#0a2540] text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="text-[11px] uppercase tracking-wider text-[#00d4aa] font-bold">
              Il tuo Consulente Dedicato
            </div>
            
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-sm border border-white/20">
                {customer.accountManager.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-sm">{customer.accountManager}</div>
                <div className="text-[11px] text-slate-300">Broker Certificato Volta</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Il tuo referente controlla ogni 4 mesi le tue bollette per garantirti sempre la migliore tariffa di mercato.
            </p>

            <a
              href={`https://wa.me/393471122334?text=Ciao%20${encodeURIComponent(customer.accountManager)},%20sono%20${encodeURIComponent(customer.name)}%20di%20VoltaCRM.`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-center flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <MessageSquare className="h-4 w-4" />
              Scrivi su WhatsApp
            </a>
          </div>

          {/* Forniture collegate */}
          <div className="bg-white p-6 rounded-2xl border border-[#e3e8ee] shadow-xs space-y-3">
            <div className="font-bold text-sm text-[#0a2540]">Forniture Attive ({customer.utilityPoints.length})</div>
            <div className="space-y-2">
              {customer.utilityPoints.map(up => (
                <div key={up.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between font-bold text-[#0a2540]">
                    <span className="uppercase text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-[#635bff]">
                      {up.type}
                    </span>
                    <span className="text-[11px] text-[#425466]">{up.currentSupplier}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-800 mt-1 font-semibold">
                    {up.podOrPdr}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

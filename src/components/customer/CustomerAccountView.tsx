import React, { useState, useEffect } from 'react';
import { AuthUser, Customer, UserProfile } from '../../types';
import { api } from '../../api/client';
import { portalApi } from '../../api/portal';
import {
  User,
  Mail,
  Lock,
  LogOut,
  FileCheck2,
  LifeBuoy,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface SupportRequestRow {
  id: string;
  status: string;
  createdAt: string;
  summary: string;
  assignedBrokerId?: string;
}

export interface CustomerAccountViewProps {
  customer: Customer;
  currentUser: AuthUser | UserProfile | null | undefined;
  initialClaimToken?: string;
  onCustomerUpdated: (updated: Customer) => void;
  onBillsUpdated: () => Promise<void> | void;
  onLoggedOut: () => void;
  onToast: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({
  customer,
  currentUser,
  initialClaimToken = '',
  onCustomerUpdated,
  onBillsUpdated,
  onLoggedOut,
  onToast,
}) => {
  // Contact details (reuse PATCH /api/customers/:id via api.customers.updateContact)
  const [phone, setPhone] = useState(customer.phone || '');
  const [city, setCity] = useState(customer.city || '');
  const [savingContact, setSavingContact] = useState(false);

  // Email change (verified flow)
  const [newEmail, setNewEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailChangeNotice, setEmailChangeNotice] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Session revocation
  const [revokingSessions, setRevokingSessions] = useState(false);

  // Claim guest bill
  const [claimToken, setClaimToken] = useState(initialClaimToken);
  const [claimingBill, setClaimingBill] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  // Support requests
  const [supportRequests, setSupportRequests] = useState<SupportRequestRow[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [submittingSupport, setSubmittingSupport] = useState(false);

  // Export & closure
  const [exportingData, setExportingData] = useState(false);
  const [showClosureBox, setShowClosureBox] = useState(false);
  const [closureSecret, setClosureSecret] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [closingAccount, setClosingAccount] = useState(false);

  const [sectionError, setSectionError] = useState<string | null>(null);

  const [prevCustomerKey, setPrevCustomerKey] = useState(`${customer.id}:${customer.phone || ''}:${customer.city || ''}`);
  const currentCustomerKey = `${customer.id}:${customer.phone || ''}:${customer.city || ''}`;
  if (prevCustomerKey !== currentCustomerKey) {
    setPrevCustomerKey(currentCustomerKey);
    setPhone(customer.phone || '');
    setCity(customer.city || '');
  }

  const [prevInitialClaimToken, setPrevInitialClaimToken] = useState(initialClaimToken);
  if (initialClaimToken && prevInitialClaimToken !== initialClaimToken) {
    setPrevInitialClaimToken(initialClaimToken);
    setClaimToken(initialClaimToken);
  }

  useEffect(() => {
    let active = true;
    const loadRequests = async () => {
      setLoadingSupport(true);
      try {
        const list = await portalApi.listSupportRequests(customer.id);
        if (active) setSupportRequests(list);
      } catch {
        // Silently keep empty list if offline
      } finally {
        if (active) setLoadingSupport(false);
      }
    };
    loadRequests();
    return () => {
      active = false;
    };
  }, [customer.id]);

  const handleSaveContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionError(null);
    setSavingContact(true);
    try {
      const updated = await api.customers.updateContact(customer.id, {
        phone: phone.trim(),
        email: customer.email || currentUser?.email || '',
        city: city.trim(),
      });
      onCustomerUpdated(updated);
      onToast('Recapiti aggiornati', 'I tuoi dati di contatto sono stati salvati.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Impossibile aggiornare i recapiti.';
      setSectionError(msg);
      onToast('Errore salvataggio', msg, 'warning');
    } finally {
      setSavingContact(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionError(null);
    setEmailChangeNotice(null);
    if (!newEmail.trim()) return;
    setSavingEmail(true);
    try {
      const res = await api.auth.requestEmailChange(newEmail.trim(), emailChangePassword || undefined);
      setEmailChangeNotice(res.message);
      setNewEmail('');
      setEmailChangePassword('');
      onToast('Verifica richiesta', res.message, 'info');
    } catch (err: any) {
      const msg = err?.message || 'Impossibile avviare il cambio email.';
      setSectionError(msg);
      onToast('Errore cambio email', msg, 'warning');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionError(null);
    if (newPassword !== confirmNewPassword) {
      const msg = 'Le due nuove password non coincidono.';
      setSectionError(msg);
      onToast('Controlla la password', msg, 'warning');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      onToast('Password aggiornata', res.message, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Impossibile aggiornare la password.';
      setSectionError(msg);
      onToast('Errore password', msg, 'warning');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    setSectionError(null);
    setRevokingSessions(true);
    try {
      const res = await api.auth.logoutAllSessions();
      onToast('Sessioni revocate', res.message, 'success');
      onLoggedOut();
    } catch (err: any) {
      const msg = err?.message || 'Impossibile revocare le sessioni attive.';
      setSectionError(msg);
      onToast('Errore sessioni', msg, 'warning');
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleClaimGuestBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimToken.trim()) return;
    setSectionError(null);
    setClaimResult(null);
    setClaimingBill(true);
    try {
      const res = await portalApi.claimGuestBill(claimToken.trim(), customer.id);
      setClaimToken('');
      setClaimResult(res.message);
      await onBillsUpdated();
      onToast('Bolletta associata', res.message, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Codice bolletta non valido o già utilizzato.';
      setSectionError(msg);
      onToast('Associazione non riuscita', msg, 'warning');
    } finally {
      setClaimingBill(false);
    }
  };

  const handleCreateSupportRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setSectionError(null);
    setSubmittingSupport(true);
    try {
      const res = await portalApi.createSupportRequest(supportSubject.trim(), supportMessage.trim(), customer.id);
      setSupportRequests((prev) => [res.request, ...prev]);
      setSupportSubject('');
      setSupportMessage('');
      onToast('Richiesta inviata', 'La richiesta di assistenza è stata presa in carico.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Impossibile inviare la richiesta di assistenza.';
      setSectionError(msg);
      onToast('Errore assistenza', msg, 'warning');
    } finally {
      setSubmittingSupport(false);
    }
  };

  const handleExportData = async () => {
    setSectionError(null);
    setExportingData(true);
    try {
      const payload = await portalApi.exportAccountData(customer.id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voltacrm-export-${customer.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('Esportazione completata', 'Il file JSON dei tuoi dati è stato scaricato.', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Impossibile esportare i dati in questo momento.';
      setSectionError(msg);
      onToast('Errore esportazione', msg, 'warning');
    } finally {
      setExportingData(false);
    }
  };

  const isOAuthAccount = Boolean(currentUser && 'authProvider' in currentUser && currentUser.authProvider);

  const handleAccountClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionError(null);
    setClosingAccount(true);
    try {
      const payload = isOAuthAccount
        ? { confirmPhrase: closureSecret.trim(), reason: closureReason.trim(), customerId: customer.id }
        : { password: closureSecret, reason: closureReason.trim(), customerId: customer.id };
      const res = await portalApi.requestAccountClosure(payload);
      api.auth.logout();
      onToast('Richiesta registrata', res.message, 'info');
      onLoggedOut();
    } catch (err: any) {
      const msg = err?.message || 'Impossibile registrare la chiusura dell’account.';
      setSectionError(msg);
      onToast('Verifica richiesta', msg, 'warning');
    } finally {
      setClosingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0F222D]">Il mio Account</h2>
            <p className="text-sm text-slate-600 mt-1">
              Gestisci recapiti, sicurezza delle sessioni, bollette caricate prima della registrazione e richieste di assistenza.
            </p>
          </div>
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <div><strong className="text-slate-800">{customer.name}</strong></div>
            <div>Email account: <strong className="text-slate-700">{currentUser?.email || customer.email}</strong></div>
            <div>CF / P.IVA: <span className="font-mono">{customer.fiscalCode}</span></div>
          </div>
        </div>

        {sectionError && (
          <div role="alert" className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{sectionError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editable Contact Data */}
        <form onSubmit={handleSaveContacts} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0F222D] font-bold text-base">
            <User className="w-4 h-4 text-[#0A6847]" />
            <h3>Recapiti di contatto</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label htmlFor="account-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Telefono
              </label>
              <input
                id="account-phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847] focus:ring-2 focus:ring-[#0A6847]/20"
              />
            </div>
            <div>
              <label htmlFor="account-city" className="block text-xs font-semibold text-slate-700 mb-1">
                Città
              </label>
              <input
                id="account-city"
                type="text"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Es. Milano"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847] focus:ring-2 focus:ring-[#0A6847]/20"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingContact}
            className="px-4 py-2.5 rounded-xl bg-[#0A6847] hover:bg-[#085238] disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
          >
            {savingContact && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salva recapiti</span>
          </button>
        </form>

        {/* Verified Email Change */}
        <form onSubmit={handleRequestEmailChange} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0F222D] font-bold text-base">
            <Mail className="w-4 h-4 text-[#0A6847]" />
            <h3>Cambio email con verifica</h3>
          </div>
          <p className="text-xs text-slate-500">
            L’indirizzo email di accesso viene aggiornato solo dopo la conferma del link inviato al nuovo indirizzo.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="account-new-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Nuovo indirizzo email
              </label>
              <input
                id="account-new-email"
                type="email"
                autoComplete="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuova.email@esempio.it"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847] focus:ring-2 focus:ring-[#0A6847]/20"
              />
            </div>
            {!isOAuthAccount && (
              <div>
                <label htmlFor="account-email-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password attuale di conferma
                </label>
                <input
                  id="account-email-pwd"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={emailChangePassword}
                  onChange={(e) => setEmailChangePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847] focus:ring-2 focus:ring-[#0A6847]/20"
                />
              </div>
            )}
          </div>
          {emailChangeNotice && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{emailChangeNotice}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={savingEmail}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
          >
            {savingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Invia verifica cambio email</span>
          </button>
        </form>

        {/* Password Change & Session Revocation */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0F222D] font-bold text-base">
            <Lock className="w-4 h-4 text-[#0A6847]" />
            <h3>Sicurezza password e sessioni</h3>
          </div>

          {!isOAuthAccount && (
            <form onSubmit={handleChangePassword} className="space-y-3 border-b border-slate-200 pb-4">
              <div>
                <label htmlFor="account-current-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password attuale
                </label>
                <input
                  id="account-current-pwd"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="account-new-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nuova password
                  </label>
                  <input
                    id="account-new-pwd"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847]"
                  />
                </div>
                <div>
                  <label htmlFor="account-confirm-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                    Conferma nuova password
                  </label>
                  <input
                    id="account-confirm-pwd"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-xl bg-[#0A6847] hover:bg-[#085238] disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer"
              >
                {savingPassword ? 'Aggiornamento...' : 'Aggiorna password'}
              </button>
            </form>
          )}

          <div className="space-y-2 pt-1">
            <p className="text-xs text-slate-600">
              Il pulsante &quot;Esci&quot; chiude solo questa sessione sul browser attuale. Per invalidare eventuali sessioni aperte su altri dispositivi (revocando tutti i token attivi lato server), usa il comando qui sotto.
            </p>
            <button
              type="button"
              onClick={handleLogoutAllSessions}
              disabled={revokingSessions}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{revokingSessions ? 'Revoca in corso...' : 'Disconnetti tutti i dispositivi'}</span>
            </button>
          </div>
        </div>

        {/* Claim Guest Bill */}
        <form onSubmit={handleClaimGuestBill} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[#0F222D] font-bold text-base">
            <FileCheck2 className="w-4 h-4 text-[#0A6847]" />
            <h3>Associa una bolletta caricata da ospite</h3>
          </div>
          <p className="text-xs text-slate-600">
            Se hai inviato una bolletta prima di registrarti, inserisci il codice di associazione ricevuto al termine del caricamento. La verifica di possesso collega la pratica al tuo account senza esporre documenti di altri utenti.
          </p>
          <div>
            <label htmlFor="claim-bill-token" className="block text-xs font-semibold text-slate-700 mb-1">
              Codice associazione bolletta
            </label>
            <input
              id="claim-bill-token"
              type="text"
              value={claimToken}
              onChange={(e) => setClaimToken(e.target.value)}
              placeholder="Incolla il codice ricevuto dopo l’upload"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#0A6847]"
            />
          </div>
          {claimResult && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{claimResult}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={!claimToken.trim() || claimingBill}
            className="px-4 py-2.5 rounded-xl bg-[#0A6847] hover:bg-[#085238] disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer"
          >
            {claimingBill ? 'Verifica in corso...' : 'Associa bolletta al mio account'}
          </button>
        </form>
      </div>

      {/* Support Requests */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-[#0F222D] font-bold text-base">
          <LifeBuoy className="w-4 h-4 text-[#0A6847]" />
          <h3>Richieste di assistenza</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleCreateSupportRequest} className="space-y-3">
            <div>
              <label htmlFor="support-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                Oggetto della richiesta
              </label>
              <input
                id="support-subject"
                type="text"
                required
                minLength={3}
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                placeholder="Es. Chiarimento stato bolletta o aggiornamento POD"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847]"
              />
            </div>
            <div>
              <label htmlFor="support-message" className="block text-xs font-semibold text-slate-700 mb-1">
                Messaggio
              </label>
              <textarea
                id="support-message"
                required
                minLength={5}
                rows={3}
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Descrivi la tua richiesta..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#0A6847]"
              />
            </div>
            <button
              type="submit"
              disabled={submittingSupport}
              className="px-4 py-2.5 rounded-xl bg-[#0A6847] hover:bg-[#085238] disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer"
            >
              {submittingSupport ? 'Invio...' : 'Invia richiesta assistenza'}
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700">Storico richieste</h4>
            {loadingSupport ? (
              <p className="text-xs text-[#5F7380]">Caricamento richieste...</p>
            ) : supportRequests.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">
                Nessuna richiesta di assistenza aperta al momento.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {supportRequests.map((reqRow) => (
                  <div key={reqRow.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">{reqRow.createdAt}</span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                        {reqRow.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{reqRow.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Export & Account Closure */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#0F222D]">Portabilità e chiusura account</h3>
          <p className="text-xs text-slate-500 max-w-2xl">
            Puoi scaricare una copia JSON dei tuoi dati personali, consensi e pratiche. In caso di chiusura account, l’accesso al portale e tutte le sessioni vengono disattivati mentre gli eventuali documenti contrattuali restano conservati secondo gli obblighi di legge.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportData}
            disabled={exportingData}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingData ? 'Esportazione...' : 'Esporta i miei dati (JSON)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowClosureBox((v) => !v)}
            className="px-4 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 text-xs font-bold transition cursor-pointer inline-flex items-center gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Richiedi chiusura account</span>
          </button>
        </div>
      </div>

      {showClosureBox && (
        <form onSubmit={handleAccountClosure} className="bg-rose-50/70 rounded-xl border border-rose-200 p-6 space-y-4">
          <h4 className="text-sm font-bold text-rose-900">Conferma disattivazione e richiesta chiusura account</h4>
          <p className="text-xs text-rose-800">
            Questa operazione disattiva immediatamente l’accesso al portale e revoca tutte le sessioni. Eventuali mandati e documenti contrattuali non vengono eliminati automaticamente ma conservati secondo gli obblighi normativi.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="closure-secret" className="block text-xs font-semibold text-rose-900 mb-1">
                {isOAuthAccount ? 'Digita esattamente "CHIUDI ACCOUNT"' : 'Password attuale per conferma'}
              </label>
              <input
                id="closure-secret"
                type={isOAuthAccount ? 'text' : 'password'}
                required
                value={closureSecret}
                onChange={(e) => setClosureSecret(e.target.value)}
                placeholder={isOAuthAccount ? 'CHIUDI ACCOUNT' : 'Password'}
                className="w-full px-3.5 py-2 rounded-xl border border-rose-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label htmlFor="closure-reason" className="block text-xs font-semibold text-rose-900 mb-1">
                Motivo (facoltativo)
              </label>
              <input
                id="closure-reason"
                type="text"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                placeholder="Motivo della richiesta"
                className="w-full px-3.5 py-2 rounded-xl border border-rose-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={closingAccount}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer"
            >
              {closingAccount ? 'Disattivazione in corso...' : 'Conferma chiusura account'}
            </button>
            <button
              type="button"
              onClick={() => setShowClosureBox(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

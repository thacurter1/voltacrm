import React, { useEffect, useState } from 'react';
import { request } from '../api/transport';

interface InvitationDetails {
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'call_center';
  expiresAt: string;
  totpSecret?: string;
}

export const InvitationActivation: React.FC<{ token: string }> = ({ token }) => {
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    request<{ invitation: InvitationDetails }>('/auth/invitations/inspect', {
      method: 'POST', body: JSON.stringify({ token }),
    }).then(result => { if (active) setDetails(result.invitation); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Invito non disponibile.'); });
    return () => { active = false; };
  }, [token]);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) { setError('Le password non coincidono.'); return; }
    setBusy(true);
    setError('');
    try {
      await request('/auth/invitations/accept', {
        method: 'POST', body: JSON.stringify({ token, password, totpCode: details?.totpSecret ? totpCode : undefined }),
      });
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attivazione non riuscita.');
    } finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-12 text-[#0a2540]">
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <h1 className="text-xl font-bold">Attiva il tuo account VoltaCRM</h1>
      {complete ? <div className="space-y-3">
        <p className="text-emerald-700">Account attivato. Ora puoi accedere con la password scelta.</p>
        <a href="/" className="inline-block rounded-xl bg-[#635bff] px-4 py-2 font-semibold text-white">Vai all’accesso</a>
      </div> : details ? <form onSubmit={activate} className="space-y-4">
        <p>Invito per <strong>{details.name}</strong> ({details.email}).</p>
        <label className="block text-sm font-semibold">Nuova password
          <input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password}
            onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold">Conferma password
          <input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirmation}
            onChange={event => setConfirmation(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        {details.totpSecret && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
          <p className="font-semibold">Configura il secondo fattore</p>
          <p>In Authenticator aggiungi manualmente un account basato sul tempo e inserisci questa chiave:</p>
          <code className="block break-all rounded bg-white p-2 select-all">{details.totpSecret}</code>
          <label className="block font-semibold">Codice a 6 cifre generato dall’app
            <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={totpCode}
              onChange={event => setTotpCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
          </label>
        </div>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#635bff] px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? 'Attivazione…' : 'Attiva account'}
        </button>
      </form> : <p role={error ? 'alert' : undefined}>{error || 'Verifica invito…'}</p>}
    </div>
  </main>;
};

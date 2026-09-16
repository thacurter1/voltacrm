import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import { api } from '../api/client';

interface PendingSignature {
  id: string;
  customerId: string;
  customerName: string;
  podOrPdr: string;
  utilityPointId: string;
  supplier: string;
  timestamp: string;
  status: string;
  activationStatus: string;
}

interface SignatureActivationPanelProps {
  onActivated?: (signature: PendingSignature) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const SignatureActivationPanel: React.FC<SignatureActivationPanelProps> = ({ onActivated }) => {
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.switch.getSignatures();
      setSignatures(result.filter((signature: PendingSignature) =>
        signature.status === 'signed' && signature.activationStatus === 'pending_activation'
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossibile caricare le firme in attesa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activate = async (signature: PendingSignature) => {
    const activationReference = references[signature.id]?.trim();
    const activatedAt = dates[signature.id] || today();
    if (!activationReference) {
      setError('Inserisci il riferimento di conferma del distributore prima di attivare.');
      return;
    }

    setBusyId(signature.id);
    setError(null);
    try {
      const result = await api.switch.activateSignature(signature.id, { activationReference, activatedAt });
      const activated = result.signatureReceipt as PendingSignature;
      setSignatures(current => current.filter(item => item.id !== signature.id));
      onActivated?.(activated);
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Attivazione non riuscita.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4" aria-labelledby="pending-activation-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="pending-activation-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileSignature className="h-4 w-4 text-amber-600" />
            Firme in attesa di attivazione
          </h3>
          <p className="mt-1 text-xs text-slate-600">Conferma lo switch solo dopo aver ricevuto il riferimento dal distributore.</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-amber-600" aria-label="Caricamento" />}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{error}</p>}

      {!loading && signatures.length === 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Nessuna firma richiede attivazione.
        </div>
      )}

      <div className="mt-3 space-y-3">
        {signatures.map(signature => (
          <article key={signature.id} className="rounded-xl border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{signature.customerName}</p>
                <p className="text-xs text-slate-500">{signature.podOrPdr} · {signature.supplier}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Firmata, non attiva</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
              <input
                value={references[signature.id] || ''}
                onChange={event => setReferences(current => ({ ...current, [signature.id]: event.target.value }))}
                placeholder="Riferimento conferma"
                aria-label={`Riferimento conferma per ${signature.customerName}`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-amber-500"
              />
              <input
                type="date"
                value={dates[signature.id] || today()}
                onChange={event => setDates(current => ({ ...current, [signature.id]: event.target.value }))}
                aria-label={`Data attivazione per ${signature.customerName}`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={busyId === signature.id}
                onClick={() => void activate(signature)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {busyId === signature.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Conferma attivazione
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

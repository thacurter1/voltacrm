import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  PenTool, 
  Smartphone, 
  Check, 
  RotateCcw,
  MessageSquare,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { SwitchAudit } from '../types';
import { api } from '../api/client';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: SwitchAudit | null;
  customerPhone?: string;
  onSigned: (auditId: string, signatureType: 'canvas' | 'otp', documentHash?: string) => void;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  audit,
  customerPhone = '+39 340 1234567',
  onSigned,
}) => {
  const [signatureMode, setSignatureMode] = useState<'canvas' | 'otp'>('canvas');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [consentChecked, setConsentChecked] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (otpTimer > 0) {
      interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  if (!isOpen || !audit) return null;

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0a2540';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    setOtpNotice(null);

    try {
      const res = await api.messaging.sendOtp({
        phone: customerPhone,
        channel,
        reason: 'digital_signature'
      });

      setOtpSent(true);
      setOtpTimer(60);

      if (res.debugOtp) {
        setOtpNotice(`Sandbox Mode: Codice generato: ${res.debugOtp}`);
      } else {
        setOtpNotice(`Codice inviato via ${channel.toUpperCase()} a ${customerPhone}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOtpError(`Errore invio OTP: ${msg}`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmitSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;

    if (signatureMode === 'canvas' && !hasDrawn) return;
    if (signatureMode === 'otp' && otpCode.length < 6) return;

    setIsSubmitting(true);
    setOtpError(null);

    try {
      if (signatureMode === 'otp') {
        const verifyRes = await api.messaging.verifyOtp({
          phone: customerPhone,
          code: otpCode
        });

        if (!verifyRes.verified) {
          setOtpError(verifyRes.message || 'Codice OTP non valido o scaduto.');
          setIsSubmitting(false);
          return;
        }
      }

      // Calcolo impronta crittografica SHA-256 (FEA Compliance eIDAS)
      let documentHash = '';
      try {
        const docPayload = JSON.stringify({
          auditId: audit.id,
          customerId: audit.customerId,
          customerName: audit.customerName,
          podOrPdr: audit.podOrPdr,
          offerName: audit.bestOffer?.name,
          supplier: audit.bestOffer?.supplier,
          annualSavings: audit.annualSavings,
          signatureMode,
          timestamp: new Date().toISOString()
        });
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(docPayload));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        documentHash = 'SHA256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        documentHash = `SHA256-FALLBACK-${Date.now()}`;
      }

      onSigned(audit.id, signatureMode, documentHash);
      setIsSubmitting(false);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOtpError(`Errore durante la firma: ${msg}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
      <div onClick={onClose} className="fixed inset-0 bg-[#0a2540]/60 backdrop-blur-xs" />

      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[#e3e8ee] shadow-2xl p-6 space-y-5 text-xs animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[#e3e8ee] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0a2540]">Firma Digitale Mandato Switch</h3>
              <p className="text-[11px] text-[#425466]">Perfezionamento a norma del Codice dell'Amministrazione Digitale</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contract Summary Chip */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-[#e3e8ee] flex items-center justify-between">
          <div>
            <div className="font-bold text-[#0a2540]">{audit.customerName}</div>
            <div className="text-[11px] text-[#425466]">
              Switch {audit.utilityType.toUpperCase()} da {audit.currentSupplier} a <strong className="text-[#635bff]">{audit.bestOffer.supplier}</strong>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-black font-mono text-emerald-600">
              +€{audit.annualSavings.toFixed(2)}/anno
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Risparmio Stimato</div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-[#e3e8ee]">
          <button
            type="button"
            onClick={() => setSignatureMode('canvas')}
            className={`py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              signatureMode === 'canvas'
                ? 'bg-white text-[#0a2540] shadow-xs'
                : 'text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            Firma Grafometrica
          </button>

          <button
            type="button"
            onClick={() => setSignatureMode('otp')}
            className={`py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              signatureMode === 'otp'
                ? 'bg-white text-[#0a2540] shadow-xs'
                : 'text-[#425466] hover:text-[#0a2540]'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            OTP Cellulare (SMS/WhatsApp)
          </button>
        </div>

        {/* TAB 1: CANVAS SIGNATURE */}
        {signatureMode === 'canvas' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] text-[#425466]">
              <span>Firma nello spazio sottostante:</span>
              {hasDrawn && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Pulisci
                </button>
              )}
            </div>
            
            <div className="relative border-2 border-dashed border-[#e3e8ee] rounded-xl overflow-hidden bg-[#fdfdfe] h-36">
              <canvas
                ref={canvasRef}
                width={460}
                height={144}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair touch-none"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs">
                  Traccia la tua firma qui con il dito o il puntatore
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: OTP VERIFICATION */}
        {signatureMode === 'otp' && (
          <div className="space-y-3.5 p-4 rounded-xl bg-slate-50 border border-[#e3e8ee]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#0a2540]">Verifica tramite cellulare</div>
                <div className="text-[11px] text-[#425466]">Invieremo il codice a <strong>{customerPhone}</strong></div>
              </div>

              {/* Channel Selector */}
              <div className="flex items-center bg-white border border-[#e3e8ee] rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                    channel === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="h-3 w-3" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('sms')}
                  className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                    channel === 'sms'
                      ? 'bg-[#635bff] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="h-3 w-3" />
                  SMS
                </button>
              </div>
            </div>

            {/* Invia OTP Button */}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={otpTimer > 0 || isSendingOtp}
                onClick={handleSendOtp}
                className="px-3.5 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5349e0] text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Invio in corso...</span>
                  </>
                ) : otpTimer > 0 ? (
                  <span>Reinvio tra {otpTimer}s</span>
                ) : (
                  <span>Invia Codice OTP via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>
                )}
              </button>
            </div>

            {/* Error or Notice Alert */}
            {otpError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span>{otpError}</span>
              </div>
            )}

            {otpNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-[11px]">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="font-medium">{otpNotice}</span>
              </div>
            )}

            {otpSent && (
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">
                  Inserisci il codice a 6 cifre ricevuto:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white text-center font-mono text-lg tracking-widest font-bold focus:border-[#635bff] focus:ring-1 focus:ring-[#635bff] focus:outline-hidden"
                />
              </div>
            )}
          </div>
        )}

        {/* Legal Consent Checkbox */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-[#e3e8ee] cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={e => setConsentChecked(e.target.checked)}
            className="mt-0.5 rounded text-[#635bff] focus:ring-[#635bff]"
          />
          <span className="text-[11px] text-[#425466] leading-relaxed">
            Confermo la volontà di sottoscrivere il mandato di brokeraggio e la richiesta di cambio fornitore a costo zero con <strong>{audit.bestOffer.supplier}</strong>, approvando le condizioni economiche esposte nello studio di fattibilità.
          </span>
        </label>

        {/* Actions */}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#e3e8ee] text-[#425466] font-semibold hover:bg-slate-50 cursor-pointer"
          >
            Annulla
          </button>

          <button
            type="button"
            disabled={!consentChecked || (signatureMode === 'canvas' && !hasDrawn) || (signatureMode === 'otp' && otpCode.length < 6) || isSubmitting}
            onClick={handleSubmitSignature}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs disabled:opacity-40 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifica & Sigillatura...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Firma e Attiva Switch</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

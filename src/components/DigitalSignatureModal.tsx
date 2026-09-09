import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  PenTool, 
  Smartphone, 
  Check, 
  RotateCcw
} from 'lucide-react';
import { SwitchAudit } from '../types';

interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: SwitchAudit | null;
  customerPhone?: string;
  onSigned: (auditId: string, signatureType: 'canvas' | 'otp') => void;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  audit,
  customerPhone = '+39 340 1234567',
  onSigned,
}) => {
  const [signatureMode, setSignatureMode] = useState<'canvas' | 'otp'>('canvas');
  const [consentChecked, setConsentChecked] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
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

  const handleSendOtp = () => {
    setOtpSent(true);
    setOtpTimer(60);
    // Simula invio OTP
    setOtpCode('849201');
  };

  const handleSubmitSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;

    if (signatureMode === 'canvas' && !hasDrawn) return;
    if (signatureMode === 'otp' && otpCode.length < 6) return;

    setIsSubmitting(true);
    setTimeout(() => {
      onSigned(audit.id, signatureMode);
      setIsSubmitting(false);
      onClose();
    }, 600);
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
            <span className="text-[10px] text-slate-400">risparmio garantito</span>
          </div>
        </div>

        {/* Mode Selector: Canvas vs OTP */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl font-semibold">
          <button
            type="button"
            onClick={() => setSignatureMode('canvas')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              signatureMode === 'canvas' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466]'
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            Firma con Dito / Mouse
          </button>

          <button
            type="button"
            onClick={() => setSignatureMode('otp')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              signatureMode === 'otp' ? 'bg-white text-[#0a2540] shadow-xs' : 'text-[#425466]'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Codice OTP (SMS/WhatsApp)
          </button>
        </div>

        {/* TAB 1: CANVAS DRAWING */}
        {signatureMode === 'canvas' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px] text-[#425466]">
              <span>Apponi la tua firma all'interno del riquadro:</span>
              {hasDrawn && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-slate-500 hover:text-red-600 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Cancella
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-[#e3e8ee] rounded-xl bg-slate-50 relative overflow-hidden h-36">
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
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-[#e3e8ee]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#0a2540]">Verifica tramite cellulare</div>
                <div className="text-[11px] text-[#425466]">Invieremo un codice a {customerPhone}</div>
              </div>
              <button
                type="button"
                disabled={otpTimer > 0}
                onClick={handleSendOtp}
                className="px-3 py-1.5 rounded-lg bg-[#635bff] text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                {otpTimer > 0 ? `Inviato (${otpTimer}s)` : 'Invia Codice OTP'}
              </button>
            </div>

            {otpSent && (
              <div>
                <label className="block text-[11px] font-semibold text-[#0a2540] mb-1">
                  Inserisci il codice a 6 cifre ricevuto:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="849201"
                  className="w-full px-3.5 py-2 rounded-xl border border-[#e3e8ee] text-center font-mono text-base tracking-widest font-bold focus:border-[#635bff] focus:outline-hidden"
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
            <Check className="h-4 w-4" />
            <span>{isSubmitting ? 'Sigillatura in corso...' : 'Firma e Attiva Switch'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

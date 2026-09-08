import React, { useState } from 'react';
import { 
  Zap, 
  Flame, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight, 
  Download, 
  Calendar, 
  Lock, 
  UserCheck, 
  PieChart, 
  Eye, 
  EyeOff,
  Award,
  Star,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Send,
  TrendingUp,
  Phone,
  HelpCircle,
  ChevronRight,
  CreditCard,
  Gauge
} from 'lucide-react';
import { AuthUser, Customer, CustomerBill, SwitchAudit } from '../types';
import { securityValidator } from '../services/securityValidator';
import { cryptoService } from '../services/cryptoService';

interface CustomerPortalProps {
  customer: Customer;
  currentUser: AuthUser;
  audits: SwitchAudit[];
  bills: CustomerBill[];
  onUploadBill: (bill: CustomerBill) => void;
  onApproveSwitch: (auditId: string) => void;
  onSwitchUser: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  customer,
  currentUser,
  audits,
  bills,
  onUploadBill,
  onApproveSwitch,
  onSwitchUser,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sanitizedFileName, setSanitizedFileName] = useState('');
  const [utilityType, setUtilityType] = useState<'luce' | 'gas'>('luce');
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showPii, setShowPii] = useState(false);

  // Referral Program State
  const [copiedReferral, setCopiedReferral] = useState(false);
  const referralCode = `VOLTA-${customer.name.split(' ')[0].toUpperCase()}${customer.city.slice(0, 2).toUpperCase()}30`;

  // Autolettura Contatore State
  const [readingF1, setReadingF1] = useState('');
  const [readingF2, setReadingF2] = useState('');
  const [readingF3, setReadingF3] = useState('');
  const [readingGas, setReadingGas] = useState('');
  const [readingSubmitted, setReadingSubmitted] = useState(false);

  // Audits attivi per questo cliente
  const customerAudits = audits.filter(a => a.customerId === customer.id);
  const recommendedAudit = customerAudits.find(a => a.status === 'switch_recommended');

  // Bollette per questo cliente
  const customerBills = bills.filter(b => b.customerId === customer.id);

  // Calcolo giorni a prossimo audit
  const getDaysUntilAudit = (nextDateStr: string) => {
    const target = new Date(nextDateStr).getTime();
    const now = new Date().getTime();
    return Math.round((target - now) / (1000 * 60 * 60 * 24));
  };

  const daysToAudit = getDaysUntilAudit(customer.nextSwitchAuditDate);

  // Calcolo Risparmio Cumulato Storico
  const historicalSavingsEur = 540.0;

  // Calcolo Pagella Bolletta
  const billGrade = recommendedAudit ? 4.2 : 9.4;
  const gradeStatus = recommendedAudit ? 'insufficient' : 'excellent';

  const processFile = async (file: File) => {
    setUploadError('');
    const validation = await securityValidator.validateFile(file);
    if (!validation.isValid) {
      setUploadError(validation.error || 'File non conforme alle policy di sicurezza.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setSanitizedFileName(validation.sanitizedName);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSubmitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setTimeout(() => {
      const newBill: CustomerBill = {
        id: `bill-${Date.now()}`,
        customerId: customer.id,
        customerName: customer.name,
        fileName: sanitizedFileName || selectedFile.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSizeKb: Math.round(selectedFile.size / 1024) || 1250,
        utilityType,
        status: 'in_review',
        notes: notes || 'Caricata direttamente dal portale cliente (Integrità binaria verificata).',
      };

      onUploadBill(newBill);
      setSelectedFile(null);
      setSanitizedFileName('');
      setNotes('');
      setIsUploading(false);
    }, 600);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(`https://voltacrm.it/invito?ref=${referralCode}`);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  const handleSubmitReading = (e: React.FormEvent) => {
    e.preventDefault();
    setReadingSubmitted(true);
    setTimeout(() => {
      setReadingSubmitted(false);
      setReadingF1('');
      setReadingF2('');
      setReadingF3('');
      setReadingGas('');
    }, 4000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2 text-xs">
      {/* STRIPE-STYLE WELCOME HEADER */}
      <div className="stripe-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-emerald-50/50 to-transparent pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="stripe-badge-success">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoraggio Continuo Attivo
            </span>
            <span className="stripe-badge-neutral font-mono">
              <Lock className="h-3 w-3 text-slate-400" />
              Crittografia AES-256
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-[#0a2540] tracking-tight">
            Benvenuto, {customer.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#425466]">
            <span>
              Codice Fiscale: <strong className="font-mono text-[#0a2540]">{showPii ? customer.fiscalCode : cryptoService.maskFiscalCode(customer.fiscalCode)}</strong>
            </span>
            <button
              onClick={() => setShowPii(!showPii)}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
              title={showPii ? 'Nascondi dato sensibile' : 'Mostra dato sensibile'}
            >
              {showPii ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <span className="text-slate-300">•</span>
            <span>Città: <strong>{customer.city}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-[#e3e8ee] shadow-2xs text-left min-w-[170px]">
            <span className="text-[10px] text-[#425466] uppercase font-bold tracking-wider block">
              Prossimo Controllo
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="h-4 w-4 text-[#635bff]" />
              <span className="font-bold text-sm text-[#0a2540]">
                {daysToAudit <= 0 ? (
                  <span className="text-orange-600">In corso adesso</span>
                ) : (
                  `Tra ${daysToAudit} giorni`
                )}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Ciclo ricorrente 120gg</span>
          </div>

          <button
            onClick={onSwitchUser}
            className="px-3.5 py-2.5 rounded-xl border border-[#e3e8ee] bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            title="Cambia Utente / Torna al Call Center"
          >
            Esci
          </button>
        </div>
      </div>

      {/* STRIPE 3-COLUMN BENTO GRID: Risparmio, Pagella & Consulente */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARD 1: RISPARMIO CUMULATO (Stripe Climate / Dark Navy Elegance) */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0a2540] via-[#0f2d4a] to-[#121e2f] text-white shadow-[0_8px_20px_rgba(10,37,64,0.15)] border border-slate-700/50 space-y-4 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-300 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-400" />
                Risparmio Cumulato
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-900/80 text-emerald-400 border border-indigo-700/60">
                3 Rinegoziazioni
              </span>
            </div>

            <div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight font-mono text-white">
                € {historicalSavingsEur.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed mt-1">
                Risparmio netto calcolato da quando VoltaCRM monitora le tue forniture energetiche.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300 relative z-10">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Garanzia Miglior Prezzo
            </span>
            <span className="text-slate-400">Zero Conguagli</span>
          </div>
        </div>

        {/* CARD 2: PAGELLA DELLA BOLLETTA (Stripe Radar / Risk Score Style) */}
        <div className={`p-6 rounded-2xl border stripe-card space-y-4 flex flex-col justify-between transition-all ${
          gradeStatus === 'insufficient'
            ? 'border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white'
            : 'border-emerald-200/80 bg-gradient-to-b from-emerald-50/40 to-white'
        }`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#425466] flex items-center gap-1.5">
                <Gauge className={`h-4 w-4 ${gradeStatus === 'insufficient' ? 'text-amber-500' : 'text-emerald-600'}`} />
                Pagella della tua Bolletta
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                gradeStatus === 'insufficient' 
                  ? 'bg-amber-100 text-amber-900 border-amber-200' 
                  : 'bg-emerald-100 text-emerald-900 border-emerald-200'
              }`}>
                {gradeStatus === 'insufficient' ? 'Migliorabile' : 'Top 5% Italia'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                gradeStatus === 'insufficient' ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {billGrade}
              </span>
              <span className="text-xs text-slate-400 font-bold">/ 10</span>
            </div>

            {/* Sub-ratings Breakdown */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] text-[#425466]">
                <span>Prezzo Materia</span>
                <span className="font-bold">{gradeStatus === 'insufficient' ? '3.5 / 10' : '9.5 / 10'}</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${gradeStatus === 'insufficient' ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                  style={{ width: gradeStatus === 'insufficient' ? '35%' : '95%' }} 
                />
              </div>
            </div>

            <p className="text-[11px] text-[#425466] leading-relaxed">
              {gradeStatus === 'insufficient'
                ? 'Prezzo materia superiore alla media di mercato. Passa a 9.5/10 approvando lo switch consigliato.'
                : 'La tua tariffa attuale è tra le più competitive d’Italia. Nessun cambio necessario adesso.'}
            </p>
          </div>

          {recommendedAudit && (
            <button
              onClick={() => onApproveSwitch(recommendedAudit.id)}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span>Porta il voto a 9.5/10</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* CARD 3: IL TUO ENERGY SPECIALIST (Human Touch Stripe Support) */}
        <div className="stripe-card p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#425466]">
                Consulente Personale
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#635bff] to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                AM
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#0a2540]">Alessandro Mori</h3>
                <span className="text-[11px] text-slate-500 block">Energy Specialist Dedicato</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Reperibile Lun-Ven 09:00 - 18:30</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#e3e8ee] grid grid-cols-2 gap-2">
            <a
              href="https://wa.me/393310000000"
              target="_blank"
              rel="noreferrer"
              className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-center border border-emerald-200/80 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp
            </a>
            <a
              href="tel:+393310000000"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#0a2540] font-bold text-center border border-[#e3e8ee] transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            >
              <Phone className="h-3.5 w-3.5 text-slate-500" />
              Chiama
            </a>
          </div>
        </div>
      </div>

      {/* BANNER PROPOSTA DI RISPARMIO ATTIVA (Stripe Callout) */}
      {recommendedAudit && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border border-emerald-300 shadow-[0_4px_16px_rgba(5,150,105,0.08)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Audit a 120 Giorni • Risparmio Rilevato
              </span>
              <h2 className="text-lg font-bold text-[#0a2540]">
                Trovata tariffa più conveniente per la tua fornitura
              </h2>
              <p className="text-xs text-slate-700 max-w-2xl leading-relaxed">
                Il tuo fornitore attuale per <strong>{recommendedAudit.utilityType.toUpperCase()} ({recommendedAudit.podOrPdr})</strong> è <strong>{recommendedAudit.currentSupplier}</strong>. 
                Passando a <strong>{recommendedAudit.bestOffer.supplier}</strong> puoi risparmiare:
              </p>
            </div>

            <div className="text-left sm:text-right bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Risparmio Stimato</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
                € {recommendedAudit.annualSavings.toFixed(0)} <span className="text-xs text-slate-400 font-normal">/ anno</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                (-{recommendedAudit.savingsPercent}%)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-emerald-200">
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Nessun costo di recesso e zero interruzioni di luce/gas.
            </span>
            <button
              onClick={() => onApproveSwitch(recommendedAudit.id)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approva Cambio Fornitore con 1 Click
            </button>
          </div>
        </div>
      )}

      {/* STRIPE PAYMENT-METHOD STYLE FORNITURE CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0a2540]">Le Tue Forniture Attive</h2>
          <span className="text-[11px] text-[#425466]">Codici POD e PDR collegati al tuo profilo</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {customer.utilityPoints.map((utility) => (
            <div 
              key={utility.id}
              className="stripe-card stripe-card-hover p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    utility.type === 'luce' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-sky-50 text-sky-600 border border-sky-200'
                  }`}>
                    {utility.type === 'luce' ? <Zap className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#0a2540] uppercase tracking-tight">
                      Fornitura {utility.type === 'luce' ? 'Luce Elettrica' : 'Gas Naturale'}
                    </h3>
                    <span className="font-mono text-xs font-semibold text-slate-500 block">
                      {utility.type === 'luce' ? 'POD' : 'PDR'}: {showPii ? utility.podOrPdr : cryptoService.maskPodPdr(utility.podOrPdr)}
                    </span>
                  </div>
                </div>

                <span className="stripe-badge-neutral">
                  {utility.currentTariffType === 'fixed' ? 'Prezzo Fisso' : 'Indicizzata'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-[#e3e8ee] text-xs">
                <div>
                  <span className="text-[10px] text-[#425466] uppercase font-bold block">Gestore</span>
                  <span className="font-bold text-[#0a2540] truncate block mt-0.5">{utility.currentSupplier}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#425466] uppercase font-bold block">Consumo Annuo</span>
                  <span className="font-bold text-[#0a2540] font-mono block mt-0.5">
                    {utility.annualConsumption.toLocaleString()} {utility.type === 'luce' ? 'kWh' : 'Smc'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#425466] uppercase font-bold block">Prezzo Materia</span>
                  <span className="font-bold text-[#0a2540] font-mono block mt-0.5">
                    {utility.currentUnitCost.toFixed(4)} €
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMPOSIZIONE TRASPARENTE DELLA SPESA ENERGETICA (Stripe Bar Breakdown) */}
      <div className="stripe-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e3e8ee] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
              <PieChart className="h-4 w-4 text-[#635bff]" />
              Scomposizione Trasparente della Bolletta
            </h3>
            <p className="text-xs text-[#425466]">
              Ecco esattamente come viene ripartito ogni euro secondo i criteri di trasparenza ARERA.
            </p>
          </div>
          <span className="stripe-badge-blurple">
            Zero costi nascosti
          </span>
        </div>

        <div className="space-y-3">
          {/* Segmented Bar */}
          <div className="h-4 w-full rounded-full overflow-hidden flex shadow-inner bg-slate-100">
            <div className="bg-[#635bff] h-full transition-all" style={{ width: '48%' }} title="Spesa Materia Energia: 48%" />
            <div className="bg-amber-400 h-full transition-all" style={{ width: '34%' }} title="Trasporto & Oneri di Sistema: 34%" />
            <div className="bg-emerald-500 h-full transition-all" style={{ width: '18%' }} title="Imposte ed IVA: 18%" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#0a2540]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#635bff]" />
                <span>48% Spesa Materia</span>
              </div>
              <p className="text-[11px] text-[#425466]">
                <strong>Quota negoziabile.</strong> È l'unica parte su cui il nostro algoritmo abbatte la spesa ogni 4 mesi.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#0a2540]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span>34% Trasporto & Oneri</span>
              </div>
              <p className="text-[11px] text-[#425466]">
                Quote fisse stabilite da ARERA uguali con qualsiasi fornitore.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#0a2540]">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>18% Imposte ed IVA</span>
              </div>
              <p className="text-[11px] text-[#425466]">
                Accise statali e IVA al 10% (residenziale) o 22% (aziende).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEZIONE 3: AUTOLETTURA CONTATORE (Stripe Checkout Form Style) */}
      <div className="stripe-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e3e8ee] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#635bff]" />
              Autolettura Contatore Mensile
            </h3>
            <p className="text-xs text-[#425466]">
              Invia la lettura dal 25 al 30 del mese per azzerare i consumi stimati e i conguagli.
            </p>
          </div>
          <span className="stripe-badge-success">
            Finestra Aperta
          </span>
        </div>

        {readingSubmitted ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold block">Autolettura Registrata con Successo!</span>
              <span className="text-[11px]">I tuoi dati sono stati trasmessi al distributore per la fatturazione a consumo reale.</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitReading} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#0a2540] block mb-1">
                  Luce F1 (Picco)
                </label>
                <input
                  type="number"
                  placeholder="es. 12450"
                  value={readingF1}
                  onChange={(e) => setReadingF1(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-mono text-xs focus:bg-white focus:border-[#635bff] focus:outline-none transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#0a2540] block mb-1">
                  Luce F2 (Intermedia)
                </label>
                <input
                  type="number"
                  placeholder="es. 8320"
                  value={readingF2}
                  onChange={(e) => setReadingF2(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-mono text-xs focus:bg-white focus:border-[#635bff] focus:outline-none transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#0a2540] block mb-1">
                  Luce F3 (Sera/Festivi)
                </label>
                <input
                  type="number"
                  placeholder="es. 9810"
                  value={readingF3}
                  onChange={(e) => setReadingF3(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-mono text-xs focus:bg-white focus:border-[#635bff] focus:outline-none transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#0a2540] block mb-1">
                  Gas (Smc)
                </label>
                <input
                  type="number"
                  placeholder="es. 4520"
                  value={readingGas}
                  onChange={(e) => setReadingGas(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#e3e8ee] text-[#0a2540] font-mono text-xs focus:bg-white focus:border-[#635bff] focus:outline-none transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Invia Autolettura
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SEZIONE 4: PROGRAMMA REFERRAL (Stripe Climate Style) */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 border border-indigo-200/80 stripe-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="stripe-badge-blurple">
              Programma Fedeltà Volta
            </span>
            <h3 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
              <Share2 className="h-4 w-4 text-[#635bff]" />
              Invita un Amico: 30€ di Bonus per Te e 30€ per Lui
            </h3>
            <p className="text-xs text-[#425466]">
              Condividi il tuo link personale: quando un tuo amico carica la bolletta e attiva una fornitura, entrambi ricevete 30€ di sconto.
            </p>
          </div>

          <div className="text-right p-3 rounded-xl bg-white border border-indigo-100 shrink-0 shadow-2xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Bonus Accumulati</span>
            <span className="text-xl font-black text-emerald-600 font-mono">€ 60.00</span>
            <span className="text-[10px] text-slate-500 block">2 Amici Attivati</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-indigo-100">
          <div className="w-full sm:flex-1 p-2.5 rounded-xl bg-white border border-indigo-200 font-mono text-xs text-[#0a2540] flex items-center justify-between shadow-2xs">
            <span className="truncate">https://voltacrm.it/invito?ref={referralCode}</span>
            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded ml-2 shrink-0">
              CODICE: {referralCode}
            </span>
          </div>

          <button
            onClick={handleCopyReferral}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
          >
            {copiedReferral ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedReferral ? 'Link Copiato!' : 'Copia Link'}
          </button>
        </div>
      </div>

      {/* SEZIONE 5: CARICA LA TUA BOLLETTA (Stripe Dropzone) */}
      <div className="stripe-card p-6 space-y-5">
        <div className="border-b border-[#e3e8ee] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-[#635bff]" />
              Carica una Nuova Bolletta per Verifica Gratuita
            </h2>
            <p className="text-xs text-[#425466]">
              Trascina la bolletta PDF o immagine: il nostro motore la analizzerà con la Pagella AI per rilevare se puoi pagare meno.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitBill} className="space-y-4">
          <div 
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive 
                ? 'border-[#635bff] bg-indigo-50/50' 
                : 'border-[#e3e8ee] bg-[#f8fafc] hover:border-[#635bff]/40 hover:bg-slate-50/80'
            }`}
          >
            <UploadCloud className="h-10 w-10 text-[#635bff] mx-auto mb-2" />
            {selectedFile ? (
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-600 block flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> File Verificato (Magic Bytes OK): {sanitizedFileName || selectedFile.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  Dimensione: {Math.round(selectedFile.size / 1024)} KB
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0a2540] hover:text-[#635bff] cursor-pointer">
                  <span>Trascina la bolletta oppure </span>
                  <span className="text-[#635bff] underline underline-offset-2">sfoglia dal computer</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                <p className="text-[11px] text-slate-400 block">Supporta PDF, JPG, PNG (Max 10MB con verifica binaria)</p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[#0a2540] font-semibold block mb-1">Tipo Fornitura</label>
              <select
                value={utilityType}
                onChange={(e) => setUtilityType(e.target.value as 'luce' | 'gas')}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#e3e8ee] text-[#0a2540] text-xs focus:border-[#635bff] focus:outline-none shadow-2xs"
              >
                <option value="luce">Luce Elettrica</option>
                <option value="gas">Gas Naturale</option>
              </select>
            </div>

            <div>
              <label className="text-[#0a2540] font-semibold block mb-1">Note Aggiuntive (opzionale)</label>
              <input
                type="text"
                placeholder="es. Ultima bolletta estiva con condizionatori"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#e3e8ee] text-[#0a2540] text-xs focus:border-[#635bff] focus:outline-none shadow-2xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="px-6 py-2.5 rounded-xl bg-[#635bff] hover:bg-[#5851ea] text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5 active:scale-95"
            >
              {isUploading ? 'Verifica e Caricamento in corso...' : 'Invia Bolletta per Pagella & Analisi'}
            </button>
          </div>
        </form>
      </div>

      {/* STORICO BOLLETTE CARICATE (Stripe Invoices Table) */}
      <div className="stripe-card p-6 space-y-4">
        <h3 className="text-base font-bold text-[#0a2540]">Storico Documenti & Bollette Caricate</h3>
        
        {customerBills.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">Nessun documento caricato finora.</p>
        ) : (
          <div className="divide-y divide-[#e3e8ee] text-xs">
            {customerBills.map((b) => (
              <div key={b.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors px-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-[#635bff]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#0a2540] block">{b.fileName}</span>
                    <span className="text-[11px] text-slate-400">
                      Caricata il {b.uploadDate} • {b.fileSizeKb} KB • Fornitura {b.utilityType.toUpperCase()}
                    </span>
                    {b.notes && (
                      <span className="text-[11px] text-slate-500 block mt-0.5 italic">
                        "{b.notes}"
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {b.status === 'analyzed' ? (
                    <span className="stripe-badge-success">
                      Analizzata ({b.extractedSavingsEur ? `+€${b.extractedSavingsEur}/anno` : 'OK'})
                    </span>
                  ) : (
                    <span className="stripe-badge-neutral">
                      In Revisione
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

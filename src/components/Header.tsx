import React from 'react';
import { 
  Zap, 
  RefreshCw, 
  PhoneCall, 
  Users, 
  ShieldCheck, 
  BarChart3,
  Search,
  ChevronDown,
  FileSearch,
  SlidersHorizontal,
  User,
  UploadCloud,
  Lock,
  FileText,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { AuthUser, MarketIndex } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  marketIndex: MarketIndex;
  pendingSwitchesCount: number;
  pendingBillsCount: number;
  currentUser: AuthUser;
  onOpenCommandPalette: () => void;
  onOpenMarketSimulator: () => void;
  onOpenBillOcr: () => void;
  onOpenLogin: () => void;
  onOpenTotem?: () => void;
  onRefreshMarketIndex?: () => void;
  isRefreshingMarketIndex?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  marketIndex,
  pendingSwitchesCount,
  pendingBillsCount,
  currentUser,
  onOpenCommandPalette,
  onOpenMarketSimulator,
  onOpenBillOcr,
  onOpenLogin,
  onOpenTotem,
  onRefreshMarketIndex,
  isRefreshingMarketIndex = false,
}) => {
  const isCustomer = currentUser.role === 'customer';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: number;
  }

  const callCenterNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Panoramica', icon: BarChart3 },
    { id: 'leads', label: 'Lead Marketing', icon: Users },
    { id: 'callcenter', label: 'Call Center & Agenda', icon: PhoneCall },
    { 
      id: 'inbox_bills', 
      label: 'Bollette Clienti', 
      icon: FileText,
      badge: pendingBillsCount > 0 ? pendingBillsCount : undefined
    },
    { id: 'crm', label: 'Clienti (POD/PDR)', icon: ShieldCheck },
    { id: 'team_profiles', label: 'Team & Profili', icon: Users },
    { id: 'tariffe', label: 'Tariffe & Simulator', icon: Zap },
    { 
      id: 'switch4m', 
      label: 'Switch 4 Mesi', 
      icon: RefreshCw, 
      badge: pendingSwitchesCount > 0 ? pendingSwitchesCount : undefined 
    },
    { id: 'security', label: 'Audit Sicurezza & GDPR', icon: Lock },
  ];

  const customerNavItems: NavItem[] = [
    { id: 'customer_overview', label: 'Le Mie Forniture', icon: ShieldCheck },
    { id: 'customer_upload', label: 'Carica Nuova Bolletta', icon: UploadCloud },
    { id: 'customer_profile', label: 'Il Mio Profilo & GDPR', icon: User },
  ];

  const navItems: NavItem[] = isCustomer ? customerNavItems : callCenterNavItems;

  return (
    <header className="border-b border-[#e3e8ee] bg-white sticky top-0 z-40">
      {/* Top Level: Workspace, Search, Market Indicators & User */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Organization switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer group">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-xs ${
              isCustomer ? 'bg-emerald-600' : 'bg-[#635bff]'
            }`}>
              <Zap className="h-4 w-4 fill-white text-white" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-[#0a2540] tracking-tight">Volta Energy</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isCustomer ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {isCustomer ? 'PORTALE CLIENTE' : 'CALL CENTER & BACKEND'}
              </span>
            </div>
          </div>

          {!isCustomer && (
            <>
              <div className="hidden md:flex items-center h-5 w-px bg-slate-200" />
              <button
                onClick={onOpenCommandPalette}
                className="hidden lg:flex items-center w-64 h-8 px-2.5 rounded-lg bg-slate-50 border border-[#e3e8ee] text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-100 transition-all cursor-pointer justify-between"
              >
                <div className="flex items-center">
                  <Search className="h-3.5 w-3.5 text-slate-400 mr-2 shrink-0" strokeWidth={1.75} />
                  <span>Cerca o digita...</span>
                </div>
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white rounded border border-slate-200 shadow-2xs">
                  ⌘K
                </kbd>
              </button>
            </>
          )}
        </div>

        {/* Right: Live Market Ticker & User Role Switcher */}
        <div className="flex items-center gap-3">
          {/* Live PUN & PSV Ticker Pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div 
              onClick={onOpenMarketSimulator}
              className="flex items-center gap-2 cursor-pointer group"
              title={`Clicca per simulare scenari PUN/PSV o vedere fasce F1/F2/F3. Ultimo aggiornamento: ${marketIndex.lastUpdated}`}
            >
              {/* PUN Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-[#e3e8ee] group-hover:border-[#635bff]/40 text-xs transition-colors">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-500 font-medium">PUN:</span>
                <span className="font-semibold text-[#0a2540] tabular-nums font-mono">
                  {marketIndex.punEurKwh.toFixed(4)} €
                </span>
                {marketIndex.punChangePercent !== undefined && (
                  <span className={`inline-flex items-center text-[10px] font-bold ${
                    marketIndex.punChangePercent > 0 
                      ? 'text-rose-600' 
                      : marketIndex.punChangePercent < 0 
                        ? 'text-emerald-600' 
                        : 'text-slate-400'
                  }`}>
                    {marketIndex.punChangePercent > 0 ? (
                      <TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" />
                    ) : marketIndex.punChangePercent < 0 ? (
                      <TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" />
                    ) : null}
                    {marketIndex.punChangePercent > 0 ? '+' : ''}{marketIndex.punChangePercent}%
                  </span>
                )}
              </div>

              {/* PSV Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-[#e3e8ee] group-hover:border-[#635bff]/40 text-xs transition-colors">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <span className="text-slate-500 font-medium">PSV:</span>
                <span className="font-semibold text-[#0a2540] tabular-nums font-mono">
                  {marketIndex.psvEurSmc.toFixed(4)} €
                </span>
                {marketIndex.psvChangePercent !== undefined && (
                  <span className={`inline-flex items-center text-[10px] font-bold ${
                    marketIndex.psvChangePercent > 0 
                      ? 'text-rose-600' 
                      : marketIndex.psvChangePercent < 0 
                        ? 'text-emerald-600' 
                        : 'text-slate-400'
                  }`}>
                    {marketIndex.psvChangePercent > 0 ? (
                      <TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" />
                    ) : marketIndex.psvChangePercent < 0 ? (
                      <TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" />
                    ) : null}
                    {marketIndex.psvChangePercent > 0 ? '+' : ''}{marketIndex.psvChangePercent}%
                  </span>
                )}
                <SlidersHorizontal className="h-3 w-3 text-slate-400 group-hover:text-[#635bff] ml-0.5" />
              </div>
            </div>

            {/* Refresh GME Feed Button */}
            {onRefreshMarketIndex && (
              <button
                type="button"
                onClick={onRefreshMarketIndex}
                disabled={isRefreshingMarketIndex}
                className="p-1.5 rounded-md border border-[#e3e8ee] bg-white hover:bg-slate-50 text-slate-500 hover:text-[#635bff] transition-colors disabled:opacity-50 cursor-pointer"
                title={`Aggiorna feed GME in tempo reale (Ultimo: ${marketIndex.lastUpdated})`}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshingMarketIndex ? 'animate-spin text-[#635bff]' : ''}`} />
              </button>
            )}
          </div>

          {!isCustomer && (
            <>
              <button
                onClick={onOpenBillOcr}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0a2540] shadow-2xs cursor-pointer transition-colors"
              >
                <FileSearch className="h-3.5 w-3.5 text-[#635bff]" />
                <span className="hidden sm:inline">OCR Bolletta</span>
              </button>

              {onOpenTotem && (
                <button
                  onClick={onOpenTotem}
                  className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#00d4aa]/40 bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 text-xs font-bold text-[#0a2540] shadow-2xs cursor-pointer transition-colors"
                  title="Attiva Totem Kiosk per il negozio o centro commerciale"
                >
                  <span>🖥️ Kiosk Point</span>
                </button>
              )}
            </>
          )}

          {/* Notification Center */}
          <NotificationCenter 
            onNavigateTab={setActiveTab} 
            userRole={currentUser.role} 
          />

          {/* User Profile & Role Switcher */}
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-2 pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity cursor-pointer text-left"
            title="Clicca per cambiare utente o ruolo"
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
              isCustomer ? 'bg-emerald-600' : 'bg-[#635bff]'
            }`}>
              {currentUser.avatar || (isCustomer ? 'CL' : 'CC')}
            </div>
            <div className="hidden md:block">
              <span className="text-xs font-semibold text-[#0a2540] block leading-none flex items-center gap-1">
                {currentUser.name}
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </span>
              <span className="text-[10px] text-slate-500 block leading-none mt-0.5 font-medium">
                {isCustomer ? 'Cliente Finale' : 'Operatore Call Center'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-6 text-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer -mb-px ${
                isActive
                  ? `${isCustomer ? 'border-emerald-600 text-emerald-700' : 'border-[#635bff] text-[#635bff]'}`
                  : 'border-transparent text-[#425466] hover:text-[#0a2540] hover:border-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? (isCustomer ? 'text-emerald-600' : 'text-[#635bff]') : 'text-slate-400'}`} strokeWidth={1.75} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-[#635bff] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};

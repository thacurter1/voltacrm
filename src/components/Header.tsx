import React, { useState } from 'react';
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
  TrendingDown,
  Coins,
  Menu,
  X,
  UserPlus
} from 'lucide-react';
import { AuthUser, MarketIndex } from '../types';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  marketIndex: MarketIndex;
  pendingSwitchesCount: number;
  pendingBillsCount: number;
  pendingCommissionsCount?: number;
  currentUser: AuthUser;
  onOpenCommandPalette: () => void;
  onOpenMarketSimulator: () => void;
  onOpenBillOcr: () => void;
  onOpenLogin: () => void;
  onOpenAddCustomer?: () => void;
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
  pendingCommissionsCount,
  currentUser,
  onOpenCommandPalette,
  onOpenMarketSimulator,
  onOpenBillOcr,
  onOpenLogin,
  onOpenAddCustomer,
  onOpenTotem,
  onRefreshMarketIndex,
  isRefreshingMarketIndex = false,
}) => {
  const isCustomer = currentUser.role === 'customer';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    { 
      id: 'commissions', 
      label: 'Provvigioni', 
      icon: Coins, 
      badge: pendingCommissionsCount && pendingCommissionsCount > 0 ? pendingCommissionsCount : undefined 
    },
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

  const handleMobileNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-[#e3e8ee] bg-white sticky top-0 z-40">
      {/* Top Level: Workspace, Search, Market Indicators & User */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Organization switcher */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0 ${
              isCustomer ? 'bg-emerald-600' : 'bg-[#635bff]'
            }`}>
              <Zap className="h-4 w-4 fill-white text-white" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-[#0a2540] tracking-tight whitespace-nowrap">Volta Energy</span>
              <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isCustomer ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {isCustomer ? 'PORTALE' : 'BACKEND'}
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

        {/* Right: Live Market Ticker, OCR & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Mobile PUN compact pill */}
          <div 
            onClick={onOpenMarketSimulator}
            className="flex sm:hidden items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-[#e3e8ee] text-[11px] cursor-pointer"
            title="Clicca per visualizzare simulatore e fasce F1/F2/F3"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-500 font-medium">PUN:</span>
            <span className="font-semibold text-[#0a2540] font-mono">
              {marketIndex.punEurKwh.toFixed(3)}€
            </span>
          </div>

          {/* Desktop/Tablet Live PUN & PSV Ticker */}
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
              {onOpenAddCustomer && (
                <button
                  type="button"
                  onClick={onOpenAddCustomer}
                  className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#635bff] hover:bg-[#5851ea] text-white text-xs font-bold shadow-2xs cursor-pointer transition-all active:scale-[0.99]"
                  title="Registra manualmente un nuovo cliente con relative forniture"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>+ Nuovo Cliente</span>
                </button>
              )}

              <button
                onClick={onOpenBillOcr}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e3e8ee] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0a2540] shadow-2xs cursor-pointer transition-colors"
              >
                <FileSearch className="h-3.5 w-3.5 text-[#635bff]" />
                <span>OCR Bolletta</span>
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
            className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 hover:opacity-80 transition-opacity cursor-pointer text-left"
            title="Clicca per cambiare utente o ruolo"
          >
            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
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

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg text-slate-600 hover:text-[#0a2540] hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={isMobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Desktop/Tablet Navigation Tabs */}
      <div className="hidden sm:flex max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto gap-6 text-sm">
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

      {/* Mobile Drawer / Full Navigation Sheet */}
      {isMobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-50 overflow-hidden">
          <div 
            className="fixed inset-0 bg-[#0a2540]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-xs bg-white shadow-2xl flex flex-col justify-between">
              {/* Drawer Top */}
              <div className="p-4 border-b border-[#e3e8ee] flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-white ${
                    isCustomer ? 'bg-emerald-600' : 'bg-[#635bff]'
                  }`}>
                    <Zap className="h-3.5 w-3.5 fill-white text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#0a2540]">Volta Energy</span>
                    <span className="block text-[10px] text-slate-500 font-medium">
                      {isCustomer ? 'Portale Risparmio' : 'CRM & Telemarketing'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Navigazione Principale
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMobileNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition-all text-left ${
                        isActive
                          ? `${isCustomer ? 'bg-emerald-50 text-emerald-700 font-bold' : 'bg-indigo-50 text-[#635bff] font-bold'}`
                          : 'text-[#425466] hover:bg-slate-50 hover:text-[#0a2540]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${isActive ? (isCustomer ? 'text-emerald-600' : 'text-[#635bff]') : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#635bff] text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Quick Tools for Mobile */}
                <div className="pt-4 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 mt-3">
                  Strumenti Rapidi
                </div>

                {!isCustomer && (
                  <>
                    {onOpenAddCustomer && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onOpenAddCustomer();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-50 text-[#635bff] hover:bg-indigo-100 font-bold mb-1 transition-colors text-left"
                      >
                        <UserPlus className="h-4 w-4 text-[#635bff]" />
                        <span>+ Nuovo Cliente & POD/PDR</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenCommandPalette();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                    >
                      <Search className="h-4 w-4 text-slate-400" />
                      <span>Cerca nel CRM (⌘K)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenBillOcr();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#0a2540] hover:bg-slate-50 font-medium"
                    >
                      <FileSearch className="h-4 w-4 text-[#635bff]" />
                      <span>OCR Scanner Bolletta</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenMarketSimulator();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-sky-500" />
                      <span>Simulatore Tariffe & Fasce</span>
                    </button>

                    {onOpenTotem && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          onOpenTotem();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-emerald-800 hover:bg-emerald-50/50 font-medium"
                      >
                        <span>🖥️</span>
                        <span>Totem Kiosk Point</span>
                      </button>
                    )}
                  </>
                )}

                {onRefreshMarketIndex && (
                  <button
                    type="button"
                    onClick={() => {
                      onRefreshMarketIndex();
                    }}
                    disabled={isRefreshingMarketIndex}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <RefreshCw className={`h-4 w-4 ${isRefreshingMarketIndex ? 'animate-spin text-[#635bff]' : 'text-slate-400'}`} />
                      <span>Aggiorna Feed GME</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{marketIndex.lastUpdated}</span>
                  </button>
                )}
              </div>

              {/* Drawer Bottom: User profile switch */}
              <div className="p-3 border-t border-[#e3e8ee] bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white border border-[#e3e8ee] shadow-2xs hover:border-[#635bff]/40 text-left"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    isCustomer ? 'bg-emerald-600' : 'bg-[#635bff]'
                  }`}>
                    {currentUser.avatar || (isCustomer ? 'CL' : 'CC')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-[#0a2540] block truncate">{currentUser.name}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{currentUser.email}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Navigation Bar (Thumb Friendly) */}
      <nav 
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e3e8ee] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-1 flex items-center justify-around"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      >
        {isCustomer ? (
          <>
            <button
              onClick={() => setActiveTab('customer_overview')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'customer_overview' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <ShieldCheck className="h-5 w-5 mb-0.5" />
              <span>Forniture</span>
            </button>

            <button
              onClick={() => setActiveTab('customer_upload')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'customer_upload' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <UploadCloud className="h-5 w-5 mb-0.5" />
              <span>Carica</span>
            </button>

            <button
              onClick={() => setActiveTab('customer_profile')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'customer_profile' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <User className="h-5 w-5 mb-0.5" />
              <span>Profilo</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'dashboard' ? 'text-[#635bff] font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <BarChart3 className="h-5 w-5 mb-0.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'leads' ? 'text-[#635bff] font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <Users className="h-5 w-5 mb-0.5" />
              <span>Lead</span>
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'crm' ? 'text-[#635bff] font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <ShieldCheck className="h-5 w-5 mb-0.5" />
              <span>Clienti</span>
            </button>

            <button
              onClick={() => setActiveTab('switch4m')}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors relative ${
                activeTab === 'switch4m' ? 'text-[#635bff] font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <RefreshCw className="h-5 w-5 mb-0.5" />
              <span>Switch 4M</span>
              {pendingSwitchesCount > 0 && (
                <span className="absolute top-0 right-1 h-2 w-2 rounded-full bg-[#635bff]" />
              )}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                isMobileMenuOpen ? 'text-[#635bff] font-bold' : 'text-slate-500 hover:text-[#0a2540]'
              }`}
            >
              <Menu className="h-5 w-5 mb-0.5" />
              <span>Menu</span>
            </button>
          </>
        )}
      </nav>
    </header>
  );
};


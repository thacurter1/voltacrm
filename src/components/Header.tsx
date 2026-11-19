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
  UserPlus,
  Monitor
} from 'lucide-react';
import { AuthUser, MarketIndex } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { VoltaBrandMark } from './common/VoltaBrandMark';

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
  demoSwitcher?: React.ReactNode;
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
  demoSwitcher,
}) => {
  const isCustomer = currentUser.role === 'customer';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: number;
  }

  const adminNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Panoramica', icon: BarChart3 },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'leads', label: 'Lead Marketing', icon: Users },
    { id: 'callcenter', label: 'Call Center & Agenda', icon: PhoneCall },
    { 
      id: 'inbox_bills', 
      label: 'Bollette Clienti', 
      icon: FileText,
      badge: pendingBillsCount > 0 ? pendingBillsCount : undefined
    },
    { id: 'crm', label: 'Clienti (POD/PDR)', icon: ShieldCheck },
    { id: 'portfolio', label: 'Portafoglio Guadagni', icon: TrendingUp },
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

  const brokerNavItems: NavItem[] = [
    { id: 'crm', label: 'I Miei Clienti', icon: ShieldCheck },
    { id: 'portfolio', label: 'Mio Portafoglio', icon: TrendingUp },
    { 
      id: 'commissions', 
      label: 'Le Mie Provvigioni', 
      icon: Coins, 
      badge: pendingCommissionsCount && pendingCommissionsCount > 0 ? pendingCommissionsCount : undefined 
    },
    { 
      id: 'switch4m', 
      label: 'Switch a 120gg', 
      icon: RefreshCw, 
      badge: pendingSwitchesCount > 0 ? pendingSwitchesCount : undefined 
    },
    { id: 'onboarding', label: 'Nuovo Cliente / OCR', icon: UserPlus },
    { id: 'tariffe', label: 'Comparatore Tariffe', icon: Zap },
  ];

  const callCenterNavItems: NavItem[] = [
    { id: 'callcenter', label: 'Agenda & Chiamate', icon: PhoneCall },
    { id: 'leads', label: 'Coda Lead Marketing', icon: Users },
    { 
      id: 'inbox_bills', 
      label: 'Bollette da Assegnare', 
      icon: FileText,
      badge: pendingBillsCount > 0 ? pendingBillsCount : undefined
    },
    { id: 'onboarding', label: 'Nuovo Contatto / OCR', icon: UserPlus },
  ];

  const customerNavItems: NavItem[] = [
    { id: 'customer_overview', label: 'Le Mie Forniture', icon: ShieldCheck },
    { id: 'customer_upload', label: 'Carica Nuova Bolletta', icon: UploadCloud },
    { id: 'customer_profile', label: 'Il Mio Profilo & GDPR', icon: User },
  ];

  const navItems: NavItem[] = isCustomer 
    ? customerNavItems 
    : currentUser.role === 'admin' 
    ? adminNavItems 
    : currentUser.role === 'call_center' 
    ? callCenterNavItems 
    : brokerNavItems;

  const handleMobileNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-[#DCE5E8] bg-white sticky top-0 z-40">
      {/* Skip to Main Content Link (WCAG 2.2 AA SC 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#0A6847] focus:text-white focus:font-bold focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Salta al contenuto principale
      </a>

      {/* Top Level: Petrol-Teal Volta Command Bar */}
      <div className="bg-[#0A3B40] text-white border-b border-[#072B2F]">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Organization switcher */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer group">
            <VoltaBrandMark className="h-8 w-8" inverted />
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-white tracking-tight whitespace-nowrap">Volta CRM</span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-white/10 text-[#A7F3D0] border border-white/15 text-[10px] font-bold">
                {isCustomer ? 'PORTALE' : currentUser.role === 'admin' ? 'DIREZIONE' : currentUser.role === 'call_center' ? 'CALL CENTER' : 'BROKER'}
              </span>
            </div>
          </div>

          {!isCustomer && (
            <>
              <div className="hidden xl:flex items-center h-5 w-px bg-white/15" />
              <button
                type="button"
                onClick={onOpenCommandPalette}
                aria-label="Cerca nel CRM o premi Ctrl+K"
                className="hidden xl:flex items-center w-44 2xl:w-56 h-8 px-2.5 rounded-md bg-[#072B2F] border border-white/20 text-xs text-[#B8CED1] hover:border-white/40 hover:text-white transition-all cursor-pointer justify-between shrink-0 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#34D399]"
              >
                <div className="flex items-center min-w-0">
                  <Search className="h-3.5 w-3.5 text-[#8FAEB3] mr-2 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">Cerca nel CRM...</span>
                </div>
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-[#D7E6E8] bg-white/10 rounded border border-white/15 shrink-0">
                  ⌘K
                </kbd>
              </button>
            </>
          )}
        </div>

        {/* Right: Live Market Ticker, OCR & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile/Tablet PUN compact */}
          <button 
            type="button"
            onClick={onOpenMarketSimulator}
            aria-label={`Visualizza simulatore indici: PUN a ${marketIndex.punEurKwh.toFixed(3)} euro`}
            className="flex lg:hidden items-center gap-1 px-2 py-1 rounded-md bg-[#072B2F] border border-white/20 text-[11px] cursor-pointer text-white whitespace-nowrap shrink-0"
            title="Clicca per visualizzare simulatore e fasce F1/F2/F3"
          >
            <span className="text-[#B8CED1] font-medium">PUN</span>
            <span className="font-semibold text-[#A7F3D0] font-mono tabular-nums">
              {marketIndex.punEurKwh.toFixed(3)}€
            </span>
          </button>

          {/* Desktop Live PUN & PSV Ticker */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            <button 
              type="button"
              onClick={onOpenMarketSimulator}
              aria-label={`Visualizza scenari e fasce: PUN ${marketIndex.punEurKwh.toFixed(4)} euro, PSV ${marketIndex.psvEurSmc.toFixed(4)} euro`}
              className="flex items-center gap-2 cursor-pointer group text-left p-0 border-0 bg-transparent"
              title={`Clicca per simulare scenari PUN/PSV o vedere fasce F1/F2/F3. Ultimo aggiornamento: ${marketIndex.lastUpdated}`}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#072B2F] border border-white/20 group-hover:border-white/40 text-xs transition-colors">
                <span className="text-[#B8CED1] font-medium">PUN</span>
                <span className="font-semibold text-[#A7F3D0] tabular-nums font-mono">
                  {marketIndex.punEurKwh.toFixed(4)}€
                </span>
                {marketIndex.punChangePercent !== undefined && (
                  <span className={`inline-flex items-center text-[10px] font-bold ${
                    marketIndex.punChangePercent > 0 
                      ? 'text-rose-300' 
                      : marketIndex.punChangePercent < 0 
                        ? 'text-emerald-300' 
                        : 'text-slate-300'
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

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#072B2F] border border-white/20 group-hover:border-white/40 text-xs transition-colors">
                <span className="text-[#B8CED1] font-medium">PSV</span>
                <span className="font-semibold text-white tabular-nums font-mono">
                  {marketIndex.psvEurSmc.toFixed(4)}€
                </span>
                {marketIndex.psvChangePercent !== undefined && (
                  <span className={`inline-flex items-center text-[10px] font-bold ${
                    marketIndex.psvChangePercent > 0 
                      ? 'text-rose-300' 
                      : marketIndex.psvChangePercent < 0 
                        ? 'text-emerald-300' 
                        : 'text-slate-300'
                  }`}>
                    {marketIndex.psvChangePercent > 0 ? (
                      <TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" />
                    ) : marketIndex.psvChangePercent < 0 ? (
                      <TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" />
                    ) : null}
                    {marketIndex.psvChangePercent > 0 ? '+' : ''}{marketIndex.psvChangePercent}%
                  </span>
                )}
                <SlidersHorizontal className="h-3 w-3 text-[#B8CED1] group-hover:text-white ml-0.5" />
              </div>
            </button>

            {onRefreshMarketIndex && (
              <button
                type="button"
                onClick={onRefreshMarketIndex}
                disabled={isRefreshingMarketIndex}
                aria-label="Aggiorna quotazioni PUN e PSV in tempo reale dal GME"
                className="p-1.5 rounded-md border border-white/20 bg-[#072B2F] hover:border-white/40 text-[#D7E6E8] hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                title={`Aggiorna feed GME in tempo reale (Ultimo: ${marketIndex.lastUpdated})`}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshingMarketIndex ? 'animate-spin text-[#34D399]' : ''}`} />
              </button>
            )}
          </div>

          {!isCustomer && (
            <>
              {onOpenAddCustomer && (
                <button
                  type="button"
                  onClick={onOpenAddCustomer}
                  aria-label="Registra manualmente un nuovo cliente"
                  className="hidden lg:inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#0A6847] hover:bg-[#085238] text-white text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  title="Registra manualmente un nuovo cliente con relative forniture"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0" />
                  <span>Nuovo Cliente</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenBillOcr}
                aria-label="Analisi e scansione OCR Bolletta"
                className="hidden xl:inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/25 bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <FileSearch className="h-3.5 w-3.5 text-[#A7F3D0] shrink-0" />
                <span>OCR Bolletta</span>
              </button>

              {onOpenTotem && (
                <button
                  type="button"
                  onClick={onOpenTotem}
                  aria-label="Attiva Totem Kiosk per negozio o punto vendita"
                  className="hidden 2xl:inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-white/25 bg-[#072B2F] hover:border-white/45 text-xs font-semibold text-white cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  title="Attiva Totem Kiosk per il negozio o centro commerciale"
                >
                  <Monitor className="h-3.5 w-3.5 text-[#A7F3D0] shrink-0" aria-hidden="true" />
                  <span>Totem</span>
                </button>
              )}
            </>
          )}

          {/* Discreet inline Demo Role Switcher ONLY in Staff/Demo */}
          {demoSwitcher}

          {/* Notification Center */}
          <div className="bg-white/10 rounded-md shrink-0">
            <NotificationCenter 
              onNavigateTab={setActiveTab} 
              userRole={currentUser.role} 
            />
          </div>

          {/* User Profile */}
          <button
            type="button"
            onClick={onOpenLogin}
            aria-label={`Profilo utente attuale: ${currentUser.name}. Clicca per cambiare profilo`}
            className="flex items-center gap-2 pl-2 border-l border-white/20 hover:opacity-85 transition-opacity cursor-pointer text-left shrink-0 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#34D399] rounded-r-md"
            title="Clicca per uscire o cambiare utente"
          >
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-[#0A6847] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {currentUser.avatar || (isCustomer ? 'CL' : 'CC')}
            </div>
            <div className="hidden lg:block max-w-[130px]">
              <span className="text-xs font-semibold text-white leading-none flex items-center gap-1">
                <span className="truncate">{currentUser.name}</span>
                <ChevronDown className="h-3 w-3 text-[#B8CED1] shrink-0" />
              </span>
              <span className="text-[10px] text-[#B8CED1] block leading-none mt-0.5 font-medium truncate">
                {isCustomer 
                  ? 'Cliente Finale' 
                  : currentUser.role === 'admin' 
                  ? 'Direzione' 
                  : currentUser.role === 'call_center' 
                  ? 'Call Center' 
                  : 'Broker'}
              </span>
            </div>
          </button>

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="sm:hidden p-2 rounded-md text-[#D7E6E8] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={isMobileMenuOpen ? 'Chiudi menu navigazione' : 'Apri menu navigazione'}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      </div>

      {/* Desktop/Tablet Navigation Tabs */}
      <nav aria-label="Navigazione principale" className="hidden sm:block bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scroll-smooth">
          <div role="tablist" className="flex items-center gap-4 md:gap-5 lg:gap-6 text-sm min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer -mb-px focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0A6847] ${
                    isActive
                      ? 'border-[#0A6847] text-[#0A6847]'
                      : 'border-transparent text-[#445966] hover:text-[#0F222D] hover:border-[#BDD0D6]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#0A6847]' : 'text-[#647B89]'}`} strokeWidth={1.75} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-[#0A6847] text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer / Full Navigation Sheet */}
      {isMobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-50 overflow-hidden">
          <div 
            className="fixed inset-0 bg-[#0F222D]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-xs bg-white shadow-2xl flex flex-col justify-between">
              {/* Drawer Top */}
              <div className="p-4 border-b border-[#DCE5E8] flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-white ${
                    isCustomer ? 'bg-emerald-600' : 'bg-[#0A6847]'
                  }`}>
                    <Zap className="h-3.5 w-3.5 fill-white text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#0F222D]">Volta Energia</span>
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
                          ? `${isCustomer ? 'bg-emerald-50 text-emerald-700 font-bold' : 'bg-[#EAF4F0] text-[#0A6847] font-bold'}`
                          : 'text-[#425466] hover:bg-slate-50 hover:text-[#0F222D]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4 w-4 ${isActive ? (isCustomer ? 'text-emerald-600' : 'text-[#0A6847]') : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#0A6847] text-white">
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
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#EAF4F0] text-[#0A6847] hover:bg-[#EAF4F0] font-bold mb-1 transition-colors text-left"
                      >
                        <UserPlus className="h-4 w-4 text-[#0A6847]" />
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#0F222D] hover:bg-slate-50 font-medium"
                    >
                      <FileSearch className="h-4 w-4 text-[#0A6847]" />
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#0F222D] hover:bg-[#EAF4F0] font-medium"
                      >
                        <Monitor className="h-4 w-4 text-[#0A6847]" />
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
                      <RefreshCw className={`h-4 w-4 ${isRefreshingMarketIndex ? 'animate-spin text-[#0A6847]' : 'text-slate-400'}`} />
                      <span>Aggiorna Feed GME</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{marketIndex.lastUpdated}</span>
                  </button>
                )}
              </div>

              {/* Drawer Bottom: User profile switch */}
              <div className="p-3 border-t border-[#DCE5E8] bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-white border border-[#DCE5E8] shadow-2xs hover:border-[#0A6847]/40 text-left"
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                    isCustomer ? 'bg-emerald-600' : 'bg-[#0A6847]'
                  }`}>
                    {currentUser.avatar || (isCustomer ? 'CL' : 'CC')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-[#0F222D] block truncate">{currentUser.name}</span>
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
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DCE5E8] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 py-1 flex items-center justify-around"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      >
        {isCustomer ? (
          <>
            <button
              onClick={() => setActiveTab('customer_overview')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'customer_overview' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-[#0F222D]'
              }`}
            >
              <ShieldCheck className="h-5 w-5 mb-0.5" />
              <span>Forniture</span>
            </button>

            <button
              onClick={() => setActiveTab('customer_upload')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'customer_upload' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-[#0F222D]'
              }`}
            >
              <UploadCloud className="h-5 w-5 mb-0.5" />
              <span>Carica</span>
            </button>

            <button
              onClick={() => setActiveTab('customer_profile')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === 'customer_profile' ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-[#0F222D]'
              }`}
            >
              <User className="h-5 w-5 mb-0.5" />
              <span>Profilo</span>
            </button>
          </>
        ) : (
          <>
            {navItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const hasBadge = item.id === 'switch4m' && pendingSwitchesCount > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors relative ${
                    isActive ? 'text-[#0A6847] font-bold' : 'text-slate-500 hover:text-[#0F222D]'
                  }`}
                >
                  <Icon className="h-5 w-5 mb-0.5" />
                  <span className="truncate max-w-[64px]">{item.label}</span>
                  {hasBadge && (
                    <span className="absolute top-0 right-1 h-2 w-2 rounded-full bg-[#0A6847]" />
                  )}
                </button>
              );
            })}

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-colors ${
                isMobileMenuOpen ? 'text-[#0A6847] font-bold' : 'text-slate-500 hover:text-[#0F222D]'
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


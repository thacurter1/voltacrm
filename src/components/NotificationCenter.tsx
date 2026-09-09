import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  Zap, 
  MapPin, 
  FileText, 
  ShieldAlert, 
  TrendingDown, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  X
} from 'lucide-react';
import { AppNotification, NotificationType } from '../types';
import { api } from '../api/client';

interface NotificationCenterProps {
  onNavigateTab?: (tab: string) => void;
  userRole?: string;
  onToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning') => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNavigateTab,
  userRole = 'call_center',
  onToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'switch' | 'totem' | 'security'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');
  const panelRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Play synthetic chime via Web Audio API (Zero external assets needed)
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext might be blocked until first user interaction
    }
  };

  // Carica le notifiche dal server/local API
  const loadNotifications = React.useCallback(async () => {
    try {
      const res = await api.notifications.getAll(userRole);
      setNotifications(res.notifications);
    } catch (err) {
      console.warn('Errore caricamento notifiche:', err);
    }
  }, [userRole]);

  useEffect(() => {
    loadNotifications();
    // Poll per aggiornamenti periodici ogni 30 secondi
    const interval: ReturnType<typeof setInterval> = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Chiudi cliccando fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const prev = [...notifications];
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
      await api.notifications.markRead(id);
    } catch {
      setNotifications(prev);
      if (onToast) onToast('Errore', 'Impossibile segnare la notifica come letta.', 'warning');
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await api.notifications.markAllRead();
    if (onToast) onToast('Notifiche Aggiornate', 'Tutte le notifiche sono state lette.', 'info');
  };

  const handleClearNotifications = async () => {
    const prev = [...notifications];
    setNotifications([]);
    try {
      await api.notifications.markAllRead(); // Best effort server side clear
      if (onToast) onToast('Notifiche Eliminate', 'Archivio notifiche svuotato.', 'info');
    } catch {
      setNotifications(prev);
      if (onToast) onToast('Errore', 'Impossibile eliminare le notifiche.', 'warning');
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    handleMarkAsRead(n.id);
    if (n.actionTab && onNavigateTab) {
      onNavigateTab(n.actionTab);
      setIsOpen(false);
    }
  };

  // Funzione demo: Simula arrivo notifica istantanea
  const handleSimulateNewNotification = () => {
    const demoItems: Partial<AppNotification>[] = [
      {
        type: 'totem_lead',
        title: '📍 Nuovo Lead Totem Milano',
        message: 'Un cliente al Totem ha richiesto analisi bolletta per spesa €180/mese.',
        priority: 'urgent',
        actionTab: 'leads'
      },
      {
        type: 'switch_due',
        title: '⚡ Scadenza Quadrimestrale Rilevata',
        message: 'Ristorante La Terrazza Srl: trovata offerta con risparmio di €420/anno.',
        priority: 'high',
        actionTab: 'switch4m'
      },
      {
        type: 'bill_uploaded',
        title: '📄 Nuova Bolletta Caricata',
        message: 'Cliente ha appena caricato una nuova bolletta Gas. OCR completato.',
        priority: 'normal',
        actionTab: 'inbox_bills'
      }
    ];

    const pick = demoItems[Math.floor(Math.random() * demoItems.length)];
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: pick.type as NotificationType,
      title: pick.title || 'Nuovo Avviso',
      message: pick.message || '',
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: (pick.priority as any) || 'high',
      actionTab: pick.actionTab
    };

    setNotifications(prev => [newNotif, ...prev]);
    playChime();

    // Trigger browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(newNotif.title, {
        body: newNotif.message,
        icon: '/favicon.ico'
      });
    }

    if (onToast) {
      onToast(newNotif.title, newNotif.message, 'info');
    }
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        new Notification('VoltaCRM Notifiche Attive', {
          body: 'Riceverai avvisi in tempo reale per nuovi lead Totem e scadenze switch.'
        });
      }
    }
  };

  // Filter items
  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'unread') return !n.isRead;
    if (activeFilter === 'switch') return n.type === 'switch_due';
    if (activeFilter === 'totem') return n.type === 'totem_lead';
    if (activeFilter === 'security') return n.type === 'security_alert';
    return true;
  });

  const getIconForType = (type: NotificationType) => {
    switch (type) {
      case 'totem_lead':
        return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'switch_due':
        return <Zap className="w-4 h-4 text-cyan-400" />;
      case 'bill_uploaded':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'security_alert':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'price_drop':
        return <TrendingDown className="w-4 h-4 text-emerald-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-indigo-400" />;
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diffMs = Date.now() - new Date(iso).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Adesso';
      if (diffMin < 60) return `${diffMin} min fa`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} ore fa`;
      return `${Math.floor(diffHours / 24)} gg fa`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg border border-[#e3e8ee] hover:bg-slate-50 text-slate-600 hover:text-[#0a2540] transition cursor-pointer"
        title="Centro Notifiche VoltaCRM"
        aria-label="Apri notifiche"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-[#635bff]' : 'text-slate-500'}`} />
        
        {unreadCount > 0 && (
          <span aria-live="polite" className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 text-slate-800">
          
          {/* Header */}
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#635bff] flex items-center justify-center text-white">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-tight">Centro Notifiche</h3>
                <p className="text-[10px] text-slate-400">
                  {unreadCount > 0 ? `${unreadCount} nuove notifiche operative` : 'Nessuna notifica non letta'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title={soundEnabled ? 'Disattiva audio avvisi' : 'Attiva audio avvisi'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSimulateNewNotification}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#635bff] hover:text-indigo-700 hover:underline cursor-pointer"
                title="Genera notifica istantanea di test"
              >
                <Sparkles className="w-3 h-3" />
                <span>Simula Notifica</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Segna tutte come lette"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Lette tutte</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearNotifications}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                  title="Svuota archivio"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-1.5 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2 py-0.5 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                activeFilter === 'all' 
                  ? 'bg-[#635bff] text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tutte ({notifications.length})
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-2 py-0.5 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                activeFilter === 'unread' 
                  ? 'bg-rose-500 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Non lette ({unreadCount})
            </button>
            <button
              onClick={() => setActiveFilter('totem')}
              className={`px-2 py-0.5 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                activeFilter === 'totem' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📍 Totem
            </button>
            <button
              onClick={() => setActiveFilter('switch')}
              className={`px-2 py-0.5 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                activeFilter === 'switch' 
                  ? 'bg-cyan-600 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⚡ Switch
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs font-medium text-slate-600">Nessuna notifica in questa vista</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Sei completamente aggiornato!</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 text-left transition cursor-pointer flex gap-3 items-start group ${
                    n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                  }`}
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    n.isRead ? 'bg-slate-100' : 'bg-white shadow-xs border border-slate-200'
                  }`}>
                    {getIconForType(n.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-xs font-semibold leading-tight truncate ${
                        n.isRead ? 'text-slate-800' : 'text-[#0a2540]'
                      }`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(n.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    {/* Action pill if available */}
                    {n.actionTab && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#635bff] group-hover:underline">
                          <span>Vai alla sezione</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                        {!n.isRead && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#635bff]" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mark as read quick button */}
                  {!n.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                      title="Segna come letta"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer: Browser Push Permission Banner */}
          {browserPermission !== 'granted' && (
            <div className="p-2.5 bg-slate-900 text-slate-200 text-[11px] flex items-center justify-between border-t border-slate-800">
              <span className="text-slate-300">Notifiche push desktop:</span>
              <button
                onClick={requestBrowserPermission}
                className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] transition cursor-pointer"
              >
                Abilita
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

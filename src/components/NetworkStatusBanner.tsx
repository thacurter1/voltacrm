import React, { useState } from 'react';
import { X, CloudOff } from 'lucide-react';
import { apiConfigStatus } from '../api/transport';

export const NetworkStatusBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useState(false);

  // If API is configured or banner was dismissed by user, do not display
  if (apiConfigStatus.isConfigured || isDismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-amber-950/90 border-b border-amber-500/30 text-amber-200 px-4 py-2 text-xs flex items-center justify-between shadow-sm relative z-50 backdrop-blur-sm"
    >
      <div className="flex items-center space-x-2">
        <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
        <div>
          <span className="font-semibold text-amber-300">Stato Backend Cloud: </span>
          <span>{apiConfigStatus.statusMessage || 'API Backend non raggiungibile.'}</span>
          <span className="ml-2 text-amber-400/80 hidden sm:inline">
            (L'applicazione opera in modalità demo locale con persistenza client).
          </span>
        </div>
      </div>
      <button
        onClick={() => setIsDismissed(true)}
        className="text-amber-400 hover:text-amber-200 p-1 rounded transition-colors"
        aria-label="Chiudi notifica diagnostica"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

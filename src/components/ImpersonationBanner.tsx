import React from 'react';
import { Eye, LogOut } from 'lucide-react';
import { AuthUser } from '../types';

interface ImpersonationBannerProps {
  currentUser: AuthUser;
  onReturnToCallCenter: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({
  currentUser,
  onReturnToCallCenter,
}) => {
  return (
    <div className="bg-amber-500 text-slate-900 border-b border-amber-600 px-4 py-2.5 shadow-sm sticky top-0 z-50 transition-all animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="p-1 rounded bg-slate-900 text-amber-400">
            <Eye className="h-3.5 w-3.5" />
          </span>
          <span>
            <strong>Modalità Simulazione Cliente:</strong> Stai visualizzando l'area riservata personale di <strong>{currentUser.name}</strong>.
          </span>
        </div>

        <button
          onClick={onReturnToCallCenter}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer w-fit active:scale-95"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Torna al Backend Call Center</span>
        </button>
      </div>
    </div>
  );
};

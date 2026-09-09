import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { ToastNotification } from '../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      onDismiss(toasts[0].id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            role="alert"
            aria-live="assertive"
            className="pointer-events-auto p-4 rounded-xl bg-white border border-[#e3e8ee] shadow-[0_10px_25px_rgba(0,0,0,0.08)] flex items-start gap-3 transition-all animate-in slide-in-from-top-2 duration-200"
          >
            {isSuccess && (
              <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 mt-0.5">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              </div>
            )}
            {isWarning && (
              <div className="p-1 rounded-md bg-amber-50 text-amber-600 mt-0.5">
                <AlertTriangle className="h-4 w-4" strokeWidth={2} />
              </div>
            )}
            {!isSuccess && !isWarning && (
              <div className="p-1 rounded-md bg-indigo-50 text-[#635bff] mt-0.5">
                <Info className="h-4 w-4" strokeWidth={2} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[#0a2540]">{toast.title}</h4>
              <p className="text-xs text-[#425466] mt-0.5 leading-relaxed">{toast.message}</p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

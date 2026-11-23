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
    // Bottom-right on tablet/desktop, above the Staff mobile tab bar on phones:
    // a toast must never cover the header or its navigation (QA 2026-11).
    <div
      data-testid="toast-region"
      className="fixed inset-x-4 bottom-20 z-[60] flex flex-col-reverse gap-2 pointer-events-none sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-full sm:max-w-sm"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            role={isWarning ? 'alert' : 'status'}
            aria-live={isWarning ? 'assertive' : 'polite'}
            className="pointer-events-auto py-3 pl-4 pr-1 rounded-[10px] bg-white border border-[#DCE5E8] shadow-[0_10px_25px_rgba(15,34,45,0.10)] flex items-start gap-3 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
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
              <div className="p-1 rounded-md bg-[#EAF4F0] text-[#0A6847] mt-0.5">
                <Info className="h-4 w-4" strokeWidth={2} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[#0F222D]">{toast.title}</h4>
              <p className="text-xs text-[#445966] mt-0.5 leading-relaxed">{toast.message}</p>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Chiudi notifica"
              className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#445966] hover:text-[#0F222D] hover:bg-[#F6F9FA] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0A6847]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

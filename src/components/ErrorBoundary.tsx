import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Errore catturato da ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8fafc] text-slate-900 p-4 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#635bff]/10 text-[#635bff]">
              <span className="text-xl font-black">⚡</span>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#635bff]">Volta Energia</span>
              <h2 className="text-xl font-extrabold text-[#0a2540]">Qualcosa non ha funzionato</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Si è verificato un problema imprevisto durante il caricamento del comparatore. Nessun dato contrattuale è andato perso.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-[#635bff] hover:bg-[#534be5] text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Ricarica la pagina
              </button>
              <button
                type="button"
                onClick={this.handleHome}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Torna al comparatore
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-1">
              <p>Hai bisogno di aiuto con la tua fornitura?</p>
              <p className="font-semibold text-slate-700">
                Numero Verde Gratuito: <a href="tel:800912345" className="text-[#635bff] underline">800 912 345</a> • <a href="mailto:supporto@voltaenergia.it" className="text-[#635bff] underline">supporto@voltaenergia.it</a>
              </p>
            </div>

            {this.state.error && (
              <details className="text-left text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <summary className="cursor-pointer font-semibold text-slate-700">Dettagli tecnici</summary>
                <p className="font-mono mt-1 break-words text-slate-600">
                  {this.state.error.toString()}
                </p>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

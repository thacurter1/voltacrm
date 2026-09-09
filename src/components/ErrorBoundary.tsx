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

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
            <h2 className="text-lg font-bold text-rose-600 mb-2">Ops! Qualcosa è andato storto.</h2>
            <p className="text-sm text-slate-600 mb-6">
              Si è verificato un errore imprevisto nell'applicazione.
            </p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-[#635bff] hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Ricarica la pagina
            </button>
            {this.state.error && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-slate-800 break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

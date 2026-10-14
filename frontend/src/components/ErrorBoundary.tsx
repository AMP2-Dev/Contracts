import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
    if (error?.name === 'QuotaExceededError' || error?.message?.toLowerCase().includes('quota')) {
      try {
        localStorage.removeItem('amp_projects');
      } catch (e) {}
    }
    this.setState({ errorInfo });
  }

  private handleSoftReload = () => {
    try {
      if (this.state.error?.name === 'QuotaExceededError' || this.state.error?.message?.toLowerCase().includes('quota')) {
        localStorage.removeItem('amp_projects');
      }
    } catch (e) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('amp_projects');
      localStorage.removeItem('amp_auth_session');
      localStorage.removeItem('amp_company_config');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-400">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Recuperação do Sistema</h2>
            <p className="text-sm text-slate-400 mb-4">
              Ocorreu uma instabilidade no carregamento do componente.
            </p>

            {this.state.error && (
              <div className="text-left bg-slate-950/80 border border-slate-700/80 rounded-xl p-3.5 mb-5 text-xs font-mono overflow-auto max-h-48 text-rose-300 select-text">
                <p className="font-bold text-rose-400 mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="text-[11px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {this.state.error.stack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleSoftReload}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                <span>Tentar Novamente</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
              >
                <RefreshCw size={16} />
                <span>Restaurar e Abrir Kanban</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

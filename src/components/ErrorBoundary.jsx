import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('iTransfer Runtime Error Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
          <div className="custom-card p-6 sm:p-8 max-w-lg w-full text-center animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-1">Something went wrong</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {this.state.error?.message || 'An unexpected client error occurred.'}
            </p>

            {this.state.error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-left text-[11px] font-mono text-rose-800 overflow-x-auto max-h-36">
                <p className="font-bold">{this.state.error.toString()}</p>
                {this.state.error.stack && (
                  <pre className="text-[10px] mt-1 text-rose-600">{this.state.error.stack}</pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="theme-btn-primary w-full py-3 text-xs font-bold shadow-md flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset & Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

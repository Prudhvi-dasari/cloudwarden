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
    console.error('SendToAnyone runtime error:', error, errorInfo);
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
        <div className="acct-ui acct-error-page">
          <div role="alert" className="ds-card acct-error-card">
            <span className="ds-icon acct-icon-warn" aria-hidden="true">
              <AlertTriangle />
            </span>
            <h2 className="ds-modal-title mt-4">Something went wrong</h2>
            <p className="acct-lead mt-2 text-sm">
              {this.state.error?.message || 'An unexpected client error occurred.'}
            </p>

            {this.state.error && (
              <div className="acct-error-trace mt-5">
                <p className="font-semibold text-[var(--ds-ink)]">{this.state.error.toString()}</p>
                {this.state.error.stack && (
                  <pre>{this.state.error.stack}</pre>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className="ds-btn ds-btn-dark ds-btn-lg w-full mt-5"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Reset and reload</span>
            </button>
            <p className="acct-hint mt-3">This clears what this site saved in your browser, including sign-in, then opens the home page.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

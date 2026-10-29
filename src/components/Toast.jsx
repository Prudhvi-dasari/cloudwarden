import { useState, useEffect, createContext, useContext } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="acct-ui acct-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="acct-toast">
            {toast.type === 'error' ? (
              <span className="ds-icon is-sm acct-icon-danger" aria-hidden="true"><AlertCircle /></span>
            ) : toast.type === 'info' ? (
              <span className="ds-icon is-sm is-blue" aria-hidden="true"><Info /></span>
            ) : (
              <span className="ds-icon is-sm is-green" aria-hidden="true"><CheckCircle2 /></span>
            )}
            <span className="acct-toast-msg">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              className="acct-toast-x"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg) => console.log('Toast:', msg),
    };
  }
  return context;
}

import { useState, useCallback } from "react";
import { ToastContext } from "./ToastContext";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 4000ms
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((msg) => addToast(msg, "success"), [addToast]);
  const error = useCallback((msg) => addToast(msg, "error"), [addToast]);
  const warning = useCallback((msg) => addToast(msg, "warning"), [addToast]);
  const info = useCallback((msg) => addToast(msg, "info"), [addToast]);

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={18} color="var(--color-success, #10B981)" />;
      case "error":
        return <XCircle size={18} color="var(--color-danger, #EF4444)" />;
      case "warning":
        return <AlertTriangle size={18} color="var(--color-warning, #F59E0B)" />;
      default:
        return <Info size={18} color="var(--color-primary, #6366F1)" />;
    }
  };

  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}

      {/* Floating Toasts Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-card--${toast.type}`}>
            <span className="toast-card__icon">{getIcon(toast.type)}</span>
            <span className="toast-card__message">{toast.message}</span>
            <button 
              className="toast-card__close-btn" 
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

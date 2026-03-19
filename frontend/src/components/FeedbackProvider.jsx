import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialogState, setDialogState] = useState(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map());

  const dismissToast = useCallback(id => {
    const timerId = toastTimersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      toastTimersRef.current.delete(id);
    }

    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  useEffect(() => () => {
    toastTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
    toastTimersRef.current.clear();
  }, []);

  const showToast = useCallback(({ title = "", message, type = "info", duration = 3200 }) => {
    if (!message) return null;

    const id = toastIdRef.current++;
    setToasts(current => [...current, { id, title, message, type }]);

    const timerId = window.setTimeout(() => {
      dismissToast(id);
    }, duration);

    toastTimersRef.current.set(id, timerId);
    return id;
  }, [dismissToast]);

  const closeDialog = useCallback(result => {
    setDialogState(current => {
      if (current?.resolve) {
        current.resolve(result);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!dialogState) return undefined;

    const handleKeyDown = event => {
      if (event.key === "Escape") {
        closeDialog(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, dialogState]);

  const confirm = useCallback(options => new Promise(resolve => {
    setDialogState({
      kind: "confirm",
      title: options?.title || "Confirm action",
      message: options?.message || "",
      confirmLabel: options?.confirmLabel || "Confirm",
      cancelLabel: options?.cancelLabel || "Cancel",
      variant: options?.variant || "primary",
      resolve
    });
  }), []);

  const showMessage = useCallback(options => new Promise(resolve => {
    setDialogState({
      kind: "message",
      title: options?.title || "Notice",
      message: options?.message || "",
      confirmLabel: options?.confirmLabel || "Close",
      variant: options?.variant || "primary",
      resolve
    });
  }), []);

  const value = useMemo(() => ({
    showToast,
    confirm,
    showMessage
  }), [confirm, showMessage, showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-card is-${toast.type}`} role="status">
            <div className="toast-copy">
              {toast.title ? <strong className="toast-title">{toast.title}</strong> : null}
              <span className="toast-message">{toast.message}</span>
            </div>
            <button className="toast-close-btn" type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              x
            </button>
          </div>
        ))}
      </div>

      {dialogState ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={dialogState.title} onClick={() => closeDialog(false)}>
          <div className="modal-card confirm-modal-card" onClick={event => event.stopPropagation()}>
            <div>
              <h3 className="confirm-modal-title">{dialogState.title}</h3>
              <p className="confirm-modal-message feedback-dialog-message">{dialogState.message}</p>
            </div>

            <div className="confirm-modal-actions">
              {dialogState.kind === "confirm" ? (
                <button className="btn confirm-cancel-btn" type="button" onClick={() => closeDialog(false)}>
                  {dialogState.cancelLabel}
                </button>
              ) : null}

              <button
                className={`btn ${dialogState.variant === "danger" ? "confirm-danger-btn" : "primary"}`}
                type="button"
                onClick={() => closeDialog(true)}
              >
                {dialogState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider.");
  }

  return context;
}

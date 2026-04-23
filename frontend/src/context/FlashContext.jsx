import { createContext, useContext, useState, useCallback } from 'react';

const FlashContext = createContext();

export function FlashProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Legacy setFlash({ tone, text }) + new addToast({ tone, text, duration })
  const setFlash = useCallback(({ tone = 'info', text, duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, text }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const clearToasts = useCallback(() => { setToasts([]); }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <FlashContext.Provider value={{ setFlash, toasts, dismiss, clearToasts }}>
      {children}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}

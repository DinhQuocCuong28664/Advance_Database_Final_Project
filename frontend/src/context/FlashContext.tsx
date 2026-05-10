import { useState, useCallback } from 'react';
import type React from 'react';
import { FlashContext, type FlashToast } from './useFlash';

export function FlashProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<FlashToast[]>([]);

  // Legacy setFlash({ tone, text }) + new addToast({ tone, text, duration })
  const setFlash = useCallback(({ tone = 'info', text, duration = 4000 }: { tone?: string; text: string; duration?: number }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, text }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const clearToasts = useCallback(() => { setToasts([]); }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <FlashContext.Provider value={{ setFlash, toasts, dismiss, clearToasts }}>
      {children}
    </FlashContext.Provider>
  );
}

import { createContext, useContext } from 'react';

export type FlashTone = 'success' | 'error' | 'warning' | 'info' | string;

export type FlashToast = {
  id: number;
  tone: FlashTone;
  text: string;
};

export type FlashContextValue = {
  setFlash: (message: { tone?: FlashTone; text: string; duration?: number }) => void;
  toasts: FlashToast[];
  dismiss: (id: number) => void;
  clearToasts: () => void;
};

export const FlashContext = createContext<FlashContextValue>({
  setFlash: () => {},
  toasts: [],
  dismiss: () => {},
  clearToasts: () => {},
});

export function useFlash() {
  return useContext(FlashContext);
}

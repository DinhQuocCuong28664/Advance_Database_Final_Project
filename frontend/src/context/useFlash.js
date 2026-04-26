import { createContext, useContext } from 'react';

export const FlashContext = createContext();

export function useFlash() {
  return useContext(FlashContext);
}

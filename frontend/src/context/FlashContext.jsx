import { createContext, useContext, useState } from 'react';

const FlashContext = createContext();

export function FlashProvider({ children }) {
  const [flash, setFlash] = useState(null);

  return (
    <FlashContext.Provider value={{ flash, setFlash }}>
      {children}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}

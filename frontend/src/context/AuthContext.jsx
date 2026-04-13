import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { AUTH_STORAGE_KEY } from '../constants';

const AuthContext = createContext();

const readStoredSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredSession = (session) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const clearStoredSession = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export function AuthProvider({ children }) {
  const [authSession, setAuthSession] = useState(() => readStoredSession());
  const [authBusy, setAuthBusy] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [guestPromotions, setGuestPromotions] = useState([]);

  const isSystemUser = authSession?.user?.user_type === 'SYSTEM_USER';
  const isGuestUser = authSession?.user?.user_type === 'GUEST';
  const guestAccounts = authSession?.user?.loyalty_accounts || [];

  // Sync session on token change — refresh user profile plus role-specific data
  useEffect(() => {
    async function syncSession() {
      if (!authSession?.token) {
        setAlerts([]);
        setGuestPromotions([]);
        return;
      }

      try {
        const payload = await apiRequest('/auth/me');
        const nextSession = { token: authSession.token, user: payload.user };
        setAuthSession(nextSession);
        writeStoredSession(nextSession);

        if (payload.user.user_type === 'SYSTEM_USER') {
          const alertPayload = await apiRequest('/admin/rates/alerts');
          setAlerts(alertPayload.data || []);
          setGuestPromotions([]);
        } else {
          const promotionPayload = await apiRequest('/promotions');
          setAlerts([]);
          setGuestPromotions(promotionPayload.data || []);
        }
      } catch {
        setAuthSession(null);
        clearStoredSession();
        setAlerts([]);
        setGuestPromotions([]);
      }
    }

    syncSession();
  }, [authSession?.token]);

  async function login(credentials) {
    setAuthBusy('login');
    try {
      const payload = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      const nextSession = { token: payload.token, user: payload.user };
      setAuthSession(nextSession);
      writeStoredSession(nextSession);

      if (payload.user.user_type === 'SYSTEM_USER') {
        const alertPayload = await apiRequest('/admin/rates/alerts', {
          headers: { Authorization: `Bearer ${payload.token}` },
        });
        setAlerts(alertPayload.data || []);
      } else {
        const promoPayload = await apiRequest('/promotions', {
          headers: { Authorization: `Bearer ${payload.token}` },
        });
        setGuestPromotions(promoPayload.data || []);
      }

      return { success: true, user: payload.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function registerGuest(data) {
    setAuthBusy('register');
    try {
      const payload = await apiRequest('/auth/guest/register', {
        method: 'POST',
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          login_email: data.login_email,
          password: data.password,
          phone_country_code: data.phone_country_code || null,
          phone_number: data.phone_number || null,
        }),
      });

      const nextSession = { token: payload.token, user: payload.user };
      setAuthSession(nextSession);
      writeStoredSession(nextSession);

      return { success: true, user: payload.user };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  function logout() {
    setAuthSession(null);
    clearStoredSession();
    setAlerts([]);
    setGuestPromotions([]);
  }

  return (
    <AuthContext.Provider value={{
      authSession,
      authBusy,
      isSystemUser,
      isGuestUser,
      guestAccounts,
      alerts,
      guestPromotions,
      login,
      registerGuest,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

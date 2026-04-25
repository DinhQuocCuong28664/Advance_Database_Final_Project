import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { AUTH_STORAGE_KEY } from '../constants';

const AuthContext = createContext();

function readStoredSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [authSession, setAuthSession] = useState(() => readStoredSession());
  const [authBusy, setAuthBusy] = useState('');

  const isSystemUser   = authSession?.user?.user_type === 'SYSTEM_USER';
  const isGuestUser    = authSession?.user?.user_type === 'GUEST';
  const guestAccounts  = authSession?.user?.loyalty_accounts || [];
  const systemRoles    = Array.isArray(authSession?.user?.roles) ? authSession.user.roles : [];
  const hasSystemRole  = (roleCode) => systemRoles.includes(roleCode);
  const isAdminUser    = isSystemUser && hasSystemRole('ADMIN');
  const isCashierUser  = isSystemUser && (hasSystemRole('CASHIER') || hasSystemRole('FRONT_DESK'));

  useEffect(() => {
    async function syncSession() {
      if (!authSession?.token) return;

      try {
        const payload = await apiRequest('/auth/me');
        const nextSession = { token: authSession.token, user: payload.user };
        setAuthSession(nextSession);
        writeStoredSession(nextSession);
      } catch {
        setAuthSession(null);
        clearStoredSession();
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
      return { success: true, ...payload };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function verifyGuestEmail(data) {
    setAuthBusy('verify-email');
    try {
      const payload = await apiRequest('/auth/guest/verify-email', {
        method: 'POST',
        body: JSON.stringify(data),
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

  async function resendGuestVerification(data) {
    setAuthBusy('resend-email');
    try {
      const payload = await apiRequest('/auth/guest/resend-verification', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function forgotGuestPassword(data) {
    setAuthBusy('forgot-password');
    try {
      const payload = await apiRequest('/auth/guest/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function resetGuestPassword(data) {
    setAuthBusy('reset-password');
    try {
      const payload = await apiRequest('/auth/guest/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function changePassword(data) {
    setAuthBusy('change-password');
    try {
      const payload = await apiRequest('/auth/guest/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  function logout() {
    setAuthSession(null);
    clearStoredSession();
  }

  return (
    <AuthContext.Provider
      value={{
        authSession,
        authBusy,
        isSystemUser,
        isGuestUser,
        isAdminUser,
        isCashierUser,
        guestAccounts,
        login,
        registerGuest,
        verifyGuestEmail,
        resendGuestVerification,
        forgotGuestPassword,
        resetGuestPassword,
        changePassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

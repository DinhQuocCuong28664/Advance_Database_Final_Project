import { createContext, useContext, useEffect, useState } from 'react';
import type React from 'react';
import { apiRequest } from '../lib/api';
import { AUTH_STORAGE_KEY } from '../constants';

type AuthContextValue = {
  authSession?: any;
  authBusy?: string;
  isSystemUser?: boolean;
  isGuestUser?: boolean;
  isAdminUser?: boolean;
  isManagerUser?: boolean;
  isCashierUser?: boolean;
  isFrontDeskUser?: boolean;
  isHkManagerUser?: boolean;
  guestAccounts?: any[];
  login?: (credentials: any) => Promise<any>;
  registerGuest?: (data: any) => Promise<any>;
  verifyGuestEmail?: (data: any) => Promise<any>;
  resendGuestVerification?: (data: any) => Promise<any>;
  forgotGuestPassword?: (data: any) => Promise<any>;
  resetGuestPassword?: (data: any) => Promise<any>;
  changePassword?: (data: any) => Promise<any>;
  logout?: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  authSession: null,
  authBusy: '',
  isSystemUser: false,
  isGuestUser: false,
  isAdminUser: false,
  isManagerUser: false,
  isCashierUser: false,
  isFrontDeskUser: false,
  isHkManagerUser: false,
  guestAccounts: [],
  login: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  registerGuest: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  verifyGuestEmail: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  resendGuestVerification: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  forgotGuestPassword: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  resetGuestPassword: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  changePassword: async () => ({ success: false, error: 'Auth provider is not mounted.' }),
  logout: () => {},
});

function readStoredSession(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: any) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authSession, setAuthSession] = useState(() => readStoredSession());
  const [authBusy, setAuthBusy] = useState('');

  const isSystemUser   = authSession?.user?.user_type === 'SYSTEM_USER';
  const isGuestUser    = authSession?.user?.user_type === 'GUEST';
  const guestAccounts  = authSession?.user?.loyalty_accounts || [];
  const systemRoles    = Array.isArray(authSession?.user?.roles) ? authSession.user.roles : [];
  const hasSystemRole  = (roleCode: string) => systemRoles.includes(roleCode);
  const isAdminUser    = isSystemUser && hasSystemRole('ADMIN');
  const isManagerUser  = isSystemUser && hasSystemRole('MANAGER');
  const isCashierUser  = isSystemUser && hasSystemRole('CASHIER');
  const isFrontDeskUser= isSystemUser && hasSystemRole('FRONT_DESK');
  const isHkManagerUser= isSystemUser && hasSystemRole('HK_MANAGER');

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

  async function login(credentials: any) {
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
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function registerGuest(data: any) {
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
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function verifyGuestEmail(data: any) {
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
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function resendGuestVerification(data: any) {
    setAuthBusy('resend-email');
    try {
      const payload = await apiRequest('/auth/guest/resend-verification', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function forgotGuestPassword(data: any) {
    setAuthBusy('forgot-password');
    try {
      const payload = await apiRequest('/auth/guest/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function resetGuestPassword(data: any) {
    setAuthBusy('reset-password');
    try {
      const payload = await apiRequest('/auth/guest/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      setAuthBusy('');
    }
  }

  async function changePassword(data: any) {
    setAuthBusy('change-password');
    try {
      const payload = await apiRequest('/auth/guest/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { success: true, ...payload };
    } catch (error: any) {
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
        isManagerUser,
        isCashierUser,
        isFrontDeskUser,
        isHkManagerUser,
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

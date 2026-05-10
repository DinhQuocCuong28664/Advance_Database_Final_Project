const explicitBase = import.meta.env.VITE_API_BASE_URL?.trim();

type ApiPayload = Record<string, any>;

function resolveBaseUrl() {
  if (explicitBase) {
    return explicitBase.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    if (window.location.port === '3000') {
      return `${window.location.origin}/api/v1`;
    }

    return '/api/v1';
  }

  return 'http://localhost:3000/api/v1';
}

export const API_BASE_URL = resolveBaseUrl();
const AUTH_STORAGE_KEY = 'luxereserve_auth';

function getStoredToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const session = JSON.parse(stored) as { token?: string } | null;
    return session?.token || null;
  } catch {
    return null;
  }
}

function readError(payload: ApiPayload, status: number) {
  const error = payload.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof payload.message === 'string') return payload.message;
  return `Request failed with status ${status}`;
}

export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const hasJsonBody = options.body && !headers.has('Content-Type');
  const token = getStoredToken();

  if (hasJsonBody) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const rawText = await response.text();
  let payload: ApiPayload = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as ApiPayload;
    } catch {
      payload = { error: rawText };
    }
  }

  if (!response.ok || payload.success === false) {
    throw new Error(readError(payload, response.status));
  }

  return payload as T;
}

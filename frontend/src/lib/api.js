const explicitBase = import.meta.env.VITE_API_BASE_URL?.trim();

function resolveBaseUrl() {
  if (explicitBase) {
    return explicitBase.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:3000/api';
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

    const session = JSON.parse(stored);
    return session?.token || null;
  } catch {
    return null;
  }
}

export async function apiRequest(path, options = {}) {
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
  let payload = {};

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { error: rawText };
    }
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

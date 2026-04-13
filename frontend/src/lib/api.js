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

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasJsonBody = options.body && !headers.has('Content-Type');

  if (hasJsonBody) {
    headers.set('Content-Type', 'application/json');
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

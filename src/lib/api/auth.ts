import { createApiClient } from './client';
import { normalizeApiError } from '$lib/api/errors';
import type { components } from '$lib/api/schema';

type ApiClient = Awaited<ReturnType<typeof createApiClient>>;
type ApiResponse<T> = { data?: T; error?: unknown; response: Response };
type ApiCall<T> = (client: ApiClient, authHeaders: HeadersInit) => Promise<ApiResponse<T>>;

const SESSION_EXPIRED_MSG = 'Sesja wygasła, zaloguj się ponownie';

let currentAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let sessionExpired = false;
let toastEmitted = false;

function getStoredToken(): string | null {
  return currentAccessToken;
}

function storeToken(token: string) {
  currentAccessToken = token;
  sessionExpired = false;
  toastEmitted = false;
}

function emitSessionExpiredToast() {
  if (toastEmitted || typeof window === 'undefined') return;
  toastEmitted = true;
  window.dispatchEvent(
    new CustomEvent('toast', {
      detail: { type: 'error', msg: SESSION_EXPIRED_MSG }
    })
  );
}

function markSessionExpired() {
  currentAccessToken = null;
  sessionExpired = true;
  emitSessionExpiredToast();
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const token = data?.access_token;
    if (!token) return null;

    storeToken(token);
    return token;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function buildAuthHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(
  call: ApiCall<T>,
  options?: { auth?: boolean; token?: string | null }
): Promise<ApiResponse<T>> {
  if (sessionExpired) {
    emitSessionExpiredToast();
    throw new Error(SESSION_EXPIRED_MSG);
  }

  const client = await createApiClient();
  const useAuth = options?.auth !== false;
  const token = useAuth ? options?.token ?? getStoredToken() : null;

  let result = await call(client, buildAuthHeaders(token));
  if (!useAuth || result.response.status !== 401) {
    return result;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    markSessionExpired();
    throw new Error(SESSION_EXPIRED_MSG);
  }

  result = await call(client, buildAuthHeaders(refreshed));
  if (result.response.status === 401) {
    markSessionExpired();
    throw new Error(SESSION_EXPIRED_MSG);
  }

  return result;
}

type SetPasswordPayload = components['schemas']['SetPasswordRequest'];

export async function setPassword(payload: SetPasswordPayload): Promise<void> {
  const { error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/auth/set-password', {
        body: payload,
        headers
      }),
    { auth: false }
  );

  if (response.status === 204) {
    return;
  }

  throw normalizeApiError(error, 'Failed to set password', response.status);
}

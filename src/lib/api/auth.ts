import { createApiClient } from './client';

type ApiClient = Awaited<ReturnType<typeof createApiClient>>;
type ApiResponse<T> = { data?: T; error?: unknown; response: Response };
type ApiCall<T> = (client: ApiClient, authHeaders: HeadersInit) => Promise<ApiResponse<T>>;

const SESSION_EXPIRED_MSG = 'Sesja wygasła, zaloguj się ponownie';

let refreshPromise: Promise<string | null> | null = null;
let sessionExpired = false;
let toastEmitted = false;

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function storeToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', token);
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
  const token = useAuth ? (options?.token ?? getStoredToken()) : null;

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

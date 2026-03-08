import { redirect, type RequestEvent } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { decodeJwt } from '$lib/jwt';

type RefreshResponse = {
  access_token?: string;
};

function isTokenValid(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload) return false;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return false;
  }

  return true;
}

async function refreshAccessToken(
  fetch: RequestEvent['fetch'],
  cookies: RequestEvent['cookies'],
  request: RequestEvent['request']
): Promise<string | undefined> {
  const API_INTERNAL = process.env.INTERNAL_API_BASE ?? 'http://localhost:8000';

  const res = await fetch(`${API_INTERNAL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      cookie: request.headers.get('cookie') ?? ''
    }
  });

  if (!res.ok) return undefined;

  const data = (await res.json().catch(() => null)) as RefreshResponse | null;
  const token = data?.access_token;
  if (!token) return undefined;

  cookies.set('access_token_client', token, {
    path: '/',
    sameSite: 'lax'
  });

  return token;
}

function clearAccessCookie(cookies: RequestEvent['cookies']) {
  cookies.delete('access_token_client', { path: '/' });
}

export const load: LayoutServerLoad = async ({ cookies, request, fetch }) => {
  if (request.method !== 'GET') {
    return {};
  }

  let token = cookies.get('access_token_client');

  if (!token || !isTokenValid(token)) {
    token = await refreshAccessToken(fetch, cookies, request);
  }

  if (!token || !isTokenValid(token)) {
    clearAccessCookie(cookies);
    throw redirect(302, '/login');
  }

  return {};
};

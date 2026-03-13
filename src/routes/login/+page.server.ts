import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { propagateBackendAuthCookies, setAccessTokenCookie } from '$lib/server/auth-cookies';

/**
 * Nie sprawdzamy żadnej konfiguracji runtime.
 * Jeśli /api działa – proxy działa.
 * Jeśli nie – request się wywali i to jest OK.
 */
export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');
    const API_INTERNAL = process.env.INTERNAL_API_BASE ?? 'http://localhost:8000';

    if (typeof username !== 'string' || typeof password !== 'string') {
      return fail(400, { error: 'Podaj login i hasło' });
    }

    let res: Response;

    try {
      res = await fetch(`${API_INTERNAL}/api/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ username, password })
      });
    } catch (err) {
      if (err instanceof Response) throw err;
      console.error('Login action error', err);
      return fail(500, { error: 'Błąd podczas logowania' });
    }

    if (!res.ok) {
      return fail(401, { error: 'Nieprawidłowy login lub hasło' });
    }

    const data = await res.json();
    const accessToken = data?.access_token;

    if (!accessToken) {
      return fail(500, { error: 'Brak tokenu w odpowiedzi backendu' });
    }

    setAccessTokenCookie(cookies, accessToken);
    propagateBackendAuthCookies(res.headers, cookies);

    throw redirect(303, '/');
  }
};

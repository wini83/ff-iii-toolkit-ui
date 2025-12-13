import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';

/**
 * Nie sprawdzamy żadnej konfiguracji runtime.
 * Jeśli /api działa – proxy działa.
 * Jeśli nie – request się wywali i to jest OK.
 */
export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  default: async ({ request, fetch }) => {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');

    if (typeof username !== 'string' || typeof password !== 'string') {
      return fail(400, { error: 'Podaj login i hasło' });
    }

    try {
      /**
       * KLUCZOWE:
       * - używamy RELATIVE URL
       * - zero API_BASE
       * - dokładnie ten sam kontrakt co w browserze
       */
      //const res = await fetch('/api/auth/token', {
      const res = await fetch('http://ff-iii-toolkit-api:8000/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ username, password })
      });

      if (!res.ok) {
        return fail(401, { error: 'Nieprawidłowy login lub hasło' });
      }

      const data = await res.json();
      const accessToken = data?.access_token;

      if (!accessToken) {
        return fail(500, { error: 'Brak tokenu w odpowiedzi backendu' });
      }

      /**
       * Token przekazujemy do klienta przez form result.
       * To UI decyduje co z nim zrobić (localStorage).
       * Cookies NIE są tu potrzebne.
       */
      return {
        success: true,
        token: accessToken
      };
    } catch (err) {
      console.error('Login action error', err);
      return fail(500, { error: 'Błąd podczas logowania' });
    }
  }
};

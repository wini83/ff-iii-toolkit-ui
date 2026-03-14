import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const token = cookies.get('access_token');
  const API_INTERNAL = process.env.INTERNAL_API_BASE ?? 'http://localhost:8000';

  if (!token) {
    throw redirect(302, '/');
  }

  const response = await fetch(`${API_INTERNAL}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw redirect(302, '/');
  }

  const me = (await response.json().catch(() => null)) as { is_superuser?: boolean } | null;

  if (!me || me.is_superuser !== true) {
    throw redirect(302, '/');
  }

  return {};
};

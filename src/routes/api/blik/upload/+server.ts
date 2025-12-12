console.log('HIT /blik/upload +server.ts');
import { json, type RequestEvent } from '@sveltejs/kit';

export const config = {
  csrf: false
};

export function OPTIONS({ request }) {
  const origin = request.headers.get('origin') ?? '';

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin'
    }
  });
}

export async function POST({ request, cookies }: RequestEvent) {
  const API_BASE = process.env.API_BASE;
  if (!API_BASE) {
    return json({ error: 'API_BASE missing on server' }, { status: 500 });
  }

  const token = cookies.get('access_token_client');
  if (!token) {
    return json({ error: 'Brak tokenu w cookies' }, { status: 401 });
  }

  const formData = await request.formData();

  try {
    // bezpośrednie proxy do backendu
    const res = await fetch(`${API_BASE}/api/blik_files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    return json(data, { status: res.status });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
}

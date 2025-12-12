import { json, type RequestEvent } from '@sveltejs/kit';

const API_BASE = process.env.API_BASE!;

export async function GET({ params, cookies }: RequestEvent) {
  const token = cookies.get("access_token_client");
  if (!token) {
    return json({ error: "Brak tokenu w cookies" }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/blik_files/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    return json(data, { status: res.status });
  } catch (e: any) {
    return json({ error: e.message ?? "API error" }, { status: 500 });
  }
}

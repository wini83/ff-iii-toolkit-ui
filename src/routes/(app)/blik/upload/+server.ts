import { json, type RequestEvent } from '@sveltejs/kit';

const API_BASE = process.env.API_BASE;

export async function POST({ request, cookies }: RequestEvent) {
  if (!API_BASE) {
    return json({ error: "API_BASE missing on server" }, { status: 500 });
  }

  const token = cookies.get("access_token_client");
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

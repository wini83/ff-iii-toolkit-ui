import { API_BASE } from "$lib/config";

export const actions = {
  default: async ({ request, cookies, fetch }) => {
    const formData = await request.formData();

    const token = cookies.get("access_token_client");
    if (!token) {
      return { error: "Brak tokenu w cookies" };
    }

    const res = await fetch(`${API_BASE}/api/blik_files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();
    return data;
  }
};

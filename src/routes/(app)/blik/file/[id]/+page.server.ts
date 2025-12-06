import type { PageServerLoad } from "./$types";
import { API_BASE } from "$lib/config";

interface ApiErrorDetail {
    msg: string;
    loc?: string[];
    type?: string;
}

export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const id = params.id;

  const token = cookies.get("access_token_client");
  if (!token) {
    return { error: "Brak tokenu w cookies", file_id: id, decoded_name: "", size: 0, content: [] };
  }

  const res = await fetch(`${API_BASE}/api/blik_files/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    // spróbuj odczytać ciało błędu jeśli jest
    let errMsg = `Błąd API: ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) errMsg = Array.isArray(errJson.detail) ? errJson.detail.map((d:ApiErrorDetail) => d.msg).join("; ") : JSON.stringify(errJson);
    } catch (e) { /* ignore */ }

    return { error: errMsg, file_id: id, decoded_name: "", size: 0, content: [] };
  }

  // oczekujemy struktury zgodnej z twoim przykładem
  const data = await res.json();

  // defensywne mapowanie defaultów
  return {
    error: null,
    file_id: data.file_id ?? id,
    decoded_name: data.decoded_name ?? "",
    size: typeof data.size === "number" ? data.size : 0,
    content: Array.isArray(data.content) ? data.content : []
  };
};

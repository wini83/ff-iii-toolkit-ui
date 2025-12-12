import type { PageServerLoad } from "./$types";


export const load: PageServerLoad = async ({ params, cookies, fetch }) => {
  const id = params.id;
  const token = cookies.get("access_token_client");

  if (!token) {
    return {
      error: "Brak tokenu w cookies",
      file_id: id,
      decoded_name: "",
      size: 0,
      content: []
    };
  }

  const res = await fetch(`/blik/file/${id}`);
  const data = await res.json();

  if (res.ok && !data.error) {
    return {
      error: null,
      file_id: data.file_id,
      decoded_name: data.decoded_name,
      size: data.size,
      content: data.content
    };
  }

  return {
    error: data.error ?? "Błąd API",
    file_id: id,
    decoded_name: "",
    size: 0,
    content: []
  };
};

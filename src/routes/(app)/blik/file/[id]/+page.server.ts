import type { PageServerLoad } from "./$types";
import { blik } from "$lib/api/blik";

export const load: PageServerLoad = async ({ params, cookies }) => {
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

  try {
    const data = await blik.getPreview(id, token);

    return {
      error: null,
      file_id: data.file_id,
      decoded_name: data.decoded_name,
      size: data.size,
      content: data.content
    };
  } catch (e: any) {
    return {
      error: e.message ?? "Błąd API",
      file_id: id,
      decoded_name: "",
      size: 0,
      content: []
    };
  }
};

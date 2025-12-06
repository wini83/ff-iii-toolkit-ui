import { blik } from "$lib/api/blik"; // jeśli eksportujemy default/namespace
// lub: import * as blik from "$lib/api/blik";

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();

    const token = cookies.get("access_token_client");
    if (!token) {
      return { error: "Brak tokenu w cookies" };
    }

    try {
      const data = await blik.uploadCsv(formData, token);
      return data; // UploadResponse
    } catch (e: any) {
      return { error: e.message ?? "Upload failed" };
    }
  }
};
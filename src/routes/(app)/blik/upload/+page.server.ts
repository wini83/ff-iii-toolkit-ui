import { api } from "$lib/api/client";

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();

    const token = cookies.get("access_token_client");
    if (!token) {
      return { error: "Brak tokenu w cookies" };
    }

    const { data, error } = await api.POST("/api/blik_files", {
      // openapi-typescript nie wspiera poprawnie multipart,
      // dlatego multipart wrzucamy jako `never`.
      body: formData as unknown as never,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (error) {
      const msg =
        Array.isArray(error.detail) && error.detail.length > 0
          ? error.detail[0].msg
          : "Upload failed";

      return { error: msg };
    }

    return data;
  }
};

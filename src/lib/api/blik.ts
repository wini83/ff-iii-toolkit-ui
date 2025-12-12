import { createApiClient } from "./client";

async function getApi() {
  return await createApiClient();
}

export async function getPreview(encoded_id: string, token: string) {
  const api = await getApi();
  const { data, error } = await api.GET("/api/blik_files/{encoded_id}", {
    params: { path: { encoded_id } },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) throw normalizeApiError(error);
  return data;
}

export async function getMatches(encoded_id: string, token: string) {
  const api = await getApi();
  const { data, error } = await api.GET(
    "/api/blik_files/{encoded_id}/matches",
    {
      params: { path: { encoded_id } },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function applyMatches(
  encoded_id: string,
  tx_indexes: number[],
  token: string
) {
  const api = await getApi();
  const { data, error } = await api.POST(
    "/api/blik_files/{encoded_id}/matches",
    {
      params: { path: { encoded_id } },
      headers: { Authorization: `Bearer ${token}` },
      body: { tx_indexes }
    }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function uploadCsv(formData: FormData, token: string) {
  const api = await getApi();
  const { data, error } = await api.POST("/api/blik_files", {
    body: formData as unknown as never,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (error) throw normalizeApiError(error);
  return data;
}

function normalizeApiError(error: any): Error {
  if (Array.isArray(error?.detail)) {
    const msg = error.detail.map((d: any) => d.msg).join("; ");
    return new Error(msg);
  }
  return new Error("API error");
}

export const blik = {
  getPreview,
  getMatches,
  applyMatches,
  uploadCsv
};

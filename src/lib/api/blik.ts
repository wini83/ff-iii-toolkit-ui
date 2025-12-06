import { api } from "./client";

/**
 * GET /api/blik_files/{encoded_id}
 * Preview pliku (podgląd zawartości CSV)
 */
export async function getPreview(encoded_id: string, token: string) {
  const { data, error } = await api.GET("/api/blik_files/{encoded_id}", {
    params: { path: { encoded_id } },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) throw normalizeApiError(error);

  return data; // FilePreviewResponse
}

/**
 * GET /api/blik_files/{encoded_id}/matches
 * Pobranie dopasowań transakcji
 */
export async function getMatches(encoded_id: string, token: string) {
  const { data, error } = await api.GET(
    "/api/blik_files/{encoded_id}/matches",
    {
      params: { path: { encoded_id } },
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (error) throw normalizeApiError(error);

  return data; // FileMatchResponse
}

/**
 * POST /api/blik_files/{encoded_id}/matches
 * Zastosowanie dopasowań
 */
export async function applyMatches(
  encoded_id: string,
  tx_indexes: number[],
  token: string
) {
  const { data, error } = await api.POST(
    "/api/blik_files/{encoded_id}/matches",
    {
      params: { path: { encoded_id } },
      headers: { Authorization: `Bearer ${token}` },
      body: { tx_indexes }
    }
  );

  if (error) throw normalizeApiError(error);

  return data; // FileApplyResponse
}

/**
 * POST /api/blik_files
 * Upload CSV (multipart)
 */
export async function uploadCsv(formData: FormData, token: string) {
  const { data, error } = await api.POST("/api/blik_files", {
    // multipart ≠ zwykły JSON → openapi-typescript tego nie wspiera typowo
    body: formData as unknown as never,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (error) throw normalizeApiError(error);

  return data; // UploadResponse
}

/**
 * Normalizacja błędów FastAPI → ładny Error(msg)
 */
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
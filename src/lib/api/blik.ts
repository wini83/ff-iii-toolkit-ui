import { apiRequest } from './auth';

export async function getPreview(encoded_id: string, token: string) {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/blik_files/{encoded_id}', {
        params: { path: { encoded_id } },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function getMatches(encoded_id: string, token: string) {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/blik_files/{encoded_id}/matches', {
        params: { path: { encoded_id } },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function applyMatches(encoded_id: string, tx_indexes: number[], token: string) {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.POST('/api/blik_files/{encoded_id}/matches', {
        params: { path: { encoded_id } },
        headers,
        body: { tx_indexes }
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function uploadCsv(formData: FormData, token: string) {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.POST('/api/blik_files', {
        body: formData as unknown as never,
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function getStats(token: string) {
  const { data, error } = await apiRequest(
    (api, headers) => api.GET('/api/blik_files/statistics', { headers }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

export async function refreshStats(token: string) {
  const { data, error } = await apiRequest(
    (api, headers) => api.POST('/api/blik_files/statistics/refresh', { headers }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data;
}

function normalizeApiError(error: any): Error {
  if (Array.isArray(error?.detail)) {
    const msg = error.detail.map((d: any) => d.msg).join('; ');
    return new Error(msg);
  }
  return new Error('API error');
}

export const blik = {
  getPreview,
  getMatches,
  applyMatches,
  uploadCsv,
  getStats,
  refreshStats
};

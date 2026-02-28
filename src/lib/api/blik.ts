import { apiRequest } from './auth';
import type { components } from '$lib/api/schema';

type BlikMetricsStatusResponse = components['schemas']['BlikMetricsStatusResponse'];

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

export async function getMetricsStatus(token: string): Promise<BlikMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/blik_files/statistics_v2', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load statistics (${response.status})`);
  }

  return data;
}

export async function refreshMetricsStatus(token: string): Promise<BlikMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.POST('/api/blik_files/statistics_v2/refresh', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to refresh statistics (${response.status})`);
  }

  return data;
}

function normalizeApiError(error: unknown, fallback = 'API error'): Error {
  if (typeof error === 'string') {
    const msg = error.trim();
    return new Error(msg || fallback);
  }

  if (Array.isArray((error as { detail?: unknown } | null)?.detail)) {
    const msg = ((error as { detail: Array<{ msg?: unknown }> }).detail ?? [])
      .map((d) => (typeof d?.msg === 'string' ? d.msg.trim() : ''))
      .filter(Boolean)
      .join('; ');
    return new Error(msg);
  }

  if (error && typeof error === 'object') {
    const err = error as { detail?: unknown; error?: unknown; message?: unknown };

    if (typeof err.message === 'string' && err.message.trim()) {
      return new Error(err.message.trim());
    }

    if (typeof err.error === 'string' && err.error.trim()) {
      return new Error(err.error.trim());
    }

    if (typeof err.detail === 'string' && err.detail.trim()) {
      return new Error(err.detail.trim());
    }
  }

  return new Error(fallback);
}

export const blik = {
  getPreview,
  getMatches,
  applyMatches,
  uploadCsv,
  getStats,
  refreshStats,
  getMetricsStatus,
  refreshMetricsStatus
};

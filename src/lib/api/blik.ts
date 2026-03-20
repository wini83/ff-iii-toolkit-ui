import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { components } from '$lib/api/schema';

type BlikMetricsStatusResponse = components['schemas']['BlikMetricsStatusResponse'];
type BlikApplyDecision = components['schemas']['api__models__blik_files__ApplyDecision'];
type BlikApplyJobResponse = components['schemas']['api__models__blik_files__ApplyJobResponse'];

export async function getPreview(encoded_id: string, token?: string | null) {
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

export async function getMatches(encoded_id: string, token?: string | null) {
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

export async function applyMatches(
  encoded_id: string,
  decisions: BlikApplyDecision[],
  token?: string | null
): Promise<BlikApplyJobResponse | null> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.POST('/api/blik_files/{encoded_id}/apply', {
        params: { path: { encoded_id } },
        headers,
        body: { decisions }
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? null;
}

export async function getApplyJob(
  job_id: string,
  token?: string | null
): Promise<BlikApplyJobResponse | null> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/blik_files/apply-jobs/{job_id}', {
        params: { path: { job_id } },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? null;
}

export async function uploadCsv(formData: FormData, token?: string | null) {
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

export async function getMetricsStatus(token?: string | null): Promise<BlikMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/blik_files/statistics_v2', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load statistics (${response.status})`, response.status);
  }

  return data;
}

export async function refreshMetricsStatus(
  token?: string | null
): Promise<BlikMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.POST('/api/blik_files/statistics_v2/refresh', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to refresh statistics (${response.status})`, response.status);
  }

  return data;
}

export const blik = {
  getPreview,
  getMatches,
  applyMatches,
  getApplyJob,
  uploadCsv,
  getMetricsStatus,
  refreshMetricsStatus
};

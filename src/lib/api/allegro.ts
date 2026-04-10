import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { components } from '$lib/api/schema';

type UserSecret = components['schemas']['UserSecretResponse'];
type AllegroPayment = components['schemas']['AllegroPayment'];
type AllegroMatchResponse = components['schemas']['AllegroMatchResponse'];
type AllegroApplyPayload = components['schemas']['ApplyPayload'];
type ApplyJobResponse = components['schemas']['api__models__allegro__ApplyJobResponse'];
type AllegroMetricsStatusResponse = components['schemas']['AllegroMetricsStatusResponse'];

export async function listSecrets(token?: string | null): Promise<UserSecret[]> {
  const { data, error } = await apiRequest(
    (api, headers) => api.GET('/api/allegro/secrets', { headers }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? [];
}

export async function fetchPayments(
  secret_id: string,
  token?: string | null,
  limit?: number,
  offset?: number
): Promise<AllegroPayment[]> {
  const query: { limit?: number; offset?: number } = {};
  if (limit !== undefined) query.limit = limit;
  if (offset !== undefined) query.offset = offset;

  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/allegro/{secret_id}/payments', {
        params: { path: { secret_id }, query },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? [];
}

export async function getMatches(
  secret_id: string,
  token?: string | null,
  limit?: number,
  offset?: number
): Promise<AllegroMatchResponse | null> {
  const query: { limit?: number; offset?: number } = {};
  if (limit !== undefined) query.limit = limit;
  if (offset !== undefined) query.offset = offset;

  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/allegro/{secret_id}/matches', {
        params: { path: { secret_id }, query },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? null;
}

export async function applyMatches(
  secret_id: string,
  decisions: AllegroApplyPayload['decisions'],
  token?: string | null
): Promise<ApplyJobResponse | null> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.POST('/api/allegro/{secret_id}/apply', {
        params: { path: { secret_id } },
        body: { decisions },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? null;
}

export async function autoApplyMatches(
  secret_id: string,
  token?: string | null,
  limit?: number
): Promise<ApplyJobResponse | null> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.POST('/api/allegro/{secret_id}/apply/auto', {
        params: {
          path: { secret_id },
          query: limit === undefined ? {} : { limit }
        },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? null;
}

export async function getApplyJob(
  job_id: string,
  token?: string | null
): Promise<ApplyJobResponse | null> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/allegro/apply-jobs/{job_id}', {
        params: { path: { job_id } },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? null;
}

export async function getMetricsStatus(
  token?: string | null
): Promise<AllegroMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/allegro/statistics', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to load statistics (${response.status})`,
      response.status
    );
  }

  return data;
}

export async function refreshMetricsStatus(
  token?: string | null
): Promise<AllegroMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.POST('/api/allegro/statistics/refresh', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to refresh statistics (${response.status})`,
      response.status
    );
  }

  return data;
}

export const allegro = {
  listSecrets,
  fetchPayments,
  getMatches,
  applyMatches,
  autoApplyMatches,
  getApplyJob,
  getMetricsStatus,
  refreshMetricsStatus
};

import { apiRequest } from './auth';
import type { components } from '$lib/api/schema';

type UserSecret = components['schemas']['UserSecretResponse'];
type AllegroPayment = components['schemas']['AllegroPayment'];
type AllegroMatchResponse = components['schemas']['AllegroMatchResponse'];
type AllegroApplyPayload = components['schemas']['api__models__allegro__ApplyPayload'];
type ApplyJobResponse = components['schemas']['ApplyJobResponse'];
type AllegroMetricsStatusResponse = components['schemas']['AllegroMetricsStatusResponse'];

export async function listSecrets(token: string): Promise<UserSecret[]> {
  const { data, error } = await apiRequest(
    (api, headers) => api.GET('/api/allegro/secrets', { headers }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? [];
}

export async function fetchPayments(secret_id: string, token: string): Promise<AllegroPayment[]> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/allegro/{secret_id}/payments', {
        params: { path: { secret_id } },
        headers
      }),
    { token }
  );

  if (error) throw normalizeApiError(error);
  return data ?? [];
}

export async function getMatches(secret_id: string, token: string): Promise<AllegroMatchResponse | null> {
  const { data, error } = await apiRequest(
    (api, headers) =>
      api.GET('/api/allegro/{secret_id}/matches', {
        params: { path: { secret_id } },
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
  token: string
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
  token: string,
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

export async function getApplyJob(job_id: string, token: string): Promise<ApplyJobResponse | null> {
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

export async function getMetricsStatus(token: string): Promise<AllegroMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/allegro/statistics', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load statistics (${response.status})`);
  }

  return data;
}

export async function refreshMetricsStatus(token: string): Promise<AllegroMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.POST('/api/allegro/statistics/refresh', { headers }),
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

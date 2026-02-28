import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { operations, components } from '$lib/api/schema';

type TxTag = components['schemas']['TxTag'];
type TxMetricsStatusResponse = components['schemas']['TxMetricsStatusResponse'];

type ScreeningMonthResponse =
  operations['get_screening_month_api_tx_screening_get']['responses'][200]['content']['application/json'];

export async function getScreeningMonth(
  year: number,
  month: number,
  token: string
): Promise<ScreeningMonthResponse | null> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.GET('/api/tx/screening', {
        params: {
          query: { year, month },
        },
        headers,
      }),
    { token }
  );

  if (response.status === 204) {
    // miesiąc zamknięty – expected outcome
    return null;
  }

  if (error) {
    throw normalizeApiError(error);
  }

  return data ?? null;
}


export async function assignCategory(
  txId: number,
  categoryId: number,
  token: string
): Promise<void> {
  const { error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/tx/{tx_id}/category/{category_id}', {
        params: {
          path: {
            tx_id: txId,
            category_id: categoryId,
          },
        },
        headers,
      }),
    { token }
  );

  if (response.status === 204) {
    return;
  }

  if (error) {
    throw normalizeApiError(error);
  }

  throw new Error('Unexpected response from assignCategory');
}

/* -----------------------------
 * NEW: Apply Tag
 * ----------------------------- */

export async function applyTag(
  txId: number,
  tag: TxTag,
  token: string
): Promise<void> {
  const { error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/tx/{tx_id}/tag/', {
        params: {
          path: {
            tx_id: txId,
          },
          query: {
            tag,
          },
        },
        headers,
      }),
    { token }
  );

  if (response.status === 204) {
    return;
  }

  if (error) {
    throw normalizeApiError(error);
  }

  throw new Error('Unexpected response from applyTag');
}

export async function getMetricsStatus(token: string): Promise<TxMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/tx/statistics', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    if (error) {
      throw normalizeApiError(error);
    }
    throw new Error(`Failed to load tx statistics (${response.status})`);
  }

  return data;
}

export async function refreshMetricsStatus(token: string): Promise<TxMetricsStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.POST('/api/tx/statistics/refresh', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    if (error) {
      throw normalizeApiError(error);
    }
    throw new Error(`Failed to refresh tx statistics (${response.status})`);
  }

  return data;
}

import { createApiClient } from './client';
import { normalizeApiError } from '$lib/api/errors';
import type { operations } from '$lib/api/schema';

async function getApi() {
  return await createApiClient();
}

type ScreeningMonthResponse =
  operations['get_screening_month_api_tx_screening_get']['responses'][200]['content']['application/json'];

export async function getScreeningMonth(
  year: number,
  month: number,
  token: string
): Promise<ScreeningMonthResponse | null> {
  const api = await getApi();

  const { data, error, response } = await api.GET('/api/tx/screening', {
    params: {
      query: { year, month },
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

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
  const api = await getApi();

  const { error, response } = await api.POST(
    '/api/tx/{tx_id}/category/{category_id}',
    {
      params: {
        path: {
          tx_id: txId,
          category_id: categoryId,
        },
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (response.status === 204) {
    return;
  }

  if (error) {
    throw normalizeApiError(error);
  }

  throw new Error('Unexpected response from assignCategory');
}


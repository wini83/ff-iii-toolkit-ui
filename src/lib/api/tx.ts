import { createApiClient } from './client';
import { normalizeApiError } from '$lib/api/errors';

async function getApi() {
  return await createApiClient();
}

export type GetNextTxParams = {
  order?: 'asc' | 'desc';
  after_id?: number | null;
};

export async function getNextTx(
  params: GetNextTxParams,
  token: string
) {
  const api = await getApi();

  const { data, error, response } = await api.GET('/api/tx/next', {
    params: {
      query: {
        order: params.order ?? 'asc',
        after_id: params.after_id ?? null,
      },
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204) {
    return null;
  }

  if (error) {
    throw normalizeApiError(error);
  }
  type _Debug = typeof data;
  // ✅ data to JUŻ payload
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


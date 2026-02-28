import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { operations } from '$lib/api/schema';

type MeResponse =
  operations['get_me_api_me_get']['responses'][200]['content']['application/json'];

export async function getMe(token: string): Promise<MeResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/me', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    if (error) {
      throw normalizeApiError(error);
    }
    throw new Error(`Failed to load me (${response.status})`);
  }

  return data;
}

export const me = {
  getMe
};

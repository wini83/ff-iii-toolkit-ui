import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { components } from '$lib/api/schema';

type UserSecret = components['schemas']['UserSecretResponse'];
type CreateUserSecretRequest = components['schemas']['CreateSecretPayload'];
type UpdateUserSecretAliasRequest = components['schemas']['UpdateSecretAliasPayload'];

export async function listUserSecrets(token?: string | null): Promise<UserSecret[]> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/user-secrets', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load user secrets (${response.status})`, response.status);
  }

  return data;
}

export async function createUserSecret(
  payload: CreateUserSecretRequest,
  token?: string | null
): Promise<UserSecret> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/user-secrets', {
        body: payload,
        headers
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to create user secret (${response.status})`, response.status);
  }

  return data;
}

export async function deleteUserSecret(secretId: string, token?: string | null): Promise<void> {
  const { error, response } = await apiRequest(
    (api, headers) =>
      api.DELETE('/api/user-secrets/{secret_id}', {
        params: { path: { secret_id: secretId } },
        headers
      }),
    { token }
  );

  if (!response.ok || error) {
    throw normalizeApiError(error, `Failed to delete user secret (${response.status})`, response.status);
  }
}

export async function updateUserSecretAlias(
  secretId: string,
  payload: UpdateUserSecretAliasRequest,
  token?: string | null
): Promise<UserSecret> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.PATCH('/api/user-secrets/{secret_id}', {
        params: { path: { secret_id: secretId } },
        body: payload,
        headers
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to update user secret alias (${response.status})`, response.status);
  }

  return data;
}

export const userSecrets = {
  listUserSecrets,
  createUserSecret,
  deleteUserSecret,
  updateUserSecretAlias
};

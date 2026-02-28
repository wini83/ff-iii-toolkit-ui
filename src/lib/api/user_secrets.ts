import { apiRequest } from './auth';
import type { components } from '$lib/api/schema';

type UserSecret = components['schemas']['UserSecretResponse'];
type CreateUserSecretRequest = components['schemas']['CreateSecretPayload'];

export async function listUserSecrets(token: string): Promise<UserSecret[]> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/user-secrets', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load user secrets (${response.status})`);
  }

  return data;
}

export async function createUserSecret(
  payload: CreateUserSecretRequest,
  token: string
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
    throw normalizeApiError(error, `Failed to create user secret (${response.status})`);
  }

  return data;
}

export async function deleteUserSecret(secretId: string, token: string): Promise<void> {
  const { error, response } = await apiRequest(
    (api, headers) =>
      api.DELETE('/api/user-secrets/{secret_id}', {
        params: { path: { secret_id: secretId } },
        headers
      }),
    { token }
  );

  if (!response.ok || error) {
    throw normalizeApiError(error, `Failed to delete user secret (${response.status})`);
  }
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

export const userSecrets = {
  listUserSecrets,
  createUserSecret,
  deleteUserSecret
};

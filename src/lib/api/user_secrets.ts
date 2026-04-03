import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { components } from '$lib/api/schema';

type UserSecret = components['schemas']['UserSecretResponse'];
type CreateUserSecretRequest = components['schemas']['CreateSecretPayload'];
type UpdateUserSecretRequest = components['schemas']['UpdateSecretPayload'];
type VaultPassphrasePayload = components['schemas']['VaultPassphrasePayload'];
type VaultStatusResponse = components['schemas']['VaultStatusResponse'];

const VAULT_REQUEST_OPTIONS = { retryOnUnauthorized: false };

export async function getVaultStatus(token?: string | null): Promise<VaultStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/user-secrets/vault/status', { headers }),
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to load vault status (${response.status})`,
      response.status
    );
  }

  return data;
}

export async function setupVault(
  payload: VaultPassphrasePayload,
  token?: string | null
): Promise<VaultStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/user-secrets/vault/setup', {
        body: payload,
        headers
      }),
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to set up vault (${response.status})`, response.status);
  }

  return data;
}

export async function unlockVault(
  payload: VaultPassphrasePayload,
  token?: string | null
): Promise<VaultStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/user-secrets/vault/unlock', {
        body: payload,
        headers
      }),
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to unlock vault (${response.status})`, response.status);
  }

  return data;
}

export async function lockVault(token?: string | null): Promise<VaultStatusResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.POST('/api/user-secrets/vault/lock', { headers }),
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to lock vault (${response.status})`, response.status);
  }

  return data;
}

export async function listUserSecrets(token?: string | null): Promise<UserSecret[]> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/user-secrets', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to load user secrets (${response.status})`,
      response.status
    );
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
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to create user secret (${response.status})`,
      response.status
    );
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
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error) {
    throw normalizeApiError(
      error,
      `Failed to delete user secret (${response.status})`,
      response.status
    );
  }
}

export async function updateUserSecret(
  secretId: string,
  payload: UpdateUserSecretRequest,
  token?: string | null
): Promise<UserSecret> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.PATCH('/api/user-secrets/{secret_id}', {
        params: { path: { secret_id: secretId } },
        body: payload,
        headers
      }),
    { token, ...VAULT_REQUEST_OPTIONS }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to update user secret (${response.status})`,
      response.status
    );
  }

  return data;
}

export const userSecrets = {
  getVaultStatus,
  setupVault,
  unlockVault,
  lockVault,
  listUserSecrets,
  createUserSecret,
  deleteUserSecret,
  updateUserSecret
};

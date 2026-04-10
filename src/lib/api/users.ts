import { apiRequest } from './auth';
import { normalizeApiError } from '$lib/api/errors';
import type { components, operations } from '$lib/api/schema';

type UserResponse = components['schemas']['UserResponse'];
type InviteResponse = components['schemas']['InviteResponse'];
type AuditLogResponse = components['schemas']['AuditLogResponse'];
type CreateUserPayload =
  operations['create_user_api_users_post']['requestBody']['content']['application/json'];
type CreateUserResponse =
  operations['create_user_api_users_post']['responses'][201]['content']['application/json'];
type AuditLogQuery = operations['list_audit_log_api_users_audit_log_get']['parameters']['query'];

async function expectNoContent(
  request: ReturnType<typeof apiRequest>,
  fallback: string
): Promise<void> {
  const { error, response } = await request;

  if (response.status === 204) {
    return;
  }

  throw normalizeApiError(error, fallback, response.status);
}

export async function listUsers(token?: string | null): Promise<UserResponse[]> {
  const { data, error, response } = await apiRequest(
    (api, headers) => api.GET('/api/users', { headers }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(error, `Failed to load users (${response.status})`, response.status);
  }

  return data;
}

export async function createUser(
  payload: CreateUserPayload,
  token?: string | null
): Promise<CreateUserResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/users', {
        body: payload,
        headers
      }),
    { token }
  );

  if (response.status !== 201 || error || !data) {
    throw normalizeApiError(error, `Failed to create user (${response.status})`, response.status);
  }

  return data;
}

export async function inviteUser(userId: string, token?: string | null): Promise<InviteResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.POST('/api/users/{user_id}/invite', {
        params: { path: { user_id: userId } },
        headers
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to generate invite (${response.status})`,
      response.status
    );
  }

  return data;
}

export async function disableUser(userId: string, token?: string | null): Promise<void> {
  await expectNoContent(
    apiRequest(
      (api, headers) =>
        api.POST('/api/users/{user_id}/disable', {
          params: { path: { user_id: userId } },
          headers
        }),
      { token }
    ),
    'Failed to disable user'
  );
}

export async function enableUser(userId: string, token?: string | null): Promise<void> {
  await expectNoContent(
    apiRequest(
      (api, headers) =>
        api.POST('/api/users/{user_id}/enable', {
          params: { path: { user_id: userId } },
          headers
        }),
      { token }
    ),
    'Failed to enable user'
  );
}

export async function promoteUser(userId: string, token?: string | null): Promise<void> {
  await expectNoContent(
    apiRequest(
      (api, headers) =>
        api.POST('/api/users/{user_id}/promote', {
          params: { path: { user_id: userId } },
          headers
        }),
      { token }
    ),
    'Failed to promote user'
  );
}

export async function demoteUser(userId: string, token?: string | null): Promise<void> {
  await expectNoContent(
    apiRequest(
      (api, headers) =>
        api.POST('/api/users/{user_id}/demote', {
          params: { path: { user_id: userId } },
          headers
        }),
      { token }
    ),
    'Failed to demote user'
  );
}

export async function deleteUser(userId: string, token?: string | null): Promise<void> {
  await expectNoContent(
    apiRequest(
      (api, headers) =>
        api.DELETE('/api/users/{user_id}', {
          params: { path: { user_id: userId } },
          headers
        }),
      { token }
    ),
    'Failed to delete user'
  );
}

export async function listAuditLog(
  query?: AuditLogQuery,
  token?: string | null
): Promise<AuditLogResponse> {
  const { data, error, response } = await apiRequest(
    (api, headers) =>
      api.GET('/api/users/audit-log', {
        params: { query: query ?? {} },
        headers
      }),
    { token }
  );

  if (!response.ok || error || !data) {
    throw normalizeApiError(
      error,
      `Failed to load audit log (${response.status})`,
      response.status
    );
  }

  return data;
}

export const users = {
  listUsers,
  listAuditLog,
  createUser,
  inviteUser,
  disableUser,
  enableUser,
  promoteUser,
  demoteUser,
  deleteUser
};

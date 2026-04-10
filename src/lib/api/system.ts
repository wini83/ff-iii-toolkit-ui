import { createApiClient } from './client';
import type { components } from '$lib/api/schema';

/** Lazy init — tworzymy klienta dopiero gdy naprawdę jest potrzebny */
let apiPromise: ReturnType<typeof createApiClient> | null = null;

type HealthResponse = components['schemas']['HealthResponse'];
type VersionResponse = components['schemas']['VersionResponse'];

async function api() {
  if (!apiPromise) {
    apiPromise = createApiClient();
  }
  return apiPromise;
}

export async function getHealth(): Promise<HealthResponse> {
  const client = await api();
  const { data, error, response } = await client.GET('/api/system/health', {});

  if (!response.ok || error || !data) {
    throw new Error('Health check failed');
  }

  return data;
}

export async function getVersion(): Promise<VersionResponse> {
  const client = await api();
  const { data, error, response } = await client.GET('/api/system/version', {});

  if (!response.ok || error || !data) {
    throw new Error('Version check failed');
  }

  return data;
}

export async function getStatus(): Promise<{
  health: HealthResponse;
  version: VersionResponse;
}> {
  const [health, version] = await Promise.all([getHealth(), getVersion()]);
  return { health, version };
}

export const system = { getHealth, getVersion, getStatus };

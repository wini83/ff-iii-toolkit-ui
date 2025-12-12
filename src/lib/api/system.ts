import { createApiClient } from "./client";

/** Lazy init — tworzymy klienta dopiero gdy naprawdę jest potrzebny */
let apiPromise: ReturnType<typeof createApiClient> | null = null;

async function api() {
  if (!apiPromise) {
    apiPromise = createApiClient();
  }
  return apiPromise;
}

export async function getHealth() {
  const client = await api();
  const { data, error } = await client.GET("/api/system/health", {});
  if (error) throw new Error("Health check failed");
  return data;
}

export async function getVersion() {
  const client = await api();
  const { data, error } = await client.GET("/api/system/version", {});
  if (error) throw new Error("Version check failed");
  return data;
}

export const system = { getHealth, getVersion };

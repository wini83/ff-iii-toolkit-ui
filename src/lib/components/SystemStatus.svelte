<script lang="ts">
  import { onMount } from "svelte";
  import { loadConfig } from "$lib/config";

  let health = "loading";
  let version: string | null = null;
  let API_BASE = "";
  let intervalId: ReturnType<typeof setInterval>;

  async function refresh() {
    if (!API_BASE) return;

    try {
      const h = await fetch(`${API_BASE}/api/system/health`).then(r => r.json());
      health = h.status === "ok" ? "ok" : "down";

      const v = await fetch(`${API_BASE}/api/system/version`).then(r => r.json());
      version = v.version;
    } catch {
      health = "down";
    }
  }

  onMount(() => {
    (async () => {
      const cfg = await loadConfig();
      API_BASE = cfg.API_BASE || "";

      await refresh();
      intervalId = setInterval(refresh, 5000);
    })();

    return () => clearInterval(intervalId);
  });
</script>

<div class="flex items-center gap-3">
  {#if health === "loading"}
    <div class="flex items-center gap-2">
      <span class="loading loading-spinner loading-xs"></span>
      <span class="text-sm opacity-60">Checking backend…</span>
    </div>
  {:else if health === "ok"}
    <div class="flex items-center gap-2">
      <div class="inline-grid *:[grid-area:1/1]">
        <div class="status status-sm status-success animate-ping"></div>
        <div class="status status-sm status-success"></div>
      </div>
      <span class="text-sm text-success">Server is up</span>
    </div>
  {:else}
    <div class="flex items-center gap-2">
      <div class="inline-grid *:[grid-area:1/1]">
        <div class="status status-sm status-error animate-ping"></div>
        <div class="status status-sm status-error"></div>
      </div>
      <span class="text-sm text-error">Server is down</span>
    </div>
  {/if}

  {#if version}
    <span class="badge badge-soft badge-sm badge-primary">{version}</span>
  {/if}
</div>
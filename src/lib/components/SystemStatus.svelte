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

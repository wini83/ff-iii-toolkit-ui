<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

  import { getMetricsStatus, refreshMetricsStatus } from '$lib/api/tx';
  import type { components } from '$lib/api/schema';

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  type TxMetricsStatusResponse = components['schemas']['TxMetricsStatusResponse'];
  type TxMetricsResultResponse = components['schemas']['TxMetricsResultResponse'];
  type JobStatus = components['schemas']['JobStatus'];

  const POLL_INTERVAL_MS = 2_000;
  const MAX_POLL_ATTEMPTS = 60;

  let statusData: TxMetricsStatusResponse | null = null;
  let data: TxMetricsResultResponse | null = null;
  let loading = true;
  let refreshLoading = false;
  let networkError: string | null = null;

  let categorizableByMonth = {
    labels: [] as string[],
    values: [] as number[]
  };

  let categorizableCanvas: HTMLCanvasElement | null = null;
  let categorizableChart: Chart | null = null;

  function toChartData(obj: Record<string, number>) {
    return {
      labels: Object.keys(obj),
      values: Object.values(obj)
    };
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isBusy(status: JobStatus | undefined) {
    return status === 'pending' || status === 'running';
  }

  function isRunning(status: JobStatus | undefined) {
    return status === 'running';
  }

  function isFailed(status: JobStatus | undefined) {
    return status === 'failed';
  }

  function isDone(status: JobStatus | undefined) {
    return status === 'done';
  }

  function hasNoData(status: TxMetricsStatusResponse | null) {
    return isDone(status?.status) && status?.result === null;
  }

  function formatTimestamp(timestamp: string | undefined) {
    if (!timestamp) return 'n/a';

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;

    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  function formatFetchSeconds(seconds: number | undefined) {
    if (typeof seconds !== 'number' || Number.isNaN(seconds)) return 'n/a';
    return `${seconds.toFixed(2)} s`;
  }

  function getNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  function extractErrorMessage(error: unknown, fallback: string) {
    const normalizedFallback = getNonEmptyString(fallback) ?? 'Unexpected error';
    const rawError = getNonEmptyString(error);
    if (rawError) return rawError;

    if (error && typeof error === 'object') {
      const err = error as { detail?: unknown; error?: unknown; message?: unknown };

      const message = getNonEmptyString(err.message);
      if (message) return message;

      const errText = getNonEmptyString(err.error);
      if (errText) return errText;

      if (Array.isArray(err.detail)) {
        const joined = err.detail
          .map((item) => {
            if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
              return getNonEmptyString(item.msg);
            }
            return null;
          })
          .filter((item): item is string => item !== null)
          .join('; ');

        if (joined) return joined;
      }

      const detail = getNonEmptyString(err.detail);
      if (detail) return detail;
    }

    return normalizedFallback;
  }

  function emitToast(type: 'info' | 'success' | 'error', msg: string) {
    const safeMsg =
      getNonEmptyString(msg) ??
      (type === 'error' ? 'Failed to load statistics' : type === 'success' ? 'Success' : 'Info');

    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: { type, msg: safeMsg }
      })
    );
  }

  function notImplemented() {
    emitToast('error', 'Not yet implemented');
  }

  async function pollUntilDone(token: string, initialStatus: TxMetricsStatusResponse) {
    let current = initialStatus;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && isRunning(current.status); attempt += 1) {
      await wait(POLL_INTERVAL_MS);
      current = await getMetricsStatus(token);
      statusData = current;
    }

    return current;
  }

  async function syncCharts(result: TxMetricsResultResponse | null) {
    categorizableChart?.destroy();

    if (!result) return;

    await tick();

    if (categorizableCanvas && categorizableByMonth.labels.length) {
      categorizableChart = new Chart(categorizableCanvas, {
        type: 'bar',
        data: {
          labels: categorizableByMonth.labels,
          datasets: [
            {
              label: 'Categorizable',
              data: categorizableByMonth.values,
              backgroundColor: '#3b82f6'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  function updateUiFromStatus(status: TxMetricsStatusResponse | null) {
    const result = isDone(status?.status) ? status?.result ?? null : null;
    data = result;

    if (!result) {
      categorizableByMonth = { labels: [], values: [] };
      return;
    }

    categorizableByMonth = toChartData(result.categorizable_by_month);
  }

  onMount(() => {
    loadStats(false);
  });

  onDestroy(() => {
    categorizableChart?.destroy();
  });

  async function loadStats(force = false) {
    const token = localStorage.getItem('access_token');
    if (!token) {
      goto('/login');
      return;
    }

    loading = true;
    networkError = null;

    if (force) {
      refreshLoading = true;
      emitToast('info', 'Statistics generation has started');
    }

    try {
      let nextStatus = force ? await refreshMetricsStatus(token) : await getMetricsStatus(token);
      statusData = nextStatus;

      if (isRunning(nextStatus.status)) {
        nextStatus = await pollUntilDone(token, nextStatus);
        statusData = nextStatus;
      }

      if (isFailed(nextStatus.status)) {
        const message = nextStatus.error ?? 'Statistics generation failed';
        emitToast('error', message);
        updateUiFromStatus(null);
        await syncCharts(null);
        return;
      }

      updateUiFromStatus(nextStatus);
      await syncCharts(data);

      if (hasNoData(nextStatus)) {
        emitToast('info', 'Brak danych');
      }

      if (force && isDone(nextStatus.status)) {
        emitToast('success', 'Statistics generation completed');
      }
    } catch (error: unknown) {
      networkError = extractErrorMessage(error, 'Failed to load statistics');
      emitToast('error', networkError);
      statusData = null;
      updateUiFromStatus(null);
      await syncCharts(null);
    } finally {
      loading = false;
      refreshLoading = false;
    }
  }
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div></div>
  <div class="text-right space-y-2">
    <div class="badge badge-sm">
      generated at: {formatTimestamp(data?.time_stamp)} in {formatFetchSeconds(data?.fetch_seconds)}
    </div>
    <div>
      <button
        class="btn btn-ghost btn-sm normal-case"
        on:click={() => loadStats(true)}
        disabled={refreshLoading}
      >
        <Icon
          src={icons.ArrowPath}
          class={`inline-block h-5 w-5 stroke-current ${refreshLoading || isRunning(statusData?.status) ? 'animate-spin' : ''}`}
        />
        Refresh
      </button>

      <button class="btn btn-ghost btn-sm ml-2 normal-case" on:click={() => notImplemented()}>
        <Icon src={icons.Share} class="inline-block h-5 w-5 stroke-current" />
        Share
      </button>
      <div class="dropdown dropdown-bottom dropdown-end ml-2">
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square normal-case"
          aria-label="More actions"
        >
          <Icon src={icons.EllipsisVertical} class="inline-block h-5 w-5 stroke-current" />
        </button>

        <ul class="dropdown-content menu menu-compact bg-base-100 rounded-box w-52 p-2 shadow">
          <li>
            <button type="button" class="flex items-center gap-2">
              <Icon src={icons.ArrowDownTray} class="inline-block h-5 w-5 stroke-current" />
              Download
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</div>

{#if loading || isBusy(statusData?.status)}
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div class="skeleton h-28"></div>
    <div class="skeleton h-28"></div>
    <div class="skeleton h-28"></div>
    <div class="skeleton h-28"></div>
  </div>
{:else if data}
  {@const d = data}

  <div class="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
    <div class="stats bg-base-100 rounded-box shadow">
      <div class="stat">
        <div class="stat-figure text-primary">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-primary">Single-part transactions</div>
        <div class="stat-value text-primary">{d.single_part_transactions}</div>
      </div>
    </div>

    <div class="stats bg-base-100 rounded-box shadow">
      <div class="stat">
        <div class="stat-figure text-secondary">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-secondary">Uncategorized</div>
        <div class="stat-value text-secondary">{d.uncategorized_transactions}</div>
      </div>
    </div>

    <div class="stats bg-base-100 rounded-box shadow">
      <div class="stat">
        <div class="stat-figure text-warning">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-warning">Action req</div>
        <div class="stat-value text-warning">{d.action_req}</div>
      </div>
    </div>

    <div class="stats bg-base-100 rounded-box shadow">
      <div class="stat">
        <div class="stat-figure">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title">Categorizable</div>
        <div class="stat-value">{d.categorizable}</div>
        <div class="stat-desc">BLIK not OK: {d.blik_not_ok} | Allegro not OK: {d.allegro_not_ok}</div>
      </div>
    </div>
  </div>
{/if}

{#if !networkError && !isFailed(statusData?.status) && !hasNoData(statusData)}
  <div class="card bg-base-100 mt-6 w-full p-6 shadow-xl">
    <div class="text-xl font-semibold">Categorizable by month</div>

    <div class="divider mt-2 mb-2"></div>

    <div class="relative h-64">
      {#if loading || isBusy(statusData?.status)}
        <div class="skeleton absolute inset-0 z-10"></div>
      {/if}

      <canvas
        class:opacity-0={loading || isBusy(statusData?.status)}
        class:opacity-100={!loading && !isBusy(statusData?.status)}
        class="transition-opacity duration-300"
        bind:this={categorizableCanvas}
      ></canvas>
    </div>
  </div>
{/if}

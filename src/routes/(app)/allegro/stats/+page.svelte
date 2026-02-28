<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

  import { allegro } from '$lib/api/allegro';
  import type { components } from '$lib/api/schema';

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

  type AllegroMetricsStatusResponse = components['schemas']['AllegroMetricsStatusResponse'];
  type AllegroMetricsResultResponse = components['schemas']['AllegroMetricsResultResponse'];
  type JobStatus = components['schemas']['JobStatus'];

  const POLL_INTERVAL_MS = 2_000;
  const MAX_POLL_ATTEMPTS = 60;

  let statusData: AllegroMetricsStatusResponse | null = null;
  let data: AllegroMetricsResultResponse | null = null;
  let loading = true;
  let refreshLoading = false;
  let networkError: string | null = null;

  let notProcessed = {
    labels: [] as string[],
    values: [] as number[]
  };

  let notProcessedCanvas: HTMLCanvasElement | null = null;
  let notProcessedChart: Chart | null = null;

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

  function hasNoData(status: AllegroMetricsStatusResponse | null) {
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

  async function pollUntilDone(token: string, initialStatus: AllegroMetricsStatusResponse) {
    let current = initialStatus;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && isRunning(current.status); attempt += 1) {
      await wait(POLL_INTERVAL_MS);
      current = await allegro.getMetricsStatus(token);
      statusData = current;
    }

    return current;
  }

  async function syncCharts(result: AllegroMetricsResultResponse | null) {
    notProcessedChart?.destroy();

    if (!result) return;

    await tick();

    if (notProcessedCanvas && notProcessed.labels.length) {
      notProcessedChart = new Chart(notProcessedCanvas, {
        type: 'bar',
        data: {
          labels: notProcessed.labels,
          datasets: [
            {
              label: 'Not processed Allegro',
              data: notProcessed.values,
              backgroundColor: '#f59e0b'
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

  function updateUiFromStatus(status: AllegroMetricsStatusResponse | null) {
    const result = isDone(status?.status) ? status?.result ?? null : null;
    data = result;

    if (!result) {
      notProcessed = { labels: [], values: [] };
      return;
    }

    notProcessed = toChartData(result.not_processed_by_month);
  }

  onMount(() => {
    loadStats(false);
  });

  onDestroy(() => {
    notProcessedChart?.destroy();
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
      let nextStatus = force ? await allegro.refreshMetricsStatus(token) : await allegro.getMetricsStatus(token);
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
  <div class="space-y-2 text-right">
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
    </div>
  </div>
</div>

{#if networkError}
  <div class="alert alert-error mt-4">
    <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
    <span>{networkError}</span>
  </div>
{:else if isDone(statusData?.status) && data}
  <div class="alert alert-success mt-4">
    <Icon src={icons.CheckCircle} class="h-5 w-5" />
    <span>Statistics loaded successfully.</span>
  </div>
{/if}

{#if loading || isBusy(statusData?.status)}
  <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div class="skeleton h-28"></div>
    <div class="skeleton h-28"></div>
    <div class="skeleton h-28"></div>
    <div class="skeleton h-28"></div>
  </div>
{:else if data}
  {@const d = data}

  <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
    <div class="stats bg-base-100 rounded-box shadow">
      <div class="stat">
        <div class="stat-figure text-primary">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-primary">Total transactions</div>
        <div class="stat-value text-primary">{d.total_transactions}</div>
      </div>
    </div>

    <div class="stats bg-base-100 rounded-box shadow">
      <div class="stat">
        <div class="stat-figure text-secondary">
          <Icon src={icons.Banknotes} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-secondary">Allegro transactions</div>
        <div class="stat-value text-secondary">{d.allegro_transactions}</div>
      </div>
    </div>

    <div class="stats bg-base-100 rounded-box shadow md:col-span-2">
      <div class="stat">
        <div class="stat-figure text-warning">
          <Icon src={icons.ExclamationTriangle} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-warning">Not processed Allegro</div>
        <div class="stat-value text-warning">{d.not_processed__allegro_transactions}</div>
        <div class="stat-desc">Coverage: {d.allegro_transactions > 0
            ? `${Math.round(((d.allegro_transactions - d.not_processed__allegro_transactions) / d.allegro_transactions) * 100)}%`
            : 'n/a'}</div>
      </div>
    </div>
  </div>
{/if}

{#if !networkError && !isFailed(statusData?.status) && !hasNoData(statusData)}
  <div class="card bg-base-100 mt-6 w-full p-6 shadow-xl">
    <div class="text-xl font-semibold">Not processed Allegro by month</div>

    <div class="divider mt-2 mb-2"></div>

    <div class="relative h-64">
      {#if loading || isBusy(statusData?.status)}
        <div class="skeleton absolute inset-0 z-10"></div>
      {/if}

      <canvas
        class:opacity-0={loading || isBusy(statusData?.status)}
        class:opacity-100={!loading && !isBusy(statusData?.status)}
        class="transition-opacity duration-300"
        bind:this={notProcessedCanvas}
      ></canvas>
    </div>
  </div>
{/if}

<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
  } from 'chart.js';

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

  async function pollUntilDone(initialStatus: AllegroMetricsStatusResponse) {
    let current = initialStatus;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && isRunning(current.status); attempt += 1) {
      await wait(POLL_INTERVAL_MS);
      current = await allegro.getMetricsStatus();
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
    loading = true;
    networkError = null;

    if (force) {
      refreshLoading = true;
      emitToast('info', 'Statistics generation has started');
    }

    try {
      let nextStatus = force
        ? await allegro.refreshMetricsStatus()
        : await allegro.getMetricsStatus();
      statusData = nextStatus;

      if (isRunning(nextStatus.status)) {
        nextStatus = await pollUntilDone(nextStatus);
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

  function openAccounts() {
    goto('/allegro/accounts');
  }
</script>

<svelte:head>
  <title>Allegro Stats — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-warning/15 text-warning rounded-3xl p-4">
          <Icon src={icons.ChartBar} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Metrics overview
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Allegro stats</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Review current marketplace coverage, generated statistics and the remaining backlog of
              not-processed Allegro transactions.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Quick actions</div>
          <p class="mt-2 text-sm">
            Trigger a fresh statistics job or return to the Allegro accounts overview.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            class="btn btn-primary"
            on:click={() => loadStats(true)}
            disabled={refreshLoading}
          >
            <Icon
              src={icons.ArrowPath}
              class={`h-5 w-5 ${refreshLoading || isRunning(statusData?.status) ? 'animate-spin' : ''}`}
            />
            Refresh stats
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-xl font-semibold">Statistics summary</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Latest generated metrics snapshot and processing coverage for Allegro data.
          </p>
        </div>

        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="badge badge-sm">
            generated at: {formatTimestamp(data?.time_stamp)} in {formatFetchSeconds(data?.fetch_seconds)}
          </div>
          {#if networkError}
            <div class="badge badge-error badge-sm">Load failed</div>
          {:else if isDone(statusData?.status) && data}
            <div class="badge badge-success badge-sm">Statistics ready</div>
          {:else if isBusy(statusData?.status)}
            <div class="badge badge-warning badge-sm">Job running</div>
          {/if}
        </div>
      </div>

      <div class="divider my-0"></div>

      {#if networkError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{networkError}</span>
        </div>
      {/if}

      {#if loading || isBusy(statusData?.status)}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="card bg-base-100 shadow-lg">
            <div class="card-body gap-3">
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-9 w-16"></div>
              <div class="skeleton h-4 w-36"></div>
            </div>
          </div>
          <div class="card bg-base-100 shadow-lg">
            <div class="card-body gap-3">
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton h-9 w-16"></div>
              <div class="skeleton h-4 w-36"></div>
            </div>
          </div>
          <div class="card bg-base-100 shadow-lg md:col-span-2">
            <div class="card-body gap-3">
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton h-9 w-16"></div>
              <div class="skeleton h-4 w-40"></div>
            </div>
          </div>
        </div>
      {:else if data}
        {@const d = data}

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="card bg-base-100 shadow-lg">
            <div class="card-body">
              <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                Total transactions
              </div>
              <div class="mt-3 flex items-end justify-between gap-4">
                <div class="text-4xl font-semibold">{d.total_transactions}</div>
                <div class="bg-primary/12 text-primary rounded-2xl p-3">
                  <Icon src={icons.CircleStack} class="h-5 w-5" />
                </div>
              </div>
              <p class="text-base-content/60 mt-3 text-sm">
                All transactions available in the current statistics snapshot.
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-lg">
            <div class="card-body">
              <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                Allegro transactions
              </div>
              <div class="mt-3 flex items-end justify-between gap-4">
                <div class="text-4xl font-semibold">{d.allegro_transactions}</div>
                <div class="bg-secondary/12 text-secondary rounded-2xl p-3">
                  <Icon src={icons.Banknotes} class="h-5 w-5" />
                </div>
              </div>
              <p class="text-base-content/60 mt-3 text-sm">
                Transactions identified as marketplace-related in the generated metrics.
              </p>
            </div>
          </div>

          <div class="card bg-base-100 shadow-lg md:col-span-2">
            <div class="card-body">
              <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                Not processed Allegro
              </div>
              <div class="mt-3 flex items-end justify-between gap-4">
                <div class="text-4xl font-semibold">{d.not_processed__allegro_transactions}</div>
                <div class="bg-warning/15 text-warning rounded-2xl p-3">
                  <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
                </div>
              </div>
              <p class="text-base-content/60 mt-3 text-sm">
                Coverage:{' '}
                {d.allegro_transactions > 0
                  ? `${Math.round(((d.allegro_transactions - d.not_processed__allegro_transactions) / d.allegro_transactions) * 100)}%`
                  : 'n/a'}
              </p>
            </div>
          </div>
        </div>
      {:else if hasNoData(statusData)}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-primary/12 text-primary rounded-3xl p-4">
            <Icon src={icons.InformationCircle} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No statistics data yet</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            Run a fresh statistics generation to populate this dashboard.
          </p>
          <button class="btn btn-primary mt-6" on:click={() => loadStats(true)} disabled={refreshLoading}>
            <Icon
              src={icons.ArrowPath}
              class={`h-5 w-5 ${refreshLoading || isRunning(statusData?.status) ? 'animate-spin' : ''}`}
            />
            Generate stats
          </button>
        </div>
      {/if}
    </div>
  </section>

  {#if !networkError && !isFailed(statusData?.status) && !hasNoData(statusData)}
    <section class="card bg-base-100 shadow-xl">
      <div class="card-body gap-5">
        <div>
          <h3 class="text-xl font-semibold">Not processed Allegro by month</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Monthly breakdown of marketplace-related transactions that still require processing.
          </p>
        </div>

        <div class="divider my-0"></div>

        <div class="relative h-72">
          {#if loading || isBusy(statusData?.status)}
            <div class="skeleton absolute inset-0 z-10 rounded-3xl"></div>
          {/if}

          <canvas
            class:opacity-0={loading || isBusy(statusData?.status)}
            class:opacity-100={!loading && !isBusy(statusData?.status)}
            class="transition-opacity duration-300"
            bind:this={notProcessedCanvas}
          ></canvas>
        </div>
      </div>
    </section>
  {/if}
</div>

<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Chart,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Filler
  } from 'chart.js';

  import { blik } from '$lib/api/blik';
  import type { components } from '$lib/api/schema';

  /* ================= CHART.JS SETUP ================= */

  Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Filler
  );

  /* ================= TYPES ================= */

  type StatisticsResponse = components['schemas']['StatisticsResponse'];

  /* ================= STATE ================= */

  let data: StatisticsResponse | null = null;
  let loading = true;
  let error: string | null = null;

  let processedRatio = 0;

  let notProcessed = {
    labels: [] as string[],
    values: [] as number[]
  };

  let incomplete = {
    labels: [] as string[],
    values: [] as number[]
  };

  /* ================= CANVAS REFS ================= */

  let notProcessedCanvas: HTMLCanvasElement | null = null;
  let incompleteCanvas: HTMLCanvasElement | null = null;

  let notProcessedChart: Chart | null = null;
  let incompleteChart: Chart | null = null;

  /* ================= HELPERS ================= */

  function toChartData(obj: Record<string, number>) {
    return {
      labels: Object.keys(obj),
      values: Object.values(obj)
    };
  }

  /* ================= LIFECYCLE ================= */

  onMount(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        goto('/login');
        return;
      }

      // 🔹 fetch danych
      data = await blik.getStats(token);

      processedRatio = Math.round((data.single_part_transactions / data.total_transactions) * 100);

      notProcessed = toChartData(data.not_processed_by_month);

      incomplete = toChartData(data.inclomplete_procesed_by_month);

      // ⏸️ CZEKAMY aż Svelte wyrenderuje canvas
      await tick();

      // 🧪 DIAGNOSTYKA – TO WKLEJ
      console.log('--- CHART DEBUG ---');
      console.log('notProcessedCanvas:', notProcessedCanvas);
      console.log('notProcessed.labels:', notProcessed.labels);
      console.log('notProcessed.values:', notProcessed.values);

      console.log('incompleteCanvas:', incompleteCanvas);
      console.log('incomplete.labels:', incomplete.labels);
      console.log('incomplete.values:', incomplete.values);
      console.log('-------------------');

      // 🔹 BAR CHART
      if (notProcessedCanvas && notProcessed.labels.length) {
        notProcessedChart = new Chart(notProcessedCanvas, {
          type: 'bar',
          data: {
            labels: notProcessed.labels,
            datasets: [
              {
                label: 'Not processed',
                data: notProcessed.values,
                backgroundColor: '#f87171'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }

      // 🔹 LINE CHART
      if (incompleteCanvas && incomplete.labels.length) {
        incompleteChart = new Chart(incompleteCanvas, {
          type: 'line',
          data: {
            labels: incomplete.labels,
            datasets: [
              {
                label: 'Incomplete',
                data: incomplete.values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.25)',
                tension: 0.3,
                fill: true,
                pointRadius: 3
              }
            ]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e: any) {
      error = e?.message ?? 'Failed to load statistics';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    notProcessedChart?.destroy();
    incompleteChart?.destroy();
  });
</script>

<!-- ================= TEMPLATE ================= -->

{#if loading}
  <div class="space-y-4">
    <div class="skeleton h-8 w-64"></div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="skeleton h-28"></div>
      <div class="skeleton h-28"></div>
      <div class="skeleton h-28"></div>
      <div class="skeleton h-28"></div>
    </div>
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div class="skeleton h-64"></div>
      <div class="skeleton h-64"></div>
    </div>
  </div>
{:else if error}
  <div class="alert alert-error">
    <span>{error}</span>
  </div>
{:else if data}
  {@const d = data}

  <div class="space-y-6">
    <!-- HEADER -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">BLIK · Processing Stats</h1>
      <div class="badge badge-outline">
        Total: {d.total_transactions}
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="text-sm opacity-70">Total transactions</div>
          <div class="text-3xl font-bold">{d.total_transactions}</div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="text-sm opacity-70">Single-part</div>
          <div class="text-success text-3xl font-bold">
            {d.single_part_transactions}
          </div>
          <div class="text-xs opacity-60">
            {processedRatio}% processed cleanly
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="text-sm opacity-70">Uncategorized</div>
          <div class="text-warning text-3xl font-bold">
            {d.uncategorized_transactions}
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="text-sm opacity-70">Not processed</div>
          <div class="text-error text-3xl font-bold">
            {d.not_processed_transactions}
          </div>
        </div>
      </div>
    </div>

    <!-- FILTERS -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="text-sm opacity-70">Filtered (exact)</div>
          <div class="text-2xl font-bold">
            {d.filtered_by_description_exact}
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <div class="text-sm opacity-70">Filtered (partial)</div>
          <div class="text-2xl font-bold">
            {d.filtered_by_description_partial}
          </div>
        </div>
      </div>
    </div>

    <!-- CHARTS -->
  </div>
{/if}

<div class="card bg-base-100 shadow">
  <div class="card-body">
    <h2 class="card-title">Not processed by month</h2>

    <div class="relative h-64">
      <canvas bind:this={notProcessedCanvas}></canvas>
    </div>
  </div>
</div>

<div class="card bg-base-100 shadow">
  <div class="card-body">
    <h2 class="card-title">Incomplete processed · trend</h2>

    <div class="relative h-64">
      <canvas bind:this={incompleteCanvas}></canvas>
    </div>
  </div>
</div>
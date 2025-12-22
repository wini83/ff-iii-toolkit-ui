<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
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

      // 🔹 BAR CHART (INCOMPLETE)
      if (incompleteCanvas && incomplete.labels.length) {
        incompleteChart = new Chart(incompleteCanvas, {
          type: 'bar',
          data: {
            labels: incomplete.labels,
            datasets: [
              {
                label: 'Incomplete',
                data: incomplete.values,
                backgroundColor: '#3b82f6'
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

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div class=""></div>
    <div class="text-right">
      <button class="btn btn-ghost btn-sm normal-case">
        <Icon src={icons.ArrowPath} class="inline-block h-5 w-5 stroke-current" />
        Refresh Data
      </button>
      <button class="btn btn-ghost btn-sm ml-2 normal-case">
        <Icon src={icons.Share} class="inline-block h-5 w-5 stroke-current" />
        Share
      </button>
      <div class="dropdown dropdown-bottom dropdown-end ml-2">
        <!-- TRIGGER -->
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square normal-case"
          aria-label="More actions"
        >
          <Icon src={icons.EllipsisVertical} class="inline-block h-5 w-5 stroke-current" />
        </button>

        <!-- MENU -->
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

  <div class="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">

    <div class="stats bg-base-100 shadow rounded-box">
      <div class="stat">
        <div class="stat-figure text-primary">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-primary">Total transactions</div>
        <div class="stat-value text-primary">{d.total_transactions}</div>
        <div class="stat-desc">Single-part:  {d.single_part_transactions} </div>
      </div>
    </div>


    <div class="stats bg-base-100 shadow rounded-box">
      <div class="stat">
        <div class="stat-figure text-secondary">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-secondary">Uncategorized</div>
        <div class="stat-value  text-secondary">{d.uncategorized_transactions}</div>
      </div>
    </div>

    <div class="stats bg-base-100 shadow rounded-box">
      <div class="stat">
        <div class="stat-figure text-warning">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title text-warning">Not processed (TAG)</div>
        <div class="stat-value text-warning">{d.not_processed_transactions}</div>
        <div class="stat-desc text-warning">by description:  {d.filtered_by_description_exact} </div>
      </div>
    </div>

    <div class="stats bg-base-100 shadow rounded-box">
      <div class="stat">
        <div class="stat-figure">
          <Icon src={icons.CircleStack} class="inline-block h-8 w-8 stroke-current" />
        </div>
        <div class="stat-title">Incomplete processed</div>
        <div class="stat-value">{d.filtered_by_description_partial}</div>
      </div>
    </div>

    <!-- CHARTS -->
  </div>
{/if}

<!-- CHART: NOT PROCESSED -->
<div class="card bg-base-100 mt-6 w-full p-6 shadow-xl">
  
    <div class="text-xl font-semibold ">Not processed by month</div>

    <div class="divider mt-2 mb-2"></div>

    <div class="relative h-64">
      {#if loading}
        <div class="skeleton absolute inset-0 z-10"></div>
      {/if}

      <canvas
        class:opacity-0={loading}
        class:opacity-100={!loading}
        class="transition-opacity duration-300"
        bind:this={notProcessedCanvas}
      ></canvas>
    </div>
 
</div>

<!-- CHART: INCOMPLETE -->
<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
 
    <h2 class="text-xl font-semibold">Incomplete processed by month</h2>

    <div class="divider mt-2 mb-2"></div>

    <div class="relative h-64">
      {#if loading}
        <div class="skeleton absolute inset-0 z-10"></div>
      {/if}

      <canvas
        class:opacity-0={loading}
        class:opacity-100={!loading}
        class="transition-opacity duration-300"
        bind:this={incompleteCanvas}
      ></canvas>
    </div>
  
</div>

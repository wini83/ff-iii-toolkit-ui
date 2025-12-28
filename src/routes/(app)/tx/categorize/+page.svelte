<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { getScreeningMonth, assignCategory } from '$lib/api/tx';
  import type { operations } from '$lib/api/schema';

  // --- OpenAPI types ---
  type ScreeningMonthResponse =
    operations['get_screening_month_api_tx_screening_get']['responses'][200]['content']['application/json'];

  let loading = true;
  let error: string | null = null;
  let initialized = false;

  let data: ScreeningMonthResponse | null = null;
  let initialCount = 0;

  let year: number;
  let month: number;

  // cursor → JEDNA transakcja na ekranie
  let cursor = 0;

  // pending selections (nic nie zapisuje się samo)
  let selectedCategories: Record<string, number | null> = {};

  const PRIMARY_TAGS = new Set(['blik_done', 'allegro_done']);
  const isPrimary = (tag: string) => PRIMARY_TAGS.has(tag);

  $: if (initialized) {
    const params = $page.url.searchParams;
    const y = Number(params.get('year'));
    const m = Number(params.get('month'));

    if (y && m && (y !== year || m !== month)) {
      year = y;
      month = m;
      load();
    }
  }

  $: currentTx = data?.transactions[cursor] ?? null;

  function resolveYearMonth() {
    const params = $page.url.searchParams;
    const now = new Date();

    year = Number(params.get('year')) || now.getFullYear();
    month = Number(params.get('month')) || now.getMonth() + 1;
  }

  async function load() {
    loading = true;
    error = null;

    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    try {
      data = await getScreeningMonth(year, month, token);
      if (data) {
        initialCount = data.transactions.length;
        cursor = 0;
        selectedCategories = {};
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function applyCurrent() {
    if (!currentTx || !data) return;

    const categoryId = selectedCategories[currentTx.id];
    if (!categoryId) return;

    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    try {
      await assignCategory(Number(currentTx.id), categoryId, token);

      data.transactions = data.transactions.filter((t) => t.id !== currentTx.id);
      data.remaining -= 1;

      delete selectedCategories[currentTx.id];

      if (cursor >= data.transactions.length) {
        cursor = Math.max(0, data.transactions.length - 1);
      }

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'success', msg: 'Category assigned' }
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign category';
      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'error', msg: message }
        })
      );
    }
  }

  function prevTx() {
    if (cursor > 0) cursor--;
  }

  function nextTx() {
    if (data && cursor < data.transactions.length - 1) cursor++;
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    goto(`?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  function nextMonth() {
    const d = new Date(year, month, 1);
    goto(`?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  onMount(() => {
    resolveYearMonth();
    load();
    initialized = true;
  });
</script>

<div class="card bg-base-100 mt-2 w-full p-4 shadow-xl">
  <div class="inline-block text-xl font-semibold">
    Transaction Screening
    <!-- <div class="float-right inline-block">
      <div class="float-right inline-block">
          <button class="btn btn-sm btn-primary px-6 normal-case">Add New</button>
        </div>
    </div> -->
  </div>

  <div class="divider mt-2"></div>

  <!-- MONTH SELECTOR -->
  <div class="mb-3 flex items-center justify-between">
    <button class="btn btn-primary btn-sm" on:click={prevMonth}>
      <Icon src={icons.ChevronDoubleLeft} class="h-5 w-5" />
    </button>
    <div class="items-center gap-1 font-semibold whitespace-nowrap">
      <Icon src={icons.CalendarDays} class="inline-block h-5 w-5 align-middle" />
      {year}-{String(month).padStart(2, '0')}
    </div>
    <button class="btn btn-primary btn-sm" on:click={nextMonth}>
      <Icon src={icons.ChevronDoubleRight} class="h-5 w-5" />
    </button>
  </div>

  {#if loading}
    <div class="skeleton h-32 w-full"></div>
  {:else if error}
    <div role="alert" class="alert alert-error">
      <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
      <span>{error}</span>
    </div>
  {:else if data === null || data.remaining === 0}
    <div role="alert" class="alert alert-success">
      <Icon src={icons.CheckCircle} class="h-5 w-5" />
      <span>No one transaction left </span>
    </div>
  {:else if currentTx}
    <!-- PROGRESS -->
    <progress
      class="progress progress-primary mb-3"
      value={initialCount - data.remaining}
      max={initialCount}
    ></progress>

    <!-- TRANSACTION CARD -->

    <div>
      <div class="font-semibold">#{currentTx.id} - {currentTx.description}</div>
      <div class="text-sm opacity-70">
        {currentTx.date} · {currentTx.amount} PLN
      </div>

      {#if currentTx.notes}
        <div class="text-base-content/80 mt-2 text-sm whitespace-pre-wrap">
          {currentTx.notes}
        </div>
      {/if}

      {#if currentTx.tags?.length}
        <div class="mt-2 flex flex-wrap gap-2">
          {#each currentTx.tags as tag}
            <span class={`badge badge-sm ${isPrimary(tag) ? 'badge-primary' : 'badge-outline'}`}>
              {tag}
            </span>
          {/each}
        </div>
      {/if}

      <!-- CATEGORY -->
      <div class="join mt-4">
        <select
          class="join-item select select-primary"
          bind:value={selectedCategories[currentTx.id]}
        >
          <option value={null}>— choose category —</option>
          {#each data.categories as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>

        <button
          class="btn btn-primary join-item"
          disabled={!selectedCategories[currentTx.id]}
          on:click={applyCurrent}
        >
          Apply
        </button>
        <button class="btn join-item"> Action Required </button>
        <button class="btn join-item"> Rule Potential </button>
      </div>
    </div>
    <!-- NAVIGATION -->
    <div class="mt-4 flex items-center justify-between">
      <button class="btn btn-primary btn-sm" disabled={cursor === 0} on:click={prevTx}>
        <Icon src={icons.ChevronLeft} class="h-5 w-5" />
      </button>

      <span class="text-sm opacity-70">
        {cursor + 1} / {data.transactions.length}
      </span>

      <button
        class="btn btn-primary btn-sm"
        disabled={cursor >= data.transactions.length - 1}
        on:click={nextTx}
      >
        <Icon src={icons.ChevronRight} class="h-5 w-5" />
      </button>
    </div>
  {/if}
</div>

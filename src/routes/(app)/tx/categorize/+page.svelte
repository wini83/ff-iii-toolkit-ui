<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { getScreeningMonth, assignCategory, applyTag } from '$lib/api/tx';
  import type { operations, components } from '$lib/api/schema';

  /* ---------------- Types ---------------- */

  type ScreeningMonthResponse =
    operations['get_screening_month_api_tx_screening_get']['responses'][200]['content']['application/json'];

  type TxTag = components['schemas']['TxTag'];

  /* ---------------- State ---------------- */

  let loading = true;
  let error: string | null = null;
  let initialized = false;

  let data: ScreeningMonthResponse | null = null;
  let initialCount = 0;

  let year: number;
  let month: number;

  let cursor = 0;

  // select = string
  let selectedCategories: Record<string, string> = {};

  const PRIMARY_TAGS = new Set(['blik_done', 'allegro_done']);
  const isPrimary = (tag: string) => PRIMARY_TAGS.has(tag);

  const TERMINAL_TAGS = new Set<TxTag>(['action_req']);

  /* ---------------- Derived ---------------- */

  $: currentTx = data?.transactions[cursor] ?? null;

  /* ---------------- Helpers ---------------- */

  function ensureCategoryState(txId: string) {
    if (selectedCategories[txId] === undefined) {
      selectedCategories = {
        ...selectedCategories,
        [txId]: ''
      };
    }
  }

  function resolveYearMonth() {
    const params = $page.url.searchParams;
    const now = new Date();

    year = Number(params.get('year')) || now.getFullYear();
    month = Number(params.get('month')) || now.getMonth() + 1;
  }

  /* ---------------- Data loading ---------------- */

  async function load() {
    loading = true;
    error = null;

    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    try {
      data = await getScreeningMonth(year, month, token);

      if (data && data.transactions.length > 0) {
        initialCount = data.transactions.length;
        cursor = 0;
        selectedCategories = {};
        ensureCategoryState(data.transactions[0].id);
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  /* ---------------- Actions ---------------- */

  async function applyCurrent() {
    if (!currentTx || !data) return;

    const rawValue = selectedCategories[currentTx.id];
    const categoryId = Number(rawValue);
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

      if (data.transactions[cursor]) {
        ensureCategoryState(data.transactions[cursor].id);
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

  async function tagCurrentTx(tag: TxTag) {
    if (!currentTx || !data) return;

    const token = localStorage.getItem('access_token');
    if (!token) return goto('/login');

    try {
      await applyTag(Number(currentTx.id), tag, token);

      if (TERMINAL_TAGS.has(tag)) {
        data.transactions = data.transactions.filter((t) => t.id !== currentTx.id);
        data.remaining -= 1;

        if (cursor >= data.transactions.length) {
          cursor = Math.max(0, data.transactions.length - 1);
        }

        if (data.transactions[cursor]) {
          ensureCategoryState(data.transactions[cursor].id);
        }
      }

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            type: 'success',
            msg: `Tag applied: ${tag.replace('_', ' ')}`
          }
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply tag';

      window.dispatchEvent(
        new CustomEvent('toast', {
          detail: { type: 'error', msg: message }
        })
      );
    }
  }

  /* ---------------- Navigation ---------------- */

  function prevTx() {
    if (cursor > 0) {
      cursor--;
      ensureCategoryState(data!.transactions[cursor].id);
    }
  }

  function nextTx() {
    if (data && cursor < data.transactions.length - 1) {
      cursor++;
      ensureCategoryState(data.transactions[cursor].id);
    }
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    goto(`?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  function nextMonth() {
    const d = new Date(year, month, 1);
    goto(`?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }

  /* ---------------- Init ---------------- */

  onMount(() => {
    resolveYearMonth();
    load();
    initialized = true;
  });

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
</script>

<div class="card bg-base-100 mt-2 w-full p-4 shadow-xl">
  <div class="text-xl font-semibold">Transaction Screening</div>
  <div class="divider mt-2"></div>

  <!-- MONTH SELECTOR -->
  <div class="mb-3 flex items-center justify-between">
    <button class="btn btn-primary btn-sm" on:click={prevMonth}>
      <Icon src={icons.ChevronDoubleLeft} class="h-5 w-5" />
    </button>

    <div class="font-semibold whitespace-nowrap">
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
    <div class="alert alert-error">
      <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
      <span>{error}</span>
    </div>
  {:else if data === null || data.remaining === 0}
    <div class="alert alert-success">
      <Icon src={icons.CheckCircle} class="h-5 w-5" />
      <span>No transaction left</span>
    </div>
  {:else if currentTx}
    <progress
      class="progress progress-primary mb-3"
      value={initialCount - data.remaining}
      max={initialCount}
    ></progress>

    <div>
      <div class="font-semibold">#{currentTx.id} – {currentTx.description}</div>
      <div class="text-sm opacity-70">
        {currentTx.date} · {currentTx.amount} PLN
      </div>

      {#if currentTx.tags?.length}
        <div class="mt-2 flex gap-2">
          {#each currentTx.tags as tag}
            <span class={`badge badge-sm ${isPrimary(tag) ? 'badge-primary' : 'badge-outline'}`}>
              {tag}
            </span>
          {/each}
        </div>
      {/if}

      <!-- CATEGORY -->
      <div class="join mt-4">
        <select class="select" bind:value={selectedCategories[currentTx.id]}>
          <option value="" disabled>Pick a category</option>
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
      </div>

      <div class="join mt-3">
        <button class="btn join-item" on:click={() => tagCurrentTx('action_req')}>
          Action Required
        </button>
        <button class="btn join-item" on:click={() => tagCurrentTx('rule_potential')}>
          Rule Potential
        </button>
      </div>
    </div>

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

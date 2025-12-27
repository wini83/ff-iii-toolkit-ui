<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { getScreeningMonth, assignCategory } from '$lib/api/tx';
  import type { operations } from '$lib/api/schema';

  // --- TYPY Z OPENAPI (single source of truth) ---
  type ScreeningMonthResponse =
    operations['get_screening_month_api_tx_screening_get']['responses'][200]['content']['application/json'];

  let loading = true;
  let error: string | null = null;

  let data: ScreeningMonthResponse | null = null;
  let initialCount = 0;

  let year: number;
  let month: number;

  const PRIMARY_TAGS = new Set(['blik_done', 'allegro_done']);
  const isPrimary = (tag: string) => PRIMARY_TAGS.has(tag);

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
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function apply(txId: string, categoryId: number) {
    const token = localStorage.getItem('access_token');
    if (!token || !data) return;

    try {
      await assignCategory(Number(txId), categoryId, token);

      data.transactions = data.transactions.filter((t) => t.id !== txId);
      data.remaining -= 1;

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

  function gotoNextMonth() {
    const next = new Date(year, month, 1);
    goto(`?year=${next.getFullYear()}&month=${next.getMonth() + 1}`);
  }

  onMount(() => {
    resolveYearMonth();
    load();
  });
</script>

<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <div class="text-xl font-semibold">
    Transaction Screening — {year}-{String(month).padStart(2, '0')}
  </div>

  <div class="divider mt-2"></div>

  {#if loading}
    <div class="skeleton h-32 w-full"></div>
  {:else if error}
    <div role="alert" class="alert alert-error">
      <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
      <span>Error! {error}</span>
    </div>
  {:else if data === null}
    <div role="alert" class="alert alert-info">
      <Icon src={icons.InformationCircle} class="h-5 w-5" />
      <span>Brak niesklasyfikowanych transakcji w tym miesiącu 🎉</span>
    </div>
  {:else}
    <!-- PROGRESS -->
    <progress
      class="progress progress-primary mb-4"
      value={initialCount - data.remaining}
      max={initialCount}
    ></progress>

    <!-- LISTA TRANSAKCJI -->
    {#each data.transactions as tx (tx.id)}
      <div class="card bg-base-100 mb-4 p-4 shadow">
        <div class="font-semibold">{tx.description}</div>
        <div class="text-sm opacity-70">
          {tx.date} · {tx.amount} PLN
        </div>

        {#if tx.notes}
          <div class="text-base-content/80 mt-2 text-sm whitespace-pre-wrap">
            {tx.notes}
          </div>
        {/if}

        {#if tx.tags?.length}
          <div class="mt-2 flex flex-wrap gap-2">
            {#each tx.tags as tag}
              <span class={`badge ${isPrimary(tag) ? 'badge-primary' : 'badge-outline'}`}>
                {tag}
              </span>
            {/each}
          </div>
        {/if}

        <div class="mt-3 flex items-center gap-2">
          <select
            class="select select-sm"
            on:change={(e) => apply(tx.id, Number((e.currentTarget as HTMLSelectElement).value))}
          >
            <option value="">— wybierz kategorię —</option>
            {#each data.categories as c}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </div>
      </div>
    {/each}

    <!-- EMPTY STATE -->
    {#if data.remaining === 0}
      <div class="alert alert-success mt-6">
        <Icon src={icons.CheckCircle} class="h-5 w-5" />
        <span>Miesiąc zamknięty ✔</span>
      </div>

      <button class="btn btn-primary mt-4" on:click={gotoNextMonth}> Następny miesiąc → </button>
    {/if}
  {/if}
</div>

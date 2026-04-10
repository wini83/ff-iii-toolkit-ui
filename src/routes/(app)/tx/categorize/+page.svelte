<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { getScreeningMonth, assignCategory, applyTag } from '$lib/api/tx';
  import type { operations, components } from '$lib/api/schema';

  type ScreeningMonthResponse =
    operations['get_screening_month_api_tx_screening_get']['responses'][200]['content']['application/json'];

  type TxTag = components['schemas']['TxTag'];
  type FireflyAccountRef = components['schemas']['SimplifiedAccountRef'];

  let loading = true;
  let error: string | null = null;
  let initialized = false;

  let data: ScreeningMonthResponse | null = null;
  let initialCount = 0;

  let year: number;
  let month: number;
  let draftYear: number;
  let draftMonth: number;

  let cursor = 0;
  let selectedCategories: Record<string, string> = {};

  const PRIMARY_TAGS = new Set(['blik_done', 'allegro_done']);
  const isPrimary = (tag: string) => PRIMARY_TAGS.has(tag);

  const TERMINAL_TAGS = new Set<TxTag>(['action_req']);
  const MONTH_OPTIONS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ] as const;

  $: currentTx = data?.transactions[cursor] ?? null;
  $: currentTxId = currentTx ? toIdString(currentTx.id) : null;
  $: progressValue = data ? initialCount - data.remaining : 0;
  $: sourceAccount = currentTx ? getAccountSummary(currentTx.source_account) : null;
  $: destinationAccount = currentTx ? getAccountSummary(currentTx.destination_account) : null;

  function toIdString(id: string | number): string {
    return String(id);
  }

  function formatMoney(
    amount: number,
    currencyCode: string | null | undefined,
    currencySymbol: string | null | undefined
  ) {
    const safeCode = currencyCode && currencyCode.trim() ? currencyCode.trim() : 'PLN';
    const safeSymbol = currencySymbol && currencySymbol.trim() ? currencySymbol.trim() : safeCode;
    return `${amount} ${safeSymbol} (${safeCode})`;
  }

  function splitNotesLines(notes: string | null | undefined) {
    if (!notes || !notes.trim()) return [];
    return notes
      .replaceAll('\\n', '\n')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function getAccountSummary(account: FireflyAccountRef | null | undefined) {
    if (!account) return null;

    const name = account.name.trim() || `Account #${account.id}`;
    const meta: string[] = [];

    if (account.type) meta.push(account.type);

    const iban = account.iban?.trim();
    if (iban) meta.push(iban);

    return {
      name,
      meta: meta.length > 0 ? meta.join(' · ') : null
    };
  }

  function ensureCategoryState(txId: string | number) {
    const normalizedId = toIdString(txId);

    if (selectedCategories[normalizedId] === undefined) {
      selectedCategories = {
        ...selectedCategories,
        [normalizedId]: ''
      };
    }
  }

  function resolveYearMonth() {
    const params = $page.url.searchParams;
    const now = new Date();

    year = Number(params.get('year')) || now.getFullYear();
    month = Number(params.get('month')) || now.getMonth() + 1;
    draftYear = year;
    draftMonth = month;
  }

  async function load() {
    loading = true;
    error = null;

    try {
      data = await getScreeningMonth(year, month);

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

  async function applyCurrent() {
    if (!currentTx || !data) return;

    const rawValue = selectedCategories[toIdString(currentTx.id)];
    const categoryId = Number(rawValue);
    if (!categoryId) return;

    try {
      await assignCategory(Number(currentTx.id), categoryId);

      data.transactions = data.transactions.filter((t) => t.id !== currentTx.id);
      data.remaining -= 1;

      delete selectedCategories[toIdString(currentTx.id)];

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

    try {
      await applyTag(Number(currentTx.id), tag);

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

  function prevTx() {
    if (cursor > 0 && data) {
      cursor--;
      ensureCategoryState(data.transactions[cursor].id);
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

  function jumpToPeriod() {
    const nextYear = Number.isFinite(draftYear) ? Math.trunc(draftYear) : year;
    const nextMonth = Number.isFinite(draftMonth) ? Math.trunc(draftMonth) : month;

    if (nextMonth < 1 || nextMonth > 12) return;
    if (nextYear < 1) return;

    goto(`?year=${nextYear}&month=${nextMonth}`);
  }

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

<svelte:head>
  <title>Transactions Categorize — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-primary/12 text-primary rounded-3xl p-4">
          <Icon src={icons.DocumentMagnifyingGlass} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Screening workflow
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Transaction screening</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Review one transaction at a time, assign a category and mark rows that need action or
              rule follow-up.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Month</div>
          <div class="mt-2 text-lg font-semibold">{year}-{String(month).padStart(2, '0')}</div>
          <p class="mt-2 text-sm">
            Move through screening months and process the pending queue for the selected period.
          </p>
        </div>

        <div class="grid gap-3">
          <div class="grid gap-3 sm:grid-cols-[1fr_0.8fr_auto]">
            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs font-medium tracking-[0.18em] uppercase">
                  Month
                </span>
              </div>
              <select class="select select-bordered select-sm w-full" bind:value={draftMonth}>
                {#each MONTH_OPTIONS as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>

            <label class="form-control">
              <div class="label py-1">
                <span class="label-text text-xs font-medium tracking-[0.18em] uppercase">
                  Year
                </span>
              </div>
              <input
                class="input input-bordered input-sm w-full"
                type="number"
                min="1"
                step="1"
                bind:value={draftYear}
              />
            </label>

            <div class="flex items-end">
              <button class="btn btn-primary btn-sm w-full" on:click={jumpToPeriod}>
                Go
                <Icon src={icons.ArrowRight} class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button class="btn btn-outline btn-sm" on:click={prevMonth}>
              <Icon src={icons.ChevronDoubleLeft} class="h-4 w-4" />
              Previous
            </button>
            <button class="btn btn-outline btn-sm" on:click={nextMonth}>
              Next
              <Icon src={icons.ChevronDoubleRight} class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-semibold">Current transaction</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Step through the queue, choose a category and apply terminal tags when needed.
          </p>
        </div>

        {#if data && data.remaining > 0}
          <div class="text-base-content/70 text-sm">
            {cursor + 1} / {data.transactions.length} in current queue
          </div>
        {/if}
      </div>

      <div class="divider my-0"></div>

      {#if loading}
        <div class="space-y-3">
          <div class="skeleton h-6 w-48"></div>
          <div class="skeleton h-24 w-full rounded-3xl"></div>
          <div class="skeleton h-14 w-full rounded-2xl"></div>
        </div>
      {:else if error}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{error}</span>
        </div>
      {:else if data === null || data.remaining === 0}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-success/12 text-success rounded-3xl p-4">
            <Icon src={icons.CheckCircle} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No transactions left</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            The selected month does not have any more transactions waiting for screening.
          </p>
        </div>
      {:else if currentTx && currentTxId}
        <div class="space-y-5">
          <progress
            class="progress progress-primary w-full"
            value={progressValue}
            max={initialCount}
          ></progress>

          <article
            class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
          >
            <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="text-lg font-semibold">#{currentTx.id} - {currentTx.description}</h4>
                  </div>
                  <div class="text-base-content/70 mt-2 text-sm">
                    {currentTx.date} · {formatMoney(
                      currentTx.amount,
                      currentTx.currency_code,
                      currentTx.currency_symbol
                    )}
                  </div>
                  {#if currentTx.fx_amount !== null && currentTx.fx_amount !== undefined}
                    <div class="text-base-content/70 mt-1 text-sm">
                      FX: {formatMoney(
                        currentTx.fx_amount,
                        currentTx.fx_currency,
                        currentTx.fx_currency
                      )}
                    </div>
                  {/if}
                </div>

                {#if currentTx.tags?.length}
                  <div class="flex flex-wrap gap-2">
                    {#each currentTx.tags as tag}
                      <span
                        class={`badge badge-sm ${isPrimary(tag) ? 'badge-primary' : 'badge-outline'}`}
                      >
                        {tag}
                      </span>
                    {/each}
                  </div>
                {/if}
              </div>

              {#if splitNotesLines(currentTx.notes).length > 0}
                <div class="bg-base-200/60 mt-4 rounded-2xl px-4 py-4">
                  <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Notes</div>
                  <div class="mt-2 space-y-1 text-sm">
                    {#each splitNotesLines(currentTx.notes) as noteLine}
                      <div>{noteLine}</div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if sourceAccount || destinationAccount}
                <div class="bg-base-200/60 mt-4 rounded-2xl px-4 py-4">
                  <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                    Firefly accounts
                  </div>
                  <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <div class="bg-base-100 rounded-2xl px-4 py-3">
                      <div class="text-base-content/50 text-xs uppercase">Source</div>
                      <div class="mt-1 text-sm font-medium">{sourceAccount?.name ?? '-'}</div>
                      {#if sourceAccount?.meta}
                        <div class="text-base-content/60 mt-1 text-xs">{sourceAccount.meta}</div>
                      {/if}
                    </div>
                    <div class="bg-base-100 rounded-2xl px-4 py-3">
                      <div class="text-base-content/50 text-xs uppercase">Destination</div>
                      <div class="mt-1 text-sm font-medium">
                        {destinationAccount?.name ?? '-'}
                      </div>
                      {#if destinationAccount?.meta}
                        <div class="text-base-content/60 mt-1 text-xs">
                          {destinationAccount.meta}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}

              <div class="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <label class="form-control">
                  <div class="label">
                    <span class="label-text font-medium">Category</span>
                  </div>
                  <select
                    class="select select-bordered w-full"
                    bind:value={selectedCategories[currentTxId]}
                  >
                    <option value="" disabled>Pick a category</option>
                    {#each data.categories as c}
                      <option value={c.id}>{c.name}</option>
                    {/each}
                  </select>
                </label>

                <button
                  class="btn btn-primary w-full lg:w-auto"
                  disabled={!selectedCategories[currentTxId]}
                  on:click={applyCurrent}
                >
                  <Icon src={icons.CheckCircle} class="h-5 w-5" />
                  Apply category
                </button>
              </div>

              <div class="mt-4 flex flex-wrap gap-3">
                <button class="btn btn-ghost" on:click={() => tagCurrentTx('action_req')}>
                  <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
                  Action Required
                </button>
                <button class="btn btn-ghost" on:click={() => tagCurrentTx('rule_potential')}>
                  <Icon src={icons.Sparkles} class="h-5 w-5" />
                  Rule Potential
                </button>
              </div>
            </div>
          </article>

          <div
            class="border-base-200 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-base-content/70 text-sm">
              Remaining: {data.remaining} of {initialCount}
            </div>

            <div class="flex items-center gap-2">
              <button class="btn btn-outline btn-sm" disabled={cursor === 0} on:click={prevTx}>
                <Icon src={icons.ChevronLeft} class="h-4 w-4" />
                Prev
              </button>
              <span class="text-sm">{cursor + 1} / {data.transactions.length}</span>
              <button
                class="btn btn-outline btn-sm"
                disabled={cursor >= data.transactions.length - 1}
                on:click={nextTx}
              >
                Next
                <Icon src={icons.ChevronRight} class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

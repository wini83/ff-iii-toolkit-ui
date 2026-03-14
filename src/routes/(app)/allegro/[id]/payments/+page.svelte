<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { allegro } from '$lib/api/allegro';
  import type { components } from '$lib/api/schema';

  type AllegroPayment = components['schemas']['AllegroPayment'];
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

  let loading = true;
  let networkError: string | null = null;
  let payments: AllegroPayment[] = [];
  let pageSize = 20;
  let offset = 0;

  $: secretId = $page.params.id;
  $: accountLogin = payments.length > 0 ? payments[0]?.allegro_login ?? null : null;
  $: currentPage = Math.floor(offset / pageSize) + 1;
  $: hasNextPage = payments.length === pageSize;

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
      (type === 'error'
        ? 'Failed to load Allegro payments'
        : type === 'success'
          ? 'Success'
          : 'Info');

    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: { type, msg: safeMsg }
      })
    );
  }

  function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  function formatAmount(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  async function loadPayments() {
    const routeSecretId = getNonEmptyString(secretId);

    if (!routeSecretId) {
      networkError = 'Missing secret id in route.';
      loading = false;
      return;
    }

    loading = true;
    networkError = null;

    try {
      payments = await allegro.fetchPayments(routeSecretId, undefined, pageSize, offset);
    } catch (error: unknown) {
      networkError = extractErrorMessage(error, 'Failed to load Allegro payments');
      emitToast('error', networkError);
      payments = [];
    } finally {
      loading = false;
    }
  }

  function openMatches() {
    goto(`/allegro/${secretId}/matches`);
  }

  function openAccounts() {
    goto('/allegro/accounts');
  }

  onMount(() => {
    void loadPayments();
  });

  function goToPreviousPage() {
    if (loading || offset === 0) return;
    offset = Math.max(0, offset - pageSize);
    void loadPayments();
  }

  function goToNextPage() {
    if (loading || !hasNextPage) return;
    offset += pageSize;
    void loadPayments();
  }

  function onPageSizeChange(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = Number.parseInt(target.value, 10);
    if (!Number.isFinite(value) || value <= 0 || value === pageSize) return;
    pageSize = value;
    offset = 0;
    void loadPayments();
  }
</script>

<svelte:head>
  <title>Allegro Payments — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-warning/15 text-warning rounded-3xl p-4">
          <Icon src={icons.CreditCard} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Payment review
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Allegro payments</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Review imported payments for the selected Allegro secret{accountLogin
                ? ` (${accountLogin})`
                : ''}.
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
            Switch to matching for this account or return to the account selection view.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button class="btn btn-secondary" on:click={openAccounts}>
            <Icon src={icons.Key} class="h-5 w-5" />
            Acounts
          </button>
          <button class="btn btn-primary" on:click={openMatches}>
            <Icon src={icons.Sparkles} class="h-5 w-5" />
            Matches
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 class="text-xl font-semibold">Imported payments</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Browse paginated payments and inspect identifiers, details and balance status.
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div class="flex items-center gap-2">
            <button
              class="btn btn-outline btn-sm"
              on:click={goToPreviousPage}
              disabled={loading || offset === 0}
            >
              Prev
            </button>
            <span class="text-sm">Page {currentPage}</span>
            <button
              class="btn btn-outline btn-sm"
              on:click={goToNextPage}
              disabled={loading || !hasNextPage}
            >
              Next
            </button>
          </div>

          <button class="btn btn-ghost btn-sm" disabled={loading} on:click={loadPayments}>
            {#if loading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon src={icons.ArrowPath} class="h-4 w-4" />
            {/if}
            Refresh
          </button>
        </div>
      </div>

      <div class="divider my-0"></div>

      <p class="text-base-content/70 text-xs">
        Showing {payments.length === 0 ? 0 : offset + 1} - {offset + payments.length}
      </p>

      {#if networkError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{networkError}</span>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-2 pt-2">
          <div class="skeleton h-12 w-full rounded-2xl"></div>
          <div class="skeleton h-12 w-full rounded-2xl"></div>
          <div class="skeleton h-12 w-full rounded-2xl"></div>
          <div class="skeleton h-12 w-full rounded-2xl"></div>
        </div>
      {:else if payments.length === 0}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-warning/15 text-warning rounded-3xl p-4">
            <Icon src={icons.CreditCard} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No payments to display</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            This account does not have imported payment rows for the current query window.
          </p>
          <button class="btn btn-primary mt-6" on:click={openMatches}>
            <Icon src={icons.Sparkles} class="h-5 w-5" />
            Open matches
          </button>
        </div>
      {:else}
        <div class="hidden overflow-x-auto xl:block">
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Short ID</th>
                <th>Details</th>
                <th class="text-right">Balanced</th>
              </tr>
            </thead>
            <tbody>
              {#each payments as payment}
                <tr class="hover">
                  <td>{formatDate(payment.date)}</td>
                  <td class="font-medium">{formatAmount(payment.amount)}</td>
                  <td>
                    <div class="tooltip" data-tip={payment.external_id}>
                      <span
                        class="from-warning/20 to-primary/10 inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 font-mono text-xs font-semibold"
                      >
                        {payment.external_short_id}
                      </span>
                    </div>
                  </td>
                  <td class="max-w-96">
                    {#if payment.details.length}
                      <div class="space-y-1 text-sm">
                        {#each payment.details as detail}
                          <div class="leading-tight">{detail}</div>
                        {/each}
                      </div>
                    {:else}
                      <span class="text-sm">-</span>
                    {/if}
                  </td>
                  <td class="text-right">
                    <span
                      class={`badge badge-soft ${payment.is_balanced ? 'badge-success' : 'badge-warning'}`}
                    >
                      {payment.is_balanced ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="grid gap-4 xl:hidden">
          {#each payments as payment}
            <article
              class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
            >
              <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Date</div>
                    <div class="mt-2 text-sm font-semibold">{formatDate(payment.date)}</div>
                  </div>
                  <span
                    class={`badge badge-soft ${payment.is_balanced ? 'badge-success' : 'badge-warning'}`}
                  >
                    {payment.is_balanced ? 'Balanced' : 'Unbalanced'}
                  </span>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Amount</div>
                    <div class="mt-1 text-sm font-medium">{formatAmount(payment.amount)}</div>
                  </div>
                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Short ID</div>
                    <div class="mt-1 font-mono text-sm font-medium">
                      {payment.external_short_id}
                    </div>
                  </div>
                </div>

                <div class="bg-base-200/60 mt-4 rounded-2xl px-4 py-3">
                  <div class="text-base-content/60 text-xs uppercase">Details</div>
                  {#if payment.details.length}
                    <div class="mt-2 space-y-1 text-sm">
                      {#each payment.details as detail}
                        <div class="leading-tight">{detail}</div>
                      {/each}
                    </div>
                  {:else}
                    <div class="mt-2 text-sm">-</div>
                  {/if}
                </div>
              </div>
            </article>
          {/each}
        </div>

        <div
          class="border-base-200 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-center gap-2.5">
            <span class="text-base-content/60 text-xs font-medium whitespace-nowrap">
              Rows per page
            </span>
            <select
              class="select select-bordered min-w-18"
              value={pageSize}
              on:change={onPageSizeChange}
            >
              {#each PAGE_SIZE_OPTIONS as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="btn btn-outline btn-sm"
              on:click={goToPreviousPage}
              disabled={loading || offset === 0}
            >
              Prev
            </button>
            <span class="text-sm">Page {currentPage}</span>
            <button
              class="btn btn-outline btn-sm"
              on:click={goToNextPage}
              disabled={loading || !hasNextPage}
            >
              Next
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>

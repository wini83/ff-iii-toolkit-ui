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
      (type === 'error' ? 'Failed to load Allegro payments' : type === 'success' ? 'Success' : 'Info');

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

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="card-title">Allegro Payments</h3>
        <p class="text-base-content/70 text-sm">
          Payment list for selected Allegro secret{accountLogin ? ` (${accountLogin})` : ''}.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a href={`/allegro/${secretId}/matches`} class="btn btn-primary btn-sm">
          <Icon src={icons.Link} class="h-4 w-4" />
          Matches
        </a>
        <a href="/allegro/accounts" class="btn btn-primary btn-sm">
          <Icon src={icons.ArrowLeft} class="h-4 w-4" />
          Back to Accounts
        </a>
      </div>
    </div>
    <div class="divider mt-0 mb-2"></div>
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="text-sm">Rows per page</span>
        <select class="select select-bordered select-sm" value={pageSize} on:change={onPageSizeChange}>
          {#each PAGE_SIZE_OPTIONS as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-outline btn-sm" on:click={goToPreviousPage} disabled={loading || offset === 0}>
          Prev
        </button>
        <span class="text-sm">Page {currentPage}</span>
        <button class="btn btn-outline btn-sm" on:click={goToNextPage} disabled={loading || !hasNextPage}>
          Next
        </button>
      </div>
    </div>
    <p class="text-base-content/70 text-xs">
      Showing {payments.length === 0 ? 0 : offset + 1} - {offset + payments.length}
    </p>

    {#if networkError}
      <p class="text-error text-sm">{networkError}</p>
    {/if}

    {#if loading}
      <div class="space-y-2 pt-2">
        <div class="skeleton h-10 w-full"></div>
        <div class="skeleton h-10 w-full"></div>
        <div class="skeleton h-10 w-full"></div>
        <div class="skeleton h-10 w-full"></div>
      </div>
    {:else if payments.length === 0}
      <div class="alert mt-2">
        <Icon src={icons.InformationCircle} class="h-5 w-5" />
        <span>No payments to display.</span>
      </div>
    {:else}
      <div class="overflow-x-auto pt-2">
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
              <tr>
                <td>{formatDate(payment.date)}</td>
                <td class="font-medium">{formatAmount(payment.amount)}</td>
                <td>
                  <div class="tooltip" data-tip={payment.external_id}>
                    <span class="font-mono text-xs">{payment.external_short_id}</span>
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
                  <span class={`badge ${payment.is_balanced ? 'badge-success' : 'badge-warning'}`}>
                    {payment.is_balanced ? 'Yes' : 'No'}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

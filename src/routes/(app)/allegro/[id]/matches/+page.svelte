<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { allegro } from '$lib/api/allegro';
  import type { components } from '$lib/api/schema';

  type AllegroMatchResponse = components['schemas']['AllegroMatchResponse'];
  type AllegroMatchResult = components['schemas']['api__models__allegro__MatchResult'];
  type ApplyDecision = components['schemas']['api__models__allegro__ApplyDecision'];
  type ApplyJobResponse = components['schemas']['api__models__allegro__ApplyJobResponse'];
  type JobStatus = components['schemas']['JobStatus'];
  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

  const POLL_INTERVAL_MS = 2_000;
  const MAX_POLL_ATTEMPTS = 60;

  let loading = true;
  let applying = false;
  let networkError: string | null = null;
  let matchResponse: AllegroMatchResponse | null = null;
  let rows: AllegroMatchResult[] = [];
  let selectedCandidates: Set<string> = new Set();
  let appliedCandidates: Set<string> = new Set();
  let applyPollingCanceled = false;
  let pageSize = 20;
  let offset = 0;
  let isStatsModalOpen = false;
  let actionableOnly = false;

  $: secretId = $page.params.id;
  $: login = matchResponse?.login ?? null;
  $: currentPage = Math.floor(offset / pageSize) + 1;
  $: visibleRows = actionableOnly ? rows.filter(isActionableRow) : rows;

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
        ? 'Failed to load Allegro matches'
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

  function formatMoney(amount: number, symbol = 'PLN') {
    return `${amount.toFixed(2)} ${symbol}`;
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isBusy(status: JobStatus) {
    return status === 'pending' || status === 'running';
  }

  function candidateKey(txId: number, paymentExternalId: string) {
    return `${txId}::${paymentExternalId}`;
  }

  function isRowProcessed(row: AllegroMatchResult) {
    return row.status === 'already_processed';
  }

  function isActionableRow(row: AllegroMatchResult) {
    return !isRowProcessed(row) && row.matches.length > 0;
  }

  function canSelectCandidate(row: AllegroMatchResult, paymentExternalId: string) {
    return (
      !isRowProcessed(row) && !appliedCandidates.has(candidateKey(row.tx.id, paymentExternalId))
    );
  }

  function toggleCandidate(txId: number, paymentExternalId: string) {
    const key = candidateKey(txId, paymentExternalId);
    if (appliedCandidates.has(key)) return;
    if (selectedCandidates.has(key)) selectedCandidates.delete(key);
    else selectedCandidates.add(key);
    selectedCandidates = new Set(selectedCandidates);
  }

  function getSelectedDecisions(): ApplyDecision[] {
    const decisions: ApplyDecision[] = [];

    for (const row of rows) {
      for (const candidate of row.matches) {
        const key = candidateKey(row.tx.id, candidate.external_id);
        if (!selectedCandidates.has(key)) continue;
        decisions.push({
          transaction_id: row.tx.id,
          payment_id: candidate.external_short_id,
          strategy: 'manual'
        });
      }
    }

    return decisions;
  }

  function mapSelectedByTx(): Map<number, string[]> {
    const selectedByTx = new Map<number, string[]>();

    for (const row of rows) {
      for (const candidate of row.matches) {
        const key = candidateKey(row.tx.id, candidate.external_id);
        if (!selectedCandidates.has(key)) continue;
        const current = selectedByTx.get(row.tx.id) ?? [];
        selectedByTx.set(row.tx.id, [...current, key]);
      }
    }

    return selectedByTx;
  }

  function markAppliedForTxIds(successTxIds: Set<number>, selectedByTx: Map<number, string[]>) {
    let marked = 0;
    for (const txId of successTxIds) {
      const keys = selectedByTx.get(txId) ?? [];
      for (const key of keys) {
        if (!appliedCandidates.has(key)) {
          appliedCandidates.add(key);
          marked += 1;
        }
      }
    }

    appliedCandidates = new Set(appliedCandidates);
    if (successTxIds.size > 0) {
      rows = rows.map((row) =>
        successTxIds.has(row.tx.id) ? { ...row, status: 'already_processed' } : row
      );
    }
    return marked;
  }

  function processJobUpdatesSlice(
    resultsSlice: ApplyJobResponse['results'],
    selectedByTx: Map<number, string[]>
  ) {
    let newSuccess = 0;
    let newFailed = 0;
    const newSuccessTxIds = new Set<number>();

    for (const result of resultsSlice) {
      if (result.status === 'success') {
        newSuccess += 1;
        newSuccessTxIds.add(result.transaction_id);
      } else {
        newFailed += 1;
      }
    }

    if (newSuccessTxIds.size > 0) {
      markAppliedForTxIds(newSuccessTxIds, selectedByTx);
    }

    if (newSuccess > 0) emitToast('success', `Applied: ${newSuccess}.`);
    if (newFailed > 0) emitToast('error', `Failed: ${newFailed}.`);

    return { newSuccess, newFailed };
  }

  async function pollApplyJob(
    jobId: string,
    initialStatus: JobStatus,
    selectedByTx: Map<number, string[]>,
    processedRef: { value: number }
  ) {
    let status = initialStatus;
    let job: ApplyJobResponse | null = null;

    for (
      let attempt = 0;
      attempt < MAX_POLL_ATTEMPTS && isBusy(status) && !applyPollingCanceled;
      attempt += 1
    ) {
      await wait(POLL_INTERVAL_MS);
      if (applyPollingCanceled) break;
      job = await allegro.getApplyJob(jobId);
      if (!job) break;
      const total = job.results?.length ?? 0;
      if (total > processedRef.value) {
        const slice = job.results.slice(processedRef.value);
        processedRef.value = total;
        processJobUpdatesSlice(slice, selectedByTx);
      }
      status = job.status;
    }

    return job;
  }

  async function applySelected() {
    if (applying) return;

    const routeSecretId = getNonEmptyString(secretId);

    if (!routeSecretId) {
      emitToast('error', 'Missing secret id in route.');
      return;
    }

    const decisions = getSelectedDecisions();
    if (!decisions.length) {
      emitToast('info', 'No candidates selected.');
      return;
    }
    const selectedByTx = mapSelectedByTx();
    let processed = 0;
    applyPollingCanceled = false;

    applying = true;
    try {
      const startJob = await allegro.applyMatches(routeSecretId, decisions);
      if (!startJob) throw new Error('Apply job was not created.');

      const initialTotal = startJob.results?.length ?? 0;
      if (initialTotal > processed) {
        const initialSlice = startJob.results.slice(processed);
        processed = initialTotal;
        processJobUpdatesSlice(initialSlice, selectedByTx);
      }

      let finalJob = startJob;
      if (isBusy(startJob.status)) {
        const polled = await pollApplyJob(startJob.id, startJob.status, selectedByTx, {
          value: processed
        });
        if (polled) finalJob = polled;
      }

      if (finalJob.status === 'failed') {
        throw new Error('Apply job failed.');
      }

      const marked = appliedCandidates.size;
      selectedCandidates = new Set();

      if (finalJob.failed > 0 && finalJob.applied === 0) {
        const firstReason =
          finalJob.results.find(
            (result: ApplyJobResponse['results'][number]) => result.status === 'failed'
          )?.reason ?? null;
        emitToast(
          'error',
          firstReason
            ? `Apply failed: ${firstReason}`
            : `Apply failed for ${finalJob.failed} item(s).`
        );
      } else if (finalJob.failed > 0) {
        emitToast(
          'info',
          `Partially applied. Applied: ${finalJob.applied}, failed: ${finalJob.failed}.`
        );
      } else if (marked > 0 || finalJob.applied > 0) {
        emitToast('success', `Apply finished. Applied: ${finalJob.applied}.`);
      } else {
        emitToast('info', 'Apply finished with no successful updates.');
      }
    } catch (error: unknown) {
      emitToast('error', extractErrorMessage(error, 'Failed to apply selected matches'));
    } finally {
      applying = false;
    }
  }

  async function loadMatches() {
    const routeSecretId = getNonEmptyString(secretId);

    if (!routeSecretId) {
      networkError = 'Missing secret id in route.';
      loading = false;
      return;
    }

    loading = true;
    networkError = null;

    try {
      const result = await allegro.getMatches(routeSecretId, undefined, pageSize, offset);
      matchResponse = result;
      rows = result?.content ?? [];
      selectedCandidates = new Set();
    } catch (error: unknown) {
      networkError = extractErrorMessage(error, 'Failed to load Allegro matches');
      emitToast('error', networkError);
      matchResponse = null;
      rows = [];
      selectedCandidates = new Set();
    } finally {
      loading = false;
    }
  }

  function goToPreviousPage() {
    if (loading || offset === 0) return;
    offset = Math.max(0, offset - pageSize);
    void loadMatches();
  }

  function goToNextPage() {
    if (loading) return;
    offset += pageSize;
    void loadMatches();
  }

  function onPageSizeChange(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = Number.parseInt(target.value, 10);
    if (!Number.isFinite(value) || value <= 0 || value === pageSize) return;
    pageSize = value;
    offset = 0;
    void loadMatches();
  }

  function openPayments() {
    goto(`/allegro/${secretId}/payments`);
  }

  onMount(() => {
    void loadMatches();
  });

  onDestroy(() => {
    applyPollingCanceled = true;
  });
</script>

<svelte:head>
  <title>Allegro Matches — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-warning/15 text-warning rounded-3xl p-4">
          <Icon src={icons.Sparkles} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Matching workflow
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Allegro matches</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Review matching candidates for the selected Allegro secret{login
                ? ` (${login})`
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
            Apply selected candidates, inspect payments for the same account or review matching
            stats.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button class="btn btn-outline" on:click={() => (isStatsModalOpen = true)}>
            <Icon src={icons.ChartBar} class="h-5 w-5" />
            Stats
          </button>
          <button class="btn btn-primary" on:click={openPayments}>
            <Icon src={icons.CreditCard} class="h-5 w-5" />
            Payments
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 class="text-xl font-semibold">Matching candidates</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Select candidates per transaction and apply confirmed matches in batch.
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
            <button class="btn btn-outline btn-sm" on:click={goToNextPage} disabled={loading}>
              Next
            </button>
          </div>

          <button class="btn btn-ghost btn-sm" disabled={loading} on:click={loadMatches}>
            {#if loading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon src={icons.ArrowPath} class="h-4 w-4" />
            {/if}
            Refresh
          </button>

          <button
            class="btn btn-primary btn-sm"
            on:click={applySelected}
            disabled={applying || loading || selectedCandidates.size === 0}
          >
            <Icon src={icons.CheckCircle} class={`h-4 w-4 ${applying ? 'animate-spin' : ''}`} />
            Apply selected ({selectedCandidates.size})
          </button>
        </div>
      </div>

      <div class="divider my-0"></div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-base-content/70 text-xs">
          Showing {visibleRows.length === 0 ? 0 : offset + 1} - {offset + visibleRows.length}
        </div>

        <label class="label flex cursor-pointer items-center justify-start gap-3 p-0">
          <span class="label-text text-sm">Show only actionable items</span>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            bind:checked={actionableOnly}
          />
        </label>
      </div>

      {#if networkError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{networkError}</span>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-3 pt-2">
          <div class="skeleton h-20 w-full rounded-3xl"></div>
          <div class="skeleton h-20 w-full rounded-3xl"></div>
          <div class="skeleton h-20 w-full rounded-3xl"></div>
        </div>
      {:else if !matchResponse}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-primary/12 text-primary rounded-3xl p-4">
            <Icon src={icons.InformationCircle} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No matches data available</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            The selected account did not return a match response for this query.
          </p>
        </div>
      {:else if rows.length === 0}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-warning/15 text-warning rounded-3xl p-4">
            <Icon src={icons.Sparkles} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No match candidates to display</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            There are no candidate links for the current page of transactions.
          </p>
        </div>
      {:else if visibleRows.length === 0}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-primary/12 text-primary rounded-3xl p-4">
            <Icon src={icons.Funnel} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No actionable rows after filtering</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            All rows on this page are already processed or do not have any candidates.
          </p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each visibleRows as row}
            <article
              class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
            >
              <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h4 class="text-base font-semibold">{row.tx.description}</h4>
                      <span
                        class={`badge badge-soft ${isRowProcessed(row) ? 'badge-secondary' : 'badge-info'}`}
                      >
                        {isRowProcessed(row) ? 'processed' : 'new'}
                      </span>
                    </div>
                    <div class="text-base-content/60 mt-2 text-sm">
                      #{row.tx.id} | {formatDate(row.tx.date)} | {formatMoney(
                        row.tx.amount,
                        row.tx.currency_symbol
                      )}
                    </div>
                  </div>
                </div>

                {#if row.matches.length === 0}
                  <div class="bg-base-200/60 mt-4 rounded-2xl px-4 py-3 text-sm">No candidates</div>
                {:else}
                  <div class="mt-4 grid gap-3">
                    {#each row.matches as candidate}
                      {@const key = candidateKey(row.tx.id, candidate.external_id)}
                      <div
                        class={`rounded-[1.25rem] p-4 ${
                          appliedCandidates.has(key)
                            ? 'bg-success/12 ring-success/30 ring-1'
                            : 'bg-base-200/55'
                        }`}
                      >
                        <div
                          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <label class="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-primary checkbox-sm"
                              checked={selectedCandidates.has(key)}
                              disabled={!canSelectCandidate(row, candidate.external_id)}
                              on:change={() => toggleCandidate(row.tx.id, candidate.external_id)}
                            />
                            <div>
                              <div class="text-sm font-medium">Select candidate</div>
                              <div class="text-base-content/60 text-xs">
                                {canSelectCandidate(row, candidate.external_id)
                                  ? 'Available for apply'
                                  : 'Selection disabled'}
                              </div>
                            </div>
                          </label>

                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-medium">{formatDate(candidate.date)}</span>
                            <span class="text-sm">{formatMoney(candidate.amount)}</span>
                            <span
                              class={`badge badge-soft ${candidate.is_balanced ? 'badge-success' : 'badge-warning'}`}
                            >
                              {candidate.is_balanced ? 'balanced' : 'unbalanced'}
                            </span>
                            <div class="tooltip" data-tip={candidate.external_id}>
                              <span
                                class="from-warning/20 to-primary/10 inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 font-mono text-xs font-semibold"
                              >
                                {candidate.external_short_id}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div class="mt-3">
                          {#if candidate.details.length}
                            <div class="space-y-1">
                              {#each candidate.details as detail}
                                <div class="text-base-content/80 text-xs leading-tight">
                                  {detail}
                                </div>
                              {/each}
                            </div>
                          {:else}
                            <div class="text-base-content/60 text-xs">No details</div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
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
              class="select select-bordered select-xs min-w-18"
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
            <button class="btn btn-outline btn-sm" on:click={goToNextPage} disabled={loading}>
              Next
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>

  {#if matchResponse}
    <section class="card bg-base-100 shadow-xl">
      <div class="card-body gap-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 class="text-xl font-semibold">Unmatched payments</h4>
            <p class="text-base-content/70 mt-1 text-sm">
              Payments fetched from Allegro that do not have any transaction candidate.
            </p>
          </div>
          <span class="badge badge-outline badge-sm">{matchResponse.unmatched_payments.length}</span
          >
        </div>

        <div class="divider my-0"></div>

        {#if matchResponse.unmatched_payments.length === 0}
          <div class="bg-base-200/60 rounded-[2rem] px-6 py-10 text-center">
            <div class="text-sm">No unmatched payments.</div>
          </div>
        {:else}
          <div class="hidden overflow-x-auto xl:block">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {#each matchResponse.unmatched_payments as payment}
                  <tr class="hover">
                    <td>{formatDate(payment.date)}</td>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>
                      <span
                        class={`badge badge-soft ${payment.is_balanced ? 'badge-success' : 'badge-warning'}`}
                      >
                        {payment.is_balanced ? 'balanced' : 'unbalanced'}
                      </span>
                    </td>
                    <td>
                      <div class="tooltip" data-tip={payment.external_id}>
                        <span
                          class="from-warning/20 to-primary/10 inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 font-mono text-xs font-semibold"
                        >
                          {payment.external_short_id}
                        </span>
                      </div>
                    </td>
                    <td class="min-w-80">
                      {#if payment.details.length}
                        <div class="space-y-1">
                          {#each payment.details as detail}
                            <div class="text-base-content/80 text-xs leading-tight">{detail}</div>
                          {/each}
                        </div>
                      {:else}
                        <span class="text-base-content/60 text-xs">No details</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div class="grid gap-4 xl:hidden">
            {#each matchResponse.unmatched_payments as payment}
              <article
                class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
              >
                <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                        Date
                      </div>
                      <div class="mt-2 text-sm font-semibold">{formatDate(payment.date)}</div>
                    </div>
                    <span
                      class={`badge badge-soft ${payment.is_balanced ? 'badge-success' : 'badge-warning'}`}
                    >
                      {payment.is_balanced ? 'balanced' : 'unbalanced'}
                    </span>
                  </div>

                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                      <div class="text-base-content/60 text-xs uppercase">Amount</div>
                      <div class="mt-1 text-sm font-medium">{formatMoney(payment.amount)}</div>
                    </div>
                    <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                      <div class="text-base-content/60 text-xs uppercase">Payment ID</div>
                      <div class="mt-1 font-mono text-sm font-medium">
                        {payment.external_short_id}
                      </div>
                    </div>
                  </div>

                  <div class="bg-base-200/60 mt-4 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Details</div>
                    {#if payment.details.length}
                      <div class="mt-2 space-y-1">
                        {#each payment.details as detail}
                          <div class="text-base-content/80 text-xs leading-tight">{detail}</div>
                        {/each}
                      </div>
                    {:else}
                      <div class="mt-2 text-sm">No details</div>
                    {/if}
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

{#if matchResponse}
  <dialog class:modal-open={isStatsModalOpen} class="modal">
    <div class="modal-box max-w-4xl">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">Matching stats</h3>
          <p class="text-base-content/70 text-sm">
            Summary for selected Allegro secret{login ? ` (${login})` : ''}.
          </p>
        </div>
        <button
          class="btn btn-ghost btn-circle btn-sm"
          on:click={() => (isStatsModalOpen = false)}
          aria-label="Close stats modal"
        >
          <Icon src={icons.XMark} class="h-5 w-5" />
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Payments fetched</div>
            <div class="stat-value text-primary text-2xl">{matchResponse.payments_fetched}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Transactions found</div>
            <div class="stat-value text-2xl">{matchResponse.transactions_found}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">One match</div>
            <div class="stat-value text-success text-2xl">
              {matchResponse.transactions_with_one_match}
            </div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Many matches</div>
            <div class="stat-value text-warning text-2xl">
              {matchResponse.transactions_with_many_matches}
            </div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Unmatched payments</div>
            <div class="stat-value text-secondary text-2xl">
              {matchResponse.unmatched_payments.length}
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-sm" on:click={() => (isStatsModalOpen = false)}>Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button on:click={() => (isStatsModalOpen = false)}>close</button>
    </form>
  </dialog>
{/if}

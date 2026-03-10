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
  type ApplyDecision = components['schemas']['ApplyDecision'];
  type ApplyJobResponse = components['schemas']['ApplyJobResponse'];
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

  $: secretId = $page.params.id;
  $: login = matchResponse?.login ?? null;
  $: currentPage = Math.floor(offset / pageSize) + 1;

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
      (type === 'error' ? 'Failed to load Allegro matches' : type === 'success' ? 'Success' : 'Info');

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

  function canSelectCandidate(row: AllegroMatchResult, paymentExternalId: string) {
    return !isRowProcessed(row) && !appliedCandidates.has(candidateKey(row.tx.id, paymentExternalId));
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

    // Polling returns cumulative results; emit only per-slice summaries to avoid toast storms.
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
        // Process only fresh results since previous poll.
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
        // First delta comes from applyMatches response.
        const initialSlice = startJob.results.slice(processed);
        processed = initialTotal;
        processJobUpdatesSlice(initialSlice, selectedByTx);
      }

      let finalJob = startJob;
      if (isBusy(startJob.status)) {
        const polled = await pollApplyJob(
          startJob.id,
          startJob.status,
          selectedByTx,
          { value: processed }
        );
        if (polled) finalJob = polled;
      }

      if (finalJob.status === 'failed') {
        throw new Error('Apply job failed.');
      }

      const marked = appliedCandidates.size;
      selectedCandidates = new Set();

      if (finalJob.failed > 0 && finalJob.applied === 0) {
        const firstReason = finalJob.results.find((r) => r.status === 'failed')?.reason ?? null;
        emitToast(
          'error',
          firstReason ? `Apply failed: ${firstReason}` : `Apply failed for ${finalJob.failed} item(s).`
        );
      } else if (finalJob.failed > 0) {
        emitToast('info', `Partially applied. Applied: ${finalJob.applied}, failed: ${finalJob.failed}.`);
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

  onMount(() => {
    void loadMatches();
  });

  onDestroy(() => {
    applyPollingCanceled = true;
  });
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="card-title">Allegro Matches</h3>
        <p class="text-base-content/70 text-sm">
          Matching candidates for selected Allegro secret{login ? ` (${login})` : ''}.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="btn btn-outline btn-sm" on:click={() => (isStatsModalOpen = true)}>
          <Icon src={icons.ChartBar} class="h-4 w-4" />
          Stats
        </button>
        <button
          class="btn btn-primary btn-sm"
          on:click={applySelected}
          disabled={applying || loading || selectedCandidates.size === 0}
        >
          <Icon src={icons.CheckCircle} class={`h-4 w-4 ${applying ? 'animate-spin' : ''}`} />
          Apply selected ({selectedCandidates.size})
        </button>
        <a href={`/allegro/${secretId}/payments`} class="btn btn-primary btn-sm">
          <Icon src={icons.CreditCard} class="h-4 w-4" />
          Payments
        </a>
        <a href="/allegro/accounts" class="btn btn-primary btn-sm">
          <Icon src={icons.ArrowLeft} class="h-4 w-4" />
          Back to Accounts
        </a>
      </div>
    </div>
    <div class="divider mt-0 mb-2"></div>
    <div class="mb-2 flex items-center justify-end">
      <div class="join">
        <button class="btn btn-outline btn-xs join-item" on:click={goToPreviousPage} disabled={loading || offset === 0}>
          Prev
        </button>
        <button class="btn btn-ghost btn-xs join-item pointer-events-none">
          Page {currentPage}
        </button>
        <button class="btn btn-outline btn-xs join-item" on:click={goToNextPage} disabled={loading}>
          Next
        </button>
      </div>
    </div>
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
    {:else if !matchResponse}
      <div class="alert mt-2">
        <Icon src={icons.InformationCircle} class="h-5 w-5" />
        <span>No matches data available.</span>
      </div>
    {:else}
      {#if rows.length === 0}
        <div class="alert mt-3">
          <Icon src={icons.InformationCircle} class="h-5 w-5" />
          <span>No match candidates to display.</span>
        </div>
      {:else}
        <div class="overflow-x-auto pt-3">
          <table class="table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Status</th>
                <th>Candidates</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row}
                <tr>
                  <td class="align-top">
                    <div class="space-y-1">
                      <div class="font-medium">{row.tx.description}</div>
                      <div class="text-base-content/70 text-xs">
                        #{row.tx.id} | {formatDate(row.tx.date)} | {formatMoney(row.tx.amount, row.tx.currency_symbol)}
                      </div>
                    </div>
                  </td>
                  <td class="align-top">
                    <div class="flex flex-wrap gap-2">
                      <span class={`badge badge-sm ${isRowProcessed(row) ? 'badge-neutral' : 'badge-info'}`}>
                        {isRowProcessed(row) ? 'processed' : 'new'}
                      </span>
                    </div>
                  </td>
                  <td class="align-top">
                    {#if row.matches.length === 0}
                      <span class="text-base-content/60 text-sm">No candidates</span>
                    {:else}
                      <div class="space-y-2">
                        {#each row.matches as candidate}
                          {@const key = candidateKey(row.tx.id, candidate.external_id)}
                          <div
                            class={`rounded-box p-2 text-sm ${appliedCandidates.has(key) ? 'bg-success/15 ring-success ring-1' : 'bg-base-100'}`}
                          >
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <label class="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  class="checkbox checkbox-primary checkbox-sm"
                                  checked={selectedCandidates.has(key)}
                                  disabled={!canSelectCandidate(row, candidate.external_id)}
                                  on:change={() => toggleCandidate(row.tx.id, candidate.external_id)}
                                />
                                <span class="text-xs font-medium">Select</span>
                              </label>
                            </div>
                            <div class="mt-1 flex flex-wrap items-center gap-2">
                              <span class="font-medium">{formatDate(candidate.date)}</span>
                              <span>{formatMoney(candidate.amount)}</span>
                              <span class={`badge badge-xs ${candidate.is_balanced ? 'badge-success' : 'badge-warning'}`}>
                                {candidate.is_balanced ? 'balanced' : 'unbalanced'}
                              </span>
                              <div class="tooltip" data-tip={candidate.external_id}>
                                <span class="font-mono text-xs">{candidate.external_short_id}</span>
                              </div>
                            </div>
                            <div class="mt-2 space-y-1">
                              {#if candidate.details.length}
                                {#each candidate.details as detail}
                                  <div class="text-base-content/80 text-xs leading-tight">{detail}</div>
                                {/each}
                              {:else}
                                <div class="text-base-content/60 text-xs">No details</div>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}

    <div class="border-base-200 mt-4 flex flex-wrap items-end justify-between gap-3 border-t pt-4">
      <div class="text-base-content/70 text-xs">
        Showing {rows.length === 0 ? 0 : offset + 1} - {offset + rows.length}
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex items-center gap-2">
          <span class="text-base-content/70 text-[11px] font-medium uppercase tracking-wide">Rows</span>
          <select class="select select-bordered select-xs w-16" value={pageSize} on:change={onPageSizeChange}>
            {#each PAGE_SIZE_OPTIONS as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </label>
        <div class="join">
          <button class="btn btn-outline btn-xs join-item" on:click={goToPreviousPage} disabled={loading || offset === 0}>
            Prev
          </button>
          <button class="btn btn-ghost btn-xs join-item pointer-events-none">
            Page {currentPage}
          </button>
          <button class="btn btn-outline btn-xs join-item" on:click={goToNextPage} disabled={loading}>
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
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
        <button class="btn btn-ghost btn-circle btn-sm" on:click={() => (isStatsModalOpen = false)} aria-label="Close stats modal">
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
            <div class="stat-value text-success text-2xl">{matchResponse.transactions_with_one_match}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Many matches</div>
            <div class="stat-value text-warning text-2xl">{matchResponse.transactions_with_many_matches}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Unmatched payments</div>
            <div class="stat-value text-secondary text-2xl">{matchResponse.unmatched_payments.length}</div>
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

  <div class="card bg-base-100 mt-6 shadow-xl">
    <div class="card-body">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 class="card-title text-base">Unmatched payments</h4>
          <p class="text-base-content/70 text-sm">
            Payments fetched from Allegro that do not have any transaction candidate.
          </p>
        </div>
        <span class="badge badge-outline badge-sm">{matchResponse.unmatched_payments.length}</span>
      </div>

      {#if matchResponse.unmatched_payments.length === 0}
        <div class="alert mt-2">
          <Icon src={icons.InformationCircle} class="h-5 w-5" />
          <span>No unmatched payments.</span>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="table table-sm">
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
                <tr>
                  <td>{formatDate(payment.date)}</td>
                  <td>{formatMoney(payment.amount)}</td>
                  <td>
                    <span class={`badge badge-xs ${payment.is_balanced ? 'badge-success' : 'badge-warning'}`}>
                      {payment.is_balanced ? 'balanced' : 'unbalanced'}
                    </span>
                  </td>
                  <td>
                    <div class="tooltip" data-tip={payment.external_id}>
                      <span class="font-mono text-xs">{payment.external_short_id}</span>
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
      {/if}
    </div>
  </div>
{/if}

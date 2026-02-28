<script lang="ts">
  import { onMount } from 'svelte';
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

  const POLL_INTERVAL_MS = 2_000;
  const MAX_POLL_ATTEMPTS = 60;

  let loading = true;
  let applying = false;
  let networkError: string | null = null;
  let matchResponse: AllegroMatchResponse | null = null;
  let rows: AllegroMatchResult[] = [];
  let selectedCandidates: Set<string> = new Set();
  let appliedCandidates: Set<string> = new Set();

  $: secretId = $page.params.id;
  $: login = matchResponse?.login ?? null;

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
    return marked;
  }

  function resultKey(result: ApplyJobResponse['results'][number]) {
    return `${result.transaction_id}::${result.status}::${result.reason ?? ''}`;
  }

  function processJobUpdates(
    job: ApplyJobResponse | null,
    selectedByTx: Map<number, string[]>,
    seenResults: Set<string>
  ) {
    if (!job) return { newSuccess: 0, newFailed: 0 };

    let newSuccess = 0;
    let newFailed = 0;
    const newSuccessTxIds = new Set<number>();

    for (const result of job.results) {
      const key = resultKey(result);
      if (seenResults.has(key)) continue;
      seenResults.add(key);

      if (result.status === 'success') {
        newSuccess += 1;
        newSuccessTxIds.add(result.transaction_id);
        emitToast('success', `Applied transaction #${result.transaction_id}.`);
      } else {
        newFailed += 1;
        emitToast(
          'error',
          result.reason
            ? `Failed transaction #${result.transaction_id}: ${result.reason}`
            : `Failed transaction #${result.transaction_id}.`
        );
      }
    }

    if (newSuccessTxIds.size > 0) {
      markAppliedForTxIds(newSuccessTxIds, selectedByTx);
    }

    return { newSuccess, newFailed };
  }

  async function pollApplyJob(
    jobId: string,
    token: string,
    initialStatus: JobStatus,
    selectedByTx: Map<number, string[]>,
    seenResults: Set<string>
  ) {
    let status = initialStatus;
    let job: ApplyJobResponse | null = null;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && isBusy(status); attempt += 1) {
      await wait(POLL_INTERVAL_MS);
      job = await allegro.getApplyJob(jobId, token);
      if (!job) break;
      processJobUpdates(job, selectedByTx, seenResults);
      status = job.status;
    }

    return job;
  }

  async function applySelected() {
    const token = localStorage.getItem('access_token');
    const routeSecretId = getNonEmptyString(secretId);

    if (!token) {
      goto('/login');
      return;
    }

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
    const seenResults = new Set<string>();

    applying = true;
    try {
      const startJob = await allegro.applyMatches(routeSecretId, decisions, token);
      if (!startJob) throw new Error('Apply job was not created.');

      processJobUpdates(startJob, selectedByTx, seenResults);

      let finalJob = startJob;
      if (isBusy(startJob.status)) {
        const polled = await pollApplyJob(
          startJob.id,
          token,
          startJob.status,
          selectedByTx,
          seenResults
        );
        if (polled) finalJob = polled;
      }

      if (finalJob.status === 'failed') {
        throw new Error('Apply job failed.');
      }

      processJobUpdates(finalJob, selectedByTx, seenResults);
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
    const token = localStorage.getItem('access_token');
    const routeSecretId = getNonEmptyString(secretId);

    if (!routeSecretId) {
      networkError = 'Missing secret id in route.';
      loading = false;
      return;
    }

    if (!token) {
      goto('/login');
      return;
    }

    loading = true;
    networkError = null;

    try {
      const result = await allegro.getMatches(routeSecretId, token);
      matchResponse = result;
      rows = result?.content ?? [];
    } catch (error: unknown) {
      networkError = extractErrorMessage(error, 'Failed to load Allegro matches');
      emitToast('error', networkError);
      matchResponse = null;
      rows = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadMatches();
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
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      </div>

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
                <th>Candidates</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row}
                <tr>
                  <td class="min-w-80 align-top">
                    <div class="space-y-1">
                      <div class="font-medium">{row.tx.description}</div>
                      <div class="text-base-content/70 text-xs">
                        #{row.tx.id} | {formatDate(row.tx.date)} | {formatMoney(row.tx.amount, row.tx.currency_symbol)}
                      </div>
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
                            class={`rounded-box p-2 text-sm ${appliedCandidates.has(key) ? 'bg-success/15 ring-success ring-1' : 'bg-base-200'}`}
                          >
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <label class="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  class="checkbox checkbox-primary checkbox-sm"
                                  checked={selectedCandidates.has(key)}
                                  disabled={appliedCandidates.has(key)}
                                  on:change={() => toggleCandidate(row.tx.id, candidate.external_id)}
                                />
                                <span class="text-xs font-medium">Select</span>
                              </label>
                              {#if appliedCandidates.has(key)}
                                <span class="badge badge-success badge-xs">applied</span>
                              {/if}
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
  </div>
</div>

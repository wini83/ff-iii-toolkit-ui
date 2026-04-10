<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import { blik } from '$lib/api/blik';
  import type { components } from '$lib/api/schema';

  type MatchData = components['schemas']['FileMatchResponse'];
  type MatchRow = components['schemas']['api__models__blik_files__MatchResult'];
  type SimplifiedRecord = components['schemas']['SimplifiedRecord'];
  type ApplyDecision = components['schemas']['api__models__blik_files__ApplyDecision'];
  type ApplyJobResponse = components['schemas']['api__models__blik_files__ApplyJobResponse'];
  type ApplyOutcomeResponse =
    components['schemas']['api__models__blik_files__ApplyOutcomeResponse'];
  type JobStatus = components['schemas']['JobStatus'];

  const POLL_INTERVAL_MS = 1_000;
  const MAX_POLL_ATTEMPTS = 60;

  let matchData: MatchData | null = null;
  let rows: MatchRow[] = [];
  let loading = true;
  let applying = false;
  let error = '';
  let selectedMatches = new Map<number, string>();
  let appliedMatches = new Set<string>();
  let applyPollingCanceled = false;
  let actionableOnly = false;
  let isStatsModalOpen = false;
  let isApplyProgressModalOpen = false;
  let applyRunTotal = 0;
  let applyRunProcessed = 0;
  let applyRunApplied = 0;
  let applyRunFailed = 0;
  let applyProgressLabel = 'Ready to apply selected matches.';
  let applyProgressError: string | null = null;
  let applyUpdates: Array<{
    transactionId: number;
    status: ApplyOutcomeResponse['status'];
    reason: string | null;
  }> = [];

  $: fileId = $page.params.id ?? '';
  $: oneMatches =
    matchData?.transactions_with_one_match ?? rows.filter((row) => row.matches.length === 1).length;
  $: manyMatches =
    matchData?.transactions_with_many_matches ??
    rows.filter((row) => row.matches.length > 1).length;
  $: noMatches =
    matchData?.transactions_not_matched ?? rows.filter((row) => row.matches.length === 0).length;
  $: visibleRows = actionableOnly ? rows.filter(isActionableRow) : rows;
  $: processedCount = rows.filter((row) => row.status === 'already_processed').length;
  $: applyProgressPercent =
    applyRunTotal > 0 ? Math.min(100, Math.round((applyRunProcessed / applyRunTotal) * 100)) : 0;

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
      (type === 'error' ? 'Failed to load matches' : type === 'success' ? 'Success' : 'Info');

    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: { type, msg: safeMsg }
      })
    );
  }

  function formatMoney(amount: number | undefined, currency = 'PLN') {
    if (typeof amount !== 'number' || Number.isNaN(amount)) return `- ${currency}`;
    return `${amount.toFixed(2)} ${currency}`;
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

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isBusy(status: JobStatus) {
    return status === 'pending' || status === 'running';
  }

  function matchKey(transactionId: number, matchId: string) {
    return `${transactionId}::${matchId}`;
  }

  function resetApplyProgress(total: number) {
    applyRunTotal = total;
    applyRunProcessed = 0;
    applyRunApplied = 0;
    applyRunFailed = 0;
    applyProgressError = null;
    applyUpdates = [];
    applyProgressLabel = total > 0 ? 'Starting apply job...' : 'Ready to apply selected matches.';
    isApplyProgressModalOpen = total > 0;
  }

  function isRowProcessed(row: MatchRow) {
    return row.status === 'already_processed';
  }

  function isActionableRow(row: MatchRow) {
    return !isRowProcessed(row) && row.matches.length > 0;
  }

  function canSelectCandidate(row: MatchRow, candidate: SimplifiedRecord) {
    const matchId = getNonEmptyString(candidate.match_id);
    if (!matchId) return false;
    return !isRowProcessed(row) && !appliedMatches.has(matchKey(row.tx.id, matchId));
  }

  function toggleCandidate(txId: number, candidate: SimplifiedRecord) {
    const matchId = getNonEmptyString(candidate.match_id);
    if (!matchId) return;

    const current = selectedMatches.get(txId);
    if (current === matchId) selectedMatches.delete(txId);
    else selectedMatches.set(txId, matchId);
    selectedMatches = new Map(selectedMatches);
  }

  function getSelectedDecisions(): ApplyDecision[] {
    return Array.from(selectedMatches.entries()).map(([transaction_id, selected_match_id]) => ({
      transaction_id,
      selected_match_id
    }));
  }

  function mapSelectedByTx() {
    return new Map(selectedMatches);
  }

  async function markAppliedForResults(
    results: ApplyJobResponse['results'],
    selectedByTx: Map<number, string>
  ) {
    let newSuccess = 0;
    let newFailed = 0;
    const successTxIds = new Set<number>();

    for (const result of results) {
      if (result.status === 'success') {
        newSuccess += 1;
        successTxIds.add(result.transaction_id);
        const selectedMatchId =
          getNonEmptyString(result.selected_match_id) ??
          selectedByTx.get(result.transaction_id) ??
          null;

        if (selectedMatchId) {
          appliedMatches.add(matchKey(result.transaction_id, selectedMatchId));
        }

        selectedMatches.delete(result.transaction_id);
      } else {
        newFailed += 1;
      }

      applyUpdates = [
        {
          transactionId: result.transaction_id,
          status: result.status,
          reason: getNonEmptyString(result.reason) ?? null
        },
        ...applyUpdates
      ].slice(0, 20);
    }

    if (successTxIds.size > 0) {
      rows = rows.map((row) =>
        successTxIds.has(row.tx.id) ? { ...row, status: 'already_processed' } : row
      );
    }

    appliedMatches = new Set(appliedMatches);
    selectedMatches = new Map(selectedMatches);
    applyRunApplied += newSuccess;
    applyRunFailed += newFailed;
    applyRunProcessed += newSuccess + newFailed;
    applyProgressLabel =
      applyRunProcessed < applyRunTotal
        ? `Processing ${applyRunProcessed} of ${applyRunTotal} selected transactions...`
        : 'Finishing apply job...';
    await tick();
  }

  async function pollApplyJob(
    jobId: string,
    initialStatus: JobStatus,
    selectedByTx: Map<number, string>,
    processedRef: { value: number }
  ) {
    let status = initialStatus;
    let job: ApplyJobResponse | null = null;
    let timedOut = false;

    for (
      let attempt = 0;
      attempt < MAX_POLL_ATTEMPTS && isBusy(status) && !applyPollingCanceled;
      attempt += 1
    ) {
      await tick();
      await wait(POLL_INTERVAL_MS);
      if (applyPollingCanceled) break;
      job = await blik.getApplyJob(jobId);
      if (!job) break;
      const total = job.results?.length ?? 0;
      if (total > processedRef.value) {
        const slice = job.results.slice(processedRef.value);
        processedRef.value = total;
        await markAppliedForResults(slice, selectedByTx);
      }
      status = job.status;
    }

    if (isBusy(status) && !applyPollingCanceled) {
      timedOut = true;
    }

    return { job, timedOut, canceled: applyPollingCanceled };
  }

  async function loadData() {
    if (applying) {
      emitToast('info', 'Refresh is disabled while apply is running.');
      return;
    }

    if (!fileId) {
      error = 'Missing file id in route.';
      loading = false;
      return;
    }

    loading = true;
    error = '';

    try {
      const data = await blik.getMatches(fileId);
      if (!data) throw new Error('Failed to load matching data');

      matchData = data;
      rows = data.content ?? [];
      selectedMatches = new Map();
      appliedMatches = new Set();
    } catch (err: unknown) {
      console.error(err);
      error = extractErrorMessage(err, 'Failed to load matching data');
      matchData = null;
      rows = [];
      selectedMatches = new Map();
      appliedMatches = new Set();
    } finally {
      loading = false;
    }
  }

  async function applySelected() {
    if (applying) return;

    if (!fileId) {
      emitToast('error', 'Missing file id in route.');
      return;
    }

    const decisions = getSelectedDecisions();
    if (!decisions.length) {
      emitToast('info', 'No matches selected.');
      return;
    }

    const selectedByTx = mapSelectedByTx();
    let processed = 0;
    applyPollingCanceled = false;
    resetApplyProgress(decisions.length);
    await tick();

    applying = true;
    try {
      const startJob = await blik.applyMatches(fileId, decisions);
      if (!startJob) throw new Error('Apply job was not created.');
      applyRunTotal = startJob.total || decisions.length;
      applyProgressLabel = isBusy(startJob.status)
        ? `Processing 0 of ${applyRunTotal} selected transactions...`
        : 'Apply job returned initial results.';

      const initialTotal = startJob.results?.length ?? 0;
      if (initialTotal > processed) {
        const initialSlice = startJob.results.slice(processed);
        processed = initialTotal;
        await markAppliedForResults(initialSlice, selectedByTx);
      }

      let finalJob = startJob;
      if (isBusy(startJob.status)) {
        const pollResult = await pollApplyJob(startJob.id, startJob.status, selectedByTx, {
          value: processed
        });

        if (pollResult.job) finalJob = pollResult.job;

        if (pollResult.canceled) {
          applyProgressError = 'Apply polling was canceled before the job finished.';
          applyProgressLabel = 'Apply job is still running in the background.';
          return;
        }

        if (pollResult.timedOut) {
          applyProgressError = 'Apply is still running. Refresh later to verify the final result.';
          applyProgressLabel = 'Apply polling timed out before the job finished.';
          return;
        }
      }

      if (finalJob.status === 'failed') {
        throw new Error('Apply job failed.');
      }

      applyRunTotal = finalJob.total || applyRunTotal;
      applyRunApplied = finalJob.applied;
      applyRunFailed = finalJob.failed;
      applyRunProcessed = finalJob.applied + finalJob.failed;

      if (finalJob.failed > 0 && finalJob.applied === 0) {
        const firstReason =
          finalJob.results.find((result) => result.status === 'failed')?.reason ?? null;
        applyProgressError = firstReason ?? `Apply failed for ${finalJob.failed} item(s).`;
        applyProgressLabel = 'Apply finished with failures.';
      } else if (finalJob.failed > 0) {
        applyProgressLabel = `Partially applied. Applied: ${finalJob.applied}, failed: ${finalJob.failed}.`;
      } else if (finalJob.applied > 0) {
        applyProgressLabel = `Apply finished. Applied: ${finalJob.applied}.`;
      } else {
        applyProgressLabel = 'Apply finished with no changes.';
      }
    } catch (err: unknown) {
      console.error(err);
      applyProgressError = extractErrorMessage(err, 'Failed to apply selected matches');
      applyProgressLabel = 'Apply job failed.';
    } finally {
      applying = false;
    }
  }

  function openPreview() {
    goto(`/blik/file/${fileId}`);
  }

  function openUpload() {
    goto('/blik/upload');
  }

  onMount(() => {
    void loadData();
  });

  onDestroy(() => {
    applyPollingCanceled = true;
  });
</script>

<svelte:head>
  <title>Blik Matches — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto mt-2 flex w-full max-w-7xl flex-col gap-6">
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
            <h2 class="text-3xl font-semibold tracking-tight">Blik matches</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Review matching candidates for file
              <span class="font-medium">{matchData?.decoded_name ?? 'BLIK'}</span>
              and apply confirmed pairs.
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
            Open file preview, inspect matching stats or jump to the next upload.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            class="btn btn-outline"
            on:click={() => (isStatsModalOpen = true)}
            disabled={!matchData}
          >
            <Icon src={icons.ChartBar} class="h-5 w-5" />
            Stats
          </button>
          <button class="btn btn-outline" on:click={openUpload}>
            <Icon src={icons.ArrowUpTray} class="h-5 w-5" />
            Upload
          </button>
          <button class="btn btn-primary" on:click={openPreview}>
            <Icon src={icons.DocumentMagnifyingGlass} class="h-5 w-5" />
            Preview
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
            Select one candidate per transaction and apply confirmed matches in batch.
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button class="btn btn-ghost btn-sm" disabled={loading || applying} on:click={loadData}>
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
            disabled={applying || loading || selectedMatches.size === 0}
          >
            <Icon src={icons.CheckCircle} class={`h-4 w-4 ${applying ? 'animate-spin' : ''}`} />
            Apply selected ({selectedMatches.size})
          </button>
        </div>
      </div>

      <div class="divider my-0"></div>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-base-content/70 text-xs">
          Showing {visibleRows.length} of {rows.length} transactions
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

      {#if error}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{error}</span>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-3 pt-2">
          <div class="skeleton h-20 w-full rounded-3xl"></div>
          <div class="skeleton h-20 w-full rounded-3xl"></div>
          <div class="skeleton h-20 w-full rounded-3xl"></div>
        </div>
      {:else if !matchData}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-primary/12 text-primary rounded-3xl p-4">
            <Icon src={icons.InformationCircle} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No matches data available</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            The selected file did not return a match response for this query.
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
            There are no candidate links for transactions in this file.
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
            All rows are already processed or do not have any available candidates.
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
                        class={`badge badge-soft ${isRowProcessed(row) ? 'badge-neutral' : row.matches.length > 0 ? 'badge-info' : 'badge-ghost'}`}
                      >
                        {#if isRowProcessed(row)}
                          processed
                        {:else if row.matches.length > 0}
                          actionable
                        {:else}
                          no match
                        {/if}
                      </span>
                    </div>
                    <div class="text-base-content/60 mt-2 text-sm">
                      #{row.tx.id} | {formatDate(row.tx.date)} | {formatMoney(
                        row.tx.amount,
                        row.tx.currency_symbol
                      )}
                    </div>
                    {#if row.tx.tags?.length}
                      <div class="mt-3 flex flex-wrap gap-2">
                        {#each row.tx.tags as tag}
                          <span class="badge badge-outline badge-sm">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                    {#if row.tx.notes}
                      <div class="text-base-content/70 mt-3 text-sm">{row.tx.notes}</div>
                    {/if}
                  </div>
                </div>

                {#if row.matches.length === 0}
                  <div class="bg-base-200/60 mt-4 rounded-2xl px-4 py-3 text-sm">No candidates</div>
                {:else}
                  <div class="mt-4 grid gap-3">
                    {#each row.matches as candidate}
                      {@const candidateMatchId = getNonEmptyString(candidate.match_id)}
                      {@const candidateApplied = candidateMatchId
                        ? appliedMatches.has(matchKey(row.tx.id, candidateMatchId))
                        : false}
                      <div
                        class={`rounded-[1.25rem] p-4 ${
                          candidateApplied
                            ? 'bg-success/12 ring-success/30 ring-1'
                            : 'bg-base-200/55'
                        }`}
                      >
                        <div
                          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          {#if !isRowProcessed(row)}
                            <label class="flex cursor-pointer items-center gap-3">
                              <input
                                type="checkbox"
                                class="checkbox checkbox-primary checkbox-sm"
                                checked={selectedMatches.get(row.tx.id) === candidateMatchId}
                                disabled={!canSelectCandidate(row, candidate)}
                                on:change={() => toggleCandidate(row.tx.id, candidate)}
                              />
                              <div>
                                <div class="text-sm font-medium">Select candidate</div>
                                <div class="text-base-content/60 text-xs">
                                  {#if candidateApplied}
                                    Match already applied
                                  {:else if canSelectCandidate(row, candidate)}
                                    Available for apply
                                  {:else}
                                    Selection disabled
                                  {/if}
                                </div>
                              </div>
                            </label>
                          {:else}
                            <div class="hidden sm:block"></div>
                          {/if}

                          <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span class="text-sm font-medium">{formatDate(candidate.date)}</span>
                            <span class="text-sm">
                              {formatMoney(
                                candidate.operation_amount,
                                candidate.operation_currency
                              )}
                            </span>
                            {#if !isRowProcessed(row)}
                              <span
                                class={`badge badge-soft ${candidateApplied ? 'badge-success' : 'badge-warning'}`}
                              >
                                {candidateApplied ? 'applied' : 'candidate'}
                              </span>
                            {/if}
                            {#if candidateMatchId}
                              <div class="tooltip" data-tip={candidateMatchId}>
                                <span
                                  class="from-warning/20 to-primary/10 inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 font-mono text-xs font-semibold"
                                >
                                  {candidateMatchId.slice(0, 8)}
                                </span>
                              </div>
                            {/if}
                          </div>
                        </div>

                        <div class="mt-3 grid gap-2 text-sm">
                          <div>
                            <span class="text-base-content/60">Details:</span>
                            {candidate.details}
                          </div>
                          <div>
                            <span class="text-base-content/60">Sender:</span>
                            {candidate.sender}
                          </div>
                          <div>
                            <span class="text-base-content/60">Recipient:</span>
                            {candidate.recipient}
                          </div>
                          <div class="text-base-content/70 text-xs">
                            {candidate.sender_account}
                            {candidate.recipient_account ? `| ${candidate.recipient_account}` : ''}
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </section>
</div>

{#if matchData}
  <dialog class:modal-open={isStatsModalOpen} class="modal">
    <div class="modal-box max-w-4xl">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">Matching stats</h3>
          <p class="text-base-content/70 text-sm">
            Summary for file
            <span class="font-medium">{matchData.decoded_name ?? 'BLIK'}</span>.
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

      <div class="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Records in file</div>
            <div class="stat-value text-primary text-2xl">{matchData.records_in_file}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Transactions found</div>
            <div class="stat-value text-2xl">{matchData.transactions_found}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">One match</div>
            <div class="stat-value text-success text-2xl">{oneMatches}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Many matches</div>
            <div class="stat-value text-warning text-2xl">{manyMatches}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">No match</div>
            <div class="stat-value text-2xl">{noMatches}</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-2">
            <div class="stat-title text-xs">Processed now</div>
            <div class="stat-value text-secondary text-2xl">{processedCount}</div>
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

<dialog class:modal-open={isApplyProgressModalOpen} class="modal">
  <div class="modal-box max-w-3xl">
    <div class="mb-6 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-lg font-semibold">Apply progress</h3>
        <p class="text-base-content/70 text-sm">{applyProgressLabel}</p>
      </div>
      <button
        class="btn btn-ghost btn-circle btn-sm"
        on:click={() => {
          if (!applying) isApplyProgressModalOpen = false;
        }}
        aria-label="Close apply progress modal"
        disabled={applying}
      >
        <Icon src={icons.XMark} class="h-5 w-5" />
      </button>
    </div>

    <div class="grid grid-cols-[180px_1fr] gap-6">
      <div class="flex flex-col items-center gap-4">
        <div
          class="radial-progress text-primary"
          style={`--value:${applyProgressPercent}; --size:9rem; --thickness:0.8rem;`}
          role="progressbar"
          aria-valuenow={applyProgressPercent}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="text-center leading-tight">
            <div class="text-3xl font-semibold">{applyProgressPercent}%</div>
            <div class="text-base-content/60 text-xs">{applyRunProcessed} / {applyRunTotal}</div>
          </div>
        </div>

        <div class="grid w-full grid-cols-2 gap-3">
          <div class="stats bg-base-200 rounded-box">
            <div class="stat px-3 py-2">
              <div class="stat-title text-xs">Applied</div>
              <div class="stat-value text-success text-2xl">{applyRunApplied}</div>
            </div>
          </div>
          <div class="stats bg-base-200 rounded-box">
            <div class="stat px-3 py-2">
              <div class="stat-title text-xs">Failed</div>
              <div class="stat-value text-error text-2xl">{applyRunFailed}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="min-h-72">
        {#if applyProgressError}
          <div class="alert alert-error mb-4">
            <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
            <span>{applyProgressError}</span>
          </div>
        {/if}

        <div class="border-base-200 bg-base-200/40 rounded-2xl border">
          <div class="border-base-200 flex items-center justify-between border-b px-4 py-3">
            <div class="text-sm font-medium">Processed items</div>
            <div class="text-base-content/60 text-xs">Latest 20 updates</div>
          </div>

          {#if applyUpdates.length === 0}
            <div class="text-base-content/60 px-4 py-10 text-sm">No processed items yet.</div>
          {:else}
            <div class="max-h-80 overflow-y-auto px-3 py-3">
              <div class="space-y-2">
                {#each applyUpdates as update, index (`${update.transactionId}-${index}`)}
                  <div
                    class="bg-base-100 flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                  >
                    <div class="min-w-0">
                      <div class="font-medium">Transaction #{update.transactionId}</div>
                      {#if update.reason}
                        <div class="text-base-content/60 truncate text-xs">{update.reason}</div>
                      {/if}
                    </div>
                    <span
                      class={`badge badge-soft ${update.status === 'success' ? 'badge-success' : 'badge-error'}`}
                    >
                      {update.status}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="modal-action">
      <button
        class="btn btn-sm"
        on:click={() => (isApplyProgressModalOpen = false)}
        disabled={applying}
      >
        {applying ? 'Processing...' : 'Close'}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button on:click={() => !applying && (isApplyProgressModalOpen = false)} disabled={applying}
      >close</button
    >
  </form>
</dialog>

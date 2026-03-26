<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import TableSkeleton from '$lib/components/TableSkeleton.svelte';
  import type { components } from '$lib/api/schema';

  type CitiImportParseResponse = components['schemas']['CitiImportParseResponse'];

  export let result: CitiImportParseResponse | null = null;
  export let loading = false;
  export let exporting = false;
  export let currentFileId = '';
  export let onOpenByFileId: () => void = () => {};
  export let onExport: () => void = () => {};
  export let fileIdInput = '';
  let isReportModalOpen = false;

  $: previewRows = result?.preview ?? [];
  $: warnings = result?.warnings ?? [];
  $: recordCount = result?.record_count ?? 0;
  $: emptyStateVisible = !loading && !result;

  function formatAmount(value: number | null | undefined, currency?: string) {
    if (value == null) return '-';

    const formatted = Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return currency ? `${formatted} ${currency}` : formatted;
  }
</script>

<article class="card bg-base-100 border-base-200 border shadow-xl">
  <div class="card-body gap-5">
    <div>
      <h3 class="card-title">Preview Workspace</h3>
      <p class="text-base-content/70 text-sm">
        Open a saved result by `file_id`, review parsed rows, and export the CSV package when needed.
      </p>
    </div>

    <div class="bg-base-200/45 rounded-[1.75rem] p-4 sm:p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="w-full max-w-2xl space-y-3">
          <div>
            <div class="text-base-content/60 text-xs font-medium tracking-[0.24em] uppercase">
              Lookup
            </div>
            <p class="text-base-content/70 mt-2 text-sm">
              Jump to any saved preview with its `file_id`.
            </p>
          </div>
          <div class="join w-full">
            <input
              class="input input-bordered join-item w-full"
              placeholder="Enter file_id"
              bind:value={fileIdInput}
            />
            <button
              class="btn btn-outline join-item"
              on:click={onOpenByFileId}
              disabled={!fileIdInput.trim() || loading}
            >
              {#if loading}
                <span class="loading loading-spinner loading-sm"></span>
                Loading...
              {:else}
                Open
              {/if}
            </button>
          </div>
        </div>

        <div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
          <button class="btn btn-primary" on:click={onExport} disabled={!currentFileId || exporting}>
            {#if exporting}
              <span class="loading loading-spinner loading-sm"></span>
              Exporting...
            {:else}
              <Icon src={icons.ArrowDownTray} class="h-5 w-5" />
              Export ZIP
            {/if}
          </button>
          <p class="text-base-content/60 text-xs leading-relaxed sm:text-right">
            Exports the backend-generated CSV ZIP for the active preview.
          </p>
        </div>
      </div>
    </div>

    <div class="divider my-0"></div>

    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h4 class="text-lg font-semibold">Parsed Records</h4>
        <p class="text-base-content/70 text-sm">
          Backend-saved rows with the key fields needed for a quick verification pass.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        {#if result}
          <button class="btn btn-sm btn-secondary" on:click={() => (isReportModalOpen = true)}>
            <Icon src={icons.ChartBarSquare} class="h-4 w-4" />
            View report
          </button>
        {/if}
      </div>
    </div>

    {#if loading}
      <TableSkeleton rows={6} cols={5} colWidths={['w-24', 'w-24', 'w-52', 'w-40', 'w-28']} />
    {:else if emptyStateVisible}
      <div class="hero bg-base-200/45 rounded-[1.75rem] py-10">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <div class="bg-secondary/12 text-secondary mx-auto mb-4 w-fit rounded-3xl p-4">
              <Icon src={icons.DocumentMagnifyingGlass} class="h-8 w-8" />
            </div>
            <h4 class="text-xl font-semibold">No Preview Loaded</h4>
            <p class="text-base-content/70 mt-2 text-sm">
              Start with a new import or open an existing result by `file_id`.
            </p>
          </div>
        </div>
      </div>
    {:else if result}
      {#if warnings.length > 0}
        <div role="alert" class="alert alert-warning">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <div>
            <div class="font-medium">Parser warnings detected</div>
            <div class="text-sm">
              Review the report before exporting. {warnings.length} warning{warnings.length === 1 ? '' : 's'} flagged.
            </div>
          </div>
        </div>
      {/if}

      {#if previewRows.length === 0}
        <div role="alert" class="alert alert-info">
          <Icon src={icons.InformationCircle} class="h-5 w-5" />
          <span>The file was parsed successfully, but the backend did not return any preview rows.</span>
        </div>
      {:else}
        <div class="w-full overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Counterparty</th>
                <th>Description</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {#each previewRows as row (`${row.date}-${row.amount}-${row.details}`)}
                <tr>
                  <td class="whitespace-nowrap">{row.date}</td>
                  <td class="whitespace-nowrap">
                    <div class={row.amount > 0 ? 'text-success font-medium' : 'font-medium'}>
                      {formatAmount(row.amount, row.account_currency)}
                    </div>
                    <div class="text-base-content/60 text-xs">
                      operation: {formatAmount(row.operation_amount, row.operation_currency)}
                    </div>
                  </td>
                  <td class="min-w-48">
                    <div class="font-medium">{row.recipient || row.sender || '-'}</div>
                    <div class="text-base-content/60 text-xs">
                      {row.recipient ? 'recipient' : row.sender ? 'sender' : 'party'}
                    </div>
                  </td>
                  <td class="min-w-72">
                    <div class="line-clamp-2">{row.details || '-'}</div>
                  </td>
                  <td class="min-w-52">
                    <div>{row.recipient_account || row.sender_account || '-'}</div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    {/if}
  </div>
</article>

{#if result}
  <dialog class:modal-open={isReportModalOpen} class="modal">
    <div class="modal-box max-w-4xl">
      <div class="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold">Preview Report</h3>
          <p class="text-base-content/70 text-sm">
            Summary for the currently loaded Citi preview.
          </p>
        </div>
        <button
          class="btn btn-ghost btn-circle btn-sm"
          on:click={() => (isReportModalOpen = false)}
          aria-label="Close report modal"
        >
          <Icon src={icons.XMark} class="h-5 w-5" />
        </button>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-3">
            <div class="stat-title text-xs">Records</div>
            <div class="stat-value text-primary text-2xl">{recordCount}</div>
            <div class="stat-desc">Rows returned by the Citi parser</div>
          </div>
        </div>
        <div class="stats bg-base-200 rounded-box">
          <div class="stat py-3">
            <div class="stat-title text-xs">Warnings</div>
            <div class="stat-value text-warning text-2xl">{warnings.length}</div>
            <div class="stat-desc">Items that need manual review</div>
          </div>
        </div>
      </div>

      <div class="bg-base-200/55 mt-5 rounded-2xl p-4">
        <div class="mb-2 flex items-center gap-2 font-medium">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          Parser Warnings
        </div>
        {#if warnings.length > 0}
          <ul class="space-y-2 text-sm">
            {#each warnings as warning}
              <li class="bg-base-100 rounded-xl px-3 py-2">{warning}</li>
            {/each}
          </ul>
        {:else}
          <p class="text-base-content/70 text-sm">No parser warnings for this preview.</p>
        {/if}
      </div>

      <div class="modal-action">
        <button class="btn btn-sm" on:click={() => (isReportModalOpen = false)}>Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button on:click={() => (isReportModalOpen = false)}>close</button>
    </form>
  </dialog>
{/if}

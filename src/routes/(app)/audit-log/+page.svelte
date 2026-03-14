<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { users } from '$lib/api/users';
  import type { components } from '$lib/api/schema';

  type AuditLogItem = components['schemas']['AuditLogItem'];

  const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

  let loading = true;
  let refreshing = false;
  let pageError: string | null = null;
  let items: AuditLogItem[] = [];
  let limit = 20;
  let offset = 0;

  let actorId = '';
  let targetId = '';
  let action = '';
  let metaContains = '';
  let createdFrom = '';
  let createdTo = '';

  $: currentPage = Math.floor(offset / limit) + 1;
  $: hasNextPage = items.length === limit;

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  function buildQuery() {
    return {
      actor_id: actorId.trim() || undefined,
      target_id: targetId.trim() || undefined,
      action: action.trim() || undefined,
      meta_contains: metaContains.trim() || undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
      limit,
      offset
    };
  }

  function formatDateTime(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(parsed);
  }

  function formatMeta(meta: AuditLogItem['meta']) {
    if (!meta) return 'No metadata';

    try {
      return JSON.stringify(meta, null, 2);
    } catch {
      return 'Failed to serialize metadata';
    }
  }

  async function loadAuditLog(showRefreshState = false) {
    if (showRefreshState) {
      refreshing = true;
    } else {
      loading = true;
    }

    pageError = null;

    try {
      const response = await users.listAuditLog(buildQuery());
      items = response.items;
    } catch (error: unknown) {
      pageError = getErrorMessage(error, 'Failed to load audit log');
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  function submitFilters() {
    offset = 0;
    void loadAuditLog(true);
  }

  function resetFilters() {
    actorId = '';
    targetId = '';
    action = '';
    metaContains = '';
    createdFrom = '';
    createdTo = '';
    offset = 0;
    limit = 20;
    void loadAuditLog(true);
  }

  function goToPreviousPage() {
    if (loading || offset === 0) return;
    offset = Math.max(0, offset - limit);
    void loadAuditLog(true);
  }

  function goToNextPage() {
    if (loading || !hasNextPage) return;
    offset += limit;
    void loadAuditLog(true);
  }

  function onPageSizeChange(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) return;

    const value = Number.parseInt(target.value, 10);
    if (!Number.isFinite(value) || value <= 0 || value === limit) return;

    limit = value;
    offset = 0;
    void loadAuditLog(true);
  }

  onMount(() => {
    void loadAuditLog();
  });
</script>

<svelte:head>
  <title>Audit Log — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-success/15 text-success rounded-3xl p-4">
          <Icon src={icons.ClipboardDocumentList} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Admin observability
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Audit log</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Inspect user actions, target entities and metadata for administrative events across
              the application.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Usage</div>
          <p class="mt-2 text-sm">
            Filter by actor, action, target or metadata to investigate changes and admin flows.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button class="btn btn-ghost" disabled={loading || refreshing} on:click={resetFilters}>
            Reset filters
          </button>
          <button class="btn btn-primary" disabled={loading || refreshing} on:click={submitFilters}>
            <Icon src={icons.Funnel} class="h-5 w-5" />
            Apply filters
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div>
        <h3 class="text-xl font-semibold">Filters</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Narrow the log to a specific actor, target, action or date window.
        </p>
      </div>

      <div class="divider my-0"></div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label class="form-control">
          <div class="label">
            <span class="label-text font-medium">Actor ID</span>
          </div>
          <input class="input input-bordered" bind:value={actorId} placeholder="UUID of actor" />
        </label>

        <label class="form-control">
          <div class="label">
            <span class="label-text font-medium">Target ID</span>
          </div>
          <input class="input input-bordered" bind:value={targetId} placeholder="UUID or target ref" />
        </label>

        <label class="form-control">
          <div class="label">
            <span class="label-text font-medium">Action</span>
          </div>
          <input class="input input-bordered" bind:value={action} placeholder="e.g. user_created" />
        </label>

        <label class="form-control xl:col-span-3">
          <div class="label">
            <span class="label-text font-medium">Meta contains</span>
          </div>
          <input
            class="input input-bordered"
            bind:value={metaContains}
            placeholder="Free-text search inside serialized metadata"
          />
        </label>

        <label class="form-control">
          <div class="label">
            <span class="label-text font-medium">Created from</span>
          </div>
          <input class="input input-bordered" type="datetime-local" bind:value={createdFrom} />
        </label>

        <label class="form-control">
          <div class="label">
            <span class="label-text font-medium">Created to</span>
          </div>
          <input class="input input-bordered" type="datetime-local" bind:value={createdTo} />
        </label>

        <div class="form-control">
          <div class="label">
            <span class="label-text font-medium">Rows per page</span>
          </div>
          <select class="select select-bordered" value={limit} on:change={onPageSizeChange}>
            {#each PAGE_SIZE_OPTIONS as option}
              <option value={option}>{option}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 class="text-xl font-semibold">Audit entries</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Paginated list of recorded actions with actor, target and metadata context.
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

          <button class="btn btn-ghost btn-sm" disabled={loading || refreshing} on:click={() => loadAuditLog(true)}>
            {#if refreshing}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon src={icons.ArrowPath} class="h-4 w-4" />
            {/if}
            Refresh
          </button>
        </div>
      </div>

      <div class="divider my-0"></div>

      <div class="text-base-content/70 text-xs">
        Showing {items.length === 0 ? 0 : offset + 1} - {offset + items.length}
      </div>

      {#if pageError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{pageError}</span>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-3">
          <div class="skeleton h-16 w-full rounded-3xl"></div>
          <div class="skeleton h-16 w-full rounded-3xl"></div>
          <div class="skeleton h-16 w-full rounded-3xl"></div>
        </div>
      {:else if !items.length}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-primary/12 text-primary rounded-3xl p-4">
            <Icon src={icons.ClipboardDocumentList} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No audit entries found</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            Adjust the filters or broaden the date range to inspect more activity.
          </p>
        </div>
      {:else}
        <div class="hidden overflow-x-auto xl:block">
          <table class="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Meta</th>
              </tr>
            </thead>
            <tbody>
              {#each items as item (item.id)}
                <tr class="hover">
                  <td class="whitespace-nowrap">{formatDateTime(item.created_at)}</td>
                  <td>
                    <span class="badge badge-soft badge-primary">{item.action}</span>
                  </td>
                  <td class="font-mono text-xs">{item.actor_id}</td>
                  <td class="font-mono text-xs">{item.target_id ?? '-'}</td>
                  <td class="max-w-xl">
                    <pre class="bg-base-200/60 max-h-40 overflow-auto rounded-2xl p-3 text-xs whitespace-pre-wrap">{formatMeta(item.meta)}</pre>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="grid gap-4 xl:hidden">
          {#each items as item (item.id)}
            <article
              class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
            >
              <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Created</div>
                    <div class="mt-2 text-sm font-semibold">{formatDateTime(item.created_at)}</div>
                  </div>
                  <span class="badge badge-soft badge-primary">{item.action}</span>
                </div>

                <div class="mt-4 grid gap-3">
                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Actor ID</div>
                    <div class="mt-1 font-mono text-xs">{item.actor_id}</div>
                  </div>

                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Target ID</div>
                    <div class="mt-1 font-mono text-xs">{item.target_id ?? '-'}</div>
                  </div>

                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Metadata</div>
                    <pre class="mt-2 overflow-auto text-xs whitespace-pre-wrap">{formatMeta(item.meta)}</pre>
                  </div>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </section>
</div>

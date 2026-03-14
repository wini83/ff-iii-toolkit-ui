<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { allegro } from '$lib/api/allegro';
  import type { components } from '$lib/api/schema';

  type UserSecret = components['schemas']['UserSecretResponse'];

  let loading = true;
  let networkError: string | null = null;
  let secrets: UserSecret[] = [];

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
        ? 'Failed to load Allegro secrets'
        : type === 'success'
          ? 'Success'
          : 'Info');

    window.dispatchEvent(
      new CustomEvent('toast', {
        detail: { type, msg: safeMsg }
      })
    );
  }

  function formatDate(timestamp: string | null) {
    if (!timestamp) return 'never';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;

    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  }

  async function loadSecrets() {
    loading = true;
    networkError = null;

    try {
      const result = await allegro.listSecrets();
      secrets = result.filter((secret) => secret.type === 'allegro');
    } catch (error: unknown) {
      networkError = extractErrorMessage(error, 'Failed to load Allegro secrets');
      emitToast('error', networkError);
    } finally {
      loading = false;
    }
  }

  function openPayments(secretId: string) {
    goto(`/allegro/${secretId}/payments`);
  }

  function openMatches(secretId: string) {
    goto(`/allegro/${secretId}/matches`);
  }

  function openSettings() {
    goto('/settings/secrets');
  }

  onMount(() => {
    void loadSecrets();
  });
</script>

<svelte:head>
  <title>Allegro Accounts — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-warning/15 text-warning rounded-3xl p-4">
          <Icon src={icons.BuildingStorefront} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Marketplace access
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Allegro accounts</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Choose a configured Allegro secret to inspect imported payments and continue the
              matching workflow.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Quick action</div>
          <p class="mt-2 text-sm">
            Manage credentials in settings before reviewing payments for a selected account.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button class="btn btn-primary" on:click={openSettings}>
            <Icon src={icons.Key} class="h-5 w-5" />
            Edit secrets
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-semibold">Configured accounts</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Review available Allegro secrets and open the payments view for a selected account.
          </p>
        </div>

        <button class="btn btn-ghost btn-sm" disabled={loading} on:click={loadSecrets}>
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon src={icons.ArrowPath} class="h-4 w-4" />
          {/if}
          Refresh
        </button>
      </div>

      <div class="divider my-0"></div>

      {#if networkError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{networkError}</span>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-4">
          <div class="grid gap-4 md:grid-cols-3">
            {#each Array(3) as _}
              <div class="skeleton h-24 w-full rounded-3xl"></div>
            {/each}
          </div>
          <div class="space-y-2 pt-2">
            <div class="skeleton h-12 w-full rounded-2xl"></div>
            <div class="skeleton h-12 w-full rounded-2xl"></div>
            <div class="skeleton h-12 w-full rounded-2xl"></div>
          </div>
        </div>
      {:else if secrets.length === 0}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-warning/15 text-warning rounded-3xl p-4">
            <Icon src={icons.Key} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No Allegro secrets yet</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            Add your first Allegro credential in settings to start reviewing imported payments.
          </p>
          <button class="btn btn-primary mt-6" on:click={openSettings}>
            <Icon src={icons.Key} class="h-5 w-5" />
            Open settings
          </button>
        </div>
      {:else}
        <div class="hidden overflow-x-auto xl:block">
          <table class="table">
            <thead>
              <tr>
                <th>Short ID</th>
                <th>Usage</th>
                <th>Last used</th>
                <th>Created</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each secrets as secret (secret.id)}
                <tr class="hover">
                  <td>
                    <div class="flex items-center gap-3">
                      <div
                        class="from-warning/20 to-primary/10 rounded-2xl bg-gradient-to-br px-3 py-2 text-sm font-semibold"
                      >
                        {secret.short_id}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-soft badge-ghost">{secret.usage_count}</span>
                  </td>
                  <td>{formatDate(secret.last_used_at)}</td>
                  <td>{formatDate(secret.created_at)}</td>
                  <td>
                    <div class="flex justify-end gap-2">
                      <div class="tooltip" data-tip="Payments">
                        <button
                          class="btn btn-sm btn-ghost"
                          on:click={() => openPayments(secret.id)}
                        >
                          <Icon src={icons.CreditCard} class="h-4 w-4" />
                        </button>
                      </div>
                      <div class="tooltip" data-tip="Matches">
                        <button
                          class="btn btn-sm btn-ghost"
                          on:click={() => openMatches(secret.id)}
                        >
                          <Icon src={icons.Sparkles} class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="grid gap-4 xl:hidden">
          {#each secrets as secret (secret.id)}
            <article
              class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
            >
              <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-5">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                      Short ID
                    </div>
                    <div class="mt-2 font-mono text-sm font-semibold">{secret.short_id}</div>
                  </div>
                  <span class="badge badge-soft badge-ghost">{secret.usage_count} uses</span>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Last used</div>
                    <div class="mt-1 text-sm font-medium">{formatDate(secret.last_used_at)}</div>
                  </div>
                  <div class="bg-base-200/60 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs uppercase">Created</div>
                    <div class="mt-1 text-sm font-medium">{formatDate(secret.created_at)}</div>
                  </div>
                </div>

                <div class="mt-5 flex flex-wrap justify-end gap-2">
                  <button class="btn btn-sm btn-ghost" on:click={() => openMatches(secret.id)}>
                    <Icon src={icons.Sparkles} class="h-4 w-4" />
                    Open matches
                  </button>
                  <button class="btn btn-sm btn-primary" on:click={() => openPayments(secret.id)}>
                    <Icon src={icons.CreditCard} class="h-4 w-4" />
                    Open payments
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </section>
</div>

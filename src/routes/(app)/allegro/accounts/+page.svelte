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
      (type === 'error' ? 'Failed to load Allegro secrets' : type === 'success' ? 'Success' : 'Info');

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
    const token = localStorage.getItem('access_token');
    if (!token) {
      goto('/login');
      return;
    }

    loading = true;
    networkError = null;

    try {
      const result = await allegro.listSecrets(token);
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

  onMount(() => {
    void loadSecrets();
  });
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="card-title">Allegro Secrets</h3>
        <p class="text-base-content/70 text-sm">Choose an account to preview payments.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a href="/settings/secrets" class="btn btn-primary btn-sm">
          <Icon src={icons.Key} class="h-4 w-4" />
          Edit Secrets
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
    {:else if secrets.length === 0}
      <div class="alert mt-2">
        <Icon src={icons.InformationCircle} class="h-5 w-5" />
        <span>No Allegro secrets to display.</span>
      </div>
    {:else}
      <div class="overflow-x-auto pt-2">
        <table class="table">
          <thead>
            <tr>
              <th>Short ID</th>
              <th>Usage</th>
              <th>Last Used</th>
              <th>Created</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {#each secrets as secret}
              <tr>
                <td class="font-mono text-xs">{secret.short_id}</td>
                <td>{secret.usage_count}</td>
                <td>{formatDate(secret.last_used_at)}</td>
                <td>{formatDate(secret.created_at)}</td>
                <td class="text-right">
                  <button class="btn btn-sm btn-ghost" on:click={() => openPayments(secret.id)}>
                    <Icon src={icons.CreditCard} class="h-4 w-4" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

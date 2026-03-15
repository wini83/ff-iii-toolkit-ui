<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { userSecrets } from '$lib/api/user_secrets';
  import type { operations, components } from '$lib/api/schema';

  type UserSecret = components['schemas']['UserSecretResponse'];
  type SecretType = components['schemas']['SecretType'];

  type ListSecretsResponse =
    operations['list_secrets_api_user_secrets_get']['responses'][200]['content']['application/json'];
  type CreateSecretRequest =
    operations['create_secret_api_user_secrets_post']['requestBody']['content']['application/json'];
  type CreateSecretResponse =
    operations['create_secret_api_user_secrets_post']['responses'][201]['content']['application/json'];
  type UpdateSecretAliasRequest =
    operations['update_secret_alias_api_user_secrets__secret_id__patch']['requestBody']['content']['application/json'];
  type UpdateSecretAliasResponse =
    operations['update_secret_alias_api_user_secrets__secret_id__patch']['responses'][200]['content']['application/json'];

  const SECRET_TYPES: SecretType[] = ['allegro', 'amazon', 'session', 'api_token'];

  let loading = true;
  let submitting = false;
  let aliasSubmitting = false;
  let deleting = false;
  let error: string | null = null;

  let secrets: ListSecretsResponse = [];

  let formDialog: HTMLDialogElement | null = null;
  let aliasDialog: HTMLDialogElement | null = null;
  let deleteDialog: HTMLDialogElement | null = null;

  let pendingAlias: UserSecret | null = null;
  let pendingDelete: UserSecret | null = null;

  let formType: SecretType = SECRET_TYPES[0];
  let formAlias = '';
  let formSecret = '';
  let formError: string | null = null;
  let aliasValue = '';
  let aliasError: string | null = null;

  function emitToast(type: 'success' | 'error', msg: string) {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type, msg } }));
  }

  function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message.trim()) return err.message;
    return fallback;
  }

  function formatSecretType(type: SecretType): string {
    return type.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatDate(value: string | null): string {
    if (!value) return 'n/a';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsed);
  }

  function formatShortId(value: string | null | undefined): string {
    if (!value) return 'n/a';
    return value;
  }

  function resetForm() {
    formType = SECRET_TYPES[0];
    formAlias = '';
    formSecret = '';
    formError = null;
  }

  function openCreateModal() {
    resetForm();
    formDialog?.showModal();
  }

  function closeFormModal() {
    if (formDialog?.open) {
      formDialog.close();
    }
    resetForm();
  }

  function onFormDialogClose() {
    resetForm();
  }

  function resetAliasForm() {
    pendingAlias = null;
    aliasValue = '';
    aliasError = null;
  }

  function openAliasModal(secret: UserSecret) {
    pendingAlias = secret;
    aliasValue = secret.alias ?? '';
    aliasError = null;
    aliasDialog?.showModal();
  }

  function closeAliasModal() {
    if (aliasDialog?.open) {
      aliasDialog.close();
    }
    resetAliasForm();
  }

  function onAliasDialogClose() {
    resetAliasForm();
  }

  function openDeleteModal(secret: UserSecret) {
    pendingDelete = secret;
    deleteDialog?.showModal();
  }

  function closeDeleteModal() {
    pendingDelete = null;
    deleteDialog?.close();
  }

  async function loadSecrets() {
    loading = true;
    error = null;

    try {
      const list = await userSecrets.listUserSecrets();
      secrets = list;
    } catch (err: unknown) {
      error = getErrorMessage(err, 'Failed to load user secrets');
    } finally {
      loading = false;
    }
  }

  async function saveSecret() {
    formError = null;

    if (!formType || !formSecret.trim()) {
      formError = 'Secret type and secret value are required';
      return;
    }

    submitting = true;

    try {
      const payload: CreateSecretRequest = {
        type: formType,
        alias: formAlias.trim() || null,
        secret: formSecret
      };

      const saved: CreateSecretResponse = await userSecrets.createUserSecret(payload);
      emitToast('success', `Secret created: ${formatSecretType(saved.type)}`);
      closeFormModal();
      await loadSecrets();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to save secret');
      formError = message;
      emitToast('error', message);
    } finally {
      submitting = false;
    }
  }

  async function saveAlias() {
    if (!pendingAlias) return;

    aliasError = null;
    aliasSubmitting = true;

    try {
      const payload: UpdateSecretAliasRequest = {
        alias: aliasValue.trim() || null
      };

      const updated: UpdateSecretAliasResponse = await userSecrets.updateUserSecretAlias(
        pendingAlias.id,
        payload
      );

      secrets = secrets.map((secret) => (secret.id === updated.id ? updated : secret));
      emitToast('success', `Alias updated: ${formatSecretType(updated.type)}`);
      closeAliasModal();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Failed to update alias');
      aliasError = message;
      emitToast('error', message);
    } finally {
      aliasSubmitting = false;
    }
  }

  async function deleteSecret() {
    if (!pendingDelete) return;

    deleting = true;

    try {
      await userSecrets.deleteUserSecret(pendingDelete.id);
      emitToast('success', `Secret deleted: ${formatSecretType(pendingDelete.type)}`);
      closeDeleteModal();
      await loadSecrets();
    } catch (err: unknown) {
      emitToast('error', getErrorMessage(err, 'Failed to delete secret'));
    } finally {
      deleting = false;
    }
  }

  onMount(() => {
    loadSecrets();
  });
</script>

<div class="card bg-base-100 w-full shadow-xl">
  <div class="card-body gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">User Secrets</h1>
        <p class="text-base-content/70 text-sm">Manage integration credentials for your account.</p>
      </div>

      <button
        class="btn btn-primary"
        disabled={loading || submitting || aliasSubmitting || deleting}
        on:click={openCreateModal}
      >
        <Icon src={icons.Plus} class="h-5 w-5" />
        Add secret
      </button>
    </div>

    <div class="divider my-0"></div>

    {#if loading}
      <div class="space-y-3">
        <div class="skeleton h-16 w-full"></div>
        <div class="skeleton h-16 w-full"></div>
        <div class="skeleton h-16 w-full"></div>
      </div>
    {:else if error}
      <div class="alert alert-error">
        <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
        <span>{error}</span>
      </div>
    {:else if !secrets.length}
      <div class="alert alert-info">
        <Icon src={icons.CheckCircle} class="h-5 w-5" />
        <span>No secrets configured</span>
      </div>
    {:else}
      <div class="hidden overflow-x-auto lg:block">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Alias</th>
              <th>Short ID</th>
              <th>Usage</th>
              <th>Last Used</th>
              <th>Last Updated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each secrets as secret (secret.id)}
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    <Icon src={icons.Key} class="h-5 w-5" />
                    <span>{formatSecretType(secret.type)}</span>
                  </div>
                </td>
                <td>
                  {#if secret.alias}
                    <span class="font-medium">{secret.alias}</span>
                  {:else}
                    <span class="text-base-content/50">No alias</span>
                  {/if}
                </td>
                <td>
                <div class="tooltip" data-tip="{secret.id}">
                  <span class="badge badge-outline badge-sm font-mono"
                    >{formatShortId(secret.short_id)}</span
                  ></div>
                </td>
                <td>{secret.usage_count}</td>
                <td>{formatDate(secret.last_used_at)}</td>
                <td>{formatDate(secret.created_at)}</td>
                <td>
                  <div class="flex justify-end">
                    <button
                      class="btn btn-ghost btn-sm"
                      disabled={submitting || aliasSubmitting || deleting || loading}
                      on:click={() => openAliasModal(secret)}
                    >
                      <Icon src={icons.PencilSquare} class="h-4 w-4" />
                      Alias
                    </button>
                    <button
                      class="btn btn-ghost btn-sm text-error"
                      disabled={submitting || aliasSubmitting || deleting || loading}
                      on:click={() => openDeleteModal(secret)}
                    >
                      <Icon src={icons.Trash} class="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="grid grid-cols-1 gap-3 lg:hidden">
        {#each secrets as secret (secret.id)}
          <div class="card bg-base-200 shadow">
            <div class="card-body p-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2 font-semibold">
                    <Icon src={icons.Key} class="h-5 w-5" />
                    {formatSecretType(secret.type)}
                  </div>
                  <div class="text-base-content/70 mt-1 text-sm">
                    {secret.alias || 'No alias'}
                  </div>
                </div>

                <span class="badge badge-outline badge-sm font-mono"
                  >{formatShortId(secret.short_id)}</span
                >
              </div>

              <div class="space-y-1 text-sm">
                <p><span class="font-medium">Usage:</span> {secret.usage_count}</p>
                <p><span class="font-medium">Last used:</span> {formatDate(secret.last_used_at)}</p>
                <p>
                  <span class="font-medium">Last updated:</span>
                  {formatDate(secret.created_at)}
                </p>
              </div>

              <div class="card-actions justify-end">
                <button
                  class="btn btn-ghost btn-sm"
                  disabled={submitting || aliasSubmitting || deleting || loading}
                  on:click={() => openAliasModal(secret)}
                >
                  <Icon src={icons.PencilSquare} class="h-4 w-4" />
                  Alias
                </button>
                <button
                  class="btn btn-ghost btn-sm text-error"
                  disabled={submitting || aliasSubmitting || deleting || loading}
                  on:click={() => openDeleteModal(secret)}
                >
                  <Icon src={icons.Trash} class="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<dialog class="modal" bind:this={formDialog} on:close={onFormDialogClose}>
  <div class="modal-box">
    <h3 class="text-lg font-semibold">Add secret</h3>
    <p class="text-base-content/70 mt-1 text-sm">
      Secret values are never shown in plaintext. Enter a new value to create the secret.
    </p>

    <div class="mt-4 space-y-3">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Secret Type</legend>
        <select
          class="select select-bordered w-full"
          bind:value={formType}
          disabled={submitting}
          required
        >
          {#each SECRET_TYPES as option}
            <option value={option}>{formatSecretType(option)}</option>
          {/each}
        </select>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Alias</legend>
        <input
          class="input input-bordered w-full"
          type="text"
          bind:value={formAlias}
          disabled={submitting}
          maxlength="255"
          placeholder="Optional display name"
        />
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Secret Value</legend>
        <input
          class="input input-bordered w-full"
          type="password"
          bind:value={formSecret}
          required
          disabled={submitting}
          placeholder="Enter secret"
        />
      </fieldset>
    </div>

    {#if formError}
      <div class="alert alert-error mt-4">
        <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
        <span>{formError}</span>
      </div>
    {/if}

    <div class="modal-action">
      <button class="btn btn-ghost" on:click={closeFormModal} disabled={submitting}>Cancel</button>
      <button
        class="btn btn-primary"
        on:click={saveSecret}
        disabled={submitting || !formType || !formSecret.trim()}
      >
        {#if submitting}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Save
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={submitting}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={aliasDialog} on:close={onAliasDialogClose}>
  <div class="modal-box">
    <h3 class="text-lg font-semibold">Edit alias</h3>
    <p class="text-base-content/70 mt-1 text-sm">
      Update the display name for
      <span class="font-semibold"
        >{pendingAlias ? formatSecretType(pendingAlias.type) : 'this secret'}</span
      >.
    </p>

    <div class="mt-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Alias</legend>
        <input
          class="input input-bordered w-full"
          type="text"
          bind:value={aliasValue}
          disabled={aliasSubmitting}
          maxlength="255"
          placeholder="Optional display name"
        />
      </fieldset>
      <p class="text-base-content/60 mt-2 text-xs">Leave empty to remove the alias.</p>
    </div>

    {#if aliasError}
      <div class="alert alert-error mt-4">
        <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
        <span>{aliasError}</span>
      </div>
    {/if}

    <div class="modal-action">
      <button class="btn btn-ghost" on:click={closeAliasModal} disabled={aliasSubmitting}>
        Cancel
      </button>
      <button
        class="btn btn-primary"
        on:click={saveAlias}
        disabled={aliasSubmitting || !pendingAlias}
      >
        {#if aliasSubmitting}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Save
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={aliasSubmitting}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={deleteDialog}>
  <div class="modal-box">
    <h3 class="text-lg font-semibold">Delete secret</h3>
    <p class="text-base-content/70 mt-2 text-sm">
      Are you sure you want to delete
      <span class="font-semibold"
        >{pendingDelete ? formatSecretType(pendingDelete.type) : 'this secret'}</span
      >?
    </p>

    <div class="modal-action">
      <button class="btn btn-ghost" on:click={closeDeleteModal} disabled={deleting}>Cancel</button>
      <button class="btn btn-primary" on:click={deleteSecret} disabled={deleting || !pendingDelete}>
        {#if deleting}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Delete
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={deleting}>close</button>
  </form>
</dialog>

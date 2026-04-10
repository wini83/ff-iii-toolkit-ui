<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { ApiError } from '$lib/api/errors';
  import { userSecrets } from '$lib/api/user_secrets';
  import type { components } from '$lib/api/schema';

  type UserSecret = components['schemas']['UserSecretResponse'];
  type SecretType = components['schemas']['SecretType'];
  type CreateSecretPayload = components['schemas']['CreateSecretPayload'];
  type UpdateSecretPayload = components['schemas']['UpdateSecretPayload'];
  type VaultStatus = components['schemas']['VaultStatusResponse'];
  type VaultView = 'setup' | 'unlock' | 'ready';

  const SECRET_TYPES: SecretType[] = ['allegro', 'amazon', 'session', 'api_token'];

  let vaultLoading = true;
  let secretsLoading = false;
  let setupSubmitting = false;
  let unlockSubmitting = false;
  let createSubmitting = false;
  let editSubmitting = false;
  let deleteSubmitting = false;
  let lockSubmitting = false;

  let vaultView: VaultView = 'unlock';
  let vaultStatus: VaultStatus | null = null;
  let pageError: string | null = null;
  let setupError: string | null = null;
  let unlockError: string | null = null;
  let createError: string | null = null;
  let editError: string | null = null;

  let secrets: UserSecret[] = [];

  let createDialog: HTMLDialogElement | null = null;
  let editDialog: HTMLDialogElement | null = null;
  let deleteDialog: HTMLDialogElement | null = null;

  let pendingEdit: UserSecret | null = null;
  let pendingDelete: UserSecret | null = null;

  let setupPassphrase = '';
  let unlockPassphrase = '';

  let createType: SecretType = SECRET_TYPES[0];
  let createAlias = '';
  let createExternalUsername = '';
  let createSecret = '';

  let editAlias = '';
  let editExternalUsername = '';
  let editSecret = '';

  function emitToast(type: 'success' | 'error' | 'info', msg: string) {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type, msg } }));
  }

  function emitVaultStatusChanged(status: VaultStatus) {
    window.dispatchEvent(new CustomEvent('vault-status-changed', { detail: status }));
  }

  function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message.trim()) return err.message;
    return fallback;
  }

  function getErrorStatus(err: unknown): number | undefined {
    if (err instanceof ApiError) return err.status;
    return undefined;
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

  function formatText(value: string | null | undefined, fallback = 'n/a'): string {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : fallback;
  }

  function isBusy() {
    return (
      vaultLoading ||
      secretsLoading ||
      setupSubmitting ||
      unlockSubmitting ||
      createSubmitting ||
      editSubmitting ||
      deleteSubmitting ||
      lockSubmitting
    );
  }

  function setVaultView(status: VaultStatus) {
    vaultStatus = status;
    emitVaultStatusChanged(status);

    if (!status.configured) {
      vaultView = 'setup';
      secrets = [];
      return;
    }

    if (!status.unlocked) {
      vaultView = 'unlock';
      secrets = [];
      return;
    }

    vaultView = 'ready';
  }

  function resetCreateForm() {
    createType = SECRET_TYPES[0];
    createAlias = '';
    createExternalUsername = '';
    createSecret = '';
    createError = null;
  }

  function openCreateModal() {
    resetCreateForm();
    createDialog?.showModal();
  }

  function closeCreateModal() {
    if (createDialog?.open) {
      createDialog.close();
    }
    resetCreateForm();
  }

  function resetEditForm() {
    pendingEdit = null;
    editAlias = '';
    editExternalUsername = '';
    editSecret = '';
    editError = null;
  }

  function closeEditModal() {
    if (editDialog?.open) {
      editDialog.close();
    }
    resetEditForm();
  }

  function closeDeleteModal() {
    pendingDelete = null;
    if (deleteDialog?.open) {
      deleteDialog.close();
    }
  }

  function openEditModal(secret: UserSecret) {
    pendingEdit = secret;
    editAlias = secret.alias ?? '';
    editExternalUsername = secret.external_username ?? '';
    editSecret = '';
    editError = null;
    editDialog?.showModal();
  }

  function openDeleteModal(secret: UserSecret) {
    pendingDelete = secret;
    deleteDialog?.showModal();
  }

  async function applyVaultRecovery(err: unknown, fallbackMessage: string): Promise<boolean> {
    const status = getErrorStatus(err);

    if (status === 401 || status === 423) {
      setVaultView({ configured: true, unlocked: false });
      closeEditModal();
      closeDeleteModal();
      createError = null;
      editError = null;
      const message = getErrorMessage(err, 'Vault is locked. Unlock it to continue.');
      pageError = null;
      unlockError = message;
      return true;
    }

    if (status === 409) {
      setVaultView({ configured: false, unlocked: false });
      closeEditModal();
      closeDeleteModal();
      createError = null;
      editError = null;
      const message = getErrorMessage(err, 'Vault is not configured yet.');
      pageError = null;
      setupError = message;
      return true;
    }

    pageError = getErrorMessage(err, fallbackMessage);
    return false;
  }

  async function loadVaultStatus() {
    vaultLoading = true;
    pageError = null;

    try {
      const status = await userSecrets.getVaultStatus();
      setVaultView(status);

      if (status.unlocked) {
        await loadSecrets();
      }
    } catch (err: unknown) {
      if (!(await applyVaultRecovery(err, 'Failed to load vault status'))) {
        emitToast('error', pageError ?? 'Failed to load vault status');
      }
    } finally {
      vaultLoading = false;
    }
  }

  async function loadSecrets() {
    if (vaultView !== 'ready') return;

    secretsLoading = true;
    pageError = null;

    try {
      secrets = await userSecrets.listUserSecrets();
    } catch (err: unknown) {
      if (!(await applyVaultRecovery(err, 'Failed to load user secrets'))) {
        emitToast('error', pageError ?? 'Failed to load user secrets');
      }
    } finally {
      secretsLoading = false;
    }
  }

  async function submitVaultSetup() {
    setupError = null;

    if (!setupPassphrase.trim()) {
      setupError = 'Passphrase is required';
      return;
    }

    setupSubmitting = true;

    try {
      await userSecrets.setupVault({ passphrase: setupPassphrase });
      setupPassphrase = '';
      await loadVaultStatus();
    } catch (err: unknown) {
      setupError = getErrorMessage(err, 'Failed to configure vault');
      emitToast('error', setupError);
    } finally {
      setupSubmitting = false;
    }
  }

  async function submitVaultUnlock() {
    unlockError = null;

    if (!unlockPassphrase.trim()) {
      unlockError = 'Passphrase is required';
      return;
    }

    unlockSubmitting = true;

    try {
      await userSecrets.unlockVault({ passphrase: unlockPassphrase });
      unlockPassphrase = '';
      await loadVaultStatus();
    } catch (err: unknown) {
      unlockError = getErrorMessage(err, 'Failed to unlock vault');
      emitToast('error', unlockError);
    } finally {
      unlockSubmitting = false;
    }
  }

  async function submitVaultLock() {
    lockSubmitting = true;

    try {
      await userSecrets.lockVault();
      await loadVaultStatus();
    } catch (err: unknown) {
      if (!(await applyVaultRecovery(err, 'Failed to lock vault'))) {
        emitToast('error', pageError ?? 'Failed to lock vault');
      }
    } finally {
      lockSubmitting = false;
    }
  }

  async function submitCreateSecret() {
    createError = null;

    if (!createType || !createSecret.trim()) {
      createError = 'Secret type and secret value are required';
      return;
    }

    createSubmitting = true;

    try {
      const payload: CreateSecretPayload = {
        type: createType,
        alias: createAlias.trim() || null,
        external_username: createExternalUsername.trim() || null,
        secret: createSecret
      };

      const saved = await userSecrets.createUserSecret(payload);
      closeCreateModal();
      resetCreateForm();
      emitToast('success', `Secret created: ${formatSecretType(saved.type)}`);
      await loadSecrets();
    } catch (err: unknown) {
      if (await applyVaultRecovery(err, 'Failed to create secret')) return;
      createError = getErrorMessage(err, 'Failed to create secret');
      emitToast('error', createError);
    } finally {
      createSubmitting = false;
    }
  }

  async function submitEditSecret() {
    if (!pendingEdit) return;

    editError = null;
    editSubmitting = true;

    try {
      const payload: UpdateSecretPayload = {
        alias: editAlias.trim() || null,
        external_username: editExternalUsername.trim() || null
      };

      if (editSecret.trim()) {
        payload.secret = editSecret;
      }

      const updated = await userSecrets.updateUserSecret(pendingEdit.id, payload);
      secrets = secrets.map((secret) => (secret.id === updated.id ? updated : secret));
      emitToast('success', `Secret updated: ${formatSecretType(updated.type)}`);
      closeEditModal();
    } catch (err: unknown) {
      if (await applyVaultRecovery(err, 'Failed to update secret')) return;
      editError = getErrorMessage(err, 'Failed to update secret');
      emitToast('error', editError);
    } finally {
      editSubmitting = false;
    }
  }

  async function submitDeleteSecret() {
    if (!pendingDelete) return;

    deleteSubmitting = true;

    try {
      await userSecrets.deleteUserSecret(pendingDelete.id);
      emitToast('success', `Secret deleted: ${formatSecretType(pendingDelete.type)}`);
      closeDeleteModal();
      await loadSecrets();
    } catch (err: unknown) {
      if (!(await applyVaultRecovery(err, 'Failed to delete secret'))) {
        emitToast('error', pageError ?? 'Failed to delete secret');
      }
    } finally {
      deleteSubmitting = false;
    }
  }

  onMount(() => {
    void loadVaultStatus();
  });
</script>

<div class="card bg-base-100 w-full shadow-xl">
  <div class="card-body gap-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">User Secrets</h1>
        <p class="text-base-content/70 text-sm">
          Manage vault access and encrypted integration credentials for your account.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost btn-sm" disabled={isBusy()} on:click={loadVaultStatus}>
          {#if vaultLoading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon src={icons.ArrowPath} class="h-4 w-4" />
          {/if}
          Refresh
        </button>

        {#if vaultView === 'ready'}
          <button class="btn btn-outline btn-sm" disabled={isBusy()} on:click={submitVaultLock}>
            {#if lockSubmitting}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon src={icons.LockClosed} class="h-4 w-4" />
            {/if}
            Lock vault
          </button>
        {/if}
      </div>
    </div>

    <div class="divider my-0"></div>

    {#if pageError}
      <div class="alert alert-error">
        <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
        <span>{pageError}</span>
      </div>
    {/if}

    {#if vaultLoading}
      <div class="space-y-4">
        <div class="skeleton h-32 w-full"></div>
        <div class="skeleton h-16 w-full"></div>
        <div class="skeleton h-16 w-full"></div>
      </div>
    {:else if vaultView === 'setup'}
      <section class="bg-base-200/60 rounded-2xl p-6">
        <div class="flex items-start gap-4">
          <div class="bg-primary/10 text-primary rounded-2xl p-3">
            <Icon src={icons.ShieldCheck} class="h-7 w-7" />
          </div>

          <div class="flex-1 space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Configure vault</h2>
              <p class="text-base-content/70 mt-1 text-sm">
                Create a passphrase to enable encrypted user secrets for this account.
              </p>
            </div>

            <fieldset class="fieldset max-w-xl">
              <legend class="fieldset-legend">Passphrase</legend>
              <input
                class="input input-bordered w-full"
                type="password"
                bind:value={setupPassphrase}
                disabled={setupSubmitting}
                placeholder="Enter vault passphrase"
              />
            </fieldset>

            {#if setupError}
              <div class="alert alert-error">
                <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
                <span>{setupError}</span>
              </div>
            {/if}

            <button
              class="btn btn-primary"
              disabled={setupSubmitting || !setupPassphrase.trim()}
              on:click={submitVaultSetup}
            >
              {#if setupSubmitting}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              Configure vault
            </button>
          </div>
        </div>
      </section>
    {:else if vaultView === 'unlock'}
      <section class="bg-base-200/60 rounded-2xl p-6">
        <div class="flex items-start gap-4">
          <div class="bg-warning/10 text-warning rounded-2xl p-3">
            <Icon src={icons.LockClosed} class="h-7 w-7" />
          </div>

          <div class="flex-1 space-y-4">
            <div>
              <h2 class="text-xl font-semibold">Unlock vault</h2>
              <p class="text-base-content/70 mt-1 text-sm">
                Enter the passphrase to access secret metadata and manage credentials.
              </p>
            </div>

            <fieldset class="fieldset max-w-xl">
              <legend class="fieldset-legend">Passphrase</legend>
              <input
                class="input input-bordered w-full"
                type="password"
                bind:value={unlockPassphrase}
                disabled={unlockSubmitting}
                placeholder="Enter vault passphrase"
              />
            </fieldset>

            {#if unlockError}
              <div class="alert alert-error">
                <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
                <span>{unlockError}</span>
              </div>
            {/if}

            <button
              class="btn btn-primary"
              disabled={unlockSubmitting || !unlockPassphrase.trim()}
              on:click={submitVaultUnlock}
            >
              {#if unlockSubmitting}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              Unlock vault
            </button>
          </div>
        </div>
      </section>
    {:else}
      <section class="bg-base-200/60 rounded-2xl p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold">Stored secrets</h2>
            <p class="text-base-content/70 mt-1 text-sm">
              Metadata only. Plaintext values are never revealed by the API.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-soft badge-ghost">{secrets.length} total</span>

            {#if vaultStatus?.unlocked}
              <span class="badge badge-soft badge-success">Vault unlocked</span>
            {/if}

            <button class="btn btn-primary btn-sm" disabled={isBusy()} on:click={openCreateModal}>
              <Icon src={icons.Plus} class="h-4 w-4" />
              Create secret
            </button>
          </div>
        </div>

        <div class="divider my-3"></div>

        {#if secretsLoading}
          <div class="space-y-3">
            <div class="skeleton h-16 w-full"></div>
            <div class="skeleton h-16 w-full"></div>
            <div class="skeleton h-16 w-full"></div>
          </div>
        {:else if !secrets.length}
          <div class="alert alert-info">
            <Icon src={icons.InformationCircle} class="h-5 w-5" />
            <span>No secrets configured yet.</span>
          </div>
        {:else}
          <div class="hidden overflow-x-auto lg:block">
            <table class="table-zebra table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Alias</th>
                  <th>External Username</th>
                  <th>Usage</th>
                  <th>Last Used</th>
                  <th>Created</th>
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
                    <td>{formatText(secret.alias, 'No alias')}</td>
                    <td>{formatText(secret.external_username)}</td>
                    <td>{secret.usage_count}</td>
                    <td>{formatDate(secret.last_used_at)}</td>
                    <td>{formatDate(secret.created_at)}</td>
                    <td>
                      <div class="flex justify-end gap-1">
                        <button
                          class="btn btn-ghost btn-sm"
                          disabled={isBusy()}
                          on:click={() => openEditModal(secret)}
                        >
                          <Icon src={icons.PencilSquare} class="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          class="btn btn-ghost btn-sm text-error"
                          disabled={isBusy()}
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
              <div class="card bg-base-100 shadow">
                <div class="card-body p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2 font-semibold">
                        <Icon src={icons.Key} class="h-5 w-5" />
                        {formatSecretType(secret.type)}
                      </div>
                      <div class="text-base-content/70 mt-1 text-sm">
                        {formatText(secret.alias, 'No alias')}
                      </div>
                    </div>

                    <span class="badge badge-soft badge-ghost">{secret.usage_count} uses</span>
                  </div>

                  <div class="space-y-1 text-sm">
                    <p>
                      <span class="font-medium">External username:</span>
                      {formatText(secret.external_username)}
                    </p>
                    <p>
                      <span class="font-medium">Last used:</span>
                      {formatDate(secret.last_used_at)}
                    </p>
                    <p><span class="font-medium">Created:</span> {formatDate(secret.created_at)}</p>
                  </div>

                  <div class="card-actions justify-end">
                    <button
                      class="btn btn-ghost btn-sm"
                      disabled={isBusy()}
                      on:click={() => openEditModal(secret)}
                    >
                      <Icon src={icons.PencilSquare} class="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      class="btn btn-ghost btn-sm text-error"
                      disabled={isBusy()}
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
      </section>
    {/if}
  </div>
</div>

<dialog class="modal" bind:this={createDialog} on:close={resetCreateForm}>
  <div class="modal-box">
    <h3 class="text-lg font-semibold">Create secret</h3>
    <p class="text-base-content/70 mt-1 text-sm">
      Plaintext is only accepted on create and is never shown again.
    </p>

    <div class="mt-4 grid gap-4 md:grid-cols-2">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Type</legend>
        <select
          class="select select-bordered w-full"
          bind:value={createType}
          disabled={createSubmitting}
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
          bind:value={createAlias}
          disabled={createSubmitting}
          maxlength="255"
          placeholder="Optional display name"
        />
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">External username</legend>
        <input
          class="input input-bordered w-full"
          type="text"
          bind:value={createExternalUsername}
          disabled={createSubmitting}
          maxlength="255"
          placeholder="Optional login or identifier"
        />
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Secret</legend>
        <input
          class="input input-bordered w-full"
          type="password"
          bind:value={createSecret}
          disabled={createSubmitting}
          placeholder="Enter secret value"
        />
      </fieldset>
    </div>

    {#if createError}
      <div class="alert alert-error mt-4">
        <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
        <span>{createError}</span>
      </div>
    {/if}

    <div class="modal-action">
      <button class="btn btn-ghost" disabled={createSubmitting} on:click={closeCreateModal}>
        Cancel
      </button>
      <button
        class="btn btn-primary"
        disabled={createSubmitting || !createType || !createSecret.trim()}
        on:click={submitCreateSecret}
      >
        {#if createSubmitting}
          <span class="loading loading-spinner loading-sm"></span>
        {:else}
          <Icon src={icons.Plus} class="h-4 w-4" />
        {/if}
        Create
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={createSubmitting}>close</button>
  </form>
</dialog>

<dialog class="modal" bind:this={editDialog} on:close={resetEditForm}>
  <div class="modal-box">
    <h3 class="text-lg font-semibold">Edit secret</h3>
    <p class="text-base-content/70 mt-1 text-sm">
      Update metadata and optionally rotate the secret value.
    </p>

    <div class="mt-4 space-y-3">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Alias</legend>
        <input
          class="input input-bordered w-full"
          type="text"
          bind:value={editAlias}
          disabled={editSubmitting}
          maxlength="255"
          placeholder="Optional display name"
        />
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">External username</legend>
        <input
          class="input input-bordered w-full"
          type="text"
          bind:value={editExternalUsername}
          disabled={editSubmitting}
          maxlength="255"
          placeholder="Optional login or identifier"
        />
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">New secret</legend>
        <input
          class="input input-bordered w-full"
          type="password"
          bind:value={editSecret}
          disabled={editSubmitting}
          placeholder="Leave empty to keep current value"
        />
      </fieldset>
    </div>

    {#if editError}
      <div class="alert alert-error mt-4">
        <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
        <span>{editError}</span>
      </div>
    {/if}

    <div class="modal-action">
      <button class="btn btn-ghost" disabled={editSubmitting} on:click={closeEditModal}
        >Cancel</button
      >
      <button
        class="btn btn-primary"
        disabled={editSubmitting || !pendingEdit}
        on:click={submitEditSecret}
      >
        {#if editSubmitting}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Save
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={editSubmitting}>close</button>
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
      <button class="btn btn-ghost" disabled={deleteSubmitting} on:click={closeDeleteModal}
        >Cancel</button
      >
      <button
        class="btn btn-primary"
        disabled={deleteSubmitting || !pendingDelete}
        on:click={submitDeleteSecret}
      >
        {#if deleteSubmitting}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Delete
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button disabled={deleteSubmitting}>close</button>
  </form>
</dialog>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import TableSkeleton from '$lib/components/TableSkeleton.svelte';
  import CreateUserModal from '$lib/components/users/CreateUserModal.svelte';
  import InviteResultModal from '$lib/components/users/InviteResultModal.svelte';
  import type { InviteResult } from '$lib/components/users/types';
  import UserActionsMenu from '$lib/components/users/UserActionsMenu.svelte';
  import { users } from '$lib/api/users';
  import type { components, operations } from '$lib/api/schema';

  type UserResponse = components['schemas']['UserResponse'];
  type CreateUserPayload =
    operations['create_user_api_users_post']['requestBody']['content']['application/json'];

  let loading = true;
  let refreshing = false;
  let creating = false;
  let actionUserId: string | null = null;
  let deleting = false;

  let pageError: string | null = null;
  let createError: string | null = null;

  let list: UserResponse[] = [];
  let createModalOpen = false;
  let inviteModalOpen = false;
  let deleteModalOpen = false;

  let username = '';
  let isSuperuser = false;
  let inviteResult: InviteResult | null = null;
  let pendingDelete: UserResponse | null = null;

  function emitToast(type: 'success' | 'error' | 'info' | 'warning', msg: string) {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type, msg } }));
  }

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  function getInitials(name: string): string {
    return name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  function openCreateModal() {
    createError = null;
    username = '';
    isSuperuser = false;
    createModalOpen = true;
  }

  function closeCreateModal() {
    if (creating) return;

    createModalOpen = false;
    createError = null;
    username = '';
    isSuperuser = false;
  }

  function closeInviteModal() {
    inviteModalOpen = false;
    inviteResult = null;
  }

  function openDeleteModal(user: UserResponse) {
    pendingDelete = user;
    deleteModalOpen = true;
  }

  function closeDeleteModal() {
    if (deleting) return;
    pendingDelete = null;
    deleteModalOpen = false;
  }

  async function copyToClipboard(value: string | null, successMessage: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      emitToast('success', successMessage);
    } catch (error: unknown) {
      emitToast('error', getErrorMessage(error, 'Failed to copy to clipboard'));
    }
  }

  async function loadUsers(showRefreshState = false) {
    if (showRefreshState) {
      refreshing = true;
    } else {
      loading = true;
    }

    pageError = null;

    try {
      list = await users.listUsers();
    } catch (error: unknown) {
      pageError = getErrorMessage(error, 'Failed to load users');
      emitToast('error', pageError);
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function submitCreateUser() {
    createError = null;

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      createError = 'Username is required';
      return;
    }

    creating = true;

    try {
      const payload: CreateUserPayload = {
        username: normalizedUsername,
        is_superuser: isSuperuser
      };

      const created = await users.createUser(payload);
      await loadUsers(true);

      createModalOpen = false;
      inviteResult = {
        username: created.username,
        userId: created.id,
        inviteUrl: created.invite_url,
        token: created.token,
        expiresAt: created.expires_at
      };
      inviteModalOpen = true;
      emitToast('success', `User ${created.username} created`);
    } catch (error: unknown) {
      createError = getErrorMessage(error, 'Failed to create user');
      emitToast('error', createError);
    } finally {
      creating = false;
    }
  }

  async function generateInvite(user: UserResponse) {
    actionUserId = user.id;

    try {
      const invite = await users.inviteUser(user.id);
      inviteResult = {
        username: user.username,
        userId: user.id,
        inviteUrl: invite.invite_url,
        token: invite.token,
        expiresAt: invite.expires_at
      };
      inviteModalOpen = true;
      emitToast('success', `Invite generated for ${user.username}`);
    } catch (error: unknown) {
      emitToast('error', getErrorMessage(error, 'Failed to generate invite'));
    } finally {
      actionUserId = null;
    }
  }

  async function mutateUser(
    user: UserResponse,
    request: () => Promise<void>,
    successMessage: string,
    fallbackError: string
  ) {
    actionUserId = user.id;

    try {
      await request();
      await loadUsers(true);
      emitToast('success', successMessage);
    } catch (error: unknown) {
      emitToast('error', getErrorMessage(error, fallbackError));
    } finally {
      actionUserId = null;
    }
  }

  function disableUser(user: UserResponse) {
    return mutateUser(
      user,
      () => users.disableUser(user.id),
      `${user.username} disabled`,
      'Failed to disable user'
    );
  }

  function enableUser(user: UserResponse) {
    return mutateUser(
      user,
      () => users.enableUser(user.id),
      `${user.username} enabled`,
      'Failed to enable user'
    );
  }

  function promoteUser(user: UserResponse) {
    return mutateUser(
      user,
      () => users.promoteUser(user.id),
      `${user.username} promoted to superuser`,
      'Failed to promote user'
    );
  }

  function demoteUser(user: UserResponse) {
    return mutateUser(
      user,
      () => users.demoteUser(user.id),
      `${user.username} demoted`,
      'Failed to demote user'
    );
  }

  async function confirmDeleteUser() {
    if (!pendingDelete) return;

    deleting = true;

    try {
      await users.deleteUser(pendingDelete.id);
      emitToast('success', `${pendingDelete.username} deleted`);
      closeDeleteModal();
      await loadUsers(true);
    } catch (error: unknown) {
      emitToast('error', getErrorMessage(error, 'Failed to delete user'));
    } finally {
      deleting = false;
    }
  }

  $: totalUsers = list.length;
  $: activeUsers = list.filter((user) => user.is_active).length;
  $: pendingInvites = list.filter((user) => user.must_change_password).length;
  $: adminUsers = list.filter((user) => user.is_superuser).length;

  onMount(() => {
    void loadUsers();
  });
</script>

<svelte:head>
  <title>Users — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-primary/12 text-primary rounded-3xl p-4">
          <Icon src={icons.Users} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Admin directory
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Users</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Manage application users and onboarding invites with a clean admin workflow.
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
            Create accounts, regenerate invite tokens and control access without leaving the
            dashboard.
          </p>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button class="btn btn-primary" disabled={loading || creating} on:click={openCreateModal}>
            <Icon src={icons.UserPlus} class="h-5 w-5" />
            Create user
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    {#if loading}
      {#each Array(4) as _}
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body gap-3">
            <div class="skeleton h-4 w-24"></div>
            <div class="skeleton h-9 w-16"></div>
            <div class="skeleton h-4 w-36"></div>
          </div>
        </div>
      {/each}
    {:else}
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Total users</div>
          <div class="mt-3 flex items-end justify-between gap-4">
            <div class="text-4xl font-semibold">{totalUsers}</div>
            <div class="bg-primary/12 text-primary rounded-2xl p-3">
              <Icon src={icons.Users} class="h-5 w-5" />
            </div>
          </div>
          <p class="text-base-content/60 mt-3 text-sm">
            All accounts currently available in the application.
          </p>
        </div>
      </div>

      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Active</div>
          <div class="mt-3 flex items-end justify-between gap-4">
            <div class="text-4xl font-semibold">{activeUsers}</div>
            <div class="bg-success/12 text-success rounded-2xl p-3">
              <Icon src={icons.CheckBadge} class="h-5 w-5" />
            </div>
          </div>
          <p class="text-base-content/60 mt-3 text-sm">
            Users who can currently sign in and access the app.
          </p>
        </div>
      </div>

      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Pending setup</div>
          <div class="mt-3 flex items-end justify-between gap-4">
            <div class="text-4xl font-semibold">{pendingInvites}</div>
            <div class="bg-warning/15 text-warning rounded-2xl p-3">
              <Icon src={icons.Envelope} class="h-5 w-5" />
            </div>
          </div>
          <p class="text-base-content/60 mt-3 text-sm">
            Accounts waiting for password setup from an invite token.
          </p>
        </div>
      </div>

      <div class="card bg-base-100 shadow-lg">
        <div class="card-body">
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Superusers</div>
          <div class="mt-3 flex items-end justify-between gap-4">
            <div class="text-4xl font-semibold">{adminUsers}</div>
            <div class="bg-secondary/12 text-secondary rounded-2xl p-3">
              <Icon src={icons.ShieldCheck} class="h-5 w-5" />
            </div>
          </div>
          <p class="text-base-content/60 mt-3 text-sm">
            Elevated accounts with access to protected admin endpoints.
          </p>
        </div>
      </div>
    {/if}
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-semibold">User directory</h3>
          <p class="text-base-content/70 mt-1 text-sm">
            Roles, account status and onboarding progress in one place.
          </p>
        </div>

        <button
          class="btn btn-ghost btn-sm"
          disabled={loading || refreshing}
          on:click={() => loadUsers(true)}
        >
          {#if refreshing}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            <Icon src={icons.ArrowPath} class="h-4 w-4" />
          {/if}
          Refresh
        </button>
      </div>

      {#if pageError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{pageError}</span>
        </div>
      {/if}

      {#if loading}
        <div class="space-y-4">
          <div class="grid gap-4 md:grid-cols-4">
            {#each Array(4) as _}
              <div class="skeleton h-24 w-full rounded-3xl"></div>
            {/each}
          </div>
          <TableSkeleton rows={6} cols={5} colWidths={['w-28', 'w-20', 'w-20', 'w-24', 'w-16']} />
        </div>
      {:else if !list.length}
        <div
          class="bg-base-200/60 flex flex-col items-center rounded-[2rem] px-6 py-14 text-center"
        >
          <div class="bg-primary/12 text-primary rounded-3xl p-4">
            <Icon src={icons.UserGroup} class="h-8 w-8" />
          </div>
          <h4 class="mt-5 text-xl font-semibold">No users yet</h4>
          <p class="text-base-content/70 mt-2 max-w-md text-sm">
            Create the first account to start onboarding users through invite tokens.
          </p>
          <button class="btn btn-primary mt-6" on:click={openCreateModal}>
            <Icon src={icons.UserPlus} class="h-5 w-5" />
            Create user
          </button>
        </div>
      {:else}
        <div class="hidden overflow-x-auto xl:block">
          <table class="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Password setup</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each list as user (user.id)}
                <tr class="hover">
                  <td>
                    <div class="flex items-center gap-3">
                      <div
                        class="from-primary/15 to-secondary/10 rounded-2xl bg-gradient-to-br px-3 py-2 text-sm font-semibold"
                      >
                        {getInitials(user.username)}
                      </div>
                      <div>
                        <div class="font-semibold">{user.username}</div>
                        <div class="text-base-content/50 font-mono text-xs">{user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      class={`badge badge-soft ${user.is_superuser ? 'badge-secondary' : 'badge-ghost'}`}
                    >
                      {user.is_superuser ? 'Superuser' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span
                      class={`badge badge-soft ${user.is_active ? 'badge-success' : 'badge-error'}`}
                    >
                      {user.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div class="flex flex-col gap-2">
                      <span
                        class={`badge badge-soft ${user.must_change_password ? 'badge-warning' : 'badge-success'}`}
                      >
                        {user.must_change_password ? 'Pending' : 'Ready'}
                      </span>
                      {#if user.must_change_password}
                        <span class="text-base-content/50 text-xs">Awaiting password setup</span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <div class="flex justify-end">
                      <UserActionsMenu
                        {user}
                        disabled={creating || deleting || actionUserId === user.id}
                        onInvite={generateInvite}
                        onDisable={disableUser}
                        onEnable={enableUser}
                        onPromote={promoteUser}
                        onDemote={demoteUser}
                        onDelete={openDeleteModal}
                      />
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="grid gap-4 xl:hidden">
          {#each list as user (user.id)}
            <article
              class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
            >
              <div class="bg-base-100 rounded-[1.7rem] p-5">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="from-primary/15 to-secondary/10 rounded-2xl bg-gradient-to-br px-3 py-2 text-sm font-semibold"
                    >
                      {getInitials(user.username)}
                    </div>
                    <div>
                      <div class="font-semibold">{user.username}</div>
                      <div class="text-base-content/50 mt-1 font-mono text-xs break-all">
                        {user.id}
                      </div>
                    </div>
                  </div>

                  <UserActionsMenu
                    {user}
                    disabled={creating || deleting || actionUserId === user.id}
                    onInvite={generateInvite}
                    onDisable={disableUser}
                    onEnable={enableUser}
                    onPromote={promoteUser}
                    onDemote={demoteUser}
                    onDelete={openDeleteModal}
                  />
                </div>

                <div class="mt-5 grid gap-3 sm:grid-cols-3">
                  <div class="bg-base-200/70 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Role</div>
                    <div class="mt-2">
                      <span
                        class={`badge badge-soft ${user.is_superuser ? 'badge-secondary' : 'badge-ghost'}`}
                      >
                        {user.is_superuser ? 'Superuser' : 'User'}
                      </span>
                    </div>
                  </div>

                  <div class="bg-base-200/70 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                      Status
                    </div>
                    <div class="mt-2">
                      <span
                        class={`badge badge-soft ${user.is_active ? 'badge-success' : 'badge-error'}`}
                      >
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  <div class="bg-base-200/70 rounded-2xl px-4 py-3">
                    <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                      Password setup
                    </div>
                    <div class="mt-2 flex items-center gap-2">
                      <span
                        class={`badge badge-soft ${user.must_change_password ? 'badge-warning' : 'badge-success'}`}
                      >
                        {user.must_change_password ? 'Pending' : 'Ready'}
                      </span>
                    </div>
                  </div>
                </div>

                {#if actionUserId === user.id}
                  <div class="mt-4 flex items-center gap-2 text-sm">
                    <span class="loading loading-spinner loading-sm"></span>
                    Updating {user.username}...
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

<CreateUserModal
  open={createModalOpen}
  bind:username
  bind:isSuperuser
  submitting={creating}
  error={createError}
  onClose={closeCreateModal}
  onSubmit={submitCreateUser}
/>

<InviteResultModal
  open={inviteModalOpen}
  invite={inviteResult}
  onClose={closeInviteModal}
  onCopyLink={() => copyToClipboard(inviteResult?.inviteUrl ?? null, 'Invite link copied')}
  onCopyToken={() => copyToClipboard(inviteResult?.token ?? null, 'Invite token copied')}
/>

{#if deleteModalOpen && pendingDelete}
  <dialog class="modal modal-open" open>
    <div class="modal-box">
      <h3 class="text-lg font-semibold">Delete user</h3>
      <p class="text-base-content/70 mt-3 text-sm">
        Delete <span class="font-semibold">{pendingDelete.username}</span>? This action cannot be
        undone.
      </p>

      <div class="bg-base-200/70 mt-5 rounded-2xl p-4">
        <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Account summary</div>
        <div class="mt-3 grid gap-2 text-sm">
          <div><span class="font-medium">Username:</span> {pendingDelete.username}</div>
          <div>
            <span class="font-medium">Role:</span>
            {pendingDelete.is_superuser ? 'Superuser' : 'User'}
          </div>
          <div>
            <span class="font-medium">Status:</span>
            {pendingDelete.is_active ? 'Active' : 'Disabled'}
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" disabled={deleting} on:click={closeDeleteModal}>Cancel</button
        >
        <button class="btn btn-error" disabled={deleting} on:click={confirmDeleteUser}>
          {#if deleting}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Delete user
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button disabled={deleting} on:click|preventDefault={closeDeleteModal}>close</button>
    </form>
  </dialog>
{/if}

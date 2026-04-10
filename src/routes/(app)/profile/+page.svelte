<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { getMe } from '$lib/api/me';

  type MeUser = Awaited<ReturnType<typeof getMe>>;

  let loading = true;
  let pageError: string | null = null;
  let meUser: MeUser | null = null;

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  async function loadProfile() {
    loading = true;
    pageError = null;

    try {
      meUser = await getMe();
    } catch (error: unknown) {
      pageError = getErrorMessage(error, 'Failed to load profile');
      meUser = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadProfile();
  });
</script>

<svelte:head>
  <title>Profile — Firefly Toolkit</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-primary/10 via-base-100 to-base-100 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-primary/12 text-primary rounded-3xl p-4">
          <Icon src={icons.UserCircle} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-success h-2 w-2 rounded-full"></span>
            Account overview
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Profile</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Current account details returned by the application identity endpoint.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Current scope</div>
          <p class="mt-2 text-sm">
            This is a lightweight profile seed based on `/api/me`. More account details can be added
            here once the backend exposes them.
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <a href="/settings/secrets" class="btn btn-ghost btn-sm">
            <Icon src={icons.Key} class="h-4 w-4" />
            Secrets
          </a>
          <button class="btn btn-ghost btn-sm" disabled={loading} on:click={loadProfile}>
            {#if loading}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Icon src={icons.ArrowPath} class="h-4 w-4" />
            {/if}
            Refresh
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="card bg-base-100 shadow-xl">
    <div class="card-body gap-5">
      <div>
        <h3 class="text-xl font-semibold">Account details</h3>
        <p class="text-base-content/70 mt-1 text-sm">
          Basic identity and access information for the signed-in user.
        </p>
      </div>

      <div class="divider my-0"></div>

      {#if pageError}
        <div class="alert alert-error">
          <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
          <span>{pageError}</span>
        </div>
      {:else if loading}
        <div class="space-y-3">
          <div class="skeleton h-24 w-full rounded-3xl"></div>
          <div class="skeleton h-24 w-full rounded-3xl"></div>
        </div>
      {:else if meUser}
        <div class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article
            class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
          >
            <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-6 text-center">
              <div class="avatar mx-auto">
                <div class="bg-base-200 w-24 rounded-[2rem]">
                  <img
                    src={`https://api.dicebear.com/9.x/initials/svg?seed=${meUser.username}`}
                    alt="avatar"
                  />
                </div>
              </div>
              <h4 class="mt-4 text-xl font-semibold">{meUser.username}</h4>
              <p class="text-base-content/65 mt-2 text-sm">
                {meUser.is_superuser ? 'Superuser account' : 'Standard application account'}
              </p>
            </div>
          </article>

          <article
            class="from-base-100 to-base-200/60 rounded-[1.75rem] bg-gradient-to-br p-[1px] shadow-sm"
          >
            <div class="bg-base-100 rounded-[calc(1.75rem-1px)] p-6">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="bg-base-200/60 rounded-2xl px-4 py-4">
                  <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">User ID</div>
                  <div class="mt-2 font-mono text-sm">{meUser.id}</div>
                </div>

                <div class="bg-base-200/60 rounded-2xl px-4 py-4">
                  <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">
                    Username
                  </div>
                  <div class="mt-2 text-sm font-medium">{meUser.username}</div>
                </div>

                <div class="bg-base-200/60 rounded-2xl px-4 py-4">
                  <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Status</div>
                  <div class="mt-2">
                    <span
                      class={`badge badge-soft ${meUser.is_active ? 'badge-success' : 'badge-error'}`}
                    >
                      {meUser.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div class="bg-base-200/60 rounded-2xl px-4 py-4">
                  <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Role</div>
                  <div class="mt-2">
                    <span
                      class={`badge badge-soft ${meUser.is_superuser ? 'badge-secondary' : 'badge-ghost'}`}
                    >
                      {meUser.is_superuser ? 'Superuser' : 'User'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      {/if}
    </div>
  </section>
</div>

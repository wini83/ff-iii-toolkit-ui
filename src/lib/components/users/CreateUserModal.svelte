<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  export let open = false;
  export let username = '';
  export let isSuperuser = false;
  export let submitting = false;
  export let error: string | null = null;
  export let onClose: () => void = () => {};
  export let onSubmit: () => void = () => {};
</script>

{#if open}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-w-2xl p-0">
      <div
        class="from-primary/10 via-base-100 to-base-100 border-base-200 border-b bg-gradient-to-br px-6 py-5"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <div class="bg-primary/12 text-primary rounded-2xl p-3">
              <Icon src={icons.UserPlus} class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-xl font-semibold">Create user</h3>
              <p class="text-base-content/70 mt-1 text-sm">
                Add a new application user and generate an onboarding invite.
              </p>
            </div>
          </div>

          <button
            class="btn btn-ghost btn-circle btn-sm"
            disabled={submitting}
            on:click={onClose}
            aria-label="Close create user modal"
          >
            <Icon src={icons.XMark} class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div class="space-y-5 px-6 py-6">
        <label class="form-control w-full">
          <div class="label">
            <span class="label-text font-medium">Username</span>
          </div>
          <input
            class="input input-bordered w-full"
            bind:value={username}
            disabled={submitting}
            maxlength="100"
            placeholder="e.g. john.doe"
          />
        </label>

        <label class="bg-base-200/70 flex items-center justify-between gap-4 rounded-2xl px-4 py-4">
          <div>
            <div class="font-medium">Grant superuser access</div>
            <div class="text-base-content/70 mt-1 text-sm">
              Superusers can manage users and other protected admin actions.
            </div>
          </div>

          <input
            class="toggle toggle-primary"
            type="checkbox"
            bind:checked={isSuperuser}
            disabled={submitting}
          />
        </label>

        {#if error}
          <div class="alert alert-error">
            <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
            <span>{error}</span>
          </div>
        {/if}
      </div>

      <div class="modal-action bg-base-100 border-base-200 mt-0 border-t px-6 py-4">
        <button class="btn btn-ghost" disabled={submitting} on:click={onClose}>Cancel</button>
        <button class="btn btn-primary" disabled={submitting} on:click={onSubmit}>
          {#if submitting}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Create user
        </button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button disabled={submitting} on:click|preventDefault={onClose}>close</button>
    </form>
  </dialog>
{/if}

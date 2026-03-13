<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import type { InviteResult } from '$lib/components/users/types';

  export let open = false;
  export let invite: InviteResult | null = null;
  export let onClose: () => void = () => {};
  export let onCopyLink: () => void = () => {};
  export let onCopyToken: () => void = () => {};

  function formatDateTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(parsed);
  }
</script>

{#if open && invite}
  <dialog class="modal modal-open" open>
    <div class="modal-box max-w-3xl p-0">
      <div
        class="from-success/12 via-base-100 to-base-100 border-base-200 border-b bg-gradient-to-br px-6 py-5"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <div class="bg-success/12 text-success rounded-2xl p-3">
              <Icon src={icons.ShieldCheck} class="h-6 w-6" />
            </div>
            <div>
              <h3 class="text-xl font-semibold">Invite created</h3>
              <p class="text-base-content/70 mt-1 text-sm">
                Store this securely. The token is shown only for this response.
              </p>
            </div>
          </div>

          <button
            class="btn btn-ghost btn-circle btn-sm"
            on:click={onClose}
            aria-label="Close invite result modal"
          >
            <Icon src={icons.XMark} class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div class="space-y-5 px-6 py-6">
        <div class="grid gap-3 md:grid-cols-3">
          <div class="bg-base-200/70 rounded-2xl p-4">
            <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Username</div>
            <div class="mt-2 text-sm font-semibold">{invite.username ?? 'n/a'}</div>
          </div>
          <div class="bg-base-200/70 rounded-2xl p-4">
            <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">User ID</div>
            <div class="mt-2 truncate font-mono text-sm">{invite.userId ?? 'n/a'}</div>
          </div>
          <div class="bg-base-200/70 rounded-2xl p-4">
            <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Expires</div>
            <div class="mt-2 text-sm font-semibold">{formatDateTime(invite.expiresAt)}</div>
          </div>
        </div>

        <div class="bg-base-200/50 space-y-4 rounded-3xl p-4">
          <label class="form-control">
            <div class="label">
              <span class="label-text font-medium">Invite link</span>
            </div>
            <textarea
              class="textarea textarea-bordered min-h-24 font-mono text-sm"
              readonly
              value={invite.inviteUrl ?? 'Invite URL is not available for this response'}
            ></textarea>
          </label>

          <div class="flex justify-end">
            <button
              class="btn btn-outline btn-sm"
              disabled={!invite.inviteUrl}
              on:click={onCopyLink}
            >
              <Icon src={icons.Link} class="h-4 w-4" />
              Copy link
            </button>
          </div>

          <label class="form-control">
            <div class="label">
              <span class="label-text font-medium">Token</span>
            </div>
            <input
              class="input input-bordered w-full font-mono text-sm"
              readonly
              value={invite.token}
            />
          </label>

          <div class="flex justify-end">
            <button class="btn btn-outline btn-sm" on:click={onCopyToken}>
              <Icon src={icons.ClipboardDocument} class="h-4 w-4" />
              Copy token
            </button>
          </div>
        </div>
      </div>

      <div class="modal-action bg-base-100 border-base-200 mt-0 border-t px-6 py-4">
        <button class="btn btn-primary" on:click={onClose}>Close</button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button on:click|preventDefault={onClose}>close</button>
    </form>
  </dialog>
{/if}

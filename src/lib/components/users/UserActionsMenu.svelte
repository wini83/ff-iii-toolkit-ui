<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import type { components } from '$lib/api/schema';

  type UserResponse = components['schemas']['UserResponse'];

  export let user: UserResponse;
  export let disabled = false;
  export let onInvite: (user: UserResponse) => void = () => {};
  export let onDisable: (user: UserResponse) => void = () => {};
  export let onEnable: (user: UserResponse) => void = () => {};
  export let onPromote: (user: UserResponse) => void = () => {};
  export let onDemote: (user: UserResponse) => void = () => {};
  export let onDelete: (user: UserResponse) => void = () => {};
</script>

<div class="dropdown dropdown-end">
  <button class="btn btn-ghost btn-sm" {disabled} aria-label={`Open actions for ${user.username}`}>
    <Icon src={icons.EllipsisHorizontal} class="h-5 w-5" />
  </button>

  <ul
    class="menu dropdown-content bg-base-100 rounded-box border-base-200 z-20 mt-2 w-56 border p-2 shadow-xl"
  >
    <li>
      <button {disabled} on:click={() => onInvite(user)}>
        <Icon src={icons.Envelope} class="h-4 w-4" />
        Generate invite
      </button>
    </li>

    {#if user.is_active}
      <li>
        <button {disabled} on:click={() => onDisable(user)}>
          <Icon src={icons.NoSymbol} class="h-4 w-4" />
          Disable
        </button>
      </li>
    {:else}
      <li>
        <button {disabled} on:click={() => onEnable(user)}>
          <Icon src={icons.CheckCircle} class="h-4 w-4" />
          Enable
        </button>
      </li>
    {/if}

    {#if user.is_superuser}
      <li>
        <button {disabled} on:click={() => onDemote(user)}>
          <Icon src={icons.ArrowDownCircle} class="h-4 w-4" />
          Demote
        </button>
      </li>
    {:else}
      <li>
        <button {disabled} on:click={() => onPromote(user)}>
          <Icon src={icons.ArrowUpCircle} class="h-4 w-4" />
          Promote
        </button>
      </li>
    {/if}

    <li>
      <button class="text-error" {disabled} on:click={() => onDelete(user)}>
        <Icon src={icons.Trash} class="h-4 w-4" />
        Delete
      </button>
    </li>
  </ul>
</div>

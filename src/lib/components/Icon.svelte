<script lang="ts">
  import type { ComponentType } from 'svelte';
  import * as icons from '@steeze-ui/heroicons';

  export let name: keyof typeof icons;
  export let variant: 'outline' | 'solid' = 'outline';
  export let className = '';

  const resolved =
    variant === 'outline'
      ? name
      : `${name}Solid`;

  // TU jest fix → powiedz TS-owi, że to komponent
  const IconComponent = icons[resolved as keyof typeof icons] as unknown as ComponentType;
</script>

{#if IconComponent}
  <svelte:component this={IconComponent} class={className} />
{:else}
  <span class="text-red-600 font-bold">?</span>
{/if}

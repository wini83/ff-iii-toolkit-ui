<script lang="ts">
  type StepItem = {
    label: string;
    href: string;
  };

  export let steps: StepItem[] = [];
  export let activeIndex: number = 0;
</script>

<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <ul class="steps hidden w-1/2 flex-none md:flex">
    {#each steps as step, i (`${step.href}-${i}`)}
      <li class="step {i <= activeIndex ? 'step-primary' : ''}">
        {#if step.href === '#'}
          <span>{step.label}</span>
        {:else}
          <!-- svelte-ignore svelte/no-navigation-without-resolve -->
          <a href={step.href} data-sveltekit-reload={step.href.startsWith('/blik/')}>
            {step.label}
          </a>
        {/if}
      </li>
    {/each}
  </ul>
</div>

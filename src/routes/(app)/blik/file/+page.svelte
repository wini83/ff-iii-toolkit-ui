<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Steps from '$lib/components/Steps.svelte';

  let fileId = '';

  onMount(() => {
    const id = localStorage.getItem('lastFileId');
    if (id) fileId = id; // auto-fill jeśli istnieje
  });

  function goToFile() {
    const trimmed = fileId.trim();
    if (!trimmed) return; // zero jazdy bez trzymanki
    goto(`/blik/file/${trimmed}`);
  }
</script>

<Steps
  activeIndex={1}
  steps={[
    { label: 'Upload', href: '/blik/upload' },
    { label: 'Preview', href: `#` },
    { label: 'Match', href: `#` }
  ]}
/>

<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <div class="inline-block text-xl font-semibold">File Preview</div>

  <div class="divider mt-2"></div>

  <fieldset class="fieldset border-base-300 rounded-box w-xs border p-4">
  <legend class="fieldset-legend">Open file</legend>
  <div class="join">
    <label class="input">
      <span class="label">ID:</span>
      <input type="text" bind:value={fileId} placeholder="Enter ID" />
    </label>
    <button class="btn join-item" on:click={goToFile} disabled={!fileId.trim()}>Go</button>
  </div>
</fieldset>
</div>

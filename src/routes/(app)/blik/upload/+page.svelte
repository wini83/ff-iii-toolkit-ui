<script lang="ts">
  type PageData = {
    file_id?: string;
  };

  import { Icon } from '@steeze-ui/svelte-icon';
    import * as icons from '@steeze-ui/heroicons';
  import Steps from '$lib/components/Steps.svelte';
  import { afterUpdate } from 'svelte';

  export let form;
  let fileName = '';

  afterUpdate(() => {
    if (form?.id) {
      localStorage.setItem('lastFileId', form.id);
      setTimeout(() => {
        window.location.href = `/blik/file/${form.id}`;
      }, 3000);
    }
  });



</script>

<Steps
  activeIndex={0}
  steps={[
    { label: 'Upload', href: '/blik/upload' },
    { label: 'Preview', href: `#` },
    { label: 'Match', href: `#` }
  ]}
/>

<div class="card bg-base-100 mt-2 w-full shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Wyślij plik Alior BLIK (.csv)</h2>

    <form method="post" enctype="multipart/form-data" class="space-y-4">
      <!-- File picker -->
      <div class="form-control">
        <legend class="fieldset-legend">
          <span class="label-text font-semibold">Plik CSV</span>
        </legend>

        <input
          type="file"
          name="file"
          class="file-input file-input-bordered w-full"
          on:change={(e) => {
            const input = e.target as HTMLInputElement | null;
            fileName = input?.files?.[0]?.name ?? '';
          }}
        />

        <label class="label" for="file">Max size 2MB</label>

        {#if fileName}
          <div role="alert" class="alert alert-info">
            <Icon src={icons.InformationCircle} class="w-6 h-6" />
            <span><b>Wybrano: </b> <i>{fileName}</i></span>
          </div>
        {/if}
      </div>

      <!-- Submit button -->
      <button type="submit" class="btn btn-primary w-full" disabled={!fileName}>
        Wyślij plik
      </button>
    </form>

    <!-- Error -->
    {#if form?.error}
      <div class="alert alert-error mt-4">
        <Icon src={icons.ExclamationTriangle} class="w-6 h-6" />
        <span>{form.error}</span>
      </div>
    {/if}

    <!-- Success -->
    {#if form?.id}
      <div class="alert alert-success mt-4">
        <Icon src={icons.CheckCircle} class="w-6 h-6" />
        <span>
          <strong>{form.message}</strong> <br />
          <strong>File ID: </strong>{form.id}
          <br />
          Przekierowanie…
        </span>
      </div>
    {/if}
  </div>
</div>

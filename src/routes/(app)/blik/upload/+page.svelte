<script lang="ts">
  import { goto } from '$app/navigation';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import Steps from '$lib/components/Steps.svelte';
  import { blik } from '$lib/api/blik';

  let file: File | null = null;
  let fileName = '';
  let error = '';
  async function upload(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await blik.uploadCsv(formData);

      if (!data?.id) {
        throw new Error('Nieprawidłowa odpowiedź backendu');
      }

      await goto(`/blik/file/${data.id}`);
    } catch (e: unknown) {
      console.error('UPLOAD ERROR', e);
      error = e instanceof Error ? e.message : 'Błąd podczas uploadu';
    }
  }
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

    <form on:submit={upload} enctype="multipart/form-data" class="space-y-4">
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
            file = input?.files?.[0] ?? null;
            fileName = file?.name ?? '';
          }}
        />

        <label class="label" for="file">Max size 2MB</label>

        {#if fileName}
          <div role="alert" class="alert alert-info">
            <Icon src={icons.InformationCircle} class="h-6 w-6" />
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
    {#if error}
      <div class="alert alert-error mt-4">
        <Icon src={icons.ExclamationTriangle} class="h-6 w-6" />
        <span>{error}</span>
      </div>
    {/if}

    <!-- Success -->
    <!-- {#if form?.id}
      <div class="alert alert-success mt-4">
        <Icon src={icons.CheckCircle} class="h-6 w-6" />
        <span>
          <strong>{form.message}</strong> <br />
          <strong>File ID: </strong>{form.id}
          <br />
          Przekierowanie…
        </span>
      </div>
    {/if} -->
  </div>
</div>

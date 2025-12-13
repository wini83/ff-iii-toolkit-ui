<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import Steps from '$lib/components/Steps.svelte';

  let file: File | null = null;
  let fileName = '';
  let error = '';
  let loading = false;

  async function upload(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    if (!file) return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      error = 'Brak autoryzacji — zaloguj się ponownie.';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    loading = true;

    try {
      const res = await fetch('/api/blik_files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }

      const data = await res.json();

      if (!data?.id) {
        throw new Error('Nieprawidłowa odpowiedź backendu');
      }

      // opcjonalnie — zapamiętanie ostatniego pliku
      localStorage.setItem('lastFileId', data.id);

      // redirect do preview
      window.location.href = `/blik/file/${data.id}`;
    } catch (e: any) {
      console.error('UPLOAD ERROR', e);
      error = e.message ?? 'Błąd podczas uploadu';
    } finally {
      loading = false;
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
            file = input?.files?.[0] ?? null; // ← BRAKOWAŁO
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

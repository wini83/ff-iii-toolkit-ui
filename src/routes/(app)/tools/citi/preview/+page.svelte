<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import CitiPreviewPanel from '$lib/components/citi/CitiPreviewPanel.svelte';
  import { citi } from '$lib/api/citi';
  import type { PageData } from './$types';
  import type { components } from '$lib/api/schema';

  export let data: PageData;

  type CitiImportParseResponse = components['schemas']['CitiImportParseResponse'];

  let fileIdInput = data.initialFileId;
  let loadingPreview = false;
  let exporting = false;
  let error = data.initialError;
  let result: CitiImportParseResponse | null = data.initialPreview;

  $: currentFileId = result?.file_id ?? fileIdInput;

  function emitToast(type: 'success' | 'error' | 'info' | 'warning', msg: string) {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type, msg } }));
  }

  async function syncUrl(fileId: string) {
    const next = new URL($page.url);
    next.searchParams.set('file_id', fileId);
    await goto(`${next.pathname}?${next.searchParams.toString()}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  }

  async function loadByFileId() {
    const fileId = fileIdInput.trim();

    if (!fileId) {
      error = 'Enter a valid file_id.';
      return;
    }

    loadingPreview = true;
    error = '';

    try {
      result = await citi.getFile(fileId);
      fileIdInput = fileId;
      await syncUrl(fileId);
      emitToast('success', 'Saved Citi preview loaded.');
    } catch (loadError: unknown) {
      result = null;
      error =
        loadError instanceof Error && loadError.message.trim()
          ? loadError.message
          : 'No file found for the provided file_id.';
      emitToast('error', error);
    } finally {
      loadingPreview = false;
    }
  }

  async function downloadZip() {
    if (!currentFileId) return;

    exporting = true;

    try {
      const { blob, filename } = await citi.exportCsvZip(currentFileId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      emitToast('success', 'ZIP export downloaded.');
    } catch (exportError: unknown) {
      const message =
        exportError instanceof Error && exportError.message.trim()
          ? exportError.message
          : 'Failed to download the ZIP export.';
      error = message;
      emitToast('error', message);
    } finally {
      exporting = false;
    }
  }
</script>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div
      class="from-base-100 via-base-100 to-secondary/8 grid gap-5 bg-gradient-to-br px-6 py-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8"
    >
      <div class="flex items-start gap-4">
        <div class="bg-secondary/12 text-secondary rounded-3xl p-4">
          <Icon src={icons.DocumentMagnifyingGlass} class="h-8 w-8" />
        </div>

        <div class="space-y-2">
          <div
            class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase"
          >
            <span class="bg-secondary h-2 w-2 rounded-full"></span>
            Preview
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Citi Preview & Export</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Open a saved result by `file_id`, inspect parsed records, and export the generated ZIP
              package.
            </p>
          </div>
        </div>
      </div>

      <div
        class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1"
      >
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Navigation</div>
          <p class="mt-2 text-sm">
            Import runs in a separate flow. After a successful parse, this page becomes the review
            and export workspace for that `file_id`.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <a href="/tools/citi" class="btn btn-outline btn-sm">
            <Icon src={icons.DocumentArrowUp} class="h-4 w-4" />
            Back to import
          </a>
        </div>
      </div>
    </div>
  </section>

  {#if error}
    <div role="alert" class="alert alert-error">
      <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
      <span>{error}</span>
    </div>
  {/if}

  <CitiPreviewPanel
    bind:fileIdInput
    {result}
    loading={loadingPreview}
    {exporting}
    {currentFileId}
    onOpenByFileId={loadByFileId}
    onExport={downloadZip}
  />
</div>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';
  import { citi } from '$lib/api/citi';
  import type { components } from '$lib/api/schema';

  type CitiImportParseResponse = components['schemas']['CitiImportParseResponse'];
  type ImportMode = 'file' | 'text';

  let activeMode: ImportMode = 'file';

  let selectedFile: File | null = null;
  let selectedFileName = '';
  let fileIncludePositive = false;
  let fileChunkSize = 60;
  let fileSubmitting = false;
  let fileError = '';

  let rawText = '';
  let textIncludePositive = false;
  let textChunkSize = 60;
  let textSubmitting = false;
  let textError = '';

  $: isSubmitting = fileSubmitting || textSubmitting;
  $: activeIncludePositive = activeMode === 'file' ? fileIncludePositive : textIncludePositive;
  $: activeChunkSize = activeMode === 'file' ? fileChunkSize : textChunkSize;
  $: activeError = activeMode === 'file' ? fileError : textError;
  $: activePrimaryLabel = activeMode === 'file' ? 'Parse from file' : 'Parse from text';
  $: activeDescription =
    activeMode === 'file'
      ? 'Upload a `.txt` export from Citi and send it directly to the parser.'
      : 'Paste raw Citi text when you want to test or troubleshoot parsing without a file.';

  function emitToast(type: 'success' | 'error' | 'info' | 'warning', msg: string) {
    window.dispatchEvent(new CustomEvent('toast', { detail: { type, msg } }));
  }

  function validateChunkSize(value: number) {
    return Number.isInteger(value) && value >= 20 && value <= 100 && value % 20 === 0;
  }

  function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement | null;
    selectedFile = input?.files?.[0] ?? null;
    selectedFileName = selectedFile?.name ?? '';
    fileError = '';
  }

  function setChunkSize(value: number) {
    if (activeMode === 'file') {
      fileChunkSize = value;
    } else {
      textChunkSize = value;
    }
  }

  function setIncludePositive(value: boolean) {
    if (activeMode === 'file') {
      fileIncludePositive = value;
    } else {
      textIncludePositive = value;
    }
  }

  async function goToPreview(result: CitiImportParseResponse) {
    await goto(`/tools/citi/preview?file_id=${encodeURIComponent(result.file_id)}`);
  }

  async function parseFile() {
    fileError = '';
    textError = '';

    if (!selectedFile) {
      fileError = 'Select a TXT file to parse.';
      return;
    }

    if (!validateChunkSize(fileChunkSize)) {
      fileError = 'Chunk size must be one of: 20, 40, 60, 80, or 100.';
      return;
    }

    fileSubmitting = true;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const result = await citi.uploadTextFile(formData, {
        include_positive: fileIncludePositive,
        chunk_size: fileChunkSize
      });

      emitToast(
        result.record_count > 0 ? 'success' : 'info',
        result.record_count > 0
          ? `Parsing complete. Loaded ${result.record_count} records.`
          : 'Parsing complete, but no records were found.'
      );

      await goToPreview(result);
    } catch (error: unknown) {
      fileError =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to process the Citi file.';
      emitToast('error', fileError);
    } finally {
      fileSubmitting = false;
    }
  }

  async function parseText() {
    textError = '';
    fileError = '';

    const normalizedText = rawText.trim();

    if (!normalizedText) {
      textError = 'Paste text to parse.';
      return;
    }

    if (!validateChunkSize(textChunkSize)) {
      textError = 'Chunk size must be one of: 20, 40, 60, 80, or 100.';
      return;
    }

    textSubmitting = true;

    try {
      const result = await citi.parseRawText({
        text: normalizedText,
        include_positive: textIncludePositive,
        chunk_size: textChunkSize
      });

      emitToast(
        result.record_count > 0 ? 'success' : 'info',
        result.record_count > 0
          ? `Parsing complete. Loaded ${result.record_count} records.`
          : 'Parsing complete, but no records were found.'
      );

      await goToPreview(result);
    } catch (error: unknown) {
      textError =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to process the Citi text.';
      emitToast('error', textError);
    } finally {
      textSubmitting = false;
    }
  }

  function handleSubmit() {
    if (activeMode === 'file') {
      void parseFile();
    } else {
      void parseText();
    }
  }
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
  <section class="card bg-base-100 border-base-200 overflow-hidden border shadow-xl">
    <div class="from-base-100 via-base-100 to-secondary/8 flex flex-col gap-5 bg-gradient-to-br px-6 py-6 lg:px-8">
      <div class="flex items-start gap-4">
        <div class="bg-secondary/12 text-secondary rounded-3xl p-4">
          <Icon src={icons.DocumentArrowUp} class="h-8 w-8" />
        </div>
        <div class="space-y-2">
          <div class="bg-base-200/80 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium tracking-[0.24em] uppercase">
            <span class="bg-secondary h-2 w-2 rounded-full"></span>
            Import workspace
          </div>
          <div>
            <h2 class="text-3xl font-semibold tracking-tight">Citi Import</h2>
            <p class="text-base-content/70 mt-2 max-w-2xl text-sm sm:text-base">
              Start with a TXT file or raw Citi text. After parsing, the app opens a dedicated preview workspace for review and export.
            </p>
          </div>
        </div>
      </div>

      <div class="bg-base-100/80 ring-base-200 flex flex-col justify-between gap-4 rounded-3xl p-5 shadow-sm ring-1">
        <div>
          <div class="text-base-content/60 text-xs tracking-[0.2em] uppercase">Flow</div>
          <div class="mt-3 space-y-3 text-sm">
            <div class="flex items-start gap-3">
              <span class="badge badge-outline badge-sm mt-0.5">1</span>
              <span>Choose the input mode that matches your source.</span>
            </div>
            <div class="flex items-start gap-3">
              <span class="badge badge-outline badge-sm mt-0.5">2</span>
              <span>Adjust parsing options only if you need custom behavior.</span>
            </div>
            <div class="flex items-start gap-3">
              <span class="badge badge-outline badge-sm mt-0.5">3</span>
              <span>Run parsing and continue in the preview workspace.</span>
            </div>
          </div>
        </div>

        <a href="/tools/citi/preview" class="btn btn-outline btn-sm self-start">
          <Icon src={icons.DocumentMagnifyingGlass} class="h-4 w-4" />
          Open preview directly
        </a>
      </div>
    </div>
  </section>

  <section class="flex flex-col gap-6">
    <article class="card bg-base-100 border-base-200 border shadow-xl">
      <div class="card-body gap-6">
        <div class="space-y-2">
          <h3 class="card-title">Input Source</h3>
          <p class="text-base-content/70 text-sm">
            Switch between file upload and raw text parsing without leaving the page.
          </p>
        </div>

        <div role="tablist" class="tabs tabs-boxed bg-base-200 w-fit p-1">
          <button
            role="tab"
            class={`tab px-5 ${activeMode === 'file' ? 'tab-active' : ''}`}
            on:click={() => (activeMode = 'file')}
            aria-selected={activeMode === 'file'}
          >
            <Icon src={icons.DocumentArrowUp} class="h-4 w-4" />
            File upload
          </button>
          <button
            role="tab"
            class={`tab px-5 ${activeMode === 'text' ? 'tab-active' : ''}`}
            on:click={() => (activeMode = 'text')}
            aria-selected={activeMode === 'text'}
          >
            <Icon src={icons.DocumentText} class="h-4 w-4" />
            Raw text
          </button>
        </div>

        <div class="bg-base-200/40 rounded-[1.75rem] p-5">
          <div class="mb-4">
            <h4 class="text-lg font-semibold">{activeMode === 'file' ? 'Upload TXT file' : 'Paste raw Citi text'}</h4>
            <p class="text-base-content/70 mt-1 text-sm">{activeDescription}</p>
          </div>

          {#if activeMode === 'file'}
            <div class="space-y-4">
              <div class="form-control">
                <label class="label" for="citi-file">
                  <span class="label-text font-semibold">TXT file</span>
                </label>
                <input
                  id="citi-file"
                  type="file"
                  accept=".txt,text/plain"
                  class="file-input file-input-bordered w-full"
                  on:change={handleFileChange}
                />
              </div>

              {#if selectedFileName}
                <div role="alert" class="alert alert-info">
                  <Icon src={icons.InformationCircle} class="h-5 w-5" />
                  <span>Selected file: <span class="font-medium">{selectedFileName}</span></span>
                </div>
              {:else}
                <div class="border-base-300 text-base-content/65 rounded-2xl border border-dashed px-4 py-6 text-sm">
                  No file selected yet. Use a Citi TXT export as the parser input.
                </div>
              {/if}
            </div>
          {:else}
            <div class="space-y-4">
              <div class="form-control">
                <label class="label" for="citi-text">
                  <span class="label-text font-semibold">Raw text</span>
                </label>
                <textarea
                  id="citi-text"
                  bind:value={rawText}
                  rows="13"
                  class="textarea textarea-bordered min-h-64 w-full"
                  placeholder="Paste raw Citi text here..."
                ></textarea>
              </div>

              <div class="text-base-content/60 text-sm">
                Best for debugging parser behavior or testing input before saving a file.
              </div>
            </div>
          {/if}
        </div>

        {#if activeError}
          <div role="alert" class="alert alert-error">
            <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
            <span>{activeError}</span>
          </div>
        {/if}
      </div>
    </article>

    <aside class="card bg-base-100 border-base-200 border shadow-xl">
      <div class="card-body gap-5">
        <div>
          <h3 class="card-title">Parse Settings</h3>
          <p class="text-base-content/70 text-sm">
            These options apply to the currently selected input mode.
          </p>
        </div>

        <label
          class={`border-base-300 flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 ${
            activeIncludePositive ? 'bg-secondary/8 border-secondary/30' : 'bg-base-100'
          }`}
        >
          <div>
            <div class="font-medium">Include positive transactions</div>
            <div class="text-base-content/65 text-sm">
              Enable this only when inbound or positive rows should be included in the parsed result.
            </div>
          </div>
          <input
            type="checkbox"
            class="toggle toggle-secondary"
            checked={activeIncludePositive}
            on:change={(event) => setIncludePositive((event.currentTarget as HTMLInputElement).checked)}
            aria-label="Toggle positive transactions"
          />
        </label>

        <div class="w-full max-w-md">
          <div class="mb-2 flex items-center justify-between gap-3">
            <span class="text-sm font-semibold">Chunk size</span>
            <span class="badge badge-outline">{activeChunkSize}</span>
          </div>
          <input
            type="range"
            min="20"
            max="100"
            step="20"
            class="range range-secondary"
            value={activeChunkSize}
            on:input={(event) => setChunkSize(Number((event.currentTarget as HTMLInputElement).value))}
          />
        </div>

        <div class="bg-base-200/45 rounded-2xl p-4">
          <div class="text-base-content/60 text-xs font-medium tracking-[0.24em] uppercase">
            Current mode
          </div>
          <div class="mt-2 text-sm font-medium">{activeMode === 'file' ? 'File upload' : 'Raw text'}</div>
          <p class="text-base-content/70 mt-2 text-sm">
            {activeMode === 'file'
              ? 'Use this for the standard import flow from a local TXT file.'
              : 'Use this when you want fast parser iteration from copied text.'}
          </p>
        </div>

        <button type="button" class="btn btn-primary w-full" on:click={handleSubmit} disabled={isSubmitting}>
          {#if isSubmitting}
            <span class="loading loading-spinner loading-sm"></span>
            Parsing...
          {:else}
            <Icon src={icons.PlayCircle} class="h-5 w-5" />
            {activePrimaryLabel}
          {/if}
        </button>

        <p class="text-base-content/60 text-xs leading-relaxed">
          After a successful parse, the app redirects to the preview page with the generated `file_id`.
        </p>
      </div>
    </aside>
  </section>
</div>

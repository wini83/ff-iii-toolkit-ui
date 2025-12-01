<script lang="ts">
  export let form; // dane zwrócone z server action
  let fileName = "";
</script>

<div class="card w-full p-6 bg-base-100 shadow-xl mt-2">
  <div class="text-xl font-semibold mb-4">Wyślij plik ALior BLIK .csv</div>

  <form
    method="post"
    enctype="multipart/form-data"
    class="space-y-4 border border-gray-300 rounded-xl p-6 bg-white shadow-sm"
  >
    <label
      class="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-400 rounded-lg cursor-pointer hover:border-blue-500 transition"
    >
      <input
        type="file"
        name="file"
        class="hidden"
        on:change={(e) => fileName = e.target.files?.[0]?.name ?? ""}
      />

      {#if fileName}
        <p class="font-semibold text-gray-700">{fileName}</p>
      {:else}
        <div class="text-center pointer-events-none">
          <svg class="w-10 h-10 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l-4-4m4 4l4-4" />
          </svg>
          <p class="text-gray-600">Przeciągnij lub kliknij, aby wybrać plik</p>
        </div>
      {/if}
    </label>

    <button
      type="submit"
      class="w-full bg-blue-600 text-white font-medium px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      disabled={!fileName}
    >
      Wyślij
    </button>
  </form>

  {#if form?.error}
    <p class="text-red-600 bg-red-100 p-3 rounded-lg border border-red-300">
      ⚠️ {form.error}
    </p>
  {/if}

  {#if form?.id}
    <p class="text-green-600 bg-green-100 p-3 rounded-lg border border-green-300">
      {form.message} — znaleziono {form.count} rekordów.
      <br />
      Identyfikator pliku: <strong>{form.id}</strong><br>
      Przekierowanie…
    </p>

    <script>
      // Po udanym uploadzie przekierowujemy użytkownika
      setTimeout(() => {
        window.location.href = `/blik/file/${form.id}`;
      }, 800);
    </script>
  {/if}
</div>

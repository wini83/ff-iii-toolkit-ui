<script lang="ts">
  export let data;

  const { file_id, decoded_name, size, content, error } = data;

  function goToMatch() {
    // przejdź do widoku match
    window.location.href = `/blik/match/${file_id}`;
  }

  function formatAmount(v: number) {
    if (v == null) return "";
    return Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
</script>

<div class="max-w-6xl mx-auto py-10 space-y-6">
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-bold">Podgląd pliku</h1>
      <p class="text-sm text-gray-600">Nazwa: <span class="font-medium">{decoded_name || file_id}</span></p>
      <p class="text-sm text-gray-500">Rozmiar: {size} bajtów</p>
    </div>

    <div class="flex gap-3">
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        on:click={goToMatch}
        disabled={!file_id}
      >
        Dopasuj transakcje
      </button>

      <a href="/blik/upload" class="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Wróć</a>
    </div>
  </div>

  {#if error}
    <div class="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
      ⚠️ {error}
    </div>
  {/if}

  {#if content?.length === 0}
    <div class="p-6 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
      Brak rekordów w przesłanym pliku.
    </div>
  {:else}
    <div class="shadow rounded-lg overflow-auto border">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Data</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Kwota</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Operacja (kwota)</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Waluta</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Nadawca</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Odbiorca</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Szczegóły</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Nr konta nadawcy</th>
            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Nr konta odbiorcy</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-100">
          {#each content as row, i}
            <tr class="hover:bg-gray-50">
              <td class="px-3 py-2 text-sm text-gray-800">{row.date}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{formatAmount(row.amount)}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{formatAmount(row.operation_amount)}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{row.operation_currency ?? row.account_currency}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{row.sender || "-"}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{row.recipient || "-"}</td>
              <td class="px-3 py-2 text-sm text-gray-800 break-words max-w-xs">{row.details || "-"}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{row.sender_account || "-"}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{row.recipient_account || "-"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="flex justify-end pt-4">
      <button
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        on:click={goToMatch}
      >
        Dopasuj transakcje ({content.length})
      </button>
    </div>
  {/if}
</div>

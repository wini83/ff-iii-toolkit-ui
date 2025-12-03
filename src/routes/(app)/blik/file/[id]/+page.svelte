<script lang="ts">
  export let data;

  const { file_id, decoded_name, size, content, error } = data;

  function goToMatch() {
    // przejdź do widoku match
    window.location.href = `/blik/file/${file_id}/match`;
  }

  function formatAmount(v: number) {
    if (v == null) return '';
    return Number(v).toLocaleString('pl-PL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
</script>

<!-- STEPS -->
<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <ul class="steps hidden w-1/2 flex-none md:flex">
    <li class="step step-primary"><a href="/blik/upload">Upload</a></li>
    <li class="step step-primary"><a href="/blik/file/{file_id}">File Preview</a></li>
    <li class="step"><a href="/blik/file/{file_id}/match">Match</a></li>
    <li class="step">Update</li>
  </ul>
</div>

<!-- TABLE -->

<div class="card bg-base-100 mt-2 w-full p-6 shadow-xl">
  <div class="inline-block text-xl font-semibold">
    Transactions in file {file_id}
    <span class="badge badge-info">{size} records</span>
    <div class="float-right inline-block">
      <div class="float-right inline-block">
        <div class="mr-4 inline-block">
          <div class="input-group relative flex w-full flex-wrap items-stretch">
            <input
              type="search"
              placeholder="Search"
              class="input input-sm input-bordered w-full max-w-xs"
              value=""
            />
          </div>
        </div>
        <button class="btn btn-sm btn-primary" on:click={goToMatch}
          >Match Transactions ({content.length})</button
        >
      </div>
    </div>
  </div>

  <div class="divider mt-2"></div>

  {#if error}
    <div class="rounded border border-red-200 bg-red-50 p-4 text-red-700">
      ⚠️ {error}
    </div>
  {/if}

  {#if content?.length === 0}
    <div class="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
      Brak rekordów w przesłanym pliku.
    </div>
  {:else}
    <div class="bg-base-100 h-full w-full pb-6">
      <div class="w-full overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th class="whitespace-nowrap">Date</th>
              <th  class="whitespace-nowrap">Amount</th>
              <th>Nadawca</th>
              <th>Odbiorca</th>
              <th>Szczegóły</th>
            </tr>
          </thead>
          <tbody>
            {#each content as row, i}
              <tr>
                <td  class="whitespace-nowrap">{row.date}</td>
                <td class="whitespace-nowrap">{formatAmount(row.amount)} {row.account_currency}<br>
                <span class="italic">{formatAmount(row.operation_amount)} {row.operation_currency}</span></td>
                <td class="whitespace-nowrap">{row.sender || '-'} <br>
                <span class="italic">{row.sender_account || '-'}</span></td>
                <td class="whitespace-nowrap">{row.recipient || '-'}<br>
                <span class="italic">{row.recipient_account || '-'}</span></td>
                <td>{row.details || '-'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex justify-end pt-4">
      <button class="btn btn-primary" on:click={goToMatch}>
        Match Transactions ({content.length})
      </button>
    </div>
  {/if}
</div>

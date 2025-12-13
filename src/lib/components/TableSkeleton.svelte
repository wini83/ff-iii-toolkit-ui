<script lang="ts">
  export let rows: number = 5;
  export let cols: number = 4;

  // opcjonalnie: kontrola szerokości kolumn (UX++ dla tabel finansowych)
  export let colWidths: string[] | null = null;

  const getWidth = (i: number) =>
    colWidths?.[i] ?? ['w-16', 'w-32', 'w-24', 'w-20'][i % 4];
</script>

<div class="overflow-x-auto rounded-box border border-base-300">
  <table class="table w-full">
    <thead>
      <tr>
        {#each Array(cols) as _, i}
          <th>
            <div class={`skeleton h-4 ${getWidth(i)}`}></div>
          </th>
        {/each}
      </tr>
    </thead>

    <tbody>
      {#each Array(rows) as _}
        <tr>
          {#each Array(cols) as _, i}
            <td>
              <div class={`skeleton h-4 ${getWidth(i)}`}></div>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

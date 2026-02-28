<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  export let onCloseMobile: () => void = () => {};
</script>

<!-- SIDEBAR -->
<div class="drawer-side z-30">
  <label for="app-drawer" class="drawer-overlay !z-0"></label>

  <ul class="menu bg-base-100 text-base-content min-h-full w-80 p-4">
    <li class="mb-2 text-xl font-semibold">
      <button
        class="btn btn-ghost btn-circle absolute top-2 right-2 lg:hidden"
        on:click={onCloseMobile}
      >
        ✕
      </button>
      <a href="/"
        ><img class="mask mask-squircle w-10" src="/logo_b.png" alt="Firefly Toolkit" />Firefly
        Toolkit</a
      >
    </li>

    <li>
      <details open>
        <summary class="flex cursor-pointer items-center gap-2">
          <Icon src={icons.ShoppingBag} class="h-5 w-5" />
          Transactions
        </summary>

        <ul>
          <li>
            <a href="/tx/categorize">
              <Icon src={icons.DocumentMagnifyingGlass} class="h-5 w-5" />
              Categorize
            </a>
          </li>
          <li>
            <a href="/tx/stats">
              <Icon src={icons.ChartBar} class="h-5 w-5" />
              Stats
            </a>
          </li>
        </ul>
      </details>
    </li>

    <li>
      <details open>
        <summary class="flex cursor-pointer items-center gap-2">
          <!-- icon -->
          <Icon src={icons.DocumentCurrencyEuro} class="h-5 w-5" />
          BLIK Sync
        </summary>

        <ul>
          <li>
            <a href="/blik/upload">
              <!-- icon -->
              <Icon src={icons.InboxArrowDown} class="h-5 w-5" />
              File Upload
            </a>
          </li>

          <li>
            <a href="/blik/file">
              <!-- icon -->
              <Icon src={icons.DocumentCurrencyEuro} class="h-5 w-5" />
              File Preview
            </a>
          </li>
          <li>
            <a href="/blik/file">
              <!-- icon -->
              <Icon src={icons.Bolt} class="h-5 w-5" />
              Match & Update
            </a>
          </li>
          <li>
            <a href="/blik/stats">
              <!-- icon -->
              <Icon src={icons.ChartPie} class="h-5 w-5" />
              Stats
            </a>
          </li>
        </ul>
      </details>
    </li>

    <li>
      <details open>
        <summary class="flex cursor-pointer items-center gap-2">
          <Icon src={icons.BuildingStorefront} class="h-5 w-5" />
          Allegro
        </summary>

        <ul>
          <li>
            <a href="/allegro/stats">
              <Icon src={icons.ChartBar} class="h-5 w-5" />
              Stats
            </a>
          </li>
        </ul>
      </details>
    </li>
  </ul>
</div>

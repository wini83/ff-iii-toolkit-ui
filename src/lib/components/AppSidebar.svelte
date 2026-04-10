<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  export let onCloseMobile: () => void = () => {};
  export let isSuperuser = false;
</script>

<!-- SIDEBAR -->
<div class="drawer-side z-30">
  <label for="app-drawer" class="drawer-overlay !z-0"></label>

  <aside
    class="from-base-100 via-base-100 to-primary/8 text-base-content min-h-full w-80 bg-gradient-to-b"
  >
    <div class="flex h-full flex-col p-4">
      <div
        class="from-primary/10 via-base-100 to-base-100 relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-4"
      >
        <button
          class="btn btn-ghost btn-circle absolute top-3 right-3 lg:hidden"
          on:click={onCloseMobile}
        >
          ✕
        </button>

        <a href="/" class="flex items-center gap-3">
          <img class="mask mask-squircle w-12" src="/logo_b.png" alt="Firefly Toolkit" />
          <div>
            <!-- <div class="text-base-content/55 text-[11px] tracking-[0.22em] uppercase">Workspace</div> -->
            <div class="text-xl font-semibold tracking-tight">Firefly Toolkit</div>
          </div>
        </a>
      </div>

      <ul class="menu mt-4 flex-1 gap-3 p-0">
        <li>
          <details open class="bg-base-100/70 rounded-[1.5rem] p-2">
            <summary
              class="hover:bg-base-200/80 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 font-medium"
            >
              <span class="bg-primary/12 text-primary rounded-2xl p-2">
                <Icon src={icons.ShoppingBag} class="h-5 w-5" />
              </span>
              Transactions
            </summary>

            <ul class="mt-2 space-y-1">
              <li>
                <a href="/tx/categorize" class="rounded-xl">
                  <Icon src={icons.DocumentMagnifyingGlass} class="h-5 w-5" />
                  Categorize
                </a>
              </li>
              <li>
                <a href="/tx/stats" class="rounded-xl">
                  <Icon src={icons.ChartBar} class="h-5 w-5" />
                  Stats
                </a>
              </li>
            </ul>
          </details>
        </li>

        <li>
          <details open class="bg-base-100/70 rounded-[1.5rem] p-2">
            <summary
              class="hover:bg-base-200/80 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 font-medium"
            >
              <span class="bg-accent/15 text-accent rounded-2xl p-2">
                <Icon src={icons.ArchiveBoxArrowDown} class="h-5 w-5" />
              </span>
              Import Tools
            </summary>

            <ul class="mt-2 space-y-1">
              <li>
                <a href="/tools/citi" class="rounded-xl">
                  <Icon src={icons.DocumentArrowUp} class="h-5 w-5" />
                  Citi Import
                </a>
              </li>
              <li>
                <a href="/tools/citi/preview" class="rounded-xl">
                  <Icon src={icons.DocumentMagnifyingGlass} class="h-5 w-5" />
                  Citi Preview
                </a>
              </li>
            </ul>
          </details>
        </li>

        <li>
          <details open class="bg-base-100/70 rounded-[1.5rem] p-2">
            <summary
              class="hover:bg-base-200/80 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 font-medium"
            >
              <span class="bg-secondary/12 text-secondary rounded-2xl p-2">
                <Icon src={icons.DocumentCurrencyEuro} class="h-5 w-5" />
              </span>
              BLIK Sync
            </summary>

            <ul class="mt-2 space-y-1">
              <li>
                <a href="/blik/upload" class="rounded-xl">
                  <Icon src={icons.InboxArrowDown} class="h-5 w-5" />
                  File Upload
                </a>
              </li>
              <li>
                <a href="/blik/file" class="rounded-xl">
                  <Icon src={icons.DocumentCurrencyEuro} class="h-5 w-5" />
                  File Preview
                </a>
              </li>
              <li>
                <a href="/blik/file" class="rounded-xl">
                  <Icon src={icons.Bolt} class="h-5 w-5" />
                  Match & Update
                </a>
              </li>
              <li>
                <a href="/blik/stats" class="rounded-xl">
                  <Icon src={icons.ChartPie} class="h-5 w-5" />
                  Stats
                </a>
              </li>
            </ul>
          </details>
        </li>

        <li>
          <details open class="bg-base-100/70 rounded-[1.5rem] p-2">
            <summary
              class="hover:bg-base-200/80 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 font-medium"
            >
              <span class="bg-warning/15 text-warning rounded-2xl p-2">
                <Icon src={icons.BuildingStorefront} class="h-5 w-5" />
              </span>
              Allegro
            </summary>

            <ul class="mt-2 space-y-1">
              <li>
                <a href="/allegro/accounts" class="rounded-xl">
                  <Icon src={icons.Key} class="h-5 w-5" />
                  Accounts
                </a>
              </li>
              <li>
                <a href="/allegro/stats" class="rounded-xl">
                  <Icon src={icons.ChartBar} class="h-5 w-5" />
                  Stats
                </a>
              </li>
            </ul>
          </details>
        </li>

        {#if isSuperuser}
          <li>
            <details open class="bg-base-100/70 rounded-[1.5rem] p-2">
              <summary
                class="hover:bg-base-200/80 flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 font-medium"
              >
                <span class="bg-success/15 text-success rounded-2xl p-2">
                  <Icon src={icons.ShieldCheck} class="h-5 w-5" />
                </span>
                Administration
              </summary>

              <ul class="mt-2 space-y-1">
                <li>
                  <a href="/users" class="rounded-xl">
                    <Icon src={icons.Users} class="h-5 w-5" />
                    Users
                  </a>
                </li>
                <li>
                  <a href="/audit-log" class="rounded-xl">
                    <Icon src={icons.ClipboardDocumentList} class="h-5 w-5" />
                    Audit log
                  </a>
                </li>
              </ul>
            </details>
          </li>
        {/if}
      </ul>
    </div>
  </aside>
</div>

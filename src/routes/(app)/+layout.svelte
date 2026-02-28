<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  // prosty state dla drawer
  let drawerOpen = false;

  // toasty trzymamy jako prosta tablica
  type Toast = { id: string; type: 'success' | 'error' | 'info' | 'warning'; msg: string };
  let toasts: Toast[] = [];

  const toastIcons = {
    success: icons.CheckCircle,
    error: icons.XCircle,
    info: icons.InformationCircle,
    warning: icons.ExclamationTriangle
  } as const;

  // przepisujemy token z localStorage → cookie (only browser)
  if (browser) {
    const token = localStorage.getItem('access_token');

    if (token && !document.cookie.includes('access_token_client=')) {
      document.cookie = `access_token_client=${token}; Path=/;`;
    }
  }

  function toggle() {
    drawerOpen = !drawerOpen;
  }

  function logout() {
    document.cookie = 'access_token_client=; Path=/; Max-Age=0';
    localStorage.removeItem('access_token');
    // używamy location.href bo chcemy pełne przeładowanie
    window.location.href = '/login';
  }

  function onToastEvent(e: Event) {
    // safety: event może nie być CustomEvent (guard)
    const ev = e as CustomEvent | undefined;
    const detail = ev?.detail ?? {};
    const { type, msg } = detail;
    if (!type || !msg) {
      // nieprawidłowy event — ignorujemy ale logujemy
      console.warn('Ignored toast event (missing detail):', ev);
      return;
    }

    const id = crypto?.randomUUID?.() ?? String(Date.now());
    toasts = [...toasts, { id, type, msg }];

    // debug
    console.debug('Toast added', { id, type, msg });

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 3000);
  }

  // rejestracja tylko w browser (onMount też działa tylko w browser, ale double-safety)
  onMount(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('toast', onToastEvent as EventListener);
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('toast', onToastEvent as EventListener);
  });
</script>

<div class="drawer lg:drawer-open bg-base-200 text-base-content min-h-screen">
  <input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

  <!-- CONTENT -->
  <div class="drawer-content flex flex-col">
    <!-- NAVBAR -->
    <div class="navbar bg-base-100 sticky top-0 z-10 shadow-md shadow-none lg:shadow-md">
      <div class="flex-none lg:hidden">
        <label for="app-drawer" class="btn btn-ghost drawer-button px-2">
          <Icon src={icons.Bars3} class="h-6 w-6" />
          <!-- <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg> -->
        </label>
      </div>

      <div class="flex-1">
        <h1 class="text-2xl font-bold">BLIK Sync</h1>
      </div>

      <div class="flex-none">
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-circle avatar">
            <div class="w-10 rounded-full">
              <img
                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                alt="avatar"
              />
            </div>
          </button>
          <ul class="menu menu-sm dropdown-content bg-base-100 rounded-box mt-3 w-52 p-2 shadow">
            <li><a href="/login">Profil</a></li>
            <li><a href="/login">Ustawienia</a></li>
            <li><button on:click={logout}>Wyloguj</button></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- PAGE CONTENT -->
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>

  <!-- SIDEBAR -->
  <div class="drawer-side z-30">
    <label for="app-drawer" class="drawer-overlay !z-0"></label>

    <ul class="menu bg-base-100 text-base-content min-h-full w-80 p-4">
      <li class="mb-2 text-xl font-semibold">
        <button
          class="btn btn-ghost btn-circle absolute top-2 right-2 lg:hidden"
          on:click={() => (drawerOpen = false)}
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
    </ul>
  </div>
</div>

<!-- TOASTS -->
<div class="toast toast-top toast-end pointer-events-none z-50">
  {#each toasts as t (t.id)}
    <div
      class={'alert pointer-events-auto shadow-lg ' +
        (t.type === 'success'
          ? 'alert-success'
          : t.type === 'error'
            ? 'alert-error'
            : t.type === 'info'
              ? 'alert-info'
              : 'alert-warning')}
    >
      <Icon src={toastIcons[t.type]} class="h-5 w-5 shrink-0" />
      <span>{t.msg}</span>
    </div>
  {/each}
</div>

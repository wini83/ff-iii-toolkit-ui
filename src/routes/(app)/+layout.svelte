<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // prosty state dla drawer
  let drawerOpen = false;

  // toasty trzymamy jako prosta tablica
  type Toast = { id: string; type: 'success' | 'error' | 'info' | 'warning'; msg: string };
  let toasts: Toast[] = [];

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
    <div class="navbar bg-base-100 sticky top-0 z-50 shadow-md shadow-none lg:shadow-md">
      <div class="flex-none lg:hidden">
        <label for="app-drawer" class="btn btn-ghost drawer-button px-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </label>
      </div>

      <div class="flex-1">
        <h1 class="text-2xl font-bold">BLIK Sync</h1>
      </div>

      <div class="flex-none">
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-circle avatar">
            <div class="w-10 rounded-full">
              <img src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp" alt="avatar" />
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
  <div class="drawer-side z-40">
    <label for="app-drawer" class="drawer-overlay"></label>

    <ul class="menu bg-base-100 text-base-content min-h-full w-80 p-4">
      <li class="menu-title text-xl">Firefly Toolkit</li>

      <li>
        <details open>
          <summary class="flex cursor-pointer items-center gap-2">
            <!-- icon -->
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            BLIK Sync
          </summary>

          <ul>
            <li>
              <a href="/blik/upload">
                <!-- icon -->
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                </svg>
                File Upload
              </a>
            </li>

            <li>
              <a href="/file/demo">
                <!-- icon -->
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 11.625h4.5m-4.5 2.25h4.5m2.121 1.527c-1.171 1.464-3.07 1.464-4.242 0-1.172-1.465-1.172-3.84 0-5.304 1.171-1.464 3.07-1.464 4.242 0M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                File Preview
              </a>
            </li>

            <li>
              <a href="/match">
                <!-- icon -->
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
                Match & Update
              </a>
            </li>
          </ul>
        </details>
      </li>

      <li><a href="/match">Match</a></li>
      <li><a href="/update">Update</a></li>
    </ul>
  </div>
</div>

<!-- TOASTS -->
<div class="toast toast-top toast-end z-50 pointer-events-none">
  {#each toasts as t (t.id)}
    <div
      class={'alert shadow-lg pointer-events-auto ' +
        (t.type === 'success' ? 'alert-success' : t.type === 'error' ? 'alert-error' : t.type === 'info' ? 'alert-info' : 'alert-warning')}
    >
      {t.msg}
    </div>
  {/each}
</div>

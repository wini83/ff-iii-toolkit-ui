<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import { getMe } from '$lib/api/me';

  type MeUser = Awaited<ReturnType<typeof getMe>>;
  type Toast = { id: string; type: 'success' | 'error' | 'info' | 'warning'; msg: string };
  type ToastEventDetail = Pick<Toast, 'type' | 'msg'>;

  const DEFAULT_APP_TITLE = 'Firefly Toolkit';

  // prosty state dla drawer
  let drawerOpen = false;
  let meUser: MeUser | null = null;
  let dynamicTitle = DEFAULT_APP_TITLE;
  let headTitle = DEFAULT_APP_TITLE;

  // toasty trzymamy jako prosta tablica
  let toasts: Toast[] = [];

  const toastIcons = {
    success: icons.CheckCircle,
    error: icons.XCircle,
    info: icons.InformationCircle,
    warning: icons.ExclamationTriangle
  } as const;

  function resolveRouteTitle(pathname: string): string {
    if (pathname.startsWith('/tx/categorize')) return 'Transactions / Categorize';
    if (pathname.startsWith('/tx/stats')) return 'Transactions / Stats';
    if (pathname.startsWith('/allegro/accounts')) return 'Allegro / Accounts';
    if (pathname.startsWith('/allegro/') && pathname.endsWith('/matches')) return 'Allegro / Matches';
    if (pathname.startsWith('/allegro/') && pathname.endsWith('/payments')) return 'Allegro / Payments';
    if (pathname.startsWith('/allegro/stats')) return 'Allegro / Stats';
    if (pathname.startsWith('/blik/upload')) return 'BLIK Sync / File Upload';
    if (pathname.startsWith('/blik/file')) return 'BLIK Sync / File Preview';
    if (pathname.startsWith('/blik/stats')) return 'BLIK Sync / Stats';
    if (pathname.startsWith('/settings/secrets')) return 'Settings / Secrets';
    return DEFAULT_APP_TITLE;
  }

  $: dynamicTitle = resolveRouteTitle($page.url.pathname);
  $: headTitle =
    dynamicTitle === DEFAULT_APP_TITLE ? DEFAULT_APP_TITLE : `${dynamicTitle} — ${DEFAULT_APP_TITLE}`;

  function logout() {
    if (!browser) return;

    document.cookie = 'access_token_client=; Path=/; Max-Age=0';
    localStorage.removeItem('access_token');
    // używamy location.href bo chcemy pełne przeładowanie
    window.location.href = '/login';
  }

  function closeDrawerOnMobile() {
    drawerOpen = false;
  }

  function readAccessToken(): string | null {
    if (!browser) return null;

    try {
      return localStorage.getItem('access_token');
    } catch {
      return null;
    }
  }

  function hasAccessTokenCookie(): boolean {
    if (!browser) return false;
    return document.cookie.includes('access_token_client=');
  }

  function syncAccessTokenCookieFromLocalStorage() {
    if (!browser || hasAccessTokenCookie()) return;

    const token = readAccessToken();
    if (!token) return;

    document.cookie = `access_token_client=${token}; Path=/;`;
  }

  function isToastEventDetail(detail: unknown): detail is ToastEventDetail {
    if (!detail || typeof detail !== 'object') return false;

    const candidate = detail as Partial<ToastEventDetail>;
    const validType =
      candidate.type === 'success' ||
      candidate.type === 'error' ||
      candidate.type === 'info' ||
      candidate.type === 'warning';

    return validType && typeof candidate.msg === 'string' && candidate.msg.length > 0;
  }

  function handleToastEvent(event: Event) {
    const detail = (event as CustomEvent<unknown>).detail;

    if (!isToastEventDetail(detail)) {
      console.warn('Ignored toast event (missing detail):', event);
      return;
    }

    const id = crypto?.randomUUID?.() ?? String(Date.now());
    toasts = [...toasts, { id, type: detail.type, msg: detail.msg }];

    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, 3000);
  }

  async function loadCurrentUser() {
    const token = readAccessToken();
    if (!token) return;

    try {
      meUser = await getMe(token);
    } catch (error) {
      console.warn('Failed to fetch current user via /api/me:', error);
    }
  }

  onMount(() => {
    if (!browser) return;

    syncAccessTokenCookieFromLocalStorage();
    void loadCurrentUser();

    const listener = (event: Event) => handleToastEvent(event);
    window.addEventListener('toast', listener as EventListener);

    return () => {
      window.removeEventListener('toast', listener as EventListener);
    };
  });
</script>

<svelte:head>
  <title>{headTitle}</title>
</svelte:head>

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
        <h1 class="text-2xl font-bold">{dynamicTitle}</h1>
      </div>

      <div class="flex-none">
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-circle avatar" title={meUser ? `Signed in as ${meUser.username}` : undefined}>
            <div class="w-10 rounded-full">
              <img
                src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                alt="avatar"
              />
            </div>
          </button>
          <ul class="menu menu-sm dropdown-content bg-base-100 rounded-box mt-3 w-52 p-2 shadow">
            <li><a href="/login"><Icon src={icons.User} class="h-5 w-5" /> Profile</a></li>
            <li><a href="/settings/secrets"><Icon src={icons.Key} class="h-5 w-5" /> Secrets</a></li>
            <li><button on:click={logout}><Icon src={icons.Power} class="h-5 w-5" />Log out</button></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- PAGE CONTENT -->
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>

  <AppSidebar onCloseMobile={closeDrawerOnMobile} />
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

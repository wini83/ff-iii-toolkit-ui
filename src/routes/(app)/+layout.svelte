<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import AppSidebar from '$lib/components/AppSidebar.svelte';
  import { getMe } from '$lib/api/me';

  type MeUser = Awaited<ReturnType<typeof getMe>>;
  type Toast = { id: string; type: 'success' | 'error' | 'info' | 'warning'; msg: string };
  type ToastEventDetail = Pick<Toast, 'type' | 'msg'>;

  const DEFAULT_APP_TITLE = 'Firefly Toolkit';
  const THEME_STORAGE_KEY = 'ff-toolkit-theme';
  // prosty state dla drawer
  let drawerOpen = false;
  let meUser: MeUser | null = null;
  let dynamicTitle = DEFAULT_APP_TITLE;
  let headTitle = DEFAULT_APP_TITLE;
  let theme: 'light' | 'dark' = 'light';

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
    if (pathname.startsWith('/allegro/') && pathname.endsWith('/matches'))
      return 'Allegro / Matches';
    if (pathname.startsWith('/allegro/') && pathname.endsWith('/payments'))
      return 'Allegro / Payments';
    if (pathname.startsWith('/allegro/stats')) return 'Allegro / Stats';
    if (pathname.startsWith('/blik/upload')) return 'BLIK Sync / File Upload';
    if (pathname.startsWith('/blik/file')) return 'BLIK Sync / File Preview';
    if (pathname.startsWith('/blik/stats')) return 'BLIK Sync / Stats';
    if (pathname.startsWith('/settings/secrets')) return 'Settings / Secrets';
    if (pathname.startsWith('/users')) return 'Administration / Users';
    return DEFAULT_APP_TITLE;
  }

  $: dynamicTitle = resolveRouteTitle($page.url.pathname);
  $: headTitle =
    dynamicTitle === DEFAULT_APP_TITLE
      ? DEFAULT_APP_TITLE
      : `${dynamicTitle} — ${DEFAULT_APP_TITLE}`;

  function applyTheme(nextTheme: 'light' | 'dark') {
    theme = nextTheme;
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  function toggleTheme() {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  }

  async function logout() {
    try {
      await fetch('/logout', { method: 'POST' });
    } finally {
      meUser = null;
      await goto('/login', { invalidateAll: true });
    }
  }

  function closeDrawerOnMobile() {
    drawerOpen = false;
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
    try {
      meUser = await getMe();
    } catch (error) {
      console.warn('Failed to fetch current user via /api/me:', error);
    }
  }

  onMount(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const preferredTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

    applyTheme(preferredTheme);
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

<div
  class="drawer from-base-200 via-base-200 to-primary/10 text-base-content lg:drawer-open min-h-screen overflow-x-hidden bg-gradient-to-br"
>
  <input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

  <!-- CONTENT -->
  <div class="drawer-content flex flex-col overflow-x-hidden">
    <!-- NAVBAR -->
    <div
      class="from-base-100/95 via-base-100/90 to-primary/8 border-base-300/70 sticky top-0 z-10 border-b bg-gradient-to-r shadow-[0_10px_30px_-20px_rgba(15,23,42,0.28)] backdrop-blur"
    >
      <div class="navbar min-h-0 px-4 py-3 sm:px-6">
        <div class="flex flex-1 items-center gap-3">
          <div class="flex-none lg:hidden">
            <label for="app-drawer" class="btn btn-ghost drawer-button btn-sm px-2">
              <Icon src={icons.Bars3} class="h-6 w-6" />
            </label>
          </div>

          <div class="bg-primary/12 text-primary hidden rounded-2xl p-2.5 sm:inline-flex">
            <Icon src={icons.Squares2x2} class="h-5 w-5" />
          </div>

          <div class="min-w-0">
            <div class="text-base-content/55 text-[11px] font-medium tracking-[0.22em] uppercase">
              Workspace
            </div>
            <h1 class="truncate text-lg font-semibold sm:text-2xl">{dynamicTitle}</h1>
          </div>
        </div>

        <div class="flex-none flex items-center gap-2">
          <button
            class="btn btn-ghost btn-sm rounded-2xl px-3"
            on:click={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <Icon src={theme === 'light' ? icons.Moon : icons.Sun} class="h-5 w-5" />
          </button>

          <div class="dropdown dropdown-end">
            <div
              class="tooltip tooltip-bottom"
              data-tip={meUser ? `Signed in as ${meUser.username}` : undefined}
            >
              <button tabindex="0" class="btn btn-ghost rounded-2xl px-2 sm:px-3">
                <div class="avatar">
                  <div class="bg-base-200 w-9 rounded-xl">
                    <img
                      src={`https://api.dicebear.com/9.x/initials/svg?seed=${meUser?.username}`}
                      alt="avatar"
                    />
                  </div>
                </div>
                <!-- <span class="hidden text-sm font-medium sm:inline">
                {meUser?.username ?? 'Account'}
              </span> -->
                <Icon src={icons.ChevronDown} class="h-4 w-4 opacity-60" />
              </button>
            </div>
            <ul
              class="menu menu-sm dropdown-content bg-base-100 rounded-box border-base-200 mt-3 w-56 border p-2 shadow-xl"
            >
              <li><a href="/login"><Icon src={icons.User} class="h-5 w-5" /> Profile</a></li>
              <li>
                <a href="/settings/secrets"><Icon src={icons.Key} class="h-5 w-5" /> Secrets</a>
              </li>
              <li>
                <button on:click={logout}>
                  <Icon src={icons.Power} class="h-5 w-5" />Log out
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- PAGE CONTENT -->
    <main class="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <div class="mx-auto w-full max-w-7xl">
        <slot />
      </div>
    </main>
  </div>

  <AppSidebar onCloseMobile={closeDrawerOnMobile} isSuperuser={meUser?.is_superuser ?? false} />
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

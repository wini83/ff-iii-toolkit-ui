<script lang="ts">
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  export let form;

  let username = '';
  let password = '';
  let error: string = form?.error ?? '';

  $: if (form?.error) {
    error = form.error;
  }
</script>

<svelte:head>
  <title>Login — Firefly Toolkit</title>
</svelte:head>

<div
  class="from-base-200 via-base-200 to-primary/10 flex min-h-screen items-center justify-center bg-gradient-to-br px-4 py-10"
>
  <div
    class="bg-base-100 grid w-full max-w-6xl overflow-hidden rounded-[2rem] shadow-2xl lg:grid-cols-[1.05fr_0.95fr]"
  >
    <section
      class="from-primary/95 to-secondary/85 text-primary-content relative hidden overflow-hidden bg-gradient-to-br p-10 lg:flex lg:flex-col lg:justify-between"
    >
      <div class="absolute inset-0 opacity-20">
        <div class="absolute top-0 left-0 h-60 w-60 rounded-full bg-white/30 blur-3xl"></div>
        <div class="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-black/20 blur-3xl"></div>
      </div>

      <div class="relative z-10">
        <div
          class="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm backdrop-blur"
        >
          <Icon src={icons.ShieldCheck} class="h-5 w-5" />
          Secure access
        </div>

        <div class="mt-8 flex items-center gap-5">
          <img src="/logo_b.png" alt="Firefly Toolkit" class="h-36 w-36 object-contain" />
          <h1 class="text-4xl leading-tight font-semibold">Firefly Toolkit</h1>
        </div>

        <p class="text-primary-content/80 mt-4 max-w-md text-sm/6">
          Firefly Toolkit brings together banking imports, sync flows and onboarding utilities in
          one place.
        </p>
      </div>

      <div class="relative z-10 grid gap-4">
        <div class="rounded-3xl bg-white/10 p-5 backdrop-blur">
          <div class="text-primary-content/70 text-xs tracking-[0.2em] uppercase">
            Included today
          </div>
          <div class="mt-3 space-y-3 text-sm">
            <div class="flex items-center gap-3">
              <Icon src={icons.ArrowUpTray} class="h-5 w-5" />
              Alior BLIK import workflow
            </div>
            <div class="flex items-center gap-3">
              <Icon src={icons.Sparkles} class="h-5 w-5" />
              Transaction categorization tools
            </div>
            <div class="flex items-center gap-3">
              <Icon src={icons.BuildingStorefront} class="h-5 w-5" />
              Allegro enrichment workflow
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="px-6 py-8 sm:px-10 sm:py-12">
      <div class="mx-auto max-w-md">
        <div class="mb-8">
          <div class="bg-primary/12 text-primary inline-flex rounded-2xl p-3">
            <Icon src={icons.LockClosed} class="h-6 w-6" />
          </div>
          <h2 class="mt-4 text-3xl font-semibold tracking-tight">Login</h2>
          <p class="text-base-content/70 mt-2 text-sm">
            Use your application credentials to access the toolkit dashboard.
          </p>
        </div>

        <form method="POST" class="space-y-5">
          <label class="form-control">
            <div class="label">
              <span class="label-text font-medium">Login</span>
            </div>
            <input
              id="loginUser"
              name="username"
              bind:value={username}
              placeholder="Your username"
              class="input input-bordered w-full"
              autocomplete="username"
            />
          </label>

          <label class="form-control">
            <div class="label">
              <span class="label-text font-medium">Password</span>
            </div>
            <input
              type="password"
              id="loginPass"
              name="password"
              bind:value={password}
              class="input input-bordered w-full"
              placeholder="Your password"
              autocomplete="current-password"
            />
          </label>

          <div class="bg-base-200/60 rounded-2xl px-4 py-3 text-sm">
            Access is provided through administrator-created accounts.
          </div>

          {#if error}
            <div class="alert alert-error">
              <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
              <span>{error}</span>
            </div>
          {/if}

          <button type="submit" class="btn btn-primary w-full">
            <Icon src={icons.ArrowRightEndOnRectangle} class="h-5 w-5" />
            Sign in
          </button>
        </form>
      </div>
    </section>
  </div>
</div>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import { Icon } from '@steeze-ui/svelte-icon';
  import * as icons from '@steeze-ui/heroicons';

  import { setPassword } from '$lib/api/auth';
  import { ApiError } from '$lib/api/errors';

  const REDIRECT_DELAY_MS = 2200;

  let newPassword = '';
  let confirmPassword = '';
  let submitting = false;
  let success = false;
  let formError: string | null = null;

  $: token = $page.url.searchParams.get('token')?.trim() ?? '';
  $: tokenMissing = token.length === 0;

  function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
      return 'This invite is invalid or has expired.';
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  async function submitForm() {
    formError = null;

    if (tokenMissing) {
      formError = 'Missing invite token.';
      return;
    }

    if (newPassword.length < 8) {
      formError = 'Password must be at least 8 characters long.';
      return;
    }

    if (newPassword !== confirmPassword) {
      formError = 'Passwords must match.';
      return;
    }

    submitting = true;

    try {
      await setPassword({ token, new_password: newPassword });
      success = true;
      newPassword = '';
      confirmPassword = '';

      setTimeout(() => {
        goto(resolve('/login'));
      }, REDIRECT_DELAY_MS);
    } catch (error: unknown) {
      formError = getErrorMessage(error, 'Failed to set password. Please try again.');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Set Password — Firefly Toolkit</title>
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
          Secure onboarding
        </div>

        <h1 class="mt-8 text-4xl leading-tight font-semibold">
          Set your password and finish account activation.
        </h1>

        <p class="text-primary-content/80 mt-4 max-w-md text-sm/6">
          This invite grants one secure password setup flow. Once completed, you can sign in
          normally.
        </p>
      </div>

      <div class="relative z-10 grid gap-4">
        <div class="rounded-3xl bg-white/10 p-5 backdrop-blur">
          <div class="text-primary-content/70 text-xs tracking-[0.2em] uppercase">
            What happens next
          </div>
          <div class="mt-3 space-y-3 text-sm">
            <div class="flex items-center gap-3">
              <Icon src={icons.Key} class="h-5 w-5" />
              Your password is saved for the invited account.
            </div>
            <div class="flex items-center gap-3">
              <Icon src={icons.ArrowRightEndOnRectangle} class="h-5 w-5" />
              You will be redirected to the login screen.
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="px-6 py-8 sm:px-10 sm:py-12">
      <div class="mx-auto max-w-md">
        <div class="mb-8">
          <div class="bg-primary/12 text-primary inline-flex rounded-2xl p-3">
            <Icon src={icons.Key} class="h-6 w-6" />
          </div>
          <h2 class="mt-4 text-3xl font-semibold tracking-tight">Set password</h2>
          <p class="text-base-content/70 mt-2 text-sm">
            Choose a strong password to complete your invite-based onboarding.
          </p>
        </div>

        {#if success}
          <div class="alert alert-success">
            <Icon src={icons.CheckCircle} class="h-5 w-5" />
            <div>
              <div class="font-semibold">Password updated</div>
              <div class="text-sm">Redirecting to login...</div>
            </div>
          </div>

          <a href={resolve('/login')} class="btn btn-primary mt-6 w-full">
            <Icon src={icons.ArrowRightEndOnRectangle} class="h-5 w-5" />
            Go to login
          </a>
        {:else if tokenMissing}
          <div class="alert alert-error">
            <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
            <div>
              <div class="font-semibold">Missing invite token</div>
              <div class="text-sm">Open this page from the invite link or append `?token=...`.</div>
            </div>
          </div>

          <a href={resolve('/login')} class="btn btn-outline mt-6 w-full">Go to login</a>
        {:else}
          <form class="space-y-5" on:submit|preventDefault={submitForm}>
            <label class="form-control">
              <div class="label">
                <span class="label-text font-medium">New password</span>
              </div>
              <input
                type="password"
                class="input input-bordered w-full"
                bind:value={newPassword}
                disabled={submitting}
                placeholder="At least 8 characters"
              />
            </label>

            <label class="form-control">
              <div class="label">
                <span class="label-text font-medium">Confirm password</span>
              </div>
              <input
                type="password"
                class="input input-bordered w-full"
                bind:value={confirmPassword}
                disabled={submitting}
                placeholder="Repeat the password"
              />
            </label>

            <div class="bg-base-200/60 rounded-2xl px-4 py-3 text-sm">
              Minimum length: <span class="font-semibold">8 characters</span>
            </div>

            {#if formError}
              <div class="alert alert-error">
                <Icon src={icons.ExclamationTriangle} class="h-5 w-5" />
                <span>{formError}</span>
              </div>
            {/if}

            <button class="btn btn-primary w-full" type="submit" disabled={submitting}>
              {#if submitting}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              Set password
            </button>
          </form>

          <a href={resolve('/login')} class="btn btn-ghost mt-4 w-full">Back to login</a>
        {/if}
      </div>
    </section>
  </div>
</div>

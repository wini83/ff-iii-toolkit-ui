<script lang="ts">
  let username = '';
  let password = '';
  let error = '';

  import { API_BASE } from '$lib/config';

  async function login(e) {
    e.preventDefault();
    error = '';

    const response = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        username,
        password
      })
    });

    if (!response.ok) {
      error = 'Nieprawidłowy login lub hasło';
      return;
    }

    const data = await response.json();

    // zapisujemy token tak jak wcześniej
    localStorage.setItem('access_token', data.access_token);

    // ustawiamy cookie od razu — BEZ przechodzenia do (app)
    document.cookie = `access_token_client=${data.access_token}; Path=/;`;

    // redirect na landing page
    window.location.href = '/'; // możesz zmienić na '/'
  }
</script>

<div class="bg-base-200 flex min-h-screen items-center">
  <div class="card mx-auto w-full max-w-5xl shadow-xl">
    <div class="bg-base-100 grid grid-cols-1 rounded-xl md:grid-cols-2">
      <!-- LEFT SIDE -->
      <div class="">
        <div class="hero bg-base-200 min-h-full rounded-l-xl">
          <div class="hero-content py-12">
            <div class="max-w-md text-center">
              <h1 class="text-3xl font-bold">Firefly III Toolkit</h1>

              <div class="mt-12">
                <img src="/android-chrome-192x192.png" alt="Alior2Firefly" class="inline-block w-48" />
              </div>

              <h1 class="mt-8 text-2xl font-bold">Features:</h1>

              <p class="mt-4 py-2">
                ✓ <span class="font-semibold">Alior / BLIK </span> File import & Sync
              </p>
              <p class="mb-4 py-2">
                ✓ <span class="font-semibold">Citi Handlowy</span> Integration
                <span class="badge badge-soft badge-primary">TBD</span>
              </p>
              <p class="mb-4 py-2">
                ✓ Transaction <span class="font-semibold">Categorization</span>
                <span class="badge badge-soft badge-primary">TBD</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT SIDE -->
      <div class="px-10 py-24">
        <h2 class="mb-2 text-center text-2xl font-semibold">Login</h2>

        <form on:submit={login}>
          <div class="form-control mt-4 w-full">
            <label class="label" for="loginUser">
              <span class="label-text">Login</span>
            </label>
            <input
              id="loginUser"
              bind:value={username}
              placeholder="User"
              class="input input-bordered w-full"
            />
          </div>

          <div class="form-control mt-4 w-full">
            <label class="label" for="loginPass">
              <span class="label-text">Password</span>
            </label>
            <input
              type="password"
              id="loginPass"
              bind:value={password}
              class="input input-bordered w-full"
            />
          </div>

          <div class="text-primary mt-2 text-right">
            <a href="/login" class="hover:text-primary text-sm hover:underline">
              Forgot Password?
            </a>
          </div>

          {#if error}
            <p class="text-error mt-6 text-center">{error}</p>
          {/if}

          <button type="submit" class="btn btn-primary mt-6 w-full"> Login </button>

          <div class="mt-4 text-center">
            Don't have an account yet?
            <a href="/login" class="text-primary hover:underline"> Register </a>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>

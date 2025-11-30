<script lang="ts">
    let username = "";
    let password = "";
    let error = "";

	import { API_BASE } from "$lib/config";

    async function login(e) {
        e.preventDefault();
        error = "";

        const response = await fetch(`${API_BASE}/auth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                username,
                password
            })
        });

        if (!response.ok) {
            error = "Nieprawidłowy login lub hasło";
            return;
        }

        const data = await response.json();

        // zapisujemy token tak jak wcześniej
        localStorage.setItem("access_token", data.access_token);

		// ustawiamy cookie od razu — BEZ przechodzenia do (app)
		document.cookie = `access_token_client=${data.access_token}; Path=/;`;

        // redirect na landing page
        window.location.href = "/";   // możesz zmienić na '/'
    }
</script>

<div class="min-h-screen bg-base-200 flex items-center">
	<div class="card mx-auto w-full max-w-5xl shadow-xl">
		<div class="grid md:grid-cols-2 grid-cols-1 bg-base-100 rounded-xl">
			
			<!-- LEFT SIDE -->
			<div class="">
				<div class="hero min-h-full rounded-l-xl bg-base-200">
					<div class="hero-content py-12">
						<div class="max-w-md text-center">
							<h1 class="text-3xl font-bold">Alior2Firefly</h1>

							<div class="mt-12">
								<img 
									src="https://placehold.co/192x192/EEE/31343C?font=oswald&text=Alior2Firefly"
									alt="Alior2Firefly"
									class="w-48 inline-block"
								/>
							</div>

							<h1 class="text-2xl mt-8 font-bold">Alior BLIK Sync Tool</h1>

							<p class="py-2 mt-4">✓ <span class="font-semibold">Amet /dolor</span> sit amet</p>
							<p class="py-2 mb-4">✓ <span class="font-semibold">Daisy UI</span> + <span class="font-semibold">Tailwind</span></p>
						</div>
					</div>
				</div>
			</div>

			<!-- RIGHT SIDE -->
			<div class="py-24 px-10">
				<h2 class="text-2xl font-semibold mb-2 text-center">Login</h2>

				<form on:submit={login}>
					<div class="form-control w-full mt-4">
						<label class="label">
							<span class="label-text">Email Id</span>
						</label>
						<input
							id="loginUser"
							bind:value={username}
							placeholder="User"
							class="input input-bordered w-full"
						/>
					</div>

					<div class="form-control w-full mt-4">
						<label class="label">
							<span class="label-text">Password</span>
						</label>
						<input
							type="password"
							id="loginPass"
							bind:value={password}
							class="input input-bordered w-full"
						/>
					</div>

					<div class="text-right text-primary mt-2">
						<a href="/login" class="text-sm hover:text-primary hover:underline">
							Forgot Password?
						</a>
					</div>

					{#if error}
						<p class="text-center text-error mt-6">{error}</p>
					{/if}

					<button type="submit" class="btn mt-6 w-full btn-primary">
						Login
					</button>

					<div class="text-center mt-4">
						Don't have an account yet?
						<a href="/login" class="hover:underline text-primary">
							Register
						</a>
					</div>
				</form>
			</div>

		</div>
	</div>
</div>

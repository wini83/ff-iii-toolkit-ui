<script>
	export let error;
	export let status;
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-base-200 text-base-content">
	<h1 class="text-5xl font-bold">{status}</h1>
	<p class="text-xl mt-4">{error?.message ?? "Page not found"}</p>

	<a href="/" class="btn btn-primary mt-8">Wróć do strony głównej</a>
</div>
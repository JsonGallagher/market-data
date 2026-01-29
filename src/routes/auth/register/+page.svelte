<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Create Account - Market Data</title>
</svelte:head>

<div class="min-h-screen bg-[#111111] flex items-center justify-center px-6">
	<div class="w-full max-w-md">
		<div class="text-center mb-10">
			<div class="w-16 h-16 rounded-full border border-[#c9a962]/40 flex items-center justify-center mx-auto mb-6">
				<span class="text-[#c9a962] text-xl font-medium tracking-wider">MD</span>
			</div>
			<h1 class="text-3xl text-white mb-2">Get started</h1>
			<p class="text-[#888888]">Create your account</p>
		</div>

		<div class="lux-card p-8">
			{#if form?.error}
				<div class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					{form.error}
				</div>
			{/if}

			{#if form?.success}
				<div class="mb-6 p-4 bg-[#c9a962]/10 border border-[#c9a962]/20 rounded-lg text-[#c9a962] text-sm">
					{form.success}
				</div>
			{/if}

			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
				class="space-y-6"
			>
				<div>
					<label for="fullName" class="block text-sm font-medium text-white mb-3">
						Full Name
					</label>
					<input
						type="text"
						id="fullName"
						name="fullName"
						class="lux-input"
						placeholder="John Doe"
					/>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-white mb-3">
						Email
					</label>
					<input
						type="email"
						id="email"
						name="email"
						required
						class="lux-input"
						placeholder="you@example.com"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-white mb-3">
						Password
					</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						minlength="6"
						class="lux-input"
						placeholder="••••••••"
					/>
					<p class="mt-2 text-xs text-[#666666]">At least 6 characters</p>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="btn-primary w-full"
				>
					{loading ? 'Creating account...' : 'Create Account'}
				</button>
			</form>

			<p class="mt-6 text-center text-sm text-[#888888]">
				Already have an account?
				<a href="/auth/login" class="text-[#c9a962] hover:underline">
					Sign in
				</a>
			</p>
		</div>
	</div>
</div>

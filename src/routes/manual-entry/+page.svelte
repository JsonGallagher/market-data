<script lang="ts">
	import { enhance } from '$app/forms';
	import { getMetricTypes } from '$lib/extractors/excel';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const metricTypes = getMetricTypes();
	let saving = $state(false);

	// Form state
	let recordedDate = $state(new Date().toISOString().split('T')[0].slice(0, 7)); // YYYY-MM format
	let metrics = $state<Record<string, string>>({});

	function formatDateForInput(): string {
		return recordedDate;
	}

	function handleDateChange(event: Event) {
		const input = event.target as HTMLInputElement;
		recordedDate = input.value;
	}
</script>

<svelte:head>
	<title>Manual Entry - Market Data</title>
</svelte:head>

<div class="min-h-screen bg-[#111111]">
	<!-- Navigation -->
	<nav class="border-b border-[#2a2a2a]">
		<div class="max-w-7xl mx-auto px-6 lg:px-8">
			<div class="flex items-center justify-between h-20">
				<a href="/dashboard" class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-full border border-[#c9a962]/40 flex items-center justify-center">
						<span class="text-[#c9a962] text-sm font-medium tracking-wider">MD</span>
					</div>
					<span class="text-white text-lg font-medium tracking-wide hidden sm:block">MARKET DATA</span>
				</a>

				<div class="hidden md:flex items-center gap-8">
					<a href="/dashboard" class="nav-link">Dashboard</a>
					<a href="/upload" class="nav-link">Import</a>
					<a href="/manual-entry" class="nav-link text-[#c9a962]">Manual Entry</a>
				</div>

				<a href="/dashboard" class="btn-secondary py-2 px-5 text-xs">
					Back to Dashboard
				</a>
			</div>
		</div>
	</nav>

	<main class="max-w-2xl mx-auto px-6 lg:px-8 py-12">
		<div class="mb-10">
			<p class="section-label mb-4">Manual Entry</p>
			<h1 class="text-white text-4xl mb-4">Enter Market Data</h1>
			<p class="text-[#888888] text-lg">
				Enter your market metrics manually. All fields are optional - enter only what you have.
			</p>
		</div>

		{#if form?.error}
			<div class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="mb-6 p-4 bg-[#c9a962]/10 border border-[#c9a962]/20 rounded-xl text-[#c9a962] text-sm">
				Data saved successfully! <a href="/dashboard" class="underline hover:no-underline">View Dashboard</a>
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update();
					saving = false;
					if (form?.success) {
						metrics = {};
					}
				};
			}}
			class="lux-card p-8 space-y-8"
		>
			<!-- Date Selector -->
			<div>
				<label for="recordedDate" class="block text-sm font-medium text-white mb-3">
					Report Month
				</label>
				<input
					type="month"
					id="recordedDate"
					name="recordedDate"
					value={formatDateForInput()}
					onchange={handleDateChange}
					required
					class="lux-input"
				/>
				<p class="mt-2 text-xs text-[#666666]">
					Select the month this data represents
				</p>
			</div>

			<div class="h-px bg-[#2a2a2a]"></div>

			<!-- Metric Inputs -->
			<div class="grid gap-6">
				{#each metricTypes as metricType}
					<div>
						<label for={metricType.id} class="block text-sm font-medium text-white mb-3">
							{metricType.displayName}
							<span class="font-normal text-[#666666]">
								({metricType.unit === 'USD' ? '$' : metricType.unit})
							</span>
						</label>
						<input
							type="number"
							id={metricType.id}
							name={metricType.id}
							step={metricType.unit === 'ratio' ? '0.01' : metricType.unit === 'months' ? '0.1' : '1'}
							min={metricType.min}
							max={metricType.max}
							bind:value={metrics[metricType.id]}
							placeholder={`e.g., ${metricType.unit === 'USD' ? (metricType.id === 'median_price' ? '450000' : '250') : metricType.unit === 'ratio' ? '0.98' : metricType.unit === 'months' ? '2.5' : '45'}`}
							class="lux-input"
						/>
						<p class="mt-2 text-xs text-[#666666]">
							Expected range: {metricType.min.toLocaleString()} - {metricType.max.toLocaleString()} {metricType.unit}
						</p>
					</div>
				{/each}
			</div>

			<div class="flex gap-4 pt-4">
				<button
					type="submit"
					disabled={saving}
					class="btn-primary flex-1"
				>
					{saving ? 'Saving...' : 'Save Data'}
				</button>
				<a href="/dashboard" class="btn-secondary text-center">
					Cancel
				</a>
			</div>
		</form>
	</main>
</div>

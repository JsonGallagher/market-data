<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { extractFromFile, type ExtractedMetric } from '$lib/extractors/excel';
	import { formatValue } from '$lib/validation';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let file: File | null = $state(null);
	let extracting = $state(false);
	let saving = $state(false);
	let sheetUrl = $state('');
	let sheetError = $state<string | null>(null);
	let extractionResult = $state<{
		metrics: ExtractedMetric[];
		warnings: string[];
		errors: string[];
	} | null>(null);
	let editedMetrics = $state<ExtractedMetric[]>([]);
	const groupedMetrics = $derived(() => {
		const groups: Record<string, Record<string, ExtractedMetric>> = {};
		for (const metric of editedMetrics) {
			if (!groups[metric.recordedDate]) {
				groups[metric.recordedDate] = {};
			}
			groups[metric.recordedDate][metric.metricTypeId] = metric;
		}
		return Object.entries(groups)
			.map(([date, metrics]) => ({ date, metrics }))
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	});

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			file = input.files[0];
			await extractData();
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
			const droppedFile = event.dataTransfer.files[0];
			if (isValidFileType(droppedFile)) {
				file = droppedFile;
				await extractData();
			}
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
	}

	function isValidFileType(f: File): boolean {
		const validTypes = [
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'application/vnd.ms-excel',
			'text/csv'
		];
		return validTypes.includes(f.type) || f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv');
	}

	async function extractFromBuffer(buffer: ArrayBuffer) {
		extracting = true;
		sheetError = null;
		extractionResult = null;

		try {
			const result = extractFromFile(buffer);

			extractionResult = {
				metrics: result.metrics,
				warnings: result.warnings,
				errors: result.errors
			};

			editedMetrics = result.metrics.map((m) => ({ ...m }));
		} catch (error) {
			extractionResult = {
				metrics: [],
				warnings: [],
				errors: [error instanceof Error ? error.message : 'Failed to extract data']
			};
		} finally {
			extracting = false;
		}
	}

	async function extractData() {
		if (!file) return;
		const buffer = await file.arrayBuffer();
		await extractFromBuffer(buffer);
	}

	function buildGoogleSheetExportUrl(url: string) {
		const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
		if (!idMatch) return null;
		const id = idMatch[1];
		const gidMatch = url.match(/gid=([0-9]+)/);
		const gid = gidMatch ? gidMatch[1] : null;
		return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
	}

	async function extractFromGoogleSheet() {
		if (!sheetUrl.trim()) {
			sheetError = 'Paste a Google Sheets link';
			return;
		}

		const exportUrl = buildGoogleSheetExportUrl(sheetUrl.trim());
		if (!exportUrl) {
			sheetError = 'That link does not look like a Google Sheets URL';
			return;
		}

		extracting = true;
		sheetError = null;
		extractionResult = null;

		try {
			const response = await fetch(exportUrl, { method: 'GET' });
			if (!response.ok) {
				throw new Error('Failed to fetch sheet. Make sure sharing is set to "Anyone with the link".');
			}
			const buffer = await response.arrayBuffer();
			await extractFromBuffer(buffer);
		} catch (error) {
			sheetError = error instanceof Error ? error.message : 'Failed to fetch Google Sheet';
		} finally {
			extracting = false;
		}
	}

	function updateMetricValue(metric: ExtractedMetric, value: string) {
		const num = parseFloat(value);
		if (!isNaN(num)) {
			metric.value = num;
		}
	}

	function removeMetric(metric: ExtractedMetric) {
		editedMetrics = editedMetrics.filter((m) => m !== metric);
	}

	function resetExtraction() {
		file = null;
		extractionResult = null;
		editedMetrics = [];
	}

	$effect(() => {
		if (form?.success) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	});
</script>

<svelte:head>
	<title>Import Data - Market Data</title>
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
					<a href="/upload" class="nav-link text-[#c9a962]">Import</a>
					<a href="/manual-entry" class="nav-link">Manual Entry</a>
				</div>

				<a href="/dashboard" class="btn-secondary py-2 px-5 text-xs">
					Back to Dashboard
				</a>
			</div>
		</div>
	</nav>

	<main class="max-w-4xl mx-auto px-6 lg:px-8 py-12">
		<div class="mb-10">
			<p class="section-label mb-4">Data Import</p>
			<h1 class="text-white text-4xl mb-4">Import Market Data</h1>
			<p class="text-[#888888] text-lg">
				Upload an Excel or CSV file, or connect a Google Sheet to import your MLS data.
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

		<!-- Google Sheets Import -->
		<div class="lux-card p-6 mb-8">
			<h2 class="text-xl text-white mb-2">Import from Google Sheets</h2>
			<p class="text-sm text-[#888888] mb-5">
				Paste a public Google Sheets link (share settings: "Anyone with the link can view").
			</p>
			<div class="flex flex-col md:flex-row gap-3">
				<input
					type="url"
					placeholder="https://docs.google.com/spreadsheets/d/..."
					bind:value={sheetUrl}
					class="lux-input flex-1"
				/>
				<button
					type="button"
					onclick={extractFromGoogleSheet}
					disabled={extracting}
					class="btn-primary whitespace-nowrap"
				>
					{extracting ? 'Importing...' : 'Import Sheet'}
				</button>
			</div>
			{#if sheetError}
				<p class="text-sm text-red-400 mt-3">{sheetError}</p>
			{/if}
		</div>

		{#if !extractionResult}
			<!-- File Upload Zone -->
			<div
				class="lux-card p-12 text-center border-dashed hover:border-[#c9a962]/50 transition-colors cursor-pointer"
				ondrop={handleDrop}
				ondragover={handleDragOver}
				role="button"
				tabindex="0"
			>
				{#if extracting}
					<div class="animate-pulse">
						<div class="w-20 h-20 rounded-full border border-[#2a2a2a] mx-auto mb-6 flex items-center justify-center">
							<svg class="w-10 h-10 text-[#c9a962] animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
						</div>
						<p class="text-white text-lg">Extracting data...</p>
					</div>
				{:else}
					<div class="w-20 h-20 rounded-full border border-[#2a2a2a] mx-auto mb-6 flex items-center justify-center">
						<svg class="w-10 h-10 text-[#c9a962]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
						</svg>
					</div>
					<p class="text-white text-lg mb-2">Drag and drop your file here</p>
					<p class="text-[#666666] mb-6">or</p>
					<label class="btn-primary cursor-pointer">
						Browse Files
						<input
							type="file"
							accept=".xlsx,.xls,.csv"
							class="hidden"
							onchange={handleFileSelect}
						/>
					</label>
					<p class="text-sm text-[#666666] mt-6">
						Supports Excel (.xlsx, .xls) and CSV files
					</p>
				{/if}
			</div>

			<!-- Expected Columns -->
			<div class="lux-card p-6 mt-8">
				<h2 class="text-lg text-white mb-4">Expected Column Headers</h2>
				<p class="text-sm text-[#888888] mb-5">
					Your file should have columns with names similar to these (case-insensitive):
				</p>
				<div class="grid md:grid-cols-2 gap-4 text-sm">
					<div class="flex gap-2">
						<span class="text-white">Date:</span>
						<span class="text-[#666666]">Date, Period, Month</span>
					</div>
					<div class="flex gap-2">
						<span class="text-white">Median Price:</span>
						<span class="text-[#666666]">Median Sale Price, Median Price</span>
					</div>
					<div class="flex gap-2">
						<span class="text-white">Price/SqFt:</span>
						<span class="text-[#666666]">Price Per Sq Ft, $/SqFt</span>
					</div>
					<div class="flex gap-2">
						<span class="text-white">Active Listings:</span>
						<span class="text-[#666666]">Active Listings, Inventory</span>
					</div>
					<div class="flex gap-2">
						<span class="text-white">Days on Market:</span>
						<span class="text-[#666666]">Days on Market, DOM</span>
					</div>
					<div class="flex gap-2">
						<span class="text-white">Months of Supply:</span>
						<span class="text-[#666666]">Months of Supply, Absorption Rate</span>
					</div>
				</div>
			</div>
		{:else}
			<!-- Review & Confirm Section -->
			<div class="space-y-6">
				{#if extractionResult.errors.length > 0}
					<div class="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
						<h3 class="font-medium text-red-400 mb-2">Errors</h3>
						<ul class="list-disc list-inside text-sm text-red-400/80">
							{#each extractionResult.errors as error}
								<li>{error}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if extractionResult.warnings.length > 0}
					<div class="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
						<h3 class="font-medium text-yellow-400 mb-2">Warnings</h3>
						<ul class="list-disc list-inside text-sm text-yellow-400/80">
							{#each extractionResult.warnings as warning}
								<li>{warning}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if editedMetrics.length > 0}
					<div class="lux-card p-6">
						<div class="flex items-center justify-between mb-6">
							<h2 class="text-xl text-white">
								Review Extracted Data
								<span class="text-[#888888] text-base ml-2">({editedMetrics.length} metrics)</span>
							</h2>
							<button
								type="button"
								onclick={resetExtraction}
								class="text-sm text-[#888888] hover:text-white transition-colors"
							>
								Upload Different File
							</button>
						</div>

						<form
							method="POST"
							use:enhance={() => {
								saving = true;
								return async ({ update }) => {
									await update();
									saving = false;
								};
							}}
						>
							<input type="hidden" name="metrics" value={JSON.stringify(editedMetrics)} />

							<div class="overflow-x-auto">
								<table class="w-full">
									<thead>
										<tr class="border-b border-[#2a2a2a]">
											<th class="text-left py-3 px-2 text-xs font-medium text-[#888888] uppercase tracking-wider">Date</th>
											<th class="text-left py-3 px-2 text-xs font-medium text-[#888888] uppercase tracking-wider">Active</th>
											<th class="text-left py-3 px-2 text-xs font-medium text-[#888888] uppercase tracking-wider">Sales</th>
											<th class="text-left py-3 px-2 text-xs font-medium text-[#888888] uppercase tracking-wider">Avg Price</th>
											<th class="text-left py-3 px-2 text-xs font-medium text-[#888888] uppercase tracking-wider">Median</th>
											<th class="text-left py-3 px-2 text-xs font-medium text-[#888888] uppercase tracking-wider">Other</th>
										</tr>
									</thead>
									<tbody>
										{#each groupedMetrics() as group}
											{@const row = group.metrics}
											<tr class="border-b border-[#2a2a2a]/50">
												<td class="py-3 px-2 text-sm text-white">
													{new Date(`${group.date}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
												</td>
												<td class="py-3 px-2">
													{#if row.active_listings}
														<input
															type="number"
															step="any"
															value={row.active_listings.value}
															oninput={(e) => updateMetricValue(row.active_listings, (e.target as HTMLInputElement).value)}
															class="w-24 px-2 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-white focus:border-[#c9a962] focus:outline-none"
														/>
													{/if}
												</td>
												<td class="py-3 px-2">
													{#if row.sales_count}
														<input
															type="number"
															step="any"
															value={row.sales_count.value}
															oninput={(e) => updateMetricValue(row.sales_count, (e.target as HTMLInputElement).value)}
															class="w-24 px-2 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-white focus:border-[#c9a962] focus:outline-none"
														/>
													{/if}
												</td>
												<td class="py-3 px-2">
													{#if row.average_price}
														<input
															type="number"
															step="any"
															value={row.average_price.value}
															oninput={(e) => updateMetricValue(row.average_price, (e.target as HTMLInputElement).value)}
															class="w-28 px-2 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-white focus:border-[#c9a962] focus:outline-none"
														/>
													{/if}
												</td>
												<td class="py-3 px-2">
													{#if row.median_price}
														<input
															type="number"
															step="any"
															value={row.median_price.value}
															oninput={(e) => updateMetricValue(row.median_price, (e.target as HTMLInputElement).value)}
															class="w-28 px-2 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-white focus:border-[#c9a962] focus:outline-none"
														/>
													{/if}
												</td>
												<td class="py-3 px-2 text-sm text-[#888888]">
													{#each Object.values(row) as metric}
														{#if !['active_listings','sales_count','average_price','median_price'].includes(metric.metricTypeId)}
															<div class="flex items-center gap-2 mb-1">
																<span class="text-xs">{metric.displayName}</span>
																<input
																	type="number"
																	step="any"
																	value={metric.value}
																	oninput={(e) => updateMetricValue(metric, (e.target as HTMLInputElement).value)}
																	class="w-20 px-2 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-white focus:border-[#c9a962] focus:outline-none"
																/>
																<button
																	type="button"
																	onclick={() => removeMetric(metric)}
																	aria-label="Remove metric"
																	class="text-[#666666] hover:text-red-400 transition-colors"
																>
																	<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
																	</svg>
																</button>
															</div>
														{/if}
													{/each}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<div class="mt-8 flex gap-4">
								<button
									type="submit"
									disabled={saving || editedMetrics.length === 0}
									class="btn-primary flex-1"
								>
									{saving ? 'Saving...' : `Save ${editedMetrics.length} Metrics`}
								</button>
								<button
									type="button"
									onclick={resetExtraction}
									class="btn-secondary"
								>
									Cancel
								</button>
							</div>
						</form>
					</div>
				{:else if extractionResult.errors.length === 0}
					<div class="lux-card p-8 text-center">
						<p class="text-[#888888] mb-6">No metrics could be extracted from the file.</p>
						<div class="flex gap-4 justify-center">
							<button
								type="button"
								onclick={resetExtraction}
								class="btn-primary"
							>
								Try Another File
							</button>
							<a href="/manual-entry" class="btn-secondary">
								Enter Manually
							</a>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>

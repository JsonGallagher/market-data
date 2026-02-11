<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { extractFromFile, type ExtractedMetric } from '$lib/extractors/excel';
	import { formatValue } from '$lib/validation';
	import type { ActionData, PageData } from './$types';
	import type { ImportSource } from '$lib/database.types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

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

	// Import source tracking
	interface ImportSourceInfo {
		type: 'google_sheets' | 'csv' | 'excel';
		url: string | null;
		name: string;
		sheetTab: string | null;
	}
	let importSource = $state<ImportSourceInfo | null>(null);
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

		// Set import source for file uploads
		if (editedMetrics.length > 0) {
			const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
			importSource = {
				type: isExcel ? 'excel' : 'csv',
				url: null,
				name: file.name,
				sheetTab: null
			};
		}
	}

	// Google Sheets URL parsing
	interface SheetInfo {
		id: string;
		gid: string | null;
		range: string | null;
	}

	function parseGoogleSheetUrl(url: string): SheetInfo | null {
		const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
		if (!idMatch) return null;

		const id = idMatch[1];
		const gidMatch = url.match(/gid=([0-9]+)/);
		const gid = gidMatch ? gidMatch[1] : null;

		// Support named ranges like Sheet1!A1:H50
		const rangeMatch = url.match(/range=([^&]+)/);
		const range = rangeMatch ? decodeURIComponent(rangeMatch[1]) : null;

		return { id, gid, range };
	}

	function buildGoogleSheetExportUrl(sheetInfo: SheetInfo): string {
		let exportUrl = `https://docs.google.com/spreadsheets/d/${sheetInfo.id}/export?format=csv`;
		if (sheetInfo.gid) {
			exportUrl += `&gid=${sheetInfo.gid}`;
		}
		if (sheetInfo.range) {
			exportUrl += `&range=${encodeURIComponent(sheetInfo.range)}`;
		}
		return exportUrl;
	}

	// Store last successful sheet info for re-import
	let lastSheetInfo: SheetInfo | null = $state(null);
	let lastSheetName = $state<string | null>(null);

	async function extractFromGoogleSheet() {
		if (!sheetUrl.trim()) {
			sheetError = 'Paste a Google Sheets link';
			return;
		}

		const sheetInfo = parseGoogleSheetUrl(sheetUrl.trim());
		if (!sheetInfo) {
			sheetError = 'Invalid Google Sheets URL. Expected format: https://docs.google.com/spreadsheets/d/SHEET_ID/...';
			return;
		}

		const exportUrl = buildGoogleSheetExportUrl(sheetInfo);

		extracting = true;
		sheetError = null;
		extractionResult = null;

		try {
			const response = await fetch(exportUrl, { method: 'GET' });

			if (response.status === 401 || response.status === 403) {
				throw new Error(
					'This sheet is private. To fix:\n' +
					'1. Open the sheet in Google Sheets\n' +
					'2. Click "Share" in the top right\n' +
					'3. Click "Change to anyone with the link"\n' +
					'4. Set permission to "Viewer"\n' +
					'5. Click "Done" and try again'
				);
			}

			if (response.status === 404) {
				throw new Error('Sheet not found. Check that the URL is correct and the sheet still exists.');
			}

			if (!response.ok) {
				throw new Error(`Failed to fetch sheet (HTTP ${response.status}). Make sure the sheet is publicly accessible.`);
			}

			// Check if we got HTML instead of CSV (indicates auth redirect)
			const contentType = response.headers.get('content-type') || '';
			if (contentType.includes('text/html')) {
				throw new Error(
					'This sheet is private. Make it public via Share → "Anyone with the link".'
				);
			}

			const buffer = await response.arrayBuffer();
			await extractFromBuffer(buffer);

			// Store for re-import
			if (editedMetrics.length > 0) {
				lastSheetInfo = sheetInfo;
				// Extract sheet name from URL or use default
				const nameMatch = sheetUrl.match(/spreadsheets\/d\/[^/]+\/([^?#]+)/);
				lastSheetName = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Google Sheet';

				// Set import source
				importSource = {
					type: 'google_sheets',
					url: sheetUrl.trim(),
					name: lastSheetName,
					sheetTab: sheetInfo.gid
				};
			}
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
		importSource = null;
		lastSheetInfo = null;
		lastSheetName = null;
	}

	$effect(() => {
		if (form?.success) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	});

	// Re-import from saved source
	async function reimportFromSource(source: ImportSource) {
		if (source.source_type !== 'google_sheets' || !source.source_url) {
			sheetError = 'Re-import is only available for Google Sheets sources';
			return;
		}

		sheetUrl = source.source_url;
		await extractFromGoogleSheet();
	}

	// Format relative time
	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Import Data - Market Data</title>
</svelte:head>

<div class="min-h-screen bg-[#111111]">
	<!-- Navigation -->
	<nav class="bg-gradient-to-r from-[#141414]/95 via-[#1a1a1a]/90 to-[#141414]/95 backdrop-blur-xl border-b border-[#d4a853]/10 shadow-lg shadow-black/20">
		<div class="max-w-7xl mx-auto px-6 lg:px-8">
			<div class="flex items-center justify-between h-20">
				<a href="/" class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-full border border-[#c9a962]/40 flex items-center justify-center">
						<span class="text-[#c9a962] text-sm font-medium tracking-wider translate-x-[1px]">MD</span>
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
			<div class="mb-8 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
				<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
							<svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<div>
							<h3 class="text-white font-semibold text-lg">Data imported successfully!</h3>
							<p class="text-emerald-400/80 text-sm">Your metrics are now available on the dashboard.</p>
						</div>
					</div>
					<a href="/dashboard" class="btn-primary whitespace-nowrap">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						View Dashboard
					</a>
				</div>
			</div>
		{/if}

		<!-- Google Sheets Import -->
		<div class="lux-card p-6 mb-8">
			<h2 class="text-xl text-white mb-2">Import from Google Sheets</h2>
			<p class="text-sm text-[#888888] mb-4">
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
				<p class="text-sm text-red-400 mt-3 whitespace-pre-line">{sheetError}</p>
			{/if}
			<details class="mt-4">
				<summary class="text-xs text-[#666666] cursor-pointer hover:text-[#888888]">
					Tips for importing specific tabs or ranges
				</summary>
				<div class="mt-3 text-xs text-[#666666] space-y-2 pl-4 border-l border-[#2a2a2a]">
					<p><strong class="text-[#888888]">Import a specific tab:</strong> Open the tab in Google Sheets, then copy the URL. It will include <code class="text-[#c9a962]">gid=123456</code> which identifies that tab.</p>
					<p><strong class="text-[#888888]">Import a range:</strong> Add <code class="text-[#c9a962]">?range=Sheet1!A1:H50</code> to the URL to import only specific cells.</p>
				</div>
			</details>
		</div>

		<!-- Import History -->
		{#if data.importSources && data.importSources.length > 0 && !extractionResult}
			<div class="lux-card p-6 mb-8">
				<h2 class="text-lg text-white mb-4">Recent Imports</h2>
				<div class="space-y-3">
					{#each data.importSources as source}
						<div class="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
							<div class="flex items-center gap-3 min-w-0">
								<div class="w-8 h-8 rounded-lg bg-[#252525] flex items-center justify-center flex-shrink-0">
									{#if source.source_type === 'google_sheets'}
										<svg class="w-4 h-4 text-[#34a853]" viewBox="0 0 24 24" fill="currentColor">
											<path d="M19.5 3H4.5C3.67 3 3 3.67 3 4.5v15c0 .83.67 1.5 1.5 1.5h15c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zM9 17H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm8 8h-6v-2h6v2zm0-4h-6v-2h6v2zm0-4h-6V7h6v2z"/>
										</svg>
									{:else}
										<svg class="w-4 h-4 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
									{/if}
								</div>
								<div class="min-w-0">
									<p class="text-sm text-white truncate">{source.source_name}</p>
									<p class="text-xs text-[#666666]">
										{formatRelativeTime(source.last_imported_at)} · {source.row_count} metrics
									</p>
								</div>
							</div>
							{#if source.source_type === 'google_sheets' && source.source_url}
								<button
									type="button"
									onclick={() => reimportFromSource(source)}
									disabled={extracting}
									class="text-xs text-[#c9a962] hover:text-[#e0bc6a] font-medium transition-colors flex items-center gap-1"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
									Re-import
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

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
							{#if importSource}
								<input type="hidden" name="importSource" value={JSON.stringify(importSource)} />
							{/if}

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

							<!-- Spacer for sticky footer -->
							<div class="h-24"></div>

							<!-- Sticky Action Bar -->
							<div class="fixed bottom-0 left-0 right-0 bg-[#111111]/95 backdrop-blur-sm border-t border-[#2a2a2a] z-50">
								<div class="max-w-4xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
									<div class="text-sm text-[#888888]">
										<span class="text-white font-medium">{editedMetrics.length}</span> metrics ready to save
									</div>
									<div class="flex gap-3">
										<button
											type="button"
											onclick={resetExtraction}
											class="btn-secondary py-2 px-5"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving || editedMetrics.length === 0}
											class="btn-primary py-2 px-8"
										>
											{saving ? 'Saving...' : 'Save Metrics'}
										</button>
									</div>
								</div>
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

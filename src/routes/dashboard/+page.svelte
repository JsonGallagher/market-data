<script lang="ts">
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import TrendChart from '$lib/charts/TrendChart.svelte';
	import MultiTrendChart from '$lib/charts/MultiTrendChart.svelte';
	import MetricCard from '$lib/charts/MetricCard.svelte';
	import { formatValue, calculatePercentChange } from '$lib/validation';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Date range filter
	type DateRange = '6m' | '12m' | '24m' | 'all';
	const STORAGE_KEY = 'market-data-date-range';

	const filterOptions: { value: DateRange; label: string; changeLabel: string }[] = [
		{ value: '6m', label: 'Last 6 months', changeLabel: '6mo' },
		{ value: '12m', label: 'Last 12 months', changeLabel: 'YoY' },
		{ value: '24m', label: 'Last 2 years', changeLabel: '2yr' },
		{ value: 'all', label: 'All time', changeLabel: 'total' }
	];

	// Use derived to track server data, state for UI updates
	const serverRange = $derived(data.range as DateRange);
	let dateRange = $state<DateRange>('12m');

	// Sync with server data and localStorage
	$effect(() => {
		// Initialize from server data
		dateRange = serverRange;

		// Check localStorage for saved preference (only if no URL param)
		if (browser) {
			const urlParams = new URLSearchParams(window.location.search);
			if (!urlParams.has('range')) {
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved && ['6m', '12m', '24m', 'all'].includes(saved)) {
					dateRange = saved as DateRange;
					goto(`?range=${saved}`, { replaceState: true, noScroll: true });
				}
			}
		}
	});

	function handleRangeChange(newRange: DateRange) {
		dateRange = newRange;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, newRange);
		}
		goto(`?range=${newRange}`, { replaceState: true, noScroll: true });
	}

	// Format relative time for last import
	function formatLastImport(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Group metrics by type
	const metricsByType = $derived.by(() => {
		const grouped: Record<string, Array<{ date: string; value: number }>> = {};

		for (const metric of data.metrics) {
			if (!grouped[metric.metric_type_id]) {
				grouped[metric.metric_type_id] = [];
			}
			grouped[metric.metric_type_id].push({
				date: metric.recorded_date,
				value: metric.value
			});
		}

		// Sort each group by date
		for (const key of Object.keys(grouped)) {
			grouped[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
		}

		return grouped;
	});

	// Get latest and previous values for each metric type
	const latestValues = $derived.by(() => {
		const latest: Record<string, { current: number | null; previous: number | null }> = {};

		for (const [typeId, values] of Object.entries(metricsByType)) {
			const sorted = [...values].sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
			);
			latest[typeId] = {
				current: sorted[0]?.value ?? null,
				previous: sorted[1]?.value ?? null
			};
		}

		return latest;
	});

	// Get display name for metric type
	function getDisplayName(typeId: string): string {
		const metricType = data.metricTypes.find((t) => t.id === typeId);
		const fallbackNames: Record<string, string> = {
			average_price: 'Average Sale Price',
			sales_count: 'Number of Sales'
		};
		return metricType?.display_name ?? fallbackNames[typeId] ?? typeId;
	}

	// Define which metrics to show (in order)
	const metricOrder = [
		'median_price',
		'average_price',
		'price_per_sqft',
		'active_listings',
		'sales_count',
		'days_on_market',
		'months_of_supply',
		'list_to_sale_ratio'
	];

	// Axis labels for each metric type
	const axisLabels: Record<string, { y: string; x: string }> = {
		median_price: { y: 'Price ($)', x: 'Date' },
		average_price: { y: 'Price ($)', x: 'Date' },
		price_per_sqft: { y: '$/Sq Ft', x: 'Date' },
		active_listings: { y: 'Listings', x: 'Date' },
		sales_count: { y: 'Sales', x: 'Date' },
		days_on_market: { y: 'Days', x: 'Date' },
		months_of_supply: { y: 'Months', x: 'Date' },
		list_to_sale_ratio: { y: 'Ratio (%)', x: 'Date' }
	};

	const hasData = $derived(data.metrics.length > 0);

	const metricsByDate = $derived.by(() => {
		const map: Record<string, Record<string, number>> = {};
		for (const metric of data.metrics) {
			if (!map[metric.recorded_date]) {
				map[metric.recorded_date] = {};
			}
			map[metric.recorded_date][metric.metric_type_id] = metric.value;
		}
		return map;
	});

	const sortedDates = $derived(
		Object.keys(metricsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
	);

	const monthCount = $derived(sortedDates.length);

	const timeline = $derived(
		sortedDates.map((date) => ({
			date,
			...metricsByDate[date]
		})) as Array<{ date: string } & Record<string, number>>
	);

	function seriesFor(metricTypeId: string) {
		return timeline
			.filter((point) => typeof point[metricTypeId] === 'number')
			.map((point) => ({ date: point.date, value: point[metricTypeId] as number }));
	}

	function shiftYear(dateStr: string, years: number) {
		const date = new Date(dateStr);
		date.setFullYear(date.getFullYear() + years);
		return date.toISOString().split('T')[0];
	}

	const latestDate = $derived.by(() => {
		const dates = data.metrics
			.map((metric) => metric.recorded_date)
			.filter(Boolean)
			.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
		return dates[dates.length - 1] ?? null;
	});
	const latestLabel = $derived.by(() => {
		const dateStr = latestDate;
		if (!dateStr) return '—';
		return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	});

	function latestValue(metricTypeId: string) {
		const date = latestDate;
		if (!date) return null;
		return metricsByDate[date]?.[metricTypeId] ?? null;
	}

	function valueAt(metricTypeId: string, dateStr: string | null) {
		if (!dateStr) return null;
		return metricsByDate[dateStr]?.[metricTypeId] ?? null;
	}

	const monthsOfSupplySeries = $derived(
		timeline
			.filter((point) => typeof point.active_listings === 'number' && typeof point.sales_count === 'number')
			.map((point) => ({
				date: point.date,
				value: Number((point.active_listings / point.sales_count).toFixed(2))
			}))
	);

	const seasonalitySales = $derived.by(() => {
		const buckets: Record<string, { total: number; count: number }> = {};
		for (const point of timeline) {
			if (typeof point.sales_count !== 'number') continue;
			const month = new Date(point.date).toLocaleDateString('en-US', { month: 'short' });
			if (!buckets[month]) {
				buckets[month] = { total: 0, count: 0 };
			}
			buckets[month].total += point.sales_count;
			buckets[month].count += 1;
		}
		return Object.entries(buckets).map(([month, data]) => ({
			month,
			value: Math.round(data.total / data.count)
		}));
	});

	const insights = $derived.by(() => {
		const items: string[] = [];
		const latest = latestDate;
		if (!latest) return items;

		const priorMonth = sortedDates[sortedDates.length - 2] ?? null;
		const priorYear = shiftYear(latest, -1);

		const median = latestValue('median_price');
		const medianPrior = valueAt('median_price', priorMonth);
		const medianYoY = valueAt('median_price', priorYear);
		const medianMoM = median !== null && medianPrior !== null ? calculatePercentChange(median, medianPrior) : null;
		const medianYoYChange = median !== null && medianYoY !== null ? calculatePercentChange(median, medianYoY) : null;

		if (median !== null) {
			const momText =
				medianMoM !== null ? `${Math.abs(medianMoM).toFixed(1)}% ${medianMoM >= 0 ? 'up' : 'down'} MoM` : 'MoM change unavailable';
			const yoyText =
				medianYoYChange !== null
					? `${Math.abs(medianYoYChange).toFixed(1)}% ${medianYoYChange >= 0 ? 'up' : 'down'} YoY`
					: 'YoY change unavailable';
			items.push(`Median price at ${formatValue('median_price', median)} (${momText}, ${yoyText}).`);
		}

		const sales = latestValue('sales_count');
		const salesYoY = valueAt('sales_count', priorYear);
		if (sales !== null && salesYoY !== null) {
			const change = calculatePercentChange(sales, salesYoY);
			if (change !== null) {
				items.push(
					`Sales volume is ${Math.abs(change).toFixed(1)}% ${change >= 0 ? 'higher' : 'lower'} than the same month last year.`
				);
			}
		}

		const active = latestValue('active_listings');
		if (active !== null && sales !== null) {
			const mos = active / Math.max(sales, 1);
			items.push(`Estimated months of supply is ${mos.toFixed(1)} (seller's market under 4).`);
		}

		const avgPrice = latestValue('average_price');
		if (avgPrice !== null && median !== null) {
			const spread = avgPrice - median;
			items.push(
				`Average price is ${formatValue('average_price', avgPrice)}; the ${formatValue('average_price', spread)} gap vs median hints at the mix of higher-end sales.`
			);
		}

		if (seasonalitySales.length > 3) {
			const sorted = [...seasonalitySales].sort((a, b) => b.value - a.value);
			items.push(
				`Seasonality: strongest months are ${sorted[0]?.month} and ${sorted[1]?.month}, slowest is ${sorted[sorted.length - 1]?.month}.`
			);
		}

		return items;
	});

	// Get earliest date in the filtered range
	const earliestDate = $derived(sortedDates.length > 0 ? sortedDates[0] : null);

	// Get change label for the current date range
	const changeLabel = $derived(
		filterOptions.find((opt) => opt.value === dateRange)?.changeLabel ?? 'change'
	);

	const pulseItems = $derived.by(() => {
		const latest = latestDate;
		const earliest = earliestDate;
		if (!latest || !earliest) return [];
		const items = [
			{ id: 'median_price', label: 'Median Price' },
			{ id: 'average_price', label: 'Average Price' },
			{ id: 'sales_count', label: 'Sales Volume' },
			{ id: 'active_listings', label: 'Active Listings' }
		];

		return items.map((item) => {
			const current = latestValue(item.id);
			const prior = valueAt(item.id, earliest);
			const change = current !== null && prior !== null ? calculatePercentChange(current, prior) : null;
			return { ...item, current, change };
		});
	});

	let creatingLink = $state(false);
	let copiedLink = $state<string | null>(null);
	const origin = browser ? window.location.origin : '';

	function copyToClipboard(token: string) {
		if (!browser) return;
		// Include current date range in shared link
		const url = `${origin}/share/${token}?range=${dateRange}`;
		navigator.clipboard.writeText(url);
		copiedLink = token;
		setTimeout(() => {
			copiedLink = null;
		}, 2000);
	}
</script>

<svelte:head>
	<title>Dashboard - Market Data</title>
</svelte:head>

<div class="min-h-screen bg-[#0c0c0c]">
	<!-- Navigation -->
	<nav class="sticky top-0 z-40 border-b border-[#1a1a1a] bg-[#0c0c0c]/90 backdrop-blur-lg">
		<div class="max-w-7xl mx-auto px-6 lg:px-8">
			<div class="flex items-center justify-between h-16">
				<!-- Logo -->
				<a href="/dashboard" class="flex items-center gap-3 group">
					<div class="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d4a853] to-[#b8903e] flex items-center justify-center shadow-lg shadow-[#d4a853]/10 group-hover:shadow-[#d4a853]/20 transition-shadow">
						<span class="text-[#0a0a0a] text-xs font-bold tracking-tight">MD</span>
					</div>
					<div class="hidden sm:block">
						<span class="text-[#fafafa] text-sm font-medium tracking-wide">Market Data</span>
					</div>
				</a>

				<!-- Center Navigation -->
				<div class="hidden md:flex items-center gap-8">
					<a href="/dashboard" class="nav-link active">Dashboard</a>
					<a href="/upload" class="nav-link">Import</a>
					<a href="/manual-entry" class="nav-link">Manual Entry</a>
				</div>

				<!-- Right Side -->
				<div class="flex items-center gap-4">
					<a href="/upload" class="btn-primary">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
						</svg>
						<span class="hidden sm:inline">Add Data</span>
					</a>
				</div>
			</div>
		</div>
	</nav>

	<main class="max-w-7xl mx-auto px-6 lg:px-8 py-10">
		{#if !hasData}
			<!-- Empty State -->
			<div class="max-w-md mx-auto text-center py-24">
				<div class="w-20 h-20 rounded-2xl bg-[#141414] border border-[#242424] mx-auto mb-8 flex items-center justify-center">
					<svg class="w-10 h-10 text-[#d4a853]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</div>
				{#if dateRange !== 'all'}
					<!-- No data in selected range -->
					<h1 class="text-3xl text-[#fafafa] mb-4">No data for this period</h1>
					<p class="text-[#707070] mb-10 text-base leading-relaxed">
						There's no data in the selected time range. Try expanding to a longer period or viewing all time.
					</p>
					<div class="flex gap-3 justify-center">
						<button
							type="button"
							class="btn-primary"
							onclick={() => handleRangeChange('all')}
						>
							View All Time
						</button>
						<a href="/upload" class="btn-secondary">Upload More Data</a>
					</div>
				{:else}
					<!-- No data at all -->
					<h1 class="text-3xl text-[#fafafa] mb-4">No data yet</h1>
					<p class="text-[#707070] mb-10 text-base leading-relaxed">
						Upload your first MLS report or enter data manually to start tracking market trends.
					</p>
					<div class="flex gap-3 justify-center">
						<a href="/upload" class="btn-primary">Upload File</a>
						<a href="/manual-entry" class="btn-secondary">Manual Entry</a>
					</div>
				{/if}
			</div>
		{:else}
			<!-- Hero Section -->
			<div class="mb-12">
				<div class="flex items-center gap-3 mb-4">
					<span class="section-label">Market Dashboard</span>
					<span class="h-px flex-1 bg-gradient-to-r from-[#242424] to-transparent"></span>
				</div>
				<h1 class="text-[#fafafa] max-w-2xl mb-4">
					Precision insights for high-performing agents.
				</h1>
				<p class="text-[#888888] text-base max-w-xl mb-6 leading-relaxed">
					Beautiful, client-ready analytics showing pricing, inventory, and momentum in a single view.
				</p>

				<!-- Date Range Filter -->
				<div class="flex flex-wrap items-center gap-4 mb-6">
					<span class="text-xs text-[#707070] uppercase tracking-wider">Showing</span>
					<div class="flex items-center gap-1 bg-[#111111] border border-[#1f1f1f] rounded-lg p-1">
						{#each filterOptions as opt}
							<button
								type="button"
								class="px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
									{dateRange === opt.value
										? 'bg-[#d4a853] text-[#0a0a0a]'
										: 'text-[#808080] hover:text-[#fafafa] hover:bg-[#1a1a1a]'}"
								onclick={() => handleRangeChange(opt.value)}
							>
								{opt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-4 text-xs">
					<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1f1f1f] rounded-full text-[#888888]">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						{monthCount} months
					</span>
					<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1f1f1f] rounded-full text-[#888888]">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						{data.metrics.length} metrics
					</span>
					<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-[#d4a853]/10 border border-[#d4a853]/20 rounded-full text-[#d4a853]">
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						Data through {latestLabel}
					</span>
					{#if data.lastImport}
						<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141414] border border-[#1f1f1f] rounded-full text-[#888888]">
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
							Imported {formatLastImport(data.lastImport.last_imported_at)}
						</span>
					{/if}
				</div>
			</div>

			<!-- Key Metrics Grid -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
				{#each pulseItems as item, i}
					<div class="stat-card animate-fade-in-up" style="animation-delay: {i * 75}ms; opacity: 0;">
						<p class="stat-label">{item.label}</p>
						<p class="stat-value">
							{item.current !== null ? formatValue(item.id, item.current) : '—'}
						</p>
						{#if item.change !== null}
							<span class="stat-change {item.change >= 0 ? 'positive' : 'negative'}">
								{#if item.change >= 0}
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
								{Math.abs(item.change).toFixed(1)}% {changeLabel}
							</span>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Key Insights -->
			{#if insights.length > 0}
				<div class="lux-card p-6 mb-10">
					<div class="flex items-center justify-between mb-5">
						<h2 class="text-xl text-[#fafafa]">Key Insights</h2>
						<span class="text-[11px] text-[#808080] uppercase tracking-wider">as of {latestLabel}</span>
					</div>
					<div class="grid md:grid-cols-2 gap-3">
						{#each insights as insight, i}
							<div class="insight-card animate-fade-in" style="animation-delay: {i * 50}ms; opacity: 0;">
								<p class="text-[#a0a0a0] text-sm leading-relaxed">{insight}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Charts Section -->
			<div class="mb-10">
				<div class="flex items-center gap-3 mb-5">
					<h2 class="text-xl text-[#fafafa]">Market Trends</h2>
					<span class="h-px flex-1 bg-gradient-to-r from-[#242424] to-transparent"></span>
				</div>
				<div class="grid md:grid-cols-2 gap-4">
					{#each metricOrder as typeId}
						{#if metricsByType[typeId] && metricsByType[typeId].length > 0}
							<TrendChart
								data={metricsByType[typeId]}
								metricTypeId={typeId}
								title={getDisplayName(typeId)}
								yAxisLabel={axisLabels[typeId]?.y || ''}
							/>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Market Intelligence -->
			<div class="lux-card p-6 mb-10">
				<div class="mb-6">
					<h2 class="text-xl text-[#fafafa] mb-2">Market Intelligence</h2>
					<p class="text-[#909090] text-sm">
						Layered analysis to help explain the story behind the numbers.
					</p>
				</div>

				<div class="grid lg:grid-cols-2 gap-4 mb-6">
					<MultiTrendChart
						title="Median vs Average Price"
						series={[
							{ name: 'Median', values: seriesFor('median_price'), color: '#d4a853' },
							{ name: 'Average', values: seriesFor('average_price'), color: '#5b8def' }
						]}
						tooltipFormatter={(value) => formatValue('average_price', value)}
						yAxisLabel="Price ($)"
					/>
					<MultiTrendChart
						title="Sales vs Active Inventory"
						series={[
							{ name: 'Sales', values: seriesFor('sales_count'), color: '#34d399' },
							{ name: 'Active Listings', values: seriesFor('active_listings'), color: '#a78bfa' }
						]}
						tooltipFormatter={(value) => formatValue('active_listings', value)}
						yAxisLabel="Count"
					/>
				</div>

				<div class="grid lg:grid-cols-2 gap-4">
					<TrendChart
						data={monthsOfSupplySeries}
						metricTypeId="months_of_supply"
						title="Months of Supply"
						color="#d4a853"
						yAxisLabel="Months"
					/>
					<div class="chart-card p-5">
						<h3 class="text-[13px] font-semibold tracking-wide text-[#909090] uppercase mb-4">Agent Talking Points</h3>
						{#if insights.length === 0}
							<p class="text-[#808080] text-sm">Upload more history to unlock insights.</p>
						{:else}
							<ul class="space-y-3">
								{#each insights as insight}
									<li class="flex items-start gap-3">
										<span class="mt-2 h-1.5 w-1.5 rounded-full bg-[#d4a853] flex-shrink-0"></span>
										<span class="text-[#909090] text-sm leading-relaxed">{insight}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			</div>

			<!-- Sharing Section -->
			<div class="lux-card p-6">
				<div class="flex items-center gap-3 mb-5">
					<div class="w-9 h-9 rounded-lg bg-[#141414] border border-[#242424] flex items-center justify-center">
						<svg class="w-4 h-4 text-[#d4a853]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
						</svg>
					</div>
					<div>
						<h2 class="text-lg text-[#fafafa]">Share Your Dashboard</h2>
						<p class="text-xs text-[#808080]">Generate shareable links for your clients</p>
					</div>
				</div>

				{#if form?.error}
					<div class="mb-5 p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-sm">
						{form.error}
					</div>
				{/if}

				{#if data.sharedLinks.length > 0}
					<div class="space-y-2 mb-5">
						{#each data.sharedLinks as link}
							<div class="flex items-center justify-between p-4 bg-[#111111] border border-[#1f1f1f] rounded-xl group hover:border-[#282828] transition-colors">
								<div class="flex-1 min-w-0 mr-4">
									<code class="text-xs text-[#909090] block truncate font-mono">{origin ? `${origin}/share/${link.token}` : `/share/${link.token}`}</code>
									<p class="text-[11px] text-[#707070] mt-1">
										Created {new Date(link.created_at).toLocaleDateString()}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => copyToClipboard(link.token)}
										class="btn-primary py-2 px-4 text-[10px]"
									>
										{copiedLink === link.token ? 'Copied!' : 'Copy Link'}
									</button>
									<form method="POST" action="?/deleteLink" use:enhance>
										<input type="hidden" name="linkId" value={link.id} />
										<button
											type="submit"
											aria-label="Delete shareable link"
											class="p-2 text-[#606060] hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/5"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<form
					method="POST"
					action="?/createLink"
					use:enhance={() => {
						creatingLink = true;
						return async ({ update }) => {
							await update();
							creatingLink = false;
						};
					}}
				>
					<button type="submit" disabled={creatingLink} class="btn-secondary">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
						</svg>
						{creatingLink ? 'Creating...' : 'Create Shareable Link'}
					</button>
				</form>

				<p class="text-[11px] text-[#707070] mt-4">
					Anyone with the link can view your dashboard. Links don't expire.
				</p>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t border-[#1a1a1a] mt-16">
		<div class="max-w-7xl mx-auto px-6 lg:px-8 py-10">
			<div class="flex flex-col md:flex-row items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div class="w-7 h-7 rounded-md bg-gradient-to-br from-[#d4a853] to-[#b8903e] flex items-center justify-center">
						<span class="text-[#0a0a0a] text-[10px] font-bold">MD</span>
					</div>
					<span class="text-[#808080] text-xs">Market Data</span>
				</div>
				<p class="text-[#707070] text-xs">
					© {new Date().getFullYear()} Market Data. All rights reserved.
				</p>
			</div>
		</div>
	</footer>
</div>

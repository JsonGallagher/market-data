<script lang="ts">
	import TrendChart from '$lib/charts/TrendChart.svelte';
	import MetricCard from '$lib/charts/MetricCard.svelte';
	import { formatValue } from '$lib/validation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Group metrics by type
	const metricsByType = $derived(() => {
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
	const latestValues = $derived(() => {
		const latest: Record<string, { current: number | null; previous: number | null }> = {};

		for (const [typeId, values] of Object.entries(metricsByType())) {
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

	const hasData = $derived(data.metrics.length > 0);

	function latestValue(metricTypeId: string) {
		const values = latestValues();
		return values[metricTypeId]?.current ?? null;
	}
</script>

<svelte:head>
	<title>Market Data - Shared Dashboard</title>
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
					<span class="text-white text-lg font-medium tracking-wide">MARKET DATA</span>
				</a>
				<span class="text-sm text-[#888888]">
					Shared by {data.ownerName}
				</span>
			</div>
		</div>
	</nav>

	<main class="max-w-7xl mx-auto px-6 lg:px-8 py-12">
		{#if !hasData}
			<div class="max-w-md mx-auto text-center py-24">
				<div class="w-24 h-24 rounded-full border border-[#2a2a2a] mx-auto mb-8 flex items-center justify-center">
					<svg class="w-12 h-12 text-[#c9a962]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
				</div>
				<h1 class="text-3xl text-white mb-4">No data available</h1>
				<p class="text-[#888888] text-lg">
					This dashboard doesn't have any data yet.
				</p>
			</div>
		{:else}
			<!-- Header -->
			<div class="mb-12">
				<p class="section-label mb-4">Shared Dashboard</p>
				<h1 class="text-white text-4xl mb-4">Market Analytics</h1>
				<p class="text-[#888888]">
					{data.metrics.length} data points shared by {data.ownerName}
				</p>
			</div>

			<!-- Key Metrics -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
				<div class="stat-card">
					<p class="stat-label">Median Price</p>
					<p class="stat-value">{latestValue('median_price') ? formatValue('median_price', latestValue('median_price') as number) : '—'}</p>
				</div>
				<div class="stat-card">
					<p class="stat-label">Average Price</p>
					<p class="stat-value">{latestValue('average_price') ? formatValue('average_price', latestValue('average_price') as number) : '—'}</p>
				</div>
				<div class="stat-card">
					<p class="stat-label">Active Listings</p>
					<p class="stat-value">{latestValue('active_listings') ? formatValue('active_listings', latestValue('active_listings') as number) : '—'}</p>
				</div>
				<div class="stat-card">
					<p class="stat-label">Sales Volume</p>
					<p class="stat-value">{latestValue('sales_count') ? formatValue('sales_count', latestValue('sales_count') as number) : '—'}</p>
				</div>
			</div>

			<!-- Charts -->
			<div class="mb-8">
				<h2 class="text-2xl text-white mb-6">Market Trends</h2>
				<div class="grid md:grid-cols-2 gap-6">
					{#each metricOrder as typeId}
						{@const chartData = metricsByType()}
						{#if chartData[typeId] && chartData[typeId].length > 0}
							<TrendChart
								data={chartData[typeId]}
								metricTypeId={typeId}
								title={getDisplayName(typeId)}
							/>
						{/if}
					{/each}
				</div>
			</div>

			<!-- Footer Attribution -->
			<div class="mt-16 pt-8 border-t border-[#2a2a2a] text-center">
				<p class="text-sm text-[#666666]">
					Powered by <span class="text-[#c9a962]">Market Data</span>
				</p>
			</div>
		{/if}
	</main>
</div>

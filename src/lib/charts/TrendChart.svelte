<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { formatValue } from '$lib/validation';

	interface DataPoint {
		date: string;
		value: number;
	}

	let {
		data,
		metricTypeId,
		title,
		color = '#d4a853',
		expandable = true,
		yAxisLabel = ''
	}: {
		data: DataPoint[];
		metricTypeId: string;
		title: string;
		color?: string;
		expandable?: boolean;
		yAxisLabel?: string;
	} = $props();

	let chartContainer: HTMLElement | undefined = $state();
	let modalChartContainer: HTMLElement | undefined = $state();
	let isOpen = $state(false);
	let chartInstance = $state<any>(null);
	let modalChartInstance = $state<any>(null);
	let displayRange = $state<{ start: string; end: string } | null>(null);

	// Computed values for stats - compute all in one derived to avoid reactivity chain issues
	const chartStats = $derived.by(() => {
		const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
		const latest = sorted.length > 0 ? sorted[sorted.length - 1]?.value : null;
		// Use first data point in range for period-over-period comparison
		const first = sorted.length > 1 ? sorted[0]?.value : null;
		let change: number | null = null;
		if (latest !== null && first !== null) {
			change = ((latest - first) / first) * 100;
		}
		return { sorted, latest, first, change };
	});

	// Convenience accessors
	const sortedData = $derived(chartStats.sorted);
	const latestValue = $derived(chartStats.latest);
	const firstValue = $derived(chartStats.first);
	const percentChange = $derived(chartStats.change);

	// Format Y-axis values based on metric type
	function formatYAxis(value: number): string {
		if (metricTypeId === 'median_price' || metricTypeId === 'average_price') {
			if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
			if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
			return `$${value.toFixed(0)}`;
		}
		if (metricTypeId === 'price_per_sqft') {
			return `$${value.toFixed(0)}`;
		}
		if (metricTypeId === 'list_to_sale_ratio') {
			return `${(value * 100).toFixed(0)}%`;
		}
		if (metricTypeId === 'months_of_supply') {
			return `${value.toFixed(1)}`;
		}
		if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
		return value.toFixed(0);
	}

	function getChartOptions(height: number) {
		const sortedData = [...data].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		const startDate = sortedData[0]?.date;
		const endDate = sortedData[sortedData.length - 1]?.date;
		if (startDate && endDate) {
			displayRange = {
				start: new Date(`${startDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
				end: new Date(`${endDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
			};
		}

		const seriesData = sortedData.map((d) => ({
			x: new Date(`${d.date}T12:00:00`).getTime(),
			y: d.value
		}));

		return {
			series: [{
				name: title,
				data: seriesData
			}],
			chart: {
				type: 'area' as const,
				height,
				background: 'transparent',
				fontFamily: 'DM Sans, sans-serif',
				toolbar: { show: false },
				zoom: { enabled: false },
				animations: {
					enabled: true,
					easing: 'easeinout' as const,
					speed: 400
				}
			},
			colors: [color],
			fill: {
				type: 'gradient' as const,
				gradient: {
					shadeIntensity: 1,
					opacityFrom: 0.4,
					opacityTo: 0.05,
					stops: [0, 90, 100]
				}
			},
			stroke: {
				curve: 'smooth' as const,
				width: 2.5
			},
			dataLabels: { enabled: false },
			markers: { size: 0 },
			grid: {
				borderColor: '#1f1f1f',
				strokeDashArray: 3,
				xaxis: { lines: { show: false } },
				yaxis: { lines: { show: true } },
				padding: { left: 10, right: 10 }
			},
			xaxis: {
				type: 'datetime' as const,
				labels: {
					style: {
						colors: '#888888',
						fontSize: '11px',
						fontWeight: 500
					},
					datetimeFormatter: {
						year: 'yyyy',
						month: "MMM 'yy",
						day: 'dd MMM'
					}
				},
				axisBorder: { show: false },
				axisTicks: { show: false }
			},
			yaxis: {
				labels: {
					style: {
						colors: '#888888',
						fontSize: '11px',
						fontWeight: 500
					},
					formatter: formatYAxis
				},
				axisBorder: { show: false },
				axisTicks: { show: false },
				title: yAxisLabel ? {
					text: yAxisLabel,
					style: {
						color: '#686868',
						fontSize: '11px',
						fontWeight: 600
					}
				} : undefined
			},
			tooltip: {
				theme: 'dark' as const,
				x: {
					format: 'MMM yyyy'
				},
				y: {
					formatter: (val: number) => formatValue(metricTypeId, val)
				}
			}
		};
	}

	async function initChart(container: HTMLElement, height: number) {
		if (!browser) return null;

		const ApexCharts = (await import('apexcharts')).default;
		const options = getChartOptions(height);
		const chart = new ApexCharts(container, options);
		await chart.render();
		return chart;
	}

	onMount(async () => {
		if (!browser || data.length === 0 || !chartContainer) return;

		await tick();
		chartInstance = await initChart(chartContainer, 200);

		return () => {
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
		};
	});

	// Update chart when data changes
	$effect(() => {
		const currentData = sortedData;
		if (!browser || !chartInstance || currentData.length === 0) return;

		const options = getChartOptions(200);
		chartInstance.updateOptions(options, true, true);
	});

	async function openModal() {
		isOpen = true;
		await tick();

		if (modalChartContainer && !modalChartInstance) {
			modalChartInstance = await initChart(modalChartContainer, 380);
		}
	}

	function closeModal() {
		isOpen = false;
		if (modalChartInstance) {
			modalChartInstance.destroy();
			modalChartInstance = null;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			closeModal();
		}
	}

	async function downloadChart() {
		if (!modalChartInstance) return;
		const { imgURI } = await modalChartInstance.dataURI({
			scale: 2 // 2x resolution for crisp exports
		});
		const link = document.createElement('a');
		link.href = imgURI;
		link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.png`;
		link.click();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="chart-card group">
	<!-- Header -->
	<div class="flex items-start justify-between p-5 pb-0">
		<div class="flex-1">
			<h3 class="text-sm font-semibold tracking-wide text-[#b0b0b0] uppercase mb-1">{title}</h3>
			{#if latestValue !== null}
				<div class="flex items-baseline gap-3">
					<span class="text-2xl font-medium text-[#fafafa] tracking-tight">
						{formatValue(metricTypeId, latestValue)}
					</span>
					{#if percentChange !== null}
						<span class="inline-flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full
							{percentChange >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}">
							{#if percentChange >= 0}
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
								</svg>
							{:else}
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
								</svg>
							{/if}
							{Math.abs(percentChange).toFixed(1)}%
						</span>
					{/if}
				</div>
			{/if}
		</div>
		{#if expandable}
			<button
				type="button"
				class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs font-semibold tracking-wider text-[#909090] hover:text-[#d4a853] uppercase flex items-center gap-1.5"
				onclick={openModal}
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
				</svg>
				Expand
			</button>
		{/if}
	</div>

	<!-- Chart Area -->
	{#if data.length === 0}
		<div class="h-[200px] flex items-center justify-center text-[#404040] text-sm">
			No data available
		</div>
	{:else}
		<button
			type="button"
			class="w-full text-left px-2 cursor-pointer"
			aria-label={`Expand ${title} chart`}
			disabled={!expandable}
			onclick={openModal}
		>
			<div bind:this={chartContainer} class="w-full"></div>
		</button>
	{/if}

	<!-- Footer with date range -->
	{#if displayRange}
		<div class="px-5 pb-4 pt-0">
			<p class="text-sm text-[#909090] tracking-wide">
				{displayRange.start} — {displayRange.end}
			</p>
		</div>
	{/if}
</div>

<!-- Expanded Modal -->
{#if isOpen}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
	>
		<button
			type="button"
			class="modal-backdrop"
			aria-label="Close chart"
			onclick={closeModal}
		></button>

		<div class="modal-content">
			<div class="flex items-center justify-between p-6 border-b border-[#1f1f1f]">
				<div>
					<h3 class="text-lg text-[#fafafa] font-medium">{title}</h3>
					{#if displayRange}
						<p class="text-xs text-[#505050] mt-1">{displayRange.start} — {displayRange.end}</p>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					<button
						type="button"
						class="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[#0a0a0a] bg-[#d4a853] hover:bg-[#e6c17a] rounded transition-colors uppercase"
						onclick={downloadChart}
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Export PNG
					</button>
					<div class="w-px h-4 bg-[#2a2a2a]"></div>
					<button
						type="button"
						class="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#505050] hover:text-[#fafafa] transition-colors uppercase"
						onclick={closeModal}
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
						Close
					</button>
				</div>
			</div>

			<div class="p-6">
				<div bind:this={modalChartContainer} class="w-full"></div>
			</div>

			{#if latestValue !== null}
				<div class="px-6 pb-6 flex items-center gap-8">
					<div>
						<p class="text-[10px] text-[#505050] uppercase tracking-wider mb-1">Current</p>
						<p class="text-lg text-[#fafafa] font-medium">{formatValue(metricTypeId, latestValue)}</p>
					</div>
					{#if firstValue !== null}
						<div>
							<p class="text-[10px] text-[#505050] uppercase tracking-wider mb-1">Start of Period</p>
							<p class="text-lg text-[#707070]">{formatValue(metricTypeId, firstValue)}</p>
						</div>
					{/if}
					{#if percentChange !== null}
						<div>
							<p class="text-[10px] text-[#505050] uppercase tracking-wider mb-1">Change</p>
							<p class="text-lg font-medium {percentChange >= 0 ? 'text-emerald-400' : 'text-red-400'}">
								{percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(8px);
		animation: fadeIn 200ms ease-out;
	}

	.modal-content {
		position: relative;
		background: linear-gradient(180deg, #161616 0%, #111111 100%);
		border: 1px solid #252525;
		border-radius: 1rem;
		width: min(1000px, 94vw);
		max-height: 90vh;
		overflow: hidden;
		animation: modalIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.modal-content::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(212, 168, 83, 0.3), transparent);
	}

	@keyframes modalIn {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
</style>

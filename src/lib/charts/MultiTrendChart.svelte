<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';

	interface SeriesPoint {
		date: string;
		value: number | null;
	}

	interface SeriesConfig {
		name: string;
		values: SeriesPoint[];
		color?: string;
	}

	let {
		title,
		series,
		tooltipFormatter,
		expandable = true,
		yAxisLabel = ''
	}: {
		title: string;
		series: SeriesConfig[];
		tooltipFormatter?: (value: number) => string;
		expandable?: boolean;
		yAxisLabel?: string;
	} = $props();

	let chartContainer: HTMLElement | undefined = $state();
	let modalChartContainer: HTMLElement | undefined = $state();
	let isOpen = $state(false);
	let chartInstance = $state<any>(null);
	let modalChartInstance = $state<any>(null);
	let displayRange = $state<{ start: string; end: string } | null>(null);

	// Track series data for reactivity
	const seriesData = $derived(series.map(s => s.values));

	const defaultColors = ['#d4a853', '#5b8def', '#34d399', '#a78bfa'];

	function formatYAxis(value: number): string {
		if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
		if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
		return value.toFixed(0);
	}

	function getChartOptions(height: number) {
		const allDates = new Set<string>();
		for (const s of series) {
			for (const point of s.values) {
				if (point.value !== null) allDates.add(point.date);
			}
		}

		const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
		const startDate = sortedDates[0];
		const endDate = sortedDates[sortedDates.length - 1];

		if (startDate && endDate) {
			displayRange = {
				start: new Date(`${startDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
				end: new Date(`${endDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
			};
		}

		const apexSeries = series.map((s) => ({
			name: s.name,
			data: s.values
				.filter((p) => p.value !== null)
				.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
				.map((p) => ({
					x: new Date(`${p.date}T12:00:00`).getTime(),
					y: p.value
				}))
		}));

		const colors = series.map((s, i) => s.color || defaultColors[i % defaultColors.length]);

		return {
			series: apexSeries,
			chart: {
				type: 'line' as const,
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
			colors,
			stroke: {
				curve: 'smooth' as const,
				width: 2.5
			},
			dataLabels: { enabled: false },
			markers: { size: 0 },
			legend: {
				show: true,
				position: 'top' as const,
				horizontalAlign: 'left' as const,
				labels: { colors: '#808080' },
				markers: {
					size: 8,
					offsetX: -4
				},
				itemMargin: { horizontal: 16 }
			},
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
					formatter: tooltipFormatter || formatYAxis
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
					formatter: tooltipFormatter || formatYAxis
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
		if (!browser || series.length === 0 || !chartContainer) return;

		await tick();
		chartInstance = await initChart(chartContainer, 210);

		return () => {
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
		};
	});

	// Update chart when series data changes
	$effect(() => {
		// Track seriesData to detect changes
		const currentData = seriesData;
		if (!browser || !chartInstance || currentData.length === 0) return;

		const options = getChartOptions(210);
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
	<div class="flex items-start justify-between p-5 pb-2">
		<div class="flex-1">
			<h3 class="text-sm font-semibold tracking-wide text-[#b0b0b0] uppercase">{title}</h3>
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
	{#if series.length === 0}
		<div class="h-[210px] flex items-center justify-center text-[#404040] text-sm">
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
			<div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4a853]/30 to-transparent"></div>

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

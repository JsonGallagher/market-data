<script lang="ts">
	import { onMount } from 'svelte';

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
		labelTarget = 8
	}: {
		title: string;
		series: SeriesConfig[];
		tooltipFormatter?: (value: number) => string;
		expandable?: boolean;
		labelTarget?: number;
	} = $props();

	let chartContainer = $state<HTMLElement | null>(null);
	let modalChartContainer = $state<HTMLElement | null>(null);
	let isOpen = $state(false);
	let chart: { destroy?: () => void } | null = null;
	let modalChart: { destroy?: () => void } | null = null;
	let isAnimating = $state(false);
	let displayRange = $state<{ start: string; end: string } | null>(null);

	// Default colors for series - refined palette
	const defaultColors = ['#d4a853', '#5b8def', '#34d399', '#a78bfa'];

	async function renderChart(container: HTMLElement, height: number) {
		const { Chart } = await import('frappe-charts');

		const allDates = new Set<string>();
		for (const s of series) {
			for (const point of s.values) {
				allDates.add(point.date);
			}
		}

		const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
		const startDate = sortedDates[0];
		const endDate = sortedDates[sortedDates.length - 1];
		const dataPoints = sortedDates.length;

		if (startDate && endDate) {
			displayRange = {
				start: new Date(`${startDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
				end: new Date(`${endDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
			};
		}

		const totalYears = startDate && endDate ? new Date(endDate).getFullYear() - new Date(startDate).getFullYear() : 0;
		const useYearOnly = totalYears >= 10;

		const fullLabels = sortedDates.map((d) =>
			new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
		);

		const axisLabels = sortedDates.map((d) =>
			new Date(`${d}T12:00:00`).toLocaleDateString(
				'en-US',
				useYearOnly ? { year: 'numeric' } : { month: 'short', year: '2-digit' }
			)
		);

		const stride = Math.max(1, Math.ceil(dataPoints / labelTarget));

		const displayLabels = axisLabels.map((label, idx) => {
			if (idx === 0 || idx === dataPoints - 1) return label;
			if (idx % stride === 0) return label;
			return '';
		});

		const labelToFullMap = new Map<string, string[]>();
		axisLabels.forEach((label, idx) => {
			if (!labelToFullMap.has(label)) {
				labelToFullMap.set(label, []);
			}
			labelToFullMap.get(label)!.push(fullLabels[idx]);
		});

		const datasets = series.map((s) => {
			const lookup = new Map(s.values.map((point) => [point.date, point.value]));
			return {
				name: s.name,
				values: sortedDates.map((date) => lookup.get(date) ?? null)
			};
		});

		const colors = series.map((s, i) => s.color || defaultColors[i % defaultColors.length]);

		const formatTooltipXFn = (label: string, idx: number) => {
			if (idx !== undefined && idx !== null && fullLabels[idx]) {
				return fullLabels[idx];
			}
			if (label && label.trim()) {
				const matches = labelToFullMap.get(label);
				if (matches && matches.length === 1) {
					return matches[0];
				}
			}
			return label || 'Date unavailable';
		};

		return new Chart(container, {
			title: '',
			data: {
				labels: displayLabels,
				datasets: datasets as unknown as { name: string; values: number[] }[]
			},
			type: 'line',
			height,
			colors,
			lineOptions: {
				regionFill: 0,
				hideDots: 1,
				dotSize: 0,
				spline: 0
			},
			axisOptions: {
				xAxisMode: 'tick',
				xIsSeries: true
			},
			tooltipOptions: tooltipFormatter
				? {
						formatTooltipY: (d: number) => tooltipFormatter(d),
						formatTooltipX: formatTooltipXFn
					}
				: {
						formatTooltipX: formatTooltipXFn
					}
		});
	}

	onMount(() => {
		if (series.length === 0 || !chartContainer) return;

		renderChart(chartContainer, 230).then((instance) => {
			chart = instance;
		});

		return () => {
			if (chart && typeof chart.destroy === 'function') {
				chart.destroy();
			}
		};
	});

	$effect(() => {
		if (!isOpen || !modalChartContainer || series.length === 0) return;
		let active = true;
		isAnimating = true;
		renderChart(modalChartContainer, 400).then((instance) => {
			if (!active) {
				if (instance && typeof instance.destroy === 'function') instance.destroy();
				return;
			}
			modalChart = instance;
		});

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				isOpen = false;
			}
		};
		window.addEventListener('keydown', onKeyDown);

		return () => {
			active = false;
			window.removeEventListener('keydown', onKeyDown);
			if (modalChart && typeof modalChart.destroy === 'function') {
				modalChart.destroy();
			}
		};
	});

	async function downloadChart() {
		if (!modalChartContainer) return;
		const svg = modalChartContainer.querySelector('svg');
		if (!svg) return;
		const serializer = new XMLSerializer();
		const svgString = serializer.serializeToString(svg);
		const canvas = document.createElement('canvas');
		const rect = svg.getBoundingClientRect();
		canvas.width = rect.width * 2;
		canvas.height = rect.height * 2;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const img = new Image();
		const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		img.onload = () => {
			ctx.scale(2, 2);
			ctx.drawImage(img, 0, 0);
			URL.revokeObjectURL(url);
			const pngUrl = canvas.toDataURL('image/png');
			const link = document.createElement('a');
			link.href = pngUrl;
			link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
			link.click();
		};
		img.src = url;
	}
</script>

<div class="chart-card group">
	<!-- Header -->
	<div class="flex items-start justify-between p-5 pb-2">
		<div class="flex-1">
			<h3 class="text-xs font-medium tracking-wide text-[#606060] uppercase">{title}</h3>
			<!-- Legend -->
			<div class="flex items-center gap-4 mt-3">
				{#each series as s, i}
					<div class="flex items-center gap-2">
						<span
							class="w-2.5 h-2.5 rounded-full"
							style="background-color: {s.color || defaultColors[i % defaultColors.length]}"
						></span>
						<span class="text-[11px] text-[#808080]">{s.name}</span>
					</div>
				{/each}
			</div>
		</div>
		{#if expandable}
			<button
				type="button"
				class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-[10px] font-medium tracking-wider text-[#505050] hover:text-[#d4a853] uppercase flex items-center gap-1.5"
				onclick={() => (isOpen = true)}
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
		<div class="h-[230px] flex items-center justify-center text-[#404040] text-sm">
			No data available
		</div>
	{:else}
		<button
			type="button"
			class="w-full text-left px-3"
			aria-label={`Expand ${title} chart`}
			disabled={!expandable}
			onclick={() => expandable && (isOpen = true)}
		>
			<div bind:this={chartContainer} class="chart-container"></div>
		</button>
	{/if}

	<!-- Footer with date range -->
	{#if displayRange}
		<div class="px-5 pb-4 pt-0">
			<p class="text-[10px] text-[#404040] tracking-wide">
				{displayRange.start} — {displayRange.end}
			</p>
		</div>
	{/if}
</div>

<!-- Expanded Modal -->
{#if expandable && isOpen}
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999;"
	>
		<!-- Backdrop -->
		<button
			type="button"
			class="modal-backdrop animate-fade-in"
			aria-label="Close chart"
			onclick={() => (isOpen = false)}
			style="position: fixed; top: 0; left: 0; right: 0; bottom: 0;"
		></button>

		<!-- Modal Content -->
		<div class={`modal-content ${isAnimating ? 'animate-modal-in' : ''}`}>
			<!-- Gold accent line -->
			<div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d4a853]/30 to-transparent"></div>

			<!-- Header -->
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
						class="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#505050] hover:text-[#d4a853] transition-colors uppercase"
						onclick={downloadChart}
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
						Download
					</button>
					<div class="w-px h-4 bg-[#2a2a2a]"></div>
					<button
						type="button"
						class="flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-[#505050] hover:text-[#fafafa] transition-colors uppercase"
						onclick={() => (isOpen = false)}
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
						Close
					</button>
				</div>
			</div>

			<!-- Legend -->
			<div class="px-6 pt-4 flex items-center gap-6">
				{#each series as s, i}
					<div class="flex items-center gap-2">
						<span
							class="w-3 h-3 rounded-full"
							style="background-color: {s.color || defaultColors[i % defaultColors.length]}"
						></span>
						<span class="text-sm text-[#909090]">{s.name}</span>
					</div>
				{/each}
			</div>

			<!-- Chart -->
			<div class="p-6 pt-2" bind:this={modalChartContainer}>
				<div class="chart-container"></div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
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
	}

	.modal-content {
		position: relative;
		background: linear-gradient(180deg, #161616 0%, #111111 100%);
		border: 1px solid #252525;
		border-radius: 1rem;
		width: min(1000px, 94vw);
		max-height: 90vh;
		overflow: hidden;
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

	.animate-modal-in {
		animation: modalIn 250ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.animate-fade-in {
		animation: fadeIn 200ms ease-out;
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
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>

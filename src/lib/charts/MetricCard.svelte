<script lang="ts">
	import { formatValue, calculatePercentChange } from '$lib/validation';

	let {
		title,
		metricTypeId,
		currentValue,
		previousValue
	}: {
		title: string;
		metricTypeId: string;
		currentValue: number | null;
		previousValue: number | null;
	} = $props();

	const percentChange = $derived(
		currentValue !== null && previousValue !== null
			? calculatePercentChange(currentValue, previousValue)
			: null
	);

	const formattedValue = $derived(
		currentValue !== null ? formatValue(metricTypeId, currentValue) : '—'
	);

	const changeDirection = $derived(
		percentChange === null ? 'neutral' : percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'neutral'
	);

	// For some metrics, down is good (e.g., days on market)
	const isPositiveGood = $derived(
		!['days_on_market', 'months_of_supply'].includes(metricTypeId)
	);

	const isGoodChange = $derived(() => {
		if (percentChange === null || percentChange === 0) return null;
		if (isPositiveGood) {
			return percentChange > 0;
		} else {
			return percentChange < 0;
		}
	});
</script>

<div class="stat-card group">
	<p class="stat-label">{title}</p>
	<div class="flex items-baseline gap-3">
		<span class="stat-value">{formattedValue}</span>
		{#if percentChange !== null}
			<span class="stat-change {isGoodChange() ? 'positive' : 'negative'}">
				{#if changeDirection === 'up'}
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
					</svg>
				{:else if changeDirection === 'down'}
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
				{Math.abs(percentChange).toFixed(1)}%
			</span>
		{/if}
	</div>
	{#if previousValue !== null}
		<p class="text-[10px] text-[#505050] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
			vs. prior: {formatValue(metricTypeId, previousValue)}
		</p>
	{/if}
</div>

<script lang="ts">
	let {
		variant = 'metric',
		class: className = ''
	}: {
		variant?: 'metric' | 'chart' | 'insight';
		class?: string;
	} = $props();
</script>

{#if variant === 'metric'}
	<div class="stat-card {className}">
		<div class="skeleton skeleton-text w-24 h-3 mb-3"></div>
		<div class="skeleton skeleton-text w-32 h-8 mb-2"></div>
		<div class="skeleton skeleton-text w-20 h-5 rounded-full"></div>
	</div>
{:else if variant === 'chart'}
	<div class="chart-card {className}">
		<div class="p-5 pb-0">
			<div class="skeleton skeleton-text w-32 h-3 mb-2"></div>
			<div class="flex items-baseline gap-3">
				<div class="skeleton skeleton-text w-24 h-7"></div>
				<div class="skeleton skeleton-text w-16 h-5 rounded-full"></div>
			</div>
		</div>
		<div class="p-4">
			<div class="skeleton skeleton-chart h-[200px] rounded-lg"></div>
		</div>
		<div class="px-5 pb-4">
			<div class="skeleton skeleton-text w-36 h-3"></div>
		</div>
	</div>
{:else if variant === 'insight'}
	<div class="enhanced-insight-card {className}">
		<div class="flex items-center justify-between mb-4">
			<div class="skeleton skeleton-text w-24 h-5 rounded"></div>
			<div class="skeleton skeleton-text w-16 h-4"></div>
		</div>
		<div class="skeleton skeleton-text w-3/4 h-6 mb-3"></div>
		<div class="space-y-2">
			<div class="skeleton skeleton-text w-full h-4"></div>
			<div class="skeleton skeleton-text w-5/6 h-4"></div>
		</div>
	</div>
{/if}

<style>
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--color-muted, #181818) 0%,
			var(--color-border, #2a2a2a) 50%,
			var(--color-muted, #181818) 100%
		);
		background-size: 200% 100%;
		animation: skeleton-pulse 1.5s ease-in-out infinite;
		border-radius: 0.25rem;
	}

	.skeleton-text {
		min-height: 0.75rem;
	}

	.skeleton-chart {
		background: linear-gradient(
			90deg,
			var(--color-card, #141414) 0%,
			var(--color-muted, #181818) 50%,
			var(--color-card, #141414) 100%
		);
		background-size: 200% 100%;
	}

	@keyframes skeleton-pulse {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.skeleton {
			animation: none;
			background: var(--color-muted, #181818);
		}
	}
</style>

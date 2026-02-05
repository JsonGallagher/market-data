<script lang="ts">
	import { browser } from '$app/environment';

	interface Props {
		isActive: boolean;
		startDate: string | null;
		endDate: string | null;
		onApply: (start: string, end: string) => void;
		onClear: () => void;
	}

	let { isActive, startDate, endDate, onApply, onClear }: Props = $props();

	let isOpen = $state(false);
	let tempStart = $state(startDate ?? '');
	let tempEnd = $state(endDate ?? '');
	let popoverRef = $state<HTMLDivElement | null>(null);

	// Sync temp values when props change
	$effect(() => {
		tempStart = startDate ?? '';
		tempEnd = endDate ?? '';
	});

	// Close popover when clicking outside
	$effect(() => {
		if (!browser || !isOpen) return;

		function handleClickOutside(event: MouseEvent) {
			if (popoverRef && !popoverRef.contains(event.target as Node)) {
				isOpen = false;
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	});

	function handleApply() {
		if (tempStart && tempEnd) {
			onApply(tempStart, tempEnd);
			isOpen = false;
		}
	}

	function handleClear() {
		tempStart = '';
		tempEnd = '';
		onClear();
		isOpen = false;
	}

	// Format date range for button display
	const displayLabel = $derived.by(() => {
		if (!startDate || !endDate) return 'Custom';
		const start = new Date(startDate + 'T12:00:00');
		const end = new Date(endDate + 'T12:00:00');
		const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		return `${formatDate(start)} – ${formatDate(end)}`;
	});

	const canApply = $derived(tempStart && tempEnd && tempStart <= tempEnd);
</script>

<div class="relative" bind:this={popoverRef}>
	<!-- Trigger Button -->
	<button
		type="button"
		class="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2 text-xs sm:text-sm font-medium rounded-md sm:rounded-md transition-all duration-200 w-full sm:w-auto
			{isActive
				? 'bg-[#d4a853] text-[#0a0a0a]'
				: 'text-[#a0a0a0] hover:text-[#fafafa] hover:bg-[#1a1a1a]'}"
		onclick={() => isOpen = !isOpen}
	>
		<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
		</svg>
		<span class="hidden sm:inline">{displayLabel}</span>
	</button>

	<!-- Popover - Mobile: fullscreen modal, Desktop: dropdown -->
	{#if isOpen}
		<!-- Mobile backdrop -->
		<button
			type="button"
			class="fixed inset-0 bg-black/60 z-40 sm:hidden"
			onclick={() => isOpen = false}
			aria-label="Close"
		></button>

		<div class="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-1/4 sm:top-full sm:mt-2 z-50 bg-[#141414] border border-[#252525] rounded-xl shadow-2xl p-5 sm:p-4 sm:w-[280px] max-w-[calc(100vw-2rem)]">
			<h3 class="text-sm font-semibold text-[#fafafa] mb-4">Custom Date Range</h3>

			<div class="space-y-3">
				<div>
					<label for="date-range-start" class="block text-xs text-[#808080] mb-1.5">From</label>
					<input
						id="date-range-start"
						type="date"
						bind:value={tempStart}
						class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#252525] rounded-lg text-[#fafafa] text-base sm:text-sm
							focus:outline-none focus:border-[#d4a853] focus:ring-1 focus:ring-[#d4a853]/20
							[color-scheme:dark]"
					/>
				</div>

				<div>
					<label for="date-range-end" class="block text-xs text-[#808080] mb-1.5">To</label>
					<input
						id="date-range-end"
						type="date"
						bind:value={tempEnd}
						class="w-full px-3 py-2.5 bg-[#0a0a0a] border border-[#252525] rounded-lg text-[#fafafa] text-base sm:text-sm
							focus:outline-none focus:border-[#d4a853] focus:ring-1 focus:ring-[#d4a853]/20
							[color-scheme:dark]"
					/>
				</div>

				{#if tempStart && tempEnd && tempStart > tempEnd}
					<p class="text-xs text-red-400">End date must be after start date</p>
				{/if}
			</div>

			<div class="flex items-center gap-2 mt-5 pt-4 border-t border-[#252525]">
				<button
					type="button"
					onclick={handleClear}
					class="flex-1 px-3 py-2.5 text-sm font-medium text-[#a0a0a0] hover:text-[#fafafa] hover:bg-[#1a1a1a] rounded-lg transition-colors"
				>
					Clear
				</button>
				<button
					type="button"
					onclick={handleApply}
					disabled={!canApply}
					class="flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors
						{canApply
							? 'bg-[#d4a853] text-[#0a0a0a] hover:bg-[#e0b45f]'
							: 'bg-[#252525] text-[#606060] cursor-not-allowed'}"
				>
					Apply
				</button>
			</div>
		</div>
	{/if}
</div>

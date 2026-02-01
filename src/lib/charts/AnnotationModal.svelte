<script lang="ts">
	import { enhance } from '$app/forms';
	import { ANNOTATION_COLORS, ANNOTATION_CATEGORIES } from '$lib/annotations/annotation-utils';

	let {
		isOpen = $bindable(false),
		initialDate = null,
		onSave
	}: {
		isOpen: boolean;
		initialDate?: string | null;
		onSave?: () => void;
	} = $props();

	let annotationDate = $state(initialDate ?? new Date().toISOString().split('T')[0]);
	let label = $state('');
	let description = $state('');
	let category = $state<'local_event' | 'market_event' | 'custom'>('custom');
	let color = $state('#d4a853');
	let saving = $state(false);

	// Reset form when modal opens
	$effect(() => {
		if (isOpen) {
			annotationDate = initialDate ?? new Date().toISOString().split('T')[0];
			label = '';
			description = '';
			category = 'custom';
			color = '#d4a853';
		}
	});

	function closeModal() {
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			closeModal();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="annotation-modal-title">
		<button
			type="button"
			class="modal-backdrop"
			aria-label="Close modal"
			onclick={closeModal}
		></button>

		<div class="modal-content">
			<div class="flex items-center justify-between p-5 border-b border-[#1f1f1f]">
				<h3 id="annotation-modal-title" class="text-lg text-[#fafafa] font-medium">Add Annotation</h3>
				<button
					type="button"
					class="text-[#505050] hover:text-[#fafafa] transition-colors"
					onclick={closeModal}
					aria-label="Close"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form
				method="POST"
				action="?/saveAnnotation"
				use:enhance={() => {
					saving = true;
					return async ({ update, result }) => {
						await update();
						saving = false;
						if (result.type === 'success') {
							closeModal();
							onSave?.();
						}
					};
				}}
			>
				<div class="p-5 space-y-4">
					<!-- Date -->
					<div>
						<label for="annotation-date" class="block text-sm font-medium text-[#909090] uppercase tracking-wider mb-2">
							Date
						</label>
						<input
							type="date"
							id="annotation-date"
							name="annotationDate"
							bind:value={annotationDate}
							required
							class="w-full bg-[#111111] border border-[#252525] rounded-lg px-4 py-2.5 text-[#fafafa] text-sm
								focus:outline-none focus:border-[#d4a853] focus:ring-1 focus:ring-[#d4a853]/30 transition-colors"
						/>
					</div>

					<!-- Label -->
					<div>
						<label for="annotation-label" class="block text-sm font-medium text-[#909090] uppercase tracking-wider mb-2">
							Label <span class="text-[#606060]">(max 30 chars)</span>
						</label>
						<input
							type="text"
							id="annotation-label"
							name="label"
							bind:value={label}
							required
							maxlength="30"
							placeholder="e.g., New listing policy"
							class="w-full bg-[#111111] border border-[#252525] rounded-lg px-4 py-2.5 text-[#fafafa] text-sm
								placeholder:text-[#404040] focus:outline-none focus:border-[#d4a853] focus:ring-1 focus:ring-[#d4a853]/30 transition-colors"
						/>
						<p class="mt-1 text-xs text-[#606060] text-right">{label.length}/30</p>
					</div>

					<!-- Description -->
					<div>
						<label for="annotation-description" class="block text-sm font-medium text-[#909090] uppercase tracking-wider mb-2">
							Description <span class="text-[#606060]">(optional)</span>
						</label>
						<textarea
							id="annotation-description"
							name="description"
							bind:value={description}
							rows="2"
							placeholder="Additional context about this event..."
							class="w-full bg-[#111111] border border-[#252525] rounded-lg px-4 py-2.5 text-[#fafafa] text-sm
								placeholder:text-[#404040] focus:outline-none focus:border-[#d4a853] focus:ring-1 focus:ring-[#d4a853]/30 transition-colors resize-none"
						></textarea>
					</div>

					<!-- Category -->
					<fieldset>
						<legend class="block text-sm font-medium text-[#909090] uppercase tracking-wider mb-2">
							Category
						</legend>
						<div class="flex gap-2 flex-wrap">
							{#each ANNOTATION_CATEGORIES as cat}
								<button
									type="button"
									class="px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200
										{category === cat.value
											? 'bg-[#d4a853] text-[#0a0a0a] border-[#d4a853]'
											: 'bg-transparent text-[#909090] border-[#252525] hover:border-[#404040] hover:text-[#fafafa]'}"
									onclick={() => category = cat.value}
								>
									{cat.label}
								</button>
							{/each}
						</div>
						<input type="hidden" name="category" value={category} />
					</fieldset>

					<!-- Color -->
					<fieldset>
						<legend class="block text-sm font-medium text-[#909090] uppercase tracking-wider mb-2">
							Color
						</legend>
						<div class="flex gap-2">
							{#each ANNOTATION_COLORS as colorOption}
								<button
									type="button"
									class="w-10 h-10 rounded-lg border-2 transition-all duration-200 flex items-center justify-center
										{color === colorOption.value
											? 'border-[#fafafa] scale-110'
											: 'border-transparent hover:scale-105'}"
									style="background-color: {colorOption.value}"
									onclick={() => color = colorOption.value}
									title={colorOption.label}
								>
									{#if color === colorOption.value}
										<svg class="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
						<input type="hidden" name="color" value={color} />
					</fieldset>
				</div>

				<div class="flex justify-end gap-3 p-5 border-t border-[#1f1f1f]">
					<button
						type="button"
						class="px-4 py-2 text-sm font-medium text-[#808080] hover:text-[#fafafa] transition-colors"
						onclick={closeModal}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving || !label.trim()}
						class="px-5 py-2 text-sm font-semibold bg-[#d4a853] text-[#0a0a0a] rounded-lg
							hover:bg-[#e4b863] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? 'Saving...' : 'Save Annotation'}
					</button>
				</div>
			</form>
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
		width: min(420px, 94vw);
		max-height: 90vh;
		overflow-y: auto;
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

	/* Fix date input styling for dark mode */
	input[type="date"]::-webkit-calendar-picker-indicator {
		filter: invert(0.7);
		cursor: pointer;
	}
</style>

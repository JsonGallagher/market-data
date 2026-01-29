<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let {
		isOpen = $bindable(false),
		children
	}: {
		isOpen: boolean;
		children: import('svelte').Snippet;
	} = $props();

	let portal: HTMLDivElement | null = $state(null);

	onMount(() => {
		if (!browser) return;

		// Create portal container
		portal = document.createElement('div');
		portal.className = 'modal-portal';
		document.body.appendChild(portal);

		return () => {
			if (portal) {
				document.body.removeChild(portal);
			}
		};
	});

	// Handle escape key
	$effect(() => {
		if (!isOpen || !browser) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				isOpen = false;
			}
		};

		// Prevent body scroll when modal is open
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			document.body.style.overflow = '';
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{#if isOpen && portal}
	{@render children()}
{/if}

<style>
	:global(.modal-portal) {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 9999;
		pointer-events: none;
	}

	:global(.modal-portal > *) {
		pointer-events: auto;
	}
</style>

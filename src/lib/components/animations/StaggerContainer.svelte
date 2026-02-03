<script lang="ts" module>
	import { setContext } from 'svelte';
	import { writable, type Writable } from 'svelte/store';

	export const STAGGER_CONTEXT = Symbol('stagger-context');

	export interface StaggerContext {
		isVisible: Writable<boolean>;
		getDelay: () => number;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		staggerDelay?: number;
		delayStart?: number;
		children?: import('svelte').Snippet;
		class?: string;
	}

	let {
		staggerDelay = 0.08,
		delayStart = 0,
		children,
		class: className = ''
	}: Props = $props();

	let element: HTMLElement | null = $state(null);
	const isVisible = writable(false);
	let itemIndex = 0;

	// Capture values for closure
	const capturedStaggerDelay = staggerDelay;
	const capturedDelayStart = delayStart;

	setContext<StaggerContext>(STAGGER_CONTEXT, {
		isVisible,
		getDelay: () => {
			const delay = capturedDelayStart + itemIndex * capturedStaggerDelay;
			itemIndex++;
			return delay;
		}
	});

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible.set(true);
						observer.disconnect();
					}
				});
			},
			{ threshold: 0.1, rootMargin: '-30px' }
		);

		if (element) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	});
</script>

<div bind:this={element} class={className}>
	{@render children?.()}
</div>

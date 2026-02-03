<script lang="ts">
	import { Motion } from 'svelte-motion';
	import { onMount } from 'svelte';

	interface Props {
		delay?: number;
		duration?: number;
		y?: number;
		children?: import('svelte').Snippet;
		class?: string;
	}

	let {
		delay = 0,
		duration = 0.5,
		y: initialY = 20,
		children,
		class: className = ''
	}: Props = $props();

	let isVisible = $state(false);
	let element: HTMLElement | null = $state(null);

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true;
						observer.disconnect();
					}
				});
			},
			{ threshold: 0.1, rootMargin: '-50px' }
		);

		if (element) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	});
</script>

<div bind:this={element} class={className}>
	<Motion
		animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: initialY }}
		transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
		let:motion
	>
		<div use:motion>
			{@render children?.()}
		</div>
	</Motion>
</div>

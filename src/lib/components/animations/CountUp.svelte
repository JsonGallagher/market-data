<script lang="ts">
	import { onMount } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		value: number;
		duration?: number;
		delay?: number;
		formatter?: (value: number) => string;
	}

	let {
		value,
		duration = 1200,
		delay = 0,
		formatter = (v: number) => Math.round(v).toLocaleString()
	}: Props = $props();

	const tweenedValue = tweened(0, {
		duration,
		easing: cubicOut
	});

	let hasAnimated = $state(false);
	let element: HTMLElement | null = $state(null);

	function startAnimation() {
		if (hasAnimated) return;
		hasAnimated = true;

		setTimeout(() => {
			tweenedValue.set(value);
		}, delay * 1000);
	}

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						startAnimation();
						observer.disconnect();
					}
				});
			},
			{ threshold: 0.1, rootMargin: '-20px' }
		);

		if (element) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	});
</script>

<span bind:this={element}>{formatter($tweenedValue)}</span>

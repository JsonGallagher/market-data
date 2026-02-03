<script lang="ts">
	import { Motion } from 'svelte-motion';
	import { getContext, onMount } from 'svelte';
	import { STAGGER_CONTEXT, type StaggerContext } from './StaggerContainer.svelte';

	interface Props {
		y?: number;
		children?: import('svelte').Snippet;
		class?: string;
	}

	let {
		y: initialY = 16,
		children,
		class: className = ''
	}: Props = $props();

	const context = getContext<StaggerContext>(STAGGER_CONTEXT);
	const delay = context?.getDelay() ?? 0;

	let isVisible = $state(false);

	onMount(() => {
		if (context) {
			const unsubscribe = context.isVisible.subscribe((value) => {
				isVisible = value;
			});
			return unsubscribe;
		} else {
			// No context, animate immediately
			isVisible = true;
		}
	});
</script>

<Motion
	animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: initialY }}
	transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
	let:motion
>
	<div use:motion class="h-full {className}">
		{@render children?.()}
	</div>
</Motion>

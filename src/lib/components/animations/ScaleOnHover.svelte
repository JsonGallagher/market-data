<script lang="ts">
	import { Motion } from 'svelte-motion';

	interface Props {
		scale?: number;
		y?: number;
		children?: import('svelte').Snippet;
		class?: string;
	}

	let {
		scale = 1.02,
		y = -2,
		children,
		class: className = ''
	}: Props = $props();
</script>

<Motion
	whileHover={{ scale, y }}
	whileTap={{ scale: 0.98 }}
	transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
	let:motion
>
	<div use:motion class={className}>
		{@render children?.()}
	</div>
</Motion>

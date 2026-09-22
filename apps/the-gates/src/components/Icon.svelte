<script lang="ts">
	let { name }: { name: string } = $props();
	const paths: Record<string, string> = {
		spin: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0111.5-1L20 9M4 15l2.4 3A7 7 0 0018 17',
		sound: 'M11 5L6 9H3v6h3l5 4V5zm4 3a6 6 0 010 8m3-11a10 10 0 010 14',
		muted: 'M11 5L6 9H3v6h3l5 4V5zm5 4 6 6m0-6-6 6',
		close: 'm6 6 12 12M6 18 18 6',
		info: 'M12 11v6m0-10v1M22 12a10 10 0 11-20 0 10 10 0 0120 0',
		auto: 'M8 5v14l12-7L8 5z',
		speed: 'm13 2-9 12h7l-1 8L21 9h-8l1-7z',
		settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
		fullscreen: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
		minus: 'M5 12h14',
		plus: 'M5 12h14M12 5v14',
		gate: 'M5 21V10a7 7 0 0114 0v11M9 21V10a3 3 0 016 0v11M12 7v14',
		stop: 'M6 6h12v12H6z',
	};
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path d={paths[name] ?? paths.gate} /></svg
>

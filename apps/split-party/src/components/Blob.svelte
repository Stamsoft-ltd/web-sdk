<script lang="ts">
	let {
		symbol = 'ORANGE',
		units = 1,
		uid = 'blob',
	}: { symbol?: string; units?: number; uid?: string } = $props();
	const palettes: Record<string, [string, string, string]> = {
		WATERMELON: ['#83ff46', '#27ca43', 'sleep'],
		CHERRIES: ['#ff6c89', '#f62d4b', 'angry'],
		GRAPES: ['#dd87ff', '#a234f4', 'happy'],
		STRAWBERRY: ['#ffaddf', '#ff58b6', 'happy'],
		BLUEBERRY: ['#7de1ff', '#279eed', 'sad'],
		ORANGE: ['#ffd55e', '#ff941c', 'wow'],
		LEMON: ['#ffed71', '#ffc327', 'happy'],
		KIWI: ['#6ffff1', '#11cfb8', 'happy'],
		PLUM: ['#999baa', '#45485e', 'wow'],
		APPLE: ['#fff1cf', '#ffdb8f', 'sleep'],
		BASKET: ['#fff7a4', '#e9a820', 'happy'],
	};
	let palette = $derived(palettes[symbol] ?? palettes.ORANGE);
	let positions = $derived(
		units === 1
			? [[0, 0, 1]]
			: units === 2
				? [
						[0, 20, 0.53],
						[47, 20, 0.53],
					]
				: units === 3
					? [
							[23, 0, 0.5],
							[0, 44, 0.5],
							[49, 44, 0.5],
						]
					: units === 4
						? [
								[0, 0, 0.5],
								[49, 0, 0.5],
								[0, 45, 0.5],
								[49, 45, 0.5],
							]
						: units === 5
							? [
									[0, 0, 0.43],
									[56, 0, 0.43],
									[28, 28, 0.43],
									[0, 54, 0.43],
									[56, 54, 0.43],
								]
							: [
									[0, 4, 0.35],
									[33, 4, 0.35],
									[66, 4, 0.35],
									[0, 49, 0.35],
									[33, 49, 0.35],
									[66, 49, 0.35],
								],
	);
</script>

<svg viewBox="0 0 100 100" aria-hidden="true" class="blob-art">
	<defs
		><linearGradient id={`${uid}-g`} x1="0" y1="0" x2=".7" y2="1"
			><stop stop-color={palette[0]} /><stop offset="1" stop-color={palette[1]} /></linearGradient
		></defs
	>
	{#each positions as [x, y, scale]}
		<g transform={`translate(${x} ${y}) scale(${scale})`}>
			<ellipse cx="50" cy="89" rx="36" ry="5" fill="#422267" opacity=".15" />
			<path
				d="M18 51 Q20 24 37 24 Q34 12 47 13 Q58 10 63 25 Q82 25 83 49 Q97 70 88 82 Q81 93 49 92 Q16 93 11 80 Q7 67 18 51Z"
				fill={`url(#${uid}-g)`}
				stroke={palette[1]}
				stroke-width="2"
			/>
			<ellipse
				cx="28"
				cy="42"
				rx="6"
				ry="9"
				fill="white"
				opacity=".38"
				transform="rotate(32 28 42)"
			/>
			<ellipse cx="42" cy="20" rx="6" ry="3" fill="white" opacity=".4" />
			<ellipse cx="23" cy="76" rx="6" ry="5" fill="white" opacity=".18" />
			{#if palette[2] === 'sleep'}
				<path d="M29 49h15M57 49h15" stroke="#344435" stroke-width="4" stroke-linecap="round" />
				<path d="M36 53v5M63 53v5" stroke="#273131" stroke-width="5" stroke-linecap="round" />
				<path
					d="M41 71q9-7 18 0"
					fill="none"
					stroke="#344435"
					stroke-width="3"
					stroke-linecap="round"
				/>
			{:else}
				<ellipse cx="36" cy="54" rx="10" ry="12" fill="#fff9f0" /><ellipse
					cx="63"
					cy="54"
					rx="10"
					ry="12"
					fill="#fff9f0"
				/>
				<ellipse cx="38" cy="55" rx="5" ry="7" fill="#30294a" /><ellipse
					cx="61"
					cy="55"
					rx="5"
					ry="7"
					fill="#30294a"
				/>
				<circle cx="39" cy="52" r="2" fill="white" /><circle cx="62" cy="52" r="2" fill="white" />
				{#if palette[2] === 'angry'}<path
						d="m27 39 16 7m14 0 15-7"
						fill="none"
						stroke="#593147"
						stroke-width="5"
						stroke-linecap="round"
					/>{/if}
				{#if palette[2] === 'wow'}<ellipse cx="50" cy="73" rx="6" ry="8" fill="#5a2c43" />
				{:else if palette[2] === 'sad' || palette[2] === 'angry'}<path
						d="M40 76q10-13 20 0"
						fill="#522842"
					/>
				{:else}<path d="M38 68q12 4 24 0q-2 18-13 15q-10-1-11-15" fill="#5c244c" /><ellipse
						cx="50"
						cy="79"
						rx="7"
						ry="4"
						fill="#ff7eaa"
					/>{/if}
			{/if}
			<ellipse cx="24" cy="65" rx="6" ry="4" fill="#ff5e85" opacity=".36" /><ellipse
				cx="77"
				cy="65"
				rx="6"
				ry="4"
				fill="#ff5e85"
				opacity=".36"
			/>
			{#if symbol === 'BASKET'}<path
					d="m20 75 9 17h44l8-17"
					fill="#c18934"
					stroke="#875825"
					stroke-width="2"
				/><path d="M30 85h40M40 76v16m18-16v16" stroke="#fbdc81" stroke-width="3" />{/if}
		</g>
	{/each}
</svg>

<style>
	.blob-art {
		width: 100%;
		height: 100%;
		display: block;
		filter: drop-shadow(0 3px 1px #66408a25);
	}
</style>

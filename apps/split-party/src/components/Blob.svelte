<script lang="ts">
	import EYES from '../lib/eyes.json';
	import FACES from '../lib/face-layers.json';
	import LiveEyes, { type Eye } from './LiveEyes.svelte';

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
	// Figma 11003:24523 symbol art (public/symbols). Boxes are the design's symbol frames
	// in a 74-unit pad scaled to the 100-unit viewBox; PLUM's frame is drawn taller.
	const ART: Record<string, [number, number, number, number]> = {
		WATERMELON: [0, 0, 100, 100],
		CHERRIES: [0, 0, 100, 100],
		GRAPES: [0, -0.7, 100, 101.4],
		STRAWBERRY: [0, 0, 100, 100],
		BLUEBERRY: [0, -0.7, 100, 101.4],
		ORANGE: [0, 0, 100, 100],
		LEMON: [0, -0.7, 100, 101.4],
		KIWI: [0, -0.7, 100, 101.4],
		PLUM: [0.7, -6.5, 98.6, 113],
		APPLE: [0, 0, 100, 100],
	};
	let palette = $derived(palettes[symbol] ?? palettes.ORANGE);
	let art = $derived(ART[symbol]);
	// Live eyes (scripts/build-eyes.py): only on full-size and half-size blobs, where they read.
	let eyes = $derived(units <= 2 ? ((EYES as Record<string, Eye[]>)[symbol] ?? []) : []);
	// Each blob gets its own look/blink phase so the board doesn't move in lockstep.
	let seed = $derived([...uid].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
	let lookDelay = $derived(`${-((seed % 97) / 97) * 5.6}s`);
	let blinkDelay = $derived(`${-(((seed >>> 7) % 89) / 89) * 4.4}s`);
	// Brows + mouth cut out of the art (scripts/build-face-layers.py) so they can move too.
	type Part = { src: string; x: number; y: number; w: number; h: number; cx: number; cy: number };
	type Cheek = { cx: number; cy: number; rx: number; ry: number };
	type Face = { base: string; brows: Part[]; mouth: Part | null; cheeks: Cheek[]; closed?: Part[] };
	let face = $derived(units <= 2 ? (FACES as Record<string, Face>)[symbol] : undefined);
	// Angry faces scowl (brows dip inward); everyone else raises theirs.
	let scowl = $derived(palette[2] === 'angry' || symbol === 'WATERMELON');
	let faceDelay = $derived(`${-(((seed >>> 13) % 83) / 83) * 6.2}s`);
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

<svg viewBox="0 0 100 100" aria-hidden="true" class="blob-art" class:has-art={!!art}>
	<defs
		><linearGradient id={`${uid}-g`} x1="0" y1="0" x2=".7" y2="1"
			><stop stop-color={palette[0]} /><stop offset="1" stop-color={palette[1]} /></linearGradient
		><radialGradient id={`${uid}-blush`}
			><stop stop-color="#fff" stop-opacity=".8" /><stop offset=".45" stop-color="#fff" stop-opacity=".45" /><stop
				offset="1"
				stop-color="#fff"
				stop-opacity="0"
			/></radialGradient
		></defs
	>
	{#each positions as [x, y, scale], m}
		<g transform={`translate(${x} ${y}) scale(${scale})`}>
			{#if art}
				<g
					transform={`translate(${art[0]} ${art[1]}) scale(${art[2] / 100} ${art[3] / 100})`}
				>
					<image href={face?.base ?? `/symbols/${symbol}.webp`} width="100" height="100" />
					{#each face?.cheeks ?? [] as c}
						<ellipse
							class="blush"
							cx={c.cx}
							cy={c.cy}
							rx={c.rx * 1.5}
							ry={c.ry * 1.25}
							fill={`url(#${uid}-blush)`}
							style={`animation-delay:${faceDelay}`}
						/>
					{/each}
					<LiveEyes {eyes} id={`${uid}-${m}`} {lookDelay} {blinkDelay} />
					{#if face}
						<!-- Painted-shut eyes (GRAPES' ^^): the arcs are a layer, and every few seconds
						     they give way to open eyes that take a peek around. -->
						{#each face.closed ?? [] as c}
							<image
								class="closed-eye"
								href={c.src}
								x={c.x}
								y={c.y}
								width={c.w}
								height={c.h}
								preserveAspectRatio="none"
								style={`animation-delay:${blinkDelay}`}
							/>
							<g class="open-eye" style={`animation-delay:${blinkDelay}`}>
								<ellipse
									cx={c.x + c.w / 2}
									cy={c.y + c.h * 0.7}
									rx={c.w * 0.42}
									ry={c.w * 0.47}
									fill="#fff"
									stroke="#6d27a8"
									stroke-opacity=".35"
									stroke-width=".8"
								/>
								<g class="pupil open-pupil" style={`animation-delay:${lookDelay}`}>
									<circle cx={c.x + c.w / 2} cy={c.y + c.h * 0.78} r={c.w * 0.21} fill="#2b1140" />
									<circle cx={c.x + c.w * 0.56} cy={c.y + c.h * 0.66} r={c.w * 0.07} fill="#fff" />
								</g>
							</g>
						{/each}
						{#each face.brows as b, j}
							<g
								class="brow"
								class:scowl
								style={`transform-origin:${b.cx}px ${b.cy}px;--tilt:${j ? 1 : -1};animation-delay:${faceDelay}`}
							>
								<image href={b.src} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="none" />
							</g>
						{/each}
						{#if face.mouth}
							{@const mo = face.mouth}
							<g
								class="mouth"
								style={`transform-origin:${mo.cx}px ${mo.y}px;animation-delay:${faceDelay}`}
							>
								<image href={mo.src} x={mo.x} y={mo.y} width={mo.w} height={mo.h} preserveAspectRatio="none" />
							</g>
						{/if}
					{/if}
				</g>
			{:else}
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
			{/if}
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
	.blob-art.has-art {
		overflow: visible;
		filter: none;
	}
	/* One 6.2s face cycle: brows lift (or scowl deeper) while the mouth opens and chatters. */
	.brow {
		animation: brow-lift 6.2s ease-in-out infinite;
	}
	.brow.scowl {
		animation-name: brow-scowl;
	}
	.mouth {
		animation: mouth-talk 6.2s ease-in-out infinite;
	}
	/* The painted cheek spots light up while it chatters and again with the closing grin
	   (white, not pink: pink over teal/blue bodies reads as grey). */
	.blush {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0;
		animation: blush 6.2s ease-in-out infinite;
	}
	@keyframes blush {
		0%,
		10%,
		50%,
		62%,
		84%,
		100% {
			opacity: 0;
			transform: scale(0.8);
		}
		22%,
		36% {
			opacity: 0.85;
			transform: scale(1.08);
		}
		70%,
		76% {
			opacity: 0.6;
			transform: scale(1);
		}
	}
	@keyframes brow-lift {
		0%,
		12%,
		40%,
		100% {
			transform: none;
		}
		18%,
		30% {
			transform: translateY(-2.2px) rotate(calc(var(--tilt) * -6deg));
		}
		62% {
			transform: none;
		}
		67%,
		74% {
			transform: translateY(-1.2px) rotate(calc(var(--tilt) * 4deg));
		}
		80% {
			transform: none;
		}
	}
	@keyframes brow-scowl {
		0%,
		12%,
		40%,
		100% {
			transform: none;
		}
		18%,
		30% {
			transform: translateY(1.3px) rotate(calc(var(--tilt) * 7deg));
		}
		66%,
		72% {
			transform: translateY(-1px);
		}
		78% {
			transform: none;
		}
	}
	@keyframes mouth-talk {
		0%,
		12%,
		44%,
		100% {
			transform: none;
		}
		19% {
			transform: scale(1.08, 1.32);
		}
		25% {
			transform: scale(0.96, 0.8);
		}
		31% {
			transform: scale(1.05, 1.22);
		}
		37% {
			transform: scale(0.98, 0.9);
		}
		66% {
			transform: none;
		}
		71% {
			transform: scale(1.12, 0.86);
		}
		78% {
			transform: none;
		}
	}
	/* Mostly the happy ^^; around 60% of a 7.4s cycle the eyes pop open, look about, shut. */
	.closed-eye {
		animation: closed-eye 7.4s ease-in-out infinite;
	}
	.open-eye {
		transform-box: fill-box;
		transform-origin: center;
		transform: scaleY(0);
		animation: open-eye 7.4s ease-in-out infinite;
	}
	.open-pupil {
		animation: open-look 7.4s ease-in-out infinite;
	}
	@keyframes closed-eye {
		0%,
		57%,
		84%,
		100% {
			opacity: 1;
		}
		59%,
		82% {
			opacity: 0;
		}
	}
	@keyframes open-eye {
		0%,
		57%,
		84%,
		100% {
			transform: scaleY(0);
		}
		61% {
			transform: scaleY(1.12);
		}
		63%,
		81% {
			transform: scaleY(1);
		}
	}
	@keyframes open-look {
		0%,
		64% {
			transform: none;
		}
		67%,
		71% {
			transform: translateX(-1.6px);
		}
		74%,
		78% {
			transform: translateX(1.6px);
		}
		81%,
		100% {
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.closed-eye,
		.open-eye,
		.open-pupil,
		.brow,
		.mouth,
		.blush {
			animation: none;
		}
	}
</style>

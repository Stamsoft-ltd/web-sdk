<script lang="ts">
	import { stateI18nDerived } from 'state-shared';

	type Props = { onstart: () => void };
	const props: Props = $props();
	const t = (key: string) => stateI18nDerived.translate(key);
	let started = false;
	const start = () => {
		if (started) return;
		started = true;
		props.onstart();
	};
	const veg = (name: string) => `./assets/veggie-salad/pixel/${name}.webp`;
	const splashArt = (name: string) => `./assets/veggie-salad/pixel/splash/${name}.webp`;
	const bgArt = (name: string) => `./assets/veggie-salad/pixel/background/${name}.webp`;
	/* Design 9200:145271 plants a crop either side of the board row. Each entry is that instance's
	   own box on the row, and the row was measured off the rendered design rather than read from the
	   node tree — the boards sit inside nested frames whose transforms do not match what they paint.
	   Re-measured 2026-09-15 against a fresh capture of the frame, where the row renders 1137px wide
	   and bottoms out at y639: every vegetable was located by matching this game's own PNG into that
	   image and scoring on pixel agreement, because a colour mask only ever finds the sliver of each
	   one that the vegetable in front of it does not cover. So 1 design px is 100/1137 cqw of the
	   stage, and the cluster rescales with the boards. Anchored to the stage's BOTTOM, since these
	   sit on the ground line. Painted back to front. */
	/* Fence row, Figma 9200:145271. Seven 211x110 tiles at y=416 whose left rail nub tucks onto the
	   previous post, which is why the pitch (~180) is narrower than the tile: the design shows the
	   resulting double posts and so do we. Design px → cqw of the scenery box (1200 wide). */
	const FENCE_X = [-36, 143, 324, 506, 693, 871, 1048];

	const GROUND = [
		{ name: 'broccoli', left: 92.49, bottom: 2.3, size: 11.91 },
		{ name: 'cauliflower', left: -15.39, bottom: -0.51, size: 15.87 },
		{ name: 'eggplant', left: 89.83, bottom: -3.1, size: 8.44 },
		{ name: 'tomato', left: 94.87, bottom: -7.39, size: 13.38 },
		{ name: 'carrot', left: -5.09, bottom: 5.21, size: 10.05 },
		{ name: 'corn', left: -0.37, bottom: -1.61, size: 11.17 },
		{ name: 'radish', left: -7.44, bottom: -4.59, size: 11.79 },
	];
	/* A splash that never moves reads as a screenshot. Everything below is generated once per mount,
	   so no two visits are identical, and it is driven by CSS animation rather than a rAF loop — the
	   splash is the one screen where the game's ticker is not running yet. */
	const rand = (min: number, max: number) => min + Math.random() * (max - min);

	/* Sky. Designs 9200:147720 and 9200:147725 are the SAME cloud at two sizes — their alpha masks
	   agree on 100% of pixels once scaled to a common size — so one sprite is installed and the size
	   lives here. Smaller clouds sit higher, drift slower and sit further back in the haze; that
	   depth cue is what makes a flat two-colour shape read as distance rather than as a small cloud. */
	const CLOUDS = Array.from({ length: 5 }, (_, i) => {
		const depth = rand(0, 1);
		const drift = 210 - depth * 120;
		return {
			id: i,
			/* A lane each, so five random tops cannot pile into one band. */
			top: rand(1, 7) + (i * 27) / 5,
			size: 7 + depth * 12,
			drift,
			/* Negative delay starts the loop mid-flight: the sky is already busy on frame one. */
			delay: -rand(0, drift),
			bob: rand(9, 16),
			bobDelay: -rand(0, 16),
			opacity: 0.6 + depth * 0.4,
		};
	});

	/* Grass flowers. Design 9200:145271 plants four of them on the bare grass either side of the
	   boards; measured off a fresh render of that frame they are one shape at two sizes — a plus of
	   3x3 blocks, white petals around a #FCBA02 centre, 36 design px across for the pair nearest
	   the boards and 27 for the outer pair. Positions are that frame's own percentages, so they
	   hold the corners at every aspect ratio. */
	const FLOWERS = [
		{ id: 'l1', left: 3.5, bottom: 13.1, size: 3 },
		{ id: 'l2', left: 7, bottom: 8.5, size: 2.25 },
		{ id: 'r1', left: 92.8, bottom: 16.6, size: 3 },
		{ id: 'r2', left: 95.6, bottom: 11.5, size: 2.25 },
	].map((flower) => ({ ...flower, sway: rand(3.4, 6.2), delay: -rand(0, 6) }));

	/* Idle motion for the crop. Leafy tops sway, round roots mostly breathe, and the amplitudes are
	   per vegetable so the cluster does not pulse as one object. Phase is randomised per mount. */
	const VEG_MOTION: Record<string, { sway: number; lift: number; dur: number }> = {
		broccoli: { sway: 2.2, lift: 1.8, dur: 4.6 },
		cauliflower: { sway: 1.4, lift: 1.2, dur: 5.8 },
		eggplant: { sway: 2.6, lift: 2.4, dur: 4.1 },
		tomato: { sway: 1.1, lift: 2.6, dur: 3.7 },
		carrot: { sway: 3.1, lift: 1.5, dur: 5.2 },
		corn: { sway: 2.4, lift: 1.9, dur: 6.1 },
		radish: { sway: 1.7, lift: 2.2, dur: 4.9 },
	};
	/* Portrait crop. The single board is 256px wide on a 360 phone, so the row's seven at the
	   row's sizes were seven thumbnails piled against its rails. Here they peep out from BEHIND
	   the board instead, three a side, each leaning off the rail at its own angle with a bit
	   under half of it hidden by the board, so both eyes still show — the same treatment as the portrait info panel's leaners:
	   "the veggies showing partially diagonal behind the board with text" (user, 2026-09-18).
	   Half, and drawn big: at a third showing they were small whole sprites floating in the
	   sky beside the board rather than crop tucked behind it ("does not look very good").
	   The tilt is the resting pose the idle sway swings about. `hide` is the share of the sprite's
	   own width the board covers, set per sprite so both eyes clear the rail once the tilt has
	   swung the face towards it — the faces sit left of centre, so the right rail hides less. The
	   right three used to sit 58% under, which put the broccoli's and eggplant's eyes behind the
	   rail ("the brokoli is almost not visible also the violet tangerine", user 2026-09-21). `at` is the
	   sprite's centre down the BOARD's height, and the sprite is the smaller of its design width
	   and a third of that height, so on a squat board (a wide portrait window caps it at 320px)
	   the three still step down the rail instead of the bottom pair dropping off it or the three
	   piling onto each other. Both are percentages of the sprite's own box, so they ride in the
	   idle transform (`--shift`, `--anchor`) rather than in left/top. Names are FILE names, and
	   the files are swapped (veggieAssets.ts): radish.webp is the cauliflower. */
	const GROUND_PORTRAIT = [
		{ name: 'carrot', side: 'left', at: 16, size: 30, hide: 42, tilt: -38 },
		{ name: 'radish', side: 'left', at: 50, size: 34, hide: 38, tilt: -12 },
		{ name: 'corn', side: 'left', at: 84, size: 31, hide: 42, tilt: -22 },
		{ name: 'broccoli', side: 'right', at: 17, size: 32, hide: 30, tilt: 20 },
		{ name: 'tomato', side: 'right', at: 51, size: 34, hide: 32, tilt: 12 },
		{ name: 'eggplant', side: 'right', at: 85, size: 29, hide: 32, tilt: 22 },
	] as const;
	type Crop = { name: string; left: number; bottom: number; size: number; tilt?: number };
	type Leaner = (typeof GROUND_PORTRAIT)[number];
	const cropStyle = (item: Crop) =>
		`left:${item.left}cqw; bottom:${item.bottom}cqw; width:${item.size}cqw; --tilt:${item.tilt ?? 0}deg`;
	const leanerStyle = (item: Leaner) =>
		`${item.side}:0; top:${item.at}%; height:min(${item.size}cqw, 34%); width:auto; --shift:${item.side === 'left' ? item.hide - 100 : 100 - item.hide}%; --anchor:-50%; --tilt:${item.tilt}deg`;
	const withMotion = <T extends { name: string }>(list: readonly T[]) =>
		list.map((item) => ({ ...item, ...VEG_MOTION[item.name], delay: -rand(0, 6) }));
	const ground = withMotion(GROUND).map((item) => ({ ...item, style: cropStyle(item) }));
	const groundPortrait = withMotion(GROUND_PORTRAIT).map((item) => ({
		...item,
		style: leanerStyle(item),
	}));

	const reducedMotion = () =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* The scatter sprite is authored with its eyes shut, so on the splash the king just sat there
	   squinting for ever. `scatter_open` is that same sprite with the two closed arcs replaced by
	   open eyes in the set's own style, and the authored closed-eye frame is what a blink swaps
	   back to — so the blink is the original art, not an invented one. */
	let kingBlinking = $state(false);
	$effect(() => {
		if (reducedMotion()) return;
		let timer: ReturnType<typeof setTimeout>;
		const at = (ms: number, fn: () => void) => {
			timer = setTimeout(fn, ms);
		};
		const blink = (again: number) => {
			kingBlinking = true;
			at(120, () => {
				kingBlinking = false;
				if (again > 0) at(170, () => blink(again - 1));
				else at(rand(2400, 5600), () => blink(Math.random() < 0.3 ? 1 : 0));
			});
		};
		at(rand(1200, 3000), () => blink(0));
		return () => clearTimeout(timer);
	});

	/* The crop's eyes. Each vegetable has three derived frames next to the splash art — the eyes
	   slid one art pixel left or right, and shut — cut from its own sprite by
	   scripts/build-splash-eyes.py, so a glance is the authored eye moving, not a new drawing.
	   Every vegetable runs its own clock: a long hold, then either a glance to one side that is
	   held for under a second, or a blink (sometimes doubled, as the king's is), with the phases
	   randomised per vegetable and per mount so the seven never move together. "Make the white in
	   the eyes move so they look real" (user, 2026-09-16). */
	type EyeFrame = 'base' | 'look-l' | 'look-r' | 'blink';
	const EYE_FRAMES: EyeFrame[] = ['look-l', 'look-r', 'blink'];
	let eyeFrames = $state<Record<string, EyeFrame>>(
		Object.fromEntries(GROUND.map((item) => [item.name, 'base'])),
	);
	const vegFrame = (name: string, frame: EyeFrame) =>
		frame === 'base' ? veg(name) : splashArt(`${name}-${frame}`);
	$effect(() => {
		if (reducedMotion()) return;
		// Decoded before the first swap so a glance never flashes through an unloaded frame.
		for (const item of GROUND) {
			for (const frame of EYE_FRAMES) {
				const img = new Image();
				img.src = vegFrame(item.name, frame);
			}
		}
		const timers = new Map<string, ReturnType<typeof setTimeout>>();
		const at = (name: string, ms: number, fn: () => void) => {
			timers.set(name, setTimeout(fn, ms));
		};
		const set = (name: string, frame: EyeFrame) => {
			eyeFrames[name] = frame;
		};
		const rest = (name: string) => at(name, rand(1500, 4000), () => act(name));
		const blink = (name: string, again: number) => {
			set(name, 'blink');
			at(name, rand(130, 170), () => {
				set(name, 'base');
				if (again > 0) at(name, 150, () => blink(name, again - 1));
				else rest(name);
			});
		};
		const glance = (name: string) => {
			set(name, Math.random() < 0.5 ? 'look-l' : 'look-r');
			at(name, rand(400, 900), () => {
				set(name, 'base');
				rest(name);
			});
		};
		const act = (name: string) => {
			if (Math.random() < 0.55) glance(name);
			else blink(name, Math.random() < 0.3 ? 1 : 0);
		};
		for (const item of GROUND) at(item.name, rand(600, 3600), () => act(item.name));
		return () => timers.forEach((timer) => clearTimeout(timer));
	});

	/* Portrait carousel. On a phone held upright the three boards become ONE board that shows
	   each one in turn, 3s apiece, cross-fading in place — the same treatment as the studio's
	   other games (forest-gang's SplashIntro): "see how it's done in other slots, one beautiful
	   item and automatic carousel" (user, 2026-09-17). All three boards stay mounted and stacked so
	   the outgoing and incoming copy share one box; in landscape they sit in a row and `slide`
	   does nothing. The orientation is read off the same media query the styles switch on. */
	const SLIDE_COUNT = 3;
	let slide = $state(0);
	let isPortrait = $state(false);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const portrait = window.matchMedia('(orientation: portrait)');
		let timer: ReturnType<typeof setInterval> | undefined;
		const sync = () => {
			clearInterval(timer);
			slide = 0;
			isPortrait = portrait.matches;
			if (!portrait.matches) return;
			timer = setInterval(() => (slide = (slide + 1) % SLIDE_COUNT), 3000);
		};
		sync();
		portrait.addEventListener('change', sync);
		return () => {
			clearInterval(timer);
			portrait.removeEventListener('change', sync);
		};
	});

	const handleKey = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' && event.code !== 'Space') return;
		event.preventDefault();
		start();
	};
</script>

<svelte:window onkeydown={handleKey} />

<div
	class="splash-screen"
	role="button"
	tabindex="0"
	aria-label={t('CLICK ANYWHERE TO CONTINUE')}
	onclick={start}
	onkeydown={handleKey}
>
	<!-- Scenery, Figma 9200:145271: flat sky over flat ground, the base game's mountain silhouette
	     across the horizon and a fence row on the grass. The box keeps the design's 1200x670 and
	     covers the viewport, so the horizon and fence stay where the design put them at any
	     aspect and the surplus crops off the sides, the way the old cover-fit backdrop did. -->
	<div class="splash-scenery" aria-hidden="true">
		<img class="scenery-mountains" src={bgArt('base-mountains')} alt="" />
		{#each FENCE_X as x (x)}
			<img
				class="scenery-fence"
				src={bgArt('base-bench')}
				alt=""
				style="left:{(x / 12).toFixed(2)}cqw"
			/>
		{/each}
	</div>
	<div class="splash-sky" aria-hidden="true">
		{#each CLOUDS as cloud (cloud.id)}
			<span
				class="cloud"
				style="--top:{cloud.top}%; --size:{cloud.size}vw; --drift:{cloud.drift}s; --delay:{cloud.delay}s; --bob:{cloud.bob}s; --bob-delay:{cloud.bobDelay}s; --cloud-opacity:{cloud.opacity}"
			>
				<img src={splashArt('cloud')} alt="" />
			</span>
		{/each}
	</div>
	<div class="splash-flowers" aria-hidden="true">
		{#each FLOWERS as flower (flower.id)}
			<img
				src={splashArt('flower')}
				alt=""
				style="left:{flower.left}%; bottom:{flower.bottom}%; width:{flower.size}vw; --dur:{flower.sway}s; --delay:{flower.delay}s"
			/>
		{/each}
	</div>
	<img
		class="studio-logo"
		src="./assets/veggie-salad/pixel/loading/press_play_logo.webp"
		alt="Press Play"
	/>
	<img class="game-logo" src="./assets/veggie-salad/pixel/logo.webp" alt="Veggie Salad" />
	<div class="splash-stage">
		<div class="splash-panels">
			<div class:slide-on={slide === 0}>
				<strong>{t('WELCOME TO')}<br />{' '}{t('THE GARDEN')}</strong>
				<span class="font-copy">{t('SPLASH GARDEN COPY')}</span>
			</div>
			<div class:slide-on={slide === 1}>
				<strong>{t('3 UNIQUE')}<br />{' '}{t('BONUSES')}</strong>
				<span class="font-copy">{t('SPLASH BONUS COPY')}</span>
				<span class="panel-king" aria-hidden="true">
					<img src={veg(kingBlinking ? 'scatter' : 'scatter_open')} alt="" />
				</span>
			</div>
			<!-- The design's third board carries the heading and the figure and nothing else. -->
			<div class="panel-max" class:slide-on={slide === 2}>
				<strong
					>{t('MAX WIN')}{#if t('MAX WIN OF').trim()}<br />{' '}{t('MAX WIN OF')}{/if}</strong
				>
				<em>25,000×</em>
			</div>
		</div>
		<!-- Ground crop. The design plants two clusters either side of the boards, overlapping them;
		     every box below is the Figma instance box mapped onto the board row. -->
		<div class="splash-veg" aria-hidden="true">
			{#each isPortrait ? groundPortrait : ground as item (item.name)}
				<img
					class="veg veg-{item.name}"
					src={vegFrame(item.name, eyeFrames[item.name])}
					alt=""
					style="{item.style}; --sway:{item.sway}; --lift:{item.lift}; --dur:{item.dur}s; --delay:{item.delay}s"
				/>
			{/each}
		</div>
	</div>
	<!-- Portrait only: which board the single board is showing. -->
	<div class="splash-dots" aria-hidden="true">
		{#each Array(SLIDE_COUNT) as _, i (i)}
			<span class="dot" class:dot-on={slide === i}></span>
		{/each}
	</div>
	<p class="continue-label font-copy">
		{t('CLICK ANYWHERE TO CONTINUE')}<span class="continue-arrow" aria-hidden="true">→</span>
	</p>
</div>

<style>
	.splash-screen {
		position: fixed;
		inset: 0;
		z-index: 110;
		display: grid;
		grid-template-rows: auto auto auto auto;
		place-content: center;
		justify-items: center;
		/* One width feeds the wordmark and the board row, so the row's tuck under the wordmark
		   (below) is a fixed share of the art whatever the viewport does. */
		--logo-w: min(760px, 72vw);
		--splash-gap: clamp(8px, 1.6vh, 20px);
		gap: var(--splash-gap);
		padding: 16px;
		overflow: hidden;
		/* Design's flat sky and ground; the horizon sits at 367 of 670. The scenery box below
		   repeats the split so it holds at any aspect, this is the fallback under it. */
		background: linear-gradient(#36adfc 0 54.8%, #659337 54.8% 100%);
		font-family: 'Jersey 10', monospace;
		image-rendering: pixelated;
		cursor: pointer;
		outline: none;
	}
	/* ── Scenery ─────────────────────────────────────────────────────────────────────────────
	   A 1200x670 box scaled to cover the viewport; 1 design px = 100/1200 cqw in both axes (the
	   box is inline-size contained, so vertical offsets are written in cqw too). */
	.splash-scenery {
		position: absolute;
		top: 50%;
		left: 50%;
		width: max(100vw, calc(100vh * 1200 / 670));
		aspect-ratio: 1200 / 670;
		transform: translate(-50%, -50%);
		z-index: 0;
		overflow: hidden;
		pointer-events: none;
		container-type: inline-size;
		background: linear-gradient(#36adfc 0 54.8%, #659337 54.8% 100%);
	}
	/* Figma box (-36, 218, 1236x269): the silhouette runs off both edges and its solid foot
	   overlaps the grass down to y=487, which is where the fence stands. */
	.scenery-mountains {
		position: absolute;
		left: -3cqw;
		top: 18.17cqw;
		width: 103cqw;
		height: 22.42cqw;
		object-fit: cover;
		object-position: center bottom;
		image-rendering: pixelated;
	}
	.scenery-fence {
		position: absolute;
		top: 34.67cqw;
		width: 17.58cqw;
		height: 9.17cqw;
		image-rendering: pixelated;
	}
	/* ── Sky ───────────────────────────────────────────────────────────────────────────────────
	   Clouds cross on one wind, each on its own lane, speed and haze. The bob is a second animation
	   on the image itself so the two cycles beat against each other rather than the whole sky
	   sliding as one sheet, which is what a single shared keyframe always looks like. */
	.splash-sky {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
	.cloud {
		position: absolute;
		top: var(--top);
		left: 0;
		display: block;
		width: var(--size);
		animation: cloud-drift var(--drift) linear var(--delay) infinite;
		will-change: transform;
	}
	.cloud img {
		display: block;
		width: 100%;
		height: auto;
		opacity: var(--cloud-opacity);
		image-rendering: pixelated;
		animation: cloud-bob var(--bob) ease-in-out var(--bob-delay) infinite;
	}
	@keyframes cloud-drift {
		from {
			transform: translateX(-110%);
		}
		to {
			transform: translateX(100vw);
		}
	}
	@keyframes cloud-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-7%);
		}
	}
	.splash-flowers {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
	.splash-flowers img {
		position: absolute;
		min-width: 12px;
		height: auto;
		transform-origin: 50% 100%;
		image-rendering: pixelated;
		animation: flower-sway var(--dur) ease-in-out var(--delay) infinite;
	}
	@keyframes flower-sway {
		0%,
		100% {
			transform: rotate(-4deg);
		}
		50% {
			transform: rotate(4deg);
		}
	}
	/* Grid items honour z-index without being positioned, so this is all it takes to keep the sky
	   behind the screen's actual content. */
	.studio-logo,
	.game-logo,
	.splash-stage,
	.splash-dots,
	.continue-label {
		z-index: 1;
	}
	/* Landscape lays the boards out in a row; the carousel's dots only exist in portrait. */
	.splash-dots {
		display: none;
	}
	.studio-logo {
		width: min(170px, 24vw);
		height: auto;
		filter: drop-shadow(2px 3px 0 rgb(0 45 83 / 45%));
	}
	.game-logo {
		width: var(--logo-w);
		height: auto;
		image-rendering: pixelated;
		/* Over the boards: the design hangs the wordmark's bar across their top edge. */
		z-index: 2;
	}
	/* ── Splash boards ─────────────────────────────────────────────────────────────────────────
	   Design 9200:145271, a 1200x670 frame. Three SEPARATE boards, not one bar split by hairlines:
	   each is 256x299 on a 275 pitch, so 19px of sky shows between them and the row spans 806.
	   The frame reads out of the art as 2px #2C1901 / 5px #844A0D / 2px #2C1901 around a #42561F
	   field, which is what the shadow stack below draws. */
	.splash-stage {
		/* The crop is positioned in cqw, so the stage — not the viewport — is the unit the whole
		   cluster scales against, exactly as it scales against the board row in the design. */
		container-type: inline-size;
		position: relative;
		/* The boards tuck UNDER the wordmark, 9200:145271: the wordmark image (857x304, from y70)
		   runs to y374 while the board row starts at y261, so the row's top sits 62.8% of the way
		   down the image and the bar's underside covers the boards' top rail. That is 13.2% of the
		   wordmark's width, plus the grid gap the rows would otherwise keep between them. A clamp
		   in vh here ("how logo is over them", user 2026-09-16) left a strip of sky between the two
		   on any window taller than the tuck it capped at. */
		margin-top: calc(var(--logo-w) * -0.132 - var(--splash-gap));
		/* 825 of the wordmark's 857: the row is a touch narrower than the bar above it, and the
		   crop of vegetables either side hangs off the row, not the viewport. */
		width: calc(var(--logo-w) * 0.9627);
	}
	.splash-panels {
		--splash-title: clamp(19px, 3.2vw, 38px);
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(8px, 1.9vw, 19px);
		width: 100%;
		border: 0;
		background: none;
		box-shadow: none;
	}
	.splash-veg {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.splash-veg .veg {
		position: absolute;
		height: auto;
		transform-origin: 50% 100%;
		/* The resting pose, for when reduced motion drops the idle below. */
		transform: translate(var(--shift, 0%), var(--anchor, 0%)) rotate(var(--tilt, 0deg));
		image-rendering: pixelated;
		animation: veg-idle var(--dur) ease-in-out var(--delay) infinite;
	}
	/* Rooted at the ground line and leaning, rather than floating: the rotation pivots on the base
	   and the lift is small enough that nothing ever leaves the soil. `--shift`/`--anchor` are the
	   portrait leaners' own-box offsets (tuck under the rail, centre on the row); 0 in landscape. */
	@keyframes veg-idle {
		0%,
		100% {
			transform: translate(var(--shift, 0%), var(--anchor, 0%))
				rotate(calc(var(--tilt, 0deg) + var(--sway) * -1deg));
		}
		50% {
			transform: translate(var(--shift, 0%), calc(var(--anchor, 0%) - var(--lift) * 1%))
				rotate(calc(var(--tilt, 0deg) + var(--sway) * 1deg));
		}
	}
	/* The king potato straddles board 2's bottom edge in the design — 101 of the board's 239px inner
	   width, hanging 23px below it. Absolute so it cannot push the copy around. */
	.panel-king {
		position: absolute;
		bottom: -7.9%;
		left: 50%;
		width: 42%;
		/* Centring lives on `translate` so the hop below owns `transform` outright. */
		translate: -50% 0;
		animation: king-hop 3.4s cubic-bezier(0.34, 0, 0.36, 1) infinite;
	}
	.panel-king img {
		display: block;
		width: 100%;
		height: auto;
		transform-origin: 50% 85%;
		image-rendering: pixelated;
		animation: king-tilt 5.1s ease-in-out infinite;
	}
	/* The king gets a hop the crop does not: he is the one character on the screen, and a long hold
	   followed by a double bounce reads as a decision rather than as a loop. The tilt runs on a
	   different period so the two never line up twice in a row. */
	@keyframes king-hop {
		0%,
		62%,
		100% {
			transform: translateY(0);
		}
		72% {
			transform: translateY(-9%);
		}
		84% {
			transform: translateY(0);
		}
		90% {
			transform: translateY(-3%);
		}
	}
	@keyframes king-tilt {
		0%,
		100% {
			transform: rotate(-2.4deg) scale(1, 1);
		}
		50% {
			transform: rotate(2.4deg) scale(0.99, 1.012);
		}
	}
	.splash-panels div {
		position: relative;
		display: grid;
		/* The design hangs all three headings from the TOP of their board, on one line across the
		   row — centring the contents instead put each heading at a different height, because the
		   three boards carry different amounts of copy. */
		align-content: start;
		gap: clamp(8px, 1.6vh, 18px);
		min-height: clamp(150px, 45vh, 299px);
		padding: clamp(16px, 3.4vh, 38px) clamp(10px, 1.8vw, 22px) clamp(10px, 1.8vw, 22px);
		border: 5px solid #844a0d;
		background: #42561f;
		box-shadow:
			0 0 0 2px #2c1901,
			inset 0 0 0 2px #2c1901;
		text-align: center;
	}
	/* Measured off the rendered design against the board row's own width: the two-line headings set
	   a 20.6px cap and the max-win heading a 26.9px one, which Jersey 10 reaches at 38px and 50px
	   here. The design also sets the two lines much tighter than 1.35 — 41.8px between cap tops,
	   which is a 1.12 line box at this size. */
	.splash-panels strong {
		color: #fe9c05;
		/* Two lines' worth of box whatever the heading actually runs to, so the copy under it — and
		   the max-win figure, which is a one-line heading's worth higher without this — starts on
		   the same line across all three boards, as it does in the design. */
		min-height: calc(var(--splash-title) * 2.24);
		font-size: var(--splash-title);
		line-height: 1.12;
	}
	.splash-panels div:nth-child(2) strong {
		color: #8ab333;
	}
	.splash-panels div:nth-child(3) strong {
		color: #36adfc;
		font-size: clamp(25px, 4.2vw, 50px);
	}
	.splash-panels .panel-max em {
		color: #d89739;
		font-size: clamp(26px, 4.4vw, 53px);
		font-style: normal;
		line-height: 1;
	}
	/* Poppins. The design sets every sentence on this screen in the copy face; in Jersey 10 the
	   four-line garden blurb was the same wall of stems as the bonus menu's card text. */
	.splash-panels span {
		color: #fff;
		font-size: clamp(9px, 1.42vw, 17px);
		line-height: 1.4;
	}
	.continue-label {
		display: inline-flex;
		gap: 0.5em;
		align-items: center;
		margin: 4px 0 0;
		color: #fff;
		font-size: clamp(11px, 1.42vw, 17px);
		font-weight: 400;
		letter-spacing: 0.06em;
		text-shadow: 2px 2px 0 rgb(21 26 7 / 55%);
		animation: continue-blink 1.2s steps(2, end) infinite;
	}
	.continue-arrow {
		font-size: 1.15em;
		line-height: 1;
	}
	@keyframes continue-blink {
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.cloud,
		.cloud img,
		.splash-flowers img,
		.splash-veg .veg,
		.panel-king,
		.panel-king img,
		.continue-label {
			animation: none;
		}
	}
	@media (max-width: 680px) {
		.splash-screen {
			gap: 10px;
			padding: 10px;
		}
		.studio-logo {
			width: min(140px, 38vw);
		}
		.splash-screen {
			--logo-w: 94vw;
		}
		.splash-stage {
			width: 96vw;
		}
		.splash-panels {
			gap: 5px;
		}
		/* Below this width the boards are barely taller than their own headings; the crop's designed
		   overhang would hang off the viewport rather than off the boards. */
		.splash-veg {
			display: none;
		}
		.splash-panels div {
			min-height: clamp(86px, 20vh, 124px);
			padding: 8px 5px;
			border-width: 3px;
		}
		.splash-panels strong,
		.splash-panels div:nth-child(3) strong {
			font-size: clamp(10px, 3.2vw, 16px);
		}
		.splash-panels .panel-max em {
			font-size: clamp(11px, 3.6vw, 18px);
		}
		.splash-panels span {
			font-size: 9px;
		}
	}

	/* ── Portrait ──────────────────────────────────────────────────────────────────────────────
	   The design's board row is a landscape composition; on a phone held upright three boards
	   stacked in a column were three thin strips of copy. Same answer as the studio's other games
	   (forest-gang's SplashIntro): ONE board under the wordmark, showing each of the three in turn
	   on a 3s cross-fade with dots under it, and because the board is the full row's width the
	   crop hangs off its sides and the king stands on its bottom rail exactly as they hang off the
	   row in the design — "one beautiful item and automatic carousel" (user, 2026-09-17). After
	   the narrow-width pass above so it wins the shared widths. */
	@media (orientation: portrait) {
		.splash-screen {
			/* 70vw rather than the 86 the column used: the leaners show about 40% of themselves
			   past the board's rails, and that needs a margin either side to show it in. */
			--logo-w: min(560px, 70vw);
			--splash-gap: clamp(6px, 1.2vh, 14px);
			gap: var(--splash-gap);
			padding: 12px;
		}
		.studio-logo {
			width: min(150px, 34vw);
		}
		.splash-stage {
			width: calc(var(--logo-w) * 0.9627);
		}
		/* The frame moves from the three boards onto their container, and the three become
		   stacked slides in its one cell. */
		.splash-panels {
			--splash-title: clamp(20px, 8vw, 34px);
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
			gap: 0;
			min-height: clamp(190px, 40vh, 320px);
			border: 4px solid #844a0d;
			background: #42561f;
			box-shadow:
				0 0 0 2px #2c1901,
				inset 0 0 0 2px #2c1901;
		}
		.splash-panels div {
			grid-area: 1 / 1;
			gap: clamp(8px, 1.8vh, 16px);
			min-height: 0;
			padding: clamp(14px, 3vh, 26px) clamp(10px, 4vw, 20px);
			border: 0;
			background: none;
			box-shadow: none;
			opacity: 0;
			transition: opacity 450ms ease;
		}
		.splash-panels div.slide-on {
			opacity: 1;
		}
		/* Two-line headings as the design sets them, sized for a board that is the row's width. */
		.splash-panels strong,
		.splash-panels div:nth-child(3) strong {
			min-height: 0;
			font-size: var(--splash-title);
			line-height: 1.1;
		}
		.splash-panels div:nth-child(3) strong {
			font-size: calc(var(--splash-title) * 1.2);
		}
		.splash-panels .panel-max em {
			font-size: calc(var(--splash-title) * 1.9);
		}
		.splash-panels span {
			max-width: 30ch;
			margin: 0 auto;
			font-size: clamp(12px, 3.8vw, 16px);
			line-height: 1.4;
		}
		/* Back on, and BEHIND the board: the leaners pivot on their own centres, so the tilt reads
		   as a lean out from under the rail rather than a topple off the ground line. */
		.splash-veg {
			display: block;
			z-index: 0;
		}
		.splash-veg .veg {
			transform-origin: 50% 50%;
		}
		.splash-panels {
			position: relative;
			z-index: 1;
		}
		.panel-king {
			display: block;
			bottom: -6%;
			width: 36%;
		}
		.splash-dots {
			display: flex;
			gap: clamp(6px, 2.2vw, 10px);
			/* Clear of the king, who hangs 6% of the board below its rail. */
			margin-top: clamp(8px, 1.8vh, 16px);
		}
		.dot {
			width: clamp(7px, 2.4vw, 11px);
			height: clamp(7px, 2.4vw, 11px);
			border: 1px solid #2c1901;
			background: rgb(255 255 255 / 40%);
		}
		.dot-on {
			background: #fee302;
		}
		.continue-label {
			margin-top: 0;
			font-size: clamp(11px, 3.4vw, 16px);
		}
	}
	@media (orientation: portrait) and (prefers-reduced-motion: reduce) {
		.splash-panels div {
			transition: none;
		}
	}

	@media (max-height: 520px) and (orientation: landscape) {
		.splash-screen {
			grid-template-rows: auto auto auto auto;
			gap: clamp(2px, 1vh, 8px);
			padding: 4px;
			place-content: center;
		}
		.studio-logo {
			width: clamp(52px, 15vh, 78px);
		}
		.game-logo {
			width: min(58vw, 64vh);
		}
		.splash-stage {
			/* The tuck exists to slide the boards under the wordmark's transparent leaf padding, so
			   it can only ever be a fraction of the wordmark's OWN height. At -9vh it was sized off
			   the viewport instead, and on a 390-tall shell that is half the whole wordmark — which
			   is why the boards were sitting across the middle of it. */
			margin-top: clamp(-22px, -2.6vh, -4px);
			width: min(806px, calc(100vw - 16px));
		}
		.splash-panels {
			/* Overriding the token rather than the headings themselves: the base reserves two lines
			   of heading above the copy as `--splash-title * 2.24`, so setting `strong`'s size alone
			   left a desktop-sized reserve inside a phone-sized board and pushed the copy to the
			   floor. */
			--splash-title: clamp(12px, 4.2vh, 22px);
			gap: 4px;
		}
		/* The crop hangs 13cqw past the board row, and on a shell this wide the stage already runs
		   to within a few px of the frame — there is nowhere for it to hang, so it stays hidden. */
		.splash-veg,
		.panel-king {
			display: none;
		}
		.splash-panels div {
			gap: 2px;
			min-height: clamp(80px, 34vh, 165px);
			padding: 5px 5px 6px;
			border-width: 3px;
			box-shadow:
				0 0 0 1px #2c1901,
				inset 0 0 0 1px #2c1901;
		}
		.splash-panels strong {
			line-height: 1.15;
		}
		.splash-panels div:nth-child(3) strong {
			font-size: calc(var(--splash-title) * 1.25);
			line-height: 1.15;
		}
		.splash-panels .panel-max em {
			font-size: calc(var(--splash-title) * 1.3);
		}
		.splash-panels span {
			font-size: clamp(8px, 2.4vh, 12px);
			line-height: 1.25;
		}
		.continue-label {
			/* Clear of the king, who hangs 7.9% of a board below its bottom edge. */
			margin: clamp(10px, 3.2vh, 20px) 0 0;
			font-size: clamp(9px, 3vh, 16px);
			line-height: 1;
			text-shadow: 1px 1px 0 #351a07;
		}
	}

	/* The king does not hang off the board row, only off his own board, so once the boards are tall
	   enough to keep his crown clear of the copy he comes back: the design fills the space under the
	   copy with him, and without him these boards read as empty. The boards are 34vh here, and below
	   ~400px of shell that leaves no slack under the copy for him to stand in. */
	@media (min-height: 400px) and (max-height: 520px) and (orientation: landscape) {
		.splash-panels .panel-king {
			display: block;
			/* Three-tenths of the board rather than the full-height 42%: the boards are 34vh here and
			   the copy sits where the design's empty space would be, so he has to stand under it. */
			width: 30%;
		}
	}
</style>

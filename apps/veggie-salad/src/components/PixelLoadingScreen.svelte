<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentProps } from 'svelte';
	import { Container, Graphics, Sprite, Rectangle } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { preloadImages } from '../game/preloadImages';
	import { PRELOAD_IMAGES } from '../game/preloadList';

	type Props = { onloaded: () => void };
	const props: Props = $props();
	const context = getContext();

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	let notified = false;

	onMount(() => {
		const timeout = window.setTimeout(() => (minTimeElapsed = true), MIN_LOADER_MS);
		return () => window.clearTimeout(timeout);
	});

	/* The HTML side of the game (board, backgrounds, creatures, HUD, info pages, splash) is
	   fetched and decoded here alongside the pixi manifest, so nothing loads on first sight in
	   play. Half the fill each. */
	let imageProgress = $state(0);
	let imagesLoaded = $state(false);
	onMount(() => {
		let cancelled = false;
		preloadImages(PRELOAD_IMAGES, (fraction) => {
			if (!cancelled) imageProgress = fraction * 100;
		}).then(() => {
			if (!cancelled) imagesLoaded = true;
		});
		return () => {
			cancelled = true;
		};
	});
	const everythingLoaded = $derived(context.stateApp.loaded && imagesLoaded);

	$effect(() => {
		if (!everythingLoaded || !minTimeElapsed || notified) return;
		notified = true;
		props.onloaded();
	});

	/* ── Press Play loader, design 9298:295019 ─────────────────────────────────────────────────
	   Twelve frames: a grey badge whose red fills left to right behind a white P, beside the
	   wordmark (always up, see wordAlpha). The fill is read off the asset counter but
	   held at 95 until everything has actually landed — this game preloads three files, so the
	   raw counter jumps 0 → 33 → 66 → 100 in a few frames and the sweep would never be seen.
	   Eased per frame rather than bound straight to the counter so the last step is a slide, not
	   a jump. */
	let fill = $state(0);
	onMount(() => {
		let id = 0;
		const tick = () => {
			const target = everythingLoaded
				? 100
				: Math.min(95, (context.stateApp.loadingProgress + imageProgress) / 2);
			fill += (target - fill) * 0.08;
			if (target - fill < 0.2) fill = target;
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	/* Design 9200:148971 is a 1200x670 frame: the garden fills it, a flat black 50% sits over the
	   whole thing, and the lockup is centred on both axes. */
	const GARDEN_W = 1200;
	const GARDEN_H = 670;
	const gardenScale = $derived(Math.max(canvas.width / GARDEN_W, canvas.height / GARDEN_H));

	/* The lockup is a 355.479-wide row — an 86 badge, a 32 gap and a 237.479x49.117 wordmark —
	   which is 29.62% of the frame's width and 53.06% of its height. Both terms agree at the
	   design's aspect; keeping both means a portrait canvas sizes it off the short edge instead of
	   letting it run off the sides. */
	const LOCKUP_W = 355.479;
	const BADGE = 86 / LOCKUP_W;
	const GAP = 32 / LOCKUP_W;
	const WORD_W = 237.479 / LOCKUP_W;
	const WORD_ASPECT = 49.117 / 237.479;
	const BADGE_RADIUS = 8 / 86;
	// Design 9298:295160 insets the P by 33.06%/20.27%/32.06%/20.05% of the badge.
	const P_X = 0.3306;
	const P_Y = 0.2027;
	const P_W = 0.3488;
	const P_H = 0.5968;

	const lockupWidth = $derived(Math.min(canvas.width * 0.2962, canvas.height * 0.5306, 430));
	const badgeSize = $derived(lockupWidth * BADGE);
	const wordWidth = $derived(lockupWidth * WORD_W);
	const centreX = $derived(canvas.width * 0.5);
	const centreY = $derived(canvas.height * 0.5);
	const lockupLeft = $derived(centreX - lockupWidth * 0.5);

	const progress = $derived(Math.max(0, Math.min(1, fill / 100)));
	// The design puts the wordmark on the last frame only, but that reads as a flash on a phone,
	// where the sweep is over in a blink ("make the white press play text always stay", user
	// 2026-09-18): it is up for the whole loader, and only the badge's red tells the progress.
	const wordAlpha = 1;

	/* The red is the badge clipped at the fill line, so its right edge is a straight cut for most
	   of the sweep and only rounds off as it reaches the badge's own corner. */
	// Taken off the component rather than imported from pixi.js: an app that depends on pixi.js
	// directly picks up a second copy of its style types and svelte-check floods with conflicts.
	type GraphicsContext = Parameters<ComponentProps<typeof Graphics>['draw']>[0];
	const drawBadge = (g: GraphicsContext) => {
		const size = badgeSize;
		const r = size * BADGE_RADIUS;
		g.roundRect(0, 0, size, size, r).fill(0xe3e3e3);
		const w = size * progress;
		if (w <= 0.5) return;
		if (w <= r) {
			g.roundRect(0, 0, w, size, Math.min(r, w * 0.5)).fill(0xd1300b);
			return;
		}
		const rr = Math.max(0, Math.min(r, w - (size - r)));
		g.moveTo(r, 0)
			.lineTo(w - rr, 0)
			.arcTo(w, 0, w, rr, rr)
			.lineTo(w, size - rr)
			.arcTo(w, size, w - rr, size, rr)
			.lineTo(r, size)
			.arcTo(0, size, 0, size - r, r)
			.lineTo(0, r)
			.arcTo(0, 0, r, 0, r)
			.closePath()
			.fill(0xd1300b);
	};
</script>

<!-- Sky rect behind the garden so the frame before the texture resolves is not black. -->
<Rectangle {...canvas} backgroundColor={0x36adfc} />
<Sprite
	key="loadingGarden"
	anchor={0.5}
	x={centreX}
	y={centreY}
	width={GARDEN_W * gardenScale}
	height={GARDEN_H * gardenScale}
/>
<Rectangle {...canvas} backgroundColor={0x000000} backgroundAlpha={0.5} />

<Container x={lockupLeft} y={centreY - badgeSize * 0.5}>
	<Graphics draw={drawBadge} />
	<Sprite
		key="pressPlayP"
		x={badgeSize * P_X}
		y={badgeSize * P_Y}
		width={badgeSize * P_W}
		height={badgeSize * P_H}
	/>
	<Sprite
		key="pressPlayWordmark"
		alpha={wordAlpha}
		x={badgeSize + lockupWidth * GAP}
		y={(badgeSize - wordWidth * WORD_ASPECT) * 0.5}
		width={wordWidth}
		height={wordWidth * WORD_ASPECT}
	/>
</Container>

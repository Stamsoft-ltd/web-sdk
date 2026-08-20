<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Graphics, Rectangle, Sprite, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { backgroundCover } from '../game/sceneBackground';

	// Everything here is wrapped in ONE container carrying this zIndex, and the number has to beat
	// anything else parented to the app root while loading. <Background /> only appends its sprite
	// once the background image has downloaded — i.e. AFTER this screen mounted — so with both at the
	// default zIndex 0 pixi's stable sort puts the newcomer last and the background draws straight
	// over the loader. The zIndex cannot go on <MainContainer>: that component spreads its props onto
	// an INNER container, so the outer node that actually gets sorted would keep zIndex 0.
	const LOADING_SCREEN_Z = 1000;

	type Props = { onloaded: () => void; oncanproceed?: (onpress: () => void) => void };
	const props: Props = $props();
	const context = getContext();
	let loadingType = $state<'start' | 'ready'>('start');

	const MIN_LOADER_MS = 1500;
	/**
	 * How long the fill takes when the download is not what is holding it back. Short of the hold
	 * above, so the assembled lockup gets a beat to be looked at before the splash starts coming up
	 * over it rather than landing on the same frame the screen begins to leave.
	 */
	const FILL_MS = MIN_LOADER_MS * 0.75;
	let minTimeElapsed = $state(false);
	onMount(() => {
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADER_MS);
	});

	const canProceed = $derived(context.stateApp.loaded && minTimeElapsed);

	// The fill tracks the REAL download. assets.ts puts base-game art in the counted tier for exactly
	// this reason — with everything in `preload` the counter never ran and the mark stayed empty.
	const barProgress = $derived(context.stateApp.loaded ? 100 : context.stateApp.loadingProgress);

	// Smooth the fill so a wave of assets resolving together doesn't jump it, and clamp it to
	// forward-only so it can never appear to lose progress. Driven by rAF rather than the pixi
	// ticker, which is not running yet while this screen is up.
	//
	// Also PACED: the fill may not run ahead of the loader's own minimum hold. Most of this game's
	// art is deferred (see the load tiers in assets.ts), so the counted pass has little left to count
	// and on any healthy connection it reports 100% within a frame or two of the loader appearing —
	// the mark would fill in a blink and then sit finished for the rest of MIN_LOADER_MS, which reads
	// as a still image rather than as loading. The pace is a floor, not an override: a download that
	// is genuinely slower than this still governs, because the two are combined with a min().
	let shownProgress = $state(0);
	onMount(() => {
		let id: number;
		const started = performance.now();
		let last = started;
		const tick = (now: number) => {
			const dt = Math.min(64, now - last);
			last = now;
			const eased = shownProgress + (barProgress - shownProgress) * (1 - Math.exp(-dt / 110));
			const paced = Math.min(eased, ((now - started) / FILL_MS) * 100);
			shownProgress = Math.max(shownProgress, paced);
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});

	let _notified = false;
	$effect(() => {
		if (canProceed && !_notified) {
			_notified = true;
			const proceed = () => {
				loadingType = 'ready';
				props.onloaded();
			};
			if (props.oncanproceed) props.oncanproceed(proceed);
			else proceed();
		}
	});

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// === BACKDROP ===
	// The splash art, cover-fit and heavily darkened (design ask, 2026-08-18). The loader used to be a
	// flat purple plate, which meant the splash arrived as a whole new picture; sitting on the same
	// park with the lights down turns that into the scene coming UP, and the cross-fade is then just
	// this layer's darkness lifting. <SplashIntro> fades in over this screen (Game.svelte) rather than
	// replacing it, so the two are composited for the length of its fade and the alignment matters:
	// this uses the same centred cover-fit as the splash overlay's own backdrop layer.
	const SPLASH_ASPECT = 1680 / 936;
	const cover = $derived(backgroundCover(canvas, SPLASH_ASPECT));
	/**
	 * Grey multiplier on the splash art. Not a taste value — Figma 7028:15400 is the splash's own
	 * background image with a flat multiply on it, and comparing the two renders channel by channel
	 * gives 0.397 across the whole frame. So the art ships ungraded and this is the loading screen.
	 */
	const BACKDROP_LEVEL = 0.4;
	const backdropTint =
		(Math.round(255 * BACKDROP_LEVEL) << 16) |
		(Math.round(255 * BACKDROP_LEVEL) << 8) |
		Math.round(255 * BACKDROP_LEVEL);
	const hasBackdrop = $derived(!!context.stateApp.loadedAssets?.loadingBackdrop);

	// === THE MARK ===
	// Figma 7003:4499. The grey plate is drawn whole and the red one is revealed over it left to
	// right, so the fill is continuous rather than the design's twelve steps.
	const hasMark = $derived(!!context.stateApp.loadedAssets?.loadingMarkEmpty);

	// Wordmark geometry, in MARK WIDTHS, generated by scripts/loading/build_press_play.py from the
	// lockup's own SVG — the mark is the piece the design fixes the size of, so everything scales
	// off it.
	const WORDMARK_X = 1.37209;
	const WORDMARK_Y = 0.21221;
	const WORDMARK_W = 2.76163;
	const WORDMARK_H = 0.57558;
	/** The assembled lockup's width, again in mark widths. */
	const LOCKUP_W = WORDMARK_X + WORDMARK_W;

	/**
	 * Mark size: a share of the smaller canvas edge, with a ceiling so it does not become a billboard
	 * on a desktop, and a third limit so the ASSEMBLED lockup still fits a narrow phone.
	 */
	const markSize = $derived(
		Math.min(Math.min(canvas.width, canvas.height) * 0.17, 168, (canvas.width * 0.86) / LOCKUP_W),
	);

	/**
	 * When the wordmark joins in, as a share of the fill.
	 *
	 * The design's eleven progress states are the mark ALONE and only the finished state carries the
	 * wordmark, so the lockup assembles as the load completes rather than sitting there half-built:
	 * the mark drifts from the centre of the screen to its place in the lockup while the words fade
	 * up beside it. Late enough to read as an arrival, early enough not to be cut off by the splash.
	 */
	const WORDMARK_FROM = 0.72;
	const fill = $derived(Math.max(0, Math.min(1, shownProgress / 100)));
	const lockup = $derived(
		Math.max(0, Math.min(1, (fill - WORDMARK_FROM) / (1 - WORDMARK_FROM))) ** 2,
	);

	const markW = $derived(markSize);
	const wordW = $derived(WORDMARK_W * markW);
	const wordH = $derived(WORDMARK_H * markW);
	/**
	 * How far left the mark travels as the words appear: the difference between the mark being
	 * centred on its own and the assembled lockup being centred.
	 */
	const lockupShift = $derived((LOCKUP_W - 1) * 0.5 * markW * lockup);
	const markX = $derived(canvas.width * 0.5 - lockupShift);
	const markY = $derived(canvas.height * 0.5);

	/**
	 * The wipe that reveals the filled mark. A plain rectangle rather than a rounded one: it is
	 * clipped by the mark's own alpha anyway, so the plate's corner radius comes from the art.
	 */
	const drawFillMask = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		graphics.rect(-markW * 0.5, -markW * 0.5, Math.max(0.001, markW * fill), markW);
		graphics.fill({ color: 0xffffff });
	};
</script>

<!-- Deliberately NOT wrapped in a <FadeContainer>. <Background /> in Game.svelte renders
     unconditionally, so a container that tweens up from alpha 0 shows the live game background
     straight through this backdrop for the length of the tween — the loader appears as a ghost over
     the arena art. The Stake Engine gif used to cover that window; with it removed the loader has to
     be opaque from its very first frame. Nothing is lost: the matching fade-OUT was already dead
     code, because the {#if showLoadingScreen} in Game.svelte destroys this component outright rather
     than letting it animate away — the cross-fade into the splash is <SplashIntro> fading in ON TOP
     of this screen, not this screen fading out. -->
{#if loadingType === 'start'}
	<Container zIndex={LOADING_SCREEN_Z}>
		<!-- Under the art, not instead of it: the cover-fit leaves no gap on any sane viewport, but on
		     an extreme one this is the colour the splash's own letterbox uses. -->
		<Rectangle {...canvas} backgroundColor={0x27002c} />

		{#if hasBackdrop}
			<Sprite
				key="loadingBackdrop"
				anchor={0.5}
				x={canvas.width * 0.5}
				y={canvas.height * 0.5}
				width={cover.width}
				height={cover.height}
				tint={backdropTint}
			/>
		{/if}

		{#if hasMark}
			<!-- Empty plate, then the filled one masked to the fill: two draws of the same shape, so
			     nothing has to line up by hand. -->
			<Sprite
				key="loadingMarkEmpty"
				anchor={0.5}
				x={markX}
				y={markY}
				width={markW}
				height={markW}
			/>
			<Container x={markX} y={markY}>
				<Graphics isMask draw={drawFillMask} />
				<Sprite key="loadingMarkFull" anchor={0.5} width={markW} height={markW} />
			</Container>

			{#if lockup > 0}
				<Sprite
					key="loadingWordmark"
					anchor={{ x: 0, y: 0 }}
					x={markX + (WORDMARK_X - 0.5) * markW}
					y={markY + (WORDMARK_Y - 0.5) * markW}
					width={wordW}
					height={wordH}
					alpha={lockup}
				/>
			{/if}
		{/if}
	</Container>
{/if}

<script lang="ts">
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import assets from '../game/assets';
	import { SPLASH_INTRO_IMAGES } from './SplashIntro.svelte';
	import { HUD_IMAGES } from './HudHtml.svelte';
	import { INFO_MODAL_IMAGES } from './CustomInfoModal.svelte';
	import { BUY_BONUS_MODAL_IMAGES } from './CustomBuyBonusModal.svelte';
	import { AUTOSPIN_MODAL_IMAGES } from './CustomAutoSpinModal.svelte';
	import { GAME_DIALOG_IMAGES } from './Game.svelte';
	import { CONFIRM_PANEL_BG } from './confirmDialog';

	// Headless: this component owns WHEN the game may start and HOW FAR the download has got, but it
	// paints nothing. The loading screen itself is the splash overlay's `loading` phase
	// (SplashIntro.svelte + LoadingMark.svelte) — the two share one DOM subtree so the room backdrop
	// can cross-fade from its dim loading state into the full splash without ever being re-created.
	type Props = {
		onloaded: () => void;
		oncanproceed?: (onpress: () => void) => void;
		onprogress?: (progress: number) => void;
	};
	const props: Props = $props();
	const context = getContext();

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	onMount(() => {
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADER_MS);
	});

	// HTML-image pass: everything the HTML side renders (splash intro, HUD chrome, menu/info/buy
	// panels) is plain <img>/CSS — invisible to the pixi loader — so it used to trickle in on first
	// render. Warm it here, in parallel with the pixi download, and gate the screen on it too. The
	// lists live in <script module> blocks NEXT TO the components' own path consts, so a path or ?v=
	// bump can never desync them. Built at instance time on purpose: Game.svelte imports this file,
	// so reading its module export during module evaluation would hit the import cycle.
	// Errors count as settled (a missing icon must not brick the loader) and, mirroring the SDK's
	// per-asset timeout, a deadline forces completion if a request stalls indefinitely.
	const HTML_IMAGES = [
		...new Set([
			...SPLASH_INTRO_IMAGES,
			...HUD_IMAGES,
			...INFO_MODAL_IMAGES,
			...BUY_BONUS_MODAL_IMAGES,
			...AUTOSPIN_MODAL_IMAGES,
			...GAME_DIALOG_IMAGES,
			CONFIRM_PANEL_BG,
		]),
	];
	const HTML_LOAD_TIMEOUT_MS = 15000;
	let htmlSettled = $state(0);
	let htmlTimedOut = $state(false);
	const htmlDone = $derived(htmlTimedOut || htmlSettled >= HTML_IMAGES.length);
	onMount(() => {
		for (const src of HTML_IMAGES) {
			const img = new Image();
			img.onload = img.onerror = () => {
				htmlSettled += 1;
			};
			img.src = src;
		}
		const deadline = setTimeout(() => {
			htmlTimedOut = true;
		}, HTML_LOAD_TIMEOUT_MS);
		return () => clearTimeout(deadline);
	});

	const canProceed = $derived(context.stateApp.loaded && htmlDone && minTimeElapsed);

	// Progress tracks the REAL download. Both halves count: assets.ts puts base-game art in the
	// counted pixi tier, and the HTML pass above is merged in weighted by file count, so the mark
	// reflects the whole download it actually gates on.
	const N_PIXI = Object.values(
		assets as Record<string, { preload?: boolean; defer?: boolean; deferDemand?: boolean }>,
	).filter((a) => !a.preload && !a.defer && !a.deferDemand).length;
	const htmlPct = $derived(
		HTML_IMAGES.length === 0 ? 100 : Math.min(100, (htmlSettled / HTML_IMAGES.length) * 100),
	);
	const pixiPct = $derived(context.stateApp.loaded ? 100 : context.stateApp.loadingProgress);
	const barProgress = $derived(
		context.stateApp.loaded && htmlDone
			? 100
			: (pixiPct * N_PIXI + htmlPct * HTML_IMAGES.length) / (N_PIXI + HTML_IMAGES.length),
	);

	// Smooth the fill so a wave of assets resolving together doesn't jump it, and clamp it to
	// forward-only so it can never appear to lose progress. Driven by rAF rather than the pixi
	// ticker, which is not running yet while this screen is up.
	let shownProgress = 0;
	onMount(() => {
		let id: number;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(64, now - last);
			last = now;
			const eased = shownProgress + (barProgress - shownProgress) * (1 - Math.exp(-dt / 110));
			shownProgress = Math.max(shownProgress, eased);
			props.onprogress?.(shownProgress);
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});

	let _notified = false;
	$effect(() => {
		if (canProceed && !_notified) {
			_notified = true;
			const proceed = () => props.onloaded();
			if (props.oncanproceed) props.oncanproceed(proceed);
			else proceed();
		}
	});
</script>

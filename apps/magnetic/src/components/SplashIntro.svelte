<script lang="ts">
	import { onMount } from 'svelte';
	import { stateI18nDerived } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { getContext } from '../game/context';

	type Props = { onpress: () => void; ondone: () => void };
	const props: Props = $props();

	const context = getContext();

	const t = (key: string) => stateI18nDerived.translate(key);

	// Titles are fixed-size with `white-space: pre` (no wrapping), so long words in some languages
	// (e.g. Russian "РАСШИРЯЮЩИЕСЯ") overflow the card. Shrink the font to fit the card width.
	function fitTitle(node: HTMLElement, _dep?: unknown) {
		const apply = () => {
			const parent = node.parentElement;
			if (!parent) return;
			node.style.fontSize = '';
			const target = parent.clientWidth * 0.92;
			const natural = node.scrollWidth;
			if (target > 0 && natural > target) {
				const base = parseFloat(getComputedStyle(node).fontSize);
				node.style.fontSize = `${Math.max(6, (base * target) / natural)}px`;
			}
		};
		const ro = new ResizeObserver(apply);
		if (node.parentElement) ro.observe(node.parentElement);
		requestAnimationFrame(apply);
		(document as Document).fonts?.ready.then(apply);
		return { update: apply, destroy: () => ro.disconnect() };
	}

	// Figma "Magnetic Slot Version2" splash (node 7022:6137, 1201x671): derelict machine hall with
	// two capsule towers baked into the bg, a central pillar machine, the logo plate on its top drum,
	// three holo feature panels, and loose parts (coil / chip / magnet / torn cable) on the floor.
	const roomSrc = './assets/components/splash/room.webp';
	const pillarSrc = './assets/components/splash/pillar.webp';
	const logoSrc = './assets/components/splash/logo_plate.webp';
	const panelSrc = './assets/components/splash/panel.webp';
	// Loose floor parts, repainted for Version2 (Figma 7118:9777, nodes 9840-9851). New filenames
	// rather than a ?v= query: the old flat-vector art shipped under cable/coil/chip/magnet.webp and
	// a cached copy of those would silently keep rendering the previous style.
	const coilSrc = './assets/components/splash/part_coil.webp';
	const chipSrc = './assets/components/splash/part_chip.webp';
	const magnetSrc = './assets/components/splash/part_magnet.webp';
	const cableSrc = './assets/components/splash/part_cable.webp';
	const ringSrc = './assets/components/splash/part_ring.webp';
	// Same URL (incl. ?v=) as assets.ts so the browser reuses the bytes pixi already downloaded.
	const brandSrc = './assets/components/ui/press_play_logo.webp?v=20260709';

	// Mobile = portrait viewport: show the three feature panels one at a time, 3s each.
	let isPortrait = $state(false);
	let slide = $state(0);
	const SLIDE_COUNT = 3;
	const updateOrientation = () => (isPortrait = window.innerWidth < window.innerHeight);

	onMount(updateOrientation);

	$effect(() => {
		if (!isPortrait) {
			slide = 0;
			return;
		}
		const id = setInterval(() => (slide = (slide + 1) % SLIDE_COUNT), 3000);
		return () => clearInterval(id);
	});

	// ── logo handoff ──
	// On press the game mounts BEHIND this overlay (onpress), the scenery fades out, and the logo
	// plate flies (FLIP) from its splash spot to the exact rect where GameLogoFrame will draw the
	// same art. GameLogoFrame keeps its sprite hidden (stateGame.logoHandoffActive) until `finish`,
	// so the landing is a seamless swap under the overlay's closing fade (ondone).
	let leaving = $state(false);
	let flyStyle = $state('');
	let logoEl: HTMLImageElement | undefined = $state();
	let finished = false;

	// Where GameLogoFrame draws the logo, in viewport CSS px — the same maths as GameLogoFrame,
	// then main-coords → canvas px → client px via the live canvas rect.
	function targetLogoRect() {
		const main = context.stateLayoutDerived.mainLayout();
		const canvas = context.stateLayoutDerived.canvasSizes();
		const scale = main.scale || 1;
		const canvasEl = document.querySelector('canvas');
		if (!canvasEl || !canvas.width) return null;
		const cRect = canvasEl.getBoundingClientRect();
		const unit = cRect.width / canvas.width;
		const canvasLeftMain = main.width * 0.5 - canvas.width / (2 * scale);
		const canvasTopMain = main.height * 0.5 - canvas.height / (2 * scale);
		let cx: number, cy: number, w: number;
		if (context.stateLayoutDerived.layoutType() === 'portrait') {
			// Straight from stateGame, which is also what GameLogoFrame draws — these were literal
			// copies of its old numbers, so every resize of the in-game logo left the plate flying to
			// a stale spot at a stale size.
			cx = main.width * 0.5;
			cy = context.stateGameDerived.portraitLogoCY();
			w = context.stateGameDerived.portraitLogoWidth();
		} else {
			w = context.stateGameDerived.landscapeLogoWidth();
			const h = context.stateGameDerived.landscapeLogoHeight();
			const board = context.stateGameDerived.boardLayout();
			const boardLeftX = board.x - board.width * 0.5 * board.boardScale;
			cx = (canvasLeftMain + boardLeftX) * 0.5;
			cy = canvasTopMain + h * 0.54;
		}
		return {
			cx: cRect.left + (cx - canvasLeftMain) * scale * unit,
			cy: cRect.top + (cy - canvasTopMain) * scale * unit,
			w: w * scale * unit,
		};
	}

	function finish() {
		if (finished) return;
		finished = true;
		context.stateGame.logoHandoffActive = false;
		props.ondone();
	}

	function handlePress() {
		if (leaving) return;
		leaving = true;
		const rect = logoEl?.getBoundingClientRect();
		const target = rect && rect.width > 0 ? targetLogoRect() : null;
		if (target) {
			const dx = target.cx - (rect!.left + rect!.width / 2);
			const dy = target.cy - (rect!.top + rect!.height / 2);
			flyStyle = `--fly-x:${dx.toFixed(1)}px;--fly-y:${dy.toFixed(1)}px;--fly-s:${(target.w / rect!.width).toFixed(4)}`;
			context.stateGame.logoHandoffActive = true;
		}
		props.onpress();
		if (!target) {
			finish();
			return;
		}
		// animationend on the flight is the happy path; the timeout catches it if the animation
		// never runs (display quirk, reduced-motion edge) so the overlay can never get stuck.
		setTimeout(finish, 1400);
	}
	function handleLogoAnimEnd(e: AnimationEvent) {
		if (e.animationName.includes('logo-fly')) finish();
	}
	function handleKey(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') handlePress();
	}
</script>

<svelte:window onkeydown={handleKey} onresize={updateOrientation} />

<div
	class="splash-intro"
	class:leaving
	role="button"
	tabindex="0"
	onclick={handlePress}
	onkeydown={handleKey}
>
	<!-- Per-panel text content by index (0 = BONUS GAMES, 1 = MEGA CHAIN, 2 = MAX WIN). -->
	{#snippet panelText(i: number)}
		{#if i === 0}
			<div class="f-title f-blue" use:fitTitle={t('SPLASH BONUS TITLE')}>{t('SPLASH BONUS TITLE')}</div>
			<div class="f-sub">{i18nDerived.translateVars('SPLASH SCATTERS FOR', { count: 3 })}</div>
			<div class="f-key f-mega">{t('SPLASH MEGA TITLE')}</div>
			<div class="f-line"></div>
			<div class="f-sub">{i18nDerived.translateVars('SPLASH SCATTERS FOR', { count: 4 })}</div>
			<div class="f-key f-mmc">{t('SPLASH MMC')}</div>
		{:else if i === 1}
			<div class="f-title f-mega" use:fitTitle={t('SPLASH MEGA TITLE')}>{t('SPLASH MEGA TITLE')}</div>
			<div class="f-sub">{t('SPLASH MEGA BUILD')}</div>
			<div class="f-key f-blue f-chain">{t('SPLASH MEGA CHAIN')}</div>
			<div class="f-sub">{t('SPLASH MEGA REST')}</div>
		{:else}
			<div class="f-title f-blue" use:fitTitle={t('SPLASH MAX TITLE')}>{t('SPLASH MAX TITLE')}</div>
			<div class="f-sub">{t('SPLASH UP TO')}</div>
			<div class="f-value f-mega">20'000<span class="f-x">X</span></div>
			<div class="f-sub">{t('SPLASH MULTIPLIER')}</div>
		{/if}
	{/snippet}

	<!-- Loose floor parts. Each is: .place (goal position) > .fly (flight + aftershock hop) > img
	     (facing + landing squash). Coil storms in from the left, chip rises from below, magnet from
	     the right; the magnet's landing is the "big hit" that jolts the stage and hops the parts. -->
	<!-- Loose parts sit on the floor from the start; they only react (a small hop) when the three
	     panels slam home. `.place` positions, the inner `.hop` animates — the two are separate
	     elements because both use the `animation` shorthand. -->
	{#snippet floorParts()}
		<div class="place place-cable">
			<div class="hop hop-cable"><img src={cableSrc} alt="" draggable="false" /></div>
		</div>
		<div class="place place-coil">
			<div class="hop hop-coil"><img class="face-coil" src={coilSrc} alt="" draggable="false" /></div>
		</div>
		<div class="place place-chip">
			<div class="hop hop-chip"><img src={chipSrc} alt="" draggable="false" /></div>
		</div>
		<div class="place place-magnet">
			<div class="hop hop-magnet"><img src={magnetSrc} alt="" draggable="false" /></div>
		</div>
		<div class="place place-ring">
			<div class="hop hop-ring"><img src={ringSrc} alt="" draggable="false" /></div>
		</div>
	{/snippet}

	{#if isPortrait}
		<!-- Portrait: same pieces recomposed — pillar + logo up top, one panel at a time, parts below. -->
		<div class="stage stage--m">
			<div class="room-bg" style={`background-image: url('${roomSrc}')`}></div>
			<img class="brand brand--m" src={brandSrc} alt="Press Play" draggable="false" />
			<img class="pillar pillar--m" src={pillarSrc} alt="" draggable="false" />
			<img
				class="logo logo--m"
				class:logo--fly={leaving && flyStyle}
				style={flyStyle}
				bind:this={logoEl}
				onanimationend={handleLogoAnimEnd}
				src={logoSrc}
				alt="Magnetic Megachain"
				draggable="false"
			/>

			<div class="panel panel-m">
				<img class="panel-img" src={panelSrc} alt="" draggable="false" />
				<div class="panel-body">
					{@render panelText(slide)}
				</div>
			</div>

			<div class="dots">
				{#each Array(SLIDE_COUNT) as _, i}
					<span class="dot" class:dot--on={slide === i}></span>
				{/each}
			</div>

			{@render floorParts()}

			<p class="press-label press-label--m">{t('SPLASH PRESS')} →</p>
		</div>
	{:else}
		<!-- Landscape: the full 1201x671 Figma stage, height-fit and centred. -->
		<div class="stage">
			<div class="room-bg" style={`background-image: url('${roomSrc}')`}></div>
			<img class="brand" src={brandSrc} alt="Press Play" draggable="false" />
			<img class="pillar" src={pillarSrc} alt="" draggable="false" />
			<img
				class="logo"
				class:logo--fly={leaving && flyStyle}
				style={flyStyle}
				bind:this={logoEl}
				onanimationend={handleLogoAnimEnd}
				src={logoSrc}
				alt="Magnetic Megachain"
				draggable="false"
			/>

			{#each [0, 1, 2] as i}
				<div class="panel panel-{i}">
					<img class="panel-img" src={panelSrc} alt="" draggable="false" />
					<div class="panel-body">
						{@render panelText(i)}
					</div>
				</div>
			{/each}

			{@render floorParts()}

			<p class="press-label">{t('SPLASH PRESS')} →</p>
		</div>
	{/if}
</div>

<style>
	.splash-intro {
		position: absolute;
		inset: 0;
		z-index: 10;
		cursor: pointer;
		outline: none;
		user-select: none;
		overflow: hidden;
		background: #05070f;
		transition: background-color 400ms ease;
		/* The wrapper in Game.svelte is pointer-events:none; re-enable here so the splash itself
		   stays pressable until the handoff starts. */
		pointer-events: auto;
	}

	/* Handoff: the overlay goes see-through and click-through while the logo flies to its in-game
	   spot; everything else fades. `animation: none` is required — several children carry finished
	   fill-mode:both animations whose final opacity:1 keyframe would override the fade
	   (their base poses equal the animations' end poses, so dropping them doesn't shift anything). */
	.splash-intro.leaving {
		background: transparent;
		pointer-events: none;
		cursor: default;
	}
	.leaving .stage > :not(.logo) {
		animation: none;
		opacity: 0;
		transition: opacity 320ms ease;
	}

	/* Height-fit 16:9-ish stage (Figma frame is 1201x671), sized to the splash CONTAINER so overlays
	   stay locked to the artwork even when the game area is smaller than the browser window. */
	.stage {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		height: 100%;
		aspect-ratio: 1201 / 671;
		container-type: size;
		animation:
			stage-fade 250ms ease-out both,
			stage-jolt 300ms ease-out 830ms both,
			stage-slam 420ms ease-out 1750ms both;
	}

	/* Room art lives on its own layer (not the stage itself) so the handoff can fade it out while
	   the logo — also a stage child — keeps flying at full opacity. */
	.room-bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
	}

	/* Portrait stage: fixed-aspect tall box filling the viewport width, centre-cropped room art. */
	.stage--m {
		width: 100vw;
		height: max(100vh, calc(100vw * 16 / 9));
		aspect-ratio: auto;
	}

	/* ------------------------------------------------------------------ set dressing */

	/* Studio logo, top-right like the design (desktop) / top-centre (portrait). */
	.brand {
		position: absolute;
		right: 2.2%;
		top: 4%;
		width: 9.4%;
		object-fit: contain;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.7));
		animation: soft-in 400ms ease-out 150ms both;
	}
	.brand--m {
		right: auto;
		left: 50%;
		transform: translateX(-50%);
		top: 1.5%;
		width: 22%;
	}

	/* Central pillar machine. The Version2 keyed cutout (695x1488) is much narrower than the old
	   canvas, so the width is set to keep the same on-screen HEIGHT as the Figma placement. */
	.pillar {
		position: absolute;
		left: 50%;
		top: -16.2cqh;
		transform: translateX(-50%);
		width: 35cqw;
		animation: pillar-rise 450ms cubic-bezier(0.2, 0.7, 0.3, 1) 180ms both;
	}
	.pillar--m {
		top: 6cqh;
		width: 52cqw;
	}

	/* Logo plate, dropped like a stone onto the pillar's top drum. Centre-anchored (translate
	   -50%,-50%) at the trimmed art's centre: Figma box 266x199 at top -17 → content centre 76px. */
	.logo {
		position: absolute;
		left: 50%;
		top: 11.3cqh;
		transform: translate(-50%, -50%);
		width: 17.5cqw;
		filter: drop-shadow(0 4px 18px rgba(0, 0, 0, 0.75));
		--drop-from: -30cqh;
		animation: logo-drop 700ms linear 500ms both;
	}
	/* Portrait logo: 46 -> 42cqw (user pass 2026-08-10, "make logo a bit smaller"). The centre drops
	   0.5cqh with it so the plate's BOTTOM edge stays seated on the pillar drum instead of lifting
	   off it as the art shrinks. */
	.logo--m {
		top: 14cqh;
		width: 42cqw;
		--drop-from: -22cqh;
	}

	/* Handoff flight: FLIP to the in-game logo rect. --fly-x/y are viewport-px deltas between the
	   two centres, --fly-s the width ratio; scale acts about the img's own centre so translate alone
	   lands the centre. Declared after .logo so it replaces the entrance animation. */
	.logo--fly {
		animation: logo-fly 640ms cubic-bezier(0.55, 0.05, 0.15, 1) both;
	}
	@keyframes logo-fly {
		0% {
			transform: translate(-50%, -50%);
		}
		100% {
			transform: translate(calc(-50% + var(--fly-x)), calc(-50% + var(--fly-y)))
				scale(var(--fly-s));
		}
	}

	/* ------------------------------------------------------------------ feature panels */

	/* Figma: full panel art squeezed into a 319x280 box at top 263; trimmed art maps to a
	   266x240 box centred at y 397.5 (59.2cqh). Width/height both set: the art is stretched
	   exactly like the design squeezes its square source.

	   Entrances: BONUS GAMES slides in from the LEFT, MEGA CHAIN from the BOTTOM, MAX WIN from
	   the RIGHT — accelerating approach, then each skids past its mark with a squash along the
	   motion axis. All three are home by ~1750ms, which is when stage-slam + the floor hops fire. */
	.panel {
		position: absolute;
		top: 59.2cqh;
		transform: translate(-50%, -50%);
		width: 22.2cqw;
		height: 35.8cqh;
	}
	.panel-0 {
		left: calc(50% - 23.4cqw);
		animation: panel-from-left 650ms linear 1050ms both;
	}
	.panel-1 {
		left: 50%;
		animation: panel-from-bottom 650ms linear 1150ms both;
	}
	.panel-2 {
		left: calc(50% + 23.4cqw);
		animation: panel-from-right 650ms linear 1250ms both;
	}
	.panel-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.panel-body {
		position: absolute;
		inset: 7% 8%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.55cqw;
		text-align: center;
		pointer-events: none;
	}

	/* Portrait: single panel centred between logo and floor parts, entering from the bottom. */
	/* 52 -> 56cqh (user pass 2026-08-10): the card crowded the tube above it and left dead space
	   over the floor parts. The dots track it. */
	.panel-m {
		left: 50%;
		top: 56cqh;
		width: 64cqw;
		height: calc(64cqw * 240 / 266);
		animation: panel-from-bottom 650ms linear 1050ms both;
	}
	.panel-m .panel-body {
		gap: 1.6cqw;
	}

	/* ------------------------------------------------------------------ panel typography */

	.f-title {
		font-family: 'Chakra Petch', 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 2.9cqw;
		line-height: 1;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		white-space: pre;
		margin-bottom: 0.5cqw;
		filter: drop-shadow(0 0 0.55em rgba(0, 0, 0, 0.55));
	}
	.f-sub {
		font-family: 'Chakra Petch', 'Poppins', sans-serif;
		font-weight: 400;
		font-size: 1.4cqw;
		line-height: 1.3;
		color: #ffffff;
		letter-spacing: 0.03em;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
		max-width: 100%;
		overflow-wrap: break-word;
	}
	.f-key {
		font-family: 'Chakra Petch', 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 1.75cqw;
		line-height: 1.12;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		filter: drop-shadow(0 0 0.4em rgba(0, 0, 0, 0.5));
		max-width: 100%;
		overflow-wrap: break-word;
	}
	.f-chain {
		font-weight: 600;
		font-size: 2.15cqw;
		text-transform: none;
	}
	.f-value {
		font-family: 'Chakra Petch', 'IBM Plex Sans Condensed', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 4cqw;
		line-height: 1;
		letter-spacing: 0.03em;
		filter: drop-shadow(0 0 0.35em rgba(0, 0, 0, 0.5));
	}
	.f-x {
		font-size: 0.72em;
		margin-left: 0.05em;
	}
	.f-line {
		width: 4.4cqw;
		height: 1px;
		margin: 0.5cqw 0;
		background: rgba(255, 255, 255, 0.45);
	}

	/* Figma feature gradients */
	.f-blue {
		background: linear-gradient(180deg, #448af9 0%, #81b9f8 25%, #80bff5 49%, #60a4ec 74%, #005fe1 98%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.f-mega {
		background: linear-gradient(
			179deg,
			#ebabdf 14%,
			#c5aae8 26%,
			#9fa8f1 37%,
			#afb6f6 49%,
			#b64f8e 65%,
			#d9335c 80%,
			#fb1629 88%
		);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.f-mmc {
		background: linear-gradient(180deg, #c84175 0%, #afb6f5 43%, #c2aae9 98%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	/* Portrait panel type — scaled to the wider panel (cqw of a narrow stage). */
	.panel-m .f-title {
		font-size: 8cqw;
	}
	.panel-m .f-sub {
		font-size: 4cqw;
	}
	.panel-m .f-key {
		font-size: 5cqw;
	}
	.panel-m .f-chain {
		font-size: 6cqw;
	}
	.panel-m .f-value {
		font-size: 11.5cqw;
	}
	.panel-m .f-line {
		width: 12cqw;
		margin: 1.4cqw 0;
	}

	/* ------------------------------------------------------------------ floor parts */

	.place {
		position: absolute;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	.place img {
		display: block;
		width: 100%;
		filter: drop-shadow(0 0.6cqh 1cqh rgba(0, 0, 0, 0.5));
	}
	/* Positions are the Figma placements converted to stage fractions, not eyeballed: each part's
	   node box (e.g. cable at -69,498 / 280x187) intersected with the trimmed art's own alpha bbox
	   inside its source image, so `left`/`top` land on the VISIBLE centre and `width` is the visible
	   width — the raw art carries a lot of empty margin. */
	.place-cable {
		left: 4.83%;
		top: 87.38%;
		width: 18.7cqw;
		animation: soft-in 400ms ease-out 250ms both;
	}
	.place-coil {
		left: 19.8%;
		top: 89.29%;
		width: 6.55cqw;
	}
	.place-chip {
		left: 28.78%;
		top: 92.57%;
		width: 5.79cqw;
	}
	.place-magnet {
		left: 77.7%;
		top: 90.86%;
		width: 6.14cqw;
	}
	.place-ring {
		left: 93.02%;
		top: 87.31%;
		width: 6.17cqw;
	}

	/* Rest-pose facing. The Version2 art bakes in its own tilt, so only the coil still needs the
	   design's mirror (Figma applies rotate(180deg) + scaleY(-1) to that node, which nets to a
	   horizontal flip). */
	.face-coil {
		transform: scaleX(-1);
	}

	/* Portrait floor-part positions: the same five parts spread along the bottom edge. The stage is
	   far narrower here, so each part is ~2.4x its landscape fraction — at the landscape sizes they
	   would read as grit. Spans are laid out not to collide: cable ends ~27%, then coil / chip /
	   magnet / ring at 34 / 51 / 70 / 89. */
	.stage--m .place-cable {
		left: 9%;
		top: 86.8%;
		width: 38cqw;
	}
	.stage--m .place-coil {
		left: 34%;
		top: 91.2%;
		width: 15.5cqw;
	}
	.stage--m .place-chip {
		left: 51%;
		top: 92.4%;
		width: 14cqw;
	}
	.stage--m .place-magnet {
		left: 70%;
		top: 91.2%;
		width: 14.5cqw;
	}
	.stage--m .place-ring {
		left: 89%;
		top: 87.6%;
		width: 14.5cqw;
	}

	/* All floor parts fade in with the scenery, then jump slightly when the panels slam home
	   (~1750ms). Tiny per-part delay jitter so the floor doesn't hop as one rigid sheet. */
	.place-coil,
	.place-chip,
	.place-magnet,
	.place-ring {
		animation: soft-in 400ms ease-out 250ms both;
	}
	.hop-cable {
		animation: part-hop-small 320ms ease-out 1790ms both;
	}
	.hop-coil {
		animation: part-hop 320ms ease-out 1810ms both;
	}
	.hop-chip {
		animation: part-hop 320ms ease-out 1840ms both;
	}
	.hop-magnet {
		animation: part-hop 320ms ease-out 1770ms both;
	}
	.hop-ring {
		animation: part-hop 320ms ease-out 1825ms both;
	}

	/* Panel flights: offscreen → accelerate in (the 0% timing function), skid a touch past the
	   mark with a squash along the motion axis, settle. All keyframes repeat translate(-50%,-50%)
	   because that is what centres a panel on its anchor. */
	@keyframes panel-from-left {
		0% {
			transform: translate(calc(-50% - 90cqw), -50%);
			animation-timing-function: cubic-bezier(0.4, 0, 0.85, 0.55);
		}
		76% {
			transform: translate(-50%, -50%);
			animation-timing-function: ease-out;
		}
		85% {
			transform: translate(calc(-50% + 1cqw), -50%) scale(0.955, 1.035);
			animation-timing-function: ease-in-out;
		}
		100% {
			transform: translate(-50%, -50%) scale(1, 1);
		}
	}
	@keyframes panel-from-right {
		0% {
			transform: translate(calc(-50% + 90cqw), -50%);
			animation-timing-function: cubic-bezier(0.4, 0, 0.85, 0.55);
		}
		76% {
			transform: translate(-50%, -50%);
			animation-timing-function: ease-out;
		}
		85% {
			transform: translate(calc(-50% - 1cqw), -50%) scale(0.955, 1.035);
			animation-timing-function: ease-in-out;
		}
		100% {
			transform: translate(-50%, -50%) scale(1, 1);
		}
	}
	@keyframes panel-from-bottom {
		0% {
			transform: translate(-50%, calc(-50% + 85cqh));
			animation-timing-function: cubic-bezier(0.4, 0, 0.85, 0.55);
		}
		76% {
			transform: translate(-50%, -50%);
			animation-timing-function: ease-out;
		}
		85% {
			transform: translate(-50%, calc(-50% - 1.2cqh)) scale(1.035, 0.955);
			animation-timing-function: ease-in-out;
		}
		100% {
			transform: translate(-50%, -50%) scale(1, 1);
		}
	}

	@keyframes part-hop {
		0% {
			transform: translateY(0) rotate(0deg);
		}
		35% {
			transform: translateY(-1.8cqh) rotate(-3deg);
		}
		70% {
			transform: translateY(0.3cqh) rotate(1deg);
		}
		100% {
			transform: translateY(0) rotate(0deg);
		}
	}
	@keyframes part-hop-small {
		0% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-0.9cqh);
		}
		100% {
			transform: translateY(0);
		}
	}

	/* ------------------------------------------------------------------ press label */

	.press-label {
		position: absolute;
		left: 50%;
		top: 92.8%;
		transform: translate(-50%, -50%);
		margin: 0;
		white-space: nowrap;
		font-family: 'Chakra Petch', 'Poppins', sans-serif;
		font-weight: 700;
		font-size: clamp(14px, 1.5cqw, 22px);
		letter-spacing: 0.06em;
		color: #ffffff;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
		animation:
			soft-in 350ms ease-out 2150ms both,
			blink 1.6s ease-in-out 2500ms infinite;
	}
	.press-label--m {
		top: 97%;
		font-size: clamp(15px, 4.4cqw, 26px);
	}

	/* Slide indicator dots (portrait) — just below the panel. */
	.dots {
		position: absolute;
		left: 50%;
		top: 78%;
		transform: translateX(-50%);
		display: flex;
		gap: 3cqw;
		pointer-events: none;
	}
	.dot {
		width: 2.2cqw;
		height: 2.2cqw;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.35);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
	}
	.dot--on {
		background: #4aa8ff;
	}

	/* ------------------------------------------------------------------ shared keyframes */

	@keyframes soft-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes stage-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes pillar-rise {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(5cqh);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
	/* Every keyframe repeats translate(-50%, -50%) because that is what centres the logo on its
	   anchor point — dropping it from one frame would snap the logo a full half-size sideways. */
	@keyframes logo-drop {
		0% {
			transform: translate(-50%, -50%) translateY(var(--drop-from)) scale(0.94, 1.09);
			animation-timing-function: cubic-bezier(0.55, 0, 0.95, 0.42);
		}
		46% {
			transform: translate(-50%, -50%) scale(0.94, 1.09);
			animation-timing-function: cubic-bezier(0.18, 0.7, 0.35, 1);
		}
		57% {
			transform: translate(-50%, -50%) translateY(1.5%) scale(1.1, 0.87);
			animation-timing-function: ease-out;
		}
		72% {
			transform: translate(-50%, -50%) translateY(-3.5%) scale(0.99, 1.02);
			animation-timing-function: ease-in;
		}
		86% {
			transform: translate(-50%, -50%) translateY(0.6%) scale(1.015, 0.985);
		}
		100% {
			transform: translate(-50%, -50%) scale(1, 1);
		}
	}

	/* The stage is centred by its own translate(-50%, -50%), so both shakes are written as small
	   deviations around those values. `stage-jolt` = logo touchdown; `stage-slam` = the magnet
	   landing (the big hit). */
	@keyframes stage-jolt {
		0% {
			transform: translate(-50%, -50%);
		}
		22% {
			transform: translate(-50%, -49.3%);
		}
		48% {
			transform: translate(-50.25%, -50.35%);
		}
		74% {
			transform: translate(-49.88%, -49.88%);
		}
		100% {
			transform: translate(-50%, -50%);
		}
	}
	@keyframes stage-slam {
		0% {
			transform: translate(-50%, -50%);
		}
		18% {
			transform: translate(-50.4%, -48.9%);
		}
		40% {
			transform: translate(-49.6%, -50.7%);
		}
		62% {
			transform: translate(-50.25%, -49.6%);
		}
		82% {
			transform: translate(-49.9%, -50.2%);
		}
		100% {
			transform: translate(-50%, -50%);
		}
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage,
		.stage *,
		.press-label {
			animation-duration: 0.01ms !important;
			animation-delay: 0ms !important;
			animation-iteration-count: 1 !important;
		}
	}
</style>

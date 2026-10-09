<script lang="ts" module>
	// Module scope so the art preloads during the loading screen (mounts on demand).
	import { ap } from '../lib/preloadArt';

	// The CONGRATS card (Figma McShmutzo 8808:12044 / card group 8808:13038; scripts/build-fs-congrats.py):
	// the red scalloped board, the design's own ketchup + mustard splats (cut from its splat sheet),
	// the star and the soup pot of the spin counter.
	const FS = '/assets/mcschmutzo/fs-congrats';
	const boardArt = ap(`${FS}/board-v1.webp`);
	const ketchupBig = ap(`${FS}/ketchup-big-v1.webp`);
	const mustardBig = ap(`${FS}/mustard-big-v1.webp`);
	const ketchupDrops = ap(`${FS}/ketchup-drops-v1.webp`);
	const mustardDrops = ap(`${FS}/mustard-drops-v1.webp`);
	const starArt = ap(`${FS}/star-v1.webp`);
	const potArt = ap(`${FS}/pot-v1.webp`);
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
</script>

<script lang="ts">
	import { stateBet, stateBetDerived } from 'state-shared';
	import { isReplayMode } from '../state/roundFlow.svelte';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { potState } from '../game/potState.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { continueBottom } from '../lib/continuePos';
	import { popOut } from '../lib/popOut';
	import { cubicIn } from 'svelte/easing';
	import { fade } from 'svelte/transition';
	// Prompt position (above the portrait HUD; default elsewhere) — re-measured on resize. The card
	// is then centred in the room ABOVE the prompt and sized to fit it (--room-h), so on short phones
	// the pots never run into PRESS TO CONTINUE.
	let contBottom = $state('clamp(14px, 3.5vh, 34px)');
	let roomH = $state(0);
	$effect(() => {
		void show;
		const upd = () => {
			contBottom = continueBottom('clamp(14px, 3.5vh, 34px)');
			requestAnimationFrame(() => {
				const prompt = document.querySelector('.fs-continue')?.getBoundingClientRect();
				roomH = prompt && prompt.height ? Math.max(0, prompt.top - 10) : 0;
			});
		};
		const raf = requestAnimationFrame(upd);
		window.addEventListener('resize', upd);
		return () => (cancelAnimationFrame(raf), window.removeEventListener('resize', upd));
	});

	const context = getContext();

	let show = $state(false);
	let totalFreeSpins = $state(0);
	let potSteps = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinIntroHide: () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinIntroUpdate: async (emitterEvent) => {
			totalFreeSpins = emitterEvent.totalFreeSpins;
			potSteps = emitterEvent.steps ?? 0;
			awaitingPress = true;
			await waitForResolve((resolve) => (oncomplete = resolve));
			awaitingPress = false;
		},
	});

	// One soup pot per multiplier step the wheel awarded (its inner ring, +3 … +15 — they fly into the
	// bonus's multiplier pot on continue), in balanced rows so no pot is left dangling on its own
	// (6 → 3 + 3, 7 → 4 + 3). Every count must fit the design's 2 × 5 box (10), so more steps shrink
	// the pots (`potScale`): of 1–3 rows, the arrangement that keeps them largest wins
	// (12 → 2 × 6, not 3 × 4 hanging off the card). Each row is { count, first } — `first` is its
	// first pot's index, for the dealing delay.
	const POT = 9.29; // cqw, one pot
	const POT_STEP_X = POT - 2.23; // overlapped neighbours
	const POT_STEP_Y = POT - 2.9;
	const POT_BOX = { w: POT + 4 * POT_STEP_X, h: POT + POT_STEP_Y }; // the design's 2 × 5
	const potLayout = $derived.by(() => {
		const n = Math.max(0, Math.min(15, potSteps));
		let best = { rows: 0, scale: 1 };
		for (let rows = 1; rows <= 3 && n; rows++) {
			const perRow = Math.ceil(n / rows);
			if (rows > 1 && Math.ceil(n / (rows - 1)) === perRow) continue; // a row would stay empty
			const w = POT + (perRow - 1) * POT_STEP_X;
			const h = POT + (rows - 1) * POT_STEP_Y;
			const scale = Math.min(1, POT_BOX.w / w, POT_BOX.h / h);
			if (scale > best.scale + 1e-6 || !best.rows) best = { rows, scale };
		}
		let first = 0;
		const rows = Array.from({ length: best.rows }, (_, r) => {
			const count = Math.ceil((n - first) / (best.rows - r));
			const row = { count, first };
			first += count;
			return row;
		});
		return { rows, scale: best.scale };
	});
	const potRows = $derived(potLayout.rows);

	// DEV preview: press 6 to show the free-spin bonus congrats with mock data.
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const onDev = (e: KeyboardEvent) => {
			if (e.code !== 'Digit6') return;
			stateBet.activeBetModeKey = 'bonus2';
			totalFreeSpins = 10;
			potSteps = 8;
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});

	// On continue, the spins won jump into the bonus's soup pot: each little pot leaves its disc in an
	// arc (one after the other, as they were dealt), shrinks into the big pot's soup and is gone; the
	// last one landing bumps the pot (potState.nudge). The fliers are clones on <body>, placed by
	// their on-screen rects — the card fades away under them, and the overlay's scaled container
	// can't skew them. No pot on screen yet (or reduced motion): the card just closes.
	let potsEl: HTMLDivElement | undefined = $state();
	const FLY_MS = 640;
	const FLY_STAGGER = 70;
	const flyPots = () => {
		const pot = potState.rect;
		// (once: a click and a key press can both arrive)
		if (!pot || !potsEl || potsEl.style.visibility === 'hidden') return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const c = document.querySelector('.mcschmutzo-stage canvas')?.getBoundingClientRect();
		const tx = (c?.left ?? 0) + pot.x + pot.w * 0.48;
		const ty = (c?.top ?? 0) + pot.y + pot.h * 0.3;
		// just the pot art jumps — its red disc stays behind (it goes with the card)
		const discs = [...potsEl.querySelectorAll<HTMLElement>('.fs-pot img')];
		discs.forEach((el, i) => {
			const r = el.getBoundingClientRect();
			const fly = el.cloneNode(true) as HTMLElement;
			Object.assign(fly.style, {
				position: 'fixed',
				left: `${r.left}px`,
				top: `${r.top}px`,
				width: `${r.width}px`,
				height: `${r.height}px`,
				margin: '0',
				objectFit: 'contain', // (the scoped .fs-pot img rule doesn't reach the clone)
				zIndex: '70',
				animation: 'none',
				pointerEvents: 'none',
			});
			document.body.appendChild(fly);
			const dx = tx - (r.left + r.width / 2);
			const dy = ty - (r.top + r.height / 2);
			const lift = Math.min(180, 60 + Math.abs(dx) * 0.3);
			const spin = (dx > 0 ? 1 : -1) * (160 + (i % 3) * 40);
			const end = Math.max(0.12, Math.min(0.5, (pot.w * 0.18) / r.width));
			const anim = fly.animate(
				[
					{ transform: 'translate(0, 0) scale(1) rotate(0deg)' },
					{ transform: `translate(0, -10px) scale(1.12) rotate(0deg)`, offset: 0.12 },
					{ transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(0.85) rotate(${spin * 0.5}deg)`, offset: 0.55 },
					{ transform: `translate(${dx}px, ${dy}px) scale(${end}) rotate(${spin}deg)`, opacity: 1, offset: 0.92 },
					{ transform: `translate(${dx}px, ${dy + 4}px) scale(${end * 0.4}) rotate(${spin}deg)`, opacity: 0 },
				],
				{ duration: FLY_MS, delay: i * FLY_STAGGER, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'both' },
			);
			anim.onfinish = () => fly.remove();
			anim.oncancel = () => fly.remove();
		});
		potsEl.style.visibility = 'hidden';
		if (discs.length) setTimeout(() => (potState.nudge += 1), (discs.length - 1) * FLY_STAGGER + FLY_MS * 0.92);
	};

	const proceed = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		flyPots();
		oncomplete();
	};

	// Nobody is at the controls during autoplay / held Space, and a replay must play through on its
	// own — waiting for a press there stalls the round (same rule as the bonus wheel).
	const AUTO_ADVANCE_MS = 2500;
	const autoAdvances = $derived(
		isReplayMode() ||
			stateBetDerived.hasAutoBetCounter() ||
			context.stateXstateDerived.isAutoBetting() ||
			stateBet.isSpaceHold,
	);
	let awaitingPress = $state(false);
	$effect(() => {
		if (!show || !awaitingPress || !autoAdvances) return;
		const timer = setTimeout(proceed, AUTO_ADVANCE_MS);
		return () => clearTimeout(timer);
	});
	const onKey = (e: KeyboardEvent) => {
		if (show && (e.code === 'Space' || e.code === 'Enter')) proceed();
	};
</script>

<svelte:window onkeydown={onKey} />

{#if show}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fs-backdrop" style={roomH ? `--room-h:${roomH}px` : ''} onclick={proceed} out:fade={{ duration: 260, easing: cubicIn }}>
		<button
			class="fs-close"
			type="button"
			style={`background-image:url('${closeArt}')`}
			onclick={(e) => {
				e.stopPropagation();
				proceed();
			}}
			aria-label={i18nDerived.translate('CLOSE')}
		></button>

		<div class="fs-stage" role="dialog" aria-modal="true" out:popOut>
			<!-- Ketchup + mustard behind the board: squeezed out when the CONGRATS title slams onto it
			     (the HIT, 0.64s in), then they keep wobbling like fresh sauce. Placed as in 8808:13038. -->
			<img class="fs-sauce fs-sauce--mustard" src={mustardBig} alt="" draggable="false" />
			<img class="fs-sauce fs-sauce--ketchup" src={ketchupBig} alt="" draggable="false" />
			<img class="fs-sauce fs-drops fs-drops--ketchup" src={ketchupDrops} alt="" draggable="false" />
			<img class="fs-sauce fs-drops fs-drops--mustard" src={mustardDrops} alt="" draggable="false" />

			<div class="fs-board" style={`background-image:url('${boardArt}')`}>
				<p class="fs-congrats">{i18nDerived.translate('CONGRATS')}</p>
				<p class="fs-youwon">{i18nDerived.translate('YOU WON')}</p>
				<img class="fs-star fs-star--l" src={starArt} alt="" draggable="false" />
				<p class="fs-count">{totalFreeSpins}</p>
				<img class="fs-star fs-star--r" src={starArt} alt="" draggable="false" />
				<p class="fs-label">{i18nDerived.translate('FREE SPINS')}</p>
				<div class="fs-pots" aria-hidden="true" bind:this={potsEl} style={`--pk:${potLayout.scale}`}>
					{#each potRows as row, r (r)}
						<div class="fs-pots__row">
							{#each Array(row.count) as _, i (i)}
								<span class="fs-pot" style={`--i:${row.first + i}`}><img src={potArt} alt="" draggable="false" /></span>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<p class="fs-continue" style={`bottom:${contBottom}`}>{i18nDerived.translate('PRESS TO CONTINUE')}&nbsp;→</p>
	</div>
{/if}

<style>
	.fs-backdrop {
		position: fixed;
		inset: 0;
		z-index: 55;
		display: grid;
		place-items: center;
		/* centre the card in the room above the prompt (whole screen until it's measured) */
		grid-template-rows: var(--room-h, 100%) 1fr;
		background: rgba(0, 0, 0, 0.6);
		cursor: pointer;
		user-select: none;
	}

	.fs-close {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 57;
		width: clamp(42px, 6.5vmin, 52px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.fs-close:hover {
		filter: brightness(1.2);
	}
	.fs-close:active {
		transform: scale(0.94);
	}

	/* The stage IS the board (740 × 493 in the design): every part is placed in % of it (and type in
	   cqw of its width) straight from 8808:13038, so it scales as one. The sauces overhang it — up to
	   11% left, 7.5% right, 12% above — so the width cap leaves that room. */
	.fs-stage {
		position: relative;
		/* height cap: the board (740 × 493) fits the measured room above PRESS TO CONTINUE with a
		   little air; the 180px floor keeps tiny popouts from collapsing */
		/* (85% of the design's 740: the board left too little of the game showing round it) */
		width: min(630px, 68vw, max(calc((var(--room-h, 100dvh) - 24px) * 1.28), 180px));
		aspect-ratio: 740 / 493.44;
		container-type: inline-size;
		font-family: 'Bowlby One SC', sans-serif;
		/* pops in; then takes the title's HIT (0.64s) */
		animation:
			fs-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both,
			fs-hit 0.52s ease-in-out 0.64s;
	}

	.fs-board {
		position: absolute;
		inset: 0;
		z-index: 1;
		background: center / 100% 100% no-repeat;
		filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.45));
	}
	.fs-board p {
		position: absolute;
		left: 50%;
		margin: 0;
		translate: -50% 0;
		white-space: nowrap;
		line-height: 1;
		text-align: center;
	}

	/* ── sauces: centre + width (% of the board) and rotation from the design; each squeezes out from
	   the edge it hides behind (transform-origin), springs, then keeps a slow wet wobble ── */
	.fs-sauce {
		position: absolute;
		height: auto;
		translate: -50% -50%;
		pointer-events: none;
		z-index: 0;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
		animation:
			fs-squeeze 0.75s cubic-bezier(0.2, 1.6, 0.4, 1) 0.64s both,
			fs-wobble 2.6s ease-in-out 1.45s infinite;
	}
	.fs-sauce--mustard {
		left: 8.17%;
		top: 14.38%;
		width: 31.41%;
		rotate: -29.85deg;
		transform-origin: 80% 85%;
	}
	.fs-sauce--ketchup {
		left: 88%;
		top: 11.75%;
		width: 39.21%;
		transform-origin: 22% 88%;
		animation-delay: 0.68s, 1.9s;
	}
	/* the loose drops fly off the board's sides a beat later and then bob */
	.fs-drops {
		animation:
			fs-fling 0.6s cubic-bezier(0.15, 0.9, 0.3, 1.15) 0.74s both,
			fs-bob 2.2s ease-in-out 1.4s infinite;
	}
	.fs-drops--ketchup {
		left: 0.92%;
		top: 44.27%;
		width: 12.92%;
		rotate: 25.64deg;
		--fly-x: 9cqw;
	}
	.fs-drops--mustard {
		left: 97.67%;
		top: 43.2%;
		width: 15.06%;
		--fly-x: -9cqw;
		animation-delay: 0.8s, 1.75s;
	}

	/* ── copy (8808:13079 / 13080 / 13044 / 13045) ── */
	.fs-congrats {
		top: 18.9%;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		translate: -50% -50% !important;
		font-size: 5.4cqw;
		letter-spacing: 0.035em;
		text-transform: uppercase;
		color: #fff1cf;
		text-shadow: 0 0.35cqw 0.8cqw rgba(70, 8, 4, 0.55);
		/* STAMPED onto the board: drops from 1.7×, slams down at 0.64s (the HIT), squashes, springs
		   back, then breathes */
		animation:
			fs-stamp 0.85s ease-in-out 0.33s both,
			fs-breathe 2.3s ease-in-out 1.3s infinite;
	}
	.fs-youwon {
		top: 25.08%;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-size: 2.16cqw;
		letter-spacing: 0.03em;
		color: #fff1cf;
		animation: fs-rise 0.4s ease-out 0.85s both;
	}
	.fs-count {
		top: 43.62%;
		translate: -50% -50% !important;
		font-size: 14.3cqw;
		color: #fec402;
		text-shadow:
			0 0.5cqw 0 #9c5a00,
			0 0.9cqw 1.6cqw rgba(60, 6, 2, 0.6);
		animation: fs-punch 0.55s cubic-bezier(0.34, 1.7, 0.6, 1) 0.95s both;
	}
	.fs-label {
		top: 55.68%;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-size: 2.7cqw;
		letter-spacing: 0.03em;
		color: #fff1cf;
		animation: fs-rise 0.4s ease-out 1.15s both;
	}
	.fs-star {
		position: absolute;
		width: 8.78%;
		height: auto;
		translate: -50% -50%;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
		/* each flies in from its own side of the screen on a spinning arc and lands with a bump just
		   after the count punches in (--dir: −1 = from the left, 1 = from the right), then twinkles */
		animation:
			fs-star-in 0.75s cubic-bezier(0.22, 0.9, 0.3, 1) 0.75s both,
			fs-star-twinkle 1.5s ease-in-out 1.6s infinite;
	}
	.fs-star--l {
		--dir: -1;
		left: 34.51%;
		top: 45.04%;
	}
	.fs-star--r {
		--dir: 1;
		left: 68.29%;
		top: 44.43%;
		animation-delay: 0.85s, 2.35s;
	}
	@keyframes fs-star-in {
		0% {
			opacity: 0;
			transform: translate(calc(var(--dir) * 520%), 180%) rotate(calc(var(--dir) * 540deg)) scale(0.35);
		}
		15% {
			opacity: 1;
		}
		55% {
			transform: translate(calc(var(--dir) * 150%), -90%) rotate(calc(var(--dir) * 160deg)) scale(0.95);
		}
		80% {
			transform: translate(0, 0) rotate(calc(var(--dir) * -14deg)) scale(1.3);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes fs-star-twinkle {
		0%,
		100% {
			transform: none;
			filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
		}
		50% {
			transform: rotate(calc(var(--dir) * 12deg)) scale(1.12);
			filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35)) drop-shadow(0 0 0.8cqw rgba(255, 220, 90, 0.85))
				brightness(1.15);
		}
	}

	/* ── spin counter: a pot per spin won (8808:13046, without its red discs — the pots alone) ── */
	.fs-pots {
		position: absolute;
		left: 50.4%;
		top: 63.79%;
		translate: -50% 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.fs-pots__row {
		display: flex;
	}
	.fs-pots__row + .fs-pots__row {
		margin-top: calc(-2.9cqw * var(--pk, 1));
	}
	.fs-pot {
		position: relative;
		width: calc(9.29cqw * var(--pk, 1));
		aspect-ratio: 1;
		/* one after another, like spins being dealt */
		animation: fs-pot-in 0.42s cubic-bezier(0.34, 1.7, 0.6, 1) calc(1.25s + var(--i) * 0.07s) both;
	}
	.fs-pot + .fs-pot {
		margin-left: calc(-2.23cqw * var(--pk, 1));
	}
	.fs-pot img {
		position: absolute;
		left: 3.1%;
		top: 4.2%;
		width: 88.4%;
		height: 88.4%;
		object-fit: contain;
	}

	.fs-continue {
		position: fixed;
		left: 50%;
		bottom: clamp(14px, 3.5vh, 34px);
		transform: translateX(-50%);
		z-index: 56;
		margin: 0;
		white-space: nowrap;
		font-family: 'Nunito', sans-serif;
		font-weight: 600;
		font-size: clamp(12px, 2.2vmin, 17px);
		letter-spacing: 0.1em;
		color: #fff;
		text-transform: uppercase;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.6);
		animation: fs-blink 1.6s ease-in-out infinite;
	}
	@keyframes fs-blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Win (plaque + copy) pops in first. */
	@keyframes fs-pop {
		0% { opacity: 0; transform: scale(0.72); }
		60% { opacity: 1; transform: scale(1.03); }
		100% { opacity: 1; transform: scale(1); }
	}
	/* sauce squeezed out from behind the board: from a sliver at its hidden edge to an overshoot */
	@keyframes fs-squeeze {
		0% { opacity: 0; transform: scale(0.15, 0.3); }
		25% { opacity: 1; }
		100% { opacity: 1; transform: scale(1); }
	}
	/* fresh sauce never quite sits still: a slow uneven swell */
	@keyframes fs-wobble {
		0%, 100% { transform: scale(1) skewX(0deg); }
		35% { transform: scale(1.035, 0.975) skewX(1.2deg); }
		70% { transform: scale(0.985, 1.02) skewX(-0.8deg); }
	}
	/* drops flung outward from behind the board's side */
	@keyframes fs-fling {
		0% { opacity: 0; transform: translateX(var(--fly-x)) scale(0.3) rotate(-20deg); }
		30% { opacity: 1; }
		100% { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); }
	}
	@keyframes fs-bob {
		0%, 100% { transform: translateY(0) rotate(0deg); }
		50% { transform: translateY(-0.6cqw) rotate(3deg); }
	}
	@keyframes fs-rise {
		from { opacity: 0; transform: translateY(1cqw); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes fs-punch {
		0% { opacity: 0; transform: scale(0.2); }
		100% { opacity: 1; transform: scale(1); }
	}
	@keyframes fs-pot-in {
		0% { opacity: 0; transform: translateY(-3cqw) scale(0.4); }
		100% { opacity: 1; transform: translateY(0) scale(1); }
	}
	/* Stamp: hit at 36% (0.64s after the screen opens), squash wide + flat, spring back. */
	@keyframes fs-stamp {
		0% { opacity: 0; transform: scale(1.7); animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); }
		12% { opacity: 1; }
		36% { transform: scale(1); }
		46% { transform: scale(1.16, 0.8); }
		60% { transform: scale(0.94, 1.07); }
		74% { transform: scale(1.03, 0.98); }
		88% { transform: scale(0.995, 1.005); }
		100% { opacity: 1; transform: scale(1); }
	}
	/* The plaque takes the title's impact: a quick squash and a damped wobble. */
	@keyframes fs-hit {
		0% { transform: scale(1); }
		18% { transform: scale(1.035, 0.95); }
		42% { transform: scale(0.988, 1.018); }
		68% { transform: scale(1.006, 0.996); }
		100% { transform: scale(1); }
	}
	@keyframes fs-breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.04); }
	}
	@media (prefers-reduced-motion: reduce) {
		.fs-stage, .fs-sauce, .fs-congrats, .fs-youwon, .fs-count, .fs-label, .fs-star, .fs-pot { animation: none; }
	}

	/* Portrait phones: 68vw left the card ~265px wide and its small words ~6px tall. Use most of the
	   width (the sauces may overhang the screen edge a little) and keep YOU WON / FREE SPINS readable. */
	@media (max-aspect-ratio: 4/5) {
		.fs-stage {
			width: min(630px, 88vw, max(calc((var(--room-h, 100dvh) - 24px) * 1.28), 180px));
		}
		.fs-youwon {
			font-size: max(2.16cqw, 12px);
		}
		.fs-label {
			font-size: max(2.7cqw, 13px);
		}
	}

	/* Tiny popouts (~400x225): shrink the close (X) so it doesn't dominate the small screen. */
	@media (max-height: 300px) {
		.fs-close { width: clamp(20px, 9dvh, 30px); top: 6px; right: 6px; }
	}
</style>

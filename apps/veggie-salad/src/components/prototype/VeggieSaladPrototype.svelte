<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { OnHotkey } from 'components-shared';
	import {
		stateBet,
		stateBetDerived,
		stateConfig,
		stateI18nDerived,
		stateMeta,
		stateModal,
		stateSound,
		stateUi,
	} from 'state-shared';
	import { bookEventAmountToCurrencyString, numberToCurrencyString } from 'utils-shared/amount';

	import { eventEmitter } from '../../game/eventEmitter';
	import { CLUSTER_LOG_SIZE, stateGame, stateGameDerived } from '../../game/stateGame.svelte';
	import { stateXstateDerived } from '../../game/stateXstate';
	import { VEGGIE_SYMBOL_ASSETS } from '../../game/veggieAssets';
	import { symbolLiveness } from '../../game/symbolLiveness';
	import type { Position, RawSymbol } from '../../game/types';
	import PixelInfoPanel from '../PixelInfoPanel.svelte';

	/* ── Board-size swap ───────────────────────────────────────────────────────────────────────
	   A bonus can move the board between 7x7 and 10x10, and `repeat()` takes an integer, so the new
	   pitch cannot be interpolated — the grid has to be rebuilt. Rebuilding it alone reads as a cut:
	   one frame of 10 columns, the next of 8. Instead the two grids cross-fade while each is scaled
	   to the OTHER's pitch, so a cell's size changes at one continuous rate across the swap. Going
	   10 -> 8 the outgoing grid grows by 10/8 as it fades and the incoming one starts at 8/10, which
	   is exactly the pitch each of them has to reach. */
	const GRID_SWAP_MS = 420;
	let gridSwapFrom = $state(stateGame.gridSize);
	let gridSwapSeen = stateGame.gridSize;
	// Pre-effects run before the DOM is patched, so this still holds the size the outgoing grid was
	// built at by the time the key block swaps and the transitions are created.
	$effect.pre(() => {
		const next = stateGame.gridSize;
		if (next === gridSwapSeen) return;
		gridSwapFrom = gridSwapSeen;
		gridSwapSeen = next;
	});
	const gridSwapOut = (_node: Element) => {
		const target = gridSwapFrom / stateGame.gridSize;
		return {
			duration: GRID_SWAP_MS,
			easing: cubicIn,
			css: (progress: number, remaining: number) =>
				`transform: scale(${1 + (target - 1) * remaining}); opacity: ${progress};`,
		};
	};
	const gridSwapIn = (_node: Element) => {
		const start = stateGame.gridSize / gridSwapFrom;
		return {
			duration: GRID_SWAP_MS,
			easing: cubicOut,
			css: (progress: number, remaining: number) =>
				`transform: scale(${1 + (start - 1) * remaining}); opacity: ${progress};`,
		};
	};

	const t = (key: string) => stateI18nDerived.translate(key);

	// Every paid mode lives in BONUS FEATURES. CHANCE and FEATURE are per-spin modes; FEATURE adds
	// an activation confirmation. The three actual bonuses remain one-shot buys.
	const modeCards = [
		{
			key: 'CHANCE',
			title: 'MODE CHANCE TITLE',
			cost: 2,
			tag: 'MODE CHANCE TAG',
			icon: 'onion',
			kind: 'toggle',
		},
		{
			key: 'FEATURE',
			title: 'MODE FEATURE TITLE',
			cost: 20,
			tag: 'MODE FEATURE TAG',
			icon: 'broccoli',
			kind: 'toggle',
		},
		{
			key: 'BONUS',
			title: 'MODE BONUS TITLE',
			cost: 100,
			tag: 'MODE BONUS TAG',
			icon: 'tomato',
			kind: 'buy',
		},
		// Second row of the menu: SUPER before MYSTERY (user 2026-09-17), and the mystery card
		// shows the design's gift box (9318:37405), not the scatter king.
		{
			key: 'SUPER',
			title: 'MODE SUPER TITLE',
			cost: 400,
			tag: 'MODE SUPER TAG',
			icon: 'corn',
			kind: 'buy',
		},
		{
			key: 'MYSTERY',
			title: 'MODE MYSTERY TITLE',
			cost: 300,
			tag: 'MODE MYSTERY TAG',
			icon: 'mystery-box',
			kind: 'buy',
		},
	] as const;

	const modeIconAsset = (icon: string) =>
		icon === 'onion'
			? `.${VEGGIE_SYMBOL_ASSETS.SCATTER}`
			: `./assets/veggie-salad/pixel/${icon}.webp`;

	function randomCloudDrift(node: HTMLElement) {
		let animation: Animation | undefined;
		let respawnTimer: ReturnType<typeof setTimeout> | undefined;
		let destroyed = false;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		node.style.animation = 'none';
		if (reducedMotion) return { destroy: () => undefined };

		const run = (randomizeInitialPosition = false) => {
			if (destroyed) return;
			const field = node.parentElement;
			const styles = getComputedStyle(node);
			const width = node.getBoundingClientRect().width;
			const fieldWidth = field?.clientWidth ?? window.innerWidth;
			const fieldHeight = field?.clientHeight ?? window.innerHeight;
			const baseSeconds = Number.parseFloat(styles.getPropertyValue('--cloud-duration')) || 160;
			const duration = baseSeconds * (0.82 + Math.random() * 0.36) * 1000;
			const distance = fieldWidth + width * 2;
			const verticalJitter = (Math.random() * 2 - 1) * Math.min(28, fieldHeight * 0.035);

			animation = node.animate(
				[
					{ transform: `translate3d(0, ${verticalJitter}px, 0)` },
					{ transform: `translate3d(${distance}px, ${verticalJitter}px, 0)` },
				],
				{ duration, easing: 'linear', fill: 'forwards' },
			);

			if (randomizeInitialPosition) animation.currentTime = duration * Math.random() * 0.92;

			animation.finished
				.then(() => {
					if (destroyed) return;
					// Independent random gaps stop clouds respawning as a fixed repeating formation.
					const gap = Math.random() < 0.3 ? Math.random() * 1200 : 1800 + Math.random() * 11000;
					respawnTimer = setTimeout(() => run(), gap);
				})
				.catch(() => undefined);
		};

		run(true);

		return {
			destroy() {
				destroyed = true;
				animation?.cancel();
				if (respawnTimer) clearTimeout(respawnTimer);
			},
		};
	}

	let showBuyMenu = $state(false);
	let pendingMode = $state<(typeof modeCards)[number] | null>(null);
	let showAutoMenu = $state(false);
	let pendingAutoSpins = $state<number>(100);
	let showMenu = $state(false);
	let showInfo = $state(false);

	const isReplay = $derived(stateUi.config.mode === 'replay');
	const isIdle = $derived(stateXstateDerived.isIdle());
	const canInteract = $derived(isIdle && !isReplay);
	const activeMode = $derived(stateBet.activeBetModeKey.toUpperCase());
	const chanceActive = $derived(activeMode === 'CHANCE');
	const featureActive = $derived(activeMode === 'FEATURE');
	const persistentModeActive = $derived(chanceActive || featureActive);
	const betOptions = $derived(stateConfig.betAmountOptions);
	const betIndex = $derived(Math.max(0, betOptions.indexOf(stateBet.betAmount)));
	const smallestBet = $derived(betOptions[0] ?? stateBet.betAmount);
	const biggestBet = $derived(betOptions[betOptions.length - 1] ?? stateBet.betAmount);
	const bonusTierLabel = $derived(
		stateGame.bonusTier ? t(`BONUS TIER ${stateGame.bonusTier.toUpperCase()}`) : '',
	);
	const hasAuto = $derived(stateBetDerived.hasAutoBetCounter());
	const autoCounterText = $derived(
		stateBet.autoSpinsCounter === Infinity ? '∞' : stateBet.autoSpinsCounter || 'A',
	);
	const controlsBlocked = $derived(
		showBuyMenu ||
			showAutoMenu ||
			showMenu ||
			stateGame.continueGate !== null ||
			stateModal.modal !== null,
	);
	const canChangeSpeed = $derived(
		!isReplay && !controlsBlocked && !stateConfig.jurisdiction?.disabledTurbo,
	);
	/* Design 9298:294975 gives the turbo control three icon-only states, left to right: an outline
	   bolt at normal speed, one solid bolt on turbo, two solid bolts on super turbo. No text label —
	   the FAST/MAX caption under the bolt was this game's own invention. */
	const turboIcon = $derived(
		stateBet.isSuperTurbo ? 'turbo_max' : stateBet.isTurbo ? 'turbo_on' : 'turbo_off',
	);
	const turboLabel = $derived(
		stateBet.isSuperTurbo ? t('MAX') : stateBet.isTurbo ? t('FAST') : t('TURBO'),
	);
	const soundMuted = $derived(stateSound.volumeValueMaster === 0);
	const musicMuted = $derived(stateSound.volumeValueMusic === 0);
	const winningKeys = $derived(
		new Set(stateGame.winningPositions.map((position) => stateGameDerived.positionKey(position))),
	);
	const scatterKeys = $derived(
		new Set(stateGame.scatterPositions.map((position) => stateGameDerived.positionKey(position))),
	);
	// On a bonus-entry spin the scatter COUNT is the announcement of which bonus was won, so it
	// gets its own read-out under the board.
	const scatterCount = $derived(stateGame.scatterPositions.length);
	// Gardens by how the bonus was won (user, 2026-09-17: "butterflies are for normal bonus, wolf
	// for super bonus and owl for mystery"): a NORMAL bonus plays in the purple dusk garden with
	// the butterfly (9363:59335); the same tier reached through the Mystery pick plays in the
	// sunset garden with the owl (9198:104316). SUPER is the night garden with the wolf whatever
	// its source. The earlier wiring had these two the other way round.
	const duskGarden = $derived(
		stateGame.bonusTier === 'normal' && stateGame.bonusSource !== 'mystery',
	);
	// Visual theme follows the active bonus, not the last reveal's gameType. The latter remains the
	// bonus type until the next base reveal, which previously left the base garden colour-graded
	// after the bonus outro had closed.
	const theme = $derived(
		stateGame.bonusTier === 'hidden'
			? 'rainbow'
			: stateGame.bonusTier === 'super'
				? 'night'
				: stateGame.bonusTier === 'normal'
					? 'sunset'
					: 'day',
	);

	// The active motion profile — normal, or the fast one under turbo/skip. Because this is
	// $derived, a skip press rewrites these custom properties on cells that are mid-fall, and the
	// browser re-scales the running animation instead of dropping it: a fast-forward, not a cut.
	const motion = $derived(stateGameDerived.motion());
	/* Design 9235:181907. The cow sneaks in around the LEFT EDGE of the screen every so often,
	   holds, blinks once or twice, then slips back out. Three phases rather than a boolean: `hidden`
	   is the resting pose fully off-frame, and the two animations own the travel, because a sneak
	   is not one easing curve — it is a long creep, a pause to check the coast, and then a commit.
	   Two sprites only, so the blink is a frame swap rather than a tween, and one timer is ever
	   outstanding, so a single clearTimeout unwinds the whole chain. */
	const cowFrame = (name: string) => `./assets/veggie-salad/pixel/splash/${name}.webp`;
	const cowRand = (min: number, max: number) => min + Math.random() * (max - min);
	const COW_IN_MS = 1900;
	const COW_OUT_MS = 950;
	let cowPhase = $state<'hidden' | 'in' | 'out'>('hidden');
	let cowBlinking = $state(false);
	$effect(() => {
		let timer: ReturnType<typeof setTimeout>;
		const at = (ms: number, fn: () => void) => {
			timer = setTimeout(fn, ms);
		};
		const leave = () => {
			cowPhase = 'out';
			at(COW_OUT_MS, () => {
				cowPhase = 'hidden';
				at(cowRand(12000, 26000), enter);
			});
		};
		const blink = (again: number) => {
			cowBlinking = true;
			at(130, () => {
				cowBlinking = false;
				if (again > 0) at(180, () => blink(again - 1));
				else at(cowRand(900, 1800), leave);
			});
		};
		const enter = () => {
			// The bonus gardens have their own creatures; the cow waits every feature out off-frame
			// ("dont show the cow in bonuses", user 2026-09-17). Read here, in the timer, so the tier
			// is not a dependency that restarts the chain.
			if (stateGame.bonusTier) return at(cowRand(3000, 6000), enter);
			cowPhase = 'in';
			at(COW_IN_MS + cowRand(600, 1400), () => blink(Math.random() < 0.45 ? 1 : 0));
		};
		at(cowRand(4000, 9000), enter);
		return () => clearTimeout(timer);
	});

	/* Design 9359:59247 ("vulk"). SUPER's wolf pup sits under the bonus readouts and behaves like
	   a happy puppy that stays put ("dont make it jump", user): ears that flick one at a time or together, and
	   eyes that wander an art pixel to either side and blink. The layers come from
	   scripts/build-super-wolf.py and share one canvas, so every part is `inset: 0` and only the
	   transform-origins know where an ear or an eye actually is. Same one-timer chain as the cow;
	   it only runs while the tier is SUPER, because that is the only time the markup exists. */
	const wolfLayer = (name: string) =>
		`./assets/veggie-salad/pixel/background/bonus-super/wolf/${name}.webp`;
	const butterflyLayer = (name: string) =>
		`./assets/veggie-salad/pixel/background/bonus-normal/butterfly/${name}.webp`;
	/* The sunset owl (9355:54123) is a watcher: it blinks, and every so often its eyes slide to
	   one side and back. The rest of its life is CSS — a slow breath and the odd head cock. */
	const owlLayer = (name: string) =>
		`./assets/veggie-salad/pixel/background/bonus-normal/sunset/owl/${name}.webp`;
	let owlGaze = $state(0);
	let owlBlink = $state(false);
	$effect(() => {
		if (stateGame.bonusTier !== 'normal') return;
		let timer: ReturnType<typeof setTimeout>;
		const at = (ms: number, fn: () => void) => {
			timer = setTimeout(fn, ms);
		};
		const beat = () => {
			if (Math.random() < 0.6) {
				owlBlink = true;
				at(110, () => {
					owlBlink = false;
					if (Math.random() < 0.3) {
						at(150, () => {
							owlBlink = true;
							at(110, () => {
								owlBlink = false;
								at(cowRand(1500, 4200), beat);
							});
						});
					} else at(cowRand(1500, 4200), beat);
				});
			} else {
				owlGaze = owlGaze === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
				at(cowRand(900, 2400), beat);
			}
		};
		at(cowRand(800, 2000), beat);
		return () => {
			clearTimeout(timer);
			owlGaze = 0;
			owlBlink = false;
		};
	});
	let wolfEars = $state<'' | 'l' | 'r' | 'lr'>('');
	let wolfGaze = $state(0);
	let wolfBlink = $state(false);
	// The pup's feet stand on the bottom bar. Its box hangs from the readouts, so the distance from
	// their underside to the bar is measured, not styled: the bar's offset differs per layout and
	// the readouts' height per language, and neither is expressible from inside the grid.
	let wolfDrop = $state(0);
	$effect(() => {
		if (stateGame.bonusTier !== 'super') return;
		const measure = () => {
			const readouts = document.querySelector('.scene .bonus-readouts');
			const hud = document.querySelector('.scene footer.hud');
			if (!readouts || !hud) return;
			wolfDrop = Math.max(
				0,
				Math.round(hud.getBoundingClientRect().top - readouts.getBoundingClientRect().bottom),
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(document.documentElement);
		const readouts = document.querySelector('.scene .bonus-readouts');
		if (readouts) observer.observe(readouts);
		return () => observer.disconnect();
	});
	$effect(() => {
		if (stateGame.bonusTier !== 'super') return;
		let timer: ReturnType<typeof setTimeout>;
		const at = (ms: number, fn: () => void) => {
			timer = setTimeout(fn, ms);
		};
		const pick = (...items: string[]) => items[Math.floor(Math.random() * items.length)];
		const beat = () => {
			// One thing at a time, so the pup never looks like it is glitching: a flick, a glance,
			// or a blink, each followed by a rest before the next.
			const act = pick('ears', 'ears', 'gaze', 'gaze', 'blink');
			if (act === 'ears') {
				wolfEars = pick('l', 'r', 'lr', 'lr') as 'l' | 'r' | 'lr';
				at(480, () => {
					wolfEars = '';
					at(cowRand(900, 2600), beat);
				});
			} else if (act === 'gaze') {
				wolfGaze = wolfGaze === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
				at(cowRand(700, 1900), beat);
			} else {
				wolfBlink = true;
				at(130, () => {
					wolfBlink = false;
					if (Math.random() < 0.35) {
						at(170, () => {
							wolfBlink = true;
							at(130, () => {
								wolfBlink = false;
								at(cowRand(1200, 3200), beat);
							});
						});
					} else at(cowRand(1200, 3200), beat);
				});
			}
		};
		at(cowRand(600, 1500), beat);
		return () => {
			clearTimeout(timer);
			wolfEars = '';
			wolfGaze = 0;
			wolfBlink = false;
		};
	});

	const ms = (value: number) => `${Math.round(value)}ms`;

	// Per-cell drop timing. The spin reveal and the tumble refill share one gravity model — only
	// the column stagger differs. Bottom rows start first, so a column piles up from the floor and
	// a falling symbol can never pass through one that has already landed.
	const cellMotion = (reel: number, row: number) => {
		const distance = stateGame.fallDistances[reel]?.[row] ?? 0;
		const jitter = stateGame.fallJitter[reel]?.[row] ?? 0;
		const fall = stateGameDerived.fallDurationMs(distance);
		const stagger =
			stateGame.phase === 'spinning' ? motion.spinRowStaggerMs : motion.tumbleRowStaggerMs;
		const delay =
			(stateGame.gridSize - 1 - row) * stagger +
			reel * motion.reelDelayMs +
			jitter * motion.jitterMs;

		// A skip press rewrites these so every cell still in the air lands together.
		const drop = stateGameDerived.skipAdjust({ delayMs: delay, durationMs: fall });
		const exit = stateGameDerived.skipAdjust({
			delayMs:
				(stateGame.gridSize - 1 - row) * motion.exitRowStaggerMs +
				reel * motion.exitReelDelayMs +
				jitter * motion.exitJitterMs,
			durationMs: stateGameDerived.fallDurationMs(stateGameDerived.exitDistance(row)),
		});

		// Idle breath. A deterministic per-cell phase — fallJitter is empty until the first tumble,
		// so position has to carry it — keeps every vegetable on its own long cycle instead of
		// letting the board pulse as one sheet.
		const idlePhase = Math.abs((Math.sin(reel * 12.9898 + row * 78.233) * 43758.5453) % 1);
		const idleDuration = 10000 + idlePhase * 8000;

		return [
			`--idle-duration:${ms(idleDuration)}`,
			`--idle-delay:${ms(-idlePhase * idleDuration)}`,
			`--fall-offset:${-105 * distance}%`,
			`--fall-duration:${ms(drop.durationMs)}`,
			`--fall-delay:${ms(drop.delayMs)}`,
			// The landing squash starts exactly where the fall ends.
			`--impact-delay:${ms(drop.delayMs + drop.durationMs)}`,
			// Trap-door exit: the same fall, downwards and out. Distance-derived duration + a
			// bottom-row-first stagger, so the old board tumbles out instead of sliding off as one
			// sheet (which is what the single shared duration used to look like).
			`--exit-offset:${105 * stateGameDerived.exitDistance(row)}%`,
			`--exit-duration:${ms(exit.durationMs)}`,
			`--exit-delay:${ms(exit.delayMs)}`,
			`--harvest-delay:${ms(jitter * motion.removeJitterMs)}`,
		].join(';');
	};

	const formatCurrency = (amount: number) => numberToCurrencyString(amount);
	const bookWinToCurrency = (amount: number) => bookEventAmountToCurrencyString(amount);
	const balanceText = $derived(formatCurrency(stateBet.balanceAmount));
	const winText = $derived(bookWinToCurrency(stateGame.roundWin));
	const bonusTotalText = $derived(bookWinToCurrency(stateGame.bonusTotalWin));
	// Persistent CHANCE/FEATURE modes charge per spin, so their highlighted BET value shows the
	// actual debited cost. One-shot bonus buys keep showing the selected base stake: their card and
	// confirmation own the purchase price, and must not overwrite the player's bet level.
	const displayedBetAmount = $derived(
		chanceActive || featureActive ? stateBetDerived.betCost() : stateBet.betAmount,
	);
	const betText = $derived(formatCurrency(displayedBetAmount));
	const textFitStyle = (value: string) => `--chars:${Math.max(1, Array.from(value).length)}`;

	const getCell = (reel: number, row: number): RawSymbol | null =>
		stateGame.board[reel]?.[row] ?? null;
	const keyOf = (reel: number, row: number) => `${reel}:${row}`;

	/* Exit ghost. The trap-door exit used to run on the live cells, so the moment the next result
	   arrived (and re-keyed every symbol) whatever was still falling simply vanished mid-board —
	   and the result was held back until most of the exit had played, which left the board bare
	   in between. Now the outgoing board is copied into its own layer the instant the exit starts,
	   with each cell's exit timing frozen in its style, and that layer falls out on its own clock
	   while the live board is free to rain the new symbols in over it. A skip during the exit
	   re-freezes the timing with the cut applied (the jitter is still the exit's own until the
	   reveal re-rolls it); a skip after the reveal drops the ghost, since the new board is about
	   to be down anyway. */
	type ExitGhost = {
		id: number;
		gridSize: number;
		cells: { name: string | null; multiplier: number | undefined; style: string }[][];
	};
	let exitGhost = $state<ExitGhost | null>(null);
	let exitGhostId = 0;
	const snapshotExit = () => {
		const gridSize = stateGame.gridSize;
		const cells = Array.from({ length: gridSize }, (_, row) =>
			Array.from({ length: gridSize }, (_, reel) => {
				const cell = getCell(reel, row);
				return {
					name: cell?.name ?? null,
					multiplier: cell?.multiplier,
					style: cellMotion(reel, row),
				};
			}),
		);
		return { gridSize, cells };
	};
	$effect(() => {
		if (stateGame.phase !== 'spinning-out') return;
		const id = ++exitGhostId;
		untrack(() => {
			exitGhost = { id, ...snapshotExit() };
			// The ghost outlives the phase on purpose; only its own clock takes it down.
			setTimeout(() => {
				if (exitGhost?.id === id) exitGhost = null;
			}, stateGameDerived.exitDurationMs() + 120);
		});
	});
	$effect(() => {
		if (stateGame.skipRequestedAt <= 0) return;
		untrack(() => {
			if (!exitGhost) return;
			if (stateGame.phase === 'spinning-out') {
				exitGhost = { id: exitGhost.id, ...snapshotExit() };
			} else {
				exitGhost = null;
			}
		});
	});
	// Newest first, already capped by the handler. Rendered into a fixed number of slots, so the
	// panel is the same size empty or full and a new win always lands in the top slot.
	const clusterRows = $derived(stateGame.spinClusterWins.slice(0, CLUSTER_LOG_SIZE));

	// One label per live cluster, parked on the cluster's centre of mass rather than on its first
	// cell, so the amount reads as belonging to the whole shape.
	const clusterLabels = $derived(
		stateGame.winningClusters.map((cluster) => {
			const reels = cluster.positions.map((position) => position.reel);
			const rows = cluster.positions.map((position) => position.row);
			const centre = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
			// Keep the label inside the frame: the board clips its own overflow (it has to, for the
			// falls), so a cluster hugging an edge would otherwise have half its amount cut off.
			const pitch = 100 / stateGame.gridSize;
			const inset = (value: number) => Math.min(100 - pitch * 1.8, Math.max(pitch * 1.8, value));
			return {
				id: cluster.clusterId,
				left: inset(((centre(reels) + 0.5) / stateGame.gridSize) * 100),
				top: inset(((centre(rows) + 0.5) / stateGame.gridSize) * 100),
				// The expression reads "base payout × applied multiplier". Using `amount` here
				// repeated the already-multiplied total on the left and visually multiplied it twice.
				text: `${bookWinToCurrency(cluster.rawAmount)}${
					cluster.appliedMultiplier > 1 ? ` X${cluster.appliedMultiplier}` : ''
				}`,
			};
		}),
	);

	const spinOrSkip = () => {
		if (controlsBlocked) return;
		if (!isIdle) {
			if (stateConfig.jurisdiction?.disabledSlamstop) return;
			stateGameDerived.requestSkip();
			eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		if (isReplay) return;
		// Buy modes are one-shot requests. A later manual/hotkey spin must return to BASE; only the
		// two activate modes intentionally stay armed across spins.
		if (!['CHANCE', 'FEATURE'].includes(activeMode)) stateBet.activeBetModeKey = 'BASE';
		eventEmitter.broadcast({ type: 'bet' });
	};

	// Space is presentation control while autoplay owns round progression. In the tiny idle gap
	// between auto rounds it does nothing; AUTO remains the explicit stop action.
	const spaceSpinOrSkip = () => {
		if (controlsBlocked) return;
		if (!isIdle) {
			if (stateConfig.jurisdiction?.disabledSlamstop) return;
			stateGameDerived.requestSkip();
			eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		if (hasAuto) return;
		spinOrSkip();
	};

	// Holding Space keeps the game betting, round after round, until the key is released — the
	// same contract as the shared EnableSpaceHold: `stateBet.isSpaceHold` makes the bet machine's
	// checkSpaceHold step fetch the next round instead of ending, and the actor's onNewGameStart
	// takes its fast path. Every game needs this (user, 2026-09-16); do not drop it on a redesign.
	// The hold is also a temporary FAST override. Restore the player's selected speed on release,
	// unless another flow (notably bonus entry) deliberately reset both speed flags meanwhile.
	type SpeedSnapshot = { isTurbo: boolean; isSuperTurbo: boolean };
	let spaceTurboSnapshot: SpeedSnapshot | null = null;
	const startSpaceTurbo = () => {
		if (isReplay) return;
		if (!stateBet.isSpaceHold) {
			stateBet.autoSpinsCounter = 0;
			stateBet.isSpaceHold = true;
			// The press that began this hold may have been a skip on a running round, or landed
			// in the idle gap between autoplay rounds; the loop needs a round in flight to extend.
			if (isIdle && !controlsBlocked) spinOrSkip();
		}
		if (!canChangeSpeed || spaceTurboSnapshot) return;
		spaceTurboSnapshot = {
			isTurbo: stateBet.isTurbo,
			isSuperTurbo: stateBet.isSuperTurbo,
		};
		stateBet.isTurbo = true;
		stateBet.isSuperTurbo = false;
	};
	const stopSpaceTurbo = () => {
		// Release ends the loop after the round in flight; the machine reads this at its next check.
		stateBet.isSpaceHold = false;
		if (!spaceTurboSnapshot) return;
		const snapshot = spaceTurboSnapshot;
		spaceTurboSnapshot = null;
		// Bonus entry resets to NORMAL. Do not resurrect the pre-hold speed after that reset.
		if (!stateBet.isTurbo && !stateBet.isSuperTurbo) return;
		stateBet.isTurbo = snapshot.isTurbo;
		stateBet.isSuperTurbo = snapshot.isSuperTurbo;
	};

	const stepBet = (direction: -1 | 1) => {
		if (!canInteract || betOptions.length === 0) return;
		const nextIndex = Math.max(0, Math.min(betOptions.length - 1, betIndex + direction));
		const next = betOptions[nextIndex];
		if (typeof next === 'number') stateBetDerived.setBetAmount(next);
	};

	const highestAffordableBet = $derived.by(() => {
		const multiplier = stateBetDerived.betCostMultiplier();
		if (multiplier <= 0) return biggestBet;
		const affordable = betOptions.filter((option) => option * multiplier <= stateBet.balanceAmount);
		return affordable[affordable.length - 1] ?? smallestBet;
	});
	const disableDecrease = $derived(!canInteract || stateBet.betAmount <= smallestBet);
	const disableIncrease = $derived(
		!canInteract || stateBet.betAmount >= Math.min(biggestBet, highestAffordableBet),
	);

	const canAffordMode = (mode: (typeof modeCards)[number]) =>
		stateBet.betAmount * mode.cost <= stateBet.balanceAmount;

	const requestBuyMode = (mode: (typeof modeCards)[number]) => {
		if (!canInteract) return;
		// EXTRA CHANCE is a direct toggle. Product reference has no purchase confirmation here.
		if (mode.key === 'CHANCE') {
			stateBet.activeBetModeKey = activeMode === 'CHANCE' ? 'BASE' : 'CHANCE';
			showBuyMenu = false;
			return;
		}
		// Turning a toggle OFF spends nothing, so it skips the confirmation.
		if (mode.kind === 'toggle' && activeMode === mode.key) {
			stateBet.activeBetModeKey = 'BASE';
			showBuyMenu = false;
			return;
		}
		if (!canAffordMode(mode)) {
			stateModal.modal = {
				name: 'error',
				error: new Error(
					'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.',
				),
			};
			return;
		}
		pendingMode = mode;
	};

	const handleBonusButton = () => {
		if (!canInteract) return;
		if (persistentModeActive) {
			stateBet.activeBetModeKey = 'BASE';
			showBuyMenu = false;
			return;
		}
		showBuyMenu = true;
	};

	const confirmBuyMode = () => {
		if (!pendingMode || !canInteract || !canAffordMode(pendingMode)) return;
		const mode = pendingMode;
		pendingMode = null;
		showBuyMenu = false;
		stateBet.activeBetModeKey = mode.key;
		// Actual bonus buys spin now. FEATURE is armed like CHANCE after its confirmation.
		if (mode.kind === 'buy') eventEmitter.broadcast({ type: 'bet' });
	};

	const toggleTurbo = () => {
		if (!canChangeSpeed) return;
		// NORMAL -> FAST -> MAX -> NORMAL. Flags stay exclusive, so MAX cannot trap the toggle.
		if (stateBet.isSuperTurbo) {
			stateBet.isTurbo = false;
			stateBet.isSuperTurbo = false;
			return;
		}
		if (stateBet.isTurbo) {
			if (!stateConfig.jurisdiction?.disabledSuperTurbo) {
				stateBet.isTurbo = false;
				stateBet.isSuperTurbo = true;
			} else {
				stateBet.isTurbo = false;
			}
			return;
		}
		stateBet.isTurbo = true;
		stateBet.isSuperTurbo = false;
	};

	const toggleSound = () => {
		eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound.volumeValueMaster = soundMuted ? 75 : 0;
	};

	const toggleMusic = () => {
		eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound.volumeValueMusic = musicMuted ? 75 : 0;
	};

	const flashControl = (event: MouseEvent) => {
		const button = event.currentTarget;
		if (!(button instanceof HTMLButtonElement) || button.disabled) return;
		button.classList.remove('pressed-flash');
		void button.offsetWidth;
		button.classList.add('pressed-flash');
		window.setTimeout(() => button.classList.remove('pressed-flash'), 170);
	};

	const toggleAuto = () => {
		if (stateConfig.jurisdiction?.disabledAutoplay || isReplay) return;
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		if (!canInteract) return;
		showAutoMenu = true;
	};

	const startAuto = () => {
		if (!canInteract || !stateBetDerived.isBetCostAvailable()) return;
		// Per-spin modes persist through autoplay; actual bonus buys are one-shot.
		if (['BONUS', 'MYSTERY', 'SUPER'].includes(activeMode)) {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateBet.autoSpinsCounter = pendingAutoSpins;
		showAutoMenu = false;
		eventEmitter.broadcast({ type: 'autoBet' });
	};

	/* ── Autoplay panel, design 9044:16058 ────────────────────────────────────────────────────────
	   The chip grid is gone: the design picks the count with a stepper. The rungs stay this game's
	   own autoplay presets — a plain ±1 counter needs a hundred taps to reach the default — with the
	   design's own 5 added below them. */
	const AUTO_SPIN_STEPS = [5, 10, 25, 50, 100, 250, 500, Infinity];
	const autoStepIndex = $derived(Math.max(0, AUTO_SPIN_STEPS.indexOf(pendingAutoSpins)));
	const stepAutoSpins = (direction: number) => {
		const next = autoStepIndex + direction;
		if (next < 0 || next >= AUTO_SPIN_STEPS.length) return;
		pendingAutoSpins = AUTO_SPIN_STEPS[next];
	};

	type AutoToggle = {
		key: string;
		label: string;
		on: boolean;
		disabled: boolean;
		toggle: () => void;
	};
	/* The design's three switch rows. Speed is a three-way exclusive here (NORMAL/FAST/MAX) behind
	   two independent-looking switches, so TURBO SPIN reads as on for either boosted state and
	   SUPER TURBO SPIN falls back to plain turbo rather than to normal. The third row is this game's
	   per-spin FEATURE mode; the design's "50 X" is magnetic's cost multiplier, so the number comes
	   off this game's own mode table instead of being copied. A row the jurisdiction forbids is
	   dropped rather than shown dead. */
	const featureMode = modeCards.find((mode) => mode.key === 'FEATURE');
	const autoToggles = $derived.by<AutoToggle[]>(() => {
		const rows: AutoToggle[] = [];
		const rules = stateConfig.jurisdiction;
		if (!rules?.disabledTurbo) {
			rows.push({
				key: 'turbo',
				label: t('TURBO SPIN'),
				on: stateBet.isTurbo || stateBet.isSuperTurbo,
				disabled: false,
				toggle: () => {
					const on = stateBet.isTurbo || stateBet.isSuperTurbo;
					stateBet.isSuperTurbo = false;
					stateBet.isTurbo = !on;
				},
			});
			if (!rules?.disabledSuperTurbo) {
				rows.push({
					key: 'superTurbo',
					label: t('SUPER TURBO SPIN'),
					on: stateBet.isSuperTurbo,
					disabled: false,
					toggle: () => {
						const on = stateBet.isSuperTurbo;
						stateBet.isSuperTurbo = !on;
						stateBet.isTurbo = on;
					},
				});
			}
		}
		if (featureMode && !rules?.disabledBuyFeature) {
			rows.push({
				key: 'feature',
				label: `${featureMode.cost}× ${t(featureMode.title)}`,
				on: featureActive,
				disabled: !canInteract,
				toggle: () => {
					if (!canInteract) return;
					stateBet.activeBetModeKey = featureActive ? 'BASE' : featureMode.key;
				},
			});
		}
		return rows;
	});

	const openRules = () => {
		showMenu = false;
		showInfo = true;
	};

	const closeTopPanel = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		if (pendingMode) pendingMode = null;
		else if (showAutoMenu) showAutoMenu = false;
		else if (showBuyMenu) showBuyMenu = false;
		else if (showMenu) showMenu = false;
	};

	// One delegated click listener avoids putting click handlers on non-interactive layout nodes.
	// Backdrop clicks close their panel; game-area clicks request slam-stop; controls are excluded.
	const handleWindowClick = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const modalLayer = target.closest('.modal-layer');
		if (modalLayer) {
			if (target.closest('.buy-panel, .confirm-panel, .auto-panel')) return;
			if (pendingMode) pendingMode = null;
			else if (showAutoMenu) showAutoMenu = false;
			else if (showBuyMenu) showBuyMenu = false;
			return;
		}
		if (target.closest('button, .hud, .quick-menu, .event-overlay')) return;
		if (!isIdle && !stateConfig.jurisdiction?.disabledSlamstop) stateGameDerived.requestSkip();
	};
</script>

<svelte:head>
	<title>Veggie Salad</title>
	<meta name="description" content="Veggie Salad cluster slot" />
</svelte:head>

<!-- Not disabled while controls are blocked: OnHotkey ends a hold the moment it is disabled, and
     a bonus entry blocks the controls mid-hold, so the Space loop died at the first bonus. The
     press and hold handlers gate on `controlsBlocked` themselves instead. -->
<OnHotkey
	hotkey="Space"
	disabled={Boolean(stateConfig.jurisdiction?.disabledSpacebar)}
	onpress={spaceSpinOrSkip}
	onhold={startSpaceTurbo}
	onholdend={stopSpaceTurbo}
/>
<svelte:window onkeydown={closeTopPanel} onclick={handleWindowClick} />

<main
	class="scene theme-{theme}"
	class:bonus-normal={stateGame.bonusTier === 'normal'}
	class:garden-dusk={duskGarden}
	class:bonus-super={stateGame.bonusTier === 'super'}
	class:bonus-hidden={stateGame.bonusTier === 'hidden'}
	style="--base-plain:url('./assets/veggie-salad/pixel/background/base-plain.webp');--base-mountains:url('./assets/veggie-salad/pixel/background/base-mountains.webp');--base-cloud:url('./assets/veggie-salad/pixel/background/base-cloud.webp');--base-bench:url('./assets/veggie-salad/pixel/background/base-bench.webp');--board-frame:url('./assets/veggie-salad/pixel/board-frame.webp');--bonus-normal-sky:url('./assets/veggie-salad/pixel/background/bonus-normal/sky-ground.webp');--bonus-normal-mountains:url('./assets/veggie-salad/pixel/background/bonus-normal/mountains.webp');--bonus-normal-cloud:url('./assets/veggie-salad/pixel/background/bonus-normal/cloud.webp');--bonus-normal-tree:url('./assets/veggie-salad/pixel/background/bonus-normal/tree.webp');--bonus-normal-oak:url('./assets/veggie-salad/pixel/background/bonus-normal/oak.webp');--sunset-treeline:url('./assets/veggie-salad/pixel/background/bonus-normal/sunset/treeline.webp');--sunset-cloud:url('./assets/veggie-salad/pixel/background/bonus-normal/sunset/cloud.webp');--sunset-flower:url('./assets/veggie-salad/pixel/splash/flower.webp');--bonus-super-sky:url('./assets/veggie-salad/pixel/background/bonus-super/sky-ground.webp');--bonus-super-mountains:url('./assets/veggie-salad/pixel/background/bonus-super/mountains.webp');--bonus-super-cloud:url('./assets/veggie-salad/pixel/background/bonus-super/cloud.webp');--bonus-super-moon:url('./assets/veggie-salad/pixel/background/bonus-super/moon.webp');--bonus-super-fence:url('./assets/veggie-salad/pixel/background/bonus-super/fence.webp');--bonus-super-oak:url('./assets/veggie-salad/pixel/background/bonus-super/oak.webp');--bonus-super-star-bright:url('./assets/veggie-salad/pixel/background/bonus-super/star-bright.webp');--bonus-super-star-dim:url('./assets/veggie-salad/pixel/background/bonus-super/star-dim.webp');--bonus-hidden-background:url('./assets/veggie-salad/pixel/background-bonus-hidden.webp');--hud-button:url('./assets/veggie-salad/pixel/hud-button.webp');--hud-button-pressed:url('./assets/veggie-salad/pixel/hud-button-pressed.webp')"
>
	<!-- Background images cannot interpolate. Persistent layers can: entering a bonus fades its
	     garden over BASE; leaving fades it away and reveals the exact same BASE layer underneath. -->
	<div class="pixel-background-stack" aria-hidden="true">
		<div class="pixel-background background-base background-base-plain"></div>
		<div class="base-cloud-field">
			<span class="cloud-path-guide path-eleven"></span>
			<span class="cloud-path-guide path-one"></span>
			<span class="cloud-path-guide path-two"></span>
			<span class="cloud-path-guide path-three"></span>
			<span class="cloud-path-guide path-four"></span>
			<div class="drifting-cloud cloud-eleven" use:randomCloudDrift></div>
			<div class="drifting-cloud cloud-one" use:randomCloudDrift></div>
			<div class="drifting-cloud cloud-two" use:randomCloudDrift></div>
			<div class="drifting-cloud cloud-three" use:randomCloudDrift></div>
			<div class="drifting-cloud cloud-four" use:randomCloudDrift></div>
		</div>
		<div class="pixel-background background-base base-mountains"></div>
		<div class="base-cloud-field base-cloud-field--front">
			<span class="cloud-path-guide path-five"></span>
			<span class="cloud-path-guide path-six"></span>
			<span class="cloud-path-guide path-eight"></span>
			<div class="drifting-cloud cloud-five" use:randomCloudDrift></div>
			<div class="drifting-cloud cloud-six" use:randomCloudDrift></div>
			<div class="drifting-cloud cloud-eight" use:randomCloudDrift></div>
		</div>
		<div class="pixel-background background-base base-bench"></div>
		<div class="pixel-background background-bonus background-normal">
			<span class="normal-bonus-layer normal-bonus-mountains"></span>
			<span class="normal-bonus-layer normal-bonus-treeline"></span>
			<span class="normal-bonus-cloud-field">
				<span class="normal-bonus-path-guide normal-bonus-path-one"></span>
				<span class="normal-bonus-path-guide normal-bonus-path-two"></span>
				<span class="normal-bonus-path-guide normal-bonus-path-three"></span>
				<span class="normal-bonus-cloud normal-bonus-cloud-one" use:randomCloudDrift></span>
				<span class="normal-bonus-cloud normal-bonus-cloud-two" use:randomCloudDrift></span>
				<span class="normal-bonus-cloud normal-bonus-cloud-three" use:randomCloudDrift></span>
			</span>
			<span class="normal-bonus-layer normal-bonus-fence normal-bonus-fence-left"></span>
			<span class="normal-bonus-layer normal-bonus-fence normal-bonus-fence-right"></span>
			<span class="normal-bonus-layer normal-bonus-tree"></span>
			<span class="normal-bonus-layer normal-bonus-oak"></span>
			<span class="normal-bonus-layer normal-bonus-flowers"></span>
		</div>
		<div class="pixel-background background-bonus background-super">
			<span class="super-bonus-layer super-bonus-moon"></span>
			<span class="super-bonus-star-field">
				<span class="super-bonus-star star-bright super-bonus-star-one"></span>
				<span class="super-bonus-star star-dim super-bonus-star-two"></span>
				<span class="super-bonus-star star-bright super-bonus-star-three"></span>
				<span class="super-bonus-star star-dim super-bonus-star-four"></span>
				<span class="super-bonus-star star-bright super-bonus-star-five"></span>
				<span class="super-bonus-star star-dim super-bonus-star-six"></span>
				<span class="super-bonus-star star-bright super-bonus-star-seven"></span>
				<span class="super-bonus-star star-dim super-bonus-star-eight"></span>
				<span class="super-bonus-star star-bright super-bonus-star-nine"></span>
			</span>
			<span class="super-bonus-cloud-field">
				<span class="super-bonus-cloud super-bonus-cloud-one" use:randomCloudDrift></span>
				<span class="super-bonus-cloud super-bonus-cloud-two" use:randomCloudDrift></span>
				<span class="super-bonus-cloud super-bonus-cloud-three" use:randomCloudDrift></span>
			</span>
			<span class="super-bonus-layer super-bonus-mountains"></span>
			<span class="super-bonus-layer super-bonus-fence"></span>
			<span class="super-bonus-layer super-bonus-oak"></span>
		</div>
		<div class="pixel-background background-bonus background-hidden"></div>
	</div>
	<div class="sun-moon" aria-hidden="true"></div>
	<div class="rainbow" aria-hidden="true"></div>
	<div class="cloud cloud-a" aria-hidden="true"></div>
	<div class="cloud cloud-b" aria-hidden="true"></div>
	<div class="tree-line tree-back" aria-hidden="true"></div>
	<div class="tree-line tree-front" aria-hidden="true"></div>
	<div class="meadow" aria-hidden="true"></div>
	<div class="corner-foliage" aria-hidden="true"></div>
	<span
		class="scene-cow"
		class:peek={cowPhase === 'in'}
		class:hide={cowPhase === 'out'}
		aria-hidden="true"
	>
		<img src={cowFrame(cowBlinking ? 'cow_blink' : 'cow')} alt="" />
	</span>
	<!-- The night garden's foliage (9198:81939) drawn a second time ABOVE the game stage, so the
	     wolf pup's tail sits behind it as in the design; same class as the background copy, so it
	     takes the same art, placement and responsive rules. -->
	<span class="super-bonus-layer super-bonus-oak super-oak-front" aria-hidden="true"></span>

	<header class="brand" aria-label={t('VEGGIE SALAD')}>
		<img src="./assets/veggie-salad/pixel/logo.webp" alt={t('VEGGIE SALAD')} />
	</header>
	<img
		class="studio-mark"
		src="./assets/veggie-salad/pixel/loading/press_play_logo.webp"
		alt="Press Play"
	/>

	<section class="game-stage" aria-label={t('VEGGIE SALAD GAME BOARD')}>
		{#if duskGarden}
			<!-- Design 9363:59335. The dusk (Mystery) garden's butterfly wanders the gutter above the
			     cluster panel; layers from scripts/build-normal-butterfly.py, choreography is CSS. -->
			<span class="butterfly-flight" aria-hidden="true">
				{@render butterflySprite()}
			</span>
		{/if}
		{#if stateGame.freeSpinTotal > 0 && stateGame.bonusTier}
			<div class="bonus-readouts" aria-live="polite">
				<div class="bonus-status bonus-readout">
					<span>{t('FREE SPINS')}</span>
					<strong>{stateGame.freeSpinCurrent}/{stateGame.freeSpinTotal}</strong>
					<small>{bonusTierLabel}</small>
				</div>
				<div class="bonus-total bonus-readout">
					<span>{t('EARNED')}</span>
					<strong style={textFitStyle(bonusTotalText)}>{bonusTotalText}</strong>
				</div>
				{#if stateGame.bonusTier === 'super'}
					<span class="super-wolf" style="--wolf-drop:{wolfDrop}px" aria-hidden="true">
						{@render wolfSprite()}
					</span>
				{/if}
			</div>
		{/if}
		<aside
			class="cluster-panel"
			style={`--slots:${CLUSTER_LOG_SIZE}`}
			aria-label={t('CLUSTER PAYOUTS')}
		>
			{#if stateGame.bonusTier === 'normal' && !duskGarden}
				<!-- Design 9198:104316 / 9355:54123: the sunset garden's owl perches on this panel's
				     top-right corner. Layers from scripts/build-normal-sunset.py. -->
				<span class="sunset-owl" aria-hidden="true">
					{@render owlSprite()}
				</span>
			{/if}
			<div class="panel-rows">
				<!-- Slots, not rows: keyed by position so a repeat win in the same cascade cannot
				     collide with an identical clusterId from an earlier tumble (which is what stopped
				     the panel updating), and so the box keeps its height while it fills. -->
				{#each Array(CLUSTER_LOG_SIZE) as _, slot (slot)}
					{@const row = clusterRows[slot]}
					<div class="panel-row" class:vacant={!row}>
						{#if row}
							<span>{row.size}x</span>
							<img src={`.${VEGGIE_SYMBOL_ASSETS[row.symbol]}`} alt="" />
							<!-- "1x", the way both the landscape (9283:250375) and portrait (9256:209233)
							     designs letter the multiplier box. -->
							<span>{row.appliedMultiplier}x</span>
							<strong style={textFitStyle(bookWinToCurrency(row.amount))}
								>{bookWinToCurrency(row.amount)}</strong
							>
						{/if}
					</div>
				{/each}
			</div>
		</aside>
		<div class="board-wrap">
			<div class="board-shadow"></div>
			<div
				class="board-frame"
				class:is-spinning={stateGame.phase === 'spinning' || stateGame.phase === 'spinning-out'}
			>
				{#key stateGame.gridSize}
					<div
						class="board phase-{stateGame.phase}"
						style={`--grid-size:${stateGame.gridSize};--reveal:${stateGame.revealId};--impact-duration:${ms(motion.impactMs)};--remove-duration:${ms(motion.removeMs)}`}
						aria-label={`${stateGame.gridSize} by ${stateGame.gridSize} symbol grid`}
						in:gridSwapIn
						out:gridSwapOut
					>
						{#each Array(stateGame.gridSize) as _, row}
							{#each Array(stateGame.gridSize) as _, reel}
								{@const cell = getCell(reel, row)}
								{@const hit = winningKeys.has(keyOf(reel, row))}
								{@const scatterHit = scatterKeys.has(keyOf(reel, row))}
								<div
									class="cell"
									class:cluster-hit={hit}
									class:scatter-hit={scatterHit}
									class:empty={!cell}
									class:falling={(stateGame.fallDistances[reel]?.[row] ?? 0) > 0}
									style={cellMotion(reel, row)}
								>
									{#if cell}
										{#key `${stateGame.revealId}:${reel}:${row}`}
											<div class="symbol-layer">
												{#if cell.name === 'SCATTER' && scatterHit}
													<img
														class="backplate"
														src="./assets/veggie-salad/symbols/backplate.webp"
														alt=""
													/>
												{/if}
												<img
													class={`symbol symbol-${cell.name.toLowerCase()}`}
													src={`.${VEGGIE_SYMBOL_ASSETS[cell.name]}`}
													alt={cell.name.toLowerCase()}
													draggable="false"
													use:symbolLiveness={cell.name}
												/>
												{#if cell.multiplier}
													<span class="multiplier"
														><span class="multiplier-value">{cell.multiplier}</span><span
															class="multiplier-x">x</span
														></span
													>
												{/if}
											</div>
										{/key}
									{/if}
								</div>
							{/each}
						{/each}

						<!-- Keyed by position, not clusterId: the math is free to reuse an id between
						     cascades, and a duplicate key in a keyed each is a runtime error. -->
						{#each clusterLabels as label, index (index)}
							<span class="win-label" style={`left:${label.left}%;top:${label.top}%`}>
								{label.text}
							</span>
						{/each}
					</div>
				{/key}
				{#if exitGhost}
					{#key exitGhost.id}
						<div
							class="board board-exit phase-spinning-out"
							style={`--grid-size:${exitGhost.gridSize}`}
							aria-hidden="true"
						>
							{#each exitGhost.cells as cells, row (row)}
								{#each cells as cell, reel (reel)}
									<div class="cell" class:empty={!cell.name} style={cell.style}>
										{#if cell.name}
											<div class="symbol-layer">
												<img
													class={`symbol symbol-${cell.name.toLowerCase()}`}
													src={`.${VEGGIE_SYMBOL_ASSETS[cell.name as keyof typeof VEGGIE_SYMBOL_ASSETS]}`}
													alt=""
													draggable="false"
												/>
												{#if cell.multiplier}
													<span class="multiplier"
														><span class="multiplier-value">{cell.multiplier}</span><span
															class="multiplier-x">x</span
														></span
													>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							{/each}
						</div>
					{/key}
				{/if}
				<div class="frame-highlight" aria-hidden="true"></div>
			</div>

			{#if scatterCount > 0}
				<div class="scatter-tally">
					{scatterCount}
					{scatterCount === 1 ? t('SCATTER') : t('SCATTERS')}
				</div>
			{/if}
		</div>
		{#if stateGame.bonusTier === 'normal' || stateGame.bonusTier === 'super'}
			<!-- Tall portrait phones leave a strip of lawn between the board and the control bar;
			     the garden's creature lives there (the landscape layouts put it in their own
			     gutters, which portrait has none of). Same layers, same script timers. -->
			<div class="paddock" aria-hidden="true">
				{#if duskGarden}
					{@render butterflySprite()}
				{:else if stateGame.bonusTier === 'normal'}
					<span class="paddock-owl">{@render owlSprite()}</span>
				{:else}
					<span class="paddock-wolf">{@render wolfSprite()}</span>
				{/if}
			</div>
		{/if}
	</section>

	{#snippet butterflySprite()}
		<span class="butterfly">
			<span class="butterfly-bob">
				<img
					class="butterfly-layer butterfly-wing butterfly-wing-l"
					src={butterflyLayer('wing-l')}
					alt=""
				/>
				<img
					class="butterfly-layer butterfly-wing butterfly-wing-r"
					src={butterflyLayer('wing-r')}
					alt=""
				/>
				<img
					class="butterfly-layer butterfly-antenna butterfly-antenna-l"
					src={butterflyLayer('antenna-l')}
					alt=""
				/>
				<img
					class="butterfly-layer butterfly-antenna butterfly-antenna-r"
					src={butterflyLayer('antenna-r')}
					alt=""
				/>
				<img class="butterfly-layer" src={butterflyLayer('body')} alt="" />
			</span>
		</span>
	{/snippet}
	{#snippet owlSprite()}
		<span class="owl-stage" style="--gaze:{owlGaze}">
			<img class="owl-layer" src={owlLayer('body')} alt="" />
			<img class="owl-layer owl-eyes" class:blink={owlBlink} src={owlLayer('eyes')} alt="" />
		</span>
	{/snippet}
	{#snippet wolfSprite()}
		<span class="wolf-stage" style="--gaze:{wolfGaze}">
			<img class="wolf-layer" src={wolfLayer('body')} alt="" />
			<img
				class="wolf-layer wolf-ear wolf-ear-l"
				class:flick={wolfEars.includes('l')}
				src={wolfLayer('ear-l')}
				alt=""
			/>
			<img
				class="wolf-layer wolf-ear wolf-ear-r"
				class:flick={wolfEars.includes('r')}
				src={wolfLayer('ear-r')}
				alt=""
			/>
			<img class="wolf-layer wolf-eyes" class:blink={wolfBlink} src={wolfLayer('eyes')} alt="" />
		</span>
	{/snippet}

	{#if showBuyMenu}
		<div class="modal-layer buy-layer">
			<!-- Design 9257:209905, a 1200x670 frame. The menu is one proportional drawing: the stage
			     keeps that frame's aspect and every size below is a design px times `--u`, so the
			     3+2 card layout, the title, the close disc and the bet stepper hold their places at
			     every landscape size instead of reflowing. Portrait/narrow stacks the cards instead. -->
			<section class="buy-panel" role="dialog" aria-modal="true" aria-label={t('BONUS FEATURES')}>
				<h2>{t('BONUS FEATURES')}</h2>
				<button class="close" aria-label={t('CLOSE')} onclick={() => (showBuyMenu = false)}>
					<span class="close-glyph" aria-hidden="true"></span>
				</button>
				<div class="buy-grid">
					{#each modeCards as mode}
						{@const isArmed = mode.kind === 'toggle' && activeMode === mode.key}
						{@const blocked = !canAffordMode(mode) && !isArmed}
						<div class="buy-card mode-{mode.key.toLowerCase()}" class:armed={isArmed}>
							<span>{t(mode.title)}</span>
							<small class="font-copy">{t(`BET MODE ${mode.key} DIALOG`)}</small>
							<img src={modeIconAsset(mode.icon)} alt="" />
							<em class="font-copy">{formatCurrency(stateBet.betAmount * mode.cost)}</em>
							<button
								class="buy-cta"
								class:buy={mode.kind === 'buy'}
								aria-pressed={mode.kind === 'toggle' ? isArmed : undefined}
								disabled={blocked}
								onclick={() => requestBuyMode(mode)}
							>
								{#if mode.kind === 'toggle'}
									{isArmed ? t('ARMED TAP TO STOP') : t('ACTIVATE')}
								{:else}
									{t('BUY')}
								{/if}
							</button>
						</div>
					{/each}
				</div>
				<!-- The design's own bet stepper (9257:211058) sits over the bar so the price on every
				     card can be changed without leaving the menu. -->
				<div class="buy-bet">
					<button
						type="button"
						aria-label={t('DECREASE BET')}
						disabled={disableDecrease}
						onclick={(event) => {
							flashControl(event);
							stepBet(-1);
						}}
					>
						<span class="step-glyph minus" aria-hidden="true"></span>
					</button>
					<div class="buy-bet-readout font-copy">
						<span>{t('BET')}</span>
						<strong>{betText}</strong>
					</div>
					<button
						type="button"
						aria-label={t('INCREASE BET')}
						disabled={disableIncrease}
						onclick={(event) => {
							flashControl(event);
							stepBet(1);
						}}
					>
						<span class="step-glyph plus" aria-hidden="true"></span>
					</button>
				</div>
			</section>
		</div>
	{/if}

	{#if pendingMode}
		<div class="modal-layer confirm-layer">
			<section class="confirm-panel" role="dialog" aria-modal="true">
				<!-- Design 9024:2502: title, hairline rule, one line of copy, two buttons. No eyebrow, no
				     icon and no close cross — CANCEL and the scrim both dismiss it. -->
				<h2>{t(pendingMode.title)}</h2>
				<div class="dlg-rule"></div>
				<p class="font-copy">{t(pendingMode.tag)}</p>
				<strong class="font-copy">{formatCurrency(stateBet.betAmount * pendingMode.cost)}</strong>
				{#if pendingMode.kind === 'toggle'}
					<p class="confirm-note font-copy">{t('TOGGLE COST NOTE')}</p>
				{/if}
				<div class="confirm-actions">
					<button class="cancel" onclick={() => (pendingMode = null)}>{t('CANCEL')}</button>
					<button class="accept" onclick={confirmBuyMode}>
						{pendingMode.kind === 'toggle' ? t('ACTIVATE') : t('CONFIRM')}
					</button>
				</div>
			</section>
		</div>
	{/if}

	{#if showAutoMenu}
		<div class="modal-layer auto-layer">
			<!-- The design hangs this dialog's close off the screen's top-right corner (9044:16291),
			     not off the panel: inside the panel it would sit on top of the first switch. It is a
			     sibling of the panel so the panel's own overflow cannot clip it. -->
			<button class="close" aria-label={t('CLOSE')} onclick={() => (showAutoMenu = false)}>
				<span class="close-glyph" aria-hidden="true"></span>
			</button>
			<section class="auto-panel" role="dialog" aria-modal="true" aria-label={t('AUTOPLAY')}>
				<div class="auto-toggles">
					{#each autoToggles as row (row.key)}
						<div class="auto-toggle-row">
							<span>{row.label}</span>
							<button
								type="button"
								class="switch"
								class:on={row.on}
								role="switch"
								aria-checked={row.on}
								aria-label={row.label}
								disabled={row.disabled}
								onclick={row.toggle}
							></button>
						</div>
					{/each}
				</div>
				<h2>{t('NUMBER OF SPINS')}</h2>
				<div class="auto-count">
					<button
						type="button"
						aria-label={`− ${t('NUMBER OF SPINS')}`}
						disabled={autoStepIndex === 0}
						onclick={() => stepAutoSpins(-1)}
					>
						<span class="step-glyph minus" aria-hidden="true"></span>
					</button>
					<strong>{pendingAutoSpins === Infinity ? '∞' : pendingAutoSpins}</strong>
					<button
						type="button"
						aria-label={`+ ${t('NUMBER OF SPINS')}`}
						disabled={autoStepIndex === AUTO_SPIN_STEPS.length - 1}
						onclick={() => stepAutoSpins(1)}
					>
						<span class="step-glyph plus" aria-hidden="true"></span>
					</button>
				</div>
				<p>{t('AUTOPLAY STOP NOTE')}</p>
				<button
					class="auto-start"
					disabled={!stateBetDerived.isBetCostAvailable()}
					onclick={startAuto}
				>
					{t('CONFIRM')}
				</button>
			</section>
		</div>
	{/if}

	{#if showInfo}
		<PixelInfoPanel onclose={() => (showInfo = false)} />
	{/if}

	{#if showMenu}
		<div class="quick-menu" role="menu">
			<button
				type="button"
				role="menuitem"
				aria-pressed={!soundMuted}
				class:off={soundMuted}
				onclick={toggleSound}
			>
				<!-- Design 9372:61506 / 9372:61509: each row's glyph is a component with an on and a
				     slashed off state, drawn at its own size inside the 48px square. -->
				<span class="quick-menu-icon" aria-hidden="true">
					<img
						class="qm-glyph qm-sound-{soundMuted ? 'off' : 'on'}"
						src="./assets/veggie-salad/pixel/ui/sound-{soundMuted ? 'off' : 'on'}.svg"
						alt=""
					/>
				</span>
				<span>{t('SOUND')}</span>
			</button>
			<button
				type="button"
				role="menuitem"
				aria-pressed={!musicMuted}
				class:off={musicMuted}
				onclick={toggleMusic}
			>
				<span class="quick-menu-icon" aria-hidden="true">
					<img
						class="qm-glyph qm-music-{musicMuted ? 'off' : 'on'}"
						src="./assets/veggie-salad/pixel/ui/music-{musicMuted ? 'off' : 'on'}.svg"
						alt=""
					/>
				</span>
				<span>{t('MUSIC')}</span>
			</button>
			<button type="button" role="menuitem" onclick={openRules}>
				<span class="quick-menu-icon info-icon" aria-hidden="true">i</span>
				<span>{t('INFO')}</span>
			</button>
		</div>
	{/if}

	{#if !isReplay}
		<footer class="hud">
			<div class="hud-left">
				<button
					type="button"
					class="round utility menu-toggle"
					class:open={showMenu}
					aria-label={showMenu ? t('CLOSE') : t('MENU')}
					aria-expanded={showMenu}
					onclick={(event) => {
						flashControl(event);
						showMenu = !showMenu;
					}}
				>
					{#if showMenu}
						<!-- Open state per 9227:175692: the same box turns amber and carries a cross. -->
						<span class="close-glyph" aria-hidden="true"></span>
					{:else}
						<svg viewBox="0 0 64 64" aria-hidden="true">
							<path d="M13 17h38v6H13zm0 12h38v6H13zm0 12h38v6H13z" />
						</svg>
					{/if}
				</button>
				{#if !stateConfig.jurisdiction?.disabledBuyFeature}
					<button
						type="button"
						class="bonus-button"
						class:deactivate={persistentModeActive}
						aria-label={persistentModeActive ? t('DEACTIVATE') : t('BONUS FEATURES')}
						disabled={!canInteract}
						onclick={handleBonusButton}
					>
						{#if persistentModeActive}
							<span>{t('DEACTIVATE')}</span>
							<small>{chanceActive ? t('CHANCE') : t('FEATURES')}</small>
						{:else}
							<span>{t('BONUS')}</span><small>{t('FEATURES')}</small>
						{/if}
					</button>
				{/if}
			</div>

			<div class="metrics">
				<div class="metric balance">
					<span class="font-copy">{t('BALANCE')}</span><strong style={textFitStyle(balanceText)}
						>{balanceText}</strong
					>
				</div>
				<div class="metric win">
					<span class="font-copy">{t('WIN')}</span><strong style={textFitStyle(winText)}
						>{winText}</strong
					>
				</div>
				<div class="metric bet" class:boosted={chanceActive || featureActive}>
					<span class="font-copy">{t('BET')}</span><strong style={textFitStyle(betText)}
						>{betText}</strong
					>
				</div>
			</div>

			<div class="hud-right">
				<div class="bet-stepper">
					<button
						type="button"
						aria-label={t('DECREASE BET')}
						disabled={disableDecrease}
						onclick={(event) => {
							flashControl(event);
							stepBet(-1);
						}}
					>
						<span class="step-glyph minus" aria-hidden="true"></span>
					</button>
					<button
						type="button"
						aria-label={t('INCREASE BET')}
						disabled={disableIncrease}
						onclick={(event) => {
							flashControl(event);
							stepBet(1);
						}}
					>
						<span class="step-glyph plus" aria-hidden="true"></span>
					</button>
				</div>
				<button
					type="button"
					class="spin"
					aria-label={isIdle ? t('SPIN') : t('SKIP')}
					title={isIdle ? t('SPIN') : t('SKIP ANIMATION')}
					disabled={controlsBlocked}
					onclick={spinOrSkip}
				>
					{#if isIdle}
						<svg class="spin-arrow" viewBox="0 0 100 100" aria-hidden="true">
							<path d="M74 27A33 33 0 1 0 79 66l-10-5a22 22 0 1 1-3-26L55 45h31V14z" />
						</svg>
					{:else}
						<span class="stop">■</span>
					{/if}
				</button>
				<button
					type="button"
					class="round utility turbo"
					aria-label={`${t('TURBO')} — ${turboLabel}`}
					aria-pressed={stateBet.isTurbo || stateBet.isSuperTurbo}
					title={turboLabel}
					disabled={!canChangeSpeed}
					onclick={(event) => {
						flashControl(event);
						toggleTurbo();
					}}
				>
					<img
						class="turbo-icon"
						class:wide={stateBet.isSuperTurbo}
						src="./assets/veggie-salad/pixel/ui/{turboIcon}.webp"
						alt=""
					/>
				</button>
				{#if !stateConfig.jurisdiction?.disabledAutoplay}
					<button
						type="button"
						class="round utility auto"
						aria-label={t('AUTO SPIN')}
						aria-pressed={hasAuto}
						disabled={!hasAuto && !canInteract}
						onclick={(event) => {
							flashControl(event);
							toggleAuto();
						}}
					>
						{#if hasAuto}
							<span>{autoCounterText}</span>
						{:else}
							<!-- Traced pixel-for-pixel off design 9283:250375, where this glyph is 7px of ink
							     inside a 34px box. The smooth 64-unit arrows it replaces collapsed into a
							     single dot at that size, and the viewBox is tight to the ink so the box
							     percentage below IS the ink size. -->
							<svg class="auto-glyph" viewBox="0 0 8 7" aria-hidden="true">
								<path
									d="M1 0h7v1h-7zM0 1h2v1h-2zM5 1h3v1h-3zM0 2h2v1h-2zM4 2h4v1h-4zM0 4h3v1h-3zM6 4h1v1h-1zM0 5h2v1h-2zM5 5h2v1h-2zM0 6h6v1h-6z"
								/>
							</svg>
							<!-- The desktop bar (design 9198:123416) draws a different mark: the smooth
							     twin-arrow vector exported from that node, verbatim. Shown only by the
							     bottom-bar pass; the rails keep the pixel trace above. -->
							<svg class="auto-glyph-smooth" viewBox="0 0 10.526 9.83066" aria-hidden="true">
								<path
									d="M1.95428 3.74388C2.12317 3.26555 2.39734 2.81573 2.78337 2.43174C4.15422 1.06036 6.37609 1.06036 7.74695 2.43174L8.12201 2.80915H7.01875C6.63053 2.80915 6.31688 3.12292 6.31688 3.5113C6.31688 3.89967 6.63053 4.21345 7.01875 4.21345H9.8153H9.8241C10.2123 4.21345 10.526 3.89967 10.526 3.5113V0.702697C10.526 0.314321 10.2123 0.000547457 9.8241 0.000547457C9.43582 0.000547457 9.12218 0.314321 9.12218 0.702697V1.82614L8.73834 1.43996C6.81916 -0.479986 3.70897 -0.479986 1.78978 1.43996C1.2546 1.97534 0.86857 2.60509 0.631688 3.27871C0.50228 3.64514 0.695295 4.0445 1.05939 4.17395C1.42349 4.30341 1.82487 4.11032 1.95428 3.74608V3.74388ZM0.504472 5.64627C0.394805 5.67918 0.289523 5.73843 0.203983 5.8262C0.116248 5.91397 0.0570273 6.01929 0.0263203 6.13339C0.0197403 6.15972 0.0131602 6.18824 0.00877343 6.21677C0.00219335 6.25407 0 6.29138 0 6.32867V9.1285C0 9.51685 0.31365 9.83066 0.701875 9.83066C1.0901 9.83066 1.40375 9.51685 1.40375 9.1285V8.00725L1.78978 8.39124C3.70897 10.309 6.81916 10.309 8.73615 8.39124C9.27133 7.85585 9.65958 7.22611 9.89644 6.55468C10.0259 6.18824 9.8328 5.7889 9.46876 5.65944C9.10464 5.52998 8.70325 5.72307 8.57384 6.08731C8.40495 6.56565 8.13078 7.01546 7.74475 7.39945C6.3739 8.77084 4.15203 8.77084 2.78118 7.39945L2.77899 7.39726L2.40392 7.02205H3.50938C3.8976 7.02205 4.21125 6.70827 4.21125 6.3199C4.21125 5.93152 3.8976 5.61775 3.50938 5.61775H0.710648C0.675555 5.61775 0.640461 5.61994 0.605367 5.62433C0.570273 5.62871 0.537373 5.63531 0.504472 5.64627Z"
								/>
							</svg>
						{/if}
						<small>{t('AUTO')}</small>
					</button>
				{/if}
			</div>
		</footer>
	{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
	}
	:global(button) {
		font: inherit;
	}
	.scene {
		position: fixed;
		inset: 0;
		isolation: isolate;
		overflow: hidden;
		font-family: 'Jersey 10', system-ui, sans-serif;
		color: #fff;
		background: linear-gradient(#48bff0 0 48%, #86c944 70%, #327c2b 100%);
		transition: background 700ms ease;
	}
	.scene::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: radial-gradient(
			ellipse at 50% 42%,
			transparent 25%,
			rgb(10 62 22 / 14%) 75%,
			rgb(6 31 13 / 40%)
		);
	}
	.theme-sunset {
		background: linear-gradient(#f36a51 0, #ffae55 44%, #719644 70%, #315e2c 100%);
	}
	.theme-night {
		background: linear-gradient(#071544 0, #174986 50%, #245a68 70%, #123b35 100%);
	}
	.theme-rainbow {
		background: linear-gradient(#d9edf6 0, #eaf4f4 48%, #8bce62 72%, #39863b 100%);
	}
	.sun-moon {
		position: absolute;
		top: 11%;
		right: 15%;
		width: min(8vw, 90px);
		aspect-ratio: 1;
		border-radius: 50%;
		background: #fff1a0;
		box-shadow: 0 0 40px 18px rgb(255 228 105 / 38%);
		opacity: 0.82;
	}
	.theme-night .sun-moon {
		right: auto;
		left: 17%;
		background: transparent;
		box-shadow: 18px 0 0 0 #fffbd0;
	}
	.theme-rainbow .sun-moon {
		opacity: 0;
	}
	.rainbow {
		position: absolute;
		left: 50%;
		top: 39%;
		width: 84vw;
		height: 53vw;
		transform: translate(-50%, -50%);
		border-radius: 50% 50% 0 0;
		border: clamp(16px, 2.8vw, 50px) solid transparent;
		background:
			linear-gradient(#dceef4, #dceef4) padding-box,
			linear-gradient(90deg, #f36b6b, #ffd55f, #72d57f, #69aeef, #a27ae7) border-box;
		opacity: 0;
		filter: saturate(0.75);
	}
	.theme-rainbow .rainbow {
		opacity: 0.88;
	}
	.cloud {
		position: absolute;
		width: 150px;
		height: 35px;
		border-radius: 60px;
		background: rgb(255 255 255 / 68%);
		filter: blur(0.3px);
	}
	.cloud::before,
	.cloud::after {
		content: '';
		position: absolute;
		border-radius: 50%;
		background: inherit;
	}
	.cloud::before {
		width: 65px;
		height: 65px;
		left: 25px;
		bottom: 0;
	}
	.cloud::after {
		width: 82px;
		height: 82px;
		right: 18px;
		bottom: 0;
	}
	.cloud-a {
		top: 14%;
		left: 8%;
		transform: scale(0.72);
	}
	.cloud-b {
		top: 24%;
		right: 7%;
		transform: scale(0.48);
	}
	.theme-night .cloud {
		opacity: 0.14;
	}
	.tree-line {
		position: absolute;
		left: -5%;
		right: -5%;
		bottom: 10%;
		height: 48%;
		background:
			radial-gradient(circle at 5% 62%, #286c2c 0 10%, transparent 10.5%),
			radial-gradient(circle at 18% 55%, #347c35 0 14%, transparent 14.5%),
			radial-gradient(circle at 33% 63%, #21642a 0 13%, transparent 13.5%),
			radial-gradient(circle at 50% 53%, #3b853b 0 16%, transparent 16.5%),
			radial-gradient(circle at 68% 62%, #276c2d 0 14%, transparent 14.5%),
			radial-gradient(circle at 84% 53%, #337936 0 16%, transparent 16.5%),
			radial-gradient(circle at 98% 61%, #205f29 0 13%, transparent 13.5%);
	}
	.tree-back {
		bottom: 24%;
		opacity: 0.75;
		transform: scale(1.18);
		filter: brightness(1.08);
	}
	.tree-front {
		background-color: #255e28;
		filter: drop-shadow(0 -10px 16px rgb(0 53 22 / 22%));
	}
	.theme-sunset .tree-line {
		filter: sepia(0.22) brightness(0.72);
	}
	.theme-night .tree-line {
		filter: brightness(0.38) saturate(0.7) hue-rotate(45deg);
	}
	.meadow {
		position: absolute;
		inset: auto 0 0;
		height: 32%;
		background: linear-gradient(transparent, #4ca33b 28%, #27722f);
	}
	.corner-foliage {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background:
			radial-gradient(ellipse at -3% -2%, #0d4522 0 13%, transparent 13.5%),
			radial-gradient(ellipse at 103% -2%, #134c25 0 14%, transparent 14.5%),
			radial-gradient(ellipse at -3% 103%, #0b4823 0 16%, transparent 16.5%),
			radial-gradient(ellipse at 103% 103%, #0b4020 0 17%, transparent 17.5%);
	}
	/* ── Cow ───────────────────────────────────────────────────────────────────────────────────
	   The art is cut off along its neck, which is what lets it read as a head coming round a
	   corner — so it comes round the screen's own left edge, and the resting pose keeps a sliver of
	   it off-frame so that cut never shows as a cut. Hidden is a real position outside the viewport
	   rather than opacity, so nothing ever fades on the grass. */
	.scene-cow {
		position: absolute;
		bottom: 13%;
		left: 0;
		z-index: 6;
		display: block;
		width: clamp(72px, 9.5vw, 140px);
		transform: translateX(-104%);
		transform-origin: 0 100%;
		pointer-events: none;
	}
	/* A sneak is a long creep, a pause to check the coast, then the commit — one easing curve
	   cannot say that, so the travel lives in keyframes instead of in a transition. */
	.scene-cow.peek {
		animation: cow-sneak-in 1900ms cubic-bezier(0.32, 0.72, 0.35, 1) forwards;
	}
	.scene-cow.hide {
		animation: cow-sneak-out 950ms cubic-bezier(0.55, 0, 0.75, 0.35) forwards;
	}
	@keyframes cow-sneak-in {
		0% {
			transform: translateX(-104%) rotate(-7deg);
		}
		42% {
			transform: translateX(-52%) rotate(-4deg);
		}
		58% {
			transform: translateX(-49%) rotate(-4.5deg);
		}
		100% {
			transform: translateX(-11%) rotate(0deg);
		}
	}
	@keyframes cow-sneak-out {
		0% {
			transform: translateX(-11%) rotate(0deg);
		}
		22% {
			transform: translateX(-3%) rotate(2.5deg);
		}
		100% {
			transform: translateX(-104%) rotate(-7deg);
		}
	}
	.scene-cow img {
		display: block;
		width: 100%;
		height: auto;
		image-rendering: pixelated;
		animation: cow-nod 2.8s ease-in-out infinite;
	}
	@keyframes cow-nod {
		0%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		50% {
			transform: translateY(-2%) rotate(1.4deg);
		}
	}
	.scene.bonus-normal .scene-cow,
	.scene.bonus-super .scene-cow,
	.scene.bonus-hidden .scene-cow {
		display: none;
	}
	/* ── SUPER wolf pup ───────────────────────────────────────────────────────────────────────
	   Hangs off the bonus readouts so it follows them through every landscape layout: it is an
	   absolute child of that grid, one gap below EARNED, and never a grid item, so the readouts
	   themselves keep their measured position. Landscape only — portrait turns the readouts into a
	   row above the board and there is no ground under them; narrow landscape docks the cluster
	   panel there. The layers share one canvas
	   (435×405, see scripts/build-super-wolf.py); the origins below are the ear bases and the
	   midpoint between the eyes on that canvas. */
	.super-wolf {
		display: none;
		position: absolute;
		top: 100%;
		right: 0;
		width: 100%;
		height: var(--wolf-drop, 0px);
		justify-content: flex-end;
		align-items: flex-end;
		pointer-events: none;
	}
	/* Only the wide landscape layouts leave the gutter under the readouts empty; narrower ones
	   dock the cluster panel there. */
	@media (min-width: 1180px) and (min-height: 601px) and (orientation: landscape) {
		.super-wolf {
			display: flex;
		}
	}
	/* Sized by the room under the readouts, capped like the design's (its pup is 187 tall on the
	   670 frame), and pushed to the readouts' right edge so the tail runs into the foliage. */
	.wolf-stage {
		position: relative;
		display: block;
		height: min(100%, 28vh);
		margin-bottom: 2px;
		/* Of the readouts' width: tucks the rump, not just the tail, into the foliage ("hide a bit
		   more the wolf", user 2026-09-17). */
		margin-right: 13%;
		aspect-ratio: 435 / 405;
		/* Weight shifts, not a bounce ("move slightly front and back", user 2026-09-17): the pup
		   leans out from behind the foliage and settles back, with a slow breath on top. Pivots at
		   the feet so it never leaves the ground, and a whole cycle is long enough that no single
		   move reads as a jump. */
		transform-origin: 50% 100%;
		animation: wolf-sway 9s ease-in-out infinite;
	}
	@keyframes wolf-sway {
		0%,
		100% {
			transform: translateX(0) rotate(0deg) scale(1, 1);
		}
		12% {
			transform: translateX(-1.5%) rotate(-0.8deg) scale(1.005, 1.015);
		}
		30% {
			transform: translateX(-4%) rotate(-1.6deg) scale(1.01, 1.01);
		}
		44% {
			transform: translateX(-3%) rotate(-1.2deg) scale(1.005, 1.02);
		}
		62% {
			transform: translateX(0.5%) rotate(0.3deg) scale(1, 1);
		}
		78% {
			transform: translateX(1.5%) rotate(0.8deg) scale(1.005, 1.015);
		}
	}
	/* Two class selectors: the plain .super-bonus-oak rules further down (z-index 4, twice) are
	   written later and would otherwise put this copy back under the game stage. */
	.super-bonus-oak.super-oak-front {
		display: none;
		z-index: 6;
		opacity: 0;
		transition: opacity 1700ms ease-in-out;
	}
	.scene.bonus-super .super-oak-front {
		opacity: 1;
		transition-duration: 850ms;
	}
	@media (min-width: 1180px) and (min-height: 601px) and (orientation: landscape) {
		.super-bonus-oak.super-oak-front {
			display: block;
		}
	}
	.wolf-layer {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}
	.wolf-ear-l {
		transform-origin: 60.5% 24.1%;
	}
	.wolf-ear-r {
		transform-origin: 93.1% 27.8%;
	}
	/* The flick is a stretch from the base plus a tilt outward, so the overlay keeps covering the
	   ear painted on the body beneath it (see the build script). */
	.wolf-ear.flick {
		animation: wolf-ear-flick 480ms ease-out;
	}
	@keyframes wolf-ear-flick {
		0%,
		100% {
			transform: none;
		}
		30% {
			transform: scaleY(1.14) rotate(calc(var(--ear-side, -1) * 7deg));
		}
		65% {
			transform: scaleY(1.03) rotate(calc(var(--ear-side, -1) * -2deg));
		}
	}
	.wolf-ear-r {
		--ear-side: 1;
	}
	/* One art pixel is ~3% of the canvas; the glance is a slide, the blink a squash to a line. */
	.wolf-eyes {
		transform-origin: 76.1% 38.8%;
		transform: translateX(calc(var(--gaze, 0) * 3%));
		transition: transform 90ms steps(2, jump-end);
	}
	.wolf-eyes.blink {
		transform: translateX(calc(var(--gaze, 0) * 3%)) scaleY(0.12);
	}
	/* ── NORMAL butterfly ─────────────────────────────────────────────────────────────────────
	   The flight box is the right gutter above the cluster panel (same gutter formula the side
	   furniture uses), and the butterfly wanders it on `left`/`top` so the path is in box terms
	   while every transform stays free for the body. Three motions at three speeds: the wander
	   (20s loop), the bob that goes with each wingbeat, and the beat itself (a squash towards the
	   body's centre line — the body is stacked on top, so the folded wing tucks under the head).
	   Antennae swing from their bases, also hidden under the head. Wide landscape only: that is
	   the only layout with this gutter empty. */
	.butterfly-flight {
		display: none;
		position: absolute;
		top: 6%;
		right: 2cqw;
		left: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
		z-index: 6;
		height: 18%;
		pointer-events: none;
	}
	@media (min-width: 1180px) and (min-height: 601px) and (orientation: landscape) {
		.butterfly-flight {
			display: block;
		}
	}
	.butterfly {
		position: absolute;
		left: 8%;
		top: 30%;
		width: clamp(64px, 8.4vw, 130px);
		aspect-ratio: 412 / 355;
		animation: butterfly-wander 20s ease-in-out infinite;
	}
	@keyframes butterfly-wander {
		0%,
		100% {
			left: 8%;
			top: 30%;
			transform: rotate(6deg);
		}
		20% {
			left: 58%;
			top: 4%;
			transform: rotate(-4deg);
		}
		40% {
			left: 62%;
			top: 40%;
			transform: rotate(-9deg);
		}
		60% {
			left: 30%;
			top: 45%;
			transform: rotate(5deg);
		}
		80% {
			left: 2%;
			top: 18%;
			transform: rotate(8deg);
		}
	}
	.butterfly-bob {
		position: absolute;
		inset: 0;
		display: block;
		animation: butterfly-bob 520ms ease-in-out infinite alternate;
	}
	@keyframes butterfly-bob {
		from {
			transform: translateY(-4%);
		}
		to {
			transform: translateY(4%);
		}
	}
	.butterfly-layer {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}
	.butterfly-wing {
		transform-origin: 50% 50%;
		animation: butterfly-beat 260ms ease-in-out infinite alternate;
	}
	@keyframes butterfly-beat {
		from {
			transform: scaleX(1);
		}
		to {
			transform: scaleX(0.55);
		}
	}
	.butterfly-antenna-l {
		transform-origin: 47.6% 28.2%;
		animation: butterfly-antenna 1.3s ease-in-out infinite alternate;
	}
	.butterfly-antenna-r {
		transform-origin: 52.4% 28.2%;
		animation: butterfly-antenna 1.1s ease-in-out -0.6s infinite alternate-reverse;
	}
	@keyframes butterfly-antenna {
		from {
			transform: rotate(-9deg);
		}
		to {
			transform: rotate(9deg);
		}
	}
	.brand {
		position: absolute;
		top: max(8px, 1.2vh);
		left: 50%;
		z-index: 12;
		display: flex;
		align-items: center;
		gap: 10px;
		transform: translateX(-50%) rotate(-1deg);
		padding: 5px 25px 7px;
		border: 4px solid #694012;
		border-radius: 50% 50% 34% 34%;
		background: linear-gradient(#f9e65f, #e49a17);
		box-shadow:
			inset 0 0 0 3px #fff184,
			0 5px 0 #3e671b,
			0 9px 18px rgb(0 0 0 / 32%);
		color: #315f16;
		text-align: center;
		white-space: nowrap;
	}
	.brand div {
		display: grid;
	}
	.brand small {
		font-size: clamp(6px, 0.55vw, 9px);
		letter-spacing: 0.18em;
		font-weight: 900;
	}
	.brand strong {
		font-size: clamp(18px, 2vw, 34px);
		line-height: 0.9;
		font-weight: 1000;
		letter-spacing: -0.06em;
		-webkit-text-stroke: 1px #173c0f;
		text-shadow: 0 2px #fff47d;
	}
	.brand-leaf {
		color: #4a8b1c;
		font-size: 25px;
	}
	.brand-leaf.mirror {
		transform: scaleX(-1);
	}
	/* The stage is the free space between the brand plate and the HUD; the board is the largest
	   square that fits INSIDE it. `container-type: size` is what makes that expressible in CSS:
	   min(100cqw, 100cqh) reads both axes of this box, so the board can never overflow one axis
	   the way `aspect-ratio` + `max-width` did (that combination broke the square and let the
	   bottom rows slide under the HUD on short screens and clip on narrow ones).
	   The bottom inset is a max() against the HUD's own height for the same reason. */
	.game-stage {
		position: absolute;
		z-index: 5;
		top: 8.5%;
		bottom: max(12%, 122px);
		left: 0;
		right: 0;
		padding: 0 clamp(4px, 1.5vw, 28px);
		container-type: size;
		display: grid;
		place-items: center;
	}
	.board-wrap {
		position: relative;
		/* Fallback first for engines without container query units: a square bounded by the
		   narrower axis of the stage. */
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		width: min(100cqw, 100cqh);
		height: min(100cqw, 100cqh);
	}
	.board-shadow {
		position: absolute;
		inset: 3%;
		border-radius: 18px;
		background: rgb(15 47 7 / 55%);
		filter: blur(20px);
		transform: translateY(16px);
	}
	.board-frame {
		position: relative;
		/* A single cell both boards share, so the outgoing and incoming grids sit on top of each
		   other for the length of the swap. */
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		width: 100%;
		height: 100%;
		padding: clamp(8px, 1vw, 14px);
		border: clamp(8px, 1vw, 14px) solid #744313;
		border-radius: 16px;
		background: linear-gradient(90deg, #a46a25, #4b2808 10%, #754515 50%, #4b2808 90%, #a46a25);
		box-shadow:
			inset 0 0 0 3px #d59b3f,
			inset 0 0 20px #2b1605,
			0 15px 34px rgb(0 0 0 / 40%);
		overflow: hidden;
	}
	.board-frame::before,
	.board-frame::after {
		content: '';
		position: absolute;
		z-index: 5;
		pointer-events: none;
	}
	.board-frame::before {
		inset: 3px;
		border: 2px solid rgb(255 222 116 / 58%);
		border-radius: 8px;
	}
	.board-frame::after {
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0 2%,
			rgb(255 207 86 / 15%) 4%,
			transparent 8% 92%,
			rgb(255 207 86 / 15%) 96%,
			transparent 98%
		);
	}
	.board {
		/* The pitch change is carried by gridSwapIn/gridSwapOut, which cross-fade the old and new
		   grids while scaling each to the other's cell size. Stacked so the two overlap during the
		   swap instead of the outgoing one collapsing the frame. */
		grid-area: 1 / 1;
		display: grid;
		grid-template-columns: repeat(var(--grid-size), minmax(0, 1fr));
		grid-template-rows: repeat(var(--grid-size), minmax(0, 1fr));
		gap: clamp(1px, 0.18vw, 3px);
		width: 100%;
		height: 100%;
		padding: 3px;
		overflow: hidden;
		background: #a96e27;
		border: 2px solid #2c1b08;
	}
	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		overflow: visible;
		transform-origin: center bottom;
	}
	.cell::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(circle at 45% 34%, rgb(118 150 50 / 74%), transparent 62%),
			linear-gradient(145deg, #496c20, #203d14);
		box-shadow:
			inset 0 0 0 1px rgb(255 234 144 / 18%),
			inset 0 -6px 12px rgb(9 31 8 / 20%);
	}
	/* Tumble symbols stay inside target slot until their fall starts. Prevents fresh art from
		appearing beside last winning cluster before gravity animation reaches it. */
	.phase-dropping .cell.falling {
		overflow: visible;
	}
	.symbol-layer {
		/* quadIn — slow off the ledge, fast into the floor. Paired with the sqrt(distance)
		   duration this gives every symbol an identical trajectory, so short and long falls look
		   like the same board of vegetables under the same gravity. */
		--gravity-ease: cubic-bezier(0.11, 0, 0.5, 0);
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-items: center;
		transform-origin: center bottom;
		will-change: transform, opacity, filter;
	}
	.symbol,
	.backplate {
		position: absolute;
		width: 90%;
		height: 90%;
		object-fit: contain;
		user-select: none;
		filter: drop-shadow(0 3px 2px rgb(0 0 0 / 42%));
	}
	/* Source sprites carry different transparent margins. Per-symbol boxes compensate those
	   margins so the visible art—not the PNG canvas—occupies about 90% of its cell. */
	.symbol-broccoli,
	.symbol-carrot {
		width: 93%;
		height: 93%;
	}
	.symbol-corn {
		width: 104%;
		height: 104%;
	}
	/* 110, not 117: the tomato's art fills 80% of its canvas, so 117% put it at 94% of the cell
	   while the rest of the crop sits at 85–89% — "it looks bigger than all others" (user,
	   2026-09-18). */
	.symbol-tomato {
		width: 110%;
		height: 110%;
	}
	.symbol-eggplant,
	.symbol-onion {
		width: 99%;
		height: 99%;
	}
	.symbol-pepper {
		width: 96%;
		height: 96%;
	}
	.symbol-scatter {
		width: 97%;
		height: 97%;
	}
	.backplate {
		width: 96%;
		height: 96%;
		filter: drop-shadow(0 0 7px #ffe36a);
	}
	/* Design 9198:20884 (groups 148/149): a 47px coin on a 75px cell — 63% of the cell, hung off
	   its top-right corner with the centre ~18% in, so it rides over the neighbours. Kept a touch
	   smaller and further in (62% of the cell's height, centre 26% in) because the board clips at
	   its 3px padding and the design's overhang would lose 13% of an edge cell's coin. #2C1901 at
	   rest, the design's #FD1A19 once the cell is part of a win; the "2" is Jersey 10 at 0.89 of
	   the coin and the "X" at 0.47, both #FFF3B9 on a 1px #FFEA83 ring. */
	.multiplier {
		position: absolute;
		top: 26%;
		right: 26%;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 62%;
		aspect-ratio: 1;
		transform: translate(50%, -50%);
		border: max(1px, 2.1cqmin / var(--grid-size)) solid #ffea83;
		border-radius: 50%;
		background: #2c1901;
		box-shadow: 0 0.2em 0.35em rgb(0 0 0 / 45%);
		color: #fff3b9;
		font-size: calc(min(100cqw, 100cqh) / var(--grid-size) * 0.6);
		line-height: 1;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.multiplier-value {
		font-size: 0.89em;
	}
	.multiplier-x {
		font-size: 0.47em;
	}
	.cell.cluster-hit .multiplier {
		background: #fd1a19;
	}
	/* The coin overhangs the cell to its right, which is a later sibling: lift the symbol layer
	   that carries it so that neighbour's vegetable cannot paint over it. The layer, never the
	   cell — a cell with a z-index is a stacking context whose opaque ::before then sits above
	   every other cell's falling symbol: in a bonus drop the vegetables passing over the
	   multiplier cells vanished, leaving slivers in the gap lines ("strange bug with items in
	   board … after buying a bonus", 2026-09-17). Hit cells are 4, so a hit multiplier cell
	   still needs its own lift; the board is never dropping while cells are lit. */
	.symbol-layer:has(.multiplier) {
		z-index: 3;
	}
	.cell.cluster-hit:has(.multiplier) {
		z-index: 5;
	}
	/* Trap-door exit: the old board free-falls out the bottom under the same gravity as the drop,
	   loosened by a per-reel delay and the per-cell jitter instead of a rigid left-to-right sweep.
	   It plays on the exit ghost (see the script), which is the live board's twin drawn over it
	   with nothing but the symbols; the live cells keep their pads and hide their own symbols
	   until the next result rains in. */
	.board-exit .symbol-layer {
		animation: trapdoor-exit var(--exit-duration) var(--gravity-ease) var(--exit-delay) both;
	}
	.board:not(.board-exit).phase-spinning-out .symbol-layer {
		visibility: hidden;
	}
	.board.board-exit {
		z-index: 4;
		background: transparent;
		border-color: transparent;
		pointer-events: none;
	}
	.board-exit .cell::before {
		display: none;
	}
	/* Spin reveal and tumble refill are the SAME motion: an accelerating fall whose duration is
	   proportional to sqrt(distance) (constant gravity — see FALL_MOTION), then a separate
	   landing animation that squashes the symbol against the floor and bounces it out.
	   `land-impact` is `forwards`, not `both`: with `both` its 0% frame would fill backwards over
	   the whole fall and freeze the symbol in place. */
	.phase-spinning .symbol-layer,
	.phase-dropping .cell.falling .symbol-layer {
		animation:
			gravity-fall var(--fall-duration) var(--gravity-ease) var(--fall-delay) both,
			land-impact var(--impact-duration) linear var(--impact-delay) forwards;
	}
	.cell.cluster-hit {
		z-index: 4;
	}
	.cell.cluster-hit::before {
		background: radial-gradient(circle, #faff7c 0 10%, #8fca34 56%, #31511b);
		box-shadow:
			inset 0 0 0 2px #fff36a,
			0 0 12px rgb(229 255 69 / 70%);
	}
	.cell.cluster-hit .symbol-layer {
		animation: cluster-pulse 720ms ease-in-out infinite alternate;
	}
	.phase-removing .cell.cluster-hit .symbol-layer {
		visibility: visible;
		animation: harvest var(--remove-duration) steps(6, end) var(--harvest-delay) forwards;
	}
	.phase-removing .cell.cluster-hit .symbol-layer::before,
	.phase-removing .cell.cluster-hit .symbol-layer::after {
		content: '';
		position: absolute;
		z-index: 8;
		left: 46%;
		top: 46%;
		width: 9%;
		aspect-ratio: 1;
		background: #fff25a;
		box-shadow:
			-1.9em -1.2em #7bdf2d,
			1.8em -1.4em #ff9c19,
			2.2em 0.5em #e93624,
			-2.1em 0.8em #9c3cff,
			0.4em 2em #f4f06a;
		animation: pixel-burst-a var(--remove-duration) steps(5, end) var(--harvest-delay) forwards;
	}
	.phase-removing .cell.cluster-hit .symbol-layer::after {
		transform: rotate(45deg) scale(0.72);
		animation-name: pixel-burst-b;
	}
	/* Bonus-entry scatters: gold cell and a slow throb, so counting them takes no effort. Kept
	   distinct from the lime cluster highlight — a scatter is not a pay. */
	.cell.scatter-hit {
		z-index: 4;
	}
	.cell.scatter-hit::before {
		background: radial-gradient(circle, #fff5b0 0 12%, #ffbe33 58%, #7a4409);
		box-shadow:
			inset 0 0 0 2px #fff3b0,
			0 0 14px rgb(255 199 62 / 75%);
	}
	.cell.scatter-hit .symbol-layer {
		animation: scatter-throb 620ms ease-in-out infinite alternate;
	}
	.cell.empty::before {
		background: linear-gradient(145deg, #354e1b, #18320f);
	}
	/* Idle breath. Between spins the board is a still image, which reads as a screenshot. Each
	   vegetable gets one small rise on a 10-18s cycle that is still for 90% of its length, and every
	   cell runs that cycle at its own offset — so only a handful are ever moving at once and no two
	   move together. Idle phase only, and never on a cell a win or a scatter is already animating.
	   The reduced-motion block above flattens this along with everything else. */
	.board.phase-idle .cell:not(.cluster-hit):not(.scatter-hit) .symbol {
		transform-origin: center bottom;
		animation: veg-breathe var(--idle-duration, 14s) ease-in-out var(--idle-delay, 0s) infinite;
	}
	@keyframes veg-breathe {
		0%,
		90% {
			transform: translateY(0) scale(1, 1);
		}
		94% {
			transform: translateY(-4.5%) scale(0.99, 1.02);
		}
		97% {
			transform: translateY(0) scale(1.015, 0.985);
		}
		100% {
			transform: translateY(0) scale(1, 1);
		}
	}
	/* Cluster win read-out: heavy white type stroked in dark green, parked on the cluster's centre
	   of mass. Sized off the cell pitch (board square / grid size) so it stays proportional from a
	   7×7 base grid to a 10×10 bonus grid. */
	.win-label {
		position: absolute;
		z-index: 8;
		width: max-content;
		transform: translate(-50%, -50%);
		color: #fff;
		font-size: calc(min(100cqw, 100cqh) / var(--grid-size) * 0.4);
		font-weight: 1000;
		letter-spacing: -0.02em;
		white-space: nowrap;
		-webkit-text-stroke: 0.09em #1d3c0c;
		paint-order: stroke fill;
		text-shadow:
			0 0.06em 0.02em #16300a,
			0 0.1em 0.22em rgb(9 26 5 / 65%);
		pointer-events: none;
		animation: win-label-in 260ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
	}
	@keyframes win-label-in {
		from {
			transform: translate(-50%, -50%) scale(0.55);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
	}
	/* Side payout box. Same furniture as the board frame and the free-spins plaque: brown wood,
	   gold inner rule, green plates. Fixed height — CLUSTER_LOG_SIZE slots are always reserved, so
	   it does not grow or shrink as a cascade fills it. Only shown where there is real gutter next
	   to the board; a square board on a portrait screen leaves none. */
	.cluster-panel {
		position: absolute;
		left: clamp(4px, 1.5cqw, 26px);
		top: 50%;
		z-index: 7;
		display: none;
		width: clamp(142px, 27cqh, 214px);
		padding: clamp(5px, 0.9cqh, 9px);
		border: clamp(3px, 0.6cqh, 6px) solid #744313;
		border-radius: 14px;
		background: linear-gradient(#7c4a16, #452507);
		box-shadow:
			inset 0 0 0 2px #d59b3f,
			inset 0 0 16px #2b1605,
			0 10px 22px rgb(0 0 0 / 38%);
		transform: translateY(-50%);
	}
	@container (min-aspect-ratio: 1.55) {
		.cluster-panel {
			display: block;
		}
	}
	.panel-head {
		padding-bottom: clamp(3px, 0.6cqh, 6px);
		margin-bottom: clamp(4px, 0.7cqh, 7px);
		border-bottom: 2px solid rgb(213 155 63 / 55%);
		color: #ffe07a;
		font-size: clamp(8px, 1.4cqh, 11px);
		font-weight: 1000;
		letter-spacing: 0.14em;
		text-align: center;
		text-shadow: 0 2px 2px #2a1403;
	}
	.panel-rows {
		display: grid;
		grid-template-rows: repeat(var(--slots, 6), 1fr);
		gap: clamp(3px, 0.6cqh, 6px);
	}
	/* The cluster log is read mid-cascade, at a glance, from across the board. Type and symbol are
	   sized for that read rather than for how many rows fit - the row count is fixed at --slots. */
	.panel-row {
		display: grid;
		grid-template-columns: auto 1.9em auto 1fr;
		align-items: center;
		gap: 4px;
		min-height: clamp(23px, 4.1cqh, 34px);
		padding: 2px 6px;
		border: 2px solid #9ec652;
		border-radius: 999px;
		background: linear-gradient(#568c22, #23480f);
		box-shadow: inset 0 2px 0 rgb(255 244 164 / 22%);
		color: #f4ffdf;
		font-size: clamp(10px, 1.9cqh, 15px);
		font-weight: 1000;
	}
	.panel-row.vacant {
		border-color: rgb(158 198 82 / 26%);
		background: rgb(24 48 16 / 45%);
		box-shadow: none;
	}
	.panel-row img {
		width: 1.9em;
		height: 1.9em;
		object-fit: contain;
		filter: drop-shadow(0 1px 1px rgb(0 0 0 / 45%));
	}
	.panel-row strong {
		color: #ffe964;
		text-align: right;
		text-shadow: 0 2px 2px #2a1403;
	}
	.frame-highlight {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 24px rgb(255 207 74 / 22%);
	}
	.scatter-tally {
		position: absolute;
		z-index: 9;
		left: 50%;
		/* Inside the frame, over the bottom row: below the board it collided with the HUD bar. */
		bottom: clamp(6px, 2.5cqh, 22px);
		transform: translateX(-50%);
		padding: clamp(3px, 0.7cqh, 7px) clamp(9px, 1.8cqh, 18px);
		border: 2px solid #ffdd65;
		border-radius: 999px;
		background: linear-gradient(#c98a22, #5e360a);
		box-shadow:
			inset 0 0 0 2px rgb(255 244 164 / 35%),
			0 6px 14px rgb(0 0 0 / 40%);
		color: #fff6cf;
		font-size: clamp(9px, 1.8cqh, 15px);
		font-weight: 1000;
		letter-spacing: 0.12em;
		white-space: nowrap;
		animation: card-in 220ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}
	.bonus-status {
		position: absolute;
		top: 16%;
		right: 2.2%;
		z-index: 8;
		display: grid;
		width: min(150px, 13vw);
		padding: 12px 10px;
		border: 3px solid #754314;
		border-radius: 16px;
		background: linear-gradient(#426f20, #1e4215);
		box-shadow:
			inset 0 0 0 2px #d9ad3f,
			0 8px 20px rgb(0 0 0 / 28%);
		text-align: center;
	}
	.bonus-status span,
	.bonus-status small {
		color: #ffe15b;
		font-size: 9px;
		font-weight: 1000;
		letter-spacing: 0.09em;
	}
	.bonus-status strong {
		font-size: 23px;
	}
	.hud {
		position: absolute;
		z-index: 15;
		left: 50%;
		bottom: max(7px, 1vh);
		transform: translateX(-50%);
		display: grid;
		grid-template-columns: auto minmax(300px, 1fr) auto;
		align-items: center;
		gap: clamp(8px, 1.1vw, 18px);
		width: min(96vw, 1450px);
		min-height: 76px;
		padding: 8px 12px;
		border: 4px solid #774410;
		border-radius: 22px;
		background: linear-gradient(#593407, #2a1904);
		box-shadow:
			inset 0 0 0 2px #bc8124,
			0 8px 22px rgb(0 0 0 / 42%);
	}
	.hud-left,
	.hud-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hud button {
		border: 0;
		color: white;
		font-weight: 1000;
		cursor: pointer;
	}
	.hud button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	.round {
		display: grid;
		place-items: center;
		width: 46px;
		aspect-ratio: 1;
		border: 2px solid #c08b31 !important;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 30%, #674310, #281704 70%);
		box-shadow: inset 0 0 0 2px #3d2607;
	}
	.round span {
		font-size: 20px;
		line-height: 1;
	}
	.round small {
		font-size: 6px;
		color: #ffe064;
	}
	.bonus-button,
	.chance {
		display: grid;
		min-width: 91px;
		min-height: 44px;
		place-content: center;
		padding: 4px 13px;
		border: 2px solid #ffc957 !important;
		border-radius: 12px;
		background: linear-gradient(#ffbd2e, #e17608);
		box-shadow: inset 0 2px #ffe88a;
	}
	.chance {
		min-width: 65px;
		background: linear-gradient(#688f28, #315c18);
		border-color: #bfe453 !important;
	}
	.chance.active {
		background: linear-gradient(#b7ec42, #568919);
		color: #173009;
		box-shadow: 0 0 13px #baff41;
	}
	.bonus-button span,
	.chance span {
		font-size: 12px;
	}
	.bonus-button small,
	.chance small {
		font-size: 7px;
		letter-spacing: 0.08em;
	}
	.bonus-button.deactivate {
		background: linear-gradient(#ff9440, #b93412);
		border-color: #ffd071 !important;
		box-shadow:
			inset 0 2px #ffcf83,
			0 0 10px rgb(255 118 33 / 42%);
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(10px, 2vw, 34px);
		min-width: 0;
	}
	.metric {
		display: grid;
		gap: 2px;
		min-width: 0;
		text-align: center;
	}
	.metric span {
		color: #e8b73e;
		font-size: 9px;
		font-weight: 1000;
		letter-spacing: 0.14em;
	}
	.metric strong {
		overflow: hidden;
		color: #fff;
		font-size: clamp(15px, 1.55vw, 25px);
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 2px #1a0c00;
	}
	.metric.win strong {
		color: #fff09b;
	}
	.bet-stepper {
		display: flex;
		gap: 4px;
	}
	.bet-stepper button {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border: 2px solid #a97423 !important;
		border-radius: 50%;
		background: #342006;
		font-size: 20px;
	}
	/* Design reference (the HUD strip the user supplied alongside 9044:16058) draws both steppers as
	   bars, not as type: inside a 104px button the minus is a 30x4 rule and the plus two of them
	   crossed. Jersey 10's own "+" and "−" rendered a third of that, which is what read as "too
	   small". Drawn instead of typeset so the ink keeps the design's ratio at every HUD size, and
	   drawn as a span rather than an <svg> because `.hud button svg` is resized by six separate
	   breakpoints that all assume a 64x64 icon box. */
	.step-glyph {
		position: relative;
		display: block;
		width: 28.8%;
		aspect-ratio: 1;
	}
	.step-glyph::before,
	.step-glyph::after {
		content: '';
		position: absolute;
		background: currentcolor;
		filter: drop-shadow(2px 2px 0 rgb(35 13 2 / 50%));
	}
	.step-glyph::before {
		top: 50%;
		left: 0;
		width: 100%;
		height: 13.4%;
		min-height: 2px;
		transform: translateY(-50%);
	}
	.step-glyph::after {
		top: 0;
		left: 50%;
		width: 13.4%;
		min-width: 2px;
		height: 100%;
		transform: translateX(-50%);
	}
	.step-glyph.minus::after {
		display: none;
	}
	/* Icon-only, per 9298:294975 — the bolt is 47% of the button's height, and the two-bolt super
	   turbo state is the one variant that is wider than it is tall. Taken out of the button's grid
	   flow on purpose: this button's rows are `1fr auto` for an icon-over-caption pair it no longer
	   has, and a flowed image resolves `1fr` against its own 132px intrinsic height, which blew the
	   row open and then had the button's `overflow: hidden` slice the bolt into a stub. Absolute
	   against the button's padding box, the percentage has a definite box to measure. */
	.turbo-icon {
		position: absolute;
		top: 50%;
		left: 50%;
		width: auto;
		height: 47%;
		transform: translate(-50%, -50%);
		/* The one non-pixel-art mark in the HUD: a smooth vector bolt taken down from 132px, which
		   the skin's blanket `pixelated` turned into a staircase. */
		image-rendering: auto;
		filter: drop-shadow(2px 2px 0 rgb(35 13 2 / 50%));
	}
	.turbo-icon.wide {
		height: 43%;
	}
	.spin {
		position: relative;
		display: grid;
		place-items: center;
		width: 78px;
		aspect-ratio: 1;
		border: 5px solid #ffebad !important;
		border-radius: 50%;
		background: radial-gradient(circle, #ffc63d 0 35%, #ef8b0c 38% 65%, #7f4504 67%);
		box-shadow:
			inset 0 0 0 4px #ff9c12,
			0 4px 10px rgb(0 0 0 / 42%);
	}
	.phase-spinning .symbol-layer,
	.phase-dropping .cell.falling .symbol-layer {
		animation:
			gravity-fall var(--fall-duration) var(--gravity-ease) var(--fall-delay) both,
			land-impact var(--impact-duration) linear var(--impact-delay) forwards;
	}
	.spin span {
		font-size: 51px;
		line-height: 0.8;
		transform: translateY(-2px);
	}
	.spin span.stop {
		font-size: 22px;
		transform: none;
	}
	.event-overlay,
	.modal-layer {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		padding: 20px;
		background: rgb(14 32 5 / 57%);
		backdrop-filter: blur(5px);
	}
	.event-card {
		position: relative;
		width: min(520px, 88vw);
		padding: 32px;
		border: 6px solid #7a4510;
		border-radius: 30px;
		background: radial-gradient(circle at 50% 0, #759731, #294b16 65%, #19340f);
		box-shadow:
			inset 0 0 0 3px #f0c94b,
			0 20px 60px #122000;
		text-align: center;
		animation: card-in 0.46s cubic-bezier(0.17, 0.89, 0.32, 1.35);
	}
	.event-card::before {
		content: '';
		position: absolute;
		inset: 8px;
		border: 1px solid rgb(255 239 140 / 46%);
		border-radius: 20px;
		pointer-events: none;
	}
	.event-card h2 {
		margin: 4px 0;
		color: #fff073;
		font-size: clamp(27px, 4vw, 52px);
		line-height: 0.95;
		-webkit-text-stroke: 1px #482200;
		text-shadow: 0 4px #4c2606;
	}
	.event-card p {
		margin: 10px 0;
		font-weight: 1000;
		letter-spacing: 0.1em;
	}
	.event-card > strong {
		display: block;
		margin-top: 10px;
		font-size: clamp(30px, 5vw, 58px);
		color: #fff;
	}
	.event-card button {
		position: relative;
		z-index: 2;
		margin-top: 14px;
		padding: 12px 28px;
		border: 2px solid #ffe88a;
		border-radius: 999px;
		background: linear-gradient(#ffc53d, #eb800c);
		color: #2f1600;
		font-weight: 1000;
		cursor: pointer;
	}
	.sprout {
		color: #fff067;
		font-size: 27px;
	}
	/* ── Bonus menu ────────────────────────────────────────────────────────────────────────────
	   Design 9257:209905, a 1200x670 frame with the cards straight on the darkened game. The panel
	   is a stage at that frame's aspect, sized to the viewport, and `--u` is one design px of it —
	   every measurement below is the frame's own number times `--u`, which is what keeps the 3+2
	   layout, the title, the close disc and the bet stepper in place at every landscape size. It
	   replaced a px layout that reflowed to two columns under 980px and grew past the screen. */
	.buy-layer {
		padding: 20px;
	}
	.buy-panel {
		--u: calc(100cqw / 1200);
		position: relative;
		width: min(100%, calc((100svh - 40px) * 1200 / 670));
		aspect-ratio: 1200 / 670;
		container-type: inline-size;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
		overflow: visible;
	}
	.buy-panel h2 {
		position: absolute;
		top: calc(21 * var(--u));
		right: 0;
		left: 0;
		margin: 0;
		color: #fff;
		font-size: calc(45 * var(--u));
		line-height: 1;
		text-align: center;
		text-shadow: none;
	}
	/* The close is a round dark disc (9257:210138) at the frame's top-right, against the pixel pass
	   that squares every other button — hence the `!important` on the radius. */
	.buy-panel .close {
		top: calc(24 * var(--u));
		right: auto;
		left: calc(1127 * var(--u));
		display: grid;
		place-items: center;
		width: calc(48.7 * var(--u));
		height: calc(48.7 * var(--u));
		aspect-ratio: 1;
		padding: 0;
		border: max(1px, calc(1 * var(--u))) solid #935901;
		border-radius: 50% !important;
		background: #351e01;
		color: #fff;
	}
	/* Drawn, not typeset: Jersey 10's "×" carries uneven side bearings and sat high and right of
	   the disc's centre ("the x is not centered inside the circle", user 2026-09-16). Two bars on
	   the disc's own centre cannot drift. 16px of ink in the design's 48.7 disc. The menu toggle
	   draws the same cross in its open state. */
	.menu-toggle .close-glyph,
	.buy-panel .close-glyph,
	.auto-layer .close-glyph {
		position: relative;
		display: block;
		width: 34%;
		aspect-ratio: 1;
	}
	.menu-toggle .close-glyph::before,
	.menu-toggle .close-glyph::after,
	.buy-panel .close-glyph::before,
	.buy-panel .close-glyph::after,
	.auto-layer .close-glyph::before,
	.auto-layer .close-glyph::after {
		content: '';
		position: absolute;
		top: 50%;
		left: -8%;
		width: 116%;
		height: max(2px, 20%);
		background: currentcolor;
		transform: translateY(-50%) rotate(45deg);
	}
	.menu-toggle .close-glyph::after,
	.buy-panel .close-glyph::after,
	.auto-layer .close-glyph::after {
		transform: translateY(-50%) rotate(-45deg);
	}
	/* Menu toggle's cross, 9281:249872: a rounded-cap plus (17.5 long, 2.7 thick) scaled x1.414 and
	   turned 45deg inside the 49 box, so the ink spans 17.5 (36% of the box) corner to corner with
	   3.8px (22% of that span) strokes and round ends — lighter than the buy panel's square-cut
	   bars ("the x is wrong", user 2026-09-16). */
	.menu-toggle .close-glyph {
		width: 36%;
	}
	.menu-toggle .close-glyph::before,
	.menu-toggle .close-glyph::after {
		left: -21%;
		width: 142%;
		height: max(2px, 22%);
		border-radius: 999px;
	}
	.menu-toggle.open {
		background: #e38b01 !important;
		background-image: none !important;
		border-color: #e38b01 !important;
		color: #fff;
	}
	.close {
		position: absolute;
		z-index: 2;
		top: 10px;
		right: 12px;
		width: 38px;
		aspect-ratio: 1;
		border: 2px solid #d8ac3c;
		border-radius: 50%;
		background: #402409;
		color: #fff;
		font-size: 26px;
		cursor: pointer;
	}
	/* Three across, then two centred under them — the design's own 3+2: a 1048-wide grid at
	   (75, 72), cards 345.33 x 250.34 on a 6 gap. Six columns, each card spanning two, puts the
	   last row's pair in the middle without a second grid. */
	.buy-grid {
		position: absolute;
		top: calc(72 * var(--u));
		left: calc(75 * var(--u));
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: repeat(2, calc(250.34 * var(--u)));
		gap: calc(6 * var(--u));
		width: calc(1048 * var(--u));
	}
	.buy-grid > .buy-card {
		grid-column: span 2;
	}
	.buy-grid > .buy-card:nth-child(4) {
		grid-column: 2 / span 2;
	}
	/* Card: #351E01 on a 3px #935901 edge, 8px corners. The design measures its rows from the
	   card's outer edge — title at 12, copy at 44, symbol at 99, price at 172, button at 188.34 —
	   so the rows are those exact heights on a 4 gap inside 12/16 of padding that includes the
	   border. Fixed rows, not `auto`: the five copy lines differ by a line or two, and the symbol,
	   price and button have to sit at the same height on every card. */
	.buy-card {
		display: grid;
		grid-template-rows:
			calc(28 * var(--u)) calc(51 * var(--u)) calc(69 * var(--u)) calc(12.34 * var(--u))
			calc(50 * var(--u));
		justify-items: center;
		align-items: center;
		gap: calc(4 * var(--u));
		min-width: 0;
		padding: calc(9 * var(--u)) calc(13 * var(--u));
		border: calc(3 * var(--u)) solid #935901;
		border-radius: calc(8 * var(--u));
		background: #351e01;
		color: #fff;
		box-shadow: none;
	}
	.buy-card img {
		width: calc(70 * var(--u));
		height: calc(69 * var(--u));
		object-fit: contain;
		filter: drop-shadow(0 calc(4 * var(--u)) calc(3 * var(--u)) #1a0d01);
	}
	.buy-card span {
		color: #fff;
		font-size: calc(26.45 * var(--u));
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1;
		text-align: center;
	}
	/* Poppins, at the design's 11px on a 17px line. In Jersey 10 this line was 8px of stems and
	   unreadable (user, 2026-09-15); the design answers that with a different face for copy, not
	   a bigger pixel one. Three lines fit the row; a longer translation is clipped, not reflowed. */
	.buy-card small {
		align-self: start;
		width: 100%;
		overflow: hidden;
		color: #fff;
		font-size: calc(11 * var(--u));
		letter-spacing: 0.02em;
		line-height: calc(17 * var(--u));
		text-align: center;
	}
	/* The design sets the price at 9.36px, which is below what this game's players can read
	   (every "too small" note so far); 12 keeps it a caption without being one. */
	.buy-card em {
		color: #fff;
		font-size: calc(12 * var(--u));
		font-style: normal;
		font-weight: 700;
		line-height: 1;
	}
	.buy-cta {
		width: calc(300 * var(--u));
		max-width: 100%;
		height: calc(50 * var(--u));
		min-height: 0;
		margin: 0;
		padding: 0;
		border: max(1px, calc(1 * var(--u))) solid #935901;
		/* Square, like every other pixel button ("buttons with no rounding", user 2026-09-18). */
		border-radius: 0;
		background: #351e01;
		color: #fff;
		font-size: calc(21.93 * var(--u));
		letter-spacing: 0.058em;
		line-height: 1;
		text-transform: uppercase;
		cursor: pointer;
	}
	/* The buy modes take the filled button; the two per-spin toggles stay outlined. */
	.buy-cta.buy {
		border-color: #e38b01;
		background: #e38b01;
	}
	.buy-cta:hover:not(:disabled) {
		border-color: #ffc45f;
	}
	.buy-cta:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	.buy-card.armed {
		border-color: #ffd166;
		box-shadow: 0 0 calc(14 * var(--u)) rgb(255 202 74 / 55%);
	}
	.buy-card.armed .buy-cta {
		border-color: #ffd166;
		background: #a5660a;
	}
	/* Bet stepper, 9257:211058: a 271.7 x 67 box at (464, 592) — over the bar, where the HUD's
	   own stepper is — with a 48.7 disc at each end and BET over the amount between them. */
	.buy-bet {
		position: absolute;
		top: calc(592 * var(--u));
		left: calc(464 * var(--u));
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		width: calc(271.7 * var(--u));
		height: calc(67 * var(--u));
		padding: 0 calc(14 * var(--u));
		border: max(1px, calc(2 * var(--u))) solid #935901;
		border-radius: calc(12 * var(--u));
		background: #351e01;
	}
	.buy-bet button {
		display: grid;
		place-items: center;
		width: calc(48.7 * var(--u));
		height: calc(48.7 * var(--u));
		padding: 0;
		border: max(1px, calc(1 * var(--u))) solid #935901;
		border-radius: 50% !important;
		background: #351e01;
		color: #fff;
		clip-path: none !important;
		cursor: pointer;
	}
	.buy-bet button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	/* `pressed-flash` is added at runtime by flashControl, so it is :global for the compiler. */
	.buy-bet button:global(.pressed-flash),
	.buy-bet button:active:not(:disabled) {
		background: #65400c;
	}
	.buy-bet .step-glyph::before,
	.buy-bet .step-glyph::after {
		filter: none;
	}
	.buy-bet-readout {
		display: grid;
		gap: calc(4 * var(--u));
		min-width: 0;
		color: #fff;
		text-align: center;
	}
	.buy-bet-readout span {
		font-size: calc(11 * var(--u));
		font-weight: 700;
		letter-spacing: 0.18em;
		line-height: 1;
		text-transform: uppercase;
	}
	.buy-bet-readout strong {
		overflow: hidden;
		font-size: calc(24 * var(--u));
		font-weight: 700;
		line-height: 1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.confirm-note {
		margin: 0;
		max-width: 260px;
		color: #ffd9a0;
		font-size: 11px;
	}
	.confirm-layer {
		z-index: 45;
		background: rgb(7 17 2 / 76%);
	}
	/* ── Confirm / autoplay dialog chrome ──────────────────────────────────────────────────────
	   Measured off the design (Figma 9024:2502, and the 1200x670 board frame it sits in): the
	   dialog is 600x290 there, so every number below is design px at a 600px panel.
	     panel   #311F05 on a 2px #D6902C border, square corners, no inner rings and no drop shadow
	     title   #E6A945, 32px cap height, 40 from the panel's top edge
	     rule    2px #5A370D fading out at both ends, at y 87
	     copy    #EBCD92
	     buttons 59 tall, two 260-wide columns 16 apart, bottom padding 37
	   The green wood panel this replaces was the buy menu's chrome reused; the buy menu keeps it. */
	.confirm-panel {
		position: relative;
		display: grid;
		justify-items: center;
		width: min(600px, 92vw);
		padding: 26px 32px 37px;
		border: 2px solid #d6902c;
		border-radius: 0;
		background: #311f05;
		box-shadow: none;
		text-align: center;
	}
	.dlg-rule {
		width: 100%;
		height: 2px;
		margin-top: 13px;
		background: linear-gradient(
			90deg,
			rgb(90 55 13 / 0%),
			#5a370d 16%,
			#5a370d 84%,
			rgb(90 55 13 / 0%)
		);
	}
	.confirm-panel > small {
		color: #8a5d1b;
		font-weight: 1000;
		letter-spacing: 0.18em;
	}
	.confirm-panel h2 {
		margin: 0;
		color: #e6a945;
		font-size: 46px;
		line-height: 1;
		text-shadow: none;
	}
	.confirm-panel p {
		margin: 22px 0 0;
		color: #ebcd92;
		font-size: 22px;
		line-height: 1.25;
	}
	.confirm-panel > strong {
		margin-top: 6px;
		color: #ebcd92;
		font-size: 26px;
	}
	.confirm-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		width: 100%;
		/* 21, not a round number: it lands the button row on the design's y 194 and the panel on its
		   290, with this dialog carrying a price line the reference frame folds into its one sentence. */
		margin-top: 21px;
	}
	.confirm-actions button {
		min-height: 59px;
		border: 2px solid #8a5d1b;
		border-radius: 0;
		color: #ebcd92;
		font-size: 24px;
		font-weight: 1000;
		cursor: pointer;
	}
	.confirm-actions .cancel {
		background: #311f05;
	}
	.confirm-actions .accept {
		border-color: #d6902c;
		background: #d6902c;
		box-shadow: none;
		color: #fff;
	}
	/* ── Autoplay panel, design 9044:16058 ────────────────────────────────────────────────────────
	   604x477 of #351E01 behind a 3px #935901 border at radius 12. One 540-wide column inset 32 on
	   every side: three switch rows 33.214 tall on a 16 gap from y32, the NUMBER OF SPINS heading,
	   a stepper of two 48.696 circles either side of the figure, and a 540x60 #E38B01 CONFIRM bar
	   landing on the bottom inset. The chip grid this replaces was this game's own invention.
	   Every length is a multiple of --u, the panel's own 1/604th, so the dialog scales as one piece
	   instead of as a stack of independently clamped parts. The design sets the labels, heading and
	   figure in the copy face and CONFIRM in Jersey 10; the measured ink heights (14 cap on the
	   labels, 17 on CONFIRM) are what the sizes below are tuned against. */
	.auto-panel {
		--u: calc(min(604px, 92vw, 118svh) / 604);
		position: relative;
		display: grid;
		justify-items: stretch;
		width: calc(604 * var(--u));
		padding: calc(32 * var(--u));
		border: calc(3 * var(--u)) solid #935901;
		border-radius: calc(12 * var(--u));
		background: #351e01;
		box-shadow: none;
		text-align: center;
	}
	/* Anchored to the overlay, at the design's own screen-corner spot, in the panel's palette. */
	.auto-layer .close {
		top: clamp(8px, 3.6svh, 24px);
		right: clamp(8px, 2vw, 24px);
		display: grid;
		place-items: center;
		width: clamp(22px, 6.4svh, 49px);
		height: auto;
		padding: 0;
		border: 1px solid #935901;
		/* The skin squares every close button; this one is the design's own circle. */
		border-radius: 50% !important;
		background: #361e01;
	}
	.auto-toggles {
		display: grid;
		gap: calc(16 * var(--u));
	}
	.auto-toggle-row {
		display: flex;
		gap: calc(16 * var(--u));
		align-items: center;
		justify-content: space-between;
		min-height: calc(33.214 * var(--u));
	}
	.auto-toggle-row span {
		color: #fff;
		font-size: calc(28 * var(--u));
		font-weight: 400;
		letter-spacing: calc(0.6 * var(--u));
		text-align: left;
	}
	/* 62x33.214 pill carrying a 23 knob inset 5, so the knob travels 62 - 5 - 23 = 34. */
	.switch {
		position: relative;
		flex: none;
		width: calc(62 * var(--u));
		height: calc(33.214 * var(--u));
		border: calc(1.5 * var(--u)) solid #e38b01 !important;
		border-radius: 999px;
		background: #351e01;
		cursor: pointer;
		transition: background 140ms linear;
	}
	.switch::after {
		content: '';
		position: absolute;
		top: 50%;
		left: calc(5 * var(--u));
		width: calc(23 * var(--u));
		height: calc(23 * var(--u));
		border-radius: 50%;
		background: #fff;
		transform: translateY(-50%);
		transition: left 140ms ease;
	}
	.switch.on {
		background: #e38b01;
	}
	.switch.on::after {
		left: calc(34 * var(--u));
	}
	.switch:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.auto-panel h2 {
		margin: calc(62 * var(--u)) 0 0;
		color: #fff;
		font-size: calc(28 * var(--u));
		font-weight: 400;
		letter-spacing: calc(0.6 * var(--u));
		line-height: 1;
		text-shadow: none;
	}
	.auto-count {
		display: flex;
		gap: calc(30 * var(--u));
		align-items: center;
		justify-content: center;
		margin-top: calc(28 * var(--u));
	}
	.auto-count button {
		display: grid;
		place-items: center;
		width: calc(48.696 * var(--u));
		height: calc(48.696 * var(--u));
		border: calc(1 * var(--u)) solid #935901 !important;
		border-radius: 50%;
		background: #361e01;
		color: #fff;
		box-shadow: none;
		cursor: pointer;
	}
	.auto-count button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	/* Jersey 10 throughout, like every other panel in the game ("fonts here should be same as
	   others", user 2026-09-16); it sets a third smaller than the Poppins it replaces at the same
	   em, so each size below is stepped up to keep the design's visual weight. */
	.auto-count strong {
		min-width: calc(64 * var(--u));
		color: #fff;
		font-size: calc(46 * var(--u));
		font-weight: 400;
		line-height: 1;
	}
	.auto-panel p {
		margin: calc(22 * var(--u)) 0 calc(24 * var(--u));
		color: #e6c28a;
		font-size: calc(19 * var(--u));
		line-height: 1.2;
	}
	.auto-start {
		min-height: calc(60 * var(--u));
		border: 0 !important;
		border-radius: 0;
		background: #e38b01;
		box-shadow: none;
		color: #fff;
		font-size: calc(32 * var(--u));
		line-height: 1;
		cursor: pointer;
	}
	.auto-start:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.quick-menu {
		position: fixed;
		left: 2%;
		bottom: 100px;
		z-index: 40;
		display: grid;
		gap: 7px;
		width: 170px;
		padding: 10px;
		border: 2px solid #b8832b;
		border-radius: 14px;
		background: #2c1b07ee;
		box-shadow: 0 10px 30px #0008;
	}
	.quick-menu button {
		padding: 10px;
		border: 1px solid #7d5b1d;
		border-radius: 8px;
		background: #4a3010;
		color: #ffe270;
		font-weight: 900;
		cursor: pointer;
	}
	@keyframes trapdoor-exit {
		from {
			transform: none;
		}
		to {
			transform: translateY(var(--exit-offset)) scale(0.96, 1.08);
		}
	}
	/* Pure travel — no fade, no blur: the board clips its own overflow, so a symbol simply is not
	   there yet. A stretch along the fall axis carries the speed instead. */
	@keyframes gravity-fall {
		from {
			transform: translateY(var(--fall-offset)) scale(0.97, 1.06);
		}
		to {
			transform: translateY(0) scale(1, 1);
		}
	}
	/* Landing settle: a soft touchdown, not a stone-hit. The earlier 13% squash and 7% bounce
	   read as a jolt; the user asked for "a very gentle shake when items hit their cell"
	   (2026-09-16), so the squash is a few percent, the rebound a pixel or two, with a hair of
	   side-to-side wobble as the symbol comes to rest. Same phase split as magnetic's
	   squash / thump / bounce / settle so the timing profile is unchanged. */
	@keyframes land-impact {
		0% {
			transform: none;
		}
		22% {
			transform: translate(0, 0) scale(1.045, 0.945);
		}
		45% {
			transform: translate(-1.5%, -2.5%) scale(0.99, 1.015);
		}
		68% {
			transform: translate(1%, 0) scale(1.01, 0.995);
		}
		86% {
			transform: translate(-0.5%, -0.6%) scale(1, 1);
		}
		100% {
			transform: none;
		}
	}
	@keyframes scatter-throb {
		from {
			transform: scale(1);
			filter: brightness(1);
		}
		to {
			transform: scale(1.12);
			filter: brightness(1.28) drop-shadow(0 0 8px rgb(255 226 128 / 85%));
		}
	}
	@keyframes cluster-pulse {
		from {
			transform: scale(1);
			filter: brightness(1);
		}
		to {
			transform: scale(1.08);
			filter: brightness(1.24);
		}
	}
	@keyframes harvest {
		0% {
			transform: none;
			filter: brightness(1.2);
		}
		26% {
			transform: scale(1.18, 0.88);
			filter: brightness(1.9);
		}
		48% {
			transform: scale(0.94, 1.14) translateY(-8%);
			filter: brightness(2.2);
		}
		100% {
			transform: scale(0.06) rotate(14deg) translateY(6%);
			opacity: 0;
			filter: brightness(2.4);
		}
	}
	@keyframes card-in {
		from {
			transform: scale(0.72);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	@media (max-width: 980px) {
		.game-stage {
			top: 8%;
			bottom: max(14%, 100px);
			padding: 0 6px;
		}
		.bonus-status {
			top: 10px;
			right: 10px;
			width: 115px;
		}
		.hud {
			grid-template-columns: auto 1fr auto;
			gap: 6px;
			min-height: 65px;
			padding: 5px 7px;
		}
		.chance {
			display: none;
		}
		.bonus-button {
			min-width: 72px;
			padding: 4px 8px;
		}
		.round {
			width: 38px;
		}
		.spin {
			width: 62px;
		}
		.spin span {
			font-size: 40px;
		}
		.bet-stepper {
			display: none;
		}
		.metrics {
			gap: 7px;
		}
		.metric strong {
			font-size: 15px;
		}
	}
	@media (max-width: 680px), (orientation: portrait) {
		.brand {
			top: 5px;
			padding: 4px 15px 6px;
		}
		.brand small,
		.brand-leaf {
			display: none;
		}
		.game-stage {
			top: 7%;
			bottom: max(16%, 96px);
			padding: 0 4px;
		}
		.board-frame {
			padding: 7px;
			border-width: 7px;
			border-radius: 10px;
		}
		.hud {
			width: 99vw;
			bottom: 3px;
			grid-template-columns: auto 1fr auto;
			border-width: 3px;
			border-radius: 14px;
		}
		.hud-left .utility,
		.auto {
			display: none;
		}
		.bonus-button {
			min-width: 64px;
		}
		.metric.balance {
			display: none;
		}
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		/* Narrow / portrait: the 1200x670 stage would put a 4px sentence on a phone, so the same
		   drawing flows instead — one card per row at close to design size, scrolling, with the
		   stepper under the cards. `--u` is a card-width unit here rather than a frame one. */
		.buy-layer {
			padding: 8px;
		}
		.buy-panel {
			--u: calc(min(100vw - 16px, 420px) / 380);
			width: min(100%, 420px);
			max-height: calc(100svh - 16px);
			aspect-ratio: auto;
			container-type: normal;
			padding: calc(8 * var(--u)) calc(8 * var(--u)) calc(12 * var(--u));
			overflow-y: auto;
		}
		.buy-panel h2 {
			position: static;
			margin: calc(8 * var(--u)) calc(56 * var(--u)) calc(14 * var(--u));
			font-size: calc(34 * var(--u));
		}
		.buy-panel .close {
			top: calc(4 * var(--u));
			right: calc(4 * var(--u));
			left: auto;
			width: calc(44 * var(--u));
			height: calc(44 * var(--u));
			font-size: calc(28 * var(--u));
		}
		.buy-grid {
			position: static;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			gap: calc(8 * var(--u));
			width: 100%;
		}
		.buy-grid > .buy-card,
		.buy-grid > .buy-card:nth-child(4) {
			grid-column: auto;
		}
		.buy-card {
			grid-template-rows: auto auto calc(69 * var(--u)) auto calc(50 * var(--u));
		}
		.buy-card small {
			overflow: visible;
		}
		.buy-bet {
			position: static;
			width: min(100%, calc(271.7 * var(--u)));
			margin: calc(12 * var(--u)) auto 0;
		}
	}
	@media (max-height: 650px) and (orientation: landscape) {
		.brand {
			top: 2px;
			transform: translateX(-50%) scale(0.76);
			transform-origin: top center;
		}
		.game-stage {
			/* Only the top moves here — the bottom inset stays with the width breakpoints, which are
			   the ones that actually change the HUD's height. */
			top: 5%;
		}
		.hud {
			min-height: 58px;
		}
		.bonus-status {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
		}
	}

	/* Pixel-art skin. Keeps game state, controls, math, and responsive layout unchanged. */
	.scene {
		font-family: 'Jersey 10', monospace;
		background: #148fd5 var(--pixel-background) center / 100% 100% no-repeat;
		image-rendering: pixelated;
		transition: none;
	}
	.scene::after {
		background:
			repeating-linear-gradient(0deg, rgb(0 0 0 / 3%) 0 2px, transparent 2px 4px),
			rgb(4 20 13 / 12%);
		mix-blend-mode: multiply;
	}
	.scene > .sun-moon,
	.scene > .rainbow,
	.scene > .cloud,
	.scene > .tree-line,
	.scene > .meadow,
	.scene > .corner-foliage {
		display: none;
	}
	.brand {
		top: max(3px, 0.5vh);
		width: min(410px, 42vw);
		height: clamp(48px, 8vh, 82px);
		padding: 0;
		border: 0;
		border-radius: 0;
		background: url('/assets/veggie-salad/pixel/logo.webp') center / contain no-repeat;
		box-shadow: none;
		transform: translateX(-50%);
	}
	.brand div,
	.brand-leaf {
		display: none;
	}
	.game-stage {
		top: 10%;
		bottom: max(12%, 118px);
	}
	.board-shadow {
		border-radius: 0;
		background: rgb(0 20 7 / 64%);
		filter: blur(0);
		transform: translate(8px, 10px);
	}
	.board-frame {
		padding: clamp(5px, 0.8vw, 10px);
		border: clamp(7px, 0.9vw, 12px) solid #713a0d;
		border-radius: 0;
		background: #9b5b16;
		box-shadow:
			inset 0 0 0 3px #d49a36,
			inset 0 0 0 6px #4b260b,
			8px 10px 0 #321b0a;
	}
	.board-frame::before {
		inset: 4px;
		border: 2px solid #f0bd55;
		border-radius: 0;
	}
	.board-frame::after {
		background: none;
	}
	.board {
		gap: 2px;
		padding: 2px;
		background: #a86a20;
		border: 3px solid #281707;
		animation-timing-function: steps(4);
	}
	.cell::before {
		background: #304817;
		box-shadow:
			inset 0 0 0 1px #13240c,
			inset 0 -4px 0 rgb(0 0 0 / 18%);
	}
	.cell.cluster-hit::before {
		background: #7eaa25;
		box-shadow:
			inset 0 0 0 2px #e8f45c,
			0 0 0 2px #4d7315;
	}
	.cell.scatter-hit::before {
		background: #b47c1e;
		box-shadow:
			inset 0 0 0 2px #ffe36e,
			0 0 0 2px #70420c;
	}
	.symbol,
	.backplate {
		filter: drop-shadow(3px 3px 0 rgb(0 0 0 / 42%));
		image-rendering: pixelated;
	}
	.backplate {
		filter: drop-shadow(0 0 0 #ffe36a);
	}
	/* Design 9257:211159: the win read-out is a plaque, not loose type — a #2C1901 field inside a
	   #844A0D border with stepped corners, the amount in #E38B01 Jersey 10. White type stroked in
	   dark green was the thing that would not read against the board. Proportions are the design's
	   own 340x133 plaque: 6px of border and a 57px cap against 81px type, so 0.075em and 0.7em. The
	   design's side padding (1.02em) is cut to 0.62em — at cluster-label size the full plaque runs
	   wider than two cells. */
	.win-label {
		padding: 0.14em 0.62em 0.2em;
		border: 0.1em solid #844a0d;
		background: #2c1901;
		color: #e38b01;
		font-family: inherit;
		font-size: calc(min(100cqw, 100cqh) / var(--grid-size) * 0.34);
		line-height: 1.2;
		/* One chamfer stands in for the design's two-step corner stair: scaled to a board cell each
		   step is under 3px, and the stair reads as a single cut anyway. */
		clip-path: polygon(
			0.18em 0,
			calc(100% - 0.18em) 0,
			100% 0.18em,
			100% calc(100% - 0.18em),
			calc(100% - 0.18em) 100%,
			0.18em 100%,
			0 calc(100% - 0.18em),
			0 0.18em
		);
		-webkit-text-stroke: 0;
		text-shadow: none;
		filter: drop-shadow(0.06em 0.08em 0 rgb(0 0 0 / 45%));
		animation: pixel-win-in 260ms steps(4) both;
	}
	.bonus-status,
	.scatter-tally,
	.cluster-panel,
	.hud,
	.quick-menu,
	.buy-panel,
	.confirm-panel,
	.event-card {
		border-radius: 0;
		font-family: inherit;
	}
	.bonus-status,
	.scatter-tally {
		border: 3px solid #3c210b;
		box-shadow: 3px 3px 0 #211107;
		background: #5c2d0a;
	}
	.cluster-panel {
		border: 4px solid #6f390e;
		background: #24380f;
		box-shadow: 4px 5px 0 #251407;
	}
	.panel-head {
		border-radius: 0;
		background: #8b5217;
		color: #ffe475;
	}
	.panel-row {
		border-radius: 0;
		border-color: #47631d;
	}
	.hud {
		width: min(92vw, 1700px);
		min-height: 116px;
		padding: 12px 20px;
		gap: 0;
		border: 4px solid #6d390d;
		border-radius: 0;
		background: #3b1e09;
		box-shadow: 5px 6px 0 rgb(18 8 2 / 75%);
	}
	.hud-left,
	.hud-right,
	.metrics {
		gap: 0;
	}
	.hud-left .utility {
		width: 72px;
		height: 72px;
		border-right: 2px solid #80500d !important;
		box-shadow: none;
	}
	.bonus-button {
		min-width: 190px;
		height: 72px;
		border: 0 !important;
		box-shadow: none !important;
		background: #ec9200;
	}
	.chance {
		display: none;
	}
	.metric {
		min-width: 180px;
		min-height: 72px;
		padding: 0 28px;
		border-left: 2px solid #80500d;
	}
	.metric span {
		font-size: 14px;
	}
	.metric strong {
		font-size: clamp(18px, 1.7vw, 27px);
	}
	.hud-right {
		margin-left: auto;
		gap: 18px;
	}
	/* The design row runs one square size across the stepper, the bolt and the auto button — 104 of
	   the bar's 157px inner height. Against this HUD's 84px inner box that is 58, which the stepper
	   already used and the two utilities did not. */
	.bet-stepper button,
	.hud-right .utility {
		width: 58px;
		height: 58px;
	}
	.spin {
		width: 150px;
		margin: -28px 0;
		border: 7px solid #f7c45c !important;
	}
	.spin span {
		font-size: 92px;
	}
	.hud button,
	.confirm-actions button,
	.event-card button,
	.quick-menu button {
		border-radius: 0;
		font-family: inherit;
		box-shadow: 3px 3px 0 #1c0d04;
	}
	.spin {
		border-radius: 0 !important;
		background: #e29b19;
		box-shadow: 4px 4px 0 #412008 !important;
	}
	.event-overlay,
	.modal-layer {
		background: rgb(4 17 12 / 72%);
		backdrop-filter: none;
	}
	.event-card {
		width: min(620px, 88vw);
		padding: clamp(24px, 5vw, 48px);
		border: 6px solid #6d360b;
		background: #315018;
		box-shadow:
			inset 0 0 0 4px #d49b35,
			inset 0 0 0 8px #351b08,
			8px 10px 0 #1c0d05;
		animation: pixel-card-in 360ms steps(5);
	}
	.event-card::before {
		inset: 12px;
		border: 2px solid #9cc53c;
		border-radius: 0;
	}
	.event-card h2 {
		font-family: inherit;
		color: #ffe24e;
		text-shadow: 4px 4px 0 #552308;
	}
	.event-card p {
		color: #fff6bd;
	}
	.event-card > strong {
		color: #fff;
		text-shadow: 3px 3px 0 #4f2408;
	}
	.event-card.kind-win {
		background: #8c2418;
	}
	.event-card.kind-bonus {
		background: #8a5911;
	}
	.event-card.kind-mystery {
		background: #4e2077;
	}
	.event-card.kind-retrigger {
		background: #1e5c72;
	}
	/* The green wood panel and its cards used to be redefined here. Both dialogs and the bonus menu
	   now carry their own design colours, so there is nothing left for this block to repaint. */
	.close {
		border-radius: 0 !important;
	}
	@keyframes harvest {
		0% {
			transform: scale(1);
			opacity: 1;
			filter: brightness(1);
		}
		24% {
			transform: scale(1.18, 0.84);
			filter: brightness(2.4);
		}
		48% {
			transform: scale(0.88, 1.13);
			opacity: 1;
			filter: brightness(3);
		}
		76% {
			transform: scale(0.42);
			opacity: 0.7;
			filter: brightness(2);
		}
		100% {
			transform: scale(0);
			opacity: 0;
			filter: brightness(2);
		}
	}
	@keyframes pixel-burst-a {
		0%,
		20% {
			transform: translate(0, 0) scale(0);
			opacity: 0;
		}
		35% {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(-120%, -95%) scale(0.3);
			opacity: 0;
		}
	}
	@keyframes pixel-burst-b {
		0%,
		20% {
			transform: rotate(45deg) translate(0, 0) scale(0);
			opacity: 0;
		}
		35% {
			transform: rotate(45deg) translate(0, 0) scale(0.72);
			opacity: 1;
		}
		100% {
			transform: rotate(45deg) translate(110%, 105%) scale(0.2);
			opacity: 0;
		}
	}
	@keyframes pixel-win-in {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0);
		}
		75% {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1.12);
		}
		100% {
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@keyframes pixel-card-in {
		0% {
			opacity: 0;
			transform: scale(0.72);
		}
		60% {
			opacity: 1;
			transform: scale(1.04);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.scene::after {
			display: none;
		}
	}

	/* Currency values fit from their actual rendered character count. cqw measures each metric,
	   not viewport, so long currency prefixes and large balances cannot cross dividers. */
	.metric {
		container-type: inline-size;
	}
	.metric strong {
		display: block;
		width: 100%;
		max-width: 100%;
		overflow: visible;
		font-size: clamp(10px, calc(145cqw / var(--chars, 8)), 28px) !important;
		letter-spacing: 0;
		text-overflow: clip;
	}

	/* Bonus HUD has two independent values: current free-spin WIN stays in the main HUD; this
	   compact side stack shows spin progress and the authoritative cumulative bonus total. */
	.bonus-readouts {
		position: absolute;
		top: 15%;
		right: clamp(8px, 2vw, 28px);
		z-index: 14;
		display: grid;
		gap: clamp(8px, 1.1vh, 13px);
		width: clamp(132px, 13vw, 196px);
		pointer-events: none;
	}
	.bonus-readout,
	.bonus-status {
		position: static;
		top: auto;
		right: auto;
		display: grid;
		width: 100%;
		min-width: 0;
		padding: clamp(10px, 1.3vh, 15px) 9px;
		border: 5px solid #3a1b05;
		border-radius: 0;
		background:
			repeating-linear-gradient(0deg, rgb(255 255 255 / 4%) 0 3px, transparent 3px 7px), #5c2d0a;
		box-shadow:
			inset 0 0 0 3px #d99a32,
			inset 0 0 0 7px #75400e,
			5px 5px 0 #211107;
		font-family: inherit;
		text-align: center;
		container-type: inline-size;
	}
	.bonus-total {
		background:
			repeating-linear-gradient(0deg, rgb(255 255 255 / 4%) 0 3px, transparent 3px 7px), #24380f;
	}
	.bonus-readout span,
	.bonus-readout small,
	.bonus-status span,
	.bonus-status small {
		color: #ffe15b;
		font-size: clamp(8px, 0.72vw, 12px);
		font-weight: 1000;
		letter-spacing: 0.08em;
	}
	.bonus-readout strong,
	.bonus-status strong {
		display: block;
		width: 100%;
		overflow: hidden;
		font-size: clamp(14px, calc(150cqw / var(--chars, 8)), 28px);
		line-height: 1.15;
		white-space: nowrap;
	}

	/* Desktop HUD: measured against supplied 1820×244 reference crop. */
	@media (min-width: 1180px) and (orientation: landscape) {
		.hud {
			grid-template-columns: clamp(220px, 17vw, 310px) minmax(460px, 1fr) auto;
			width: min(92vw, 1700px);
			height: clamp(78px, 8.6vh, 96px);
			min-height: 0;
			padding: 6px 14px;
			gap: 0;
			border: 4px solid #78420d;
			background: #351a06;
			box-shadow:
				inset 0 0 0 2px #9a5b12,
				0 7px 0 rgb(20 9 2 / 74%);
			overflow: visible;
			bottom: clamp(20px, 3vh, 38px);
		}
		.hud-left {
			display: grid;
			grid-template-columns: clamp(58px, 4.4vw, 76px) 1fr;
			width: 100%;
			height: 100%;
			gap: 0;
		}
		.hud-left .utility {
			width: 100%;
			height: 100%;
			border: 2px solid #9c641b !important;
			background: #2e1806;
			box-shadow: inset 0 0 0 2px #1c0d03;
			font-size: clamp(24px, 2vw, 36px);
		}
		.bonus-button {
			width: 100%;
			min-width: 0;
			height: 100%;
			border: 2px solid #f3a70c !important;
			background: #eb9000;
			box-shadow: none !important;
		}
		.bonus-button span {
			font-size: clamp(15px, 1.25vw, 23px);
		}
		.bonus-button small {
			display: none;
		}
		.metrics {
			display: grid;
			grid-template-columns: 1fr 1.2fr 1fr;
			width: 100%;
			height: 100%;
			gap: 0;
		}
		.metric {
			align-content: center;
			min-width: 0;
			min-height: 0;
			height: 100%;
			padding: 0 clamp(14px, 1.4vw, 27px);
			border-left: 2px solid #70400d;
			text-align: left;
		}
		.metric span {
			font-size: clamp(10px, 0.9vw, 16px);
			letter-spacing: 0.16em;
		}
		.metric strong {
			font-size: clamp(17px, 1.55vw, 28px);
			line-height: 1.15;
		}
		.hud-right {
			display: grid;
			grid-template-columns: auto clamp(92px, 7.4vw, 132px) clamp(48px, 3.8vw, 66px) clamp(
					48px,
					3.8vw,
					66px
				);
			align-items: center;
			height: 100%;
			margin-left: 0;
			gap: clamp(7px, 0.8vw, 14px);
			padding-left: clamp(8px, 1vw, 18px);
			border-left: 2px solid #70400d;
		}
		.bet-stepper {
			gap: clamp(5px, 0.6vw, 10px);
		}
		.bet-stepper button {
			width: clamp(46px, 3.8vw, 62px);
			height: clamp(46px, 3.8vw, 62px);
			border: 2px solid #8e5817 !important;
			background: #2c1705;
			box-shadow: 3px 3px 0 #160901;
		}
		.spin {
			width: clamp(92px, 7.4vw, 132px);
			height: clamp(92px, 7.4vw, 132px);
			margin: clamp(-20px, -1.2vw, -12px) 0;
			border: 7px solid #c87900 !important;
			border-radius: 50% !important;
			background: #ed9700;
			box-shadow:
				inset 0 0 0 4px #f8bd32,
				4px 5px 0 #6d3905 !important;
		}
		.spin span {
			font-size: clamp(58px, 5vw, 88px);
		}
		.hud-right .utility {
			width: 100%;
			height: clamp(46px, 3.8vw, 62px);
			border: 2px solid #8e5817 !important;
			border-radius: 0;
			background: #2c1705;
			box-shadow: 3px 3px 0 #160901;
		}
	}

	@media (min-width: 681px) and (max-width: 1179px) and (orientation: landscape) {
		.hud {
			grid-template-columns: clamp(130px, 20vw, 180px) minmax(0, 1fr) auto;
			width: calc(100vw - 16px);
			height: 76px;
			min-height: 0;
			padding: 5px 8px;
			gap: 0;
			bottom: 14px;
			border-radius: 0;
			overflow: visible;
		}
		.hud-left {
			display: grid;
			grid-template-columns: 44px 1fr;
			height: 100%;
			gap: 0;
		}
		.hud-left .utility,
		.bonus-button {
			width: 100%;
			height: 100%;
			min-width: 0;
			border-radius: 0;
		}
		.bonus-button small,
		.chance {
			display: none;
		}
		.metrics {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			height: 100%;
			gap: 0;
		}
		.metric {
			align-content: center;
			min-width: 0;
			min-height: 0;
			height: 100%;
			padding: 0 8px;
			border-left: 1px solid #70400d;
			text-align: left;
		}
		.metric span {
			font-size: 9px;
		}
		.metric strong {
			font-size: clamp(9px, calc(140cqw / var(--chars, 8)), 20px) !important;
		}
		.hud-right {
			display: grid;
			grid-template-columns: auto 76px 40px 40px;
			align-items: center;
			height: 100%;
			margin: 0;
			padding-left: 7px;
			gap: 5px;
			border-left: 1px solid #70400d;
		}
		.bet-stepper {
			gap: 3px;
		}
		.bet-stepper button {
			width: 34px;
			height: 40px;
		}
		.spin {
			width: 76px;
			height: 76px;
			margin: -8px 0;
			border: 5px solid #c87900 !important;
			border-radius: 50% !important;
		}
		.spin span {
			font-size: 52px;
		}
		.hud-right .utility {
			display: grid;
			width: 40px;
			height: 44px;
			border-radius: 0;
		}
	}

	@media (max-width: 680px), (orientation: portrait) {
		.game-stage {
			bottom: 124px;
		}
		.hud {
			grid-template-areas:
				'metrics metrics'
				'left right';
			grid-template-columns: 108px minmax(0, 1fr);
			grid-template-rows: 42px 56px;
			width: calc(100vw - 8px);
			height: 106px;
			min-height: 0;
			padding: 3px 4px;
			gap: 2px 0;
			bottom: 4px;
			border-width: 3px;
			border-radius: 0;
			overflow: visible;
		}
		.hud-left {
			grid-area: left;
			display: grid;
			grid-template-columns: 36px 72px;
			height: 52px;
			gap: 0;
		}
		.hud-left .utility {
			display: grid;
			width: 36px;
			height: 52px;
			border-radius: 0;
			font-size: 18px;
		}
		.bonus-button {
			width: 72px;
			min-width: 0;
			height: 52px;
			padding: 2px;
			border-radius: 0;
		}
		.bonus-button span {
			font-size: 10px;
		}
		.bonus-button small,
		.chance {
			display: none;
		}
		.metrics {
			grid-area: metrics;
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			height: 42px;
			gap: 0;
		}
		.metric {
			align-content: center;
			display: grid;
			min-width: 0;
			min-height: 0;
			height: 42px;
			padding: 0 5px;
			border-left: 1px solid #70400d;
			text-align: left;
		}
		.metric:first-child {
			border-left: 0;
		}
		.metric span {
			font-size: 7px;
			line-height: 1;
		}
		.metric strong {
			font-size: clamp(8px, calc(138cqw / var(--chars, 8)), 15px) !important;
			line-height: 1.1;
		}
		.hud-right {
			grid-area: right;
			display: grid;
			grid-template-columns: 56px 54px 34px 34px;
			justify-content: end;
			align-items: center;
			height: 52px;
			margin: 0;
			padding: 0;
			gap: 3px;
		}
		.bet-stepper {
			gap: 2px;
		}
		.bet-stepper button {
			width: 27px;
			height: 36px;
			padding: 0;
			font-size: 15px;
		}
		.spin {
			width: 54px;
			height: 54px;
			margin: -1px 0;
			border: 4px solid #c87900 !important;
			border-radius: 50% !important;
		}
		.spin span {
			font-size: 38px;
		}
		.hud-right .utility,
		.auto {
			display: grid;
			width: 34px;
			height: 38px;
			border-radius: 0;
			padding: 0;
		}
		.hud-right .utility span {
			font-size: 15px;
		}
	}

	/* Portrait composition: board, payout strip, split control/metric HUD. */
	@media (orientation: portrait) {
		.brand {
			top: clamp(48px, 7vh, 72px);
			width: 90vw;
			height: clamp(68px, 11vh, 104px);
		}
		.game-stage {
			top: clamp(128px, 17vh, 158px);
			bottom: clamp(205px, 29vh, 260px);
			padding: 0 8px;
		}
		.cluster-panel {
			display: block;
			left: 50%;
			top: auto;
			bottom: -50px;
			width: min(94vw, 430px);
			padding: 4px;
			border-width: 3px;
			transform: translateX(-50%);
		}
		.panel-rows {
			display: grid;
			grid-template-columns: repeat(var(--slots, 6), minmax(0, 1fr));
			grid-template-rows: 34px;
			gap: 3px;
		}
		.panel-row {
			grid-template-columns: auto 1fr;
			min-height: 34px;
			padding: 1px 3px;
			font-size: 8px;
		}
		.panel-row span:nth-of-type(2),
		.panel-row strong {
			display: none;
		}
		.hud {
			grid-template-areas:
				'left right'
				'metrics metrics';
			grid-template-columns: minmax(112px, 42%) minmax(0, 1fr);
			grid-template-rows: clamp(64px, 9.5vh, 88px) clamp(54px, 7.5vh, 68px);
			width: calc(100vw - 16px);
			height: auto;
			padding: 0;
			row-gap: clamp(18px, 3.5vh, 34px);
			bottom: clamp(10px, 2vh, 18px);
			border: 0;
			background: none;
			box-shadow: none;
		}
		.hud::before {
			content: '';
			position: absolute;
			z-index: 0;
			z-index: -1;
			inset: 0 0 auto;
			height: clamp(64px, 9.5vh, 88px);
			border: 3px solid #78420d;
			background: #351a06;
			box-shadow: 0 5px 0 rgb(20 9 2 / 68%);
		}
		.hud-left {
			grid-area: left;
			grid-template-columns: clamp(38px, 12vw, 58px) minmax(68px, 1fr);
			height: 100%;
			padding: 7px 0 7px 7px;
		}
		.hud-left .utility,
		.bonus-button {
			height: 100%;
		}
		.hud-right {
			grid-area: right;
			grid-template-columns: clamp(62px, 19vw, 96px) clamp(34px, 10vw, 50px) clamp(34px, 10vw, 50px);
			justify-content: end;
			height: 100%;
			padding: 0 7px 0 4px;
			gap: clamp(3px, 1.2vw, 8px);
		}
		.spin {
			width: clamp(62px, 19vw, 96px);
			height: clamp(62px, 19vw, 96px);
			margin: clamp(-7px, -1.2vh, -3px) 0;
		}
		.spin span {
			font-size: clamp(42px, 13vw, 68px);
		}
		.hud-right .utility,
		.auto {
			width: clamp(34px, 10vw, 50px);
			height: clamp(42px, 12vw, 58px);
		}
		.bet-stepper {
			position: absolute;
			z-index: 3;
			left: 28%;
			right: 28%;
			bottom: 0;
			display: flex;
			justify-content: space-between;
			height: clamp(54px, 7.5vh, 68px);
			padding: 6px;
			border: 3px solid #8c520f;
			background: #351a06;
		}
		.bet-stepper button {
			width: clamp(34px, 10vw, 48px);
			height: 100%;
			border-radius: 50%;
		}
		.metrics {
			grid-area: metrics;
			grid-template-columns: 1fr 1.7fr 1fr;
			height: clamp(54px, 7.5vh, 68px);
			gap: 6px;
		}
		.metric {
			height: 100%;
			padding: 7px 9px;
			border: 2px solid #1b3441;
			background: rgb(2 17 25 / 94%);
		}
		.metric:first-child {
			grid-column: 1;
			grid-row: 1;
		}
		.metric.bet {
			z-index: 2;
			grid-column: 2;
			grid-row: 1;
			padding-inline: 32%;
			border-color: #8c520f;
			background: #351a06;
			text-align: center;
		}
		.metric.win {
			grid-column: 3;
			grid-row: 1;
		}
		.metric span {
			font-size: clamp(7px, 2.5vw, 11px);
		}
		.metric strong {
			font-size: clamp(8px, calc(136cqw / var(--chars, 8)), 18px) !important;
		}
		.bonus-readouts {
			top: clamp(74px, 10vh, 106px);
			right: 8px;
			gap: 6px;
			width: clamp(104px, 27vw, 132px);
		}
		.bonus-readout,
		.bonus-status {
			padding: 7px 5px;
			border-width: 3px;
		}
		.bonus-readout span,
		.bonus-readout small,
		.bonus-status span,
		.bonus-status small {
			font-size: 7px;
		}
	}

	@media (max-height: 650px) and (orientation: landscape) {
		.bonus-readouts {
			top: 8%;
			width: 106px;
			gap: 4px;
		}
		.bonus-readout,
		.bonus-status {
			padding: 4px;
		}
	}

	/* Final reference lock: shipped pixel art, not the old procedural CSS approximation. */
	.scene {
		background: #16a9ed;
		image-rendering: pixelated;
	}
	.pixel-background-stack {
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
	}
	.pixel-background {
		position: absolute;
		inset: 0;
		z-index: 0;
		background: var(--pixel-background) center bottom / 100% auto no-repeat;
		image-rendering: pixelated;
		pointer-events: none;
	}
	.background-bonus {
		opacity: 0;
	}
	.sun-moon,
	.rainbow,
	.cloud,
	.tree-line,
	.meadow {
		display: none;
	}
	.corner-foliage {
		z-index: 1;
		background: none;
		overflow: hidden;
	}
	.corner-foliage::before,
	.corner-foliage::after {
		content: '';
		position: absolute;
		top: -6px;
		width: clamp(180px, 25vw, 390px);
		height: clamp(105px, 19vh, 230px);
		background-image: var(--pixel-background);
		background-repeat: no-repeat;
		background-size: max(720px, 82vw) auto;
		image-rendering: pixelated;
		filter: brightness(0.88) saturate(1.08);
	}
	.corner-foliage::before {
		left: -10px;
		background-position: left bottom;
		transform: scaleY(-1);
	}
	.corner-foliage::after {
		right: -10px;
		background-position: right bottom;
		transform: scale(-1);
	}
	.scene.theme-sunset {
		background: #f49b4b;
	}
	.scene.theme-night {
		background: #123d74;
	}
	.scene.theme-rainbow {
		background: #bde8f4;
	}
	.theme-sunset .background-base {
		filter: sepia(0.18) saturate(1.12) brightness(0.88);
	}
	.theme-night .background-base {
		filter: brightness(0.48) saturate(0.85) hue-rotate(34deg);
	}
	.theme-rainbow .background-base {
		filter: saturate(1.3) brightness(1.08);
	}
	.brand {
		top: clamp(-38px, -2.8vw, -27px);
		width: min(34vw, 420px);
		height: auto;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
		transform: translateX(-50%);
		image-rendering: pixelated;
	}
	.brand img {
		display: block;
		width: 100%;
		height: auto;
		image-rendering: pixelated;
		filter: drop-shadow(4px 5px 0 rgb(38 17 3 / 48%));
	}
	.studio-mark {
		position: absolute;
		top: clamp(10px, 1.8vh, 20px);
		right: clamp(12px, 2vw, 28px);
		z-index: 13;
		width: clamp(72px, 8vw, 108px);
		height: auto;
		object-fit: contain;
		filter: drop-shadow(2px 2px 0 rgb(7 57 68 / 42%));
	}
	.game-stage {
		top: clamp(46px, 7vh, 72px);
		bottom: clamp(92px, 13vh, 138px);
	}
	.board-wrap {
		width: min(100cqw, 125cqh);
		height: min(80cqw, 100cqh);
		aspect-ratio: 1.25;
	}
	.hud {
		bottom: clamp(7px, 1.4vh, 16px) !important;
		font-family: 'Jersey 10', monospace;
		image-rendering: pixelated;
	}
	.hud button {
		position: relative;
		isolation: isolate;
	}
	.hud button svg {
		display: block;
		width: 62%;
		height: 62%;
		margin: auto;
		fill: currentcolor;
		filter: drop-shadow(2px 2px 0 rgb(35 13 2 / 50%));
	}
	.hud .utility,
	.bet-stepper button {
		border-radius: 0 !important;
		clip-path: polygon(0 0, 72% 0, 72% 10%, 100% 10%, 100% 90%, 72% 90%, 72% 100%, 0 100%);
	}
	.hud-left .utility {
		clip-path: polygon(0 0, 76% 0, 76% 9%, 100% 9%, 100% 91%, 76% 91%, 76% 100%, 0 100%);
	}
	.bonus-button {
		clip-path: polygon(0 0, 96% 0, 96% 8%, 100% 8%, 100% 92%, 96% 92%, 96% 100%, 0 100%);
	}
	.bet-stepper button:first-child {
		transform: scaleX(-1);
	}
	.spin {
		clip-path: none !important;
		border-radius: 50% !important;
	}
	.spin-arrow {
		width: 76% !important;
		height: 76% !important;
		fill: #fff !important;
		filter: drop-shadow(4px 4px 0 rgb(113 45 2 / 34%)) !important;
	}
	.hud-right .utility {
		display: grid;
		grid-template-rows: 1fr auto;
		place-items: center;
		padding: 5px 2px 4px;
	}
	/* Measured off the design's own HUD strip: inside a 50px button the auto arrows are 10px of ink
	   over a 21px AUTO caption — the same fifth-of-the-box the mobile rail draws. The viewBox is
	   tight to the glyph, so this percentage is the ink itself; `height: auto` keeps its 8:7. */
	.hud-right .utility svg {
		width: 20%;
		height: auto;
		filter: none;
	}
	.auto-glyph {
		shape-rendering: crispedges;
	}
	/* Scoped under the bar so `.hud button svg { display: block }` above cannot win the cascade
	   and stack both marks in one button ("this button is wrong", user 2026-09-17). */
	.hud button .auto-glyph-smooth {
		display: none;
	}
	.hud-right .utility small {
		min-height: 0.72em;
		font-size: clamp(8px, 0.95vw, 14px);
		line-height: 1;
	}

	@media (min-width: 681px) and (orientation: landscape) {
		.hud {
			width: min(91vw, 1450px);
			min-height: 72px;
			padding: 6px 10px;
			gap: clamp(8px, 1vw, 16px);
			border: 3px solid #8b510f;
			border-radius: 0;
			background: #351903;
			box-shadow:
				inset 0 0 0 2px #5f3408,
				0 6px 0 rgb(21 8 1 / 55%);
		}
		.hud-left,
		.hud-right {
			gap: 7px;
		}
		.hud-left .utility {
			width: 54px;
			height: 54px;
		}
		.bonus-button {
			width: clamp(112px, 11vw, 148px);
			min-width: 112px;
			height: 54px;
			min-height: 54px;
			border-radius: 0;
			background: #ed9300;
			box-shadow: inset 0 3px #ffb321;
		}
		.metrics {
			align-self: stretch;
			gap: 0;
		}
		.metric {
			align-content: center;
			padding: 0 clamp(8px, 1.4vw, 24px);
			border-left: 2px solid #6b3b0c;
			text-align: left;
		}
		.metric:last-child {
			border-right: 2px solid #6b3b0c;
		}
		.metric strong {
			font-size: clamp(13px, calc(170cqw / var(--chars, 8)), 23px) !important;
		}
		.bet-stepper {
			gap: 6px;
		}
		.bet-stepper button {
			width: 46px;
			height: 50px;
			font-size: 22px;
		}
		.spin {
			width: 88px;
			height: 88px;
			margin: -20px 2px -12px;
			border-width: 5px !important;
		}
		.hud-right .utility {
			width: 50px;
			height: 54px;
		}
	}

	@media (min-width: 681px) and (max-width: 1179px) and (orientation: landscape) {
		.hud-left .utility {
			width: 44px;
			height: 100%;
		}
		.bonus-button {
			width: 100%;
			min-width: 0;
			height: 100%;
			min-height: 0;
		}
		.bet-stepper button {
			width: 34px;
			height: 40px;
		}
		.spin {
			width: 76px;
			height: 76px;
			margin: -8px 0;
		}
		.hud-right .utility {
			width: 40px;
			height: 44px;
		}
	}

	@media (max-width: 680px), (orientation: portrait) {
		.pixel-background {
			background-size: auto 62%;
		}
		.corner-foliage::before,
		.corner-foliage::after {
			width: 42vw;
			height: 16vh;
			background-size: auto 210px;
		}
		.brand {
			top: clamp(8px, 1.5vh, 18px);
			width: min(94vw, 730px);
			height: auto;
		}
		.studio-mark {
			top: max(7px, env(safe-area-inset-top, 0px));
			right: 8px;
			width: clamp(54px, 16vw, 78px);
		}
		.game-stage {
			top: clamp(112px, 16vh, 170px);
			bottom: clamp(190px, 27vh, 252px);
		}
		.hud {
			bottom: max(6px, env(safe-area-inset-bottom, 0px)) !important;
		}
		.hud button svg {
			width: 58%;
			height: 58%;
		}
		.hud .utility,
		.bet-stepper button,
		.hud-left .utility,
		.bonus-button {
			clip-path: polygon(0 0, 78% 0, 78% 9%, 100% 9%, 100% 91%, 78% 91%, 78% 100%, 0 100%);
		}
		.spin {
			clip-path: none !important;
		}
	}

	@media (max-height: 520px) and (orientation: landscape) {
		.brand {
			top: -38px;
			width: min(42vw, 440px);
		}
		.game-stage {
			top: 34px;
			bottom: 76px;
		}
		.hud {
			bottom: 4px !important;
			height: 62px !important;
		}
	}

	@keyframes scatter-aura-in {
		0% {
			opacity: 0;
			transform: scale(0.35);
		}
		55% {
			opacity: 1;
			transform: scale(1.15);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	.cell.scatter-hit .backplate {
		animation: scatter-aura-in 360ms steps(5, end) both;
	}

	/* Final HUD furniture lock. The supplied 50×50 frame is the canonical shell for every small
	   control. Icons remain live SVG/text so disabled/pressed state and accessibility stay wired. */
	.hud .utility,
	.hud-left .utility,
	.hud-right .utility,
	.bet-stepper button {
		clip-path: none !important;
		border: 0 !important;
		border-radius: 0 !important;
		background-color: transparent !important;
		background-image: var(--hud-button) !important;
		background-position: center !important;
		background-repeat: no-repeat !important;
		background-size: 100% 100% !important;
		box-shadow: none !important;
		image-rendering: pixelated;
	}
	.bet-stepper button:first-child {
		transform: none !important;
	}
	.bonus-button {
		clip-path: none !important;
		border: 2px solid #a86105 !important;
		border-radius: 0 !important;
		background: #ed9300 !important;
		box-shadow:
			inset 0 3px 0 #ffb62b,
			inset 0 -3px 0 #c96d00 !important;
	}
	.bonus-button small {
		display: none !important;
	}

	/* Reference HUD at tablet widths is a compact 58px rail, not the oversized earlier pass. */
	@media (min-width: 681px) and (max-width: 1179px) and (orientation: landscape) {
		.hud {
			grid-template-columns: 120px minmax(0, 1fr) auto;
			height: 60px;
			padding: 4px 6px;
		}
		.hud-left {
			grid-template-columns: 44px 76px;
		}
		.hud-left .utility {
			width: 44px;
			height: 44px;
			align-self: center;
		}
		.bonus-button {
			width: 76px;
			height: 44px;
			align-self: center;
		}
		.hud-right {
			grid-template-columns: auto 72px 40px 40px;
			gap: 3px;
			padding-left: 5px;
		}
		.bet-stepper {
			gap: 2px;
		}
		.bet-stepper button {
			width: 34px;
			height: 42px;
		}
		.spin {
			width: 72px;
			height: 72px;
			margin: -10px 0;
		}
		.hud-right .utility {
			width: 40px;
			height: 42px;
		}
	}

	@media (max-width: 680px) and (orientation: landscape) {
		.hud {
			grid-template-columns: 118px minmax(0, 1fr);
		}
		.hud-left {
			grid-template-columns: 46px 72px;
		}
		.hud-left .utility {
			width: 46px;
			height: 46px;
			align-self: center;
		}
		.bonus-button {
			height: 46px;
			align-self: center;
		}
	}

	@media (orientation: portrait) {
		.hud-left .utility {
			width: clamp(42px, 12vw, 58px);
			height: clamp(42px, 12vw, 58px);
			align-self: center;
		}
		.bonus-button {
			height: clamp(42px, 12vw, 58px);
			align-self: center;
		}
	}

	/* Activation/purchase confirmation uses plain full rectangles. */
	.confirm-actions button {
		clip-path: none !important;
		border-radius: 0 !important;
	}
	.metric.bet.boosted span,
	.metric.bet.boosted strong {
		color: #ffe15b !important;
	}

	/* Mobile composition lock. Keep the five visual bands (logo, board, pays, controls, values)
	   in normal grid flow. This removes the height-dependent absolute-position drift that made
	   Mobile M/S bunch at the bottom while leaving a large hole above the board. */
	@media (orientation: portrait) {
		.scene {
			display: grid;
			grid-template-rows: auto auto auto;
			align-content: space-evenly;
			justify-items: center;
			padding: max(5px, env(safe-area-inset-top, 0px)) clamp(6px, 2vw, 10px)
				max(5px, env(safe-area-inset-bottom, 0px));
		}

		.brand {
			position: relative;
			inset: auto;
			grid-row: 1;
			width: min(96vw, 410px);
			height: auto;
			transform: none;
		}

		.studio-mark {
			top: max(7px, env(safe-area-inset-top, 0px));
			right: 7px;
			width: clamp(48px, 15vw, 70px);
		}

		.game-stage {
			position: relative;
			inset: auto;
			grid-row: 2;
			display: grid;
			grid-template-rows: auto auto;
			place-items: center;
			align-content: center;
			row-gap: clamp(7px, 1.5vh, 12px);
			width: 100%;
			height: auto;
			padding: 0;
			container-type: inline-size;
		}

		.board-wrap {
			grid-row: 1;
			width: 100%;
			height: auto;
			aspect-ratio: 1.25;
			container-type: size;
		}

		.cluster-panel {
			position: relative;
			inset: auto;
			grid-row: 2;
			display: block;
			width: 100%;
			padding: 4px;
			border-width: 3px;
			border-radius: 0;
			transform: none;
		}

		.panel-rows {
			grid-template-columns: repeat(var(--slots, 6), minmax(0, 1fr));
			grid-template-rows: clamp(32px, 6vh, 40px);
			gap: clamp(2px, 0.8vw, 4px);
		}

		.panel-row {
			grid-template-columns: auto 1fr;
			min-height: 0;
			height: 100%;
			padding: 1px clamp(2px, 0.8vw, 4px);
			border-radius: 0;
			font-size: clamp(7px, 2.2vw, 9px);
		}

		.panel-row span:nth-of-type(2),
		.panel-row strong {
			display: none;
		}

		.hud {
			--mobile-control-height: clamp(54px, 9.2vh, 72px);
			--mobile-metric-height: clamp(54px, 8.8vh, 66px);
			--mobile-row-gap: clamp(7px, 1.5vh, 12px);
			position: relative;
			inset: auto;
			grid-row: 3;
			grid-template-areas:
				'left right'
				'metrics metrics';
			grid-template-columns: minmax(112px, 40%) minmax(0, 60%);
			grid-template-rows: var(--mobile-control-height) var(--mobile-metric-height);
			row-gap: var(--mobile-row-gap);
			width: 100%;
			height: calc(
				var(--mobile-control-height) + var(--mobile-metric-height) + var(--mobile-row-gap)
			);
			min-height: 0;
			padding: 0;
			border: 0;
			background: none;
			box-shadow: none;
			transform: none;
		}

		.hud::before {
			inset: 0 0 auto;
			height: var(--mobile-control-height);
			border-width: 3px;
		}

		.hud-left {
			grid-area: left;
			grid-template-columns: clamp(40px, 12vw, 52px) minmax(66px, 1fr);
			align-items: center;
			gap: clamp(3px, 1vw, 6px);
			width: 100%;
			height: var(--mobile-control-height);
			padding: clamp(4px, 1vw, 6px) 0 clamp(4px, 1vw, 6px) clamp(4px, 1vw, 6px);
		}

		.hud-left .utility,
		.bonus-button {
			width: 100%;
			height: 100%;
			min-height: 0;
		}

		.hud-right {
			grid-area: right;
			display: grid;
			grid-template-columns:
				clamp(58px, 19vw, 82px)
				clamp(34px, 10.5vw, 46px)
				clamp(34px, 10.5vw, 46px);
			justify-content: space-evenly;
			align-items: center;
			gap: clamp(2px, 0.8vw, 5px);
			width: 100%;
			height: var(--mobile-control-height);
			padding: 0 clamp(3px, 1vw, 6px);
		}

		.spin {
			width: clamp(58px, 19vw, 82px);
			height: clamp(58px, 19vw, 82px);
			margin: 0;
		}

		.hud-right .utility,
		.auto {
			width: clamp(34px, 10.5vw, 46px);
			height: clamp(42px, 12vw, 54px);
		}

		.metrics {
			grid-area: metrics;
			grid-template-columns: 1fr 1.6fr 1fr;
			height: var(--mobile-metric-height);
			gap: clamp(4px, 1.5vw, 7px);
		}

		.metric {
			height: 100%;
			padding: clamp(5px, 1.6vw, 8px);
		}

		.metric.bet {
			padding-inline: 30%;
		}

		.bet-stepper {
			left: 28%;
			right: 28%;
			bottom: 0;
			height: var(--mobile-metric-height);
			padding: clamp(4px, 1.4vw, 7px);
		}

		.bet-stepper button {
			width: clamp(34px, 10.5vw, 46px);
			height: 100%;
		}

		.bonus-readouts {
			top: clamp(64px, 11vh, 96px);
		}
	}

	/* 400×225 popout: landscape phone rules cannot fit. Use an explicit compact side composition:
	   logo + payout history left, full board right, one complete control rail below. */
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.scene {
			display: block;
			padding: 0;
		}

		.brand {
			position: absolute;
			top: 4px;
			left: 5px;
			width: 130px;
			height: auto;
			transform: none;
		}

		.studio-mark {
			top: 4px;
			right: 5px;
			width: 45px;
		}

		.game-stage {
			inset: 3px 5px 45px 140px;
			display: grid;
			place-items: center;
			padding: 0;
			container-type: size;
		}

		.board-wrap {
			width: min(100cqw, 125cqh);
			height: min(80cqw, 100cqh);
			aspect-ratio: 1.25;
		}

		.cluster-panel {
			left: -135px;
			top: 52%;
			bottom: auto;
			display: block;
			width: 126px;
			padding: 3px;
			border-width: 3px;
			border-radius: 0;
			transform: translateY(-42%);
		}

		.panel-rows {
			grid-template-columns: 1fr;
			grid-template-rows: repeat(var(--slots, 6), 1fr);
			gap: 2px;
		}

		.panel-row {
			grid-template-columns: auto 16px auto 1fr;
			gap: 2px;
			min-height: 18px;
			padding: 0 3px;
			border-width: 1px;
			border-radius: 0;
			font-size: 6px;
		}

		.panel-row img {
			width: 14px;
			height: 14px;
		}

		.hud {
			position: absolute;
			left: 50%;
			bottom: 3px !important;
			grid-template-areas: 'left metrics right';
			grid-template-columns: 70px minmax(0, 1fr) 132px;
			gap: 2px;
			width: calc(100% - 8px);
			height: 40px !important;
			min-height: 40px;
			padding: 2px;
			border: 2px solid #774410;
			border-radius: 0;
			transform: translateX(-50%);
		}

		.hud::before {
			display: none;
		}

		.hud-left {
			grid-area: left;
			display: grid;
			grid-template-columns: 27px 43px;
			gap: 0;
			width: 70px;
			height: 34px;
			padding: 0;
		}

		.hud-left .utility,
		.bonus-button {
			width: 100%;
			height: 34px;
			min-width: 0;
			min-height: 0;
		}

		.bonus-button span {
			font-size: 6px;
		}

		.metrics {
			grid-area: metrics;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0;
			height: 34px;
		}

		.metric,
		.metric.bet {
			grid-column: auto;
			grid-row: auto;
			height: 34px;
			padding: 1px 3px;
			border-width: 0 0 0 1px;
			background: transparent;
			text-align: left;
		}

		.metric span {
			font-size: 5px;
		}

		.metric strong {
			font-size: clamp(6px, calc(122cqw / var(--chars, 8)), 9px) !important;
		}

		.hud-right {
			grid-area: right;
			display: grid;
			grid-template-columns: 45px 39px 22px 22px;
			gap: 1px;
			width: 132px;
			height: 34px;
			padding: 0;
		}

		.bet-stepper {
			position: static;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1px;
			width: 45px;
			height: 34px;
			padding: 0;
			border: 0;
			background: transparent;
		}

		.bet-stepper button {
			width: 22px;
			height: 34px;
			padding: 0;
			font-size: 11px;
		}

		.spin {
			width: 39px;
			height: 39px;
			margin: -3px 0;
			border-width: 3px !important;
		}

		.hud-right .utility,
		.auto {
			width: 22px;
			height: 34px;
			padding: 0;
		}

		.hud button svg {
			width: 55%;
			height: 55%;
		}

		.bonus-readouts {
			top: 4px;
			right: 54px;
			width: 70px;
		}
	}

	/* Bonus garden variants. Same source art and geometry; restrained grading + one soft light
	   layer makes each tier readable without looking like a different game. */
	.scene {
		transition: background-color 850ms ease-in-out;
	}
	.pixel-background {
		transition:
			opacity 850ms ease-in-out,
			filter 850ms ease-in-out,
			background-position 650ms ease;
	}
	.corner-foliage::before,
	.corner-foliage::after {
		transition: filter 850ms ease-in-out;
	}

	.scene.bonus-normal {
		background: #22afe9;
	}

	.scene.bonus-super {
		background: #188fc5;
	}

	.scene.bonus-hidden {
		background: #35b6dd;
	}

	.pixel-background::after {
		content: '';
		position: absolute;
		inset: 0;
		background: transparent;
		mix-blend-mode: soft-light;
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 650ms ease,
			background 650ms ease;
	}

	.background-normal {
		background-color: #7568c2;
		background-image: var(--bonus-normal-sky);
		background-position: center top;
		background-size: 100% 128%;
		background-repeat: no-repeat;
		filter: none;
		overflow: hidden;
	}
	.scene.bonus-normal .background-normal {
		opacity: 1;
	}

	.background-normal::after {
		opacity: 0;
	}

	.normal-bonus-layer,
	.normal-bonus-cloud-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.normal-bonus-layer {
		image-rendering: pixelated;
	}

	.normal-bonus-mountains {
		z-index: 1;
		background: var(--bonus-normal-mountains) center top 62% / 100% auto no-repeat;
	}

	.normal-bonus-cloud-field {
		z-index: 2;
		overflow: hidden;
	}

	.normal-bonus-cloud {
		--cloud-width: clamp(170px, 19vw, 380px);
		position: absolute;
		z-index: 1;
		left: calc(0px - var(--cloud-width));
		top: var(--cloud-top);
		width: var(--cloud-width);
		aspect-ratio: 3 / 1;
		background: var(--bonus-normal-cloud) center / contain no-repeat;
		image-rendering: pixelated;
		will-change: transform;
	}

	.normal-bonus-path-guide {
		display: none;
		position: absolute;
		left: 0;
		right: 0;
		z-index: 0;
		border-top: 2px dashed #f22626;
		filter: drop-shadow(0 1px 0 rgb(74 0 0 / 70%));
		opacity: 0.9;
	}

	.normal-bonus-path-one {
		top: calc(8% + clamp(28px, 3.167vw, 63px));
	}

	.normal-bonus-path-two {
		top: calc(21% + clamp(21px, 2.333vw, 47px));
	}

	.normal-bonus-path-three {
		top: calc(35% + clamp(18px, 1.833vw, 37px));
	}

	.normal-bonus-cloud-one {
		--cloud-top: 8%;
		--cloud-duration: 168s;
	}

	.normal-bonus-cloud-two {
		--cloud-width: clamp(125px, 14vw, 280px);
		--cloud-top: 21%;
		--cloud-duration: 214s;
	}

	.normal-bonus-cloud-three {
		--cloud-width: clamp(105px, 11vw, 220px);
		--cloud-top: 35%;
		--cloud-duration: 246s;
	}

	.normal-bonus-fence {
		z-index: 3;
		background-image: var(--base-bench);
		background-size: clamp(120px, 12vw, 260px) auto;
		background-repeat: no-repeat;
	}

	.normal-bonus-fence-left {
		background-position: left 3vw bottom 27%;
	}

	.normal-bonus-fence-right {
		background-position: right 3vw bottom 27%;
	}

	.normal-bonus-tree {
		z-index: 4;
		background: var(--bonus-normal-tree) left -2vw top / auto 68% no-repeat;
	}

	.normal-bonus-oak {
		z-index: 4;
		background: var(--bonus-normal-oak) left bottom -26vh / auto 68% no-repeat;
	}

	/* SUPER is the night garden: the same horizon as BASE and NORMAL, lit by a moon instead of
	   the sun. Built from separate layers for the same reason NORMAL is — a single flat image
	   cannot hold a drifting cloud or keep its horizon on the board's edge across aspect ratios. */
	.background-super {
		background-color: #0b2265;
		background-image: var(--bonus-super-sky);
		background-position: center top;
		background-size: 100% 128%;
		background-repeat: no-repeat;
		filter: none;
		overflow: hidden;
	}
	.scene.bonus-super .background-super {
		opacity: 1;
	}

	/* ::after is the ground band under the responsive contract below, not a tint. The moon carries
	   its own glow so the scene does not need a wash over the whole chamber. */
	.background-super::after {
		opacity: 0;
	}

	.super-bonus-layer,
	.super-bonus-cloud-field,
	.super-bonus-star-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.super-bonus-layer {
		image-rendering: pixelated;
	}

	.super-bonus-mountains {
		z-index: 1;
		background: var(--bonus-super-mountains) center top 62% / 100% auto no-repeat;
	}

	.super-bonus-moon {
		z-index: 1;
		background: var(--bonus-super-moon) left 12% top 9% / clamp(52px, 5.5vw, 118px) auto no-repeat;
		filter: drop-shadow(0 0 clamp(10px, 1.6vw, 26px) rgb(255 244 186 / 45%));
	}

	.super-bonus-star-field {
		z-index: 1;
		overflow: hidden;
	}

	/* Stars are 44×44 single-colour source squares, so they are sized in whole pixels and never
	   interpolated - a half-pixel star reads as a smudge at this art scale. */
	.super-bonus-star {
		position: absolute;
		width: 4px;
		height: 4px;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		image-rendering: pixelated;
		opacity: 0.85;
		animation: super-star-twinkle 5.5s ease-in-out infinite;
	}

	.super-bonus-star.star-bright {
		background-image: var(--bonus-super-star-bright);
	}

	.super-bonus-star.star-dim {
		background-image: var(--bonus-super-star-dim);
		opacity: 0.7;
	}

	.super-bonus-star-one {
		left: 6%;
		top: 6%;
	}
	.super-bonus-star-two {
		left: 19%;
		top: 21%;
		animation-delay: 1.4s;
	}
	.super-bonus-star-three {
		left: 27%;
		top: 4%;
		animation-delay: 2.9s;
	}
	.super-bonus-star-four {
		left: 38%;
		top: 14%;
		animation-delay: 0.7s;
	}
	.super-bonus-star-five {
		left: 52%;
		top: 7%;
		animation-delay: 3.6s;
	}
	.super-bonus-star-six {
		left: 63%;
		top: 18%;
		animation-delay: 2.1s;
	}
	.super-bonus-star-seven {
		left: 74%;
		top: 5%;
		animation-delay: 4.3s;
	}
	.super-bonus-star-eight {
		left: 83%;
		top: 23%;
		animation-delay: 1.1s;
	}
	.super-bonus-star-nine {
		left: 92%;
		top: 11%;
		animation-delay: 3.2s;
	}

	@keyframes super-star-twinkle {
		0%,
		100% {
			opacity: 0.32;
		}
		50% {
			opacity: 0.95;
		}
	}

	.super-bonus-cloud-field {
		z-index: 2;
		overflow: hidden;
	}

	.super-bonus-cloud {
		--cloud-width: clamp(150px, 17vw, 340px);
		position: absolute;
		z-index: 1;
		left: calc(0px - var(--cloud-width));
		top: var(--cloud-top);
		width: var(--cloud-width);
		aspect-ratio: 3 / 1;
		background: var(--bonus-super-cloud) center / contain no-repeat;
		image-rendering: pixelated;
		opacity: 0.85;
		will-change: transform;
	}

	.super-bonus-cloud-one {
		--cloud-top: 9%;
		--cloud-duration: 182s;
	}

	.super-bonus-cloud-two {
		--cloud-width: clamp(115px, 13vw, 260px);
		--cloud-top: 22%;
		--cloud-duration: 228s;
	}

	.super-bonus-cloud-three {
		--cloud-width: clamp(98px, 10vw, 205px);
		--cloud-top: 33%;
		--cloud-duration: 260s;
	}

	.super-bonus-fence {
		z-index: 3;
		background: var(--bonus-super-fence) left 4vw bottom 27% / clamp(120px, 12vw, 260px) auto
			no-repeat;
	}

	/* Design 9198:81939: the foliage is 290 tall on the 670 frame, bottom-left, shown whole — the
	   wide, low corner is what the wolf pup's tail tucks behind. */
	.super-bonus-oak {
		z-index: 4;
		background: var(--bonus-super-oak) left bottom / auto 43.3% no-repeat;
	}

	.background-hidden {
		background-image: var(--bonus-hidden-background);
		background-position: center;
		background-size: cover;
		filter: none;
	}
	.scene.bonus-hidden .background-hidden {
		opacity: 1;
	}

	.background-hidden::after {
		background:
			radial-gradient(circle at 18% 28%, rgb(202 124 255 / 26%), transparent 31%),
			radial-gradient(circle at 82% 24%, rgb(99 255 197 / 24%), transparent 32%),
			linear-gradient(rgb(121 73 168 / 10%), transparent 62%);
		opacity: 0.84;
	}

	/* Canonical pressed frame. JS keeps it visible long enough to read on touch screens. */
	.hud-left .utility.pressed-flash,
	.bet-stepper button.pressed-flash,
	.hud-right .turbo.pressed-flash,
	.hud-right .auto.pressed-flash,
	.hud-left .utility:active,
	.bet-stepper button:active,
	.hud-right .turbo:active,
	.hud-right .auto:active {
		background-image: var(--hud-button-pressed) !important;
	}

	/* Compact pixel menu from the supplied reference: one icon cell + one label per row. */
	.quick-menu {
		left: max(5px, 2vw);
		bottom: clamp(74px, 12vh, 126px);
		display: grid;
		gap: 0;
		width: clamp(104px, 9vw, 128px);
		padding: 3px;
		border: 2px solid #9b5905;
		border-radius: 0;
		background: #351a07;
		box-shadow: 4px 4px 0 #160a02aa;
		image-rendering: pixelated;
	}

	.quick-menu button {
		display: grid;
		grid-template-columns: 31px minmax(0, 1fr);
		align-items: center;
		gap: 7px;
		height: 38px;
		padding: 2px 5px 2px 2px;
		border: 0;
		border-bottom: 1px solid #754003;
		border-radius: 0;
		background: #3d2009;
		color: #f3a51d;
		font-family: 'Jersey 10', monospace;
		font-size: 10px;
		font-weight: 900;
		line-height: 1;
		text-align: left;
	}

	.quick-menu button:last-child {
		border-bottom: 0;
	}

	.quick-menu button:hover,
	.quick-menu button:focus-visible {
		background: #542b09;
		outline: 1px solid #ef9b12;
		outline-offset: -2px;
	}

	.quick-menu button.off {
		color: #956416;
	}

	.quick-menu-icon {
		display: grid;
		place-items: center;
		width: 27px;
		height: 27px;
		border: 1px solid #a45b05;
		background: #4a270a;
		color: currentColor;
	}

	/* Glyph widths are the design's own boxes on its 48px square: sound 22.5 / 32 (the slash
	   needs the room), music 24.6 / 21.6. Height follows each SVG's aspect. Smooth vectors, so
	   the skin's blanket `pixelated` is lifted like the turbo bolt's. */
	.quick-menu-icon img {
		display: block;
		height: auto;
		image-rendering: auto;
	}
	.qm-sound-on {
		width: 47%;
	}
	.qm-sound-off {
		width: 67%;
	}
	.qm-music-on {
		width: 51%;
	}
	.qm-music-off {
		width: 45%;
	}

	.quick-menu-icon.info-icon {
		font-family: 'Jersey 10', serif;
		font-size: 18px;
		font-weight: 900;
	}

	/* Portrait owns the viewport height. Extra room stays inside the game stage, never below HUD. */
	@media (orientation: portrait) {
		.scene {
			grid-template-rows: auto minmax(0, 1fr) auto;
			align-content: stretch;
			row-gap: clamp(5px, 1vh, 9px);
			padding-bottom: 0;
			background: linear-gradient(#16a9ed 0 58%, #559f2a 58% 100%);
		}

		.game-stage {
			height: 100%;
			min-height: 0;
			align-content: space-evenly;
		}

		.hud {
			align-self: end;
			margin-bottom: 0;
		}

		.quick-menu {
			left: max(7px, env(safe-area-inset-left, 0px));
			bottom: calc(
				var(--mobile-control-height, 62px) + var(--mobile-metric-height, 60px) +
					var(--mobile-row-gap, 8px) + 12px
			);
		}
	}

	/* Popout S / short landscape: board centre, metrics left, controls in a vertical right dock.
	   The payout strip remains visible below the board. Nothing depends on desktop HUD width. */
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.scene {
			position: fixed;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
			padding: 0;
			background: linear-gradient(#16a9ed 0 54%, #559f2a 54% 100%);
		}

		.pixel-background {
			background-position: center bottom;
			background-size: cover;
		}

		.brand {
			position: absolute;
			top: 4px;
			left: 4px;
			width: 54px;
			height: auto;
			transform: none;
		}

		.studio-mark {
			display: none;
		}

		.game-stage {
			position: absolute;
			inset: 3px 53px 27px 62px;
			display: grid;
			place-items: center;
			width: auto;
			height: auto;
			padding: 0;
			container-type: size;
		}

		.board-wrap {
			width: min(100cqw, 125cqh);
			height: min(80cqw, 100cqh);
			aspect-ratio: 1.25;
		}

		.cluster-panel {
			position: absolute;
			inset: auto auto -25px 50%;
			display: block;
			width: min(100cqw, 244px);
			height: 24px;
			padding: 2px;
			border-width: 2px;
			border-radius: 0;
			transform: translateX(-50%);
		}

		.panel-rows {
			grid-template-columns: repeat(var(--slots, 6), minmax(0, 1fr));
			grid-template-rows: 16px;
			gap: 1px;
		}

		.panel-row {
			grid-template-columns: auto 1fr;
			gap: 1px;
			min-height: 0;
			height: 16px;
			padding: 0 1px;
			border-width: 1px;
			border-radius: 0;
			font-size: 5px;
		}

		.panel-row img {
			width: 11px;
			height: 11px;
		}

		.panel-row span:nth-of-type(2),
		.panel-row strong {
			display: none;
		}

		.hud {
			position: absolute;
			inset: 0;
			display: block;
			width: 100%;
			height: 100% !important;
			min-height: 0;
			padding: 0;
			border: 0;
			background: none;
			box-shadow: none;
			transform: none;
			pointer-events: none;
		}

		.hud::before {
			content: '';
			position: absolute;
			top: 1px;
			right: 1px;
			bottom: 1px;
			left: auto;
			display: block;
			width: 50px;
			height: auto;
			border: 2px solid #9d620d;
			border-radius: 0;
			background: #3a1d08;
			box-shadow:
				inset 0 0 0 1px #5d3509,
				-3px 3px 0 #1a0c03aa;
			pointer-events: none;
		}

		.hud-left,
		.hud-right,
		.metrics {
			z-index: 1;
			pointer-events: auto;
		}

		.hud-left {
			position: absolute;
			top: 3px;
			right: 3px;
			display: grid;
			grid-template-columns: 1fr;
			grid-template-rows: 27px 27px;
			gap: 2px;
			width: 46px;
			height: 56px;
			padding: 0;
		}

		.hud-left .utility,
		.bonus-button {
			width: 46px;
			height: 27px;
			min-width: 0;
			min-height: 0;
		}

		.bonus-button span {
			font-size: 6px;
		}

		.hud-right {
			position: absolute;
			top: 62px;
			right: 3px;
			display: grid;
			grid-template-columns: 46px;
			grid-template-rows: 21px 44px 28px 28px;
			justify-items: center;
			gap: 3px;
			width: 46px;
			height: 130px;
			padding: 0;
		}

		.bet-stepper {
			position: static;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 2px;
			width: 46px;
			height: 21px;
			padding: 0;
			border: 0;
			background: none;
		}

		.bet-stepper button {
			width: 22px;
			height: 21px;
			padding: 0;
			font-size: 10px;
		}

		.spin {
			width: 44px;
			height: 44px;
			margin: 0;
			border-width: 3px !important;
		}

		.hud-right .utility,
		.auto {
			width: 28px;
			height: 28px;
			padding: 0;
		}

		.hud button svg {
			width: 54%;
			height: 54%;
		}

		.metrics {
			position: absolute;
			top: 28px;
			left: 3px;
			display: grid;
			grid-template-columns: 56px;
			grid-template-rows: repeat(3, 29px);
			gap: 2px;
			width: 56px;
			height: 91px;
		}

		.metric,
		.metric.bet {
			grid-column: auto;
			grid-row: auto;
			height: 29px;
			padding: 2px 3px;
			border: 1px solid #83500e;
			background: #251506dd;
			text-align: left;
		}

		.metric span {
			font-size: 5px;
		}

		.metric strong {
			font-size: clamp(6px, calc(47px / var(--chars, 8)), 9px) !important;
		}

		.bonus-readouts {
			top: 123px;
			left: 3px;
			right: auto;
			width: 56px;
		}

		.quick-menu {
			top: 3px;
			right: 52px;
			bottom: auto;
			left: auto;
			width: 98px;
		}

		.quick-menu button {
			grid-template-columns: 25px minmax(0, 1fr);
			gap: 4px;
			height: 32px;
			font-size: 8px;
		}

		.quick-menu-icon {
			width: 23px;
			height: 23px;
		}

		/* Every HTML dialog must fit the 400×225 shell without browser zoom. */
		.modal-layer {
			place-items: center;
			padding: 4px;
			overflow: hidden;
		}
		.buy-layer {
			padding: 4px;
		}
		.buy-panel {
			width: min(100%, calc((100svh - 8px) * 1200 / 670));
		}

		.confirm-panel {
			width: min(388px, calc(100vw - 8px));
			max-height: calc(100dvh - 8px);
			padding: 6px 10px;
			border-width: 4px;
			box-shadow:
				inset 0 0 0 2px #d49b35,
				inset 0 0 0 4px #351b08,
				3px 3px 0 #1c0d05;
			overflow: auto;
		}

		/* The autoplay dialog is one proportional drawing, so the shell only has to hand it a
		   smaller unit — 540 is its own height in design units once the stop note is counted. */
		.auto-panel {
			--u: calc(min(388px, 100vw - 8px, (100dvh - 8px) * 604 / 540) / 604);
			max-height: calc(100dvh - 8px);
			overflow: auto;
		}

		.close {
			top: 3px;
			right: 3px;
			width: 22px;
			height: 22px;
			border-width: 2px;
			font-size: 14px;
			line-height: 1;
		}

		.confirm-panel > small {
			font-size: 6px;
			letter-spacing: 0.1em;
		}

		.confirm-panel h2 {
			margin: 0 24px 4px;
			font-size: 15px;
			line-height: 1;
			text-shadow: 1px 1px #4c2500;
		}

		.confirm-panel p,
		.confirm-note {
			max-width: 100%;
			margin: 1px 0 4px;
			font-size: 7px;
			line-height: 1.15;
		}

		.confirm-panel > strong {
			margin-bottom: 4px;
			font-size: 16px;
			line-height: 1;
		}

		.confirm-actions {
			gap: 4px;
		}

		.confirm-actions button {
			min-height: 28px;
			padding: 3px;
			border-width: 2px;
			font-size: 8px;
		}

		:global(.pop-up-wrap .top-layer) {
			padding: 3px;
		}

		:global(.pop-up-wrap .ui-popup-standard-content-wrap) {
			width: calc(100vw - 8px);
			max-height: calc(100dvh - 8px);
			gap: 4px;
			font-size: 8px;
		}

		:global(.pop-up-wrap .ui-modal-title-wrap) {
			font-size: 12px;
			line-height: 1;
		}

		:global(.pop-up-wrap .close-button-wrap) {
			top: 1px;
			right: 1px;
		}

		:global(.pop-up-wrap .close-button) {
			width: 26px;
			height: 26px;
			font-size: 24px;
		}
	}

	/* Final spatial pass: side furniture is sized from the gutter left by the centred board. */
	@media (min-width: 1180px) and (orientation: landscape) {
		.cluster-panel {
			left: 2cqw;
			right: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
			width: auto;
			max-width: none;
		}

		.bonus-readouts {
			top: 50%;
			right: 2cqw;
			left: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
			width: auto;
			max-width: none;
			transform: translateY(-50%);
		}

		.hud {
			grid-template-columns: auto clamp(400px, 32vw, 540px) auto;
			justify-content: space-between;
		}

		.hud-left {
			grid-template-columns: clamp(58px, 4.4vw, 76px) clamp(140px, 12vw, 200px);
			width: auto;
		}

		.metrics {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.metric {
			padding-inline: clamp(8px, 0.8vw, 14px);
		}
	}

	@media (min-width: 681px) and (orientation: landscape) {
		.cluster-panel {
			left: 2cqw;
			right: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
			width: auto;
			max-width: none;
			padding: clamp(7px, 1.2cqh, 12px);
		}

		.scene .cluster-panel {
			right: 1cqw;
			left: calc(50% + min(50cqw, 62.5cqh) + 0.75cqw);
			height: clamp(274px, 39cqh, 430px);
			padding: clamp(17px, 2.1cqh, 24px) clamp(15px, 1.2cqw, 22px);
		}

		.scene .cluster-panel .panel-rows {
			height: 100%;
		}

		.scene .cluster-panel .panel-row {
			container-type: size;
			min-height: 0;
			padding-inline: clamp(7px, 0.65cqw, 11px);
			font-size: clamp(15px, 2.8cqh, 30px);
		}
		/* Sized off the ROW, not the stage. `2.8cqh` above resolves against the game stage, so on
		   a 720-tall window it gave 17px inside a 45px row — "too small, very hard to read" (user,
		   2026-09-16) — and the ceiling never moved with the row. Each row is its own size
		   container now, so the type is a fixed share of the row it sits in: Jersey 10 carries a
		   lot of leading, and 58% of the row puts its caps at roughly 40% of it, which is the
		   design's proportion. The `cqw` term is the amount column's guard against a long total
		   on the narrowest gutter. */
		.scene .cluster-panel .panel-row > span,
		.scene .cluster-panel .panel-row > strong {
			font-size: min(58cqh, 13cqw);
			line-height: 1;
		}
		/* The amount column is about 53% of the row and Jersey 10 runs 0.51em a glyph, so a total
		   of N glyphs fits at 92cqw / N; only long totals on a narrow gutter ever hit this term. */
		.scene .cluster-panel .panel-row > strong {
			min-width: 0;
			overflow: hidden;
			font-size: min(58cqh, 13cqw, calc(92cqw / var(--chars, 6)));
			white-space: nowrap;
		}
		.scene .cluster-panel .panel-row > img {
			width: 100%;
			height: 82cqh;
		}

		/* Desktop landscape never got the row the portrait and handheld passes were redesigned to:
		   it still drew the original dark gradient pill with unboxed values, so the cluster size,
		   the multiplier and the symbol all sank into the board behind them. Same treatment as
		   those passes — flat lighter field, boxed value cells, amber total — sized off the row's
		   own type rather than off the viewport, since the panel lives in a fixed gutter. */
		.scene .cluster-panel .panel-row {
			grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1.7fr);
			gap: clamp(2px, 0.35cqw, 6px);
			padding: clamp(1px, 0.3cqh, 4px) clamp(4px, 0.55cqw, 9px);
			border: 1px solid #708741;
			background: #617637;
			box-shadow: none;
			font-weight: 400;
			text-shadow: none;
		}
		.scene .cluster-panel .panel-row.vacant {
			border-color: #53672a;
			background: #354818;
		}
		.scene .cluster-panel .panel-row img {
			width: 100%;
			height: 1.75em;
		}
		.scene .cluster-panel .panel-row span {
			padding: 0.04em 0.3em;
			border: 1px solid #9cad73;
			text-align: center;
		}
		.scene .cluster-panel .panel-row strong {
			color: #ffc022;
			text-shadow: none;
		}

		.panel-rows {
			gap: clamp(4px, 0.8cqh, 8px);
		}

		.panel-row {
			min-height: clamp(30px, 5.1cqh, 44px);
			padding-inline: clamp(5px, 0.8cqw, 10px);
			font-size: clamp(12px, 2.2cqh, 18px);
		}

		.panel-row img {
			width: 2em;
			height: 2em;
		}

		/* HUD-right owns this divider. Removing the metric edge avoids a doubled rule. */
		.metric:last-child {
			border-right: 0;
		}

		.bonus-readouts {
			top: 50%;
			right: 2cqw;
			left: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
			width: auto;
			max-width: none;
			transform: translateY(-50%);
		}

		.bonus-readout,
		.bonus-status {
			min-height: clamp(72px, 12cqh, 108px);
			padding: clamp(10px, 1.8cqh, 18px) clamp(7px, 0.8cqw, 12px);
		}

		.bonus-readout span,
		.bonus-readout small,
		.bonus-status span,
		.bonus-status small {
			font-size: clamp(9px, 1.5cqh, 14px);
		}

		.bonus-readout strong,
		.bonus-status strong {
			font-size: clamp(18px, 3.4cqh, 34px);
		}

		.hud {
			--hud-control-gap: clamp(7px, 0.75vw, 12px);
			width: calc(100vw - 16px);
			max-width: none;
			padding-inline: var(--hud-control-gap);
			column-gap: var(--hud-control-gap);
		}

		.hud-left,
		.hud-right,
		.bet-stepper {
			gap: var(--hud-control-gap);
		}

		.hud-right {
			padding-left: 0;
		}
	}

	/* Landscape phones still have real side gutters; centre both side boards inside them. */
	@media (max-width: 680px) and (min-height: 301px) and (orientation: landscape) {
		.cluster-panel {
			left: 2cqw;
			right: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
			width: auto;
			max-width: none;
		}

		.scene:not(.bonus-normal):not(.bonus-super):not(.bonus-hidden) .cluster-panel {
			right: 1cqw;
			left: calc(50% + min(50cqw, 62.5cqh) + 0.75cqw);
		}

		.bonus-readouts {
			top: 50%;
			right: 2cqw;
			left: calc(50% + min(50cqw, 62.5cqh) + 2cqw);
			width: auto;
			transform: translateY(-50%);
		}
	}

	/* Portrait: reserve a real row for bonus counters. They never cover or escape the board. */
	@media (orientation: portrait) {
		.game-stage:has(.bonus-readouts) {
			grid-template-rows: auto auto auto;
		}

		.game-stage:has(.bonus-readouts) .board-wrap {
			grid-row: 2;
		}

		.game-stage:has(.bonus-readouts) .cluster-panel {
			grid-row: 3;
		}

		.bonus-readouts {
			position: relative;
			inset: auto;
			grid-row: 1;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: clamp(4px, 1.5vw, 8px);
			width: min(100%, 330px);
			transform: none;
		}

		.bonus-readout,
		.bonus-status {
			min-height: 42px;
			padding: 4px 5px;
			border-width: 3px;
			box-shadow:
				inset 0 0 0 2px #d99a32,
				2px 2px 0 #211107;
		}
	}

	/* Popout S: bonus counters use the left dock below metrics; board remains unobstructed. */
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.game-stage {
			inset: 3px 62px 27px 64px;
		}

		.brand {
			left: 2px;
			width: 60px;
		}

		.hud::before {
			width: 58px;
		}

		.hud-left {
			right: 3px;
			width: 54px;
		}

		.hud-left .utility,
		.bonus-button {
			width: 54px;
		}

		.hud-right {
			right: 3px;
			grid-template-columns: 54px;
			grid-template-rows: 21px 52px 27px 27px;
			width: 54px;
			height: 136px;
		}

		.bet-stepper {
			width: 54px;
		}

		.bet-stepper button {
			width: 26px;
		}

		.spin {
			width: 52px;
			height: 52px;
		}

		.bonus-readouts {
			top: 121px;
			right: auto;
			left: -62px;
			gap: 2px;
			width: 60px;
			transform: none;
		}

		.metrics {
			left: 2px;
			width: 60px;
		}

		.metric,
		.metric.bet {
			place-content: center;
			width: 60px;
			padding-inline: 2px;
			text-align: center;
		}

		.bonus-readout,
		.bonus-status {
			min-height: 39px;
			padding: 2px 1px;
			border-width: 2px;
			box-shadow: inset 0 0 0 1px #d99a32;
		}

		.bonus-readout span,
		.bonus-readout small,
		.bonus-status span,
		.bonus-status small {
			font-size: 5px;
			letter-spacing: 0;
		}

		.bonus-readout strong,
		.bonus-status strong {
			font-size: 8px;
		}
	}

	/* Reuse the main board frame as one intact overlay. The green fill is inset separately so it
	   cannot show through the transparent padding around the asset. */
	.cluster-panel {
		isolation: isolate;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}

	.cluster-panel::before {
		content: '';
		position: absolute;
		inset: -5px;
		z-index: 2;
		background: var(--board-frame) center / 100% 100% no-repeat;
		image-rendering: pixelated;
		pointer-events: none;
	}

	.cluster-panel::after {
		content: '';
		position: absolute;
		inset: 3.5% 4% 4.5%;
		z-index: 0;
		background: #24380f;
		pointer-events: none;
	}

	.cluster-panel .panel-rows {
		position: relative;
		z-index: 1;
	}

	/* Desktop HUD balance: compact value cells; give the menu/bonus and play controls the room.
	   Tracks consume the full rail, so no distributed blank space masquerades as part of BET. */
	@media (min-width: 1180px) and (orientation: landscape) {
		.hud {
			grid-template-columns: minmax(260px, 28%) minmax(390px, 27%) minmax(450px, 45%);
			justify-content: stretch;
			column-gap: 0;
		}

		.hud-left {
			grid-template-columns: minmax(58px, 0.42fr) minmax(170px, 1.58fr);
			gap: var(--hud-control-gap);
			width: 100%;
			padding-right: var(--hud-control-gap);
		}

		.metrics {
			width: 100%;
		}

		.metric {
			padding-inline: clamp(8px, 0.65vw, 12px);
		}

		.hud-right {
			grid-template-columns: minmax(150px, 1.6fr) minmax(96px, 1.25fr) minmax(54px, 0.72fr) minmax(
					54px,
					0.72fr
				);
			justify-items: center;
			width: 100%;
			padding-left: var(--hud-control-gap);
		}

		.bet-stepper {
			display: grid;
			grid-template-columns: repeat(2, minmax(46px, 76px));
			justify-content: space-evenly;
			width: 100%;
		}

		.bet-stepper button {
			width: 100%;
		}
	}

	/* Layered BASE garden supplied as separate pixel assets. Bonus backgrounds remain above this
	   stack and cross-fade normally, so returning from a feature reveals this exact same scene. */
	.background-base-plain {
		z-index: 0;
		background: var(--base-plain) center / cover no-repeat;
	}

	/* Coming home from a bonus is a dawn, not a cut ("not with snap but with some animation in
	   backgrounds", user 2026-09-17). A transition takes the timing of the state it is heading
	   INTO, so these rules — the visible, base-game state — own the return: the bonus sky
	   lingers while the base garden builds back up in layers, sky first, then hills, the fence,
	   and finally the clouds. Entering a bonus keeps the quick single fade, set on the bonus
	   rules below, so the feature still arrives with a snap of intent. */
	.background-base,
	.base-cloud-field {
		transition: opacity 1500ms ease-in-out;
	}
	.background-base.base-mountains {
		transition-delay: 300ms;
	}
	.background-base.base-bench {
		transition-delay: 600ms;
	}
	.base-cloud-field {
		transition-delay: 900ms;
	}
	.background-bonus {
		transition-duration: 1700ms;
	}

	.scene.bonus-normal .background-base,
	.scene.bonus-normal .base-cloud-field,
	.scene.bonus-super .background-base,
	.scene.bonus-super .base-cloud-field,
	.scene.bonus-hidden .background-base,
	.scene.bonus-hidden .base-cloud-field {
		opacity: 0;
		transition: opacity 850ms ease-in-out;
	}
	.scene.bonus-normal .background-normal,
	.scene.bonus-super .background-super,
	.scene.bonus-hidden .background-hidden {
		transition-duration: 850ms;
	}

	.base-cloud-field {
		position: absolute;
		inset: 0;
		z-index: 1;
		overflow: hidden;
		pointer-events: none;
	}

	.drifting-cloud {
		--cloud-width: clamp(210px, 24vw, 470px);
		position: absolute;
		left: calc(0px - var(--cloud-width));
		top: var(--cloud-top);
		width: var(--cloud-width);
		aspect-ratio: 3 / 1;
		background: var(--base-cloud) center / contain no-repeat;
		image-rendering: pixelated;
		backface-visibility: hidden;
		will-change: transform;
		animation: base-cloud-drift var(--cloud-duration) linear infinite;
		animation-delay: var(--cloud-delay);
	}

	.cloud-one {
		--cloud-top: 7%;
		--cloud-duration: 112s;
		--cloud-delay: -17s;
		--cloud-rest-x: 35vw;
	}

	.cloud-eleven {
		--cloud-width: clamp(120px, 16vw, 310px);
		--cloud-top: -2%;
		--cloud-duration: 205s;
		--cloud-delay: -132s;
		--cloud-rest-x: 18vw;
		opacity: 0.72;
	}

	.cloud-two {
		--cloud-width: clamp(150px, 18vw, 350px);
		--cloud-top: 23%;
		--cloud-duration: 146s;
		--cloud-delay: -76s;
		--cloud-rest-x: 88vw;
		opacity: 0.82;
	}

	.cloud-three {
		--cloud-width: clamp(115px, 13vw, 260px);
		--cloud-top: 37%;
		--cloud-duration: 178s;
		--cloud-delay: -119s;
		--cloud-rest-x: 128vw;
		opacity: 0.68;
	}

	.cloud-four {
		--cloud-width: clamp(100px, 11vw, 220px);
		--cloud-top: 51%;
		--cloud-duration: 136s;
		--cloud-delay: -101s;
		--cloud-rest-x: 62vw;
		opacity: 0.58;
	}

	.base-mountains {
		z-index: 2;
		background: var(--base-mountains) center top 56% / 100% auto no-repeat;
	}

	.base-cloud-field--front {
		z-index: 3;
	}

	.cloud-path-guide {
		display: none;
		position: absolute;
		left: 0;
		right: 0;
		z-index: -1;
		border-top: 2px dashed #f22626;
		filter: drop-shadow(0 1px 0 rgb(74 0 0 / 70%));
		opacity: 0.9;
	}

	.path-one {
		top: calc(7% + clamp(35px, 4vw, 78px));
	}
	.path-eleven {
		top: calc(-2% + clamp(20px, 2.67vw, 52px));
	}
	.path-two {
		top: calc(23% + clamp(25px, 3vw, 58px));
	}
	.path-three {
		top: calc(37% + clamp(19px, 2.17vw, 43px));
	}
	.path-four {
		top: calc(51% + clamp(17px, 1.83vw, 37px));
	}
	.path-five {
		top: calc(15% + clamp(21px, 2.5vw, 48px));
	}
	.path-six {
		top: calc(30% + clamp(16px, 1.67vw, 33px));
	}
	.path-eight {
		top: calc(44% + clamp(18px, 2.17vw, 42px));
	}

	.cloud-five {
		--cloud-width: clamp(125px, 15vw, 290px);
		--cloud-top: 15%;
		--cloud-duration: 158s;
		--cloud-delay: -41s;
		--cloud-rest-x: 48vw;
		opacity: 0.64;
	}

	.cloud-six {
		--cloud-width: clamp(95px, 10vw, 200px);
		--cloud-top: 30%;
		--cloud-duration: 196s;
		--cloud-delay: -153s;
		--cloud-rest-x: 112vw;
		opacity: 0.5;
	}

	.cloud-eight {
		--cloud-width: clamp(105px, 13vw, 250px);
		--cloud-top: 44%;
		--cloud-duration: 184s;
		--cloud-delay: -92s;
		--cloud-rest-x: 28vw;
		opacity: 0.56;
	}

	.base-bench {
		z-index: 4;
		top: auto;
		right: auto;
		left: clamp(22px, 3vw, 72px);
		bottom: calc(clamp(66px, 12vh, 88px) + 45px);
		width: clamp(120px, 16vw, 280px);
		height: auto;
		aspect-ratio: 844 / 440;
		transform: none;
		background: var(--base-bench) center bottom / contain no-repeat;
	}

	.background-bonus {
		z-index: 10;
	}

	/* Keep the live grid full-size. The frame asset has a transparent centre and renders above
	   the board, matching the design without covering symbols or exposing a black fill. */
	.board-frame {
		isolation: isolate;
		padding: 0;
		border: 0 !important;
		background: none;
		box-shadow: none;
		overflow: visible;
		image-rendering: pixelated;
	}

	.board-frame::after,
	.frame-highlight {
		display: none;
	}

	.board-frame::before {
		display: block;
		top: -5.2%;
		right: -4%;
		bottom: -5.2%;
		left: -4%;
		z-index: 2;
		border: 0;
		background: var(--board-frame) center / 100% 100% no-repeat;
	}

	.board {
		position: absolute;
		/* Frame opening: x 174..2630 / 2804, y 148..2133 / 2280.
		   Map through the frame outsets, then bleed 0.15% under the wood on every edge. */
		top: 1.82%;
		right: 2.55%;
		bottom: 1.77%;
		left: 2.55%;
		z-index: 1;
		width: auto;
		height: auto;
		margin: 0;
		/* Only internal gaps are grid lines. No fixed-pixel perimeter to leak at small sizes. */
		padding: 0;
		border: 0;
	}

	@media (min-width: 681px) and (orientation: landscape) {
		.board-wrap {
			width: min(95cqw, 118.75cqh);
			height: min(76cqw, 95cqh);
		}
	}

	.board-shadow {
		inset: 4% 3%;
		background: rgb(24 11 2 / 52%);
		filter: blur(8px);
		transform: translate(8px, 10px);
	}

	@keyframes base-cloud-drift {
		from {
			transform: translate3d(0, 0, 0);
		}
		to {
			transform: translate3d(calc(100vw + var(--cloud-width) + var(--cloud-width)), 0, 0);
		}
	}

	@media (max-width: 680px), (orientation: portrait) {
		.base-mountains {
			background-position: center top 56%;
			background-size: auto 40%;
		}

		.normal-bonus-mountains {
			background-position: center top 62%;
			background-size: auto 28%;
		}

		.normal-bonus-fence {
			background-size: clamp(100px, 34vw, 170px) auto;
		}

		.normal-bonus-fence-left {
			background-position: left 3vw bottom 27%;
		}

		.normal-bonus-fence-right {
			background-position: right 3vw bottom 27%;
		}

		.normal-bonus-tree {
			background-position: left -3vw top;
			background-size: 60vw auto;
		}

		.normal-bonus-oak {
			background-position: left bottom -22vh;
			background-size: 88vw auto;
		}

		.base-bench {
			bottom: clamp(155px, 27.5vh, 245px);
			right: auto;
			left: -2vw;
			width: clamp(105px, 42vw, 180px);
		}
	}

	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.base-mountains {
			background-position: center top 56%;
			background-size: 125% auto;
		}

		.normal-bonus-mountains {
			background-position: center top 59%;
			background-size: 115% auto;
		}

		.normal-bonus-fence {
			background-size: 16vw auto;
		}

		.normal-bonus-fence-left {
			background-position: left 3vw bottom 27%;
		}

		.normal-bonus-fence-right {
			background-position: right 3vw bottom 27%;
		}

		.normal-bonus-tree {
			background-position: left -2vw top;
			background-size: auto 68%;
		}

		.normal-bonus-oak {
			background-position: left bottom -26vh;
			background-size: auto 68%;
		}

		.base-bench {
			right: auto;
			left: 58px;
			bottom: 42px;
			width: 24vw;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.drifting-cloud {
			animation: none;
			transform: translate3d(var(--cloud-rest-x), 0, 0);
		}
		/* Stars hold their lit state rather than pulsing. randomCloudDrift already opts the
		   drifting clouds out by itself. */
		.super-bonus-star {
			animation: none;
			opacity: 0.85;
		}
	}

	/* Responsive scene contract. Raster art always uses uniform scaling, never X/Y stretching. */
	.background-normal,
	.background-super,
	.background-base-plain {
		background-image: none;
	}
	.background-normal::before,
	.background-super::before,
	.background-base-plain::before {
		content: '';
		position: absolute;
		inset: 0;
		background-position: center top;
		background-size: cover;
		background-repeat: no-repeat;
		transform: scale(1.28);
		transform-origin: center top;
		pointer-events: none;
	}
	.background-normal::before {
		background-image: var(--bonus-normal-sky);
	}
	.background-super::before {
		background-image: var(--bonus-super-sky);
	}
	.background-base-plain::before {
		background-image: var(--base-plain);
	}
	.background-normal::after,
	.background-base-plain::after {
		background: #659337;
		top: 73%;
		opacity: 1;
		mix-blend-mode: normal;
	}
	/* Night ground, sampled from the source art either side of its horizon so the band and the
	   scaled sky meet in one colour instead of a seam. */
	.background-super::after {
		background: linear-gradient(#29703b, #165d39);
		top: 73%;
		opacity: 1;
		mix-blend-mode: normal;
	}
	.normal-bonus-layer,
	.normal-bonus-cloud-field {
		z-index: 1;
	}
	.normal-bonus-cloud-field {
		z-index: 2;
	}
	.normal-bonus-fence {
		z-index: 3;
	}
	.normal-bonus-tree,
	.normal-bonus-oak {
		z-index: 4;
	}
	.super-bonus-layer,
	.super-bonus-star-field,
	.super-bonus-cloud-field {
		z-index: 1;
	}
	.super-bonus-cloud-field {
		z-index: 2;
	}
	.super-bonus-fence {
		z-index: 3;
	}
	.super-bonus-oak {
		z-index: 4;
	}
	.background-base-plain {
		background-size: cover;
	}
	.base-mountains,
	.normal-bonus-mountains,
	.super-bonus-mountains {
		/* Shared horizon. Wide art crops on phones rather than squashing its peaks. */
		top: auto;
		bottom: 27%;
		left: 50%;
		right: auto;
		width: max(100%, 120vh);
		height: auto;
		transform: translateX(-50%);
		background-position: center;
		background-size: contain;
	}
	.base-mountains {
		aspect-ratio: 5028 / 998;
	}
	.normal-bonus-mountains {
		aspect-ratio: 5028 / 1136;
		/* The source includes 48px of transparent padding below its ground edge. */
		margin-bottom: calc(-1 * max(100vw, 120vh) * 48 / 5028);
	}
	.super-bonus-mountains {
		aspect-ratio: 4816 / 1060;
		/* Source art is opaque rows 81-1027, so 32px of padding sit below its ground edge. The
		   compensation is measured against the same width expression the layer is sized by. */
		margin-bottom: calc(-1 * max(100%, 120vh) * 32 / 4816);
	}
	.background-hidden {
		background-size: cover;
	}

	/* ── The SUNSET garden (design 9198:104316) ──────────────────────────────────────────────
	   Everything above under `normal-bonus-*` is the design's dusk frame — the NORMAL bonus's
	   own garden, shown under the `garden-dusk` modifier with the butterfly. A NORMAL bonus
	   reached through the Mystery pick plays here instead: a red-to-gold gradient sky over the same
	   #7f8905 ground the design paints from its 52% line, the base hills recoloured for dusk,
	   the lit cloud, the base fence and two flowers at the left, and the owl on the panel.
	   The gradient replaces the raster sky, so the cover-scaling ::before goes back to 1. */
	.scene:not(.garden-dusk) .background-normal::before {
		background-image: linear-gradient(
			180deg,
			#cd3e4b 1%,
			#dc403f 14%,
			#f16026 40%,
			#f77619 66%,
			#f69c0f 92.5%
		);
		background-size: 100% 52.2%;
		transform: none;
	}
	.scene:not(.garden-dusk) .background-normal::after {
		top: 52.2%;
		background: #7f8905;
	}
	.scene:not(.garden-dusk)
		:is(.normal-bonus-mountains, .normal-bonus-tree, .normal-bonus-oak, .normal-bonus-fence-right),
	.scene.garden-dusk :is(.normal-bonus-treeline, .normal-bonus-flowers) {
		display: none;
	}
	/* Same responsive contract as the hills it replaces: uniform scale, cropped on phones. The
	   design draws it from 32% down with its dark base band over the ground. */
	.normal-bonus-treeline {
		top: auto;
		bottom: 25%;
		left: 50%;
		right: auto;
		width: max(100%, 120vh);
		height: auto;
		aspect-ratio: 2400 / 494;
		transform: translateX(-50%);
		background: var(--sunset-treeline) center / contain no-repeat;
	}
	.scene:not(.garden-dusk) .normal-bonus-cloud {
		background-image: var(--sunset-cloud);
	}
	.scene:not(.garden-dusk) .normal-bonus-fence-left {
		background-position: left -1.4vw bottom 23.5%;
		background-size: 17.6vw auto;
	}
	/* The two daisies hang off the fence (design 9198:104316, measured on the 1200x670 render):
	   the fence art is 112x94 inside its 211x110 image box, and the daisies sit under its right
	   post — centres 2px right of the post and 19px below the art's foot (35px wide), then 36px
	   right and 49px below (26px wide). They were placed by their own % of the viewport before,
	   so on any aspect other than the design's they drifted off the fence (up and away from it on
	   a tall window). Now every term is the fence's: the same vw scale, and the same
	   `bottom 23.5%` — each daisy's own `bottom` % resolves against (height − its own size), so
	   the vw offset folds in the 0.235 × (fence height − daisy size) difference:
	   23.5% − 0.235·(9.17 − 2.9)vw − 1.08vw − 1.45vw = 23.5% − 4vw, and −6.3vw for the second. */
	.normal-bonus-flowers {
		z-index: 3;
		background:
			var(--sunset-flower) left 13.25vw bottom calc(23.5% - 4vw) / 2.9vw 2.9vw no-repeat,
			var(--sunset-flower) left 16.4vw bottom calc(23.5% - 6.3vw) / 2.2vw 2.2vw no-repeat;
	}

	/* The owl (9355:54123) perches on the cluster panel's top-right corner: in the design its
	   feet overlap the frame by 19px and its right side overhangs the panel; the overhang is
	   trimmed here because the game's panel already sits at the viewport edge. It
	   breathes, cocks its head now and then, and the eyes (their own layer, sockets filled with
	   the face's cream) blink and glance on a timer chain in the script. */
	.sunset-owl {
		display: none;
		position: absolute;
		right: -4%;
		bottom: calc(100% - clamp(10px, 1.5vw, 24px));
		z-index: 1;
		width: 52%;
		pointer-events: none;
	}
	/* Wide landscape only: everywhere else the panel has the readouts or the board right above it. */
	@media (min-width: 1180px) and (min-height: 601px) and (orientation: landscape) {
		.sunset-owl {
			display: block;
		}
	}
	.owl-stage {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 380 / 425;
		transform-origin: 50% 100%;
		animation: owl-alive 11s ease-in-out infinite;
	}
	.owl-layer {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}
	/* One slow breath every ~3.7s (three per loop), with a head cock held in the middle of it. */
	@keyframes owl-alive {
		0%,
		27%,
		55%,
		82%,
		100% {
			transform: scale(1, 1) rotate(0deg);
		}
		13%,
		41%,
		68%,
		91% {
			transform: scale(0.99, 1.02) rotate(0deg);
		}
		58%,
		74% {
			transform: scale(1, 1) rotate(-4deg);
		}
	}
	/* One art pixel is ~3.2% of the canvas. */
	.owl-eyes {
		transform-origin: 58.9% 38.2%;
		transform: translateX(calc(var(--gaze, 0) * 3.2%));
		transition: transform 80ms steps(2, jump-end);
	}
	.owl-eyes.blink {
		transform: translateX(calc(var(--gaze, 0) * 3.2%)) scaleY(0.1);
	}

	@media (min-width: 681px) and (orientation: landscape) {
		/* Compact landscape HUD must retain both bet controls, including 800×450. */
		.bet-stepper {
			display: flex;
		}
		.brand {
			top: 3px;
			width: min(34vw, 420px);
			height: auto;
			aspect-ratio: 857 / 140;
		}
		.brand img {
			transform: translateY(-25.658%);
		}
	}
	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.game-stage {
			inset: 8px 62px 32px 64px;
		}
	}

	/* Portrait design: compact identity, 2×3 payout cells beside bonus counters,
	   full-width board, control rail, then balance / bet / win. One width-based
	   composition prevents spare viewport height from becoming gaps between bands. */
	/* ── Portrait ──────────────────────────────────────────────────────────────────────────────
	   Design 9256:207184, a 360x800 phone whose game area is the 360x577 between the operator's
	   header and footer. Every size below is that frame's, as a share of its width (--pw):
	   Press Play mark 57 wide at y3; wordmark 178 wide, art y25..52; cluster panel x4..213 by
	   y56..149 (2x3 rows); board x-8..369 by y141..447 — it runs 8px past both edges and its top
	   rail covers the panel's bottom border; bar x16..342 by y455..505 with the 83px spin disc
	   centred on it (y439..522); BALANCE / BET / WIN 90 / 124 / 90 wide by 41 at y523; 13px of
	   ground under them. Height is the one thing that varies between phones: the frame is 1.603
	   widths tall, a taller screen keeps the frame's width and spreads the spare height around
	   the board, a shorter one shrinks the width so the whole frame still fits. */
	@media (orientation: portrait) {
		.scene {
			--portrait-width: min(100vw, calc((100svh - 6px) / 1.603));
			--pw: var(--portrait-width);
			display: grid;
			grid-template-columns: var(--pw);
			grid-template-rows: calc(var(--pw) * 0.156) minmax(0, 1fr) auto;
			gap: 0;
			align-content: stretch;
			justify-content: center;
			justify-items: stretch;
			padding: max(0px, env(safe-area-inset-top, 0px)) 0 calc(var(--pw) * 0.036);
			overflow: hidden;
		}
		/* The wordmark file is 857x304 with the art on rows 79..216; the box is the art's own
		   height and the image slides up inside it, so the box top IS the art top. */
		.scene .brand {
			position: relative;
			inset: auto;
			display: block;
			grid-row: 1;
			align-self: start;
			justify-self: center;
			width: 49.4%;
			height: auto;
			min-height: 0;
			aspect-ratio: 857 / 140;
			margin: calc(var(--pw) * 0.069) 0 0;
			overflow: hidden;
			transform: none;
		}
		.scene .brand img {
			transform: translateY(-25.658%);
		}
		/* 548x228 canvas, art 449 wide from x49 / y41: 57px of art is a 69.6px canvas. */
		.scene .studio-mark {
			position: absolute;
			inset: auto;
			grid-column: 1;
			grid-row: 1;
			align-self: start;
			justify-self: center;
			width: calc(var(--pw) * 0.193);
			height: auto;
			margin-top: calc(var(--pw) * -0.006);
			transform: none;
			object-fit: contain;
		}
		.scene .game-stage,
		.scene .game-stage:has(.bonus-readouts) {
			position: relative;
			inset: auto;
			display: grid;
			grid-row: 2;
			grid-template-columns: 58% minmax(0, 1fr);
			grid-template-rows: calc(var(--pw) * 0.258) auto;
			gap: 0;
			align-content: start;
			width: 100%;
			height: auto;
			min-height: 0;
			padding: 0;
			container-type: inline-size;
		}
		/* Cluster panel, design 9256:209233 on the 360 frame: a 209x93 box, #42561f behind an 8px
		   #844a0d frame that carries a 2px black line on both its edges, holding a 2x3 grid of
		   90.5x21 cells (2px gaps) inset 3/4px from the inner line. */
		.scene .game-stage .cluster-panel,
		.scene .game-stage:has(.bonus-readouts) .cluster-panel {
			position: relative;
			inset: auto;
			display: block;
			grid-column: 1;
			grid-row: 1;
			width: 100%;
			height: 100%;
			/* Indented past the board frame's left edge (1.5% in) — "add more spacing on the left",
			   user 2026-09-17. */
			margin-left: calc(var(--pw) * 0.03);
			padding: calc(var(--pw) * 0.0167) calc(var(--pw) * 0.014);
			border: calc(var(--pw) * 0.022) solid #844a0d;
			background: #42561f;
			box-shadow:
				inset 0 0 0 2px #000,
				0 0 0 2px #000;
			transform: none;
		}
		.cluster-panel::before,
		.cluster-panel::after {
			display: none;
		}
		.scene .cluster-panel .panel-rows {
			height: 100%;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-template-rows: repeat(3, minmax(0, 1fr));
			gap: calc(var(--pw) * 0.0056);
		}
		/* The log keeps five slots but the design draws six cells: the sixth is a permanently
		   vacant one so the grid closes without a slot stretching across the bottom line. */
		.scene .cluster-panel .panel-rows::after {
			content: '';
			display: block;
		}
		.scene .cluster-panel .panel-row {
			/* 16.95 count box, 16.49 symbol box, 16.95 multiplier box, then the amount over what
			   is left of the 90.5 cell — all flush, the design has no gap between them. */
			display: grid;
			grid-template-columns:
				calc(var(--pw) * 0.047) calc(var(--pw) * 0.0458) calc(var(--pw) * 0.047)
				minmax(0, 1fr);
			gap: 0;
			align-items: center;
			padding: 0 0 0 calc(var(--pw) * 0.0083);
			min-width: 0;
			min-height: 0;
			height: auto;
			border: 0;
			border-radius: 1px;
			background: #667f3c;
			box-shadow: none;
			color: #fff;
			font-size: calc(var(--pw) * 0.022);
			font-weight: 600;
			text-shadow: none;
		}
		.scene .cluster-panel .panel-row.vacant,
		.scene .cluster-panel .panel-rows::after {
			border: 1px solid #667f3c;
			border-radius: 1px;
			background: #374b15;
		}
		.scene .cluster-panel .panel-row img {
			width: calc(var(--pw) * 0.038);
			height: calc(var(--pw) * 0.038);
			justify-self: center;
			object-fit: contain;
			filter: none;
		}
		/* The two boxes: 16.95 squares outlined in 30% white, Nunito Sans SemiBold in the design;
		   Poppins is the copy face this game ships. */
		.scene .cluster-panel .panel-row > span {
			display: grid;
			place-items: center;
			width: calc(var(--pw) * 0.047);
			height: calc(var(--pw) * 0.047);
			min-width: 0;
			padding: 0;
			border: 1px solid rgb(255 255 255 / 30%);
			background: #667f3c;
			font-family: 'Poppins', system-ui, sans-serif;
			font-size: inherit;
			letter-spacing: 0.05em;
			line-height: 1;
			text-shadow: none;
			text-transform: uppercase;
		}
		/* $0.50: Jersey 10, 12px on the 360 frame, #fee302, centred in the cell's tail. */
		.scene .cluster-panel .panel-row > strong {
			display: block;
			min-width: 0;
			padding: 0 calc(var(--pw) * 0.006);
			color: #fee302;
			font-family: 'Jersey 10', system-ui, sans-serif;
			font-size: calc(var(--pw) * 0.0333);
			font-weight: 400;
			letter-spacing: 0.08em;
			line-height: 1;
			text-align: center;
			text-shadow: none;
		}
		/* The design's board group is 377 wide on the 360 frame and 306.5 tall, frame included,
		   with the top rail over the panel's bottom 8px. The frame art hangs 4% / 5.2% outside
		   this box on each side, so the box itself is 349 x 277.6. The design lands the rail on
		   the panel; this starts the box 12px under it so the rail clears the panel by a few px
		   ("small [space] from the board", user 2026-09-17). */
		.scene .game-stage .board-wrap,
		.scene .game-stage:has(.bonus-readouts) .board-wrap {
			position: relative;
			inset: auto;
			grid-row: 2;
			grid-column: 1 / -1;
			justify-self: center;
			width: calc(var(--pw) * 0.97);
			max-width: none;
			height: auto;
			aspect-ratio: 349 / 277.6;
			margin-top: calc(var(--pw) * 0.033);
			transform: none;
		}
		.scene .bonus-readouts {
			position: relative;
			inset: auto;
			display: grid;
			grid-column: 2;
			grid-row: 1;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: repeat(2, minmax(0, 1fr));
			gap: 0;
			width: 100%;
			height: 100%;
			transform: none;
		}
		.scene .bonus-readout,
		.scene .bonus-status {
			position: static;
			min-height: 0;
			padding: 2px;
			align-content: center;
			border: 2px solid #805014;
			border-radius: 0;
			background: #321c03;
			box-shadow: none;
			text-shadow: none;
		}
		.scene .bonus-readout small {
			display: none;
		}
		.scene .bonus-readout span {
			color: #fff8df;
			font-size: clamp(10px, 3.8vw, 18px);
			line-height: 1;
			letter-spacing: 0;
			font-weight: 400;
		}
		.scene .bonus-readout strong {
			color: #eea000;
			font-size: clamp(18px, 5.5vw, 28px);
			line-height: 1;
			font-weight: 400;
		}
		/* The HUD box runs from the spin disc's top to the readouts' bottom (y439..564). The
		   bar is drawn by ::before 16px down it; the disc is centred on the bar by its own
		   absolute placement, so the two side groups only ever share the bar's ends. */
		.scene .hud {
			position: relative;
			inset: auto !important;
			display: flex;
			grid-row: 3;
			justify-content: space-between;
			align-items: start;
			align-self: end;
			gap: 0;
			width: 90.6%;
			height: calc(var(--pw) * 0.347) !important;
			min-height: 0;
			margin: 0 auto;
			padding: calc(var(--pw) * 0.044) calc(var(--pw) * 0.032) 0 calc(var(--pw) * 0.019);
			border: 0;
			background: none;
			box-shadow: none;
			transform: none;
		}
		.scene .hud::before {
			inset: calc(var(--pw) * 0.044) 0 auto;
			height: calc(var(--pw) * 0.139);
			border: 2px solid #805014;
			background: #321c03;
			box-shadow: none;
		}
		.scene .hud-left,
		.scene .hud-right {
			/* Static on purpose: the spin disc and the bet stepper inside .hud-right are placed
			   against the HUD box, not against their own group. */
			position: static;
			display: flex;
			align-items: center;
			gap: calc(var(--pw) * 0.028);
			width: auto;
			height: calc(var(--pw) * 0.139);
			padding: 0;
		}
		.scene .hud .utility,
		.scene .hud .bonus-button {
			position: relative;
			inset: auto;
			flex: none;
			width: calc(var(--pw) * 0.097);
			height: calc(var(--pw) * 0.097);
			min-width: 0;
			min-height: 0;
			padding: 0;
			margin: 0;
			clip-path: none !important;
		}
		.scene .hud .bonus-button {
			width: calc(var(--pw) * 0.175);
			height: calc(var(--pw) * 0.092);
			border: 2px solid #ce8700 !important;
			background: #e89600 !important;
			box-shadow: none !important;
		}
		.scene .hud .bonus-button span {
			font-size: calc(var(--pw) * 0.036);
		}
		.scene .hud .spin {
			position: absolute;
			inset: 0 auto auto 50%;
			width: calc(var(--pw) * 0.23);
			height: calc(var(--pw) * 0.23);
			margin: 0;
			translate: -50% 0;
		}
		.scene .hud .turbo {
			width: calc(var(--pw) * 0.097);
			justify-self: auto;
		}
		.scene .hud .metrics {
			position: absolute;
			inset: auto 0 0;
			display: grid;
			grid-template-areas: 'balance bet win';
			grid-template-columns: 27.6% 38% 27.6%;
			grid-template-rows: minmax(0, 1fr);
			justify-content: space-between;
			gap: 0;
			width: 100%;
			height: calc(var(--pw) * 0.114);
		}
		.scene .hud .metric {
			position: static;
			inset: auto;
			display: grid;
			width: 100%;
			height: 100%;
			min-width: 0;
			padding: 2% 7%;
			gap: 0;
			align-content: center;
			border: 0;
			background: #321c03;
			box-shadow: none;
			text-align: left;
		}
		.scene .hud .metric.balance {
			grid-area: balance;
		}
		.scene .hud .metric.win {
			grid-area: win;
		}
		.scene .hud .metric.bet {
			grid-area: bet;
			padding-inline: 24%;
			text-align: center;
		}
		.scene .hud .metric span {
			color: #fff8df;
			font-size: calc(var(--pw) * 0.022);
			letter-spacing: 0;
			font-weight: 400;
			text-shadow: none;
		}
		.scene .hud .metric strong {
			color: #fff8df;
			font-size: min(calc(var(--pw) * 0.046), calc(170cqw / var(--chars, 8))) !important;
			font-weight: 400;
			text-shadow: none;
		}
		.scene .hud .metric.bet span {
			display: none;
		}
		/* − / + are 25px squares 8px inside the 124px BET box. */
		.scene .hud .bet-stepper {
			position: absolute;
			inset: auto 33.5% 0;
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: auto;
			height: calc(var(--pw) * 0.114);
			padding: 0;
			border: 0;
			background: none;
		}
		.scene .hud .bet-stepper button {
			width: calc(var(--pw) * 0.07);
			height: calc(var(--pw) * 0.07);
			padding: 0;
			font-size: calc(var(--pw) * 0.04);
			clip-path: none !important;
		}
		/* Every icon in the design is white — the amber is reserved for the labels, the BONUS fill
		   and the spin disc. */
		.scene .hud .utility,
		.scene .hud .bet-stepper button {
			border: 2px solid #8c601a !important;
			background: #321c03 !important;
			box-shadow: none !important;
		}
		.scene .hud .utility:active,
		.scene .hud .utility.pressed-flash,
		.scene .hud .bet-stepper button:active {
			background: #65400c !important;
		}
		/* AUTO, per 9256:207577: the desktop bar's smooth twin-arrow (8.05 x 7.5 in the 34.88 box,
		   23%) over a 5.73px Inter Bold caption on an 8.6 line, stacked as one centred pair with
		   1.4px between — not the rails' pixel trace and Jersey caption. */
		.scene .hud-right .auto {
			display: grid;
			grid-template-rows: auto auto;
			gap: calc(var(--pw) * 0.004);
			align-content: center;
			justify-items: center;
		}
		.scene .hud-right .auto .auto-glyph {
			display: none;
		}
		.scene .hud-right .auto .auto-glyph-smooth {
			display: block;
			width: calc(var(--pw) * 0.0223);
			height: auto;
			margin: 0;
			fill: #fff;
			filter: none;
		}
		.scene .hud-right .auto small {
			min-height: 0;
			color: #fff;
			/* Inter Bold in the design; Poppins is the copy face this game ships. */
			font-family: 'Poppins', system-ui, sans-serif !important;
			font-size: calc(var(--pw) * 0.0159);
			font-weight: 700;
			letter-spacing: -0.02em;
			line-height: 1.5;
			text-transform: uppercase;
		}
		/* Opens above the menu toggle it belongs to, at the bar's left end ("this should be on
		   the left above menu", user 2026-09-17). */
		.scene .quick-menu {
			inset: auto auto calc(var(--portrait-width) * 0.36) calc(4.7% + var(--pw) * 0.019);
			max-height: 60svh;
			overflow-y: auto;
		}
		.scene .modal-layer {
			padding: 8px;
		}
		.scene .confirm-panel {
			min-width: 0;
			width: min(100%, 620px);
			max-width: 100%;
			max-height: calc(100svh - 16px);
			overflow-y: auto;
		}

		.scene .auto-panel {
			--u: calc(min(604px, 100vw - 16px, (100svh - 16px) * 604 / 540) / 604);
			max-height: calc(100svh - 16px);
			overflow-y: auto;
		}
	}

	/* ── Bottom bar ────────────────────────────────────────────────────────────────────────────
	   Design 9198:78408. Everything below was measured off the rendered 1200x670 frame rather than
	   read from the node tree: the bar is x52..1147 by y584..660, a #351E01 field inside a 2px
	   #925A06 border, inset 4.33% either side. Every small control is a plain 49x49 box of those
	   same two colours — the passes above dress them in a chamfered PNG shell (`--hud-button`) and
	   clip-path stairs that the design does not have, which is why this block is last and why it
	   has to shout. Anchors, left to right: menu 65, BONUS 129 (118 wide), BALANCE 262, WIN 486,
	   coin 669 / BET 713, − 777, + 840, spin centred 955 (104 across), turbo 1023, auto 1086. */
	/* The height gate is what keeps this off a landscape phone. The frame it is measured from is
	   1200x670; on an 800x360 shell these rules drew 730x311 of bar over a 360-tall screen, and
	   because they shout they beat the rail pass wherever it sits in the file. Short landscape
	   belongs to that pass, and its `max-height: 600px` is the other half of this gate. */
	@media (min-width: 681px) and (orientation: landscape) and (min-height: 601px) {
		.scene .hud {
			box-sizing: border-box;
			display: grid;
			grid-template-columns: auto minmax(0, 1fr) auto;
			/* The spin disc is taller than the bar, so without a capped row it would grow the grid
			   row to its own 104px and push every control off centre. */
			grid-template-rows: minmax(0, 1fr);
			column-gap: clamp(8px, 1.4%, 18px);
			align-items: center;
			width: min(91.3vw, 1370px);
			min-height: 0;
			height: clamp(56px, 11.6vh, 77px);
			/* The design parks the bar 10px off the frame bottom, which leaves its spin disc hanging
			   4px past the frame edge — on a real viewport that reads as a sliced button. The bar
			   rides a few px higher so the disc always clears. */
			bottom: clamp(12px, 2.2vh, 18px) !important;
			padding: 0 1%;
			border: 2px solid #925a06;
			border-radius: 0;
			background: #351e01;
			box-shadow: none;
		}
		/* The spin disc is 104 against a 77-tall bar, so it has to be free to hang out of both edges
		   exactly as it does in the design. */
		.scene .hud,
		.scene .hud-right {
			overflow: visible;
		}
		.scene .hud-left {
			display: grid;
			grid-template-columns: auto auto;
			gap: clamp(8px, 1.3vw, 16px);
			align-items: center;
			width: auto;
			height: 100%;
			min-height: 0;
			padding: 0;
			border: 0 !important;
		}
		.scene .hud .utility,
		.scene .hud .bet-stepper button {
			/* Sized off the BAR, not the viewport: the design's 49px control in a 77px bar is 64% of
			   its height — 67% of the 73px inside its 2px border. A vw-based size overflowed the bar
			   on a wide-but-short window and pushed the boxes through its bottom border. */
			width: auto !important;
			height: 67% !important;
			min-height: 0 !important;
			aspect-ratio: 1 !important;
			padding: 0 !important;
			overflow: hidden;
			border: 1px solid #925a06 !important;
			border-radius: 0 !important;
			background: #351e01 !important;
			background-image: none !important;
			box-shadow: none !important;
			color: #fff !important;
			clip-path: none !important;
			transform: none !important;
		}
		/* Open menu toggle, 9227:175692: the same box goes amber behind its cross. Has to sit here,
		   after the shell rule above, because both are !important at equal specificity. */
		.scene .hud .utility.menu-toggle.open {
			background: #e38b01 !important;
			border: 0 !important;
			/* The amber plate is the design's Vector 2 (9281:249873): a 48.4x48.5 square with an
			   11x7 bite out of the top-right corner and a 10.4x4.9 one out of the bottom-left. */
			clip-path: polygon(
				0 0,
				77.5% 0,
				77.5% 14.4%,
				100% 14.4%,
				100% 100%,
				21.6% 100%,
				21.6% 89.9%,
				0 89.9%
			) !important;
		}
		.scene .hud button svg {
			width: 54%;
			height: 54%;
			filter: none;
		}
		/* AUTO, per 9198:123416: a 48x49 box holding the smooth twin-arrow mark (10.5 x 9.8, so
		   22% of the box) over an 8px bold sans caption on a 12px line, the pair centred as one
		   stack with 2px between. The pixel trace and Jersey caption the rails use read as a
		   different control here ("not by design", user 2026-09-16). The button is its own size
		   container so the ink and caption are shares of the box, whatever the bar's height. */
		.scene .hud-right .utility {
			container-type: size;
			grid-template-rows: auto auto;
			align-content: center;
			justify-items: center;
			/* A percentage, not `cqh`: container units on the container itself resolve against its
			   ancestor (here the viewport), which put 29px between the arrows and the caption. */
			gap: 4%;
			padding: 0 !important;
		}
		.scene .hud-right .utility .auto-glyph {
			display: none;
		}
		.scene .hud-right .utility .auto-glyph-smooth {
			display: block;
			width: 22cqw;
			height: auto;
			margin: 0;
			fill: #fff;
			filter: none;
		}
		.scene .hud-right .utility small {
			color: #fff;
			/* Inter Bold in the design; Poppins is the copy face this game ships. */
			font-family: 'Poppins', system-ui, sans-serif !important;
			font-size: 16.5cqh;
			font-weight: 700;
			letter-spacing: -0.02em;
			line-height: 1;
			text-transform: uppercase;
		}
		/* The running autoplay count takes the arrows' row. */
		.scene .hud-right .utility span {
			font-size: 44cqh;
			line-height: 1;
		}
		.scene .hud .bonus-button {
			width: auto !important;
			min-width: 0 !important;
			height: 67% !important;
			min-height: 0 !important;
			aspect-ratio: 118 / 49 !important;
			border: 0 !important;
			border-radius: 0 !important;
			background: #e38b01 !important;
			box-shadow: none !important;
			color: #fff !important;
			clip-path: none !important;
		}
		.scene .hud .bonus-button span {
			font-size: clamp(17px, 2.1vw, 25px);
			letter-spacing: 0.02em;
			text-shadow: none;
		}
		.scene .hud .metrics {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 0;
			align-self: center;
			width: 100%;
			height: 100%;
			min-height: 0;
		}
		/* Label over value, both flush left on the group's own x — no boxes around the read-outs.
		   The one rule the design draws is a hairline between BALANCE and WIN (9198:123436, the
		   rotated Line 3): sampled #6f4605 off the frame, with WIN's type 53px clear of it. */
		.scene .hud .metric {
			display: grid;
			align-content: center;
			justify-items: start;
			gap: 2px;
			min-width: 0;
			min-height: 0;
			padding: 0;
			border: 0 !important;
			text-align: left;
		}
		.scene .hud .metric.win {
			position: relative;
			padding-left: clamp(14px, 2.2vw, 30px);
		}
		/* Measured off the frame: the rail's field is 72px tall and the rule runs y35..82 of it — 48px,
		   a third of the field clear at each end, not edge to edge ("still wrong", user 2026-09-16). */
		.scene .hud .metric.win::before {
			content: '';
			position: absolute;
			top: 17%;
			bottom: 17%;
			left: 0;
			width: 1px;
			background: #6f4605;
		}
		.scene .hud .metric span {
			color: #e38b01;
			font-size: clamp(8px, 0.9vw, 11px);
			letter-spacing: 0.14em;
			line-height: 1;
		}
		.scene .hud .metric strong {
			color: #fff !important;
			font-size: clamp(14px, 2vw, 26px) !important;
			line-height: 1;
			text-shadow: none;
		}
		/* The BET group is the only one with an icon: a 24x25 coin stack, 21px clear of the type. */
		.scene .hud .metric.bet {
			padding-left: clamp(30px, 3.8vw, 45px);
			background: url('/assets/veggie-salad/pixel/coin-stack.webp') left center / auto
				clamp(17px, 2.1vw, 25px) no-repeat;
		}
		.scene .hud-right {
			display: grid;
			grid-template-columns: auto auto auto auto;
			grid-template-rows: minmax(0, 1fr);
			gap: clamp(8px, 1.3vw, 16px);
			align-items: center;
			width: auto;
			height: 100%;
			min-height: 0;
			margin-left: 0;
			padding: 0;
			border: 0 !important;
		}
		.scene .hud .bet-stepper {
			display: grid;
			grid-template-columns: repeat(2, auto);
			grid-template-rows: minmax(0, 1fr);
			align-items: center;
			height: 100%;
			gap: clamp(8px, 1.3vw, 15px);
			width: auto;
		}
		.scene .hud .spin {
			width: auto !important;
			/* 104/73 in the design; trimmed so the overhang fits the clearance below the bar. */
			height: 129% !important;
			min-height: 0 !important;
			aspect-ratio: 1 !important;
			margin: 0 !important;
			border: 0 !important;
			border-radius: 50% !important;
			background: #e38b01 !important;
			/* The disc carries a soft halo of its own colour in the art, not a hard ring. */
			box-shadow: 0 0 0 9px rgb(227 139 1 / 32%) !important;
			clip-path: none !important;
		}
		.scene .hud .spin-arrow {
			width: 64% !important;
			height: 64% !important;
			fill: #fbe7fa !important;
			filter: none !important;
		}
	}

	/* ── Side boards keep their sides in the bonus ─────────────────────────────────────────────
	   Every landscape pass above swaps them the moment a bonus class lands on the scene: the win
	   board jumps from the right gutter to the left and the free-spin counters take the right. That
	   moves both boards out from under the player mid-feature. They now hold the sides they have in
	   the base game — win board right, counters left — using the same gutter maths the passes above
	   use, so nothing else about their size or spacing changes. */
	@media (orientation: landscape) {
		.scene .game-stage .cluster-panel {
			right: 1cqw;
			left: calc(50% + min(50cqw, 62.5cqh) + 0.75cqw);
		}
		.scene .game-stage .bonus-readouts {
			right: auto;
			left: 2cqw;
			width: calc(50% - min(50cqw, 62.5cqh) - 4cqw);
			max-width: none;
		}
	}

	/* ── Free-spin counters ────────────────────────────────────────────────────────────────────
	   Design 9198:20884: two identical slabs, 270x90 on a 1200x670 frame, 10 apart — a #2C1901
	   field inside a 3px #844A0D border, the same two colours as the win plaque and the bonus
	   cards. The design reads label-in-white over value-in-amber; this had it the other way round,
	   and gave EARNED a green field of its own. The design's box carries no tier line, so the one
	   under the spin count goes — the congrats card has just named the tier. */
	.scene .game-stage .bonus-readouts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto;
		gap: clamp(4px, 1.5cqh, 10px);
		height: auto;
		min-height: 0;
	}
	.scene .game-stage .bonus-readout {
		display: grid;
		align-content: center;
		justify-items: center;
		gap: clamp(2px, 0.7cqh, 5px);
		min-height: clamp(52px, 13.4cqh, 90px);
		padding: clamp(5px, 1.1cqh, 11px) clamp(6px, 0.8cqw, 14px);
		border: 3px solid #844a0d;
		border-radius: 0;
		background: #2c1901;
		box-shadow: none;
	}
	.scene .game-stage .bonus-readout span {
		color: #fff;
		font-size: clamp(11px, 3.5cqh, 24px);
		letter-spacing: 0.04em;
		text-shadow: none;
	}
	.scene .game-stage .bonus-readout strong {
		min-width: 0;
		color: #e38b01;
		font-size: clamp(17px, 5.6cqh, 38px);
		line-height: 1;
		text-shadow: none;
	}
	.scene .game-stage .bonus-readout small {
		display: none;
	}

	/* ── Quick menu ────────────────────────────────────────────────────────────────────────────
	   Dressed as the bottom bar it opens from: a #351E01 field in a 2px #925A06 border with amber
	   Jersey 10 labels. The old panel was 104px wide with 10px labels on a darker brown, which read
	   as a scrap of UI dropped over the signpost behind it rather than part of the bar. Appearance
	   only — each layout keeps its own anchor, since the menu button moves side to side. */
	.scene .quick-menu {
		gap: 0;
		padding: 5px;
		border: 2px solid #925a06;
		border-radius: 0;
		background: #351e01;
		box-shadow: 0 6px 0 rgb(12 6 1 / 45%);
	}
	.scene .quick-menu button {
		gap: 10px;
		padding: 0 7px 0 3px;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: #e38b01;
		letter-spacing: 0.06em;
	}
	.scene .quick-menu button + button {
		border-top: 1px solid #5c360a;
	}
	.scene .quick-menu button:hover,
	.scene .quick-menu button:focus-visible {
		background: #4a2a02;
		color: #ffa10e;
		outline: 0;
	}
	.scene .quick-menu button.off {
		color: #8a5b16;
	}
	.scene .quick-menu-icon {
		border: 2px solid #925a06;
		background: #2c1901;
		/* The typeset "i" takes this; the sound and music glyphs are SVGs filled #F2CB8C, and the
		   label orange it inherited left the "i" the odd one out on the phone layouts. */
		color: #f2cb8c;
	}

	/* Landscape sizing, to the same scale as the bar's own controls — so it carries the bar's own
	   height gate rather than reaching a shell that has no bar. */
	@media (min-width: 681px) and (orientation: landscape) and (min-height: 601px) {
		/* Design 9227:176057 on the 1200x670 frame: a 170-wide box holding 48px icon squares
		   with 24px Jersey labels 18px to their right, rows 11px apart on hairlines. The old
		   34px icons and 15-20px labels were "not big enough" (user, 2026-09-16); these are the
		   frame's own sizes in vw so they grow with the bar. */
		.scene .quick-menu {
			--qm: calc(100vw / 1200);
			/* Flush with the bar's left inset and parked directly on top of it. */
			left: 4.33vw;
			bottom: calc(clamp(56px, 11.6vh, 77px) + clamp(12px, 2.2vh, 18px) + 9px);
			width: clamp(170px, calc(170 * var(--qm)), 240px);
			padding: max(6px, calc(11 * var(--qm)));
		}
		.scene .quick-menu button {
			grid-template-columns: clamp(44px, calc(48 * var(--qm)), 64px) minmax(0, 1fr);
			gap: clamp(12px, calc(18 * var(--qm)), 24px);
			height: auto;
			padding: max(4px, calc(5.5 * var(--qm))) 0;
			color: #f2cb8c;
			font-size: clamp(22px, calc(24 * var(--qm)), 32px);
			letter-spacing: 0.02em;
		}
		.scene .quick-menu button + button {
			border-top: 1px solid #925a06;
		}
		.scene .quick-menu button:hover,
		.scene .quick-menu button:focus-visible {
			background: transparent;
			color: #fff;
		}
		.scene .quick-menu button.off {
			color: #8a6a3a;
		}
		.scene .quick-menu-icon {
			width: clamp(44px, calc(48 * var(--qm)), 64px);
			height: clamp(44px, calc(48 * var(--qm)), 64px);
			border: 1px solid #935901;
			background: #361e01;
			/* White here left the "i" the odd one out beside the #F2CB8C SVG glyphs ("the i is not
			   the right color", user 2026-09-18). */
			color: #f2cb8c;
		}
		.scene .quick-menu-icon.info-icon {
			font-size: clamp(28px, calc(32 * var(--qm)), 42px);
		}
	}
	/* ── Landscape phones and short landscape shells ──────────────────────────────────────────
	   This pass is LAST on purpose. The bottom-bar and desktop-HUD passes below it are written for
	   a tall landscape shell and both match `(min-width: 681px) and (orientation: landscape)`, so on
	   an 800x360 phone they were winning on source order and rebuilding the rail as a full-width
	   bar — 730x311 of HUD over a 360-tall screen. Nothing here changed except its position in the
	   file; the rail it declares is the one design 9283:250375 draws. */

	/* Landscape reference, design 9283:250375: left identity/readouts/history/balance, centred
	   board, right control rail with a separate bet stepper and a bottom win readout. Every
	   measurement uses the live viewport, never a fixed design size.
	   Keyed on HEIGHT alone now, not on `pointer: coarse`: a phone is not the only thing that is
	   360 tall — a resized desktop window is the same shape and the bottom bar fits it just as
	   badly — and gating on the pointer left such a window falling through to a pass written for a
	   670-tall frame. */
	@media (orientation: landscape) and (max-height: 600px) {
		.scene {
			--land-left: 22vw;
			--land-hud-border: clamp(3px, 0.45vw, 5px);
			/* The design hairlines every control box and the rail itself at one pixel of #8C5601 —
			   measured off its own frame, not the thicker slab border the wide layout uses. */
			--land-control-border: 1px;
			--land-right: 20vw;
			display: block;
			padding: 0;
		}
		.brand {
			position: absolute;
			inset: 6% auto auto 1.6%;
			display: block;
			width: 20%;
			height: auto;
			min-height: 0;
			aspect-ratio: 857 / 140;
			margin: 0;
			transform: none;
		}
		.brand img {
			transform: translateY(-25.658%);
		}
		.studio-mark {
			display: block;
			inset: 1.4% 1.6% auto auto;
			width: 10%;
			height: auto;
			object-fit: contain;
			transform: none;
		}
		.game-stage,
		.game-stage:has(.bonus-readouts) {
			position: absolute;
			inset: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
				env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
			display: block;
			width: auto;
			height: auto;
			padding: 0;
			container-type: size;
		}
		.board-wrap,
		.game-stage:has(.bonus-readouts) .board-wrap {
			position: absolute;
			inset: 50% auto auto 52%;
			/* The design's board is 423x341 on its 800x360 frame — 52.9cqw by 94.7cqh, where the
			   old cap stopped at 92.8cqh and left it a little short of the frame. Both terms are
			   raised by the same factor, so the 1.24 aspect the frame art needs is unchanged. */
			width: min(55cqw, 120cqh);
			height: min(44cqw, 96cqh);
			grid-area: auto;
			transform: translate(-50%, -50%);
		}
		.scene .game-stage .cluster-panel,
		.scene:not(.bonus-normal):not(.bonus-super):not(.bonus-hidden) .game-stage .cluster-panel {
			position: absolute;
			inset: 46% auto 12.5% 2.8%;
			display: block;
			width: 16.4%;
			max-width: none;
			height: auto;
			padding: clamp(5px, 0.8vw, 12px);
			border: clamp(2px, 0.28vw, 4px) solid #241906;
			background: #354818;
			box-shadow:
				inset 0 0 0 clamp(2px, 0.4vw, 6px) #82500c,
				inset 0 0 0 clamp(4px, 0.65vw, 10px) #a4772b;
			clip-path: polygon(4% 0, 96% 0, 100% 4%, 100% 96%, 96% 100%, 4% 100%, 0 96%, 0 4%);
			transform: none;
		}
		.cluster-panel::before,
		.cluster-panel::after {
			display: none;
		}
		.scene .game-stage .cluster-panel .panel-rows,
		.scene:not(.bonus-normal):not(.bonus-super):not(.bonus-hidden)
			.game-stage
			.cluster-panel
			.panel-rows {
			height: 100%;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: repeat(var(--slots, 6), minmax(0, 1fr));
			gap: clamp(1px, 0.25vh, 3px);
		}
		.scene .game-stage .cluster-panel .panel-row,
		.scene:not(.bonus-normal):not(.bonus-super):not(.bonus-hidden)
			.game-stage
			.cluster-panel
			.panel-row {
			grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1.6fr);
			gap: clamp(1px, 0.3vw, 4px);
			min-width: 0;
			min-height: 0;
			height: auto;
			padding: clamp(1px, 0.22vw, 3px);
			border: 1px solid #708741;
			font-size: clamp(7px, 1.3vw, 20px);
			font-weight: 400;
			text-shadow: none;
			background: #617637;
			box-shadow: none;
		}
		.scene .game-stage .cluster-panel .panel-row.vacant {
			background: #354818;
			border-color: #53672a;
		}
		.cluster-panel .panel-row img {
			width: 100%;
			height: min(4.6vh, 2.3vw);
			object-fit: contain;
		}
		.cluster-panel .panel-row span,
		.cluster-panel .panel-row strong {
			display: block;
			font-size: inherit;
		}
		.cluster-panel .panel-row span {
			padding: 1px 3px;
			border: 1px solid #9cad73;
		}
		.cluster-panel .panel-row strong {
			min-width: 0;
			color: #ffc022;
			text-shadow: none;
		}
		.bonus-readouts {
			position: absolute;
			inset: 17% auto auto 2.8%;
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: repeat(2, minmax(0, 1fr));
			width: 16.4%;
			max-width: none;
			height: 26.5%;
			gap: 1.4vh;
			transform: none;
		}
		.bonus-readout,
		.bonus-status {
			position: static;
			min-height: 0;
			padding: 0.5vh 0.4vw;
			align-content: center;
			border: var(--land-hud-border) solid #8c601a;
			background: #321c03;
			box-shadow: none;
		}
		.bonus-readout span {
			color: #fff8df;
			font-size: clamp(8px, 1.65vw, 24px);
			letter-spacing: 0;
		}
		.bonus-readout strong {
			color: #eea000;
			font-size: clamp(12px, 2.2vw, 32px);
			line-height: 1;
		}
		.bonus-readout small {
			display: none;
		}
		.scene .hud {
			position: fixed;
			inset: 10.4% 2.6% 12% auto !important;
			display: grid;
			grid-template-areas: none;
			grid-template-columns: minmax(0, 1fr);
			/* One continuous box with the disc lying ON it, which is what design 9283:250375 draws.
			   A connected-component read of that frame reports two dark boxes only because the
			   opaque disc interrupts the one box in the middle — measured again by row, the rail
			   runs unbroken from y38 to y315. Its contents at that size: menu 32, BONUS 51x28, the
			   disc 70 across, turbo 32, auto 32, on a 15px rhythm inside ~11px of padding. The
			   children carry those sizes, so the tracks are content-sized. */
			grid-template-rows: repeat(5, auto);
			gap: 4vh;
			align-items: center;
			justify-items: center;
			width: 7.6%;
			height: auto !important;
			min-height: 0;
			padding: 3vh 0;
			border: var(--land-control-border) solid #8c5601;
			background: #351e01;
			box-shadow: none;
			transform: none;
			overflow: visible;
			pointer-events: auto;
		}
		.hud::before {
			display: none;
		}
		.hud-left,
		.hud-right,
		.hud .metrics {
			display: contents;
		}
		.scene .hud .utility,
		.scene .hud .bonus-button,
		.scene .hud .spin {
			position: relative;
			inset: auto;
			grid-column: 1;
			min-width: 0;
			min-height: 0;
			padding: 0;
			margin: 0;
			transform: none;
		}
		.scene .hud .utility {
			width: min(4.4vw, 9.4vh);
			height: min(4.4vw, 9.4vh);
			clip-path: none !important;
		}
		.hud-left .utility {
			grid-row: 1;
		}
		.scene .hud .bonus-button {
			grid-row: 2;
			/* 51x28 against the rail's 60 in the design — a wide, shallow block, not a slab that
			   fills the column. */
			width: 85%;
			height: min(3.6vw, 7.8vh);
			clip-path: none !important;
			border: 0 !important;
			background: #e89600 !important;
			box-shadow: none !important;
		}
		.hud .bonus-button span {
			font-size: clamp(9px, 1.45vw, 22px);
		}
		.hud .bonus-button small {
			display: none;
		}
		.scene .hud .spin {
			grid-row: 3;
			align-self: center;
			justify-self: center;
			/* 70 across in the design, which is 8.75vw / 19.4vh at its own 800x360. */
			width: min(8.8vw, 19.4vh);
			height: min(8.8vw, 19.4vh);
			border-width: clamp(3px, 0.4vw, 6px) !important;
		}
		.scene .hud .turbo {
			grid-row: 4;
		}
		.scene .hud .auto {
			grid-row: 5;
		}
		/* Ink measured inside the design's own 34px boxes: the menu bars are 12x10, the turbo bolt
		   7x15 and the auto arrows only 7x7 over a 15x5 AUTO caption. At 58% the arrows came out
		   19px — nearly three times the design's — which is what made this button read as a
		   different control. The pair is centred as one stack, not pinned top-and-bottom. */
		.scene .hud-right .utility {
			grid-template-rows: auto auto;
			align-content: center;
			gap: 13%;
			padding: 0;
		}
		.scene .hud .utility svg {
			/* 8px of ink across the design's 34px box. */
			width: 24%;
			height: auto;
		}
		/* The menu bars are the widest ink in the rail — 12px of the same 34px box. Its viewBox
		   carries about half its width in padding, so the box percentage is roughly double. */
		.scene .hud-left .utility svg {
			width: 76%;
		}
		.scene .hud .turbo .turbo-icon {
			width: auto;
			height: 44%;
		}
		.scene .hud .auto small {
			font-size: clamp(6px, 1.2vw, 18px);
		}
		.scene .hud .bet-stepper {
			position: fixed;
			inset: auto 11.6% 12% auto;
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: repeat(3, minmax(0, 1fr));
			justify-items: center;
			align-items: center;
			gap: 0;
			width: 4.4vw;
			height: 29vh;
			padding: 0.8vh 0.35vw;
			border: var(--land-hud-border) solid #8c601a;
			background: #321c03;
		}
		.scene .hud .bet-stepper button {
			width: 100%;
			height: 80%;
			min-height: 0;
			padding: 0;
			font-size: clamp(10px, 1.6vw, 24px);
			transform: none;
			clip-path: none !important;
		}
		.hud .bet-stepper button:first-child {
			grid-column: 1;
			grid-row: 3;
		}
		.hud .bet-stepper button:last-child {
			grid-column: 1;
			grid-row: 1;
		}
		.scene .hud .utility,
		.scene .hud .bet-stepper button {
			background: #321c03 !important;
			border: var(--land-control-border) solid #8c601a !important;
			box-shadow: none !important;
		}
		.scene .hud .utility:active,
		.scene .hud .utility.pressed-flash,
		.scene .hud .bet-stepper button:active {
			background: #65400c !important;
		}
		.hud .metric {
			position: fixed;
			inset: auto auto 1.6% 2.8%;
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			grid-area: auto;
			align-items: center;
			gap: 0.6vw;
			width: 17.2vw;
			height: 8vh;
			min-height: 0;
			padding: 0.4vh 0.5vw;
			border: var(--land-hud-border) solid #76521c;
			background: #321c03;
			box-shadow: none;
			text-align: left;
		}
		.hud .metric.win {
			inset: auto 2.6% 1.6% auto;
		}
		.hud .metric span {
			display: block;
			color: #fff8df;
			font-size: clamp(7px, 1.3vw, 20px);
			letter-spacing: 0;
			text-shadow: none;
		}
		/* BALANCE, WIN and BET all read WHITE in the design — sampled off its own frame, every one
		   of those values is #FFFFFF. The amber in this layout belongs to BONUS, the disc and the
		   win board's totals, and using it here as well flattened that hierarchy. */
		.hud .metric strong {
			color: #fff !important;
			font-size: clamp(9px, min(2.2vw, calc(110cqw / var(--chars, 8))), 32px) !important;
			text-align: right;
			text-shadow: none;
		}
		.scene .hud .auto small {
			color: #fff;
		}
		.hud .metric.bet {
			inset: auto 11.6% 21.65% auto;
			z-index: 2;
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			width: 4.4vw;
			height: 9.7vh;
			padding: 0;
			border: 0;
			background: none;
			pointer-events: none;
		}
		.hud .metric.bet span {
			display: none;
		}
		.hud .metric.bet strong {
			font-size: clamp(7px, calc(150cqw / var(--chars, 8)), 22px) !important;
			text-align: center;
		}
		.quick-menu {
			inset: 10.4% 11.6% auto auto;
			max-height: 80svh;
			overflow-y: auto;
		}
		.modal-layer {
			padding: 6px;
		}
		.confirm-panel {
			max-height: calc(100svh - 12px);
			overflow-y: auto;
		}
		.auto-panel {
			--u: calc(min(604px, 100vw - 12px, (100svh - 12px) * 604 / 540) / 604);
			max-height: calc(100svh - 12px);
			overflow-y: auto;
		}
		:global(.pop-up-wrap .info-stage) {
			width: min(calc(100vw - 24px), calc((100svh - 80px) * 1.49));
		}
	}

	/* Popout S: use narrow gutters and nearly the entire height for the board.
	   Controls grow independently of the tiny viewport width. */
	@media (orientation: landscape) and (max-width: 520px) and (max-height: 300px) {
		.scene .brand {
			inset: 2% auto auto 1%;
			width: 17%;
		}
		.scene .studio-mark {
			inset: 0 0 auto auto;
			width: 12%;
		}
		.scene .game-stage .board-wrap,
		.scene .game-stage:has(.bonus-readouts) .board-wrap {
			left: 50%;
			width: min(60cqw, 117cqh);
			height: min(48cqw, 93.6cqh);
		}
		.scene .game-stage .cluster-panel,
		.scene:not(.bonus-normal):not(.bonus-super):not(.bonus-hidden) .game-stage .cluster-panel {
			inset: 14% auto 12% 1%;
			width: 17%;
			padding: 4px;
		}
		.scene .game-stage:has(.bonus-readouts) .cluster-panel {
			top: 44%;
		}
		.scene .bonus-readouts {
			inset: 13% auto auto 1%;
			width: 17%;
			height: 28%;
			gap: 2px;
		}
		.scene .hud {
			inset: 8% 1% 12% auto !important;
			width: 10.5%;
			padding: 2px 0;
			gap: 2px;
			grid-template-rows: 1fr 1fr 1.8fr 1fr 1fr;
		}
		.scene .hud .utility {
			width: min(7vw, 12vh);
			height: min(7vw, 12vh);
		}
		.scene .hud .bonus-button {
			width: 94%;
			height: 11vh;
		}
		.scene .hud .spin {
			width: min(13vw, 23vh);
			height: min(13vw, 23vh);
		}
		.scene .hud .bet-stepper {
			right: 12.2%;
			bottom: 12%;
			width: 5.8vw;
			height: 36vh;
			padding: 1px;
		}
		.scene .hud .metric.bet {
			right: 12.2%;
			bottom: 24%;
			width: 5.8vw;
			height: 12vh;
		}
		.scene .hud .metric.balance {
			left: 1%;
			width: 17vw;
		}
		.scene .hud .metric.win {
			right: 1%;
			width: 17vw;
		}
		.scene .quick-menu {
			inset: 4px 12% auto auto;
		}
	}
	/* ── Portrait bonus, designs 9262:211494 (dusk) / 9262:213551 (night) / 9262:215601 (sunset)
	   Sits after the unscoped free-spin-counter pass above, which otherwise sizes the counters
	   off the stage's cqh and lets them grow over the logo ("the backgrounds are wrong", user
	   2026-09-17). Everything is a share of --pw, the 360 design width. */
	@media (orientation: portrait) {
		/* Two 135.6x46 slabs on the panel's own row, 1px apart: #2C1901 in a 1.665px #844A0D line,
		   the label in white Jersey 10 at 17.76 and the value in amber at 23.87. The design parks
		   them 10px off the right edge, which lands their left border on the cluster panel's; they
		   sit 6px off instead — flush with the board frame's right edge below — so a 5px gap keeps
		   the two boxes apart. */
		.scene .game-stage .bonus-readouts {
			display: grid;
			grid-column: 2;
			grid-row: 1;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: repeat(2, minmax(0, 1fr));
			gap: calc(var(--pw) * 0.003);
			justify-self: end;
			width: calc(var(--pw) * 0.377);
			height: 100%;
			min-height: 0;
			margin-right: calc(var(--pw) * 0.0154);
		}
		.scene .game-stage .bonus-readout {
			display: grid;
			grid-template-rows: auto auto;
			align-content: center;
			justify-items: center;
			gap: calc(var(--pw) * 0.004);
			min-height: 0;
			padding: 0 calc(var(--pw) * 0.01);
			border: max(1px, calc(var(--pw) * 0.0046)) solid #844a0d;
			border-radius: 0;
			background: #2c1901;
			box-shadow: none;
		}
		.scene .game-stage .bonus-readout span {
			font-size: calc(var(--pw) * 0.049);
			letter-spacing: 0.03em;
			line-height: 1;
		}
		.scene .game-stage .bonus-readout strong {
			font-size: calc(var(--pw) * 0.066);
			line-height: 1;
		}

		/* The gardens: a sky gradient (the design's 350-tall rect starts 46px above the game, under
		   the site header), the flat ground from 304px (0.844pw) down, and one hill strip behind
		   the board over it. The strips are cut by scripts/build-portrait-gardens.py. The landscape
		   gardens' own layers, clouds and stars are switched off here, not resized. */
		.scene .background-normal > *,
		.scene .background-super > * {
			display: none;
		}
		.scene .background-normal,
		.scene .background-super {
			background-image: none;
			background-repeat: no-repeat;
			background-position: 0 calc(var(--pw) * -0.128);
			background-size: 100% calc(var(--pw) * 0.972);
		}
		.scene .background-normal::before,
		.scene .background-super::before {
			inset: auto 0;
			z-index: 1;
			width: auto;
			height: auto;
			background-image: none;
			background-position: center top;
			background-size: 100% 100%;
			background-repeat: no-repeat;
			transform: none;
		}
		.scene .background-normal::after,
		.scene .background-super::after {
			display: none;
		}
		/* Dusk (garden-dusk): purple-to-pink sky, #659337 ground, hills 175.5 tall from 208. */
		.scene.garden-dusk .background-normal {
			background-color: #659337;
			background-image: linear-gradient(
				180deg,
				#6e62bd 1%,
				#7461ba 14%,
				#9465b2 40%,
				#b469aa 66%,
				#de768f 92.5%
			);
		}
		.scene.garden-dusk .background-normal::before {
			top: calc(var(--pw) * 0.578);
			height: calc(var(--pw) * 0.4875);
			background-image: url('./assets/veggie-salad/pixel/background/portrait/hills-dusk.webp');
		}
		/* Sunset (NORMAL via the Mystery pick): red-to-gold sky, #7F8905 ground, hills 217.7 tall
		   from 183. */
		.scene:not(.garden-dusk) .background-normal {
			background-color: #7f8905;
			background-image: linear-gradient(
				180deg,
				#cd3e4b 1%,
				#dc403f 14%,
				#f16026 40%,
				#f77619 66%,
				#f69c0f 92.5%
			);
		}
		.scene:not(.garden-dusk) .background-normal::before {
			top: calc(var(--pw) * 0.508);
			height: calc(var(--pw) * 0.605);
			background-image: url('./assets/veggie-salad/pixel/background/portrait/hills-sunset.webp');
		}
		/* Night (SUPER): flat #092669 sky, #1B623A ground, hills 169.7 tall from 219. */
		.scene .background-super {
			background-color: #1b623a;
			background-image: linear-gradient(#092669, #092669);
		}
		.scene .background-super::before {
			top: calc(var(--pw) * 0.608);
			height: calc(var(--pw) * 0.471);
			background-image: url('./assets/veggie-salad/pixel/background/portrait/hills-night.webp');
		}
	}

	/* ── Portrait paddock ─────────────────────────────────────────────────────────────────────
	   The 360x577 design frame has no lawn between the board and the bar, but every taller phone
	   does (the scene's middle row stretches, the stage's rows do not), and the garden's creature
	   grazes it: the butterfly wanders the whole strip, the owl and the pup stand low on the left. Its top is the board's own bottom (readouts row + board margin + the board's
	   349:277.6 height, all in --pw), and it only opens once the strip is about a quarter of the
	   width tall — a viewport at least 1.85 times taller than wide. */
	.paddock {
		display: none;
	}
	@media (orientation: portrait) and (max-aspect-ratio: 1 / 1.85) {
		.scene .game-stage .paddock {
			position: absolute;
			inset: calc(var(--pw) * 1.0625) 0 0;
			display: block;
			overflow: hidden;
			pointer-events: none;
		}
		.scene .paddock .butterfly {
			width: calc(var(--pw) * 0.2);
		}
		.scene .paddock-owl {
			position: absolute;
			bottom: 3%;
			left: 6%;
			width: calc(var(--pw) * 0.3);
		}
		/* The pup faces right, so it stands on the left with its tail off the edge and looks in
		   across the lawn. */
		.scene .paddock-wolf {
			position: absolute;
			bottom: 2%;
			left: -5%;
			height: min(88%, calc(var(--pw) * 0.42));
		}
		.scene .paddock .wolf-stage {
			height: 100%;
			margin: 0;
		}
	}
</style>

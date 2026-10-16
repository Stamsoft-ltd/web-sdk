import { BASE_GATE_ROOT } from './art';
import { bonusScatterKeys, SCATTER_CELEBRATION_MS } from './scatterCelebration';
import { playGameSound, stopGameSounds } from './audio';
import { TUMBLE_FLIGHT_MS, TUMBLE_ARRIVAL_MS, tumbleFlightTiming } from './tumbleFlight';
import {
	bonusTransitionDuration,
	BONUS_SCENE_SWITCH_MS,
	bonusEntryBoundary,
	type BonusTransition,
} from './bonusTransition';
import { stateBet, stateConfig, stateUrlDerived } from 'state-shared';
import { createRewardDelivery, type RewardDelivery } from './rewardDelivery';
import { autoplaySettings } from './autoplaySettings.svelte';
import { requestEndEvent } from 'rgs-requests';
import { initialState, reduceEvent, restorePrefix } from './reducer';
import { loadRig } from './spine';
import { loadAssetImage } from './imageAssets';
import { ART_ROOT, MOTION_ROOT, artTier } from './art';
import {
	TIMING,
	bonusEntryHold,
	gateSelectionHold,
	waitForDismissal,
	waitForTarget,
} from './presentation';
import { selectedSpeed, speedFactor } from './uiPolicy';
import { winTiming, winTier } from './winPresentation';
import { cellMotion, type Wave } from './motion';
import type { Speed } from './uiPolicy';
import type { Bet, BookEvent, Position, Tier } from './contract';

export const runtime = $state({
	scatterCelebration: null as null | { keys: string[]; startedAt: number; duration: number },
	game: initialState(),
	roundId: 'preview',
	busy: false,
	phase: 'idle',
	bonusTransition: null as BonusTransition | null,
	sceneTierOverride: null as { tier: Tier | null } | null,
	removed: [] as Position[],
	overlay: null as null | {
		kind: 'bonus' | 'summary' | 'win' | 'cap';
		tier?: string;
		amount?: number;
		spins?: number;
		countMs?: number;
	},
	waiting: false,
	counting: false,
	finishCount: false,
	reduced: false,
	error: '',
	startedAt: 0,
	skipRequested: false,
	waveStartedAt: 0,
	spinTotalBefore: 0,
	gateSpeedFactor: 1,
	gateStartedAt: -1,
	gateRewardStartedAt: null as number | null,
	rewardDelivery: null as RewardDelivery | null,
	wave: { speed: 'normal', kind: 'spin', cut: null, tail: 130 } as Wave,
});
let previewRound = 0;
let active: AbortController | null = null;
let acknowledge: (() => void) | null = null;
function currentSpeed(): Speed {
	return selectedSpeed(stateBet, stateConfig.jurisdiction);
}
function accelerateWave(tail: number) {
	if (!['spinning', 'dropping', 'removing'].includes(runtime.phase)) return;
	if (runtime.wave.cut !== null) return;
	runtime.wave.cut = Math.max(0, performance.now() - runtime.waveStartedAt);
	runtime.wave.tail = tail;
}
/** Speed controls remain presentation-only, including during free spins. */
export function speedChanged(previous: Speed) {
	if (speedFactor(currentSpeed()) > speedFactor(previous))
		accelerateWave(currentSpeed() === 'turbo' ? 75 : 130);
}
export function requestSkip() {
	if (!runtime.busy || runtime.overlay || stateConfig.jurisdiction.disabledSlamstop) return;
	if (runtime.skipRequested) return;
	runtime.skipRequested = true;
	accelerateWave(130);
}
function beginWave(kind: Wave['kind']) {
	runtime.wave = {
		speed: runtime.skipRequested ? 'turbo' : currentSpeed(),
		kind,
		cut: null,
		tail: 130,
	};
	runtime.waveStartedAt = performance.now();
}
/** Same per-cell values drive CSS and the playback barrier: no early phase teardown. */
function waveDuration() {
	let end = 0;
	const sticky = new Set(runtime.game.sticky.map((p) => `${p.reel}:${p.row}`));
	const removed = new Set(runtime.removed.map((p) => `${p.reel}:${p.row}`));
	for (let reel = 0; reel < runtime.game.board.length; reel++) {
		for (let row = 0; row < runtime.game.board[reel].length; row++) {
			if (!runtime.game.board[reel][row] || sticky.has(`${reel}:${row}`)) continue;
			const offset = runtime.game.fallOffsets[reel][row];
			if (runtime.wave.kind === 'remove' && !removed.has(`${reel}:${row}`)) continue;
			if (['spin', 'tumble'].includes(runtime.wave.kind) && offset === 0) continue;
			const m = cellMotion(runtime.wave, reel, row, offset);
			end = Math.max(
				end,
				m.delay + m.duration + (['spin', 'tumble'].includes(runtime.wave.kind) ? m.impact : 0),
			);
		}
	}
	return runtime.reduced ? Math.min(100, end) : end + 24;
}
export function arriveGateReward(id: string, index: number) {
	const delivery = runtime.rewardDelivery;
	if (!delivery || delivery.id !== id || delivery.arrived.includes(index)) return false;
	delivery.arrived = [...delivery.arrived, index];
	return true;
}
export function continuePresentation() {
	if (runtime.counting) {
		runtime.finishCount = true;
		return;
	}
	acknowledge?.();
}
export function cancelPlayback() {
	runtime.scatterCelebration = null;
	stopGameSounds();
	runtime.bonusTransition = null;
	runtime.sceneTierOverride = null;
	active?.abort();
	acknowledge?.();
	active = null;
	runtime.busy = false;
	runtime.waiting = false;
	runtime.overlay = null;
	runtime.rewardDelivery = null;
}
export function resetRound() {
	runtime.scatterCelebration = null;
	runtime.bonusTransition = null;
	runtime.sceneTierOverride = null;
	runtime.rewardDelivery = null;
	runtime.game = { ...initialState(), board: runtime.game.board };
	runtime.phase = 'idle';
	runtime.skipRequested = false;
	stateBet.winBookEventAmount = 0;
	runtime.startedAt = performance.now();
}
function delay(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		if (signal.aborted) {
			reject(new DOMException('Cancelled', 'AbortError'));
			return;
		}
		const abort = () => {
			clearTimeout(timer);
			reject(new DOMException('Cancelled', 'AbortError'));
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', abort);
			resolve();
		}, ms);
		signal.addEventListener('abort', abort, { once: true });
	});
}
async function pause(signal: AbortSignal, autoCloseMs?: number) {
	runtime.waiting = true;
	await waitForDismissal(
		signal,
		(dismiss) => {
			acknowledge = dismiss;
		},
		autoCloseMs,
	);
	runtime.waiting = false;
}
async function present(
	signal: AbortSignal,
	autoCloseMs?: number,
	guard: number = TIMING.overlayGuard,
) {
	runtime.finishCount = false;
	// Tiny guard stops the trigger tap from also dismissing the new screen.
	await delay(guard, signal);
	await pause(signal, autoCloseMs);
}
async function presentWin(amount: number, signal: AbortSignal) {
	const timing = winTiming(amount, runtime.skipRequested ? 6 : speedFactor(currentSpeed()));
	runtime.overlay = { kind: 'win', amount, countMs: timing.countMs };
	const cue = winTier(amount)?.key;
	if (cue) playGameSound(cue, { group: 'win' });
	try {
		await present(signal, timing.holdMs);
	} finally {
		stopGameSounds('win');
		runtime.overlay = null;
	}
}
export function restoreBet(bet: Bet) {
	runtime.roundId = String(bet.betID ?? bet.roundID ?? 'book');
	const cursor = Number(bet.event ?? 0);
	runtime.game = restorePrefix(bet.state, cursor);
	stateBet.winBookEventAmount = runtime.game.total;
	return { ...bet, state: bet.state.slice(cursor) };
}
export async function playEvents(events: BookEvent[], demo = false, roundId?: string) {
	if (runtime.busy) throw new Error('Concurrent playback rejected');
	runtime.roundId = roundId ?? (demo ? `preview-${++previewRound}` : runtime.roundId);
	const controller = new AbortController();
	active = controller;
	const signal = controller.signal;
	runtime.busy = true;
	runtime.skipRequested = false;
	const wait = (ms: number, min = 70, normalScale = 1) =>
		waitForTarget(
			() =>
				runtime.reduced
					? Math.max(min, Math.min(ms, 150))
					: Math.max(
							min,
							(ms * (!runtime.skipRequested && currentSpeed() === 'normal' ? normalScale : 1)) /
								(runtime.skipRequested ? 6 : speedFactor(currentSpeed())),
						),
			signal,
		);
	const waitMotion = () => waitForTarget(waveDuration, signal);
	let selectionStartedAt: number | null = null;
	let pendingBonus: Extract<BookEvent, { type: 'freeSpinTrigger' }> | null = null;
	const transition = async (kind: 'entry' | 'exit', tier: Tier) => {
		const reduced = runtime.reduced;
		const factor = speedFactor(currentSpeed());
		runtime.bonusTransition = { kind, startedAt: performance.now(), reduced, speedFactor: factor };
		const closedAt = reduced ? BONUS_SCENE_SWITCH_MS.reduced : BONUS_SCENE_SWITCH_MS[kind];
		await delay(closedAt / factor, signal);
		// Change scenery only while the leaves cover it. Reducer/result untouched.
		runtime.sceneTierOverride = { tier: kind === 'entry' ? tier : null };
		await delay((bonusTransitionDuration(kind, reduced) - closedAt) / factor, signal);
		runtime.bonusTransition = null;
	};
	let scatterCelebrated = false;
	const celebrateScatters = async () => {
		if (scatterCelebrated) return;
		const keys = bonusScatterKeys(runtime.game.board);
		if (keys.length >= 3) {
			scatterCelebrated = true;
			const duration = runtime.reduced
				? SCATTER_CELEBRATION_MS.reduced
				: SCATTER_CELEBRATION_MS[currentSpeed()];
			runtime.scatterCelebration = { keys, startedAt: performance.now(), duration };
			playGameSound('key');
		}
	};
	const enterBonus = async () => {
		if (!pendingBonus) return;
		const e = pendingBonus;
		pendingBonus = null;

		runtime.overlay = { kind: 'bonus', tier: e.tier, spins: e.totalFs };
		await transition('entry', e.tier);
		playGameSound('bonus', { group: 'win' });
		await present(signal, undefined, TIMING.overlayGuard);
		runtime.scatterCelebration = null;
		runtime.overlay = null;
		stopGameSounds('win');
		runtime.sceneTierOverride = null;
	};

	try {
		for (const e of events) {
			if (signal.aborted) break;
			if (pendingBonus && bonusEntryBoundary(e)) await enterBonus();
			if (e.type === 'reveal' && !runtime.reduced) {
				// Resolve symbol textures before starting gravity/contact clocks on cold loads.
				const activeTier = runtime.sceneTierOverride
					? runtime.sceneTierOverride.tier
					: runtime.game.tier;
				const tier = activeTier === null ? 'base' : artTier(activeTier);
				const names = new Set(e.board.flat().flatMap((cell) => (cell ? [cell.name] : [])));
				await Promise.all(
					Array.from(names, (name) =>
						(name === 'WILD'
							? loadRig(name, 'symbols')
							: loadRig(name, `symbols-${tier}`, MOTION_ROOT)
						).catch((error) => console.warn('Symbol animation unavailable:', name, error)),
					),
				);
				if (signal.aborted) break;
			}
			if (e.type === 'tumbleRemove') {
				runtime.removed = e.positions;
				beginWave('remove');
				runtime.phase = 'removing';
				await waitMotion();
				// Keep the late portal payout readable before the reducer clears winning cells.
				await wait(320, 70);
			}
			if (e.type === 'freeSpinTrigger') {
				// Decode before starting the guarded bonus intro: cold asset loads must not eat its read time.
				await Promise.all([
					loadAssetImage(`${ART_ROOT}backgrounds/${artTier(e.tier)}-original.png`),
					loadRig(`bonus-${artTier(e.tier)}`, `bonus-${artTier(e.tier)}`, MOTION_ROOT),
					loadRig(`gate-${artTier(e.tier)}`, `gate-${artTier(e.tier)}`, MOTION_ROOT),
					waitForTarget(
						() => bonusEntryHold(currentSpeed(), runtime.reduced, runtime.skipRequested),
						signal,
					),
				]);
				if (signal.aborted) break;
			}
			if (e.type === 'freeSpinEnd') {
				await Promise.all([
					loadRig(`bonus-${artTier(e.tier)}`, `bonus-${artTier(e.tier)}`, MOTION_ROOT),
					loadRig(`gate-${artTier(e.tier)}`, `gate-${artTier(e.tier)}`, MOTION_ROOT),
				]);
				if (signal.aborted) break;
			}
			if (e.type === 'gateOpen') {
				// Decode before starting the visible clock: never jump into a late closed pose.
				const activeTier = runtime.sceneTierOverride
					? runtime.sceneTierOverride.tier
					: runtime.game.tier;
				const tier = activeTier === null ? 'base' : artTier(activeTier);
				try {
					await loadRig(
						`gate-${tier}`,
						`gate-${tier}`,
						tier === 'base' ? BASE_GATE_ROOT : MOTION_ROOT,
					);
				} catch (error) {
					console.warn('Gate animation unavailable:', error);
				}
				if (signal.aborted) break;
				if (runtime.game.wins.length) {
					// Complete the third selected-symbol beat before doors obscure the board.
					// Resume at gateOpen has no local clock: replay this presentation-only beat.
					// Do not pre-remove cells: upcoming sticky awards determine actual removals.
					runtime.phase = 'winning';
					playGameSound('cascade');
					await waitForTarget(
						() =>
							gateSelectionHold(runtime.reduced, runtime.skipRequested) /
							speedFactor(currentSpeed()),
						signal,
						selectionStartedAt ?? performance.now(),
					);
				}
				runtime.gateSpeedFactor = speedFactor(currentSpeed());
				runtime.gateStartedAt = performance.now();
				runtime.gateRewardStartedAt = null;
			}
			if (e.type === 'gateReward') {
				if (e.reward.kind === 'stickyWild') await loadRig('WILD', 'symbols');
				if (signal.aborted) break;
				runtime.gateRewardStartedAt = performance.now();
				runtime.rewardDelivery = createRewardDelivery(
					e,
					runtime.game,
					runtime.gateRewardStartedAt,
					runtime.roundId,
				);
				if (runtime.rewardDelivery) runtime.rewardDelivery.speedFactor = runtime.gateSpeedFactor;
			}
			if (e.type === 'freeSpinTrigger') runtime.sceneTierOverride = { tier: runtime.game.tier };
			if (e.type === 'spinStart') runtime.spinTotalBefore = runtime.game.total;
			runtime.game = reduceEvent(runtime.game, e);
			switch (e.type) {
				case 'spinStart':
					playGameSound('spin');
					runtime.sceneTierOverride = null;
					selectionStartedAt = null;
					runtime.skipRequested = false;
					beginWave('exit');
					runtime.phase = 'spinning';
					runtime.removed = [];
					await waitMotion();
					break;
				case 'reveal':
					selectionStartedAt = null;
					beginWave(e.cascadeIndex === 0 ? 'spin' : 'tumble');
					runtime.phase = 'dropping';
					runtime.removed = [];
					await waitMotion();
					if (
						!runtime.game.tier &&
						bonusScatterKeys(e.board).length >= 3 &&
						events.some((event) => event.type === 'freeSpinTrigger')
					)
						await celebrateScatters();
					runtime.phase = 'idle';
					if (!demo && !stateUrlDerived.replay())
						try {
							await requestEndEvent({
								eventIndex: e.index,
								rgsUrl: stateUrlDerived.rgsUrl(),
								sessionID: stateUrlDerived.sessionID(),
							});
						} catch (error) {
							console.warn('Checkpoint unavailable; server can replay earlier events', error);
						}
					break;
				case 'cascadeWin':
					playGameSound('cascade');
					selectionStartedAt = performance.now();
					runtime.phase = 'winning';
					await wait(TIMING.winHighlight, 100, 1.45);
					break;
				case 'gateProgress':
					await wait(
						TIMING.progress,
						runtime.reduced
							? 60
							: tumbleFlightTiming(currentSpeed()).flight +
									tumbleFlightTiming(currentSpeed()).arrival,
						1.35,
					);
					break;
				case 'gateOpen':
					runtime.phase = 'gate';
					await wait(
						runtime.reduced ? 100 : TIMING.gateOpen / runtime.gateSpeedFactor,
						runtime.reduced ? 100 : TIMING.gateOpen / runtime.gateSpeedFactor,
					);
					break;
				case 'gateReward':
					// Spin out while doors open, then readable 1.8s hold + delivery/arrival at every speed.
					await delay(runtime.reduced ? 150 : TIMING.gateReward / runtime.gateSpeedFactor, signal);
					runtime.rewardDelivery = null;
					break;
				case 'tumbleRemove':
					await wait(40, 40);
					break;
				case 'spinWin':
					runtime.phase = 'settling';
					if (runtime.game.freeSpin > 0 && winTier(e.amount) && !runtime.game.capped)
						await presentWin(e.amount, signal);
					else if (e.amount) await wait(TIMING.settle, 80, 1.4);
					break;
				case 'setTotalWin':
				case 'setWin':
				case 'finalWin':
					stateBet.winBookEventAmount = e.amount;
					break;
				case 'freeSpinTrigger':
					if (!autoplaySettings.continueOnBonus) stateBet.autoSpinsCounter = 0;
					stateBet.isTurbo = false;
					stateBet.isSuperTurbo = false;
					pendingBonus = e;
					break;
				case 'freeSpinEnd':
					runtime.overlay = { kind: 'summary', tier: e.tier, amount: e.amount };
					playGameSound('summary', { group: 'win' });
					await present(signal);
					stopGameSounds('win');
					playGameSound('retract');
					await transition('exit', e.tier);
					runtime.overlay = null;
					break;
				case 'maxWin':
					runtime.overlay = { kind: 'cap', amount: e.amount };
					playGameSound('legendary', { group: 'win' });
					await present(signal, TIMING.capAutoClose);
					stopGameSounds('win');
					runtime.overlay = null;
					break;
			}
		}
		if (pendingBonus) await enterBonus();
		const remaining =
			stateConfig.jurisdiction.minimumRoundDuration * 1000 -
			(performance.now() - runtime.startedAt);
		if (!demo && remaining > 0) await delay(remaining, signal);
		if (
			winTier(runtime.game.total) &&
			!events.some((e) => e.type === 'freeSpinEnd') &&
			!runtime.game.capped
		) {
			await presentWin(runtime.game.total, signal);
		}
	} finally {
		runtime.scatterCelebration = null;
		runtime.bonusTransition = null;
		stopGameSounds();
		if (signal.aborted) runtime.sceneTierOverride = null;
		runtime.busy = false;
		runtime.rewardDelivery = null;
		runtime.skipRequested = false;
		runtime.phase = 'idle';
		runtime.removed = [];
		runtime.waiting = false;
		runtime.overlay = null;
		if (active === controller) active = null;
	}
}

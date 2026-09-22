import { stateBet, stateConfig, stateUrlDerived } from 'state-shared';
import { requestEndEvent } from 'rgs-requests';
import { initialState, reduceEvent, restorePrefix } from './reducer';
import { TIMING, waitForDismissal, waitForTarget } from './presentation';
import { selectedSpeed, speedFactor, showsWinPanel } from './uiPolicy';
import { cellMotion, type Wave } from './motion';
import type { Speed } from './uiPolicy';
import type { Bet, BookEvent, Position } from './contract';

export const runtime = $state({
	game: initialState(),
	busy: false,
	phase: 'idle',
	removed: [] as Position[],
	overlay: null as null | {
		kind: 'bonus' | 'summary' | 'win' | 'cap';
		tier?: string;
		amount?: number;
		spins?: number;
	},
	waiting: false,
	counting: false,
	finishCount: false,
	reduced: false,
	error: '',
	startedAt: 0,
	skipRequested: false,
	waveStartedAt: 0,
	wave: { speed: 'normal', kind: 'spin', cut: null, tail: 130 } as Wave,
});
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
export function continuePresentation() {
	if (runtime.counting) {
		runtime.finishCount = true;
		return;
	}
	acknowledge?.();
}
export function cancelPlayback() {
	active?.abort();
	acknowledge?.();
	active = null;
	runtime.busy = false;
	runtime.waiting = false;
	runtime.overlay = null;
}
export function resetRound() {
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
async function present(signal: AbortSignal, autoCloseMs?: number) {
	runtime.finishCount = false;
	// Tiny guard stops the trigger tap from also dismissing the new screen.
	await delay(TIMING.overlayGuard, signal);
	await pause(signal, autoCloseMs);
}
export function restoreBet(bet: Bet) {
	const cursor = Number(bet.event ?? 0);
	runtime.game = restorePrefix(bet.state, cursor);
	stateBet.winBookEventAmount = runtime.game.total;
	return { ...bet, state: bet.state.slice(cursor) };
}
export async function playEvents(events: BookEvent[], demo = false) {
	if (runtime.busy) throw new Error('Concurrent playback rejected');
	const controller = new AbortController();
	active = controller;
	const signal = controller.signal;
	runtime.busy = true;
	runtime.skipRequested = false;
	const wait = (ms: number, min = 70) =>
		waitForTarget(
			() =>
				runtime.reduced
					? Math.max(min, Math.min(ms, 150))
					: Math.max(min, ms / (runtime.skipRequested ? 6 : speedFactor(currentSpeed()))),
			signal,
		);
	const waitMotion = () => waitForTarget(waveDuration, signal);

	try {
		for (const e of events) {
			if (signal.aborted) break;
			if (e.type === 'tumbleRemove') {
				runtime.removed = e.positions;
				beginWave('remove');
				runtime.phase = 'removing';
				await waitMotion();
			}
			runtime.game = reduceEvent(runtime.game, e);
			switch (e.type) {
				case 'spinStart':
					runtime.skipRequested = false;
					beginWave('exit');
					runtime.phase = 'spinning';
					runtime.removed = [];
					await waitMotion();
					break;
				case 'reveal':
					beginWave(e.cascadeIndex === 0 ? 'spin' : 'tumble');
					runtime.phase = 'dropping';
					runtime.removed = [];
					await waitMotion();
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
					runtime.phase = 'winning';
					await wait(TIMING.winHighlight, 100);
					break;
				case 'gateProgress':
					await wait(TIMING.progress, 60);
					break;
				case 'gateOpen':
					runtime.phase = 'gate';
					await wait(
						runtime.reduced ? 150 : TIMING.gateOpen,
						runtime.reduced ? 150 : TIMING.gateOpen,
					);
					break;
				case 'gateReward':
					await wait(TIMING.gateReward, 700);
					break;
				case 'tumbleRemove':
					await wait(40, 40);
					break;
				case 'spinWin':
					runtime.phase = 'settling';
					if (e.amount) await wait(TIMING.settle, 80);
					break;
				case 'setTotalWin':
				case 'setWin':
				case 'finalWin':
					stateBet.winBookEventAmount = e.amount;
					break;
				case 'freeSpinTrigger':
					stateBet.autoSpinsCounter = 0;
					stateBet.isTurbo = false;
					stateBet.isSuperTurbo = false;
					runtime.overlay = { kind: 'bonus', tier: e.tier, spins: e.totalFs };
					await present(signal);
					runtime.overlay = null;
					break;
				case 'freeSpinEnd':
					runtime.overlay = { kind: 'summary', tier: e.tier, amount: e.amount };
					await present(signal, TIMING.winAutoClose);
					runtime.overlay = null;
					break;
				case 'maxWin':
					runtime.overlay = { kind: 'cap', amount: e.amount };
					await present(signal, TIMING.capAutoClose);
					runtime.overlay = null;
					break;
			}
		}
		const remaining =
			stateConfig.jurisdiction.minimumRoundDuration * 1000 -
			(performance.now() - runtime.startedAt);
		if (!demo && remaining > 0) await delay(remaining, signal);
		if (
			showsWinPanel(runtime.game.total) &&
			!events.some((e) => e.type === 'freeSpinEnd') &&
			!runtime.game.capped
		) {
			runtime.overlay = { kind: 'win', amount: runtime.game.total };
			await present(signal, TIMING.winAutoClose);
			runtime.overlay = null;
		}
	} finally {
		runtime.busy = false;
		runtime.skipRequested = false;
		runtime.phase = 'idle';
		runtime.removed = [];
		runtime.waiting = false;
		runtime.overlay = null;
		if (active === controller) active = null;
	}
}

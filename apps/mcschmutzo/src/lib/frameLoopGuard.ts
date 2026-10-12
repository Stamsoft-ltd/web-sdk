// Keeps one thrown error from freezing the game for good (Stake review, 2026-10-10: "the game
// occasionally stops responding during a bonus round or at its conclusion, requiring the game to be
// fully closed and reopened").
//
// Both frame loops the game runs on die permanently on a single exception:
// - pixi 8.8.1 Ticker._tick calls update() and only THEN requests the next frame, so a throwing
//   ticker listener (an animation, the render itself) means no next frame — the canvas stops.
// - svelte 5.20.5 run_tasks (tweens, transitions) re-schedules itself after running every task, so
//   a throwing task stops all of them; the dead task is never removed, and loop() only restarts the
//   frame loop when the task set is empty, so nothing ever animates again.
// Both stop without a visible error, and awaited animations never resolve, which is exactly a game
// that "stops responding". The guard isolates each pixi listener and each svelte task: the error is
// logged, a broken tween ends (as if finished, so whatever awaits it carries on), and the loops keep
// running.
// @ts-ignore svelte/internal/client ships no type declarations; `raf` is typed below.
import { raf as svelteRaf } from 'svelte/internal/client';
import { PIXI } from 'pixi-svelte';

const INSTALLED = Symbol.for('mcschmutzo.frameLoopGuard');
const reported = new Set<string>();

const report = (where: string, error: unknown) => {
	// The same error recurs every frame: log each distinct one once.
	const key = `${where}:${error instanceof Error ? error.message : String(error)}`;
	if (reported.has(key)) return;
	reported.add(key);
	console.error(`[frameLoopGuard] ${where} threw; frame loop kept alive`, error);
};

type RafTask = { c: (now: number) => boolean; f: () => void };
const raf = svelteRaf as { tasks: Set<RafTask> };

const guardSvelteLoop = () => {
	const tasks = raf.tasks;
	const add = tasks.add.bind(tasks);
	tasks.add = (task: RafTask) => {
		const step = task.c;
		const fulfil = task.f;
		// false ends the task: run_tasks deletes it and calls f(), resolving the tween's promise.
		task.c = (now) => {
			try {
				return step(now);
			} catch (error) {
				report('svelte animation', error);
				return false;
			}
		};
		task.f = () => {
			try {
				fulfil();
			} catch (error) {
				report('svelte animation end', error);
			}
		};
		return add(task);
	};
};

const guardPixiTicker = () => {
	const proto = PIXI.TickerListener?.prototype as
		| { emit: (ticker: unknown) => unknown; next: unknown }
		| undefined;
	if (!proto?.emit) return;
	const emit = proto.emit;
	proto.emit = function (this: { next: unknown }, ticker: unknown) {
		try {
			return emit.call(this, ticker);
		} catch (error) {
			report('pixi ticker listener', error);
			// emit() returns the next listener in the chain; carry on with it.
			return this.next;
		}
	};
};

export const installFrameLoopGuard = () => {
	const scope = globalThis as Record<symbol, boolean>;
	if (scope[INSTALLED]) return;
	scope[INSTALLED] = true;
	guardSvelteLoop();
	guardPixiTicker();
};

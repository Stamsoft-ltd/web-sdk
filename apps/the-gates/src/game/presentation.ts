import type { Speed } from './uiPolicy';

/** Wait for an acknowledgement or optional auto-close. Own and clean up every timer. */
export function waitForDismissal(
	signal: AbortSignal,
	register: (dismiss: (() => void) | null) => void,
	autoCloseMs?: number,
): Promise<void> {
	return new Promise((resolve) => {
		let done = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = () => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			signal.removeEventListener('abort', finish);
			register(null);
			resolve();
		};
		signal.addEventListener('abort', finish, { once: true });
		if (signal.aborted) {
			finish();
			return;
		}
		if (autoCloseMs !== undefined) timer = setTimeout(finish, autoCloseMs);
		register(finish);
	});
}

/** Re-read a timing target during playback (Veggie Salad's live waitFor pattern).
 * A speed/skip press shortens the active wait, not only the next event.
 */
export function waitForTarget(target: () => number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const start = performance.now();
		let timer: ReturnType<typeof setTimeout>;
		const abort = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', abort);
			reject(new DOMException('Cancelled', 'AbortError'));
		};
		const tick = () => {
			const remaining = target() - (performance.now() - start);
			if (remaining <= 0) {
				signal.removeEventListener('abort', abort);
				resolve();
			} else timer = setTimeout(tick, Math.min(24, remaining));
		};
		if (signal.aborted) return abort();
		signal.addEventListener('abort', abort, { once: true });
		tick();
	});
}

/** Read the entry Keys before switching to the bonus backdrop/modal.
 * Even slam-stop retains a short trigger beat; reduced motion avoids a long pause. */
export const bonusEntryHold = (speed: Speed, reduced: boolean, skipped: boolean) =>
	reduced ? 150 : skipped ? 350 : speed === 'normal' ? 900 : 450;

/** Presentation only; unchanged event order and awards. Milliseconds. */
export const TIMING = {
	winHighlight: 360,
	progress: 80,
	gateOpen: 1100,
	gateReward: 1050,
	settle: 280,
	overlayGuard: 120,
	bonusGuard: 650,
	winAutoClose: 1800,
	capAutoClose: 2400,
} as const;

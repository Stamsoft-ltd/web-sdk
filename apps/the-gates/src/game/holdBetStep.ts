/** One step on press, then ~12 RGS-level steps/second while held. No wager dispatch here. */
export const BET_HOLD_DELAY_MS = 350;
export const BET_HOLD_INTERVAL_MS = 80;

export function holdBetStep(node: HTMLButtonElement, initialStep: () => void) {
	let step = initialStep;
	let pointer: number | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const stop = () => {
		clearTimeout(timer);
		timer = undefined;
		const id = pointer;
		pointer = null;
		if (id !== null && node.hasPointerCapture(id)) node.releasePointerCapture(id);
	};
	const repeat = () => {
		if (pointer === null || node.disabled || document.hidden) {
			stop();
			return;
		}
		step(); // Game re-checks spin/modal/autoplay guards and authoritative level bounds each time.
		timer = setTimeout(repeat, BET_HOLD_INTERVAL_MS);
	};
	const down = (event: PointerEvent) => {
		if (node.disabled || event.button !== 0 || !event.isPrimary || pointer !== null) return;
		event.preventDefault(); // No native image drag, selection or long-press gesture while stepping.
		pointer = event.pointerId;
		node.setPointerCapture(pointer);
		node.focus({ preventScroll: true });
		step();
		timer = setTimeout(repeat, BET_HOLD_DELAY_MS);
	};
	const release = (event: PointerEvent) => {
		if (event.pointerId === pointer) stop();
	};
	const click = (event: MouseEvent) => {
		// Pointer press already stepped. Keyboard/assistive clicks have detail=0 and still step once.
		if (event.detail !== 0) {
			event.preventDefault();
			event.stopImmediatePropagation();
		} else if (!node.disabled) step();
	};
	const visibility = () => {
		if (document.hidden) stop();
	};
	node.addEventListener('pointerdown', down);
	node.addEventListener('pointerup', release);
	node.addEventListener('pointercancel', release);
	node.addEventListener('lostpointercapture', stop);
	node.addEventListener('click', click);
	window.addEventListener('blur', stop);
	document.addEventListener('visibilitychange', visibility);
	return {
		update(next: () => void) {
			step = next;
		},
		destroy() {
			stop();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointerup', release);
			node.removeEventListener('pointercancel', release);
			node.removeEventListener('lostpointercapture', stop);
			node.removeEventListener('click', click);
			window.removeEventListener('blur', stop);
			document.removeEventListener('visibilitychange', visibility);
		},
	};
}

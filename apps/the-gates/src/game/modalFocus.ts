/** Focus/keyboard ownership for HTML modal overlays without a native-dialog top layer. */
export function installModalFocus(
	element: HTMLElement,
	{ close, locked = false }: { close: () => void; locked?: boolean },
) {
	const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const focusable = () =>
		[
			...element.querySelectorAll<HTMLElement>(
				'button:not(:disabled):not([hidden]),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])',
			),
		].filter((node) => node.getClientRects().length > 0);
	const focusFirst = () => (focusable()[0] ?? element).focus();
	const keyboard = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopImmediatePropagation();
			if (!locked) close();
		} else if (event.key === 'Tab') {
			const nodes = focusable(),
				first = nodes[0],
				last = nodes.at(-1);
			if (!first) {
				event.preventDefault();
				element.focus();
			} else if (
				event.shiftKey &&
				(document.activeElement === first || !element.contains(document.activeElement))
			) {
				event.preventDefault();
				last?.focus();
			} else if (
				!event.shiftKey &&
				(document.activeElement === last || !element.contains(document.activeElement))
			) {
				event.preventDefault();
				first.focus();
			}
		}
	};
	const focus = (event: FocusEvent) => {
		if (!element.contains(event.target as Node)) focusFirst();
	};
	document.addEventListener('keydown', keyboard, true);
	document.addEventListener('focusin', focus);
	focusFirst();
	return () => {
		document.removeEventListener('keydown', keyboard, true);
		document.removeEventListener('focusin', focus);
		if (prior?.isConnected) prior.focus();
	};
}

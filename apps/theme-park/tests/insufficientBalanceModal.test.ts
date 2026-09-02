// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { stateConfig, stateModal } from 'state-shared';
import { createEventEmitter } from 'utils-event-emitter';
// Not re-exported from the package index; the modal is normally mounted via <Modals>.
import ModalError from 'components-ui-html/src/components/ModalError.svelte';

import SocialI18nSync from '../src/components/SocialI18nSync.svelte';

// Two review findings meet in this modal, and both are invisible from the code that raises the
// error: it used to be a `persistent` Popup (no close button, no Escape, no click-away), which
// locked the player out of lowering the bet after an Insufficient Balance message; and its text was
// the raw English thrown by utils-xstate, so social mode leaked "FUNDS" and "BET".
// jsdom has no Web Animations API; Popup's blur transition calls it.
if (!Element.prototype.animate) {
	Element.prototype.animate = (() => ({
		cancel: () => {},
		finished: Promise.resolve(),
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as Element['animate'];
}

let mounted: ReturnType<typeof mount>[] = [];

// Popup mounts OnHotkey, which reads the emitter off Svelte context.
const context = () => new Map([['@@eventEmitter', createEventEmitter()]]);

const mountAll = (...components: Parameters<typeof mount>[0][]) => {
	components.forEach((component) => {
		mounted.push(mount(component, { target: document.body, context: context() }));
	});
	flushSync();
};

afterEach(async () => {
	for (const instance of mounted) await unmount(instance);
	mounted = [];
	stateModal.modal = null;
	stateConfig.jurisdiction.socialCasino = false;
	document.body.innerHTML = '';
});

describe('insufficient balance modal', () => {
	it('is dismissible so the player can lower the bet and keep playing', async () => {
		// SocialI18nSync activates the locale the modal's copy is looked up in.
		mountAll(SocialI18nSync, ModalError);
		await tick();
		stateModal.modal = {
			name: 'error',
			error: new Error('INSUFFICIENT FUNDS'),
			code: 'insufficientFunds',
			recoverable: true,
		};
		await tick();

		const close = document.querySelector('[data-test="close-button"]') as HTMLButtonElement | null;
		expect(close, 'a recoverable error must offer a way out').not.toBeNull();

		close!.click();
		await tick();
		expect(stateModal.modal).toBeNull();
	});

	it('keeps a fatal error persistent', async () => {
		mountAll(ModalError);
		stateModal.modal = { name: 'error', error: new Error('authenticate failed') };
		await tick();

		expect(document.querySelector('[data-test="error-content"]')).not.toBeNull();
		expect(document.querySelector('[data-test="close-button"]')).toBeNull();
	});

	it('renders the social wording instead of the raw thrown string', async () => {
		stateConfig.jurisdiction.socialCasino = true;
		mountAll(SocialI18nSync, ModalError);
		await tick();

		stateModal.modal = {
			name: 'error',
			// What utils-xstate throws. It must never reach the screen verbatim in social mode.
			error: new Error(
				'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.',
			),
			code: 'insufficientFunds',
			recoverable: true,
		};
		await tick();

		const text = document.querySelector('[data-test="error-content"]')?.textContent ?? '';
		expect(text).toContain('NOT ENOUGH BALANCE');
		expect(text).not.toMatch(/\bFUNDS\b/i);
		expect(text).not.toMatch(/\bBET\b/i);
	});
});

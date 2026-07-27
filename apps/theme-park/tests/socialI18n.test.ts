// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { stateConfig, stateI18nDerived } from 'state-shared';

import SocialI18nSync from '../src/components/SocialI18nSync.svelte';

let mounted: ReturnType<typeof mount> | null = null;

afterEach(async () => {
	if (mounted) await unmount(mounted);
	mounted = null;
	stateConfig.jurisdiction.socialCasino = false;
});

describe('social localization sync', () => {
	it('changes catalogs without creating a reactive update loop', async () => {
		stateConfig.jurisdiction.socialCasino = false;
		mounted = mount(SocialI18nSync, { target: document.body });
		flushSync();
		expect(stateI18nDerived.translate('BET')).toBe('BET');

		stateConfig.jurisdiction.socialCasino = true;
		await tick();
		expect(stateI18nDerived.translate('BET')).toBe('PLAY');
	});
});

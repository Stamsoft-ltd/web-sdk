<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| {
				type: 'freeSpinIntroUpdate';
				totalFreeSpins: number;
				/** How many scatters triggered the bonus — the "3x" on the badge (Figma 9248:25554). */
				scatters?: number;
		  };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import PressToContinue from './PressToContinue.svelte';
	import WonPanel from './WonPanel.svelte';

	// Free-spins-won screen — Figma 9276:31244 (3x) / 9276:31553 (4x) / 9276:31806 (5x). The popup
	// itself lives in WonPanel, which the bonus-end screen (FreeSpinOutro) shares.
	//
	// The screen names the bonus now instead of only counting its spins: one of three, each in its
	// own colour, with its rule underneath. Which one is `stateGame.bonusRoom`, NOT the scatter count
	// — a Mystery buy sets the room from the drawn mode, and its scatter count need not be the 3/4/5
	// that would otherwise pick the same room. Taking the room means the name on this screen and the
	// sky behind the bonus can never disagree.
	const ROOM = {
		bonus: { name: 'BUY DROP TITLE', desc: 'MYSTERY WON GRAVITY', color: 0xfb6cba },
		super: { name: 'BUY MEGA TITLE', desc: 'MYSTERY WON CORE', color: 0x1cb2fd },
		zero: { name: 'BUY ZERO TITLE', desc: 'MYSTERY WON ZERO', color: 0x91f835 },
	} as const;

	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let scatters = $state(0);
	let oncomplete = $state(() => {});

	/** The room is set before `freeSpinIntroShow` fires, so it is already right when this mounts. */
	const room = $derived(ROOM[context.stateGame.bonusRoom ?? 'bonus']);

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			scatters = emitterEvent.scatters ?? 0;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	<!-- No dim here: <BonusHandoffVeil> is already holding the design's 0.88 black over the whole
	     hand-off, and a second full-screen dim would stack with it to ~0.99. -->

	<MainContainer>
		<WonPanel
			{show}
			name={i18nDerived.translate(room.name)}
			nameColor={room.color}
			desc={i18nDerived.translateVars(room.desc, { count: freeSpinsFromEvent })}
			{scatters}
		/>
	</MainContainer>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>

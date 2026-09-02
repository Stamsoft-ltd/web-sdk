<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventFreeSpinOutro =
		| { type: 'freeSpinOutroShow' }
		| { type: 'freeSpinOutroHide' }
		| { type: 'freeSpinOutroCountUp'; amount: number; winLevelData: WinLevelData };
</script>

<script lang="ts">
	import { FadeContainer, WinCountUpProvider } from 'components-pixi';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { OnMount } from 'components-shared';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';
	import WonPanel from './WonPanel.svelte';

	// Bonus-end screen — Version2 (Figma node 7069-9311). Same popup as the free-spins intro (see
	// WonPanel) with the design's black/violet amount plate in place of the bare spin count.
	const context = getContext();

	// Hidden until freeSpinOutroShow — starting true meant the entry $effect never
	// fired on the session's FIRST outro (show never changed), so the panel just popped.
	let show = $state(false);
	let amount = $state(0);
	let winLevelData = $state<WinLevelData>();
	let oncomplete = $state(() => {});

	// This panel waits for a PRESS — it never dismisses itself (explicit product call). It used to
	// arm a 4.5s timer once the total had settled, because nothing downstream runs until this
	// resolves: freeSpinEnd's audio hand-off is behind it, so the win bed keeps looping and the base
	// music does not return until the player acts, and an unattended autoplay run parks here at the
	// end of every bonus. That is the accepted trade for letting the player read the total.
	let dismissed = false;

	// Single dismissal path, so a second press is a no-op (`dismissed` resets per panel).
	const dismiss = () => {
		if (dismissed) return;
		dismissed = true;
		oncomplete();
	};

	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => (show = true),
		freeSpinOutroHide: async () => {
			show = false;
		},
		freeSpinOutroCountUp: async (emitterEvent) => {
			dismissed = false;
			amount = emitterEvent.amount;
			winLevelData = emitterEvent.winLevelData;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	{#if winLevelData}
		<!-- The bonus total lands almost immediately rather than rolling up over the win level's
		     presentDuration (10s at mythic, 45s at the top tier). That long roll-up belongs to the
		     in-round win presentation, which has already played by the time this summary appears;
		     repeating it here just makes the player wait to read a number. The panel itself still
		     waits for PressToContinue, so nothing is cut short. -->
		{@const duration = 400}
		<!-- No oncomplete work: the panel never dismisses itself, so the roll-up finishing is not
		     a cue for anything — it just leaves the total on screen until the player presses. -->
		<WinCountUpProvider {amount} {duration} oncomplete={() => {}}>
			{#snippet children({ countUpAmount, startCountUp, finishCountUp, countUpCompleted })}
				<OnMount onmount={() => startCountUp()} />

				<!-- Matches the intro: the design blacks the game out almost completely behind this. -->
				<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.88} />

				<MainContainer>
					<WonPanel {show} plate big={bookEventAmountToCurrencyString(countUpAmount)} />
				</MainContainer>

				<PressToContinue onpress={() => (countUpCompleted ? dismiss() : finishCountUp())} />
			{/snippet}
		</WinCountUpProvider>
	{/if}
</FadeContainer>

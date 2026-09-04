<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'COMPONENTS/<Game>',
	});
</script>

<script lang="ts">
	import {
		StoryLocale,
		StoryGameTemplate,
		type TemplateArgs,
		templateArgs,
	} from 'components-storybook';

	import { loadDemandAssets } from 'pixi-svelte';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { eventEmitter } from '../game/eventEmitter';
	import { winLevelMap } from '../game/winLevelMap';

	setContext();
</script>

{#snippet template(args: TemplateArgs<any>)}
	<StoryGameTemplate
		skipLoadingScreen={args.skipLoadingScreen}
		action={async () => {
			await args.action?.(args.data);
		}}
	>
		<StoryLocale lang="en">
			<Game />
		</StoryLocale>
	</StoryGameTemplate>
{/snippet}

<Story name="component (loadingScreen)">
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</Story>

<Story
	name="emitterEvent: boardHide"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'boardHide' });
		},
	})}
	template={template as any}
/>

<!-- Big-win card (WinCard.svelte), one story per tier. The card is only reachable through a book
     that actually pays that much, which makes its entrance — plate up, texts down, saucer in from
     far away — awkward to iterate on; these drive it straight off the emitter instead. `amount` is
     in BOOK units (100 = 1x bet), and WinBoard picks the tier from the multiplier it implies.
     Written out one by one because Storybook's CSF indexer only sees literal <Story> tags — the
     same six wrapped in an {#each} index as nothing at all. -->

<Story
	name="emitterEvent: winShow (sweet)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'winShow' });
			eventEmitter.broadcast({
				type: 'winUpdate',
				amount: 30 * 100,
				winLevelData: winLevelMap[6],
			});
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: winShow (wild)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'winShow' });
			eventEmitter.broadcast({
				type: 'winUpdate',
				amount: 70 * 100,
				winLevelData: winLevelMap[7],
			});
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: winShow (epic)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'winShow' });
			eventEmitter.broadcast({
				type: 'winUpdate',
				amount: 150 * 100,
				winLevelData: winLevelMap[8],
			});
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: winShow (mythic)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'winShow' });
			eventEmitter.broadcast({
				type: 'winUpdate',
				amount: 300 * 100,
				winLevelData: winLevelMap[9],
			});
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: winShow (legendary)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'winShow' });
			eventEmitter.broadcast({
				type: 'winUpdate',
				amount: 900 * 100,
				winLevelData: winLevelMap[10],
			});
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: winShow (max)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			eventEmitter.broadcast({ type: 'winShow' });
			eventEmitter.broadcast({
				type: 'winUpdate',
				amount: 25000 * 100,
				winLevelData: winLevelMap[10],
			});
		},
	})}
	template={template as any}
/>

<!-- The MOTHERSHIP congratulations family (WonPanel.svelte + MysteryReveal.svelte, Figma
     9185:13916 / 9185:13975 / 9185:14033). All three draw `myPad` and its badges, which are
     deferDemand assets — in the real game a bonus book calls loadDemandAssets() long before these
     screens appear, so each story has to do the same or the pad renders as nothing. -->

<Story
	name="emitterEvent: freeSpinIntro (10 FREE SPINS)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			await loadDemandAssets();
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			eventEmitter.broadcast({ type: 'freeSpinIntroUpdate', totalFreeSpins: 10 });
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: freeSpinOutro (total)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			await loadDemandAssets();
			eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			eventEmitter.broadcast({
				type: 'freeSpinOutroCountUp',
				amount: 1234 * 100,
				winLevelData: winLevelMap[8],
			});
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: mysteryReveal (orb)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			await loadDemandAssets();
			eventEmitter.broadcast({ type: 'mysteryRevealShow' });
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: mysteryReveal (won gravity)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			await loadDemandAssets();
			eventEmitter.broadcast({ type: 'mysteryRevealShow' });
			eventEmitter.broadcast({ type: 'mysteryRevealWon', mode: 'BONUS', freeSpins: 10 });
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: mysteryReveal (won core)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			await loadDemandAssets();
			eventEmitter.broadcast({ type: 'mysteryRevealShow' });
			eventEmitter.broadcast({ type: 'mysteryRevealWon', mode: 'SUPER', freeSpins: 10 });
		},
	})}
	template={template as any}
/>

<Story
	name="emitterEvent: mysteryReveal (won zero)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			await loadDemandAssets();
			eventEmitter.broadcast({ type: 'mysteryRevealShow' });
			eventEmitter.broadcast({ type: 'mysteryRevealWon', mode: 'HIDDEN', freeSpins: 10 });
		},
	})}
	template={template as any}
/>

<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'DEBUG/sidePanels',
	});
</script>

<script lang="ts">
	import { StoryGameTemplate, StoryLocale, type TemplateArgs, templateArgs } from 'components-storybook';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { stateGame } from '../game/stateGame.svelte';
	import { eventEmitter } from '../game/eventEmitter';

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

<!-- Shows the deal-it right-strip panels statically: the selected-symbol card plus the
     bear-hand multiplier board (held in place), so their spacing can be inspected at any
     viewport size without playing a whole bonus book. -->
<Story
	name="dealItStrip"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			stateGame.gameType = 'superspin';
			stateGame.bonusMode = 'superspin';
			stateGame.selectedBonusSymbol = 'WOLF';
			// DEAL IT bonus board (GlobalMultiplier) — persistent, so spacing can be inspected.
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			eventEmitter.broadcast({ type: 'globalMultiplierUpdate', multiplier: 8 });
			// Deer presenter with an animal symbol (bust-framed card).
			eventEmitter.broadcast({ type: 'expandedPresenterShow', symbol: 'RABBIT' } as any);
		},
	})}
	template={template as any}
/>

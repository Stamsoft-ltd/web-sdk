<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'MODE_BASE/bookEvent',
	});
</script>

<script lang="ts">
	import {
		StoryGameTemplate,
		StoryLocale,
		type TemplateArgs,
		templateArgs,
	} from 'components-storybook';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { playBookEvent } from '../game/utils';
	import events from './data/base_events';

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

<Story
	name="reveal"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.reveal,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="setTotalWin"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.setTotalWin,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="freeSpinTrigger"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.freeSpinTrigger,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="updateFreeSpin"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.updateFreeSpin,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="winInfo"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.winInfo,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<!-- Win state + SWEET WIN big-win presentation, to verify winning symbols keep animating there. -->
<Story
	name="sweet win (animals)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.setWin,
		action: async () => {
			await playBookEvent(events.revealAnimals as any, { bookEvents: [events.revealAnimals] as any });
			await playBookEvent(events.winInfoAnimals as any, { bookEvents: [] });
			await playBookEvent(events.setWin as any, { bookEvents: [] });
		},
	})}
	{template}
/>

<!-- Expanded WOLF symbol (new win video + bamboo/vine column frame from Figma). -->
<Story
	name="expand (WOLF)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.expandedWolf,
		action: async (data) => await playBookEvent(data as any, { bookEvents: [] }),
	})}
	{template}
/>

<!-- All 5 animals on the board, every visible cell driven into its win animation, so the new
	 win videos can be reviewed side by side. -->
<Story
	name="win animals (all)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.winInfoAnimals,
		action: async () => {
			await playBookEvent(events.revealAnimals as any, { bookEvents: [events.revealAnimals] as any });
			await playBookEvent(events.winInfoAnimals as any, { bookEvents: [] });
		},
	})}
	{template}
/>

<Story
	name="setWin"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.setWin,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="freeSpinEnd"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.freeSpinEnd,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="finalWin"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.finalWin,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

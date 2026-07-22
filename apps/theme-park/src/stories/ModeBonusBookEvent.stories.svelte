<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'MODE_BONUS/bookEvent',
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
	import events from './data/bonus_events';

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
	name="freeSpinTrigger (roller)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.freeSpinTrigger,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="freeSpinTrigger (coaster)"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.freeSpinTriggerCoaster,
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
	name="freeSpinEnd"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.freeSpinEnd,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="wincap"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.wincap,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="duckPickStart"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.duckPickStart,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="duckPick"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.duckPick,
		action: async (data) => {
			await playBookEvent(events.duckPickStart, { bookEvents: [] });
			await playBookEvent(data, { bookEvents: [] });
			await playBookEvent(events.duckPickMultMult, { bookEvents: [] });
		},
	})}
	{template}
/>

<Story
	name="duckPickEnd"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.duckPickEnd,
		action: async (data) => {
			await playBookEvent(events.duckPickStart, { bookEvents: [] });
			await playBookEvent(events.duckPick, { bookEvents: [] });
			await playBookEvent(data, { bookEvents: [] });
		},
	})}
	{template}
/>

<Story
	name="coasterSetup"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.coasterSetup,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

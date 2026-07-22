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
	name="winInfo"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.winInfo,
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
	name="setWin"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.setWin,
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

<Story
	name="duckCollectStart"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.duckCollectStart,
		action: async (data) => await playBookEvent(data, { bookEvents: [] }),
	})}
	{template}
/>

<Story
	name="duckReveal"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.duckReveal,
		action: async (data) => {
			await playBookEvent(events.duckCollectStart, { bookEvents: [] });
			await playBookEvent(data, { bookEvents: [] });
		},
	})}
	{template}
/>

<Story
	name="duckCollectEnd"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.duckCollectEnd,
		action: async (data) => {
			await playBookEvent(events.duckCollectStart, { bookEvents: [] });
			await playBookEvent(events.duckReveal, { bookEvents: [] });
			await playBookEvent(data, { bookEvents: [] });
		},
	})}
	{template}
/>

<Story
	name="rollerWildsApply"
	args={templateArgs({
		skipLoadingScreen: true,
		data: events.rollerWildsApply,
		action: async (data) => {
			await playBookEvent(events.revealRollerWilds, { bookEvents: [] });
			await playBookEvent(data, { bookEvents: [] });
		},
	})}
	{template}
/>

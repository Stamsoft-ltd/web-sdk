<script lang="ts" module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'MODE_BONUS/book',
	});
</script>

<script lang="ts">
	import {
		StoryGameTemplate,
		StoryLocale,
		type TemplateArgs,
		templateArgs,
	} from 'components-storybook';
	import { randomInteger } from 'utils-shared/random';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { playBet } from '../game/utils';
	import type { Bet } from '../game/typesBookEvent';
	import books, { bookFor } from './data/bonus_books';

	setContext();

	const playBook = async (book: (typeof books)[number]) =>
		await playBet({ ...book, state: book.events } as unknown as Bet);
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
	name="random"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => {
			const index = randomInteger({ min: 0, max: books.length - 1 });
			console.log('Running a book at index', index);
			await playBook(books[index]);
		},
	})}
	{template}
/>

<Story
	name="duck your luck"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => await playBook(bookFor('duck')),
	})}
	{template}
/>

<Story
	name="roller wilds bonus"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => await playBook(bookFor('roller')),
	})}
	{template}
/>

<Story
	name="mega coaster bonus"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => await playBook(bookFor('coaster')),
	})}
	{template}
/>

<Story
	name="wincap"
	args={templateArgs({
		skipLoadingScreen: true,
		data: {},
		action: async () => await playBook(bookFor('wincap')),
	})}
	{template}
/>

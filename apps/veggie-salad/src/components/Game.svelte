<script lang="ts">
	import { Modals } from 'components-ui-html';
	import { EnableHotkey } from 'components-shared';
	import { stateMeta, stateUi } from 'state-shared';

	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import VeggieSaladPrototype from './prototype/VeggieSaladPrototype.svelte';

	const symbol = (name: string) => `./assets/veggie-salad/symbols/${name}.png`;

	stateMeta.betModeMeta = {
		BASE: {
			mode: 'BASE',
			costMultiplier: 1,
			type: 'default',
			parent: '',
			children: '',
			maxWin: 25000,
			assets: {
				icon: symbol('tomato'),
				volatility: '',
				button: '',
				dialogImage: symbol('tomato'),
				dialogVolatility: symbol('corn'),
			},
			text: {
				title: 'BASE GAME',
				dialog:
					'7×7 cluster game. Five or more matching vegetables connected horizontally or vertically win.',
				button: 'PLAY',
				tickerIdle: 'PLACE YOUR BET',
				tickerSpin: 'GOOD LUCK',
			},
		},
		CHANCE: {
			mode: 'CHANCE',
			costMultiplier: 2,
			type: 'activate',
			parent: '',
			children: '',
			maxWin: 25000,
			assets: {
				icon: symbol('scatter'),
				volatility: '',
				button: '',
				dialogImage: symbol('scatter'),
				dialogVolatility: symbol('carrot'),
			},
			text: {
				title: 'EXTRA CHANCE',
				dialog: '2× cost. Bonus activation is three times more likely.',
				description: '3× higher bonus chance',
				button: 'ACTIVATE',
				tickerIdle: 'EXTRA CHANCE ACTIVE',
				tickerSpin: 'GOOD LUCK',
			},
		},
		FEATURE: {
			mode: 'FEATURE',
			costMultiplier: 20,
			// activate, not buy: FEATURE stays armed until the player switches it off, and the shared
			// autoplay/bet plumbing only force-resets 'buy' modes after a round.
			type: 'activate',
			parent: '',
			children: '',
			maxWin: 25000,
			assets: {
				icon: symbol('broccoli'),
				volatility: '',
				button: '',
				dialogImage: symbol('broccoli'),
				dialogVolatility: symbol('carrot'),
			},
			text: {
				title: 'FEATURE SPIN',
				dialog:
					'20× cost per spin while active. Guarantees at least one winning cluster and increases multiplier chance.',
				description: 'Guaranteed cluster',
				button: 'ACTIVATE',
				tickerIdle: 'FEATURE SPIN',
				tickerSpin: 'FEATURE ACTIVE',
			},
		},
		BONUS: {
			mode: 'BONUS',
			costMultiplier: 100,
			type: 'buy',
			parent: '',
			children: '',
			maxWin: 25000,
			assets: {
				icon: symbol('tomato'),
				volatility: '',
				button: '',
				dialogImage: symbol('scatter'),
				dialogVolatility: symbol('tomato'),
			},
			text: {
				title: 'NORMAL BONUS',
				dialog: '10 free spins on an expanded 8×8 grid.',
				description: '8×8 grid · 10 free spins',
				button: 'BUY',
				tickerIdle: 'NORMAL BONUS',
				tickerSpin: 'BONUS ACTIVE',
			},
		},
		MYSTERY: {
			mode: 'MYSTERY',
			costMultiplier: 300,
			type: 'buy',
			parent: '',
			children: '',
			maxWin: 25000,
			assets: {
				icon: symbol('scatter'),
				volatility: '',
				button: '',
				dialogImage: symbol('scatter'),
				dialogVolatility: symbol('onion'),
			},
			text: {
				title: 'MYSTERY BONUS',
				dialog: 'Randomly awards Normal, Super, or the exclusive Hidden Bonus.',
				description: '60% Normal · 30% Super · 10% Hidden',
				button: 'BUY',
				tickerIdle: 'MYSTERY BONUS',
				tickerSpin: 'MYSTERY ACTIVE',
			},
		},
		SUPER: {
			mode: 'SUPER',
			costMultiplier: 400,
			type: 'buy',
			parent: '',
			children: '',
			maxWin: 25000,
			assets: {
				icon: symbol('corn'),
				volatility: '',
				button: '',
				dialogImage: symbol('corn'),
				dialogVolatility: symbol('scatter'),
			},
			text: {
				title: 'SUPER BONUS',
				dialog: '10 free spins on a larger 9×9 grid with stronger cluster potential.',
				description: '9×9 grid · 10 free spins',
				button: 'BUY',
				tickerIdle: 'SUPER BONUS',
				tickerSpin: 'SUPER ACTIVE',
			},
		},
	};

	stateMeta.gameRuleMeta.gameRules = [
		{
			title: 'GAME RULES',
			rows: 4,
			columns: 1,
			containers: [
				{
					title: 'CLUSTER PAYS',
					text: 'Wins form from 5 or more matching symbols connected horizontally or vertically. Diagonal symbols do not connect.',
					image: symbol('broccoli'),
					row: 0,
					column: 0,
					imagePosition: 'left',
				},
				{
					title: 'TUMBLES',
					text: 'Winning symbols are removed. New symbols tumble into the empty positions and wins are evaluated again until no new cluster forms.',
					image: symbol('tomato'),
					row: 1,
					column: 0,
					imagePosition: 'left',
				},
				{
					title: 'MULTIPLIERS',
					text: 'Random 2× and 4× multipliers may appear. All multiplier values contained in a winning cluster multiply together and apply to that cluster win.',
					image: symbol('corn'),
					row: 2,
					column: 0,
					imagePosition: 'left',
				},
				{
					title: 'BONUSES',
					text: '3 scatters trigger Normal Bonus on 8×8. 4 scatters trigger Super Bonus on 9×9. Hidden Bonus uses 10×10 and is available naturally or through Mystery Bonus.',
					image: symbol('scatter'),
					row: 3,
					column: 0,
					imagePosition: 'left',
				},
			],
		},
	];

	stateMeta.gameRuleMeta.payTable = [
		{
			title: 'FEATURES',
			rows: 3,
			columns: 2,
			containers: [
				{
					title: 'EXTRA CHANCE',
					text: '2× bet · 3× higher bonus chance.',
					image: symbol('scatter'),
					row: 0,
					column: 0,
					imagePosition: 'left',
				},
				{
					title: 'FEATURE SPIN',
					text: '20× bet · guaranteed winning cluster with increased multiplier chance.',
					image: symbol('broccoli'),
					row: 0,
					column: 1,
					imagePosition: 'left',
				},
				{
					title: 'NORMAL BONUS',
					text: '100× bet · 10 free spins on an 8×8 grid.',
					image: symbol('tomato'),
					row: 1,
					column: 0,
					imagePosition: 'left',
				},
				{
					title: 'SUPER BONUS',
					text: '400× bet · 10 free spins on a 9×9 grid.',
					image: symbol('corn'),
					row: 1,
					column: 1,
					imagePosition: 'left',
				},
				{
					title: 'MYSTERY BONUS',
					text: '300× bet · 60% Normal, 30% Super, 10% Hidden.',
					image: symbol('onion'),
					row: 2,
					column: 0,
					imagePosition: 'left',
				},
				{
					title: 'MAX WIN',
					text: 'Maximum win is 25,000× total bet.',
					image: symbol('carrot'),
					row: 2,
					column: 1,
					imagePosition: 'left',
				},
			],
		},
	];
</script>

<EnableGameActor />
<EnableHotkey />
<VeggieSaladPrototype />

{#if stateUi.config.mode !== 'replay'}
	<ResumeBet />
{/if}

<Modals />

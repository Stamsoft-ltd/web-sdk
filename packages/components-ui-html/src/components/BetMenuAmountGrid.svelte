<script lang="ts">
	import { OptionsGrid } from 'components-shared';
	import { getContextLayout } from 'utils-layout';
	import { stateBet, stateConfig } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	import BaseIcon from './BaseIcon.svelte';
	import BaseButtonContent from './BaseButtonContent.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	const { stateLayoutDerived } = getContextLayout();
	const count = $derived(stateLayoutDerived.layoutType() === 'landscape' ? 15 : 18);
	const options = $derived(
		[
			...stateConfig.betMenuOptions.slice(0, count - 1),
			...stateConfig.betMenuOptions.slice(-1),
		].filter((value, index, array) => array.indexOf(value) === index),
	); //always includes last, and without duplicate

	const isMaxValue = (value: number) => value === options[options.length - 1];

	// A chip is a wallet amount, so it carries the currency's own symbol and its own decimal count.
	// This used to be a bare `toFixed(2)` with a K/M abbreviation and no symbol, which is wrong three
	// ways on Stake's currency table: JPY/KRW/IDR have 0 decimals and the Gulf dinars have 3, and an
	// abbreviated "1.00K" is not the exact amount the round will cost. (Stake rejected a sibling game
	// for a balance carrying one digit too many; the bet-selector list is on the same checklist.)
	const formatValue = (value: number) => numberToCurrencyString(Math.abs(value));

	// The chips are small and the full string can now be 10-12 characters ("1,000.00 kr", "S/1000.00").
	// Step the face down rather than let it overflow the circle; 1rem is the design size and stays
	// the size for everything short.
	const labelFontSize = (label: string) =>
		label.length > 10 ? '0.68rem' : label.length > 8 ? '0.8rem' : '1rem';
</script>

<OptionsGrid
	value={stateBet.betAmount}
	{options}
	onchange={(value) => (stateBet.betAmount = value)}
>
	{#snippet option({ option })}
		<BaseIcon
			width="100%"
			height="2rem"
			border={option === stateBet.betAmount ? '2px white solid' : '2px black solid'}
		/>
		<BaseButtonContent>
			{@const label = isMaxValue(option) ? i18nDerived.max() : formatValue(option)}
			<span class="amount" style="font-size: {labelFontSize(label)};">{label}</span>
		</BaseButtonContent>
	{/snippet}
</OptionsGrid>

<style lang="scss">
	.amount {
		white-space: nowrap;
	}
</style>

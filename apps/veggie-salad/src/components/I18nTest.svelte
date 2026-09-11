<script lang="ts">
	import { Container, Rectangle, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
</script>

<Container x={300} alpha={0.5}>
	<Rectangle width={280} height={160} />
	<Text text={'TRANSLATIONS TEST'} style={{ fill: 0xffffff, fontFamily: 'Jersey 10, monospace' }} />
	<Text
		text={`${context.i18nDerived.home()} (from game)`}
		style={{ fill: 0xffffff, fontFamily: 'Jersey 10, monospace' }}
		y={30}
	/>
	<Text
		text={`${context.i18nDerived.settings()} (from ui-pixi)`}
		style={{ fill: 0xffffff, fontFamily: 'Jersey 10, monospace' }}
		y={60}
	/>
	<Text
		text={`${context.i18nDerived.masterVolume()} (from ui-html)`}
		style={{ fill: 0xffffff, fontFamily: 'Jersey 10, monospace' }}
		y={90}
	/>
	<Text
		text={`${context.i18nDerived.notTranslated()}`}
		style={{ fill: 0xffffff, fontFamily: 'Jersey 10, monospace' }}
		y={120}
	/>
</Container>

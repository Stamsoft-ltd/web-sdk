<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import Game from '../components/Game.svelte';
	import SocialI18nSync from '../components/SocialI18nSync.svelte';
	import { setContext } from '../game/context';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	// NOTE: the template's <LoaderStakeEngine> boot overlay is deliberately absent — the Stake
	// review requires the game to ship no Stake Engine branding, and that component's only job was
	// to hold a Stake Engine gif over the screen for 2s before our own LoadingScreen took over.
	setContext();
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<SocialI18nSync />
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

{@render props.children()}
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';

	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import messagesMap from '../i18n/messagesMap';
	import SocialI18nSync from '../components/SocialI18nSync.svelte';

	type Props = { children: Snippet };
	const props: Props = $props();

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

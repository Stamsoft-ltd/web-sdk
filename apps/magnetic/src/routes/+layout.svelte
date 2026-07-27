<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoaderStakeEngine, LoadI18n } from 'components-shared';
	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';
	import { stateApp } from '../game/stateApp';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	const loaderUrlStakeEngine = './stake-engine-loader.gif';

	setContext();
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<!-- Keep the branded loader up until the game is actually loaded (not a fixed timer) so it never
     hands off to a black/blank screen before pixi can render. -->
<LoaderStakeEngine src={loaderUrlStakeEngine} ready={stateApp.loaded} />

{@render props.children()}
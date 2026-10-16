<script lang="ts">
	import { tick } from 'svelte';
	import { stateConfig } from 'state-shared';
	import { COSTS, PAYS, SYMBOLS } from '../game/contract';
	import { ART_ROOT, UI_ART_ROOT } from '../game/art';
	import {
		RULES_PAGES,
		RULE_FEATURES,
		RULE_OVERVIEW,
		RULE_BUY_INFO,
		RULE_WIN_METHODS,
		RULE_BUYS,
		RULE_CONTROLS,
		rulesPageIndex,
	} from '../game/rulesPages';
	import { t } from '../i18n';
	import Symbol from './Symbol.svelte';
	import Icon from './Icon.svelte';
	import OptionsIcon from './OptionsIcon.svelte';
	import RulesFrame from './RulesFrame.svelte';
	import RulesArrow from './RulesArrow.svelte';
	import FigmaLogo from './FigmaLogo.svelte';
	let page = $state(0);
	let availableWidth = $state(900);
	let availableHeight = $state(440);
	let content: HTMLDivElement;
	const overview = [...RULE_OVERVIEW, { title: 'INFO MAX WIN', copy: 'INFO MAX WIN COPY' }];
	const controls = $derived(
		RULE_CONTROLS.filter(
			(item) =>
				!(item.art === 'auto' && stateConfig.jurisdiction.disabledAutoplay) &&
				!(item.art === 'speed' && stateConfig.jurisdiction.disabledTurbo) &&
				!(item.art === 'bonus' && stateConfig.jurisdiction.disabledBuyFeature) &&
				!(item.art === 'fullscreen' && stateConfig.jurisdiction.disabledFullscreen) &&
				!(item.art === 'space' && stateConfig.jurisdiction.disabledSpacebar),
		),
	);
	const narrow = $derived(availableWidth < 540);
	const scrollable = $derived(narrow || availableHeight < 420);
	const itemCount = $derived(
		page === 0
			? overview.length
			: page === 1
				? PAYS.length
				: page === 2
					? RULE_FEATURES.length
					: page === 3
						? RULE_WIN_METHODS.length
						: page === 4
							? RULE_BUYS.length
							: page === 5
								? 2
								: controls.length,
	);
	const capacity = $derived(itemCount);
	const start = 0;
	const cardCount = $derived(Math.min(capacity, itemCount - start));
	const columns = $derived(narrow ? 1 : Math.min(3, cardCount));
	const rows = $derived(Math.ceil(cardCount / columns));
	const cardWidth = $derived(
		Math.max(
			1,
			Math.min(
				(availableWidth - (columns - 1) * 12 - 16) / columns,
				scrollable ? Infinity : (((availableHeight - (rows - 1) * 12 - 16) / rows) * 1121) / 922,
				narrow ? 380 : 300,
			),
		),
	);
	function measure(node: HTMLElement) {
		const observer = new ResizeObserver(() => {
			availableWidth = node.clientWidth;
			availableHeight = node.clientHeight;
		});
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}
	// Fit actual translated text to its available region; never crop or scroll a card.
	function fitCopy(node: HTMLElement, _key?: string) {
		let busy = false;
		let dead = false;
		const fit = () => {
			if (busy || dead) return;
			busy = true;
			node.style.fontSize = '';
			const base = parseFloat(getComputedStyle(node).fontSize);
			let size = base;
			while (node.scrollHeight > node.clientHeight + 1 && size > 9) {
				size -= 0.25;
				node.style.fontSize = `${size}px`;
			}
			busy = false;
		};
		const observer = new ResizeObserver(fit);
		observer.observe(node);
		void document.fonts.ready.then(fit);
		return {
			update: () => {
				void tick().then(fit);
			},
			destroy: () => {
				dead = true;
				observer.disconnect();
			},
		};
	}
	async function move(direction: number) {
		page = rulesPageIndex(page, direction);
		await tick();
		content.scrollTop = 0;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			event.stopPropagation();
			void move(event.key === 'ArrowRight' ? 1 : -1);
		}
	}}
/>

<section class="rules-book" aria-label={t('PAYTABLE')}>
	<header class="rules-heading">
		<h2 id="rules-page-title" class:feature-heading={page === 2}>{t(RULES_PAGES[page])}</h2>
		{#if page === 0}<div class="rules-brand"><FigmaLogo /></div>{/if}
	</header>
	<p class="rules-rtp">{t('RULES RTP')}</p>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="rules-page"
		class:scrollable
		use:measure
		style:--card-width={`${cardWidth}px`}
		style:--card-columns={columns}
		bind:this={content}
		data-rules-page={page + 1}
		role="region"
		aria-labelledby="rules-page-title"
		tabindex="0"
	>
		{#if page === 0}
			<div class="rules-overview">
				{#each overview.slice(start, start + capacity) as item}<section
						class="overview-section"
						use:fitCopy={String(start)}
					>
						<h3>{t(item.title)}</h3>
						<p>{t(item.copy)}</p>
					</section>{/each}
			</div>
		{:else if page === 1}
			<table class="rules-paytable">
				<thead
					><tr
						><th scope="col">{t('SYMBOL')}</th><th scope="col">8–9</th><th scope="col">10–11</th><th
							scope="col">12+</th
						></tr
					></thead
				><tbody>
					{#each PAYS.slice(start, start + capacity) as pays, offset}{@const i = start + offset}<tr
							><th scope="row"
								><div class="rules-symbol-label" data-pay-symbol={SYMBOLS[i]}>
									<div class="rules-symbol"><Symbol name={SYMBOLS[i]} decorative fit /></div>
									<span>{t(`SYMBOL ${SYMBOLS[i]}`)}</span>
								</div></th
							>{#each pays as pay}<td>{pay.toFixed(2)}×</td>{/each}</tr
						>{/each}
				</tbody>
			</table>
			<p>{t('PAYS NOTE')}</p>
		{:else if page === 2 || page === 3}
			<div class="rules-cards native-cards">
				{#each (page === 2 ? RULE_FEATURES : RULE_WIN_METHODS).slice(start, start + capacity) as item}<article
					>
						<h3>{t(item.title)}</h3>
						<div
							class="card-copy"
							use:fitCopy={page === 4 ? String(start) : String(page) + start}
							role="region"
							aria-label={t(item.title)}
						>
							<p>{t(item.copy)}</p>
						</div>
					</article>{/each}
			</div>
		{:else if page === 4}
			<div class="rules-cards native-cards">
				{#each RULE_BUYS.slice(start, start + capacity) as mode}<article>
						<h3>{t(RULE_BUY_INFO[mode].title)}</h3>
						<strong>{COSTS[mode]}× {t('BET')}</strong>
						<div
							class="card-copy"
							use:fitCopy={page === 4 ? String(start) : String(page) + start}
							role="region"
							aria-label={t(mode)}
						>
							<p>{t(RULE_BUY_INFO[mode].copy)}</p>
						</div>
					</article>{/each}
			</div>
		{:else if page === 5}
			<div class="rules-cards general-cards">
				{#if start === 0}<article>
						<RulesFrame />
						<h3>{t('INTERRUPTED ROUNDS')}</h3>
						<div
							class="general-copy"
							use:fitCopy={String(start)}
							role="region"
							aria-label={t('INTERRUPTED ROUNDS')}
						>
							<p>{t('INTERRUPTED CONTINUE')}</p>
							<p>{t('INTERRUPTED WAGERS')}</p>
						</div>
					</article>
				{/if}{#if start + capacity > 1}<article>
						<RulesFrame />
						<h3>{t('LEGAL NOTICE')}</h3>
						<div
							class="general-copy"
							use:fitCopy={String(start)}
							role="region"
							aria-label={t('LEGAL NOTICE')}
						>
							{#each ['LEGAL CONNECTION', 'LEGAL DISPLAY', 'LEGAL SETTLEMENT'] as key}<p>
									{t(key)}
								</p>{/each}
						</div>
					</article>{/if}
			</div>
		{:else}
			<div class="rules-controls">
				{#each controls.slice(start, start + capacity) as item}
					{#if !(item.art === 'auto' && stateConfig.jurisdiction.disabledAutoplay) && !(item.art === 'speed' && stateConfig.jurisdiction.disabledTurbo) && !(item.art === 'bonus' && stateConfig.jurisdiction.disabledBuyFeature)}<article
						>
							<div class="control-art">
								{#if item.art === 'spin'}<img
										src={`${UI_ART_ROOT}f05f2.svg`}
										alt=""
									/>{:else if item.art === 'menu'}<img
										src={`${ART_ROOT}hud/menu.png`}
										alt=""
									/>{:else if item.art === 'bonus'}<span class="guide-bonus"
										><img src={`${ART_ROOT}hud/bonus-button-blank.png`} alt="" /><span
											>{t('BONUS BUTTON')}</span
										></span
									>{:else if item.art === 'speed'}<img
										src={`${UI_ART_ROOT}c8de1.svg`}
										alt=""
									/>{:else if item.art === 'auto'}<img
										src={`${ART_ROOT}hud/autoplay-en.png`}
										alt=""
									/>{:else if item.art === 'info'}<img
										src={`${ART_ROOT}hud/info.png`}
										alt=""
									/>{:else if item.art === 'bet-plus'}<img src={`${UI_ART_ROOT}19460.svg`} alt="" />
								{:else if item.art === 'bet-minus'}<img
										src={`${ART_ROOT}hud/bet-decrease.png`}
										alt=""
									/>
								{:else if item.art === 'previous' || item.art === 'next' || item.art === 'close'}<span
										class="guide-circle"
										>{#if item.art === 'close'}×{:else}<RulesArrow
												next={item.art === 'next'}
											/>{/if}</span
									>
								{:else if item.art === 'sound' || item.art === 'music'}<OptionsIcon
										name={item.art}
									/>{:else}<Icon name="settings" />{/if}
							</div>
							<h3>{t(item.title)}</h3>
							<p>{t(item.copy)}</p>
						</article>{/if}
				{/each}
			</div>
		{/if}
	</div>
	<nav class="rules-navigation" aria-label={t('RULES NAVIGATION')}>
		<button
			class="icon-button"
			aria-label={t('PREVIOUS PAGE')}
			disabled={page === 0}
			onclick={() => move(-1)}><RulesArrow /></button
		><button
			class="icon-button"
			aria-label={t('NEXT PAGE')}
			disabled={page === RULES_PAGES.length - 1}
			onclick={() => move(1)}><RulesArrow next /></button
		><span role="status"
			>{t('PAGE')}
			{page + 1}/{RULES_PAGES.length}</span
		>
	</nav>
</section>

<style>
	.rules-book {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		color: white;
	}
	.rules-heading {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex: none;
		min-height: 56px;
		padding: 0 90px 12px;
	}
	.rules-heading h2 {
		color: white;
		font-size: clamp(20px, 3vw, 32px);
		line-height: 1.2;
	}
	.rules-brand {
		position: absolute;
		right: 0;
		top: 0;
		width: 76px;
		height: 44px;
	}
	.rules-brand :global(.figma-logo) {
		transform: scale(0.38);
		transform-origin: top left;
	}
	.rules-page {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		overscroll-behavior: contain;
		padding: 8px 12px 16px;
		scrollbar-gutter: stable;
	}
	.rules-page p {
		font:
			500 14px/1.5 GatesBody,
			Arial,
			sans-serif;
		margin: 0 0 14px;
	}
	.overview-section {
		margin-bottom: 22px;
	}
	.rules-rtp {
		text-align: center;
	}
	.rules-overview {
		max-width: 760px;
		margin: 20px auto;
		text-align: center;
	}
	.rules-paytable {
		width: min(700px, 100%);
		margin: 0 auto 10px;
		border-collapse: collapse;
		font:
			14px GatesBody,
			Arial,
			sans-serif;
	}
	.rules-paytable th,
	.rules-paytable td {
		padding: 2px 10px;
		border-bottom: 1px solid #45618b66;
		text-align: center;
	}
	.rules-paytable thead {
		color: #ffdc12;
	}
	.rules-symbol-label {
		display: flex;
		align-items: center;
		gap: 10px;
		text-align: left;
		font:
			12px/1.2 Arial,
			sans-serif;
	}
	.rules-symbol-label .rules-symbol {
		flex: none;
	}
	.rules-symbol {
		width: 32px;
		height: 32px;
		margin: auto;
	}
	.rules-cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 16px;
		max-width: 880px;
		margin-inline: auto;
		padding: 8px 0 16px;
	}
	.rules-cards article {
		position: relative;
		isolation: isolate;
		flex: 0 1 calc((100% - 32px) / 3);
		padding: 26px;
		min-width: 0;
	}
	.rules-cards article::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: url('./assets/the-gates/figma-20261013/d883a.png') center / 115.87% 122.81%
			no-repeat;
	}

	h3 {
		font:
			18px/1.2 GatesCartoon,
			system-ui;
		color: #ffdc12;
		margin: 0 0 12px;
		text-transform: uppercase;
	}
	.rules-cards strong {
		display: block;
		margin-bottom: 10px;
		color: #ffdc12;
		font-family: GatesCartoon, system-ui;
	}
	/* Fixed native visible-art ratio. Copy fits inside; cards never resize to text. */
	.native-cards {
		max-width: 780px;
		align-items: flex-start;
	}
	.native-cards article {
		flex: 0 0 calc((100% - 32px) / 3);
		aspect-ratio: 1121 / 922;
		min-height: 0;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		padding: 20px 24px;
	}
	.native-cards article::before {
		background-size: 117.66% 129.39%;
	}
	.native-cards h3 {
		flex: none;
		font-size: 15px;
		margin-bottom: 8px;
	}
	.native-cards .card-copy {
		min-height: 0;
		overflow: hidden;
		overscroll-behavior: contain;
	}
	.general-cards {
		align-items: flex-start;
		gap: 20px;
		max-width: 780px;
	}
	.general-cards article {
		display: flex;
		flex-direction: column;
		flex: 0 0 35%;
		aspect-ratio: 320 / 480;
		min-height: 0;
		overflow: hidden;
		box-sizing: border-box;
		padding: 30px 26px;
		text-align: center;
	}
	.general-cards article::before {
		display: none;
	}
	.general-cards article:last-child {
		flex-basis: calc(65% - 20px);
		aspect-ratio: 565 / 480;
	}

	.general-copy {
		min-height: 0;
		overflow: hidden;
		overscroll-behavior: contain;
	}
	.general-cards h3 {
		flex: none;
		font-size: clamp(20px, 2.5vw, 28px);
		-webkit-text-stroke: 3px #051e3d;
		paint-order: stroke fill;
	}

	.rules-controls {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 20px;
		padding: 18px 0;
	}
	.rules-controls article {
		min-width: 0;
	}
	.rules-controls h3 {
		font-size: 16px;
	}
	.rules-controls p {
		font-size: 12px;
	}
	.control-art {
		height: 58px;
		margin-bottom: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.control-art img {
		max-width: 90px;
		max-height: 58px;
		object-fit: contain;
	}
	.guide-bonus {
		position: relative;
		display: grid;
		place-items: center;
		width: 90px;
		height: 44px;
	}
	.guide-bonus > img {
		width: 100%;
	}
	.guide-bonus > span {
		position: absolute;
		color: white;
		font:
			12px GatesCartoon,
			system-ui;
		text-transform: uppercase;
		-webkit-text-stroke: 2px #071e35;
		paint-order: stroke fill;
	}
	.guide-circle {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 2px solid #ffdc12;
		border-radius: 50%;
		background: #063e91;
		color: white;
		font:
			30px/1 Arial,
			sans-serif;
	}
	.control-art :global(svg) {
		width: 40px;
		height: 40px;
	}
	.rules-navigation {
		position: relative;
		display: flex;
		gap: 12px;
		align-items: center;
		justify-content: center;
		flex: none;
		padding: 10px 80px 0;
	}
	.rules-navigation button {
		padding: 0;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		min-height: 44px;
		border: 2px solid #ffdc12;
		background: #063e91;
		color: white;
		font:
			30px/1 Arial,
			sans-serif;
	}
	.rules-navigation button :global(.rules-arrow) {
		width: 27px;
		height: 15px;
		object-fit: contain;
	}
	.rules-navigation span {
		position: absolute;
		right: 0;
		bottom: 12px;
		font:
			12px GatesBody,
			Arial,
			sans-serif;
		color: #d4e3f7;
	}
	@media (max-width: 650px) {
		.rules-heading {
			padding: 0 0 14px;
		}
		.rules-brand {
			display: none;
		}
		.rules-cards article,
		.general-cards article:first-child,
		.general-cards article:last-child {
			flex-basis: 100%;
			max-width: 380px;
		}
		.rules-controls {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.rules-page {
			padding: 8px 4px;
		}
		.rules-navigation {
			padding-inline: 50px;
		}
	}
	@media (max-height: 500px) {
		.rules-heading {
			min-height: 36px;
		}
		.rules-heading h2 {
			font-size: 22px;
		}
		.overview-section {
			margin-bottom: 22px;
		}
		.rules-rtp {
			text-align: center;
		}
		.rules-overview {
			margin: 0 auto;
		}
		.rules-navigation button {
			width: 44px;
			height: 44px;
		}
	}

	/* Every sheet fits the viewport; navigation advances the remaining content. */
	.rules-page {
		overflow: hidden;
		padding: 0;
		scrollbar-gutter: auto;
	}
	.rules-overview {
		height: 100%;
		display: grid;
		align-content: stretch;
		grid-auto-rows: minmax(0, 1fr);
		gap: 10px;
		margin: 0 auto;
	}
	.overview-section h3 {
		font-size: 16px;
		margin-bottom: 6px;
	}
	.overview-section p {
		margin-bottom: 0;
	}
	.overview-section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		font:
			700 14px/1.5 GatesBody,
			sans-serif;
		min-height: 0;
		overflow: hidden;
		margin: 0;
	}
	.rules-cards {
		height: 100%;
		padding: 0;
		gap: 12px;
		align-content: center;
	}
	.native-cards {
		max-width: none;
	}
	.native-cards article {
		flex: 0 0 var(--card-width);
		width: var(--card-width);
		max-width: none;
		padding: 20px 22px;
	}
	.native-cards .card-copy,
	.general-copy {
		overflow: hidden;
		font:
			800 12px/1.35 GatesBody,
			sans-serif;
	}
	.overview-section p,
	.card-copy p,
	.general-copy p {
		font: inherit !important;
	}
	.general-cards {
		max-width: none;
		align-items: center;
		flex-wrap: nowrap;
	}
	.general-cards article {
		flex: 0 0 auto !important;
		width: min(35%, calc((100cqh - 16px) * 320 / 480));
		max-height: 100%;
		padding: 24px;
	}
	.general-cards article:last-child {
		width: min(62%, calc((100cqh - 16px) * 565 / 480));
	}
	.rules-page {
		container-type: size;
	}
	.rules-controls {
		height: 100%;
		box-sizing: border-box;
		align-content: center;
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}
	.rules-page[data-rules-page='2'] {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.rules-paytable {
		font-size: 12px;
	}
	.rules-page[data-rules-page='2'] > p {
		flex: none;
		font-size: 11px;
		margin: 8px 0 0;
	}
	@media (max-width: 650px) {
		.general-cards article,
		.general-cards article:last-child {
			width: min(100%, calc((100cqh - 12px) * 320 / 480));
		}
		.general-cards article:last-child {
			aspect-ratio: 320 / 480;
		}
		.rules-controls {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.rules-heading {
			min-height: 40px;
			padding-bottom: 8px;
		}
		.rules-navigation {
			padding-top: 8px;
		}
		.rules-navigation span {
			font-size: 9px;
			bottom: 0;
		}
	}
	@media (max-height: 500px) {
		.rules-heading {
			min-height: 24px;
			padding-bottom: 4px;
		}
		.rules-heading h2 {
			font-size: 18px;
		}
		.rules-navigation {
			padding-top: 4px;
		}
		.rules-navigation button {
			width: 32px;
			height: 32px;
			min-height: 32px;
		}
		.rules-controls {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 6px;
		}
		.native-cards article {
			padding: 16px 20px;
		}
		.native-cards h3 {
			font-size: 12px;
			margin-bottom: 5px;
		}
		.overview-section p {
			font-size: 12px;
		}
	}

	@media (max-height: 500px) {
		.rules-heading h2 {
			font-size: clamp(14px, 4.5vh, 20px);
		}
		.overview-section h3 {
			font-size: clamp(12px, 3.8vh, 16px);
			margin-bottom: 5px;
		}
		.overview-section {
			font-size: clamp(10px, 3.2vh, 13px);
			line-height: 1.3;
		}
		.rules-page p {
			font-size: inherit;
		}
		.rules-navigation button {
			width: 28px;
			height: 28px;
			min-height: 28px;
		}
		.rules-navigation button :global(.rules-arrow) {
			width: 19px;
			height: 11px;
		}
		.rules-navigation span {
			font-size: 9px;
			bottom: 8px;
		}
	}

	/* Small viewports scroll whole semantic pages, never create extra sheets. */
	.rules-page.scrollable {
		overflow-y: auto;
		overflow-x: hidden;
		display: block;
		padding: 4px 8px 12px;
	}
	.scrollable .rules-overview,
	.scrollable .rules-cards,
	.scrollable .rules-controls {
		height: auto;
		align-content: start;
	}
	.scrollable .rules-overview {
		grid-auto-rows: auto;
		gap: 20px;
	}
	.scrollable .overview-section {
		overflow: visible;
	}
	.scrollable .rules-cards {
		flex-wrap: wrap;
	}
	.scrollable .general-cards article,
	.scrollable .general-cards article:last-child {
		width: min(100%, 360px);
		max-height: none;
	}
	.scrollable .rules-controls {
		grid-auto-rows: auto;
	}
	.scrollable .rules-paytable {
		min-height: 420px;
	}

	.rules-rtp {
		flex: none;
		margin: 0 0 8px;
		text-align: center;
		font:
			700 clamp(9px, 1.2vw, 12px) / 1.25 GatesBody,
			sans-serif;
	}
</style>

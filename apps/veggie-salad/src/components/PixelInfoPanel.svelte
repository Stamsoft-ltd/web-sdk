<script lang="ts">
	import { stateBet, stateI18nDerived, stateMeta } from 'state-shared';
	import { numberToCurrencyString } from 'utils-shared/amount';

	type Props = { onclose: () => void };
	const props: Props = $props();
	const t = (key: string) => stateI18nDerived.translate(key);
	// Portrait decor: the design's slot (placement class) → the board sprite drawn in it, matched
	// by silhouette — tall radish where the carrot stood, round garlic for the cauliflower.
	const INFO_VEG = [
		['carrot', 'radish'],
		['cauliflower', 'garlic'],
		['corn', 'pepper-shades'],
		['radish', 'eggplant'],
		['broccoli', 'cabbage-shades'],
	] as const;

	const pages = $derived(stateMeta.gameRuleMeta.infoPages ?? []);
	let index = $state(0);
	const page = $derived(pages[Math.min(index, Math.max(0, pages.length - 1))]);
	const step = (delta: number) => {
		if (!pages.length) return;
		index = (index + delta + pages.length) % pages.length;
	};
	/* Drag-to-scroll for the page scroller. In portrait the page body is an overflow scroller,
	   and a wheel or a native touch pan moves it — but the pages still could not be scrolled
	   where the user tested ("still we need scroll" / "its not scrolable", 2026-09-17), and a
	   MOUSE drag on a phone-shaped window moves nothing in any browser. So any pointer drag on
	   the body moves it by hand. This never fights native panning: the moment the browser takes
	   a touch drag as its own pan it fires pointercancel and this lets go, so it only keeps
	   driving the scroll where native panning never starts. */
	const SCROLLER = '.info-main, .pay-wrap, .rule-grid, .ui-grid';
	const scrollerAt = (target: EventTarget | null) =>
		target instanceof Element ? target.closest<HTMLElement>(SCROLLER) : null;
	const dragScroll = (panel: HTMLElement) => {
		let scroller: HTMLElement | null = null;
		let pointer = -1;
		let startY = 0;
		let startTop = 0;
		const down = (event: PointerEvent) => {
			const target = scrollerAt(event.target);
			if (!target || target.scrollHeight <= target.clientHeight) return;
			scroller = target;
			pointer = event.pointerId;
			startY = event.clientY;
			startTop = target.scrollTop;
			if (event.pointerType === 'mouse') {
				// No text selection or image drag under a mouse drag; the drag keeps reporting to
				// the panel once the cursor leaves it.
				event.preventDefault();
				panel.setPointerCapture(event.pointerId);
			}
		};
		const move = (event: PointerEvent) => {
			if (!scroller || event.pointerId !== pointer) return;
			const delta = event.clientY - startY;
			// Under the browser's own pan threshold nothing moves, so a tap stays a tap.
			if (Math.abs(delta) > 4) scroller.scrollTop = startTop - delta;
		};
		const end = (event: PointerEvent) => {
			if (event.pointerId === pointer) scroller = null;
		};
		panel.addEventListener('pointerdown', down);
		panel.addEventListener('pointermove', move);
		panel.addEventListener('pointerup', end);
		panel.addEventListener('pointercancel', end);
		return {
			destroy() {
				panel.removeEventListener('pointerdown', down);
				panel.removeEventListener('pointermove', move);
				panel.removeEventListener('pointerup', end);
				panel.removeEventListener('pointercancel', end);
			},
		};
	};
	/* The arrow keys page the scroller too, so a keyboard reaches everything the pages hold. */
	const scrollBy = (delta: number) => {
		const scroller = document.querySelector<HTMLElement>(`.info-panel :is(${SCROLLER})`);
		if (!scroller) return false;
		scroller.scrollBy({ top: delta * scroller.clientHeight * 0.6, behavior: 'smooth' });
		return true;
	};
	const onkeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') props.onclose();
		else if (event.key === 'ArrowLeft') step(-1);
		else if (event.key === 'ArrowRight') step(1);
		else if (event.key === 'ArrowDown' && scrollBy(1)) event.preventDefault();
		else if (event.key === 'ArrowUp' && scrollBy(-1)) event.preventDefault();
	};
	/* The design prints the RTP stat on an amber pill and every other stat as a plain amber value.
	   The pill is picked by the value's own shape (a percentage) so it survives every locale's
	   rendering of the label. */
	const isRtp = (value: string) => /%\s*$/.test(value);
	/* Design 9043:10866 prints the paytable in money for the bet in play, not in multipliers — its
	   own frame shows $1.00 against the 1× row at a $1.00 bet. The page data carries multiplier
	   strings ("1.75×"), so each is read back to a number and priced at the live bet; anything that
	   does not parse is printed through untouched. */
	const payCellText = (value: string) => {
		const multiplier = Number.parseFloat(value);
		if (!Number.isFinite(multiplier)) return value;
		return numberToCurrencyString(multiplier * stateBet.betAmount);
	};
	/* Only the overview (9025:7456) carries the game logo in its head; every other page, the paytable
	   included since its 2026-09-16 redraw, prints the title alone. */
	const showLogo = $derived(page?.kind === 'overview');
	const infoDir = './assets/veggie-salad/pixel/info';
	/* Rule copy keeps the design's own line breaks, and the Mystery card's odds ("60%") are set
	   bold amber (Nunito ExtraBold #f2a52f in 9044:14901).
	   Faces: every heading the design draws in Jersey 10 stays Jersey 10 (the app-wide default);
	   every piece of copy the design sets in Nunito goes on `.font-nunito` (Nunito Sans, variable
	   weight, declared in app.html) at the design's own size and weight. */
	const isOdds = (chunk: string) => /^\d+%$/.test(chunk);
</script>

{#snippet copy(text: string)}
	{#each text.split('\n') as line, lineIndex (lineIndex)}
		{#if line === ''}
			<span class="copy-gap"></span>
		{:else}
			<span class="copy-line"
				>{#each line.split(/(\d+%)/) as chunk, chunkIndex (chunkIndex)}{#if isOdds(chunk)}<em
							>{chunk}</em
						>{:else}{chunk}{/if}{/each}</span
			>
		{/if}
	{/each}
{/snippet}

<svelte:window {onkeydown} />

<!-- Design 9025:7456 (overview) and 9043:10866 (paytable). Both frames are 1200x670 and the panel
     renders x90..1109 by y48..622 — a 1020x575 field of #321D02 inside a 4px #935901 border. Every
     size below is that frame's own measurement expressed against the panel's width, so the page
     scales as one piece: 1 design px is 100/1020 cqw. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="info-scrim" role="presentation" onclick={props.onclose}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		class="info-panel"
		role="dialog"
		aria-modal="true"
		use:dragScroll
		onclick={(e) => e.stopPropagation()}
	>
		<button
			type="button"
			class="info-close font-copy"
			aria-label={t('CLOSE')}
			onclick={props.onclose}>×</button
		>
		{#if page}
			<div class="info-head">
				<h2>{page.title}</h2>
				{#if showLogo}
					<img class="info-logo" src="./assets/veggie-salad/pixel/logo-px.webp" alt="" />
				{/if}
			</div>

			{#if page.kind === 'paytable' && page.payoutHead && page.payouts}
				<div class="pay-wrap">
					<div class="pay-grid" style="--cols:{page.payoutHead.cols.length}">
						<span class="pay-cell pay-head pay-symbol">{page.payoutHead.symbol}</span>
						{#each page.payoutHead.cols as col (col)}
							<span class="pay-cell pay-head">{col}</span>
						{/each}
						{#each page.payouts as row (row.name)}
							<span class="pay-cell pay-symbol"><img src={row.icon} alt={row.name} /></span>
							{#each row.values as value, valueIndex (valueIndex)}
								<span class="pay-cell pay-value font-nunito">{payCellText(value)}</span>
							{/each}
						{/each}
					</div>
					{#if page.cards?.length}
						{@const scatter = page.cards[0]}
						<!-- 9043:11918: a 173x395 card — Jersey 18 title, the scatter symbol at 88px, then the
						     design's own copy in Nunito Medium 12 across 144px. -->
						<article class="pay-special">
							<h3>{scatter.title}</h3>
							<img src={scatter.icon} alt="" />
							<p class="font-nunito">{@render copy(scatter.text)}</p>
						</article>
					{/if}
				</div>
			{:else if page.kind === 'features' || page.kind === 'ways'}
				<!-- 9044:14121 sets six 315px cards in two rows; 9044:14661 three 295px cards over a
				     605px + 290px row. The six-track grid gives both rows of the second page their own
				     column widths from one set of tracks. -->
				<div class="rule-grid rule-grid--{page.kind}">
					{#each page.cards ?? [] as card, cardIndex (cardIndex)}
						<article class="rule-card">
							<h3>{card.title}</h3>
							<p class="font-nunito">{@render copy(card.text)}</p>
						</article>
					{/each}
				</div>
			{:else if page.kind === 'featurebuy'}
				<div class="rule-grid rule-grid--buy">
					{#each page.cards ?? [] as card, cardIndex (cardIndex)}
						<article class="rule-card buy-card">
							<h3>{card.title}</h3>
							{#if card.icon}<img src={card.icon} alt="" />{/if}
							<p class="font-nunito">{@render copy(card.text)}</p>
						</article>
					{/each}
				</div>
			{:else if page.kind === 'general'}
				<div class="rule-grid rule-grid--general">
					{#each page.cards ?? [] as card, cardIndex (cardIndex)}
						<article class="rule-card general-card">
							{#if card.icon}<img src={card.icon} alt="" />{/if}
							<h3>{card.title}</h3>
							<p class="font-nunito">{@render copy(card.text)}</p>
						</article>
					{/each}
				</div>
			{:else if page.kind === 'uiguide'}
				<div class="ui-grid">
					{#each page.cards ?? [] as card, cardIndex (cardIndex)}
						<article class="ui-card">
							<span class="ui-disc" class:ui-disc--gold={card.theme === 'gold'}>
								{#if card.icon}<img src={card.icon} alt="" />{/if}
							</span>
							<h3>{card.title}</h3>
							<p class="font-nunito">{card.text}</p>
						</article>
					{/each}
				</div>
			{:else}
				<div class="info-main">
					{#if page.body}
						<p class="info-body font-nunito">
							{#each page.body.split('\n') as line, lineIndex (lineIndex)}
								{line}<br />
							{/each}
						</p>
					{/if}
					{#if page.stats?.length}
						<dl class="info-stats font-nunito">
							{#each page.stats as stat (stat.label)}
								<dt>{stat.label}:</dt>
								<dd class:pill={isRtp(stat.value)}>{stat.value}</dd>
							{/each}
						</dl>
					{/if}
					{#if page.cards?.length}
						<div class="info-cards" style="--count:{Math.min(4, page.cards.length)}">
							{#each page.cards.slice(0, 8) as card (card.title)}
								<article class="info-card">
									<h3>{card.title}</h3>
									<p class="font-nunito">{@render copy(card.text)}</p>
								</article>
							{/each}
						</div>
					{/if}
				</div>
				{#if page.kind === 'overview'}
					<!-- The flat basket the bonus outro used to be. That picture is now eight loose
					     layers so the vegetables can move independently, so this still is recomposed
					     from exactly those layers at their own placements — one picture, two uses. -->
					<img
						class="info-basket"
						src="./assets/veggie-salad/pixel/overlays/v2/congrats/basket-v2.webp"
						alt=""
					/>
					<!-- Portrait only (9262:230493): five symbols lean in over the panel's side edges
					     instead of the basket, each a tilted square the panel's overflow clips. The
					     slots keep the design's names; the art is the board's current set. -->
					{#each INFO_VEG as [slot, art] (slot)}
						<img
							class="info-veg info-veg--{slot}"
							src="./assets/veggie-salad/pixel/board/{art}.webp"
							alt=""
						/>
					{/each}
				{/if}
			{/if}

			<nav class="info-nav">
				<button type="button" aria-label={t('INFO CTRL PREV')} onclick={() => step(-1)}>
					<img src="{infoDir}/nav_arrow.svg" alt="" />
				</button>
				<button type="button" aria-label={t('INFO CTRL NEXT')} onclick={() => step(1)}>
					<img class="info-nav-next" src="{infoDir}/nav_arrow.svg" alt="" />
				</button>
			</nav>
			<span class="info-page font-nunito">{t('INFO PAGE')} {index + 1}/{pages.length}</span>
		{/if}
	</div>
</div>

<style>
	.info-scrim {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: grid;
		place-items: center;
		padding: 2vh 2vw;
		background: rgb(6 3 0 / 62%);
	}
	.info-panel {
		container-type: inline-size;
		position: relative;
		box-sizing: border-box;
		width: min(1020px, 85vw, calc((100vh - 4vh) * 1.774));
		aspect-ratio: 1020 / 575;
		border: 4px solid #935901;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		/* The design closes the page with a strip holding the arrows and the page counter; content
		   (the paytable's last row ends at y486 of 575) stops there rather than running under them. */
		padding-bottom: 8cqw;
		border-radius: 1.2cqw;
		background: #321d02;
		font-family: 'Jersey 10', monospace;
	}
	.info-main {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	/* The close disc sits outside the panel's top-right corner in the design, clear of the border. */
	.info-close {
		position: absolute;
		top: -2.35cqw;
		right: -6.5cqw;
		display: grid;
		place-items: center;
		width: 4.8cqw;
		height: 4.8cqw;
		padding: 0;
		border: 1px solid #935901;
		border-radius: 50%;
		background: #361e01;
		color: #f2cb8c;
		font-size: 3.2cqw;
		line-height: 1;
		cursor: pointer;
	}
	/* Every page title: Jersey 10 at 45px (#f2a52f, +1.35px tracking) in a 48px box whose top sits
	   26px under the panel's edge. */
	.info-head {
		display: grid;
		place-items: center;
		padding: 2.55cqw 0 0;
	}
	.info-head h2 {
		margin: 0;
		color: #f2a52f;
		font-size: 4.41cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 4.7cqw;
	}
	.info-logo {
		position: absolute;
		top: 2.2cqw;
		right: 1.5cqw;
		width: 25cqw;
		height: auto;
		image-rendering: pixelated;
	}
	/* 9025:7683: Nunito Medium 15 across 614px, 22px under the title box. */
	.info-body {
		margin: 2.16cqw auto 0;
		width: 60.2cqw;
		color: #f2cb8c;
		font-size: 1.47cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		line-height: 2cqw;
		text-align: center;
	}
	/* 9025:7697/7701: a right-aligned Nunito Medium 15 label against a left-aligned Lilita One value
	   (set here in Nunito Sans 800) in 37px rows, the RTP value alone on an amber 110x37 pill. The
	   pair's seam sits 9px right of the panel's centre line. */
	.info-stats {
		position: relative;
		left: 0.88cqw;
		display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: center;
		gap: 0.69cqw 0.78cqw;
		margin: 1.96cqw 0 0;
	}
	.info-stats dt {
		grid-column: 1;
		justify-self: end;
		color: #f2cb8c;
		font-size: 1.47cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
	}
	.info-stats dd {
		grid-column: 2;
		justify-self: start;
		box-sizing: border-box;
		min-height: 3.63cqw;
		margin: 0;
		padding: 0.98cqw;
		color: #ffba3e;
		font-size: 1.47cqw;
		font-weight: 800;
		line-height: 1.67cqw;
		white-space: nowrap;
	}
	.info-stats dd.pill {
		min-width: 10.8cqw;
		border-radius: 0.69cqw;
		background: #e38b01;
		color: #fff;
		text-align: center;
	}
	/* 9025:7684: two 199x168 cards 8px apart, 30px under the RTP row. */
	.info-cards {
		display: grid;
		grid-template-columns: repeat(var(--count, 2), 19.5cqw);
		gap: 0.78cqw;
		justify-content: center;
		margin: 2.94cqw 0 0;
	}
	.info-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		min-height: 16.5cqw;
		padding: 2.65cqw 1cqw 1cqw;
		border: 1px solid #935901;
		border-radius: 1.27cqw;
		background: #442601;
		text-align: center;
	}
	.info-card h3 {
		margin: 0 0 1.08cqw;
		color: #e38b01;
		font-size: 2.35cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1;
	}
	.info-card p {
		margin: 0;
		width: 14cqw;
		color: #f2cb8c;
		font-size: 1.18cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1.6cqw;
	}
	/* The leaning vegetables are the portrait overview's dressing only. */
	.info-veg {
		display: none;
	}
	/* The basket leans on the panel's bottom-left corner, half of it behind the cards row. */
	.info-basket {
		position: absolute;
		bottom: 0;
		left: 0.2cqw;
		width: 33cqw;
		height: auto;
		pointer-events: none;
		image-rendering: pixelated;
	}
	/* 9043:11599 + 9043:11918: a 775px table and a 173px card, 10px apart, from y90 of the panel. */
	.pay-wrap {
		display: grid;
		grid-template-columns: 75.95cqw 16.96cqw;
		gap: 0.98cqw;
		justify-content: center;
		margin-top: 1.57cqw;
	}
	/* 102px symbol column, then eleven pay columns; 45.8px cells 4.8px apart. */
	.pay-grid {
		display: grid;
		grid-template-columns: 10.04cqw repeat(var(--cols, 11), minmax(0, 1fr));
		gap: 0.47cqw;
		align-content: start;
	}
	.pay-cell {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		height: 4.49cqw;
		border: 1px solid #935901;
		border-radius: 0.94cqw;
		background: #442601;
		color: #f2cb8c;
	}
	/* Column heads: Jersey 10 at 24px. Prices: Nunito Medium 14. */
	.pay-cell.pay-head {
		color: #f2a52f;
		font-size: 2.35cqw;
		letter-spacing: 0.03em;
	}
	.pay-value {
		font-size: 1.37cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
	}
	.pay-symbol img {
		width: 4.1cqw;
		height: auto;
		image-rendering: pixelated;
	}
	.pay-special {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		height: 38.7cqw;
		padding: 2.06cqw 1cqw 1cqw;
		border: 1px solid #935901;
		border-radius: 0.78cqw;
		background: #442601;
		text-align: center;
	}
	.pay-special h3 {
		margin: 0;
		color: #f2a52f;
		font-size: 1.76cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1;
	}
	.pay-special img {
		width: 8.63cqw;
		height: auto;
		margin: 1.76cqw 0;
		image-rendering: pixelated;
	}
	.pay-special p {
		margin: 0;
		width: 14.1cqw;
		color: #f2cb8c;
		font-size: 1.18cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		line-height: 1.6cqw;
	}
	/* Two 48px discs of #361e01, 13.6px apart, centred 20px above the panel's foot (9044:14121). */
	.info-nav {
		position: absolute;
		bottom: 1.8cqw;
		left: 50%;
		display: flex;
		gap: 1.33cqw;
		transform: translateX(-50%);
	}
	.info-nav button {
		display: grid;
		place-items: center;
		width: 4.7cqw;
		height: 4.7cqw;
		padding: 0;
		border: 1px solid #935901;
		border-radius: 50%;
		background: #361e01;
		cursor: pointer;
	}
	.info-nav img {
		width: 2cqw;
		height: auto;
	}
	/* The design's Union glyph is drawn pointing left; NEXT mirrors it. */
	.info-nav-next {
		transform: scaleX(-1);
	}
	.info-nav button:hover,
	.info-nav button:focus-visible {
		background: #442601;
		outline: 0;
	}
	/* 9025:7721: a 12px Medium counter whose box ends 17px from the right edge and 16px from the
	   foot. The design draws it in Poppins; the user asked for Nunito here too (2026-09-16). */
	.info-page {
		position: absolute;
		right: 1.67cqw;
		bottom: 1.57cqw;
		color: #fff;
		font-size: 1.18cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		line-height: 1.76cqw;
	}

	/* ---- Rule pages. Every grid is the design's own box: left edge, top and width measured on the
	   1021x575 panel, so 1px = 0.098cqw. Rows are minimums so a longer translation grows its card
	   instead of clipping. */
	.rule-grid {
		position: absolute;
		left: 50%;
		display: grid;
		transform: translateX(-50%);
	}
	.rule-grid--features {
		top: 8.05cqw;
		width: 93.5cqw;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: minmax(21.1cqw, auto) minmax(20.3cqw, auto);
		gap: 0.7cqw 0.4cqw;
	}
	.rule-grid--ways {
		top: 9.7cqw;
		width: 89.1cqw;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		grid-template-rows: minmax(17.5cqw, auto) minmax(18.2cqw, auto);
		gap: 1.2cqw 1.18cqw;
	}
	.rule-grid--ways > :nth-child(-n + 3),
	.rule-grid--ways > :nth-child(5) {
		grid-column: span 2;
	}
	.rule-grid--ways > :nth-child(4) {
		grid-column: span 4;
	}
	.rule-grid--buy {
		top: 16.65cqw;
		width: 88.4cqw;
		grid-template-columns: 219fr 219fr 439fr;
		grid-template-rows: minmax(23.1cqw, auto);
		gap: 1.18cqw;
	}
	.rule-grid--general {
		top: 9cqw;
		width: 74.7cqw;
		grid-template-columns: 235fr 512fr;
		grid-template-rows: minmax(38.4cqw, auto);
		gap: 1.57cqw;
	}
	.rule-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		min-width: 0;
		padding: 1.2cqw 1cqw 0.9cqw;
		border: 1px solid #935901;
		border-radius: 1.27cqw;
		background: #442601;
		text-align: center;
	}
	.rule-card h3 {
		margin: 0 0 0.6cqw;
		color: #f2a52f;
		font-size: 2.35cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1;
	}
	/* Rule copy is Nunito Regular 11.24px (+0.34px tracking) on every card of 9044:14121, 14661 and
	   14901; the design's paragraph breaks are kept as half-line gaps so the longest cards (RANDOM
	   MULTIPLIER, HIDDEN BONUS) stay inside the design's row heights. */
	.rule-card p {
		margin: 0;
		width: 95%;
		color: #f2cb8c;
		font-size: 1.1cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1.5cqw;
	}
	.copy-line,
	.copy-gap {
		display: block;
	}
	.copy-gap {
		height: 0.5em;
	}
	.rule-card em {
		color: #f2a52f;
		font-style: normal;
		font-weight: 800;
	}
	.buy-card {
		padding-top: 2.4cqw;
	}
	.buy-card img {
		height: 6.6cqw;
		width: auto;
		margin: 0.9cqw 0 1.1cqw;
	}
	.buy-card p {
		width: 88%;
	}
	.general-card {
		justify-content: center;
	}
	.general-card img {
		height: 6.6cqw;
		width: auto;
	}
	.general-card:last-child img {
		height: 8.3cqw;
	}
	.general-card h3 {
		margin: 1.7cqw 0 1cqw;
		line-height: 1.05;
	}
	/* 9044:14931: INTERRUPTED ROUNDS copy is 10px Medium (#fbeace) across 194px; the LEGAL NOTICE
	   paragraph is Nunito Medium 12 across 389px. */
	.general-card p {
		width: 82%;
		color: #fbeace;
		font-size: 0.98cqw;
		font-weight: 500;
		line-height: 1.35cqw;
	}
	.general-card:last-child p {
		width: 76%;
		font-size: 1.18cqw;
		line-height: 1.6cqw;
	}

	/* ---- User interface guide (9044:15707): five 175x137 cards per row, 8px apart. */
	.ui-grid {
		position: absolute;
		top: 9.3cqw;
		left: 50%;
		display: grid;
		width: 88.6cqw;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		grid-auto-rows: 13.4cqw;
		gap: 0.78cqw;
		transform: translateX(-50%);
	}
	.ui-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.55cqw;
		box-sizing: border-box;
		min-width: 0;
		padding: 0.6cqw;
		border: 1px solid #935901;
		border-radius: 0.7cqw;
		background: #442601;
		text-align: center;
	}
	.ui-disc {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		width: 4.7cqw;
		height: 4.7cqw;
		border: 1px solid #935901;
		border-radius: 50%;
		background: #361e01;
	}
	.ui-disc img {
		width: 2.2cqw;
		height: auto;
	}
	.ui-disc--gold {
		border: 0.25cqw solid #925a06;
		background: #e48c00;
	}
	.ui-disc--gold img {
		width: 2.7cqw;
	}
	.ui-card h3 {
		margin: 0;
		color: #f2cb8c;
		font-size: 1.57cqw;
		font-weight: 400;
		letter-spacing: 0.03em;
		line-height: 1;
	}
	/* 9044:12278: Nunito Medium 10 under a Jersey 16 label. */
	.ui-card p {
		margin: 0;
		width: 94%;
		color: #f2cb8c;
		font-size: 0.98cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		line-height: 1.35cqw;
	}
	/* ---- Portrait, designs 9262:230493 (overview) and 9266:230946 (paytable). The panel is a
	   337x508 card on the 360 frame, 54px under the game's top edge with the close disc above its
	   right corner; 1 design px is 100/337 cqw, kept in --d. Pages without a portrait design stack
	   their cards in one column inside a scrolling body. */
	@media (orientation: portrait) {
		/* The design drops the card 54px under the wordmark; the wordmark is under the scrim
		   anyway, so the card takes the same box as the game's other portrait panels (the bonus
		   menu: 8px in from every edge) and the height goes to the pages — "make the height a
		   little bit higher so it fits all text" (user, 2026-09-18). */
		.info-scrim {
			--info-edge: 8px;
			align-content: start;
			padding: var(--info-edge) 0;
			background: rgb(35 35 35 / 49%);
		}
		/* The design's 337x508 card is the panel's WIDTH; its height is whatever the phone has
		   left under the top offset, so a tall shell gets a taller page rather than a card with
		   the HUD showing under it, and less of each page is hidden behind the scroll — "make it
		   bigger in height" (user, 2026-09-17). */
		.info-panel {
			--d: calc(100cqw / 337);
			width: calc(100vw - 2 * var(--info-edge));
			height: calc(100svh - 2 * var(--info-edge));
			aspect-ratio: auto;
			grid-template-rows: auto minmax(0, 1fr);
			padding-bottom: calc(42 * var(--d));
			border-width: 2px;
			border-radius: calc(7.6 * var(--d));
			overflow: hidden;
		}
		/* The design hangs a 36px disc 39px ABOVE the panel, but on the phone the strip above the
		   panel is the host's, and the disc was out of view there ("also x button", user
		   2026-09-17). It sits on the panel's top-right corner instead, the same disc in the same
		   spot as the bonus menu's ("like in all other popups", 2026-09-18). */
		.info-close {
			top: 4px;
			right: 4px;
			z-index: 1;
			width: calc(40 * var(--d));
			height: calc(40 * var(--d));
			font-size: calc(26 * var(--d));
		}
		/* Jersey 10 at 32 (#f2a52f, +0.96 tracking), its box 21px under the panel's top; side
		   padding clears the close disc, so a long title wraps under it rather than behind it. */
		.info-head {
			padding: calc(19 * var(--d)) calc(46 * var(--d)) 0;
		}
		.info-head h2 {
			font-size: calc(32 * var(--d));
			line-height: calc(36 * var(--d));
			text-align: center;
		}
		.info-logo {
			display: none;
		}
		/* The page body is the scroller: it fills the grid's second row and the pages that run
		   past it (the feature cards, general info, the UI guide) scroll inside it. The scrollbar
		   is drawn thin in the frame's colour and the foot fades out so the cut-off is visibly a
		   scroll edge, not the end of the page — "some places are out of visibility" (user,
		   2026-09-17). `pan-y` keeps the panel's own touch gesture from ever being claimed by the
		   game underneath. */
		.info-main,
		.pay-wrap,
		.rule-grid,
		.ui-grid {
			position: static;
			min-height: 0;
			padding-bottom: calc(14 * var(--d));
			overflow-y: auto;
			overscroll-behavior: contain;
			touch-action: pan-y;
			transform: none;
			user-select: none;
			mask-image: linear-gradient(#000 calc(100% - 14 * var(--d)), transparent);
		}
		/* The bar is drawn through the WebKit pseudo-elements alone: styling those turns the
		   platform's auto-hiding overlay bar into one that is always on screen, which is the
		   whole point — and Chrome ignores them once `scrollbar-width`/`scrollbar-color` are set,
		   so those two stay unset. */
		.info-main::-webkit-scrollbar,
		.pay-wrap::-webkit-scrollbar,
		.rule-grid::-webkit-scrollbar,
		.ui-grid::-webkit-scrollbar {
			width: 5px;
		}
		.info-main::-webkit-scrollbar-track,
		.pay-wrap::-webkit-scrollbar-track,
		.rule-grid::-webkit-scrollbar-track,
		.ui-grid::-webkit-scrollbar-track {
			background: rgb(255 255 255 / 8%);
		}
		.info-main::-webkit-scrollbar-thumb,
		.pay-wrap::-webkit-scrollbar-thumb,
		.rule-grid::-webkit-scrollbar-thumb,
		.ui-grid::-webkit-scrollbar-thumb {
			border-radius: 2px;
			background: #935901;
		}
		/* Overview: Nunito Medium 12 (#ffefd6) across 303px from y72; the stats stacked and
		   centred — a 15px label over its value, the RTP one on a 110x37 amber pill. */
		.info-body {
			flex: none;
			width: calc(303 * var(--d));
			margin-top: calc(17 * var(--d));
			color: #ffefd6;
			font-size: calc(12 * var(--d));
			line-height: calc(16.4 * var(--d));
		}
		.info-stats {
			left: 0;
			grid-template-columns: minmax(0, 1fr);
			justify-items: center;
			gap: 0;
			margin-top: calc(28 * var(--d));
		}
		.info-stats dt,
		.info-stats dd {
			grid-column: 1;
			justify-self: center;
		}
		.info-stats dt {
			font-size: calc(15 * var(--d));
			line-height: calc(20 * var(--d));
		}
		.info-stats dd {
			min-height: calc(37 * var(--d));
			margin-bottom: calc(12 * var(--d));
			padding: calc(8 * var(--d)) calc(10 * var(--d));
			font-family: 'Jersey 10', monospace;
			font-size: calc(20 * var(--d));
			font-weight: 400;
			line-height: calc(21 * var(--d));
		}
		.info-stats dd.pill {
			min-width: calc(110 * var(--d));
			border-radius: calc(7 * var(--d));
			font-family: inherit;
			font-size: calc(15 * var(--d));
			font-weight: 800;
		}
		/* The overview's cards and basket give way to the design's leaning vegetables. */
		.info-cards,
		.info-basket {
			display: none;
		}
		.info-veg {
			position: absolute;
			display: block;
			height: auto;
			pointer-events: none;
			image-rendering: pixelated;
		}
		/* Anchored to the panel's FOOT, not its head: the design's 508px card has them stacked up
		   from the nav row, and the panel is now as tall as the phone, so the same `top` values
		   left them mid-panel over empty floor. The FILE names are swapped (veggieAssets.ts):
		   the design's white cauliflower mid-left is radish.webp, its pink radish upper-right is
		   cauliflower.webp — "this is by design / this is now, fix it" (user, 2026-09-18). */
		.info-veg--carrot {
			bottom: calc(183 * var(--d));
			left: calc(-50 * var(--d));
			width: calc(112 * var(--d));
			transform: rotate(-20deg);
		}
		.info-veg--radish {
			bottom: calc(83 * var(--d));
			left: calc(-36 * var(--d));
			width: calc(98 * var(--d));
			transform: rotate(25deg);
		}
		.info-veg--corn {
			bottom: calc(-13 * var(--d));
			left: calc(-30 * var(--d));
			width: calc(104 * var(--d));
			transform: rotate(-24deg);
		}
		.info-veg--cauliflower {
			bottom: calc(144 * var(--d));
			left: calc(268 * var(--d));
			width: calc(109 * var(--d));
			transform: rotate(-15deg);
		}
		.info-veg--broccoli {
			bottom: calc(47 * var(--d));
			left: calc(288 * var(--d));
			width: calc(90 * var(--d));
			transform: rotate(15deg);
		}
		/* Paytable: a 322px table 8px in from the left and 65px down, 19px rows on a 2px gap —
		   42.5px symbol column, 23px price cells (27 for 15+) — then the 318x184 scatter card. */
		.pay-wrap {
			grid-template-columns: minmax(0, 1fr);
			/* Packed at the top: on a tall phone the scroller is taller than the page and grid
			   rows would otherwise stretch, dropping the scatter card to the foot. */
			align-content: start;
			gap: calc(14 * var(--d));
			margin: calc(10 * var(--d)) calc(8 * var(--d)) 0;
		}
		.pay-grid {
			grid-template-columns: calc(42.5 * var(--d)) repeat(var(--cols, 11), minmax(0, 1fr));
			gap: calc(2 * var(--d));
		}
		.pay-cell {
			height: calc(19 * var(--d));
			border-width: max(0.5px, calc(0.5 * var(--d)));
			border-radius: calc(4 * var(--d));
		}
		.pay-cell.pay-head {
			font-size: calc(10 * var(--d));
		}
		.pay-cell.pay-head.pay-symbol {
			font-size: calc(8 * var(--d));
		}
		.pay-value {
			font-size: calc(7 * var(--d));
			letter-spacing: 0;
		}
		.pay-symbol img {
			width: calc(18 * var(--d));
		}
		.pay-special {
			display: grid;
			grid-template-columns: auto auto;
			grid-template-rows: auto auto;
			justify-content: center;
			align-items: center;
			column-gap: calc(15 * var(--d));
			height: auto;
			min-height: calc(184 * var(--d));
			margin: 0 calc(2 * var(--d));
			padding: calc(11 * var(--d)) calc(18 * var(--d)) calc(14 * var(--d));
			border-radius: calc(8 * var(--d));
		}
		.pay-special img {
			grid-row: 1;
			grid-column: 1;
			width: calc(37 * var(--d));
			margin: 0;
		}
		.pay-special h3 {
			grid-row: 1;
			grid-column: 2;
			font-size: calc(21 * var(--d));
			line-height: calc(23 * var(--d));
		}
		.pay-special p {
			grid-row: 2;
			grid-column: 1 / -1;
			width: calc(282 * var(--d));
			margin-top: calc(16 * var(--d));
			font-size: calc(12 * var(--d));
			line-height: calc(16.4 * var(--d));
		}
		/* Rule pages: one column of the same cards, the copy at the overview's 12px. */
		.rule-grid,
		.ui-grid {
			top: auto;
			left: auto;
			width: auto;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			grid-auto-rows: auto;
			gap: calc(8 * var(--d));
			margin: calc(14 * var(--d)) calc(10 * var(--d)) 0;
		}
		.rule-grid--ways > :nth-child(n),
		.rule-grid--general > :nth-child(n) {
			grid-column: auto;
		}
		.ui-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.rule-card {
			padding: calc(10 * var(--d)) calc(10 * var(--d)) calc(9 * var(--d));
			border-radius: calc(8 * var(--d));
		}
		.rule-card h3 {
			margin-bottom: calc(5 * var(--d));
			font-size: calc(21 * var(--d));
		}
		.rule-card p,
		.general-card p,
		.general-card:last-child p,
		.ui-card p {
			width: 100%;
			font-size: calc(12 * var(--d));
			line-height: calc(16.4 * var(--d));
		}
		.buy-card img,
		.general-card img,
		.general-card:last-child img {
			height: calc(44 * var(--d));
			margin: calc(6 * var(--d)) 0;
		}
		.ui-card {
			gap: calc(4 * var(--d));
			padding: calc(8 * var(--d));
			border-radius: calc(6 * var(--d));
		}
		.ui-card h3 {
			font-size: calc(16 * var(--d));
		}
		.ui-disc {
			width: calc(36 * var(--d));
			height: calc(36 * var(--d));
		}
		.ui-disc img {
			width: calc(17 * var(--d));
		}
		.ui-disc--gold {
			border-width: calc(2 * var(--d));
		}
		.ui-disc--gold img {
			width: calc(21 * var(--d));
		}
		/* Two 34px discs 5px apart, their top 461px down the panel, and a 12px counter whose
		   right edge is 19px in. */
		.info-nav {
			bottom: calc(8 * var(--d));
			gap: calc(5 * var(--d));
		}
		.info-nav button {
			width: calc(34 * var(--d));
			height: calc(34 * var(--d));
		}
		.info-nav img {
			width: calc(18 * var(--d));
		}
		.info-page {
			right: calc(19 * var(--d));
			bottom: calc(17 * var(--d));
			font-size: calc(12 * var(--d));
			line-height: calc(16 * var(--d));
		}
	}
</style>

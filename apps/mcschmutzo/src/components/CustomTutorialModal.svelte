<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const guyArt = ap('/assets/mcschmutzo/tutorial/overview-guy.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
	const arrowLeftArt = ap('/assets/mcschmutzo/tutorial/arrow-left.svg');
	const arrowRightArt = ap('/assets/mcschmutzo/tutorial/arrow-right.svg');

	const TOTAL_PAGES = 7;

	const symArt = (name: string) => ap(`/assets/mcschmutzo/symbols/${name}.png`);

	// Page 3 (features) icons + the win-multiplier ladder shown in the design.
	const wildArt = symArt('W');
	const respinArt = ap('/assets/mcschmutzo/buybonus/burger.svg');
	const scatterArt = symArt('S');
	// The win-multiplier icon = the receipt printer with an "X2" ticket laid on top of it (design).
	const printerArt = ap('/assets/mcschmutzo/tutorial/printer.svg');
	const multX2Art = ap('/assets/mcschmutzo/tutorial/mult-x2.svg');
	// Scatter / bonus sub-badges (3 / 4 scatters) + the Free Games spin-arrow icon.
	const scatter3Art = ap('/assets/mcschmutzo/tutorial/scatter-3.svg');
	const scatter4Art = ap('/assets/mcschmutzo/tutorial/scatter-4.svg');
	const freeGamesArt = ap('/assets/mcschmutzo/tutorial/free-games-arrow.svg');

	// Page 6 (general info) icons.
	const reloadArt = ap('/assets/mcschmutzo/tutorial/reload.webp');
	const scalesArt = ap('/assets/mcschmutzo/tutorial/scales.webp');

	// Page 7 (user interface guide) — the design's icon-button set (self-contained SVGs:
	// dark disc + #605554 border + white glyph, so they match the HUD 1:1).
	const uiIcon = (n: string) => ap(`/assets/mcschmutzo/ui-icons/${n}`);
	// label/desc are i18n keys (translated in the markup).
	const UI_ITEMS: { label: string; desc: string; icon: string }[] = [
		{ label: 'SPIN', desc: 'INFO UI SPIN DESC', icon: uiIcon('spin.svg') },
		{ label: 'UI AUTO SPINS', desc: 'INFO UI AUTO DESC', icon: uiIcon('auto.svg') },
		{ label: 'TURBO', desc: 'INFO UI TURBO DESC', icon: uiIcon('turbo.svg') },
		{ label: 'UI BET PLUS', desc: 'INFO UI BETPLUS DESC', icon: uiIcon('plus.svg') },
		{ label: 'UI BET MINUS', desc: 'INFO UI BETMINUS DESC', icon: uiIcon('minus.svg') },
		{ label: 'INFO', desc: 'INFO UI INFO DESC', icon: uiIcon('info.svg') },
		{ label: 'SOUND', desc: 'INFO UI SOUND DESC', icon: uiIcon('sound.svg') },
		{ label: 'PREVIOUS', desc: 'INFO UI PREV DESC', icon: uiIcon('prev.svg') },
		{ label: 'NEXT', desc: 'INFO UI NEXT DESC', icon: uiIcon('next.svg') },
		{ label: 'CLOSE', desc: 'INFO UI CLOSE DESC', icon: uiIcon('close.svg') },
		{ label: 'MENU', desc: 'INFO UI MENU DESC', icon: uiIcon('menu.svg') },
		{ label: 'MUSIC', desc: 'INFO UI MUSIC DESC', icon: uiIcon('music.svg') },
	];
	const MULT_LADDER = [
		'1x', '2x', '3x', '4x', '5x', '6x', '8x', '10x', '12x', '15x', '20x', '25x', '30x', '35x',
		'40x', '50x', '60x', '70x', '80x', '120x', '150x', '200x', '250x', '300x', '350x', '400x',
		'500x', '600x', '800x', '1000x',
	];

	// Page 5 (feature buy) — four purchasable modes. title/body/cost are i18n keys.
	const FEATURE_BUYS: { title: string; body: string; cost: string; rtp: string }[] = [
		{ title: 'INFO FB1 TITLE', body: 'INFO FB1 BODY', cost: 'INFO FB1 COST', rtp: '96.1%' },
		{ title: 'INFO FB2 TITLE', body: 'INFO FB2 BODY', cost: 'INFO FB2 COST', rtp: '96.1%' },
		{ title: 'INFO FB3 TITLE', body: 'INFO FB3 BODY', cost: 'INFO FB3 COST', rtp: '96.1%' },
		{ title: 'INFO FB4 TITLE', body: 'INFO FB4 BODY', cost: 'INFO FB4 COST', rtp: '96.1%' },
	];

	// Paytable (values per matching-symbol count), ordered low → high as in the design.
	const PAY_ROWS: { syms: string[]; pays: [string, string, string] }[] = [
		{ syms: ['L1', 'L2', 'L3', 'L4', 'L5'], pays: ['0.1', '0.4', '1'] },
		{ syms: ['H5'], pays: ['0.2', '0.8', '2'] },
		{ syms: ['H4'], pays: ['0.2', '0.8', '2'] },
		{ syms: ['H3'], pays: ['0.3', '1', '2.5'] },
		{ syms: ['M'], pays: ['0.3', '1', '2.5'] },
		{ syms: ['H1'], pays: ['0.5', '2', '5'] },
	];
</script>

<script lang="ts">
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onclose: () => void };
	const props: Props = $props();

	let page = $state(1);
	const prev = () => (page = Math.max(1, page - 1));
	const next = () => (page = Math.min(TOTAL_PAGES, page + 1));

	const onKey = (e: KeyboardEvent) => {
		if (e.code === 'Escape') props.onclose();
		else if (e.code === 'ArrowLeft') prev();
		else if (e.code === 'ArrowRight') next();
	};
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="tu-backdrop" onclick={props.onclose}></div>

<div class="tu-root" role="dialog" aria-modal="true">
	<div class="tu-popup">
		{#if page === 1}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('OVERVIEW')}</h2>
				<p class="tu-body">{i18nDerived.translate('INFO OVERVIEW BODY')}</p>

				<div class="tu-lower">
					<img class="tu-guy" src={guyArt} alt="" draggable="false" />
					<div class="tu-stats">
						<div class="tu-stat">
							<span class="tu-stat-label">{i18nDerived.translate('INFO MAX WIN LABEL')}</span>
							<span class="tu-stat-big">{i18nDerived.translate('INFO MAX WIN VALUE')}</span>
						</div>
						<div class="tu-stat">
							<span class="tu-stat-label">{i18nDerived.translate('INFO RTP LABEL')}</span>
							<span class="tu-pill">96.10%</span>
						</div>
					</div>
				</div>
			</div>
		{:else if page === 2}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('PAYTABLE')}</h2>

				<div class="pt-table">
					<div class="pt-head">
						<div class="pt-hcell">{i18nDerived.translate('SYMBOL')}</div>
						<div class="pt-hcell">{i18nDerived.translate('3 OF A KIND')}</div>
						<div class="pt-hcell">{i18nDerived.translate('4 OF A KIND')}</div>
						<div class="pt-hcell">{i18nDerived.translate('5 OF A KIND')}</div>
					</div>

					<div class="pt-body">
						{#each PAY_ROWS as row}
							<div class="pt-row">
								<div class="pt-sym" class:pt-sym--multi={row.syms.length > 1}>
									{#each row.syms as s}
										<img src={symArt(s)} alt="" draggable="false" />
									{/each}
								</div>
								<div class="pt-val">{row.pays[0]} x</div>
								<div class="pt-val">{row.pays[1]} x</div>
								<div class="pt-val">{row.pays[2]} x</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{:else if page === 3}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('FEATURES')}</h2>

				<div class="ft-grid">
					<div class="ft-card ft-card--wild">
						<div class="ft-head">
							<img class="ft-icon" src={wildArt} alt="" draggable="false" />
							<h3 class="ft-title">{i18nDerived.translate('INFO WILD TITLE')}</h3>
						</div>
						<div class="ft-body ft-body--center">
							<p>{i18nDerived.translate('INFO WILD BODY 1')}</p>
							<p>{i18nDerived.translate('INFO WILD BODY 2')}</p>
						</div>
					</div>

					<div class="ft-card ft-card--respin">
						<div class="ft-head">
							<img class="ft-icon" src={respinArt} alt="" draggable="false" />
							<h3 class="ft-title">{i18nDerived.translate('INFO RESPIN TITLE')}</h3>
						</div>
						<div class="ft-body ft-body--center">
							<p>{i18nDerived.translate('INFO RESPIN BODY 1')}</p>
							<p>{i18nDerived.translate('INFO RESPIN BODY 2')}</p>
							<p>{i18nDerived.translate('INFO RESPIN BODY 3')}</p>
						</div>
					</div>

					<div class="ft-card ft-card--mult">
						<div class="ft-head">
							<span class="ft-mult-icon">
								<img class="ft-mult-printer" src={printerArt} alt="" draggable="false" />
								<img class="ft-mult-x2" src={multX2Art} alt="" draggable="false" />
							</span>
							<h3 class="ft-title">{i18nDerived.translate('INFO MULT TITLE')}</h3>
						</div>
						<div class="ft-body">
							<p>{i18nDerived.translate('INFO MULT BODY 1')}</p>
							<div class="ft-ladder">
								{#each MULT_LADDER as m, i}
									<span class="ft-step">
										<span class="ft-chip">{m}</span>
										{#if i < MULT_LADDER.length - 1}<span class="ft-arrow">→</span>{/if}
									</span>
								{/each}
							</div>
							<p>{i18nDerived.translate('INFO MULT BODY 2')}</p>
						</div>
					</div>

					<div class="ft-card ft-card--scatter">
						<div class="ft-head">
							<img class="ft-icon ft-icon--scatter" src={scatterArt} alt="" draggable="false" />
							<h3 class="ft-title">{i18nDerived.translate('INFO SCATTER TITLE')}</h3>
						</div>
						<div class="ft-body">
							<p>{i18nDerived.translate('INFO SCATTER BODY')}</p>
							<div class="ft-sub-grid">
								<div class="ft-sub">
									<img class="ft-sub-badge" src={scatter3Art} alt="" draggable="false" />
									<span class="ft-sub-text">
										<span class="ft-sub-title">{i18nDerived.translate('INFO SCATTER 3 TITLE')}</span>
										<span class="ft-sub-body">{i18nDerived.translate('INFO SCATTER 3 BODY')}</span>
									</span>
								</div>
								<div class="ft-sub">
									<img class="ft-sub-badge" src={scatter4Art} alt="" draggable="false" />
									<span class="ft-sub-text">
										<span class="ft-sub-title">{i18nDerived.translate('INFO SCATTER 4 TITLE')}</span>
										<span class="ft-sub-body">{i18nDerived.translate('INFO SCATTER 4 BODY')}</span>
									</span>
								</div>
							</div>
						</div>
					</div>

					<div class="ft-card ft-card--free">
						<div class="ft-head">
							<img class="ft-icon ft-icon--free" src={freeGamesArt} alt="" draggable="false" />
							<h3 class="ft-title">{i18nDerived.translate('FREE GAMES')}</h3>
						</div>
						<div class="ft-body">
							<p>{i18nDerived.translate('INFO FREEGAMES BODY 1')}</p>
							<p>{i18nDerived.translate('INFO FREEGAMES BODY 2')}</p>
						</div>
					</div>
				</div>
			</div>
		{:else if page === 4}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('WAYS TO WIN')}</h2>
				<p class="tu-body tu-body--wide">{i18nDerived.translate('INFO WAYS BODY')}</p>

				<div class="wt-grid">
					<div class="ft-card">
						<div class="ft-head">
							<img class="ft-icon" src={respinArt} alt="" draggable="false" />
							<h3 class="ft-title">{i18nDerived.translate('INFO LOCKRESPIN TITLE')}</h3>
						</div>
						<div class="ft-body">
							<p>{i18nDerived.translate('INFO LOCKRESPIN BODY')}</p>
						</div>
					</div>
				</div>
			</div>
		{:else if page === 5}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('FEATURE BUY')}</h2>

				<div class="fb-grid">
					{#each FEATURE_BUYS as fb}
						<div class="fb-card">
							<h3 class="fb-title">{i18nDerived.translate(fb.title)}</h3>
							<p class="fb-body">{i18nDerived.translate(fb.body)}</p>
							<div class="fb-cost">{i18nDerived.translate(fb.cost)}</div>
							<div class="fb-rtp">RTP: {fb.rtp}</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if page === 6}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('GENERAL INFO')}</h2>

				<div class="gi-grid">
					<div class="gi-card">
						<div class="gi-head">
							<img class="gi-icon" src={reloadArt} alt="" draggable="false" />
							<h3 class="gi-title">{i18nDerived.translate('INTERRUPTED ROUNDS')}</h3>
						</div>
						<div class="gi-body">
							<p>{i18nDerived.translate('INFO INTERRUPTED BODY 1')}</p>
							<p>{i18nDerived.translate('INFO INTERRUPTED BODY 2')}</p>
						</div>
					</div>

					<div class="gi-card">
						<div class="gi-head">
							<img class="gi-icon" src={scalesArt} alt="" draggable="false" />
							<h3 class="gi-title">{i18nDerived.translate('LEGAL NOTICE')}</h3>
						</div>
						<div class="gi-body">
							<p>{i18nDerived.translate('INFO LEGAL BODY 1')}</p>
							<p>{i18nDerived.translate('INFO LEGAL BODY 2')}</p>
							<p>{i18nDerived.translate('INFO LEGAL BODY 3')}</p>
							<p>{i18nDerived.translate('INFO LEGAL COPYRIGHT')}</p>
						</div>
					</div>
				</div>
			</div>
		{:else if page === 7}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('USER INTERFACE GUIDE')}</h2>

				<div class="ug-grid">
					{#each UI_ITEMS as it}
						<div class="ug-item">
							<img class="ug-btn" src={it.icon} alt="" draggable="false" />
							<span class="ug-text">
								<span class="ug-label">{i18nDerived.translate(it.label)}</span>
								<span class="ug-desc">{i18nDerived.translate(it.desc)}</span>
							</span>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="tu-page tu-page--placeholder">
				<h2 class="tu-title">{i18nDerived.translate('INFO PAGE')} {page}</h2>
				<p class="tu-body">{i18nDerived.translate('INFO COMING SOON')}</p>
			</div>
		{/if}

		<div class="tu-nav">
			<button
				class="tu-arrow"
				type="button"
				onclick={prev}
				disabled={page === 1}
				aria-label={i18nDerived.translate('PREVIOUS')}
				style={`background-image:url('${arrowLeftArt}')`}
			></button>
			<button
				class="tu-arrow"
				type="button"
				onclick={next}
				disabled={page === TOTAL_PAGES}
				aria-label={i18nDerived.translate('NEXT')}
				style={`background-image:url('${arrowRightArt}')`}
			></button>
			<span class="tu-page-num">{i18nDerived.translate('INFO PAGE')} {page}/{TOTAL_PAGES}</span>
		</div>
	</div>
</div>

<!-- Close (X) is a SIBLING of .tu-root (which is transform-centred) so position:fixed reaches the real
     viewport top-right corner, exactly like the other modals' close buttons. -->
<button
	class="tu-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={props.onclose}
	aria-label={i18nDerived.translate('CLOSE')}
></button>

<style>
	.tu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.tu-root {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 59;
		width: min(980px, 94vw);
		max-height: 94dvh;
		font-family: 'Nunito', sans-serif;
	}

	.tu-popup {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		min-height: min(460px, 78dvh);
		/* Never taller than the screen (leaves headroom for the close button) — the page body
		   scrolls instead of the popup being cut off. */
		max-height: 86dvh;
		padding: clamp(20px, 3.2vmin, 40px) clamp(28px, 5vmin, 60px) 0;
		border: 1.91px solid #605553;
		border-radius: 22px;
		background: #181818;
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	/* Sits fully ABOVE the popup's top-right corner (the button is a child of .tu-root, not the
	   overflow-hidden popup, so it isn't clipped). */
	.tu-close {
		--x-size: clamp(40px, 5.4vmin, 52px);
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 60;
		width: var(--x-size);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.tu-close:hover {
		filter: brightness(1.2);
	}
	.tu-close:active {
		transform: scale(0.94);
	}
	/* Short viewports (mobile landscape): the popup fills the height, so the close button placed ABOVE
	   it lands off the top of the screen. Tuck it INSIDE the top-right corner instead. */
	@media (max-height: 500px) {
		.tu-root {
			width: min(760px, 92vw);
		}
		.tu-close {
			--x-size: clamp(28px, 7vmin, 40px);
			top: clamp(6px, 1.6vmin, 14px);
			right: clamp(6px, 1.6vmin, 14px);
		}
	}

	/* The page body is the scroll area (flex child of the popup); the nav sits below it. */
	.tu-page {
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		padding-bottom: clamp(6px, 1.2vmin, 14px);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.tu-title {
		margin: 0 0 clamp(10px, 1.9vmin, 20px);
		max-width: 100%;
		text-align: center;
		color: #f3e7cb;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.5rem, 4.2vmin, 2.5rem);
		line-height: 1.06;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		/* Long single-word titles (e.g. Finnish "KÄYTTÖLIITTYMÄOPAS") must wrap instead of overflowing. */
		overflow-wrap: break-word;
		word-break: break-word;
		hyphens: auto;
	}

	.tu-body {
		margin: 0;
		max-width: 62ch;
		text-align: center;
		color: #ece2cd;
		font-weight: 600;
		font-size: clamp(0.9rem, 2.1vmin, 1.28rem);
		line-height: 1.5;
	}

	/* Page 2 — paytable. Shared column template keeps header cells and body columns aligned. */
	.pt-table {
		width: 100%;
		margin-top: clamp(12px, 2.2vmin, 24px);
		/* minmax(0, …) lets the columns shrink to the popup width instead of the header/symbol
		   content forcing the table wider (which cut the last column off on narrow phones). */
		--pt-cols: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
	}
	.pt-head {
		display: grid;
		grid-template-columns: var(--pt-cols);
		gap: clamp(5px, 0.9vmin, 9px);
		margin-bottom: clamp(4px, 0.8vmin, 9px);
	}
	.pt-hcell {
		min-width: 0;
		padding: clamp(7px, 1.4vmin, 14px) clamp(3px, 0.8vmin, 10px);
		border-radius: 8px;
		background: #e9a02a;
		color: #fff;
		text-align: center;
		/* Wrap "X OF A KIND" instead of clipping when the column is narrow. */
		white-space: normal;
		line-height: 1.1;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.62rem, 1.55vmin, 1.02rem);
		letter-spacing: 0.02em;
	}
	.pt-body {
		border-top: 1px solid rgba(255, 255, 255, 0.09);
	}
	.pt-row {
		display: grid;
		grid-template-columns: var(--pt-cols);
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.09);
	}
	.pt-sym {
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: clamp(2px, 0.6vmin, 6px);
		padding: clamp(4px, 0.9vmin, 9px) clamp(4px, 1vmin, 14px);
	}
	.pt-sym img {
		height: clamp(30px, 6.4vmin, 66px);
		max-width: 100%;
		width: auto;
		object-fit: contain;
	}
	.pt-sym--multi img {
		height: clamp(30px, 5.6vmin, 56px);
	}
	.pt-val {
		min-width: 0;
		padding: clamp(6px, 1.2vmin, 14px) 0;
		border-left: 1px solid rgba(255, 255, 255, 0.09);
		text-align: center;
		color: #efe8d8;
		font-weight: 700;
		font-size: clamp(0.9rem, 2.5vmin, 1.55rem);
	}

	/* Page 3 — features. Two cards on top (wild | re-spin), full-width multiplier card below. */
	.ft-grid {
		width: 100%;
		margin-top: clamp(10px, 2vmin, 20px);
		display: grid;
		grid-template-columns: 1fr 2.1fr;
		grid-template-areas: 'wild respin' 'mult mult' 'scatter scatter' 'free free';
		gap: clamp(8px, 1.5vmin, 16px);
	}
	.ft-card--wild {
		grid-area: wild;
	}
	.ft-card--respin {
		grid-area: respin;
	}
	.ft-card--mult {
		grid-area: mult;
	}
	.ft-card--scatter {
		grid-area: scatter;
	}
	.ft-card--free {
		grid-area: free;
	}
	/* Boards match the Buy Bonus cards: dark gradient body with an inset #605553 frame (::before). */
	.ft-card {
		position: relative;
		padding: clamp(14px, 2.2vmin, 24px) clamp(16px, 2.2vmin, 26px);
		border-radius: 16px;
		background: linear-gradient(180deg, #221e1b 0%, #191512 100%);
	}
	.ft-card::before {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2.03px solid #605553;
		border-radius: 12px;
		pointer-events: none;
	}
	.ft-head {
		display: flex;
		align-items: center;
		gap: clamp(6px, 1.2vmin, 12px);
		margin-bottom: clamp(6px, 1.2vmin, 12px);
	}
	/* All Features-card header icons share one height so they read as a consistent set. */
	.ft-icon {
		height: clamp(28px, 4.3vmin, 44px);
		width: auto;
		object-fit: contain;
	}
	.ft-title {
		margin: 0;
		color: #f0a112;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.85rem, 1.9vmin, 1.2rem);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.ft-body {
		color: #c9c0b2;
		font-weight: 600;
		font-size: clamp(0.62rem, 1.45vmin, 0.9rem);
		line-height: 1.42;
	}
	.ft-body p {
		margin: 0 0 clamp(6px, 1vmin, 10px);
	}
	.ft-body p:last-child {
		margin-bottom: 0;
	}
	.ft-body--center {
		text-align: center;
	}
	.ft-ladder {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: clamp(3px, 0.6vmin, 6px) clamp(2px, 0.4vmin, 5px);
		margin: clamp(6px, 1.2vmin, 12px) 0;
	}
	.ft-step {
		display: inline-flex;
		align-items: center;
		gap: clamp(2px, 0.4vmin, 5px);
	}
	.ft-chip {
		padding: clamp(2px, 0.5vmin, 5px) clamp(6px, 1vmin, 10px);
		border-radius: 6px;
		background: #1b1917;
		border: 1px solid rgba(255, 255, 255, 0.07);
		color: #ece2cd;
		font-weight: 700;
		font-size: clamp(0.58rem, 1.35vmin, 0.82rem);
		white-space: nowrap;
	}
	.ft-arrow {
		color: #8a8177;
		font-size: clamp(0.55rem, 1.2vmin, 0.78rem);
	}

	/* WIN MULTIPLIER icon = the receipt printer with an "X2" ticket laid over its cream receipt. The
	   X2 is centred on the printer's ticket area (≈52% down) and scaled to a share of the icon width. */
	.ft-mult-icon {
		position: relative;
		flex: 0 0 auto;
		display: inline-block;
		height: clamp(28px, 4.3vmin, 44px);
		aspect-ratio: 49 / 37;
	}
	.ft-mult-printer {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	.ft-mult-x2 {
		position: absolute;
		left: 50%;
		top: 53%;
		transform: translate(-50%, -50%);
		width: 46%;
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
	}
	/* Scatter card — two sub-sections (3 / 4 scatters) stacked one under another, each a badge beside
	   a title + paragraph. Badge tops with the title so the now-multi-line copy reads cleanly. */
	.ft-sub-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: clamp(8px, 1.4vmin, 16px);
		margin-top: clamp(8px, 1.4vmin, 14px);
	}
	.ft-sub {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		gap: clamp(7px, 1.2vmin, 12px);
		/* No panel/padding: the badge sits flush-left so 3 / 4 line up under the header scatter icon. */
	}
	.ft-sub-badge {
		flex: 0 0 auto;
		width: clamp(26px, 3.8vmin, 40px);
		height: clamp(26px, 3.8vmin, 40px);
		object-fit: contain;
	}
	.ft-sub-text {
		display: flex;
		flex-direction: column;
		gap: clamp(1px, 0.3vmin, 4px);
		min-width: 0;
	}
	.ft-sub-title {
		color: #f0a112;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.66rem, 1.5vmin, 0.92rem);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.ft-sub-body {
		color: #c9c0b2;
		font-weight: 600;
		font-size: clamp(0.6rem, 1.35vmin, 0.85rem);
		line-height: 1.35;
	}

	/* Page 4 — ways to win. Intro paragraph spans the full popup width (left-aligned, no narrow
	   centred column) so it uses all the horizontal space, matching the board below. */
	.tu-body--wide {
		max-width: none;
		width: 100%;
		text-align: left;
	}
	.wt-grid {
		width: 100%;
		margin-top: clamp(12px, 2.2vmin, 24px);
		display: grid;
		grid-template-columns: 1fr;
		gap: clamp(8px, 1.5vmin, 16px);
	}

	/* Page 5 — feature buy. Four equal cost cards; cost chip + RTP pinned to the card bottom. */
	.fb-grid {
		width: 100%;
		margin-top: clamp(12px, 2.4vmin, 26px);
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(8px, 1.5vmin, 16px);
	}
	.fb-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		min-height: clamp(280px, 44vmin, 420px);
		padding: clamp(16px, 2.4vmin, 28px) clamp(16px, 2vmin, 22px);
		border-radius: 16px;
		background: linear-gradient(180deg, #221e1b 0%, #191512 100%);
	}
	.fb-card::before {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2.03px solid #605553;
		border-radius: 12px;
		pointer-events: none;
	}
	.fb-title {
		margin: 0 0 clamp(10px, 1.8vmin, 18px);
		color: #f0a112;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.8rem, 1.75vmin, 1.1rem);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.fb-body {
		margin: 0;
		color: #c9c0b2;
		font-weight: 600;
		font-size: clamp(0.66rem, 1.5vmin, 0.92rem);
		line-height: 1.45;
	}
	.fb-cost {
		margin-top: auto;
		margin-bottom: clamp(8px, 1.4vmin, 14px);
		padding: clamp(6px, 1.1vmin, 11px) clamp(10px, 1.8vmin, 18px);
		border-radius: 8px;
		background: #1b1917;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #fff;
		font-weight: 800;
		font-size: clamp(0.72rem, 1.55vmin, 0.98rem);
		white-space: nowrap;
	}
	.fb-rtp {
		color: #c9c0b2;
		font-weight: 600;
		font-size: clamp(0.72rem, 1.5vmin, 0.95rem);
	}

	/* Page 6 — general info. Two titled sections (icon + heading, then body). */
	.gi-grid {
		width: 100%;
		margin-top: clamp(14px, 2.6vmin, 28px);
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: clamp(10px, 1.8vmin, 20px);
	}
	.gi-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: clamp(16px, 2.4vmin, 28px) clamp(18px, 2.4vmin, 32px);
		border-radius: 16px;
		background: linear-gradient(180deg, #221e1b 0%, #191512 100%);
	}
	.gi-card::before {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2.03px solid #605553;
		border-radius: 12px;
		pointer-events: none;
	}
	/* Icon sits ABOVE the title (matches the other games' info pages); larger, prominent icons. */
	.gi-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(6px, 1.2vmin, 12px);
		margin-bottom: clamp(10px, 1.8vmin, 18px);
	}
	.gi-icon {
		height: clamp(46px, 7.2vmin, 88px);
		width: auto;
		object-fit: contain;
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.4));
	}
	.gi-title {
		margin: 0;
		color: #f3e7cb;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(1rem, 2.3vmin, 1.5rem);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.gi-body {
		color: #cfc6b7;
		font-weight: 600;
		font-size: clamp(0.8rem, 1.8vmin, 1.12rem);
		line-height: 1.5;
	}
	.gi-body p {
		margin: 0 0 clamp(10px, 1.6vmin, 16px);
	}
	.gi-body p:last-child {
		margin-bottom: 0;
	}

	/* Page 7 — user interface guide. Icon-left reference rows (design), 2-up on desktop.
	   Each row is a board, matching the Buy Bonus cards. */
	/* Desktop / landscape: plain icon-above-description columns — no card frame. (Mobile portrait
	   restores the bordered icon-left rows in the narrow media query below.) */
	.ug-grid {
		width: 100%;
		margin-top: clamp(12px, 2vmin, 22px);
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: clamp(14px, 2.4vmin, 28px) clamp(6px, 1.4vmin, 16px);
	}
	.ug-item {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: clamp(6px, 1.1vmin, 12px);
	}
	.ug-btn {
		flex: 0 0 auto;
		width: clamp(40px, 5.4vmin, 58px);
		height: clamp(40px, 5.4vmin, 58px);
		object-fit: contain;
	}
	.ug-text {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(2px, 0.4vmin, 5px);
		min-width: 0;
	}
	.ug-label {
		color: #f2ead9;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.78rem, 1.6vmin, 1rem);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.ug-desc {
		color: #b3a99c;
		font-family: 'Nunito', sans-serif;
		font-weight: 600;
		font-size: clamp(0.66rem, 1.4vmin, 0.85rem);
		line-height: 1.35;
	}

	/* Guy anchored bottom-left; the two stats sit to his right, each on its own row as
	   "label: value" (design). Auto-margins push the guy to the left and stats fill the rest. */
	.tu-lower {
		width: 100%;
		margin-top: auto;
		padding-top: clamp(10px, 1.8vmin, 22px);
		display: flex;
		flex-direction: row;
		align-items: flex-end;
		justify-content: flex-start;
		gap: clamp(10px, 3vw, 40px);
	}
	.tu-guy {
		flex: 0 0 auto;
		align-self: flex-end;
		width: clamp(110px, 26%, 200px);
		height: auto;
		pointer-events: none;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
	}
	.tu-stats {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: clamp(10px, 2.4vmin, 24px);
		padding-bottom: clamp(6px, 2vmin, 20px);
	}
	/* Each stat = label + value on ONE row. Wraps only if the row genuinely can't fit. */
	.tu-stat {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		flex-wrap: wrap;
		gap: clamp(6px, 1.4vw, 14px);
	}
	.tu-stat-label {
		color: #ece2cd;
		font-weight: 600;
		font-size: clamp(0.9rem, 2.1vmin, 1.32rem);
	}
	.tu-stat-big {
		color: #f0a112;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(1.15rem, 3.2vmin, 2.1rem);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	.tu-pill {
		padding: clamp(4px, 0.8vmin, 8px) clamp(14px, 2.4vmin, 24px);
		border-radius: 8px;
		background: #f0a112;
		color: #241f1c;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(1rem, 2.4vmin, 1.4rem);
		letter-spacing: 0.01em;
	}

	.tu-page--placeholder {
		justify-content: center;
	}

	/* Nav arrows + page indicator — a static footer below the scrolling page. */
	.tu-nav {
		position: relative;
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 2vmin, 20px);
		padding: clamp(10px, 1.6vmin, 18px) 0 clamp(14px, 2.4vmin, 26px);
	}
	.tu-arrow {
		width: clamp(30px, 5vmin, 48px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.tu-arrow:hover:not(:disabled) {
		filter: brightness(1.2);
	}
	.tu-arrow:active:not(:disabled) {
		transform: scale(0.94);
	}
	.tu-arrow:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tu-page-num {
		position: absolute;
		right: clamp(16px, 3vmin, 34px);
		color: #b3a99c;
		font-weight: 600;
		font-size: clamp(0.8rem, 1.8vmin, 1rem);
	}

	/* ── Mobile / short viewports ───────────────────────────────────────────────────────────────
	   The scroll structure is the default now; here we just widen to the phone and tighten padding. */
	@media (max-width: 680px), (max-height: 560px) {
		.tu-root {
			width: 94vw;
		}
		.tu-popup {
			padding: clamp(16px, 4.5vw, 30px) clamp(14px, 4vw, 26px) 0;
		}
		.tu-nav {
			padding: clamp(8px, 2vw, 12px) 0 clamp(12px, 3vw, 18px);
		}
		.tu-page-num {
			right: clamp(4px, 2vw, 12px);
		}
	}

	/* ── Narrow (portrait) ──────────────────────────────────────────────────────────────────────
	   No horizontal room for the multi-column pages → stack every column one under another. */
	@media (max-width: 680px) {
		/* OVERVIEW keeps its guy-left / stats-right row from the base rules; just tighten the
		   guy so the row fits a narrow screen. */
		.tu-guy {
			width: clamp(130px, 40%, 200px);
		}
		/* FEATURES: wild / re-spin / multiplier / scatter / free stacked. */
		.ft-grid {
			grid-template-columns: 1fr;
			grid-template-areas: 'wild' 'respin' 'mult' 'scatter' 'free';
		}
		/* FEATURE BUY: four cost cards stacked, no forced tall min-height. */
		.fb-grid {
			grid-template-columns: 1fr;
		}
		.fb-card {
			min-height: auto;
		}
		/* GENERAL INFO: two cards stacked. */
		.gi-grid {
			grid-template-columns: 1fr;
		}
		.gi-card {
			min-height: auto;
		}
		/* USER INTERFACE GUIDE — mobile portrait keeps the original bordered icon-left rows. */
		.ug-grid {
			grid-template-columns: 1fr;
			gap: clamp(8px, 1.4vmin, 14px);
			margin-top: clamp(10px, 1.8vmin, 20px);
		}
		.ug-item {
			flex-direction: row;
			align-items: center;
			text-align: left;
			gap: clamp(10px, 1.5vmin, 16px);
			padding: clamp(10px, 1.7vmin, 18px) clamp(16px, 2.4vmin, 28px);
			border-radius: 14px;
			background: linear-gradient(180deg, #221e1b 0%, #191512 100%);
		}
		.ug-item::before {
			content: '';
			position: absolute;
			inset: 5px;
			border: 2.03px solid #605553;
			border-radius: 11px;
			pointer-events: none;
		}
		.ug-btn {
			width: clamp(38px, 5vmin, 52px);
			height: clamp(38px, 5vmin, 52px);
		}
		.ug-text {
			align-items: flex-start;
		}
	}

	/* Narrow portrait phones (e.g. 320-wide): match the smaller X used on the buy-bonus / auto popups
	   so the close button is consistent and doesn't crowd the near-full-width popup. Landscape
	   max-height rules below still win. */
	@media (max-width: 480px) {
		.tu-close {
			width: clamp(28px, 8.5vw, 36px);
			top: 8px;
			right: 8px;
		}
		/* OVERVIEW keeps the guy bottom-left / stats-right row on narrow phones too. Shrink the guy +
		   the stat type (vw-scaled) and forbid wrapping so "Maximum Win: 25,000× bet" stays one line. */
		.tu-lower {
			gap: clamp(6px, 2.5vw, 16px);
		}
		.tu-guy {
			width: clamp(78px, 25vw, 130px);
		}
		.tu-stat {
			flex-wrap: nowrap;
			gap: clamp(4px, 1.4vw, 8px);
		}
		.tu-stat-label {
			font-size: clamp(0.66rem, 3.1vw, 1rem);
		}
		.tu-stat-big {
			font-size: clamp(0.86rem, 4vw, 1.3rem);
		}
		.tu-pill {
			padding: clamp(3px, 1vw, 6px) clamp(8px, 2.6vw, 16px);
			font-size: clamp(0.8rem, 3.6vw, 1.2rem);
		}
		/* PAYTABLE: wordy locales (e.g. French "IDENTIQUES") need smaller/tighter header cells to fit. */
		.pt-hcell {
			padding: clamp(5px, 1.6vw, 10px) clamp(2px, 0.8vw, 6px);
			font-size: clamp(0.5rem, 2.5vw, 0.8rem);
		}
	}

	/* Tiny popouts (~400x225): the default text is large enough that only a couple of lines fit
	   before the page-nav — shrink the type + chrome so a page reads with less scrolling. Placed
	   LAST so it wins over the base .tu-title/.tu-body rules (equal specificity → later wins). */
	@media (max-height: 300px) {
		.tu-popup {
			min-height: 0;
			/* Keep the popup short enough that the close (X) can sit ABOVE it, outside, without
			   clipping off the top of the screen. */
			max-height: 74dvh;
			padding: clamp(10px, 4vmin, 20px) clamp(14px, 5vmin, 28px) 0;
		}
		/* Narrower so there's a clear margin around the popup for the outside X. */
		.tu-root {
			width: min(760px, 84vw);
		}
		.tu-title {
			font-size: clamp(1rem, 8vmin, 1.6rem);
			margin-bottom: 6px;
		}
		.tu-body {
			font-size: clamp(0.7rem, 6vmin, 1rem);
			line-height: 1.32;
		}
		.tu-arrow {
			width: clamp(24px, 11dvh, 38px);
		}
		.tu-nav {
			gap: clamp(8px, 3vmin, 14px);
			padding: clamp(4px, 1.5vmin, 10px) 0 clamp(6px, 2vmin, 12px);
		}
		/* Close (X) at the viewport top-right corner, like the other modals. The narrower/shorter popup
		   (above) keeps the corner clear so it doesn't overlap. */
		.tu-close {
			--x-size: clamp(20px, 9dvh, 30px);
			top: 6px;
			right: 6px;
		}
		/* Card pages (features / general info / feature buy / UI guide): tighten padding + type so more
		   of a card is visible before the nav on the tiny popout (less mid-card scroll cut-off). */
		.ft-card,
		.gi-card,
		.fb-card,
		.ug-item {
			padding: clamp(8px, 3.4vmin, 14px) clamp(10px, 4vmin, 18px);
		}
		.ft-title,
		.gi-title,
		.fb-title,
		.ft-sub-title {
			font-size: clamp(0.68rem, 4.6vmin, 0.92rem);
		}
		.ft-body,
		.gi-body,
		.fb-body,
		.ft-sub-body,
		.ug-desc {
			font-size: clamp(0.58rem, 3.8vmin, 0.8rem);
		}
		.ft-icon,
		.ft-mult-icon {
			height: clamp(20px, 7vmin, 32px);
		}
		.gi-icon {
			height: clamp(28px, 10vmin, 52px);
		}
	}
</style>

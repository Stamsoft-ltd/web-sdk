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
	const multArt = ap('/assets/mcschmutzo/tutorial/mult-x2.webp');
	const MULT_LADDER = [
		'1x', '2x', '3x', '4x', '5x', '6x', '8x', '10x', '12x', '15x', '20x', '25x', '30x', '35x',
		'40x', '50x', '60x', '70x', '80x', '120x', '150x', '200x', '250x', '300x', '350x', '400x',
		'500x', '600x', '800x', '1000x',
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
		<button
			class="tu-close"
			type="button"
			style={`background-image:url('${closeArt}')`}
			onclick={props.onclose}
			aria-label="Close"
		></button>

		{#if page === 1}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('OVERVIEW')}</h2>
				<p class="tu-body">
					McSchmutzo is played on a 5×5 reel setup and pays on 50 fixed win-lines. Winning
					combinations are formed by landing matching symbols on an active win-line, starting from
					the leftmost reel and continuing on consecutive reels. All wins are calculated according
					to the symbol values shown in the Paytable. Multiple winning combinations may be awarded on
					the same game round.
				</p>

				<img class="tu-guy" src={guyArt} alt="" draggable="false" />
				<div class="tu-lower">
					<div class="tu-stats">
						<div class="tu-stat">
							<span class="tu-stat-label">Maximum Win:</span>
							<span class="tu-stat-big">25,000× bet</span>
						</div>
						<div class="tu-stat">
							<span class="tu-stat-label">Theoretical RTP:</span>
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
							<h3 class="ft-title">WILD SYMBOL</h3>
						</div>
						<div class="ft-body ft-body--center">
							<p>The WILD symbol substitutes for all regular paying symbols. When a Wild contributes to a winning combination, it substitutes for the required paying symbol and is counted as part of that win.</p>
							<p>The Wild does not substitute for the Scatter / Bonus symbol.</p>
						</div>
					</div>

					<div class="ft-card ft-card--respin">
						<div class="ft-head">
							<img class="ft-icon" src={respinArt} alt="" draggable="false" />
							<h3 class="ft-title">RE-SPIN FEATURE</h3>
						</div>
						<div class="ft-body ft-body--center">
							<p>Whenever a qualifying winning connection is formed, the winning symbols automatically lock in position and a Re-Spin is triggered. The lock is guaranteed whenever the required winning connection occurs. Only the highest-value qualifying winning symbol is selected to lock when multiple eligible symbol types are involved. During the Re-Spin, the locked symbols remain in position while the remaining reel positions spin again.</p>
							<p>If additional matching symbols land and extend the locked winning combination, those matching symbols are also locked and another Re-Spin is awarded. The Re-Spin sequence continues for as long as new matching symbols are added to the locked combination. A Re-Spin sequence ends when no additional matching symbols are added during a Re-Spin, or when all available reel positions become filled with the selected matching symbol.</p>
							<p>All wins created during the Re-Spin sequence are added to the current game-round win.</p>
						</div>
					</div>

					<div class="ft-card ft-card--mult">
						<div class="ft-head">
							<img class="ft-icon" src={multArt} alt="" draggable="false" />
							<h3 class="ft-title">WIN MULTIPLIER</h3>
						</div>
						<div class="ft-body">
							<p>During the Re-Spin Feature, McSchmutzo symbols may appear and increase the Win Multiplier. Each qualifying McSchmutzo symbol can add Win Multiplier steps. The Win Multiplier begins at 1x. The multiplier progresses through the following levels:</p>
							<div class="ft-ladder">
								{#each MULT_LADDER as m, i}
									<span class="ft-step">
										<span class="ft-chip">{m}</span>
										{#if i < MULT_LADDER.length - 1}<span class="ft-arrow">→</span>{/if}
									</span>
								{/each}
							</div>
							<p>The current Win Multiplier is applied according to the game mathematics and remains active throughout the current Re-Spin sequence.</p>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="tu-page tu-page--placeholder">
				<h2 class="tu-title">PAGE {page}</h2>
				<p class="tu-body">Coming soon.</p>
			</div>
		{/if}

		<div class="tu-nav">
			<button
				class="tu-arrow"
				type="button"
				onclick={prev}
				disabled={page === 1}
				aria-label="Previous"
				style={`background-image:url('${arrowLeftArt}')`}
			></button>
			<button
				class="tu-arrow"
				type="button"
				onclick={next}
				disabled={page === TOTAL_PAGES}
				aria-label="Next"
				style={`background-image:url('${arrowRightArt}')`}
			></button>
			<span class="tu-page-num">Page {page}/{TOTAL_PAGES}</span>
		</div>
	</div>
</div>

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
		min-height: min(560px, 90dvh);
		padding: clamp(24px, 4vmin, 44px) clamp(28px, 5vmin, 60px) clamp(70px, 10vmin, 96px);
		border: 2px solid #4a4340;
		border-radius: 22px;
		background: linear-gradient(180deg, #262322 0%, #201d1b 100%);
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.tu-close {
		position: absolute;
		top: clamp(12px, 2vmin, 20px);
		right: clamp(12px, 2vmin, 20px);
		z-index: 3;
		width: clamp(40px, 5.4vmin, 52px);
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

	.tu-page {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.tu-title {
		margin: 0 0 clamp(14px, 2.4vmin, 26px);
		text-align: center;
		color: #f3e7cb;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.7rem, 5vmin, 3rem);
		line-height: 1;
		letter-spacing: 0.04em;
		text-transform: uppercase;
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
		--pt-cols: 1.5fr 1fr 1fr 1fr;
	}
	.pt-head {
		display: grid;
		grid-template-columns: var(--pt-cols);
		gap: clamp(5px, 0.9vmin, 9px);
		margin-bottom: clamp(4px, 0.8vmin, 9px);
	}
	.pt-hcell {
		padding: clamp(8px, 1.5vmin, 14px) clamp(4px, 1vmin, 10px);
		border-radius: 8px;
		background: #e9a02a;
		color: #fff;
		text-align: center;
		white-space: nowrap;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.68rem, 1.65vmin, 1.02rem);
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
		display: flex;
		align-items: center;
		gap: clamp(2px, 0.6vmin, 6px);
		padding: clamp(4px, 0.9vmin, 9px) clamp(8px, 1.6vmin, 18px);
	}
	.pt-sym img {
		height: clamp(36px, 6.4vmin, 66px);
		width: auto;
		object-fit: contain;
	}
	.pt-sym--multi img {
		height: clamp(30px, 5.2vmin, 54px);
	}
	.pt-val {
		padding: clamp(6px, 1.2vmin, 14px) 0;
		border-left: 1px solid rgba(255, 255, 255, 0.09);
		text-align: center;
		color: #efe8d8;
		font-weight: 700;
		font-size: clamp(1rem, 2.5vmin, 1.55rem);
	}

	/* Page 3 — features. Two cards on top (wild | re-spin), full-width multiplier card below. */
	.ft-grid {
		width: 100%;
		margin-top: clamp(10px, 2vmin, 20px);
		display: grid;
		grid-template-columns: 1fr 2.1fr;
		grid-template-areas: 'wild respin' 'mult mult';
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
	.ft-card {
		padding: clamp(10px, 1.8vmin, 20px) clamp(12px, 2vmin, 24px);
		border: 2px solid #605553;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.015);
	}
	.ft-head {
		display: flex;
		align-items: center;
		gap: clamp(6px, 1.2vmin, 12px);
		margin-bottom: clamp(6px, 1.2vmin, 12px);
	}
	.ft-icon {
		height: clamp(26px, 4vmin, 42px);
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

	/* Guy tucked into the popup's bottom-left corner, stats centred to his right. */
	.tu-lower {
		position: relative;
		width: 100%;
		margin-top: clamp(18px, 3vmin, 36px);
		min-height: clamp(220px, 36vmin, 320px);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tu-guy {
		position: absolute;
		left: 0;
		bottom: 0;
		width: clamp(240px, 36vmin, 400px);
		height: auto;
		pointer-events: none;
		z-index: 1;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
	}

	.tu-stats {
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		gap: clamp(10px, 1.8vmin, 18px) clamp(14px, 2.6vmin, 28px);
		margin-left: clamp(120px, 22vmin, 240px);
	}
	.tu-stat {
		display: contents;
	}
	.tu-stat-label {
		justify-self: end;
		color: #ece2cd;
		font-weight: 600;
		font-size: clamp(0.95rem, 2.3vmin, 1.4rem);
	}
	.tu-stat-big {
		justify-self: start;
		color: #f0a112;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.7rem, 4.4vmin, 2.8rem);
		letter-spacing: 0.01em;
	}
	.tu-pill {
		justify-self: start;
		padding: clamp(4px, 0.8vmin, 8px) clamp(12px, 2vmin, 20px);
		border-radius: 8px;
		background: #f0a112;
		color: #241f1c;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: clamp(1rem, 2.4vmin, 1.4rem);
		letter-spacing: 0.01em;
	}

	.tu-page--placeholder {
		min-height: min(520px, 82dvh);
		justify-content: center;
	}

	/* Nav arrows + page indicator pinned to the bottom. */
	.tu-nav {
		position: absolute;
		left: 0;
		right: 0;
		bottom: clamp(18px, 3vmin, 30px);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 2vmin, 20px);
	}
	.tu-arrow {
		width: clamp(44px, 6vmin, 58px);
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
</style>

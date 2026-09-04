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

	// Page 6 (general info) icons.
	const reloadArt = ap('/assets/mcschmutzo/tutorial/reload.webp');
	const scalesArt = ap('/assets/mcschmutzo/tutorial/scales.webp');

	// Page 7 (user interface guide) — the design's icon-button set (self-contained SVGs:
	// dark disc + #605554 border + white glyph, so they match the HUD 1:1).
	const uiIcon = (n: string) => ap(`/assets/mcschmutzo/ui-icons/${n}`);
	const UI_ITEMS: { label: string; desc: string; icon: string }[] = [
		{ label: 'SPIN', desc: 'Starts a new game round.', icon: uiIcon('spin.svg') },
		{ label: 'AUTO SPINS', desc: 'Opens the Auto Spins menu.', icon: uiIcon('auto.svg') },
		{ label: 'TURBO', desc: 'Enables faster reel spins.', icon: uiIcon('turbo.svg') },
		{ label: 'BET +', desc: 'Increases your total bet.', icon: uiIcon('plus.svg') },
		{ label: 'BET -', desc: 'Decreases your total bet.', icon: uiIcon('minus.svg') },
		{ label: 'INFO', desc: 'Opens the game information.', icon: uiIcon('info.svg') },
		{ label: 'SOUND', desc: 'Turns game sound on or off.', icon: uiIcon('sound.svg') },
		{ label: 'PREVIOUS', desc: 'Goes to the previous page.', icon: uiIcon('prev.svg') },
		{ label: 'NEXT', desc: 'Goes to the next page.', icon: uiIcon('next.svg') },
		{ label: 'CLOSE', desc: 'Closes the current window.', icon: uiIcon('close.svg') },
		{ label: 'MENU', desc: 'Opens game menu.', icon: uiIcon('menu.svg') },
		{ label: 'MUSIC', desc: 'Turns game music on or off.', icon: uiIcon('music.svg') },
	];
	const MULT_LADDER = [
		'1x', '2x', '3x', '4x', '5x', '6x', '8x', '10x', '12x', '15x', '20x', '25x', '30x', '35x',
		'40x', '50x', '60x', '70x', '80x', '120x', '150x', '200x', '250x', '300x', '350x', '400x',
		'500x', '600x', '800x', '1000x',
	];

	// Page 5 (feature buy) — four purchasable modes with cost + RTP.
	const FEATURE_BUYS: { title: string; body: string; cost: string; rtp: string }[] = [
		{
			title: 'ENHANCED MODE 1',
			body: 'For a cost of 2× the Base Bet, the chance of triggering Free Games is increased by 4×. All other game mechanics remain unchanged.',
			cost: '2× the Base Bet',
			rtp: '96.1%',
		},
		{
			title: 'ENHANCED MODE 2',
			body: 'For a cost of 10× the Base Bet, the chance of triggering Free Games is increased by 4×, with the enhanced mode configured toward the Super Bonus / maximum entry condition. All other game mechanics remain unchanged.',
			cost: '10× the Base Bet',
			rtp: '96.1%',
		},
		{
			title: 'NORMAL BONUS',
			body: 'For a cost of 100× the Base Bet, the player directly enters the Normal Bonus. The Normal Bonus is played using its standard Free Games entry configuration.',
			cost: '100× the Base Bet',
			rtp: '96.1%',
		},
		{
			title: 'SUPER BONUS',
			body: 'For a cost of 500× the Base Bet, the player directly enters the Super Bonus. The Super Bonus begins using its enhanced / maximum Free Games entry configuration.',
			cost: '500× the Base Bet',
			rtp: '96.1%',
		},
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
				<p class="tu-body">
					McSchmutzo is played on a 5×5 reel setup and pays on 50 fixed win-lines. Winning
					combinations are formed by landing matching symbols on an active win-line, starting from
					the leftmost reel and continuing on consecutive reels. All wins are calculated according
					to the symbol values shown in the Paytable. Multiple winning combinations may be awarded on
					the same game round.
				</p>

				<div class="tu-lower">
					<img class="tu-guy" src={guyArt} alt="" draggable="false" />
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
		{:else if page === 4}
			<div class="tu-page tu-page--placeholder">
				<h2 class="tu-title">{i18nDerived.translate('WAYS TO WIN')}</h2>
				<p class="tu-body">Coming soon.</p>
			</div>
		{:else if page === 5}
			<div class="tu-page">
				<h2 class="tu-title">{i18nDerived.translate('FEATURE BUY')}</h2>

				<div class="fb-grid">
					{#each FEATURE_BUYS as fb}
						<div class="fb-card">
							<h3 class="fb-title">{fb.title}</h3>
							<p class="fb-body">{fb.body}</p>
							<div class="fb-cost">{fb.cost}</div>
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
							<p>If a game round is interrupted, it will continue when the game is reloaded, where possible.</p>
							<p>All valid wagers and potential winnings remain active until the round is fully completed.</p>
						</div>
					</div>

					<div class="gi-card">
						<div class="gi-head">
							<img class="gi-icon" src={scalesArt} alt="" draggable="false" />
							<h3 class="gi-title">{i18nDerived.translate('LEGAL NOTICE')}</h3>
						</div>
						<div class="gi-body">
							<p>Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds.</p>
							<p>The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only.</p>
							<p>Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser.</p>
							<p>TM and © 2026 Stake Engine.</p>
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
								<span class="ug-label">{it.label}</span>
								<span class="ug-desc">{it.desc}</span>
							</span>
						</div>
					{/each}
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
	<button
		class="tu-close"
		type="button"
		style={`background-image:url('${closeArt}')`}
		onclick={props.onclose}
		aria-label="Close"
	></button>
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
		position: absolute;
		top: calc(-1 * var(--x-size) - clamp(4px, 1.4vmin, 10px));
		right: clamp(0px, 1vmin, 6px);
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
	.gi-head {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(6px, 1.2vmin, 12px);
		margin-bottom: clamp(8px, 1.6vmin, 16px);
	}
	.gi-icon {
		height: clamp(24px, 3.6vmin, 40px);
		width: auto;
		object-fit: contain;
	}
	.gi-title {
		margin: 0;
		color: #f3e7cb;
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(0.85rem, 1.9vmin, 1.2rem);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}
	.gi-body {
		color: #cfc6b7;
		font-weight: 600;
		font-size: clamp(0.68rem, 1.5vmin, 0.92rem);
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
	.ug-grid {
		width: 100%;
		margin-top: clamp(14px, 2.6vmin, 30px);
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: clamp(10px, 1.8vmin, 18px) clamp(12px, 2.4vmin, 26px);
	}
	.ug-item {
		position: relative;
		display: flex;
		flex-direction: row;
		align-items: center;
		text-align: left;
		gap: clamp(12px, 1.8vmin, 20px);
		padding: clamp(15px, 2.4vmin, 26px) clamp(20px, 2.8vmin, 32px);
		border-radius: 16px;
		background: linear-gradient(180deg, #221e1b 0%, #191512 100%);
	}
	.ug-item::before {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2.03px solid #605553;
		border-radius: 12px;
		pointer-events: none;
	}
	.ug-btn {
		flex: 0 0 auto;
		width: clamp(42px, 6vmin, 60px);
		height: clamp(42px, 6vmin, 60px);
		object-fit: contain;
	}
	.ug-text {
		display: flex;
		flex-direction: column;
		gap: clamp(2px, 0.4vmin, 5px);
		min-width: 0;
	}
	.ug-label {
		color: #f2ead9;
		font-family: 'Nunito', sans-serif;
		font-weight: 800;
		font-size: clamp(0.82rem, 1.7vmin, 1.05rem);
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}
	.ug-desc {
		color: #b3a99c;
		font-family: 'Nunito', sans-serif;
		font-weight: 600;
		font-size: clamp(0.66rem, 1.4vmin, 0.85rem);
		line-height: 1.35;
	}

	/* Guy on the left, stats stacked to his right — one row (matches design). */
	.tu-lower {
		width: 100%;
		margin-top: clamp(14px, 2.6vmin, 32px);
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: clamp(6px, 2.5vw, 34px);
	}
	.tu-guy {
		flex: 0 0 auto;
		align-self: flex-end;
		width: clamp(150px, 42%, 300px);
		height: auto;
		pointer-events: none;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4));
	}
	.tu-stats {
		flex: 0 1 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(16px, 3.4vmin, 34px);
	}
	/* Each stat: label above the value (design). */
	.tu-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(4px, 1vmin, 10px);
	}
	.tu-stat-label {
		color: #ece2cd;
		font-weight: 600;
		font-size: clamp(0.95rem, 2.3vmin, 1.4rem);
		white-space: nowrap;
	}
	.tu-stat-big {
		color: #f0a112;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.5rem, 4.4vmin, 2.8rem);
		letter-spacing: 0.01em;
		white-space: nowrap;
	}
	.tu-pill {
		padding: clamp(4px, 0.8vmin, 8px) clamp(14px, 2.4vmin, 24px);
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

	/* ── Mobile / short viewports ───────────────────────────────────────────────────────────────
	   Turn the fixed desktop card into a scaled, scrollable panel: the page body scrolls and the
	   nav becomes a footer that stays put, so no content is ever clipped. (Also catches short
	   landscape windows, where height — not width — is the constraint.) */
	@media (max-width: 680px), (max-height: 560px) {
		.tu-root {
			width: 94vw;
			max-height: 94dvh;
		}
		.tu-popup {
			display: flex;
			flex-direction: column;
			min-height: 0;
			/* Leave headroom above the popup so the close button clears its top edge (design). */
			max-height: 84dvh;
			padding: clamp(16px, 4.5vw, 30px) clamp(14px, 4vw, 26px) 0;
			overflow: hidden;
		}
		/* The page content is the scroll area; the nav sits below it as a static footer. */
		.tu-page {
			flex: 1 1 auto;
			min-height: 0;
			width: 100%;
			overflow-y: auto;
			overflow-x: hidden;
			padding-bottom: clamp(8px, 2vw, 14px);
			-webkit-overflow-scrolling: touch;
		}
		.tu-nav {
			position: relative;
			flex: 0 0 auto;
			left: auto;
			right: auto;
			bottom: auto;
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
		/* FEATURES: wild / re-spin / multiplier stacked. */
		.ft-grid {
			grid-template-columns: 1fr;
			grid-template-areas: 'wild' 'respin' 'mult';
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
		/* USER INTERFACE GUIDE: single-column icon-left list (design). */
		.ug-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

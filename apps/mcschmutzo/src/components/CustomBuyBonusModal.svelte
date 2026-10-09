<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
	const artExtraChance = ap('/assets/mcschmutzo/buybonus/extra-chance.webp');
	const artLockSpin = ap('/assets/mcschmutzo/buybonus/burger.webp');
	const artNormalBonus = ap('/assets/mcschmutzo/buybonus/normal-bonus.webp');
	const artSuperBonus = ap('/assets/mcschmutzo/buybonus/super-bonus.webp');
	const minusArt = ap('/assets/mcschmutzo/autoplay/minus.svg');
	const plusArt = ap('/assets/mcschmutzo/autoplay/plus-icon.svg');
	const cardFrameArt = ap('/assets/mcschmutzo/popup/card-frame.svg');
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
	import { popIn, popOut } from '../lib/popOut';
	import PopupScrews from './PopupScrews.svelte';
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { mcschmutzoStakeDerived } from '../state/mcschmutzoStake.svelte';
	import BurgerStack from './BurgerStack.svelte';
	import CustomConfirmModal from './CustomConfirmModal.svelte';
	import ScatterStack from './ScatterStack.svelte';

	type ModeId = 'enhancer1' | 'featureSpin' | 'bonus1' | 'bonus2';
	type Mode = {
		id: ModeId;
		multiplier: 2 | 20 | 100 | 500;
		title: string;
		description: string;
		action: 'activate' | 'buy';
		art: string;
		badge: string | null;
	};
	type Props = {
		onclose: () => void;
		isChanceActive: boolean;
		isFeatureActive: boolean;
		onToggleChance: () => void;
		onToggleFeature: () => void;
	};

	const props: Props = $props();

	// Long single words (Finnish "LISÄMAHDOLLISUUS", German compounds…) can't wrap, so they ran past
	// the card. Shrink THIS element's font until its widest word fits the card's content width (down
	// to 55%); normal-length titles are untouched. Re-fits on resize and when the text changes.
	function fitWords(node: HTMLElement, _text: string) {
		let base = 0;
		const fit = () => {
			node.style.fontSize = '';
			base = parseFloat(getComputedStyle(node).fontSize);
			// All in LAYOUT px (offsetWidth / clientWidth): the modal is transform-scaled to fit small
			// screens, so on-screen (getBoundingClientRect) widths would under-report and never shrink.
			const box = node.parentElement;
			if (!box) return;
			const cs = getComputedStyle(box);
			const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
			const probe = document.createElement('span');
			probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;letter-spacing:inherit';
			node.appendChild(probe);
			let widest = 0;
			for (const w of (node.textContent || '').split(/\s+/)) {
				if (!w) continue;
				probe.textContent = w;
				widest = Math.max(widest, probe.offsetWidth);
			}
			probe.remove();
			if (widest > avail && widest > 0) node.style.fontSize = `${Math.max(base * 0.55, (base * avail) / widest)}px`;
		};
		const ro = new ResizeObserver(() => requestAnimationFrame(fit));
		const card = node.closest('.bb-card');
		if (card) ro.observe(card);
		document.fonts?.ready.then(fit);
		requestAnimationFrame(fit);
		return { update: () => requestAnimationFrame(fit), destroy: () => ro.disconnect() };
	}
	const context = getContext();
	// title/description are i18n keys (translated in the markup). Titles wrap naturally per language
	// instead of using hard '\n' line breaks.
	const modes: Mode[] = [
		{
			id: 'enhancer1',
			multiplier: 2,
			title: 'CARD CHANCE TITLE',
			description: 'CARD CHANCE DESC',
			action: 'activate',
			art: artExtraChance,
			badge: '3x',
		},
		{
			id: 'featureSpin',
			multiplier: 20,
			title: 'CARD FEATURE TITLE',
			description: 'CARD FEATURE DESC',
			action: 'activate',
			art: artLockSpin,
			badge: null,
		},
		{
			id: 'bonus1',
			multiplier: 100,
			title: 'NORMAL BONUS',
			description: 'CARD DEALIT DESC',
			action: 'buy',
			art: artNormalBonus,
			badge: '3x',
		},
		{
			id: 'bonus2',
			multiplier: 500,
			title: 'SUPER BONUS',
			description: 'CARD ALLIN DESC',
			action: 'buy',
			art: artSuperBonus,
			badge: '4x',
		},
	];

	// A description marks its key word (the scatter count) as *word*: odd parts are drawn red.
	const descParts = (text: string) => text.split(/\*([^*]+)\*/);

	const betAmount = $derived(stateBet.betAmount);
	const betOptions = $derived(stateConfig.betAmountOptions);
	// Index of the current bet among the authenticated levels. A bet that is not exactly a level
	// (a resumed round's amount, a float mismatch) steps from the nearest level at or below it, so
	// − / + never jump back to the first level or skip one.
	const currentBetIndex = $derived.by(() => {
		const exact = betOptions.indexOf(stateBet.betAmount);
		if (exact >= 0) return exact;
		let index = 0;
		for (let i = 0; i < betOptions.length; i += 1) {
			if (betOptions[i] <= stateBet.betAmount + 1e-9) index = i;
			else break;
		}
		return index;
	});
	const canDec = $derived(currentBetIndex > 0);
	const canInc = $derived(currentBetIndex < betOptions.length - 1);
	const formattedBet = $derived(mcschmutzoStakeDerived.formatCurrencyAmount(betAmount));
	const isSocial = $derived(!!stateConfig.jurisdiction?.socialCasino || stateUrlDerived.social());
	// Jurisdiction disabledBuyFeature: the bought bonuses (100x / 500x) cannot be purchased. The
	// activatable modes (extra chance, feature spin) are per-spin toggles, not feature buys.
	const buyFeatureDisabled = $derived(!!stateConfig.jurisdiction?.disabledBuyFeature);
	const decBetLabel = $derived(isSocial ? 'Decrease play amount' : 'Decrease bet');
	const incBetLabel = $derived(isSocial ? 'Increase play amount' : 'Increase bet');

	let confirmMode = $state<'featureSpin' | 'bonus1' | 'bonus2' | null>(null);

	const modeById = (id: ModeId) => modes.find((mode) => mode.id === id)!;
	const formatCost = (multiplier: number) =>
		mcschmutzoStakeDerived.formatCurrencyAmount(betAmount * multiplier);
	const canAfford = (multiplier: number) => stateBet.balanceAmount >= betAmount * multiplier;
	const isActive = (id: ModeId) =>
		(id === 'enhancer1' && props.isChanceActive) ||
		(id === 'featureSpin' && props.isFeatureActive);
	const isDisabled = (mode: Mode) =>
		!isActive(mode.id) &&
		(!canAfford(mode.multiplier) || (mode.action === 'buy' && buyFeatureDisabled));
	const buttonLabel = (mode: Mode) =>
		isActive(mode.id)
			? i18nDerived.deactivate()
			: mode.action === 'buy'
				? i18nDerived.buy()
				: i18nDerived.activate();

	const closeWithToggle = (toggle: () => void) => {
		toggle();
		props.onclose();
	};
	const chooseMode = (id: ModeId) => {
		if (isDisabled(modeById(id))) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (id === 'enhancer1') {
			closeWithToggle(props.onToggleChance);
			return;
		}
		if (id === 'featureSpin' && props.isFeatureActive) {
			closeWithToggle(props.onToggleFeature);
			return;
		}
		confirmMode = id;
	};

	const confirmCost = $derived(confirmMode ? formatCost(modeById(confirmMode).multiplier) : '');
	// The confirm sentence split around its %cost% (in whatever language): the words before it are the
	// message line, the cost is the dialog's big amount, and anything after it is a small last line
	// (dropped when it's only the closing punctuation — and then so is a Spanish opening ¿).
	const confirmCopy = $derived.by(() => {
		if (!confirmMode) return { message: '', after: '' };
		const MARK = '\u0000';
		const text = i18nDerived.translateVars(
			confirmMode === 'featureSpin' ? 'CONFIRM ACTIVATE TEXT' : 'CONFIRM TEXT',
			{ mode: i18nDerived.translate(modeById(confirmMode).title), cost: MARK },
		);
		const at = text.indexOf(MARK);
		if (at < 0) return { message: text, after: '' };
		const after = text.slice(at + MARK.length).trim();
		const bare = /^[\s?.!؟。？！]*$/.test(after);
		const message = text.slice(0, at).trim();
		return { message: bare ? message.replace(/^[¿¡]\s*/, '') : message, after: bare ? '' : after };
	});
	const closeConfirm = () => (confirmMode = null);
	const confirmAccept = () => {
		if (!confirmMode) return;
		// Re-check at the moment of purchase: the balance or bet may have changed under the dialog.
		if (isDisabled(modeById(confirmMode))) {
			confirmMode = null;
			return;
		}
		if (confirmMode === 'featureSpin') {
			confirmMode = null;
			closeWithToggle(props.onToggleFeature);
			return;
		}
		stateBet.activeBetModeKey = confirmMode;
		confirmMode = null;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'bet' });
	};

	const stepBet = (direction: -1 | 1) => {
		if (betOptions.length === 0) return;
		const index = Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + direction));
		const next = betOptions[index];
		if (typeof next !== 'number' || next === stateBet.betAmount) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		// Set the RGS level itself: the shared setBetAmount clamps to what the balance covers, which
		// produced amounts that aren't valid bet levels. Affordability is enforced by the spin guard.
		stateBet.betAmount = next;
	};

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			if (confirmMode) closeConfirm();
			else props.onclose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="bb-backdrop" in:fade|global={{ duration: 220 }} out:fade|global={{ duration: 200 }} onclick={props.onclose}></div>

<button
	in:fade|global={{ duration: 220, delay: 200 }}
	out:fade|global={{ duration: 120 }}
	class="bb-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={props.onclose}
	aria-label={i18nDerived.translate('CLOSE')}
></button>

<section class="bb-panel" in:popIn|global out:popOut|global role="dialog" aria-modal="true" aria-labelledby="bb-title">
	<h2 id="bb-title" class="bb-title">{i18nDerived.buyBonus()}</h2>

	<div class="bb-grid">
		{#each modes as mode (mode.id)}
			<article class="bb-card" class:bb-card--active={isActive(mode.id)}>
				<!-- Figma 8888:4033: cream body + red header under the screwed-down frame, a dashed rule -->
				<div class="bb-card-body"></div>
				<div class="bb-card-head"></div>
				<img class="bb-card-frame" src={cardFrameArt} alt="" draggable="false" />
				<PopupScrews frame="card" />
				<span class="bb-dash" aria-hidden="true"></span>

				<h3 class="bb-card-title" use:fitWords={i18nDerived.translate(mode.title)}>{i18nDerived.translate(mode.title)}</h3>

				<div class="bb-card-content">
					<p class="bb-desc" use:fitWords={i18nDerived.translate(mode.description)}>
						{#each descParts(i18nDerived.translate(mode.description)) as part, i (i)}{#if i % 2}<span class="bb-desc-hot">{part}</span>{:else}{part}{/if}{/each}
					</p>

					<div
						class="bb-art"
						class:bb-art--burger={mode.id === 'featureSpin'}
						class:bb-art--scatter={mode.id === 'bonus1'}
						class:bb-art--wheel={mode.id === 'bonus2'}
						class:bb-art--chance={mode.id === 'enhancer1'}
					>
						{#if mode.id === 'featureSpin'}
							<!-- The Lock & Re-spin feature IS the burger symbol — rebuild it from its slices so it
							     assembles / disassembles exactly like the reels. -->
							<div class="bb-burger-holder"><BurgerStack /></div>
						{:else if mode.id === 'bonus1' || mode.id === 'enhancer1'}
							<!-- Both scatter-shack cards ARE the SCATTER symbol — rebuild it from its parts so the
							     sign sways like the reels. Offset the two so they don't sway in lock-step. -->
							<div class="bb-scatter-holder">
								<ScatterStack delay={mode.id === 'enhancer1' ? -1.35 : 0} />
							</div>
						{:else}
							<img src={mode.art} alt="" draggable="false" />
						{/if}
						{#if mode.badge}<span class="bb-badge">{mode.badge}</span>{/if}
					</div>

					<!-- (not in the design, kept: the price has to be on the card before the player buys) -->
					<div class="bb-amount">
						<span class="bb-mult">{mode.multiplier}x</span>
						<span class="bb-cost">{formatCost(mode.multiplier)}</span>
					</div>

					<button
						class="bb-btn"
						class:bb-btn--buy={mode.action === 'buy'}
						type="button"
						disabled={isDisabled(mode)}
						onclick={() => chooseMode(mode.id)}
						aria-label={buttonLabel(mode)}
					>
						<span class="bb-btn__label">{buttonLabel(mode)}</span>
					</button>
				</div>
			</article>
		{/each}
	</div>

	<footer class="bb-betbar">
		<div class="bb-betbox">
			<button
				class="bb-step"
				type="button"
				style={`background-image:url('${minusArt}')`}
				disabled={!canDec}
				aria-label={decBetLabel}
				onclick={() => stepBet(-1)}
			></button>
			<div class="bb-bet">
				<span class="bb-bet-label">{i18nDerived.translate('BET')}</span>
				<strong class="bb-bet-amount">{formattedBet}</strong>
			</div>
			<button
				class="bb-step"
				type="button"
				style={`background-image:url('${plusArt}')`}
				disabled={!canInc}
				aria-label={incBetLabel}
				onclick={() => stepBet(1)}
			></button>
		</div>
	</footer>
</section>

{#if confirmMode}
	<CustomConfirmModal
		title={i18nDerived.translate(
			confirmMode === 'featureSpin' ? modeById(confirmMode).title : 'CONFIRM PURCHASE',
		)}
		message={confirmCopy.message}
		amount={confirmCost}
		after={confirmCopy.after}
		cancelLabel={i18nDerived.translate('CANCEL')}
		confirmLabel={i18nDerived.translate('CONFIRM')}
		oncancel={closeConfirm}
		onconfirm={confirmAccept}
		onclose={closeConfirm}
	/>
{/if}

<style>
	.bb-backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.74);
		backdrop-filter: blur(4px);
	}

	.bb-close {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 63;
		width: clamp(42px, 6vmin, 52px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.bb-close:hover {
		filter: brightness(1.2);
	}
	.bb-close:active {
		transform: scale(0.94);
	}

	/* The panel is just the layout box (title, cards, bet stepper) — the cards carry the look. */
	.bb-panel {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 59;
		transform: translate(-50%, -50%);
		width: max-content;
		max-width: 98vw;
		max-height: 94dvh;
		overflow-y: auto;
		box-sizing: border-box;
		padding: clamp(10px, 2vmin, 22px);
		font-family: 'Nunito', sans-serif;
	}

	/* Title: Comica Brush 36 in the design (Bowlby One SC until that font ships). */
	.bb-title {
		margin: 0 0 clamp(14px, 3.4vmin, 36px);
		text-align: center;
		color: #e7d5b7;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: clamp(1.6rem, 4.6vmin, 2.25rem);
		line-height: 1;
		letter-spacing: 1.4px;
		text-transform: uppercase;
	}

	/* Four 267×363 cards (Figma 8888:3854), as big as the screen allows: by width, four across; by
	   height, leaving room for the title and the bet stepper. */
	.bb-grid {
		--gap: clamp(8px, 1.2vmin, 12px);
		--cw: min(330px, calc((95vw - 3 * var(--gap) - 44px) / 4), calc((94dvh - 210px) * 267 / 363));
		display: grid;
		grid-template-columns: repeat(4, var(--cw));
		justify-content: center;
		gap: var(--gap);
	}

	/* Each card lays out in design px: --u is one of the card's 267. */
	.bb-card {
		position: relative;
		width: var(--cw);
		aspect-ratio: 267 / 363;
		container-type: inline-size;
		text-align: center;
		transition: filter 0.18s ease;
	}
	.bb-card > * {
		--u: calc(100cqw / 267);
	}
	/* the selected (toggled-on) Lock Feature Spin glows (Extra Chance never highlights) */
	.bb-card--active:not(:first-child) {
		filter: drop-shadow(0 0 10px rgba(255, 196, 100, 0.75));
	}
	.bb-card-body,
	.bb-card-head {
		position: absolute;
	}
	.bb-card-body {
		left: calc(8 * var(--u));
		top: calc(92 * var(--u));
		width: calc(251 * var(--u));
		height: calc(263 * var(--u));
		background: #f9dca6;
	}
	.bb-card-head {
		left: calc(7 * var(--u));
		top: calc(3 * var(--u));
		width: calc(250 * var(--u));
		height: calc(95 * var(--u));
		border-radius: calc(7 * var(--u));
		background: #b1190a;
	}
	.bb-card-frame {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		user-select: none;
	}
	.bb-dash {
		position: absolute;
		left: calc(13 * var(--u));
		top: calc(107.5 * var(--u));
		width: calc(242 * var(--u));
		height: max(1px, calc(1 * var(--u)));
		background: repeating-linear-gradient(
			90deg,
			#b11909 0 calc(14 * var(--u)),
			transparent calc(14 * var(--u)) calc(28 * var(--u))
		);
	}

	/* Title: Comica Brush 24 (Bowlby One SC for now), cream with a dark outline, centred in the header. */
	.bb-card-title {
		position: absolute;
		left: calc(30 * var(--u));
		right: calc(30 * var(--u));
		top: calc(10 * var(--u));
		height: calc(84 * var(--u));
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #e7d5b7;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(21 * var(--u));
		line-height: 1.2;
		letter-spacing: calc(1.4 * var(--u));
		text-transform: uppercase;
		text-wrap: balance;
	}

	/* Copy, art, price and button down the cream body. */
	.bb-card-content {
		position: absolute;
		left: calc(26 * var(--u));
		right: calc(26 * var(--u));
		top: calc(118 * var(--u));
		bottom: calc(27 * var(--u));
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		justify-items: center;
		gap: calc(5 * var(--u));
	}
	.bb-card-content > * {
		--u: calc(100cqw / 267);
	}
	.bb-desc {
		margin: 0;
		max-width: calc(206 * var(--u));
		color: #000;
		font-weight: 900;
		font-size: calc(15 * var(--u));
		line-height: 1.3;
		letter-spacing: calc(0.48 * var(--u));
		text-wrap: balance;
	}
	.bb-desc-hot {
		color: #b1190a;
	}

	.bb-art {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 0;
	}
	.bb-art img {
		width: auto;
		height: calc(74 * var(--u));
		object-fit: contain;
		filter: drop-shadow(0 calc(3 * var(--u)) calc(4 * var(--u)) rgba(0, 0, 0, 0.3));
	}
	/* The Lock & Re-spin feature IS the burger symbol — it's rebuilt from its slices (BurgerStack) so it
	   assembles / disassembles like the reels. The holder fixes the board cell's aspect so the slices
	   line up; the art box clips so the separating stack never draws over the copy, with padding for
	   the buns' full throw (--sep 0.55: top bun rises ~14% of the burger's height, bottom drops ~11%). */
	.bb-art--burger {
		overflow: hidden;
		padding-block: calc(11 * var(--u)) calc(8 * var(--u));
	}
	.bb-burger-holder {
		height: calc(58 * var(--u));
		aspect-ratio: 1.077;
		--sep: 0.55;
	}
	/* Both scatter cards rebuild the SCATTER symbol (stand + swaying sign) at the icon footprint. */
	.bb-scatter-holder {
		height: calc(76 * var(--u));
		aspect-ratio: 1;
	}
	/* Super Bonus IS the prize wheel — spin it steadily so the card previews what it does. */
	.bb-art--wheel img {
		animation: bb-wheel-spin 5.5s linear infinite;
	}
	@keyframes bb-wheel-spin {
		from { transform: rotate(0); }
		to { transform: rotate(360deg); }
	}
	@media (prefers-reduced-motion: reduce) {
		.bb-art--wheel img {
			animation: none;
		}
	}
	/* Red multiplier coin on the art's corner (design: #c10c01, 1.24px #ebb877 rim, Bowlby 11.2). */
	.bb-badge {
		position: absolute;
		right: -6%;
		bottom: 2%;
		display: grid;
		place-items: center;
		/* (floors: on a portrait phone --u left the coin ~22px and its 3x ~8px — the smallest text in
		   the game; kept modest so the coin doesn't reach the price row on narrow phones) */
		width: max(calc(33.6 * var(--u)), 25px);
		height: max(calc(33.6 * var(--u)), 25px);
		box-sizing: border-box;
		border-radius: 50%;
		border: max(1px, calc(1.24 * var(--u))) solid #ebb877;
		background: #c10c01;
		color: #feefcf;
		font-family: 'Bowlby One SC', sans-serif;
		font-size: max(calc(11.25 * var(--u)), 9px);
		line-height: 1;
		letter-spacing: calc(0.98 * var(--u));
		text-transform: uppercase;
		white-space: nowrap;
	}

	.bb-amount {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: calc(6 * var(--u));
		color: #2b2c2a;
		font-weight: 900;
		font-size: calc(15 * var(--u));
		line-height: 1;
	}
	.bb-mult {
		color: #b1190a;
	}

	/* ACTIVATE = dark #2b2c2a with a #605553 rim; BUY = the red pill with an inner dark-red rim and a
	   white glint along the top (215×50 in the design). Labels: Comica Brush 20 (Bowlby One SC for now). */
	.bb-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: calc(215 * var(--u));
		height: calc(50 * var(--u));
		padding: 0 calc(12 * var(--u));
		border: calc(2 * var(--u)) solid #605553;
		border-radius: calc(12 * var(--u));
		background: #2b2c2a;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.bb-btn__label {
		position: relative;
		color: #feefcf;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: calc(16 * var(--u));
		line-height: 1.05;
		letter-spacing: calc(1.65 * var(--u));
		text-transform: uppercase;
		text-align: center;
		overflow-wrap: break-word;
	}
	.bb-btn--buy {
		border: none;
		background: linear-gradient(95deg, #c41e0a 49.3%, #ae1809 99%);
	}
	.bb-btn--buy::before {
		content: '';
		position: absolute;
		inset: calc(5 * var(--u));
		border: calc(2 * var(--u)) solid #851406;
		border-radius: calc(10 * var(--u));
	}
	.bb-btn--buy::after {
		content: '';
		position: absolute;
		top: calc(3.5 * var(--u));
		left: calc(12 * var(--u));
		width: calc(186 * var(--u));
		height: max(1px, calc(1 * var(--u)));
		background: linear-gradient(90deg, rgba(255, 255, 255, 0), #fff 50%, rgba(255, 255, 255, 0));
	}
	.bb-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}
	.bb-btn:active:not(:disabled) {
		transform: scale(0.97);
	}
	.bb-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Bet stepper (Figma 8888:3838): a cream pill with a red rim — −, a red BET tag over the amount, +. */
	.bb-betbar {
		display: flex;
		justify-content: center;
		margin-top: clamp(14px, 4.4vmin, 52px);
	}
	.bb-betbox {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 278px;
		max-width: 80vw;
		box-sizing: border-box;
		padding: 6px 12px;
		border-radius: 8px;
		border: 2px solid #b21a0a;
		background: #fef4d5;
		box-shadow: 0 0 0 3px #fef4d5;
	}
	.bb-step {
		flex: 0 0 auto;
		width: 48px;
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.bb-step:hover:not(:disabled) {
		filter: brightness(1.15);
	}
	.bb-step:active:not(:disabled) {
		transform: scale(0.92);
	}
	.bb-step:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.bb-bet {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		line-height: 1;
	}
	.bb-bet-label {
		padding: 4px 12px;
		border-radius: 4px;
		background: #b1190a;
		color: #f9dca6;
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-size: 10px;
		letter-spacing: 0.67px;
		text-transform: uppercase;
	}
	.bb-bet-amount {
		color: #2b2c2a;
		font-family: 'Luckiest Guy', 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: 23px;
		line-height: 1;
		/* Luckiest Guy sits high in its line box */
		padding-top: 3px;
	}

	/* Tall narrow screens (tablet portrait): two by two. */
	@media (max-width: 900px) and (min-height: 501px) {
		.bb-grid {
			--cw: min(300px, calc((95vw - var(--gap) - 44px) / 2), calc(((94dvh - 210px) / 2 - var(--gap)) * 267 / 363));
			grid-template-columns: repeat(2, var(--cw));
		}
	}
	/* Phones: still two by two, so all four bonuses are in view at once (one per row left three of
	   them below the fold). Sized by width; on short phones the cards keep a readable 150px and the
	   panel scrolls the last few px instead. The small cards lift their copy to a legible floor. */
	@media (max-width: 520px) and (min-height: 501px) {
		.bb-panel {
			padding-inline: 6px;
		}
		.bb-grid {
			--gap: 8px;
			--cw: min(
				200px,
				calc((100vw - 12px - var(--gap)) / 2),
				max(150px, calc(((94dvh - 190px) / 2 - var(--gap)) * 267 / 363))
			);
			grid-template-columns: repeat(2, var(--cw));
		}
		.bb-title {
			margin-bottom: 12px;
		}
		/* the bet stepper, a size down: at desktop size it dominated the foot of a phone */
		.bb-betbox {
			width: 224px;
			gap: 8px;
			padding: 4px 10px;
		}
		.bb-step {
			width: 38px;
		}
		.bb-bet-label {
			padding: 3px 10px;
			font-size: 9px;
		}
		.bb-bet-amount {
			font-size: 19px;
		}
		.bb-betbar {
			margin-top: 12px;
		}
		.bb-desc {
			font-size: max(9.5px, calc(15 * var(--u)));
			line-height: 1.2;
			letter-spacing: 0;
		}
		.bb-amount {
			font-size: max(10.5px, calc(15 * var(--u)));
		}
		.bb-btn__label {
			font-size: max(11px, calc(16 * var(--u)));
		}
		/* Narrow portrait phones (e.g. 320-wide): the fixed 42-52px X crowds the near-full-width popup —
		   shrink it and tuck it into the corner, matching the info/auto popups. */
		.bb-close {
			width: clamp(28px, 8.5vw, 36px);
			top: 8px;
			right: 8px;
		}
	}

	/* Short viewports (mobile landscape, incl. tiny 400x225 popouts): lay the panel out at a FIXED
	   design size, then transform-scale the whole thing down to fit whichever viewport dimension is
	   tighter. transform-origin stays centred, so translate(-50%,-50%) still centres it. */
	@media (max-height: 500px) {
		.bb-panel {
			width: 900px;
			max-width: none;
			max-height: none;
			overflow: visible;
			padding: 14px;
			/* 900x500 design box → fit into 96vw x 94vh, min() picks the limiting axis. */
			transform: translate(-50%, -50%)
				scale(min(calc(96vw / 900px), calc(94vh / 500px)));
		}
		.bb-title {
			margin-bottom: 14px;
			font-size: 2.2rem;
		}
		.bb-grid {
			--gap: 10px;
			--cw: 208px;
			grid-template-columns: repeat(4, var(--cw));
		}
		.bb-betbar {
			margin-top: 14px;
		}
		.bb-close {
			width: clamp(34px, 7vmin, 46px);
			top: 10px;
			right: 10px;
		}
	}

	/* Tiny popouts (~400x225): shrink the close (X) so it doesn't dominate the small screen. The
	   whole panel is scaled to ~0.42 here, so the description would land at ~5px — drop it (the
	   title, art and the confirm dialog say what each bonus is) and give its room to bigger title,
	   price and button text, which then read at ~8-9px. */
	@media (max-height: 300px) {
		.bb-close { width: clamp(20px, 9dvh, 30px); top: 6px; right: 6px; }
		.bb-desc { display: none; }
		.bb-card-content { grid-template-rows: minmax(0, 1fr) auto auto; gap: calc(8 * var(--u)); }
		.bb-card-title { font-size: calc(30 * var(--u)); letter-spacing: calc(0.8 * var(--u)); }
		.bb-art img { height: calc(96 * var(--u)); }
		.bb-scatter-holder { height: calc(96 * var(--u)); }
		.bb-burger-holder { height: calc(74 * var(--u)); }
		.bb-amount { font-size: calc(24 * var(--u)); }
		.bb-btn { height: calc(60 * var(--u)); }
		.bb-btn__label { font-size: calc(24 * var(--u)); }
		.bb-title { font-size: 2.8rem; }
		.bb-bet-label { font-size: 14px; }
		.bb-bet-amount { font-size: 30px; }
	}
</style>

<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const guyArt = ap('/assets/mcschmutzo/tutorial/overview-guy.webp');
	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');

	const ARROW_L = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 5l-7 7 7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	const ARROW_R = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5l7 7-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

	const TOTAL_PAGES = 7;
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
		{:else}
			<div class="tu-page tu-page--placeholder">
				<h2 class="tu-title">PAGE {page}</h2>
				<p class="tu-body">Coming soon.</p>
			</div>
		{/if}

		<div class="tu-nav">
			<button class="tu-arrow" type="button" onclick={prev} disabled={page === 1} aria-label="Previous">
				{@html ARROW_L}
			</button>
			<button
				class="tu-arrow"
				type="button"
				onclick={next}
				disabled={page === TOTAL_PAGES}
				aria-label="Next"
			>
				{@html ARROW_R}
			</button>
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

	/* Guy bottom-left, stats centred to the right of him. */
	.tu-lower {
		position: relative;
		width: 100%;
		margin-top: clamp(18px, 3vmin, 36px);
		min-height: clamp(200px, 34vmin, 300px);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tu-guy {
		position: absolute;
		left: clamp(-24px, -3vmin, -16px);
		bottom: clamp(-70px, -10vmin, -96px);
		width: clamp(180px, 26vmin, 300px);
		height: auto;
		pointer-events: none;
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
		font-size: clamp(1.3rem, 3.4vmin, 2.1rem);
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
		display: grid;
		place-items: center;
		border: 2px solid #4c433d;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 32%, #2b2622, #17130f);
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.tu-arrow :global(svg) {
		width: 42%;
		height: 42%;
		display: block;
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

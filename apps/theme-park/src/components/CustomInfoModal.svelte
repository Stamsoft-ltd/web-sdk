<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Paytable symbol art (high symbols first, then royals).
	const symImg = (name: string) => ap(`/assets/theme-park/v2/symbols/${name}.png`);
	// Feature / mode logos (reused from the buy-bonus modes set).
	const modeImg = (name: string) => ap(`/assets/theme-park/v2/modes/${name}-desktop.png`);

	// Landscape (desktop) tutorial box: neon gradient frame, the duck-on-coaster hero, and the logo.
	const tutorialBg = ap('/assets/theme-park/v2/info/tutorial-bg.webp');
	const rollerDuck = ap('/assets/theme-park/v2/info/roller-duck.webp');
	const gameLogo = ap('/assets/theme-park/v2/splash/logo.webp');
	// Ways-to-win: the finished 15-payline diagram (downloads).
	const waysToWin = ap('/assets/theme-park/v2/info/ways-to-win.svg');

	// Neon gradient box frame (download "S pad") — the same 9-slice border art the buy-bonus cards use.
	const neonFrame = ap('/assets/theme-park/v2/hud/neon-frame.png');
	// General-info card icons (rotate = interrupted rounds, scales = legal notice) — hi-res downloads.
	const icInterrupted = ap('/assets/theme-park/v2/info/ic_interrupted.svg');
	const icLegal = ap('/assets/theme-park/v2/info/ic_legal.svg');

	// UI-guide: the game's REAL control buttons (dark neon circles with the exact glyphs), so it
	// matches the HUD. A few controls have no dedicated button art — those use a white glyph composed
	// into a matching circle.
	const btnSpin = ap('/assets/theme-park/v2/controls/spin-default.png');
	const btnAuto = ap('/assets/theme-park/v2/controls/btn-auto.png');
	const btnTurbo = ap('/assets/theme-park/v2/controls/btn-turbo.png');
	const btnPlus = ap('/assets/theme-park/v2/controls/btn-plus.png');
	const btnMinus = ap('/assets/theme-park/v2/controls/btn-minus.png');
	const btnSound = ap('/assets/theme-park/v2/controls/btn-sound.png');
	const btnMenu = ap('/assets/theme-park/v2/controls/btn-menu.png');
	const btnArrowLeft = ap('/assets/theme-park/v2/controls/arrow-left.png');
	const btnArrowRight = ap('/assets/theme-park/v2/controls/arrow-right.png');
	const glyphClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
	// Modal chrome: close-X and nav arrows.
	const iconClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
	const iconArrow = ap('/assets/theme-park/v2/splash/arrow.svg');
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { templateStakeDerived } from '../state/templateStake.svelte';
	import InfoBorderLights from './InfoBorderLights.svelte';

	type Props = { onclose: () => void; layoutType?: string };
	const props: Props = $props();
	// Wide (landscape) box on desktop/landscape; the tall portrait card on phones in portrait.
	const wide = $derived(props.layoutType !== 'portrait');

	const PAGES = [
		'OVERVIEW',
		'PAYTABLE',
		'FEATURES',
		'WAYS TO WIN',
		'FEATURE BUY',
		'GENERAL INFO',
		'USER INTERFACE GUIDE',
	] as const;
	const RTP = '96.10%';
	const RTP_SHORT = '96.1%';
	const MAX_WIN = '25,000×';

	let page = $state(0);
	const total = PAGES.length;
	const next = () => (page = Math.min(total - 1, page + 1));
	const prev = () => (page = Math.max(0, page - 1));

	// Cost is a multiple of the current bet; format it in the player's currency, like the HUD does.
	const bet = $derived(stateBet.betAmount);
	const cost = (mult: number) => templateStakeDerived.formatCurrencyAmount(bet * mult);

	// The S-pad neon frame draws its line at a different inset on each edge (measured off the render),
	// so the marching lights need a per-side inset to ride it exactly. Same for every card.
	const cardLights = { insetTop: 11, insetRight: 17, insetBottom: 15, insetLeft: 16, pad: 14 };

	// Paytable — (5 / 4 / 3 of a kind) × bet, straight from game config.
	const PAY_HIGH = [
		{ img: 'h1-coaster', name: 'Roller Coaster', pays: ['20', '10', '2'] },
		{ img: 'h2-duck', name: 'Duck', pays: ['10', '5', '1'] },
		{ img: 'h3-balloons', name: 'Balloons', pays: ['10', '5', '1'] },
		{ img: 'h4-popcorn', name: 'Popcorn', pays: ['5', '2.5', '0.5'] },
		{ img: 'h5-ferris', name: 'Ferris Wheel', pays: ['5', '2.5', '0.5'] },
	];
	const PAY_LOW = [
		{ img: 'l1-a', name: 'A' },
		{ img: 'l2-k', name: 'K' },
		{ img: 'l3-q', name: 'Q' },
		{ img: 'l4-j', name: 'J' },
		{ img: 'l5-10', name: '10' },
	];

	// FEATURES and FEATURE BUY share these six. Top row = paid single-spin options; bottom row =
	// the three bonus features (with logo art). `mult` is the cost as a multiple of the bet.
	const SPIN_BUYS = [
		{
			name: 'Extra Feature',
			desc: '3x cost per spin. Extra feature — 5x bonus chance.',
			mult: 3,
			per: true,
		},
		{
			name: 'Duck Collect Spin',
			desc: 'One paid spin with at least 1 collect duck. Up to 25 ducks can land.',
			mult: 20,
			per: true,
		},
		{
			name: 'Roller Wilds Spin',
			desc: 'One paid spin with at least one roller wild reel. Multiplier plaques can land on any row and add across wild reels.',
			mult: 60,
			per: true,
		},
	];
	const BONUS_BUYS = [
		{
			img: 'duck-your-luck',
			name: 'Duck your luck',
			desc: '10 duck picks with multipliers and multiply-all ducks. Lump sum payout, capped at 25,000x.',
			mult: 100,
		},
		{
			img: 'roller-wilds',
			name: 'Roller Wilds',
			desc: '10 free spins. A landing wild can transform its reel after the spin. Row multiplier plaques add across each wild reel and across multiple wild reels.',
			mult: 200,
		},
		{
			img: 'mega-coaster',
			name: 'Mega Coaster',
			desc: 'Coaster setup places persistent multiplier wilds, then 10 free spins. Repeat hits double the tile up to x1024.',
			mult: 500,
		},
	];


	type GuideItem = {
		name: string;
		desc: string;
		/** Full control-button art (already a dark neon circle). */
		btn?: string;
		/** A bare white glyph, composed into a matching circle. */
		glyph?: string;
		/** Render the glyph smaller (for the taller "i" / music note). */
		small?: boolean;
		/** Enlarge the button so the transparent-margined SPIN art matches the others. */
		big?: boolean;
		info?: boolean;
		music?: boolean;
	};
	const GUIDE: GuideItem[] = [
		{ btn: btnSpin, name: 'SPIN', desc: 'Starts a new game round.', big: true },
		{ btn: btnAuto, name: 'AUTO SPINS', desc: 'Opens the Auto Spins menu.' },
		{ btn: btnTurbo, name: 'TURBO', desc: 'Enables faster reel spins.' },
		{ btn: btnPlus, name: 'BET +', desc: 'Increases your total bet.' },
		{ btn: btnMinus, name: 'BET -', desc: 'Decreases your total bet.' },
		{ info: true, name: 'INFO', desc: 'Opens the game information.' },
		{ btn: btnSound, name: 'SOUND', desc: 'Turns game sound on or off.' },
		{ btn: btnArrowLeft, name: 'PREVIOUS', desc: 'Goes to the previous page.' },
		{ btn: btnArrowRight, name: 'NEXT', desc: 'Goes to the next page.' },
		{ glyph: glyphClose, name: 'CLOSE', desc: 'Closes the current window.' },
		{ btn: btnMenu, name: 'MENU', desc: 'Opens the game menu.' },
		{ music: true, name: 'MUSIC', desc: 'Turns game music on or off.' },
	];

	const WILD_MULTS = '×2 / ×3 / ×5 / ×10 / ×25 / ×50 / ×100';

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') props.onclose();
		else if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	class="info-overlay"
	class:is-wide={wide}
	role="presentation"
	onclick={props.onclose}
	style={`--neon-frame:url('${neonFrame}')`}
>
	<div class="info-card" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<!-- Landscape (desktop) frame art; hidden in the portrait card, which keeps its CSS neon border. -->
		<img class="info-bg" src={tutorialBg} alt="" aria-hidden="true" />
		<!-- Marching border lights round the frame, like the confirm dialog. -->
		<InfoBorderLights
			radius={wide ? 30 : 22}
			inset={wide ? 6 : 2}
			pad={wide ? 26 : 16}
			glow={wide ? 10 : 8}
		/>
		<button class="info-x" type="button" aria-label="Close" onclick={props.onclose}>
			<img src={iconClose} alt="" />
		</button>

		<div class="info-body">
			{#if page === 0}
				<h2 class="info-title">OVERVIEW</h2>
				<div class="ov">
					<div class="ov-col ov-desc">
						<p class="info-p">
							Theme Park is a 5×5 high-volatility video slot played on 15 fixed paylines. Wins are
							formed when matching symbols land on consecutive reels from left to right, starting from
							Reel 1.
						</p>
						<p class="info-p">
							The game features Duck Collect, Roller Wilds, and the Mega Coaster Bonus, bringing
							multipliers, full-reel Wilds, and persistent multiplier Wilds into play.
						</p>
						<p class="info-p info-p--em">Maximum Win: <b>{MAX_WIN} bet</b></p>
						<p class="info-p info-p--rtp">Theoretical RTP: <b>{RTP}</b></p>
						<p class="info-p">The four boxes at the bottom could be:</p>
					</div>
					<div class="ov-col ov-feats">
						<div class="ov-feat">
							<h4 class="ov-feat__name">DUCK COLLECT</h4>
							<p class="info-p">
								Special Ducks reveal direct multipliers or multipliers that increase the collected
								prize.
							</p>
						</div>
						<div class="ov-feat">
							<h4 class="ov-feat__name">ROLLER WILDS</h4>
							<p class="info-p">
								Roller coaster ducks can transform entire reels into Wild reels with multipliers up to
								×100.
							</p>
						</div>
						<div class="ov-feat">
							<h4 class="ov-feat__name">MEGA COASTER</h4>
							<p class="info-p">
								Creates persistent Wild positions before 10 Free Spins. Repeated hits can increase Wild
								multipliers up to ×1024.
							</p>
						</div>
						<div class="ov-feat">
							<h4 class="ov-feat__name">BONUS FEATURES</h4>
							<p class="info-p">
								Three different feature experiences: Duck Your Luck, Roller Wilds, and Mega Coaster.
							</p>
						</div>
					</div>
					<div class="ov-col ov-art">
						<img class="ov-logo" src={gameLogo} alt="Theme Park" />
						<img class="ov-duck" src={rollerDuck} alt="" />
					</div>
				</div>
			{:else if page === 1}
				<h2 class="info-title">PAYTABLE</h2>
				<p class="info-note">Payouts shown for 5 / 4 / 3 of a kind, × bet per line.</p>
				<div class="pay-grid">
					{#each PAY_HIGH as s (s.img)}
						<div class="pay-row card">
							<InfoBorderLights {...cardLights} radius={16} />
							<img class="pay-sym" src={symImg(s.img)} alt={s.name} />
							<div class="pay-vals">
								<span><em>5</em>{s.pays[0]}x</span>
								<span><em>4</em>{s.pays[1]}x</span>
								<span><em>3</em>{s.pays[2]}x</span>
							</div>
						</div>
					{/each}
				</div>
				<p class="info-note info-note--mt">Royals — 1x / 0.5x / 0.1x each.</p>
				<div class="pay-royals">
					{#each PAY_LOW as s (s.img)}
						<img class="pay-royal" src={symImg(s.img)} alt={s.name} />
					{/each}
				</div>
			{:else if page === 2}
				<h2 class="info-title">FEATURES</h2>
				<div class="feat-grid">
					{#each SPIN_BUYS as f (f.name)}
						<div class="card feat-card">
							<InfoBorderLights {...cardLights} radius={20} />
							<h3 class="feat-h">{f.name}</h3>
							<p class="feat-p">{f.desc}</p>
						</div>
					{/each}
					{#each BONUS_BUYS as f (f.name)}
						<div class="card feat-card feat-card--logo">
							<InfoBorderLights {...cardLights} radius={20} />
							<h3 class="feat-h">{f.name}</h3>
							<p class="feat-p">{f.desc}</p>
							<img class="feat-logo" src={modeImg(f.img)} alt="" />
						</div>
					{/each}
				</div>
			{:else if page === 3}
				<h2 class="info-title">WAYS TO WIN</h2>
				<div class="wtw">
					<p class="info-p">Theme Park is played on 15 fixed paylines.</p>
					<p class="info-p">
						A standard winning combination is formed when 3 or more matching symbols land on
						consecutive reels from left to right, starting from Reel 1, on one of the fixed paylines.
						Wins are evaluated after the reels stop and are paid according to the Paytable.
					</p>
					<p class="info-p">
						Wild symbols substitute for all regular paying symbols except Scatter symbols. Scatter
						symbols do not need to follow a payline and trigger their associated bonus features. Only
						the highest winning combination per symbol per payline is paid, and all displayed payouts
						are expressed as multiples of the total bet.
					</p>
					<img class="wtw-paylines" src={waysToWin} alt="15 paylines" />
					<h3 class="feat-name feat-name--sub">WILD REEL MULTIPLIERS</h3>
					<p class="info-p">
						When a Roller Wild transforms a reel, the entire reel becomes Wild and receives a
						multiplier of:
					</p>
					<p class="info-p info-p--mults">{WILD_MULTS}</p>
					<p class="info-p">
						When multiple multiplier Wild reels contribute to the same winning combination, their
						multipliers are added together and applied to the win.
					</p>
				</div>
			{:else if page === 4}
				<h2 class="info-title">FEATURE BUY</h2>
				<div class="feat-grid">
					{#each SPIN_BUYS as f (f.name)}
						<div class="card feat-card">
							<InfoBorderLights {...cardLights} radius={20} />
							<h3 class="feat-h">{f.name}</h3>
							<p class="feat-p">{f.desc}</p>
							<div class="buy-foot">
								<span class="buy-cost">{cost(f.mult)} / spin</span>
								<span class="buy-rtp"><i>RTP</i><b>{RTP_SHORT}</b></span>
							</div>
						</div>
					{/each}
					{#each BONUS_BUYS as f (f.name)}
						<div class="card feat-card feat-card--logo">
							<InfoBorderLights {...cardLights} radius={20} />
							<h3 class="feat-h">{f.name}</h3>
							<p class="feat-p">{f.desc}</p>
							<img class="feat-logo feat-logo--sm" src={modeImg(f.img)} alt="" />
							<div class="buy-foot">
								<span class="buy-cost">{cost(f.mult)}</span>
								<span class="buy-rtp"><i>RTP</i><b>{RTP_SHORT}</b></span>
							</div>
						</div>
					{/each}
				</div>
			{:else if page === 5}
				<h2 class="info-title">GENERAL INFO</h2>
				<div class="gi">
					<div class="card gi-card gi-card--sm">
						<InfoBorderLights {...cardLights} radius={22} />
						<img class="gi-ic" src={icInterrupted} alt="" />
						<h3 class="feat-name feat-name--sub">INTERRUPTED ROUNDS</h3>
						<p class="info-p">
							If a game round is interrupted, it will continue when the game is reloaded, where
							possible.
						</p>
						<p class="info-p">
							All valid wagers and potential winnings remain active until the round is fully
							completed.
						</p>
					</div>
					<div class="card gi-card">
						<InfoBorderLights {...cardLights} radius={22} />
						<img class="gi-ic" src={icLegal} alt="" />
						<h3 class="feat-name feat-name--sub">LEGAL NOTICE</h3>
						<p class="info-p">
							Malfunction voids all pays and plays. A stable internet connection is required. If the
							connection is lost, reload the game to complete any unfinished rounds.
						</p>
						<p class="info-p">
							The expected return is calculated over a large number of plays. The game display is for
							visual and entertainment purposes only and does not represent any physical gaming device.
						</p>
						<p class="info-p">
							All winnings are settled according to the result received from the Remote Game Server,
							not from animations or events shown inside the web browser.
						</p>
					</div>
				</div>
			{:else}
				<h2 class="info-title">USER INTERFACE GUIDE</h2>
				<div class="guide">
					{#each GUIDE as g (g.name)}
						<div class="guide-item">
							{#if g.btn}
									<img class="guide-btn" class:guide-btn--big={g.big} src={g.btn} alt="" />
								{:else}
									<span class="guide-ic">
										{#if g.info}
											<svg class="guide-glyph guide-glyph--sm" viewBox="0 0 24 24" aria-hidden="true"
												><circle cx="12" cy="6.3" r="1.9" fill="#fff" /><rect
													x="10.3"
													y="9.8"
													width="3.4"
													height="9.6"
													rx="1.7"
													fill="#fff"
												/></svg
											>
										{:else if g.music}
											<svg class="guide-glyph guide-glyph--sm" viewBox="0 0 24 24" aria-hidden="true"
												><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="#fff" /></svg
											>
										{:else}
											<img class="guide-glyph" src={g.glyph} alt="" />
										{/if}
									</span>
								{/if}
								<span class="guide-name">{g.name}</span>
							<span class="guide-desc">{g.desc}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="info-nav">
			<button class="nav-arrow" type="button" aria-label="Previous" disabled={page === 0} onclick={prev}>
				<img src={iconArrow} alt="" style="transform:scaleX(-1)" />
			</button>
			<span class="nav-page">Page {page + 1}/{total}</span>
			<button
				class="nav-arrow"
				type="button"
				aria-label="Next"
				disabled={page === total - 1}
				onclick={next}
			>
				<img src={iconArrow} alt="" />
			</button>
		</div>
	</div>
</div>

<style>
	.info-overlay {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 3.5cqw;
		background: rgba(6, 2, 16, 0.78);
		backdrop-filter: blur(3px);
		container-type: size;
		font-family: 'Poppins', 'Cinzel', sans-serif;
	}

	/* Neon-bordered card, matching the game's nav/bet plates. Fills the phone, caps out on desktop. */
	.info-card {
		position: relative;
		width: min(94cqw, 460px);
		height: min(90cqh, 760px);
		display: flex;
		flex-direction: column;
		border-radius: 22px;
		border: 2px solid transparent;
		background-origin: border-box;
		background-clip: padding-box, border-box;
		background-image:
			linear-gradient(180deg, rgba(24, 10, 46, 0.98), rgba(9, 5, 24, 0.99)),
			linear-gradient(140deg, #3aa0ff 0%, #8b3cff 48%, #ff4fd8 100%);
		box-shadow:
			0 0 26px rgba(130, 70, 255, 0.4),
			0 20px 50px rgba(0, 0, 0, 0.6);
		/* Visible so the marching border lights can bleed past the edge (the body clips its own
		   scroll independently). */
		overflow: visible;
	}

	.info-x {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 4;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 1.5px solid rgba(180, 130, 240, 0.6);
		background: rgba(10, 4, 24, 0.9);
		cursor: pointer;
	}
	.info-x img {
		width: 64%;
		height: 64%;
	}

	.info-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 22px 20px 12px;
		position: relative;
		z-index: 1;
	}

	.info-title {
		margin: 0 0 12px;
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 1.9rem;
		line-height: 1;
		letter-spacing: 0.03em;
		text-align: center;
		background-image: linear-gradient(135deg, #d836fc 0%, #272fdd 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.info-p {
		margin: 0 0 10px;
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: 0.86rem;
		line-height: 1.4;
		letter-spacing: 0.03em;
		color: #e7e0f5;
		text-align: center;
	}
	.info-p b {
		color: #fff;
	}
	.info-p--em {
		color: #ffd98a;
		font-weight: 600;
	}
	.info-p--rtp {
		color: #8ec7ff;
		font-weight: 600;
	}
	.info-p--mults {
		color: #ffd98a;
		font-weight: 700;
		font-size: 0.98rem;
	}
	.info-note {
		margin: 0 0 12px;
		font-size: 0.74rem;
		color: #9a8fbf;
		text-align: center;
	}
	.info-note--mt {
		margin-top: 16px;
	}

	/* Landscape tutorial-box frame image — hidden by default (portrait keeps its CSS neon border). */
	.info-bg {
		display: none;
	}

	/* ── Shared neon card — the "S pad" neon frame drawn as a 9-slice border-image (constant border
	   thickness at any aspect), NOT a stretched CSS gradient. `fill` paints the dark interior.
	   Slices measured off the 615×309 PNG (interior starts 22/20/39/17 px, T/R/B/L). Same art and
	   numbers the buy-bonus cards use. Overflow is left visible so the moving border lights can bleed
	   past the edge without being clipped. */
	.card {
		position: relative;
		border-style: solid;
		border-width: 13px 13px 15px 13px;
		border-image-source: var(--neon-frame);
		border-image-slice: 22 20 39 17 fill;
		border-image-repeat: stretch;
	}

	/* OVERVIEW: stacked in portrait, side-by-side in landscape. */
	.ov {
		display: block;
	}
	.ov-art {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		margin-top: 14px;
	}
	.ov-logo {
		width: 56%;
		max-width: 200px;
		height: auto;
	}
	.ov-duck {
		width: 82%;
		max-width: 270px;
		height: auto;
		filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.55));
	}
	.ov-feat__name {
		margin: 14px 0 4px;
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 0.95rem;
		letter-spacing: 0.04em;
		text-align: center;
		background-image: linear-gradient(135deg, #f49bff 0%, #9a7bff 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	/* --- Paytable --- */
	.pay-grid {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.pay-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 8px;
	}
	.pay-sym {
		width: 54px;
		height: 54px;
		object-fit: contain;
		flex: 0 0 auto;
	}
	.pay-vals {
		flex: 1 1 auto;
		display: flex;
		justify-content: space-around;
		gap: 6px;
	}
	.pay-vals span {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 0.92rem;
		font-weight: 700;
		color: #ffd98a;
	}
	.pay-vals em {
		font-style: normal;
		font-size: 0.6rem;
		font-weight: 700;
		color: #8ec7ff;
		letter-spacing: 0.05em;
	}
	.pay-royals {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
	}
	.pay-royal {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	/* --- Feature / buy cards --- */
	.feat-grid {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.feat-card {
		display: flex;
		flex-direction: column;
		/* Small padding on top of the ~16–28px neon border the 9-slice already insets. */
		padding: 4px 10px 8px;
		min-height: 0;
	}
	.feat-h {
		margin: 0 0 6px;
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 1.02rem;
		letter-spacing: 0.02em;
		text-align: center;
		background-image: linear-gradient(135deg, #f49bff 0%, #9a7bff 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.feat-p {
		margin: 0;
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: 0.8rem;
		line-height: 1.38;
		color: #e7e0f5;
		text-align: center;
	}
	/* Contain within a capped box so the logo never spills past the card's neon border. */
	.feat-logo {
		width: 100%;
		max-width: 190px;
		max-height: 120px;
		height: auto;
		object-fit: contain;
		margin: 10px auto 0;
	}
	.feat-logo--sm {
		max-height: 74px;
		margin-top: 8px;
	}
	.buy-foot {
		margin-top: auto;
		padding-top: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.buy-cost {
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 1.05rem;
		color: #fff;
	}
	.buy-rtp {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}
	.buy-rtp i {
		font-style: normal;
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		background-image: linear-gradient(135deg, #f49bff 0%, #9a7bff 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.buy-rtp b {
		font-size: 0.82rem;
		color: #fff;
	}

	.feat-name--sub {
		margin: 16px 0 6px;
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		text-align: center;
		font-size: 1.02rem;
		letter-spacing: 0.03em;
		background-image: linear-gradient(135deg, #f49bff 0%, #9a7bff 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	/* --- Ways to win: the finished 15-payline diagram --- */
	.wtw-paylines {
		display: block;
		width: 100%;
		max-width: 460px;
		height: auto;
		margin: 12px auto;
	}

	/* --- General info cards --- */
	.gi {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.gi-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 14px 10px;
	}
	.gi-ic {
		width: 74px;
		height: 74px;
		object-fit: contain;
		margin-bottom: 8px;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
	}

	/* --- UI guide --- */
	.guide {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px 10px;
	}
	.guide-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 6px;
	}
	/* Real control buttons already are dark neon circles — shown at the icon size. */
	.guide-btn {
		width: 52px;
		height: 52px;
		object-fit: contain;
		display: block;
	}
	/* SPIN art has transparent margin, so scale its box up to read the same size as the others. */
	.guide-btn--big {
		width: 70px;
		height: 70px;
		margin: -9px 0;
	}
	/* Controls with no button art: a matching dark neon circle + white glyph. */
	.guide-ic {
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 1.6px solid #7a3cf0;
		background: radial-gradient(120% 120% at 50% 25%, #1b0c3c, #08041a);
		overflow: hidden;
	}
	.guide-glyph {
		width: 48%;
		height: 48%;
		object-fit: contain;
	}
	.guide-glyph--sm {
		width: 38%;
		height: 38%;
	}
	.guide-name {
		font-family: Helvetica, Arial, sans-serif;
		font-weight: 700;
		font-size: 0.82rem;
		letter-spacing: 0.03em;
		background-image: linear-gradient(135deg, #f49bff 0%, #9a7bff 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.guide-desc {
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: 0.72rem;
		line-height: 1.3;
		color: #cfc4ea;
	}

	/* --- Nav footer --- */
	.info-nav {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Arrows sit close together, centred; the page count is pinned to the bottom-right corner. */
		gap: 12px;
		padding: 10px 0 calc(12px + env(safe-area-inset-bottom, 0px));
		position: relative;
		z-index: 2;
	}
	.nav-arrow {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 1.5px solid rgba(180, 130, 240, 0.6);
		background: rgba(10, 4, 24, 0.9);
		cursor: pointer;
		transition:
			transform 0.1s ease,
			opacity 0.1s ease;
	}
	.nav-arrow img {
		width: 44%;
		height: auto;
	}
	.nav-arrow:active {
		transform: scale(0.9);
	}
	.nav-arrow:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.nav-page {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.82rem;
		font-weight: 600;
		color: #cfc4ea;
		text-align: right;
	}

	/* ─── LANDSCAPE (desktop / mobile-landscape) ─────────────────────────────────────────────────
	   Keyed off the game's own layoutType (via .is-wide) rather than a media/container query, because
	   the modal lives in the game's portrait logical space so aspect queries can't see the real
	   orientation. The popup becomes the wide neon box (tutorial-bg.webp) and pages reflow wider. */
	.info-overlay.is-wide {
		.info-card {
			/* Almost the whole screen: the largest 1484:750 (tightly-cropped frame-art) box that fits. */
			width: min(97cqw, calc(95cqh * 1.979), 1620px);
			height: auto;
			aspect-ratio: 1484 / 750;
			border: none;
			background: none;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
			border-radius: 26px;
			overflow: visible; /* let the close-X sit outside the box */
		}
		.info-bg {
			display: block;
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			object-fit: fill;
			z-index: 0;
			pointer-events: none;
		}
		.info-body {
			position: relative;
			z-index: 1;
			/* Bottom padding reserves room for the (now modal-scaled) nav so content never reaches it. */
			padding: 3.5% 4.5% 9%;
			display: flex;
			flex-direction: column;
			height: 100%;
			box-sizing: border-box;
			overflow: hidden;
		}
		.info-title {
			font-size: 4.2cqh;
			line-height: 1;
			margin: 0 0 2.5%;
		}
		.info-p {
			font-size: 1.72cqh;
		}
		.info-note {
			font-size: 1.55cqh;
		}

		/* OVERVIEW → three columns: description | features | logo + duck. */
		.ov {
			display: flex;
			gap: 4%;
			align-items: stretch;
			flex: 1 1 auto;
			min-height: 0;
		}
		.ov-col {
			min-width: 0;
		}
		.ov-desc {
			flex: 1 1 35%;
		}
		.ov-feats {
			flex: 1 1 35%;
			display: flex;
			flex-direction: column;
			gap: 2%;
		}
		.ov .info-p {
			color: #fff;
			margin-bottom: 9px;
			text-align: left;
		}
		.ov .info-p--em {
			color: #ffd98a;
		}
		.ov .info-p--rtp {
			color: #8ec7ff;
		}
		.ov-feat__name {
			margin: 0 0 3px;
			font-size: 14px;
			text-align: left;
		}
		.ov-feat .info-p {
			margin-bottom: 0;
			font-size: 12px;
		}
		.ov-art {
			flex: 0 0 26%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			margin-top: 0;
		}
		.ov-logo {
			width: 92%;
			max-width: 300px;
		}
		.ov-duck {
			width: 100%;
			max-width: 340px;
		}

		/* PAYTABLE → two columns of rows. Symbols/values in cqh so the rows shrink with the card
		   (fixed 54px symbols made the grid too tall on laptops and the royals hit the nav). */
		.pay-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1cqh 2.4cqh;
		}
		.pay-row {
			gap: 1.4cqh;
			padding: 0 1.4cqh;
		}
		.pay-sym {
			width: 5.2cqh;
			height: 5.2cqh;
		}
		.pay-vals span {
			font-size: 1.6cqh;
		}
		.pay-vals em {
			font-size: 1.05cqh;
		}
		.pay-royals {
			gap: 1cqh;
			margin-top: 0.8cqh;
		}
		.pay-royal {
			width: 4.6cqh;
			height: 4.6cqh;
		}
		.info-note {
			margin-bottom: 1cqh;
		}
		.info-note--mt {
			margin-top: 1cqh;
		}

		/* FEATURES / FEATURE BUY → 3 × 2 grid filling the box. */
		.feat-grid {
			flex: 1 1 auto;
			min-height: 0;
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			grid-auto-rows: 1fr;
			gap: 1.6cqh 18px;
		}
		.feat-card {
			padding: 0.6cqh 16px 0.9cqh;
		}
		.feat-h {
			font-size: 2.4cqh;
		}
		.feat-p {
			font-size: 1.72cqh;
		}
		/* Fill the space under the text but cap the height (cqh, so it scales with the card) and leave
		   a gap below — the logo never reaches the neon border, at any screen size. */
		.feat-logo {
			flex: 1 1 auto;
			min-height: 0;
			width: auto;
			max-width: 56%;
			max-height: 11cqh;
			margin: 0.6cqh auto 0.4cqh;
		}
		.feat-logo--sm {
			max-height: 8cqh;
			margin-top: 0.4cqh;
		}
		.buy-cost {
			font-size: 2.3cqh;
		}
		.buy-rtp i {
			font-size: 1.35cqh;
		}
		.buy-rtp b {
			font-size: 1.7cqh;
		}
		.buy-foot {
			padding-top: 1.2cqh;
			gap: 0.3cqh;
		}

		/* WAYS TO WIN → centred text column with the paylines grid. */
		.wtw {
			flex: 1 1 auto;
			min-height: 0;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			align-items: center;
		}
		.wtw {
			justify-content: center;
		}
		.wtw .info-p {
			max-width: 84%;
			margin-bottom: 0.9cqh;
			font-size: 1.6cqh;
		}
		.wtw-paylines {
			max-width: min(44%, 500px);
			margin: 1cqh auto;
		}
		.wtw .feat-name--sub {
			margin: 0.8cqh 0 0.5cqh;
		}
		.wtw .info-p--mults {
			margin-bottom: 0.7cqh;
		}

		/* GENERAL INFO → the narrow interrupted card beside the wider legal card. */
		.gi {
			flex: 1 1 auto;
			min-height: 0;
			flex-direction: row;
			gap: 3%;
			align-items: stretch;
		}
		.gi-card--sm {
			flex: 0 0 34%;
		}
		.gi-card {
			flex: 1 1 auto;
			justify-content: flex-start;
		}
		.gi-ic {
			width: 7.4cqh;
			height: 7.4cqh;
			margin-bottom: 1cqh;
		}

		/* UI GUIDE → five across; icons/labels in cqh so the block scales with the card. */
		.guide {
			flex: 1 1 auto;
			min-height: 0;
			grid-template-columns: repeat(5, 1fr);
			gap: 2.4cqh 1cqh;
			align-content: center;
		}
		.guide-btn,
		.guide-ic {
			width: 5.9cqh;
			height: 5.9cqh;
		}
		.guide-btn--big {
			width: 7.9cqh;
			height: 7.9cqh;
			margin: -0.9cqh 0;
		}
		.guide-name {
			font-size: 1.85cqh;
		}
		.guide-desc {
			font-size: 1.55cqh;
		}

		.info-nav {
			position: absolute;
			bottom: 3.6%;
			left: 0;
			right: 0;
			z-index: 3;
		}
		.nav-page {
			/* Inside the frame's right neon border. */
			right: 5%;
		}
		.info-x {
			/* Clear of the frame — sits in the gap beyond the rounded top-right corner, not on it. */
			top: -30px;
			right: -34px;
			width: 44px;
			height: 44px;
		}
	}
</style>

<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Paytable symbol art (high symbols first, then royals), plus the wild.
	const symImg = (name: string) => ap(`/assets/theme-park/v2/symbols/${name}.png`);
	// Feature / mode icons (reused from the buy-bonus modes set).
	const modeImg = (name: string) => ap(`/assets/theme-park/v2/modes/${name}-desktop.png`);
	const iconSound = ap('/assets/theme-park/v2/hud/icon_sound.svg');
	const iconClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
	const iconArrow = ap('/assets/theme-park/v2/splash/arrow.svg');

	const btnMenu = ap('/assets/theme-park/v2/controls/btn-menu.png');
	const btnAuto = ap('/assets/theme-park/v2/controls/btn-auto.png');
	const btnTurbo = ap('/assets/theme-park/v2/controls/btn-turbo.png');
	const btnPlus = ap('/assets/theme-park/v2/controls/btn-plus.png');
	const btnMinus = ap('/assets/theme-park/v2/controls/btn-minus.png');
	const spinIcon = ap('/assets/theme-park/v2/controls/spin-default-mobile.png');
</script>

<script lang="ts">
	type Props = { onclose: () => void };
	const props: Props = $props();

	const PAGES = [
		'OVERVIEW',
		'PAYTABLE',
		'FEATURES',
		'WAYS TO WIN',
		'FEATURE BUY',
		'GENERAL INFO',
		'GENERAL INFO',
	] as const;
	const RTP = '96.1%';
	const MAX_WIN = '25,000x';

	let page = $state(0);
	const total = PAGES.length;
	const next = () => (page = Math.min(total - 1, page + 1));
	const prev = () => (page = Math.max(0, page - 1));

	// Paytable — values are (5 / 4 / 3 of a kind) × bet, straight from game config.
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

	const FEATURES = [
		{
			img: 'wild',
			name: 'WILD',
			desc: 'The slime wild substitutes for every paying symbol to help complete winning lines.',
		},
		{
			img: 'duck-your-luck',
			name: 'DUCK COLLECT',
			desc: 'Collect ducks land and gather multipliers. Up to 25 ducks can land on a single spin.',
		},
		{
			img: 'roller-wilds',
			name: 'ROLLER WILDS',
			desc: 'The roller-coaster car races across the reels, leaving a trail of wilds behind it.',
		},
		{
			img: 'mega-coaster',
			name: 'MEGA COASTER',
			desc: 'A high-volatility bonus round with stacked wilds and boosted multipliers.',
		},
	];

	const BUYS = [
		{ img: 'duck-your-luck', name: 'DUCK YOUR LUCK', cost: '100x', rtp: RTP },
		{ img: 'roller-wilds', name: 'ROLLER WILDS', cost: '200x', rtp: RTP },
		{ img: 'mega-coaster', name: 'MEGA COASTER', cost: '500x', rtp: RTP },
	];

	const CONTROLS = [
		{ icon: spinIcon, name: 'SPIN', desc: 'Starts a new game round.' },
		{ icon: btnAuto, name: 'AUTO SPINS', desc: 'Opens the Auto Spins menu.' },
		{ icon: btnTurbo, name: 'TURBO', desc: 'Enables faster reel spins.' },
		{ icon: btnPlus, name: 'INCREASE BET', desc: 'Increases your total bet.' },
		{ icon: btnMinus, name: 'DECREASE BET', desc: 'Decreases your total bet.' },
		{ icon: btnMenu, name: 'INFO', desc: 'Opens the game information.' },
		{ icon: iconSound, name: 'SOUND', desc: 'Turns game sound on or off.' },
	];

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') props.onclose();
		else if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="info-overlay" role="presentation" onclick={props.onclose}>
	<div class="info-card" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<button class="info-x" type="button" aria-label="Close" onclick={props.onclose}>
			<img src={iconClose} alt="" />
		</button>

		<div class="info-body">
			{#if page === 0}
				<h2 class="info-title">OVERVIEW</h2>
				<p class="info-p">
					Theme Park is a 5-reel, 5-row slot with 15 fixed paylines. Wins are formed by 3 or more
					matching symbols on a line, left to right. Magnetic wilds pull matching symbols together
					to help build bigger, stronger wins.
				</p>
				<p class="info-p info-p--em">Maximum win <b>{MAX_WIN} bet</b>.</p>
				<img class="info-hero" src={symImg('h1-coaster')} alt="" />
			{:else if page === 1}
				<h2 class="info-title">PAYTABLE</h2>
				<p class="info-note">Payouts shown for 5 / 4 / 3 of a kind, × bet per line.</p>
				<div class="pay-grid">
					{#each PAY_HIGH as s (s.img)}
						<div class="pay-row">
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
				{#each FEATURES as f (f.name)}
					<div class="feat">
						<img class="feat-icon" src={modeImg(f.img)} alt="" />
						<div class="feat-txt">
							<h3 class="feat-name">{f.name}</h3>
							<p class="info-p">{f.desc}</p>
						</div>
					</div>
				{/each}
			{:else if page === 3}
				<h2 class="info-title">WAYS TO WIN</h2>
				<p class="info-p">
					The game pays on <b>15 fixed paylines</b>. Landing 3, 4 or 5 identical symbols on
					consecutive reels along a line, starting from the leftmost reel, awards the payout shown in
					the paytable.
				</p>
				<p class="info-p">
					Only the highest win per line is paid. Wild symbols substitute for any paying symbol to
					complete a line. All wins are multiplied by the bet per line.
				</p>
			{:else if page === 4}
				<h2 class="info-title">FEATURE BUY</h2>
				<p class="info-note">Buy a bonus directly instead of waiting for it to trigger.</p>
				{#each BUYS as b (b.name)}
					<div class="buy">
						<img class="feat-icon" src={modeImg(b.img)} alt="" />
						<div class="feat-txt">
							<h3 class="feat-name">{b.name}</h3>
							<div class="buy-meta">
								<span class="buy-cost">COST <b>{b.cost} BET</b></span>
								<span class="buy-rtp">RTP <b>{b.rtp}</b></span>
							</div>
						</div>
					</div>
				{/each}
			{:else if page === 5}
				<h2 class="info-title">GENERAL INFO</h2>
				<h3 class="feat-name feat-name--sub">INTERRUPTED ROUNDS</h3>
				<p class="info-p">
					If a game round is interrupted, it continues when the game is reloaded. All valid wagers and
					potential winnings remain active until the round is fully completed.
				</p>
				<h3 class="feat-name feat-name--sub">LEGAL NOTICE</h3>
				<p class="info-p">
					Malfunction voids all pays and plays. A stable internet connection is required; if the
					connection is lost, reload the game to complete any unfinished rounds. The expected return
					is calculated over a large number of plays. All winnings are settled according to the
					result received from the Remote Game Server, not from the animations or events shown in the
					browser. Return to player: <b>{RTP}</b>.
				</p>
			{:else}
				<h2 class="info-title">GENERAL INFO</h2>
				<div class="ctrl-list">
					{#each CONTROLS as c (c.name)}
						<div class="ctrl">
							<img class="ctrl-icon" src={c.icon} alt="" />
							<div class="feat-txt">
								<h3 class="feat-name feat-name--row">{c.name}</h3>
								<p class="info-p">{c.desc}</p>
							</div>
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
		overflow: hidden;
	}

	.info-x {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 2;
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
		width: 42%;
		height: 42%;
	}

	.info-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 22px 20px 12px;
	}

	.info-title {
		margin: 0 0 12px;
		font-family: 'Cinzel', serif;
		font-weight: 800;
		font-size: 1.6rem;
		letter-spacing: 0.04em;
		text-align: center;
		background-image: linear-gradient(180deg, #d9a6ff 0%, #a35bff 60%, #7a34e0 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.info-p {
		margin: 0 0 10px;
		font-size: 0.86rem;
		line-height: 1.5;
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
	.info-note {
		margin: 0 0 12px;
		font-size: 0.74rem;
		color: #9a8fbf;
		text-align: center;
	}
	.info-note--mt {
		margin-top: 16px;
	}
	.info-hero {
		display: block;
		width: 46%;
		max-width: 190px;
		margin: 10px auto 0;
		filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.55));
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
		padding: 6px 10px;
		border-radius: 14px;
		background: rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(140, 90, 220, 0.35);
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

	/* --- Features / buys / controls rows --- */
	.feat,
	.buy,
	.ctrl {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px;
		margin-bottom: 12px;
		border-radius: 16px;
		background: rgba(0, 0, 0, 0.32);
		border: 1px solid rgba(140, 90, 220, 0.4);
	}
	.feat-icon {
		width: 66px;
		height: 66px;
		object-fit: contain;
		flex: 0 0 auto;
	}
	.ctrl {
		gap: 12px;
		padding: 9px 12px;
		margin-bottom: 9px;
	}
	.ctrl-icon {
		width: 42px;
		height: 42px;
		object-fit: contain;
		flex: 0 0 auto;
	}
	.feat-txt {
		flex: 1 1 auto;
		min-width: 0;
		text-align: left;
	}
	.feat-txt .info-p {
		text-align: left;
		margin: 0;
	}
	.feat-name {
		margin: 0 0 4px;
		font-family: 'Cinzel', serif;
		font-weight: 700;
		font-size: 0.98rem;
		letter-spacing: 0.03em;
		background-image: linear-gradient(180deg, #8ec7ff 0%, #5b8fe6 100%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.feat-name--row {
		margin-bottom: 2px;
		font-size: 0.9rem;
	}
	.feat-name--sub {
		margin: 16px 0 6px;
		text-align: center;
		font-size: 1.05rem;
		background-image: linear-gradient(180deg, #d9a6ff 0%, #a35bff 100%);
		background-clip: text;
		-webkit-background-clip: text;
	}

	.buy-meta {
		display: flex;
		gap: 18px;
		font-size: 0.78rem;
		color: #cfc4ea;
	}
	.buy-cost b {
		color: #ffd98a;
	}
	.buy-rtp b {
		color: #8effc0;
	}

	/* --- Nav footer --- */
	.info-nav {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 22px;
		padding: 10px 0 calc(12px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid rgba(140, 90, 220, 0.25);
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
		font-size: 0.82rem;
		font-weight: 600;
		color: #cfc4ea;
		min-width: 84px;
		text-align: center;
	}
</style>

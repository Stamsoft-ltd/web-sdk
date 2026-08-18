<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Paytable symbol art (premium symbols and royals).
	const symImg = (name: string) => ap(`/assets/theme-park/v2/symbols/${name}.png`);
	// Feature / mode logos (reused from the buy-bonus modes set).
	// Full stem, not a prefix: only the redrawn facades carry the -marquee cache-bust suffix, so a
	// shared template here would have to guess which ones have been through the flat redraw.
	const modeImg = (stem: string) => ap(`/assets/theme-park/v2/modes/${stem}.png`);
	// The WILD row's symbol is the game's own marquee W — the same art the reels drop.
	const wildImg = ap('/assets/theme-park/v2/modes/wild-desktop-marquee.png');

	// Landscape (desktop) tutorial box: neon gradient frame, the duck-on-coaster hero, and the logo.
	const tutorialBg = ap('/assets/theme-park/v2/info/tutorial-bg.webp');
	const rollerDuck = ap('/assets/theme-park/v2/info/roller-duck.webp');
	const gameLogo = ap('/assets/theme-park/v2/splash/logo.webp');
	// Ways-to-win: the finished 15-payline diagram (downloads).
	const waysToWin = ap('/assets/theme-park/v2/info/ways-to-win.svg');

	// General-info card icons, straight from the design (Figma 6445:10589) — marquee-styled, unlike
	// the flat blue clip-art they replace.
	const icInterrupted = ap('/assets/theme-park/v2/info/ic-interrupted.webp');
	const icLegal = ap('/assets/theme-park/v2/info/ic-legal.webp');

	// UI-guide glyphs, exported from the design's own icon-button component (Figma 6445:10828) rather
	// than scavenged from the HUD's button art. The HUD buttons carry their own baked circles at
	// assorted sizes, which is exactly why the old guide looked like a set of mismatched icons.
	const guideSpinBg = ap('/assets/theme-park/v2/controls/spin-bg.webp');
	const guideSpinArrow = ap('/assets/theme-park/v2/controls/spin-arrow.webp');
	const uiIcon = (name: string) => ap(`/assets/theme-park/v2/info/ui/${name}`);
	// Modal chrome: close-X and nav arrows.
	const iconClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
	const iconArrow = ap('/assets/theme-park/v2/splash/arrow.svg');
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { templateStakeDerived } from '../state/templateStake.svelte';
	import InfoBorderLights from './InfoBorderLights.svelte';

	const t = (key: string) => i18nDerived.translate(key);

	type Props = { onclose: () => void; layoutType?: string };
	const props: Props = $props();
	// Wide (landscape) box on desktop/landscape; the tall portrait card on phones in portrait.
	const wide = $derived(props.layoutType !== 'portrait');

	// Very short landscape (e.g. 400×225): the frame is small, so its marching dots read as too big.
	// Track it with matchMedia (a viewport condition, not a box size) so only that case shrinks them.
	let smallLandscape = $state(false);
	onMount(() => {
		const mq = window.matchMedia('(max-height: 300px)');
		smallLandscape = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (smallLandscape = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	// Page count only — each page renders its own translated title, so this list holds no copy.
	const PAGES = 7;
	const RTP = '96.10%';
	const RTP_SHORT = '96.1%';
	const MAX_WIN = '25,000×';

	let page = $state(0);
	const total = PAGES;
	const next = () => (page = Math.min(total - 1, page + 1));
	const prev = () => (page = Math.max(0, page - 1));

	// Cost is a multiple of the current bet; format it in the player's currency, like the HUD does.
	const bet = $derived(stateBet.betAmount);
	const cost = (mult: number) => templateStakeDerived.formatCurrencyAmount(bet * mult);

	// Paytable — one row per symbol, values in 3/4/5-in-a-line order, × the line bet. Ordered
	// cheapest first, like the design; the royals all pay the same and share a single row.
	const ROYALS = ['l4-j-marquee', 'l1-a-marquee', 'l2-k-marquee', 'l5-10-marquee', 'l3-q-marquee'];
	// `name` is an i18n KEY, not display copy — the each-block keys on it, so it must stay stable
	// across a locale switch, which a translated string would not.
	type PayRow = { img?: string; royals?: boolean; wild?: boolean; name: string; pays: string[] };
	const PAY_ROWS: PayRow[] = [
		{ royals: true, name: 'INFO SYM ROYALS', pays: ['0.1', '0.5', '1'] },
		{ img: 'h5-ferris-marquee', name: 'INFO SYM FERRIS', pays: ['0.5', '2.5', '5'] },
		{ img: 'h4-popcorn-marquee', name: 'INFO SYM POPCORN', pays: ['0.5', '2.5', '5'] },
		{ img: 'h2-duck-marquee', name: 'INFO SYM DUCK', pays: ['1', '5', '10'] },
		{ img: 'h3-balloons-marquee', name: 'INFO SYM BALLOONS', pays: ['1', '5', '10'] },
		{ img: 'h1-coaster-marquee', name: 'INFO SYM COASTER', pays: ['2', '10', '20'] },
		{ wild: true, name: 'INFO SYM WILD', pays: ['-', '-', '20'] },
	];

	// FEATURES and FEATURE BUY share these six. Top row = paid single-spin options; bottom row =
	// the three bonus features (with logo art). `mult` is the cost as a multiple of the bet.
	// `name`/`desc` are i18n keys. They are the SAME keys the buy-bonus modal renders, so the two
	// screens describe a feature identically in every locale and the social overrides reach both.
	const SPIN_BUYS = [
		{ name: 'BET MODE ANTE TITLE', desc: 'BET MODE ANTE DIALOG', mult: 3 },
		{ name: 'BET MODE FSPIN1 TITLE', desc: 'BET MODE FSPIN1 DIALOG', mult: 20 },
		{ name: 'BET MODE FSPIN2 TITLE', desc: 'BET MODE FSPIN2 DIALOG', mult: 60 },
	];
	const BONUS_BUYS = [
		{
			img: 'duck-your-luck-desktop-marquee',
			name: 'BET MODE DUCK TITLE',
			desc: 'BET MODE DUCK DIALOG',
			mult: 100,
		},
		{
			img: 'roller-wilds-desktop-marquee',
			name: 'BET MODE ROLLER TITLE',
			desc: 'BET MODE ROLLER DIALOG',
			mult: 200,
		},
		{
			img: 'mega-coaster-desktop-marquee',
			name: 'BET MODE COASTER TITLE',
			desc: 'BET MODE COASTER DIALOG',
			mult: 500,
		},
	];

	type GuideItem = {
		name: string;
		desc: string;
		/** Glyph file under info/ui, drawn white inside the shared neon circle. */
		icon?: string;
		/** Glyph width as a percentage of the circle (the design sizes each one individually). */
		w?: number;
		/** Height instead of width, for the one glyph that is taller than it is wide. */
		h?: number;
		/** Extra rotation in degrees — NEXT is PREVIOUS mirrored, CLOSE is a plus turned into an X. */
		rotate?: number;
		/** The real spin button, shown whole rather than as a glyph — as the design does. */
		spin?: boolean;
		/** Auto spins pairs its glyph with an "AUTO" caption inside the circle. */
		auto?: boolean;
	};
	// Order follows the design exactly (Figma 6445:10828): five across, reading order. `name`/`desc`
	// are i18n keys; the plain ones (SPIN, TURBO, …) are the same keys the HUD labels its buttons
	// with, so a button and its guide entry can never disagree.
	const GUIDE: GuideItem[] = [
		{ spin: true, name: 'SPIN', desc: 'INFO UI SPIN DESC' },
		{ auto: true, icon: 'auto.svg', name: 'INFO UI AUTO SPINS', desc: 'INFO UI AUTO DESC' },
		{ icon: 'turbo.webp', h: 58, name: 'TURBO', desc: 'INFO UI TURBO DESC' },
		{ icon: 'plus.svg', w: 29, name: 'INFO UI BET PLUS', desc: 'INFO UI BET PLUS DESC' },
		{ icon: 'minus.svg', w: 29, name: 'INFO UI BET MINUS', desc: 'INFO UI BET MINUS DESC' },
		{ icon: 'info.svg', w: 42, name: 'INFO', desc: 'INFO UI INFO DESC' },
		{ icon: 'sound.svg', w: 47, name: 'SOUND', desc: 'INFO UI SOUND DESC' },
		{ icon: 'arrow.svg', w: 38, name: 'INFO UI PREVIOUS', desc: 'INFO UI PREVIOUS DESC' },
		{ icon: 'arrow.svg', w: 38, rotate: 180, name: 'INFO UI NEXT', desc: 'INFO UI NEXT DESC' },
		{ icon: 'close.svg', w: 39, rotate: 46, name: 'CLOSE', desc: 'INFO UI CLOSE DESC' },
		{ icon: 'menu.svg', w: 37, name: 'MENU', desc: 'INFO UI MENU DESC' },
		{ icon: 'music.svg', w: 42, name: 'MUSIC', desc: 'INFO UI MUSIC DESC' },
	];

	/** Sizes a guide glyph the way the design does — by width, or by height for the tall one. */
	const glyphSize = (g: GuideItem) =>
		[g.h ? `height:${g.h}%` : `width:${g.w}%`, g.rotate ? `rotate:${g.rotate}deg` : '']
			.filter(Boolean)
			.join(';');

	const WILD_MULTS = '×2 / ×3 / ×5 / ×10 / ×25 / ×50 / ×100';

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') props.onclose();
		else if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="info-overlay" class:is-wide={wide} role="presentation" onclick={props.onclose}>
	<div class="info-card" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<!-- Landscape (desktop) frame art; hidden in the portrait card, which keeps its CSS neon border. -->
		<img class="info-bg" src={tutorialBg} alt="" aria-hidden="true" />
		<!-- Marching border lights round the frame, like the confirm dialog. -->
		<InfoBorderLights
			radius={wide ? 30 : 22}
			inset={smallLandscape ? 3 : wide ? 6 : 2}
			pad={smallLandscape ? 12 : wide ? 26 : 16}
			glow={smallLandscape ? 4.5 : wide ? 10 : 8}
		/>
		<button class="info-x" type="button" aria-label={t('CLOSE')} onclick={props.onclose}>
			<img src={iconClose} alt="" />
		</button>

		<div class="info-body">
			{#if page === 0}
				<h2 class="info-title info-title--left">{t('INFO PAGE OVERVIEW')}</h2>
				<div class="ov">
					<div class="ov-col ov-desc">
						<p class="info-p">
							{t('INFO OV INTRO')}
							<br />{t('INFO OV WINS')}
						</p>
						<p class="info-p">{t('INFO OV FEATURES')}</p>
						<p class="ov-max">
							<span>{t('INFO OV MAX WIN')}</span>
							<b>{MAX_WIN}</b>
							<span>{t('INFO OV BET')}</span>
						</p>
						<p class="info-p">{t('INFO OV RTP')} {RTP}</p>
					</div>
					<div class="ov-col ov-feats">
						<div class="ov-feat">
							<h4 class="ov-feat__name">{t('DUCK COLLECT')}</h4>
							<p class="info-p">{t('INFO OV DUCK DESC')}</p>
						</div>
						<div class="ov-feat">
							<h4 class="ov-feat__name">{t('ROLLER WILDS')}</h4>
							<p class="info-p">{t('INFO OV ROLLER DESC')}</p>
						</div>
						<div class="ov-feat">
							<h4 class="ov-feat__name">{t('MEGA COASTER')}</h4>
							<p class="info-p">{t('INFO OV COASTER DESC')}</p>
						</div>
						<div class="ov-feat">
							<h4 class="ov-feat__name">{t('INFO OV BONUS TITLE')}</h4>
							<p class="info-p">{t('INFO OV BONUS DESC')}</p>
						</div>
					</div>
					<div class="ov-col ov-art">
						<img class="ov-logo" src={gameLogo} alt="Theme Park" />
						<img class="ov-duck" src={rollerDuck} alt="" />
					</div>
				</div>
			{:else if page === 1}
				<h2 class="info-title">{t('PAYTABLE')}</h2>
				<div class="pay">
					<div class="pay-head">
						<span class="pay-head__sym">{t('INFO PAY SYMBOL')}</span>
						<span>{t('INFO PAY 3')}</span>
						<span>{t('INFO PAY 4')}</span>
						<span>{t('INFO PAY 5')}</span>
					</div>
					{#each PAY_ROWS as row (row.name)}
						<div class="pay-row">
							<div class="pay-sym">
								{#if row.royals}
									<!-- The royals all pay the same, so the design gives them one shared row. -->
									{#each ROYALS as r (r)}
										<img class="pay-img pay-img--royal" src={symImg(r)} alt={r} />
									{/each}
								{:else if row.wild}
									<img class="pay-img" src={wildImg} alt={t(row.name)} />
								{:else if row.img}
									<img class="pay-img" src={symImg(row.img)} alt={t(row.name)} />
								{/if}
							</div>
							{#each row.pays as v, i (i)}
								<span class="pay-val">{v === '-' ? '-' : `${v} x`}</span>
							{/each}
						</div>
					{/each}
				</div>
			{:else if page === 2}
				<h2 class="info-title">{t('INFO PAGE FEATURES')}</h2>
				<div class="feat-grid">
					{#each SPIN_BUYS as f (f.name)}
						<div class="card feat-card">
							<h3 class="feat-h">{t(f.name)}</h3>
							<p class="feat-p">{t(f.desc)}</p>
						</div>
					{/each}
					{#each BONUS_BUYS as f (f.name)}
						<div class="card feat-card feat-card--logo">
							<h3 class="feat-h">{t(f.name)}</h3>
							<p class="feat-p">{t(f.desc)}</p>
							<img class="feat-logo" src={modeImg(f.img)} alt="" />
						</div>
					{/each}
				</div>
			{:else if page === 3}
				<h2 class="info-title">{t('INFO PAGE WAYS TO WIN')}</h2>
				<div class="wtw">
					<p class="info-p">
						{t('INFO WTW LINES')}
						<br />{t('INFO WTW COMBO')}
						<br />{t('INFO WTW EVAL')}
					</p>
					<p class="info-p">
						{t('INFO WTW WILD')}
						<br />{t('INFO WTW SCATTER')}
						<br />{t('INFO WTW HIGHEST')}
						<br />{t('INFO WTW MULTIPLES')}
					</p>
					<img class="wtw-paylines" src={waysToWin} alt={t('INFO WTW DIAGRAM ALT')} />
					<p class="info-p">
						<b>{t('INFO WTW MULT TITLE')}</b>
						<br />{t('INFO WTW MULT BODY')}
						<br />{WILD_MULTS}
						<br />{t('INFO WTW MULT SUM')}
					</p>
				</div>
			{:else if page === 4}
				<h2 class="info-title">{t('INFO PAGE FEATURE BUY')}</h2>
				<div class="feat-grid">
					{#each SPIN_BUYS as f (f.name)}
						<div class="card feat-card">
							<h3 class="feat-h">{t(f.name)}</h3>
							<p class="feat-p">{t(f.desc)}</p>
							<div class="buy-foot">
								<span class="buy-cost">{cost(f.mult)} {t('PER SPIN')}</span>
								<span class="buy-rtp"><i>{t('RTP')}</i><b>{RTP_SHORT}</b></span>
							</div>
						</div>
					{/each}
					{#each BONUS_BUYS as f (f.name)}
						<div class="card feat-card feat-card--logo">
							<h3 class="feat-h">{t(f.name)}</h3>
							<p class="feat-p">{t(f.desc)}</p>
							<img class="feat-logo feat-logo--sm" src={modeImg(f.img)} alt="" />
							<div class="buy-foot">
								<span class="buy-cost">{cost(f.mult)}</span>
								<span class="buy-rtp"><i>{t('RTP')}</i><b>{RTP_SHORT}</b></span>
							</div>
						</div>
					{/each}
				</div>
			{:else if page === 5}
				<h2 class="info-title">{t('INFO PAGE GENERAL INFO')}</h2>
				<div class="gi">
					<div class="card gi-card gi-card--sm">
						<img class="gi-ic" src={icInterrupted} alt="" />
						<h3 class="gi-h">{t('INFO GI INTERRUPTED TITLE')}</h3>
						<p class="info-p">{t('INFO GI INTERRUPTED BODY')}</p>
						<p class="info-p">{t('INFO GI INTERRUPTED HOLD')}</p>
					</div>
					<div class="card gi-card">
						<img class="gi-ic" src={icLegal} alt="" />
						<h3 class="gi-h">{t('INFO GI LEGAL TITLE')}</h3>
						<p class="info-p">{t('INFO GI LEGAL MALFUNCTION')}</p>
						<p class="info-p">{t('INFO GI LEGAL RETURN')}</p>
						<p class="info-p">{t('INFO GI LEGAL SETTLE')}</p>
					</div>
				</div>
			{:else}
				<h2 class="info-title">{t('INFO PAGE UI GUIDE')}</h2>
				<div class="guide">
					{#each GUIDE as g (g.name)}
						<div class="guide-item">
							{#if g.spin}
								<!-- Not a glyph in a circle: the design shows the actual button, which is the ring
								     art with its arrow on top. -->
								<span class="guide-spin">
									<img class="guide-spin__bg" src={guideSpinBg} alt="" />
									<img class="guide-spin__arrow" src={guideSpinArrow} alt="" />
								</span>
							{:else}
								<span class="guide-ic" class:guide-ic--auto={g.auto}>
									<img
										class="guide-glyph"
										src={uiIcon(g.icon ?? '')}
										alt=""
										style={g.auto ? 'width:23%' : glyphSize(g)}
									/>
									{#if g.auto}<span class="guide-ic__auto">{t('AUTO')}</span>{/if}
								</span>
							{/if}
							<span class="guide-name">{t(g.name)}</span>
							<span class="guide-desc">{t(g.desc)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="info-nav">
			<button
				class="nav-arrow"
				type="button"
				aria-label={t('INFO UI PREVIOUS')}
				disabled={page === 0}
				onclick={prev}
			>
				<img src={iconArrow} alt="" style="transform:scaleX(-1)" />
			</button>
			<span class="nav-page">{t('INFO PAGE LABEL')} {page + 1}/{total}</span>
			<button
				class="nav-arrow"
				type="button"
				aria-label={t('INFO UI NEXT')}
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
		font-family: 'Nunito Sans', sans-serif;
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

	/* The design sets every page title, card heading and guide label in this one magenta→blue ramp
	   (Figma reports it as 171.32deg), so it lives in a single custom property. */
	.info-body {
		--brand-ramp: linear-gradient(171deg, #d836fc 0%, #272fdd 100%);
	}

	.info-title {
		margin: 0 0 12px;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 1.9rem;
		line-height: 1;
		letter-spacing: 0.03em;
		text-align: center;
		background-image: var(--brand-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	/* Only OVERVIEW is left-aligned; every other page centres its title. */
	.info-title--left {
		text-align: left;
	}

	.info-p {
		margin: 0 0 10px;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		font-size: 0.86rem;
		line-height: 1.45;
		letter-spacing: 0.02em;
		color: #fff;
		text-align: center;
	}
	.info-p b {
		font-weight: 700;
	}

	/* Landscape tutorial-box frame image — hidden by default (portrait keeps its CSS neon border). */
	.info-bg {
		display: none;
	}

	/* ── Shared neon card ────────────────────────────────────────────────────────────────────────
	   The design draws these as a thin rounded neon edge over a near-black interior, NOT the chunky
	   painted "S pad" frame the buy-bonus modal uses — that art is a raster with a fixed corner
	   radius, and stretching it across six cards of two different heights was most of why this
	   screen read as off-design. A gradient border-box is resolution-independent.

	   Deliberately unlit: only the modal's outer frame carries travelling lights. Running them on
	   the cards as well put six more pairs of moving dots on screen at once, which read as clutter
	   rather than as the one accent the frame is meant to be. */
	.card {
		position: relative;
		border-radius: 18px;
		border: 2px solid transparent;
		background-origin: border-box;
		background-clip: padding-box, border-box;
		background-image:
			linear-gradient(160deg, rgba(30, 8, 66, 0.95), rgba(11, 3, 30, 0.98)),
			linear-gradient(140deg, #2f7bff 0%, #8b3cff 46%, #ff4fd8 100%);
		box-shadow:
			0 0 16px rgba(120, 60, 255, 0.3),
			inset 0 0 26px rgba(80, 30, 170, 0.25);
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
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 700;
		font-size: 0.92rem;
		letter-spacing: 0.04em;
		text-align: center;
		color: #fff;
	}
	/* "Maximum Win: 25,000× bet" — the number is the headline, the words around it are not. */
	.ov-max {
		margin: 0 0 10px;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0 8px;
		justify-content: center;
		font-size: 0.86rem;
		color: #fff;
	}
	.ov-max b {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 2rem;
		line-height: 1;
		letter-spacing: 0.01em;
		color: #fff;
	}

	/* --- Paytable: a real table, one row per symbol --- */
	.pay {
		display: flex;
		flex-direction: column;
	}
	.pay-head,
	.pay-row {
		display: grid;
		/* The symbol cell is widest because the royals row lines five tiles up inside it. */
		grid-template-columns: 2.1fr 1fr 1fr 1fr;
		align-items: center;
		gap: 4px;
	}
	.pay-head {
		padding-bottom: 8px;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 700;
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		text-align: center;
		color: #d836fc;
	}
	.pay-head__sym {
		text-align: left;
		padding-left: 4px;
	}
	.pay-row {
		/* The design separates rows with a hairline rule rather than boxing each symbol in a card. */
		border-top: 1px solid rgba(190, 160, 255, 0.22);
		min-height: 44px;
	}
	.pay-sym {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.pay-img {
		width: 40px;
		height: 40px;
		object-fit: contain;
		flex: 0 0 auto;
	}
	/* Five royals share one row, so they run smaller and overlap slightly to stay in the cell. */
	.pay-img--royal {
		width: 30px;
		height: 30px;
		margin-right: -3px;
	}
	.pay-val {
		text-align: center;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		font-size: 0.92rem;
		color: #fff;
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
		padding: 12px 14px 14px;
		min-height: 0;
	}
	.feat-h {
		margin: 0 0 6px;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 1.02rem;
		letter-spacing: 0.02em;
		text-align: center;
		background-image: var(--brand-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.feat-p {
		margin: 0;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		font-size: 0.8rem;
		line-height: 1.4;
		color: #fff;
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
		gap: 2px;
	}
	.buy-cost {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 800;
		font-size: 1rem;
		color: #fff;
	}
	.buy-rtp {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.2;
	}
	.buy-rtp i {
		font-style: normal;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		background-image: var(--brand-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.buy-rtp b {
		font-size: 0.8rem;
		font-weight: 600;
		color: #fff;
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
		padding: 16px 18px 18px;
	}
	.gi-ic {
		width: 74px;
		height: 74px;
		object-fit: contain;
		margin-bottom: 10px;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
	}
	.gi-h {
		margin: 0 0 10px;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 1.05rem;
		line-height: 1.15;
		letter-spacing: 0.03em;
		text-align: center;
		/* The title carries the design's forced line break as \n in the catalogue, so a locale whose
		   wording splits differently can move it instead of inheriting an English <br />. */
		white-space: pre-line;
		background-image: var(--brand-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	/* --- UI guide --- */
	.guide {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px 8px;
	}
	.guide-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 6px;
	}
	/* One circle for every control, exactly as the design draws it: a hairline magenta ring over a
	   disc that fades from deep purple at the bottom to black at the top. */
	.guide-ic {
		width: 48px;
		height: 48px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid #d836fc;
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		overflow: hidden;
	}
	.guide-glyph {
		height: auto;
		object-fit: contain;
	}
	/* AUTO stacks a smaller glyph over its caption, so the pair has to sit tighter. */
	.guide-ic--auto {
		gap: 1px;
	}
	.guide-ic__auto {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 700;
		font-size: 8px;
		line-height: 1;
		letter-spacing: -0.2px;
		color: #fff;
	}
	/* SPIN is the real button, so it is the ring art with the arrow centred on it — the same two
	   layers the HUD stacks. */
	.guide-spin {
		position: relative;
		width: 56px;
		height: 56px;
		display: block;
	}
	.guide-spin__bg,
	.guide-spin__arrow {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		object-fit: contain;
	}
	.guide-spin__bg {
		width: 100%;
		height: 100%;
	}
	.guide-spin__arrow {
		width: 39%;
		height: 39%;
	}
	.guide-name {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 0.85rem;
		letter-spacing: 0.03em;
		background-image: var(--brand-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.guide-desc {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		font-size: 0.72rem;
		line-height: 1.3;
		color: #fff;
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
	   orientation. The popup becomes the wide neon box (tutorial-bg.webp) and pages reflow wider.

	   Sizes below are in cqh so every page scales with the box rather than with the root font — the
	   design is a fixed 1200x670 frame, and cqh is what maps its pixel sizes onto any screen. */
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
			font-size: 6cqh;
			line-height: 1;
			margin: 0 0 2.5%;
		}
		.info-p {
			font-size: 1.9cqh;
			margin-bottom: 1.6cqh;
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
			flex: 1 1 34%;
		}
		.ov-feats {
			flex: 1 1 34%;
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			gap: 2.4cqh;
		}
		.ov .info-p {
			text-align: left;
		}
		.ov-max {
			justify-content: flex-start;
			font-size: 1.9cqh;
			margin-bottom: 1.6cqh;
		}
		.ov-max b {
			font-size: 5.4cqh;
		}
		.ov-feat__name {
			margin: 0 0 0.4cqh;
			font-size: 1.95cqh;
			text-align: left;
		}
		.ov-feat .info-p {
			margin-bottom: 0;
		}
		.ov-art {
			flex: 0 0 26%;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3cqh;
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

		/* PAYTABLE → the table fills the box; rows share the height that is left. */
		.pay {
			flex: 1 1 auto;
			min-height: 0;
		}
		.pay-head {
			padding: 0 2% 1.4cqh;
			font-size: 2cqh;
		}
		.pay-row {
			padding: 0 2%;
			min-height: 0;
			flex: 1 1 0;
		}
		.pay-img {
			width: 7.7cqh;
			height: 7.7cqh;
		}
		.pay-img--royal {
			width: 6.4cqh;
			height: 6.4cqh;
			margin-right: -0.5cqh;
		}
		.pay-val {
			font-size: 2.6cqh;
		}

		/* FEATURES / FEATURE BUY → 3 x 2. The design's top row is a short card (title + a line or two)
		   and the bottom row is a tall one with the logo, so the rows are NOT equal height. */
		.feat-grid {
			flex: 1 1 auto;
			min-height: 0;
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			grid-template-rows: auto 1fr;
			gap: 2.6cqh 1.6%;
		}
		.feat-card {
			padding: 2cqh 3%;
		}
		.feat-h {
			font-size: 3.1cqh;
			margin-bottom: 1cqh;
		}
		.feat-p {
			font-size: 1.85cqh;
		}
		/* Fill the space under the text but cap the height (cqh, so it scales with the card) and leave
		   a gap below — the logo never reaches the neon border, at any screen size. */
		.feat-logo {
			flex: 1 1 auto;
			min-height: 0;
			width: auto;
			max-width: 56%;
			max-height: 13cqh;
			/* auto on both sides, so the leftover height splits above and below and the logo sits in
			   the middle of the space under the text — top-aligning it left an obvious void. */
			margin: auto;
		}
		.feat-logo--sm {
			max-height: 9cqh;
		}
		.buy-cost {
			font-size: 2.4cqh;
		}
		.buy-rtp i {
			font-size: 1.7cqh;
		}
		.buy-rtp b {
			font-size: 1.9cqh;
		}
		.buy-foot {
			padding-top: 1.4cqh;
		}

		/* WAYS TO WIN → one centred column with the paylines grid in the middle. */
		.wtw {
			flex: 1 1 auto;
			min-height: 0;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}
		.wtw .info-p {
			max-width: 92%;
			font-size: 1.85cqh;
			/* The design breaks the two blocks apart with a clear blank line; without this they run
			   together into one wall of centred text. */
			margin-bottom: 2.4cqh;
		}
		.wtw .info-p:last-of-type {
			margin-bottom: 0;
		}
		.wtw-paylines {
			max-width: min(40%, 470px);
			margin: 2.6cqh auto;
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
			flex: 0 0 30%;
		}
		.gi-card {
			flex: 1 1 auto;
			justify-content: flex-start;
			padding: 3.5cqh 3% 2cqh;
		}
		.gi-ic {
			width: 11cqh;
			height: 11cqh;
			margin-bottom: 2cqh;
		}
		.gi-h {
			font-size: 3.1cqh;
			margin-bottom: 2cqh;
		}

		/* UI GUIDE → five across, as the design lays it out. */
		.guide {
			flex: 1 1 auto;
			min-height: 0;
			grid-template-columns: repeat(5, 1fr);
			gap: 2.7cqh 4%;
			align-content: center;
			/* The last row has two items; the design keeps them left-aligned under the first column
			   rather than centring them. */
			justify-items: center;
		}
		.guide-ic {
			width: 7.2cqh;
			height: 7.2cqh;
		}
		.guide-spin {
			width: 8.4cqh;
			height: 8.4cqh;
		}
		.guide-ic__auto {
			font-size: 1.2cqh;
		}
		.guide-name {
			font-size: 2.2cqh;
		}
		.guide-desc {
			font-size: 1.5cqh;
		}

		.info-nav {
			position: absolute;
			bottom: 4%;
			left: 0;
			right: 0;
			z-index: 3;
			gap: clamp(8px, 3vh, 22px);
			/* Drop the base row's 10/12px padding — on a short mobile-landscape modal that padding
			   pushed the arrow row up into the bottom row of cards. */
			padding: 0;
		}
		/* Arrows/page count scale with the viewport so they don't dwarf (and collide with) the content
		   on a short mobile-landscape screen; capped so desktop keeps its size. */
		.nav-arrow {
			width: clamp(16px, 8.5vh, 42px);
			height: clamp(16px, 8.5vh, 42px);
		}
		.nav-page {
			/* Inside the frame's right neon border. */
			right: 5%;
			font-size: clamp(0.46rem, 3.35vh, 0.86rem);
		}
		.info-x {
			/* Clear of the frame — sits in the gap beyond the rounded top-right corner, not on it. */
			top: clamp(-30px, -7.7vh, -14px);
			right: clamp(-34px, -8.7vh, -16px);
			width: clamp(24px, 11.3vh, 46px);
			height: clamp(24px, 11.3vh, 46px);
		}
	}
</style>

<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Paytable symbol art (premium symbols and royals).
	const symImg = (name: string) => ap(`/assets/theme-park/v2/symbols/${name}.png`);
	// Paytable art (design update): the complete WILD (gold frame + colourful W, as it reads on the
	// reels once the W is dropped in) and the redrawn balloon cluster. The reel textures are separate.
	const wildImg = ap('/assets/theme-park/v2/info/pay-wild.png');
	const payBalloons = ap('/assets/theme-park/v2/info/pay-balloons.png');

	// Landscape (desktop) tutorial box: neon gradient frame, the duck-on-coaster hero, and the logo.
	// The duck-in-car-on-coaster art in the overview's bottom-left corner. Desktop uses the wide
	// framing; portrait uses the design's rotated "climbing" framing.
	const bottomDuck = ap('/assets/theme-park/v2/info/bottom-duck.png');
	const bottomDuckMobile = ap('/assets/theme-park/v2/info/bottom-duck-mobile.png');
	const gameLogo = ap('/assets/theme-park/v2/splash/logo.webp');
	// Ways-to-win: the finished 15-payline diagram (design update).
	const waysToWin = ap('/assets/theme-park/v2/info/ways-to-win-new.png');

	// General-info card icons (design update): rotate arrow + legal-notice scales.
	const icInterrupted = ap('/assets/theme-park/v2/info/ic-interrupted.png');
	const icLegal = ap('/assets/theme-park/v2/info/ic-legal.png');

	// Premium feature logos for the Features / Feature-Buy bonus cards (design update).
	const featDuck = ap('/assets/theme-park/v2/info/feat-duck.png');
	const featRoller = ap('/assets/theme-park/v2/info/feat-roller.png');
	const featCoaster = ap('/assets/theme-park/v2/info/feat-coaster.png');

	// UI-guide glyphs, exported from the design's own icon-button component (Figma 6445:10828) rather
	// than scavenged from the HUD's button art. The HUD buttons carry their own baked circles at
	// assorted sizes, which is exactly why the old guide looked like a set of mismatched icons.
	const uiIcon = (name: string) => ap(`/assets/theme-park/v2/info/ui/${name}`);
	// Modal chrome: close-X and nav arrows.
	const iconClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
	const iconArrow = ap('/assets/theme-park/v2/splash/arrow.svg');
</script>

<script lang="ts">
	import { stateBet } from 'state-shared';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { templateStakeDerived } from '../state/templateStake.svelte';
	import { fitFont } from '../lib/fitLabel';

	const t = (key: string) => i18nDerived.translate(key);

	type Props = { onclose: () => void; layoutType?: string };
	const props: Props = $props();
	// Wide (landscape) box on desktop/landscape; the tall portrait card on phones in portrait.
	const wide = $derived(props.layoutType !== 'portrait');

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
	// `payImg` (optional) overrides the symbols/ lookup with a direct paytable-only asset.
	type PayRow = { img?: string; payImg?: string; royals?: boolean; royal?: boolean; wild?: boolean; name: string; pays: string[] };
	// The non-royal symbols, shared by both layouts.
	const PAY_ROWS_TAIL: PayRow[] = [
		{ img: 'h5-ferris-marquee', name: 'INFO SYM FERRIS', pays: ['0.5', '2.5', '5'] },
		{ img: 'h4-popcorn-marquee', name: 'INFO SYM POPCORN', pays: ['0.5', '2.5', '5'] },
		{ img: 'h2-duck-marquee', name: 'INFO SYM DUCK', pays: ['1', '5', '10'] },
		{ img: 'h3-balloons-marquee', payImg: payBalloons, name: 'INFO SYM BALLOONS', pays: ['1', '5', '10'] },
		{ img: 'h1-coaster-still', name: 'INFO SYM COASTER', pays: ['2', '10', '20'] },
		{ wild: true, name: 'INFO SYM WILD', pays: ['-', '-', '20'] },
	];
	// Portrait gives each same-paying royal its OWN row (five tiles are cramped in one narrow cell);
	// landscape keeps them on a single shared row, as each layout's design draws it.
	const PAY_ROWS: PayRow[] = $derived([
		...(wide
			? [{ royals: true, name: 'INFO SYM ROYALS', pays: ['0.1', '0.5', '1'] } as PayRow]
			: ROYALS.map(
					(r): PayRow => ({ img: r, royal: true, name: 'INFO SYM ROYALS', pays: ['0.1', '0.5', '1'] }),
				)),
		...PAY_ROWS_TAIL,
	]);

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
			logo: featDuck,
			name: 'BET MODE DUCK TITLE',
			desc: 'BET MODE DUCK DIALOG',
			mult: 100,
		},
		{
			logo: featRoller,
			name: 'BET MODE ROLLER TITLE',
			desc: 'BET MODE ROLLER DIALOG',
			mult: 200,
		},
		{
			logo: featCoaster,
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
	<div class="info-card" class:info-card--ov={page === 0} role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
		<button class="info-x" type="button" aria-label={t('CLOSE')} onclick={props.onclose}>
			<img src={iconClose} alt="" />
		</button>

		<div class="info-body" class:info-body--ov={page === 0} class:info-body--pay={page === 1}>
			{#if page === 0}
				<h2 class="info-title" use:fitFont={t('INFO PAGE OVERVIEW')}>{t('INFO PAGE OVERVIEW')}</h2>
				<img class="ov-logo" src={gameLogo} alt="Theme Park" />
				<div class="ov">
					<div class="ov-intro">
						<p class="info-p">
							{t('INFO OV INTRO')}
							{t('INFO OV WINS')}
							{t('INFO OV FEATURES')}
						</p>
						<p class="ov-stat">
							<span>{t('INFO OV MAX WIN')}</span>
							<b class="ov-stat__val">{MAX_WIN} {t('INFO OV BET')}</b>
						</p>
						<p class="ov-stat">
							<span>{t('INFO OV RTP')}</span>
							<b class="ov-stat__pill">{RTP}</b>
						</p>
					</div>
					<div class="ov-cards">
						<div class="card ov-card">
							<h4 class="ov-card__name">{t('DUCK COLLECT')}</h4>
							<p class="ov-card__p">{t('INFO OV DUCK DESC')}</p>
						</div>
						<div class="card ov-card">
							<h4 class="ov-card__name">{t('ROLLER WILDS')}</h4>
							<p class="ov-card__p">{t('INFO OV ROLLER DESC')}</p>
						</div>
						<div class="card ov-card">
							<h4 class="ov-card__name">{t('MEGA COASTER')}</h4>
							<p class="ov-card__p">{t('INFO OV COASTER DESC')}</p>
						</div>
						<div class="card ov-card">
							<h4 class="ov-card__name">{t('INFO OV BONUS TITLE')}</h4>
							<p class="ov-card__p">{t('INFO OV BONUS DESC')}</p>
						</div>
					</div>
					<img class="ov-duck" src={wide ? bottomDuck : bottomDuckMobile} alt="" />
				</div>
			{:else if page === 1}
				<h2 class="info-title" use:fitFont={t('PAYTABLE')}>{t('PAYTABLE')}</h2>
				<div class="pay">
					<div class="pay-head">
						<span class="pay-head__sym">{t('INFO PAY SYMBOL')}</span>
						<span>{t('INFO PAY 3')}</span>
						<span>{t('INFO PAY 4')}</span>
						<span>{t('INFO PAY 5')}</span>
					</div>
					<div class="pay-body">
						{#each PAY_ROWS as row (row.img ?? row.name)}
						<div class="pay-row">
							<div class="pay-sym">
								{#if row.royals}
									<!-- Landscape: the royals all pay the same, so they share one row. -->
									{#each ROYALS as r (r)}
										<img class="pay-img pay-img--royal" src={symImg(r)} alt={r} />
									{/each}
								{:else if row.wild}
									<img class="pay-img" src={wildImg} alt={t(row.name)} />
								{:else if row.img}
									<!-- A single symbol per row (incl. each portrait royal). `payImg` overrides with a
									     paytable-only asset (e.g. the redrawn balloons). -->
									<img
										class="pay-img"
										class:pay-img--single-royal={row.royal}
										src={row.payImg ?? symImg(row.img)}
										alt=""
									/>
								{/if}
							</div>
							{#each row.pays as v, i (i)}
								<span class="pay-val">{v === '-' ? '-' : `${v} x`}</span>
							{/each}
						</div>
					{/each}
					</div>
				</div>
			{:else if page === 2}
				<h2 class="info-title" use:fitFont={t('INFO PAGE FEATURES')}>{t('INFO PAGE FEATURES')}</h2>
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
							<img class="feat-logo" src={f.logo} alt="" />
						</div>
					{/each}
				</div>
			{:else if page === 3}
				<h2 class="info-title" use:fitFont={t('INFO PAGE WAYS TO WIN')}>{t('INFO PAGE WAYS TO WIN')}</h2>
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
				<h2 class="info-title" use:fitFont={t('INFO PAGE FEATURE BUY')}>{t('INFO PAGE FEATURE BUY')}</h2>
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
							<img class="feat-logo feat-logo--sm" src={f.logo} alt="" />
							<div class="buy-foot">
								<span class="buy-cost">{cost(f.mult)}</span>
								<span class="buy-rtp"><i>{t('RTP')}</i><b>{RTP_SHORT}</b></span>
							</div>
						</div>
					{/each}
				</div>
			{:else if page === 5}
				<h2 class="info-title" use:fitFont={t('INFO PAGE GENERAL INFO')}>{t('INFO PAGE GENERAL INFO')}</h2>
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
						<p class="info-p gi-tm">{t('INFO GI LEGAL TM')}</p>
					</div>
				</div>
			{:else}
				<h2 class="info-title" use:fitFont={t('INFO PAGE UI GUIDE')}>{t('INFO PAGE UI GUIDE')}</h2>
				<div class="guide">
					{#each GUIDE as g (g.name)}
						<div class="guide-item">
							{#if g.spin}
								<!-- Redesigned spin icon (a complete icon button), sized to match the other guide
								     circles. -->
								<img class="guide-spin" src={uiIcon('ui-spin.png')} alt="" />
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
							<span class="guide-text">
								<span class="guide-name" use:fitFont={t(g.name)}>{t(g.name)}</span>
								<span class="guide-desc">{t(g.desc)}</span>
							</span>
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
		/* Flat muted-purple frame per the design — no neon gradient / marching lights. */
		border: 2px solid #5e4374;
		background: #1d023a;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
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
	/* Overview (portrait): flex-column so .ov fills the body and the duck drops to the bottom. The nav
	   floats (below) so the body reaches the modal's bottom edge and the duck can sit all the way down;
	   overflow:hidden crops the duck's bottom/left bleed without a scrollbar (overview copy always fits).
	   (Wide overrides these in the .is-wide block.) */
	.info-body--ov {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding-bottom: 0;
	}
	.info-card--ov .info-nav {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 4px;
		z-index: 4;
	}
	/* Paytable (portrait): fill the body so the table spans the modal like it does on desktop,
	   instead of sitting compact at the top with dead space below. */
	.info-body--pay {
		display: flex;
		flex-direction: column;
	}

	/* Card headings and guide labels use this magenta→blue ramp (Figma 171.32deg). The new design
	   sets the PAGE TITLES in the game's brand gold instead (the same gold-ramp the splash titles
	   use), so that lives in its own property and only .info-title reads it. */
	.info-body {
		--brand-ramp: linear-gradient(171deg, #d836fc 0%, #272fdd 100%);
		--gold-ramp: linear-gradient(181.3deg, #f1eea5 7.45%, #e79a17 28.07%, #d7880c 63.58%, #a16202 93.75%);
	}

	.info-title {
		margin: 0 0 12px;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		/* Portrait: shrink long/translated titles with the viewport so "GEWINNTABELLE" et al. never grow
		   into the close button, and reserve its top-right corner so the centred title clears it. */
		font-size: min(2.3rem, 8cqw);
		line-height: 1;
		letter-spacing: 0.03em;
		text-align: center;
		padding: 0 44px;
		background-image: var(--gold-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	/* Only OVERVIEW is left-aligned; every other page centres its title. */
	.info-title--left {
		text-align: left;
		/* Left-pinned title only needs the right side kept clear of the X. */
		padding-left: 0;
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
		border-radius: 14px;
		/* Flat card per the design: muted-purple hairline border over a slightly-lighter fill. */
		border: 1px solid #5e4374;
		background: #230741;
	}

	/* OVERVIEW — portrait: a centred intro (copy + max-win/RTP) with the duck art beneath it, matching
	   the design's mobile page. The four feature cards are a desktop-only bottom row (see .is-wide). */
	.ov {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* Fill the body (portrait) so the duck can drop to the bottom-left corner. */
		flex: 1 1 auto;
		min-height: 0;
	}
	.ov-intro {
		width: 100%;
	}
	/* More breathing room between the intro copy and the Max-Win / RTP rows (mobile). */
	.ov-intro .info-p {
		margin-bottom: 24px;
	}
	/* "Maximum Win: 25,000× bet" / "Theoretical RTP: 96.10%" — label white, value highlighted (gold
	   for the win, a magenta pill for the RTP), as the design draws them. */
	.ov-stat {
		margin: 0 0 6px;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0 8px;
		justify-content: center;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 600;
		font-size: 0.9rem;
		color: #fff;
	}
	.ov-stat__val {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 1.05rem;
		letter-spacing: 0.01em;
		background-image: var(--gold-ramp);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}
	.ov-stat__pill {
		font-weight: 800;
		color: #fff;
		padding: 6px 20px;
		border-radius: 8px;
		background: #341451;
	}
	/* Feature cards: hidden in portrait (design shows them on desktop only); a 4-across row on wide. */
	.ov-cards {
		display: none;
	}
	.ov-card {
		padding: 10px 12px 12px;
		text-align: center;
	}
	.ov-card__name {
		margin: 0 0 5px;
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 0.94rem;
		letter-spacing: 0.03em;
		color: #fff;
	}
	.ov-card__p {
		margin: 0;
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		font-size: 0.76rem;
		line-height: 1.4;
		color: #d9cff2;
	}
	.ov-logo {
		display: none;
	}
	.ov-duck {
		/* Portrait "climbing" framing (the dedicated mobile asset — already oriented, no mirror),
		   dropped into the bottom-left corner; the body clips its left bleed. */
		align-self: flex-start;
		margin-top: auto;
		margin-left: -16px;
		width: 62%;
		max-width: 240px;
		height: auto;
		filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.55));
	}

	/* --- Paytable: a real table, one row per symbol --- */
	.pay {
		display: flex;
		flex-direction: column;
		/* Fill the body when it is a flex column (portrait --pay / desktop), so the rows share the
		   height and the table spans the modal. */
		flex: 1 1 auto;
		min-height: 0;
	}
	/* The framed table BODY — the outer border wraps only the rows, ending before (and leaving a gap
	   for) the detached header pill above it. */
	.pay-body {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		border: 1px solid #5e4374;
		border-radius: 12px;
		overflow: hidden;
	}
	.pay-head,
	.pay-row {
		display: grid;
		/* The symbol cell is widest because the royals row lines five tiles up inside it — but not so
		   wide that the value columns squeeze "3 In a Line" onto two lines on a narrow phone. */
		grid-template-columns: 1.7fr 1fr 1fr 1fr;
		/* Stretch (not centre) + no gap so the column separator borders run the full cell height and
		   sit cleanly on the column edges. */
		align-items: stretch;
		gap: 0;
		padding: 0 12px;
	}
	/* Centre every value cell (header + body). */
	.pay-val,
	.pay-head > span:not(.pay-head__sym) {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* Vertical padding lives on the header cells (not the .pay-head) so the column gap borders run the
	   FULL height of the pill. */
	.pay-head > span {
		padding-top: 9px;
		padding-bottom: 9px;
	}
	/* Real full-height gaps between the header columns — a wide dark slit (the modal bg) that splits the
	   #341451 pill top-to-bottom, on the same column edges as the body's vertical lines. Drawn as an
	   over-extended pseudo-element clipped by the pill (`overflow:hidden`) so it always spans 100%. */
	.pay-head > span:not(.pay-head__sym) {
		position: relative;
	}
	.pay-head > span:not(.pay-head__sym)::before {
		content: '';
		position: absolute;
		left: -2px;
		top: -40px;
		bottom: -40px;
		width: 4px;
		background: #1d023a;
	}
	/* Solid vertical column separators — body only; the header is a detached bar above. */
	.pay-val {
		border-left: 1px solid #5e4374;
	}
	.pay-head {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 700;
		/* Scale with the viewport so "3 In a Line" stays on ONE line down to the tightest phones. */
		font-size: clamp(0.56rem, 2.6cqw, 0.68rem);
		letter-spacing: 0.01em;
		text-align: center;
		color: #fff;
		background: #341451;
		/* Detached header bar — a rounded pill with a gap before the body, not fused to the first row. */
		border-radius: 8px;
		margin-bottom: 6px;
		/* Clip the over-extended column-gap pseudo-elements to the pill so they read as full-height. */
		overflow: hidden;
	}
	.pay-head__sym {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.pay-row {
		/* Smaller floor so all 11 portrait rows (5 split royals + 6) fit even on a 360px phone. */
		min-height: 36px;
		/* Share the leftover height so the table fills the box (portrait --pay body / desktop). */
		flex: 1 1 0;
	}
	/* Solid rules BETWEEN body rows (not above the first — the detached header already sits apart). */
	.pay-row + .pay-row {
		border-top: 1px solid #5e4374;
	}
	.pay-sym {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.pay-img {
		width: 34px;
		height: 34px;
		object-fit: contain;
		flex: 0 0 auto;
	}
	/* Five royals share one row, so they run smaller and overlap slightly to stay in the cell. Portrait
	   is narrow, so cap them to the viewport width too — a flat 30px overflowed the symbol column into
	   the "0.1x" values. (Wide layout re-sizes these by cqh below.) */
	.pay-img--royal {
		width: min(30px, 6.2cqw);
		height: min(30px, 6.2cqw);
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
		/* White card titles (design update). */
		color: #fff;
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
	/* Price sits in a filled pill (design update): #341451 box, white text. */
	.buy-cost {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 800;
		font-size: 0.95rem;
		color: #fff;
		background: #341451;
		padding: 4px 14px;
		border-radius: 8px;
	}
	/* RTP label + percent on ONE white row, beneath the price box. */
	.buy-rtp {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: 5px;
		line-height: 1.2;
		margin-top: 6px;
	}
	.buy-rtp i {
		font-style: normal;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #fff;
	}
	.buy-rtp b {
		font-size: 0.8rem;
		font-weight: 700;
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
		/* White card titles (design update). */
		color: #fff;
	}
	/* Small muted copyright / trademark line at the foot of the legal card. */
	.gi-tm {
		margin-top: 8px;
		font-size: 0.72rem;
		opacity: 0.7;
	}

	/* --- UI guide --- */
	/* Portrait (the new design): a single-column LIST — each control is one full-width row, its icon
	   on the left and name-over-description on the right. Full width per row means long translated
	   names/descriptions (fi "AUTOMAATTIKIERROKSET") always have room, so nothing overflows or has to
	   be squeezed into a narrow third. The desktop/.is-wide layout below overrides this back to the
	   5-across grid the design draws for the wide box. */
	.guide {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.guide-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		text-align: left;
		gap: 12px;
		min-width: 0;
		/* Boxed rows (design update): muted-purple border over a slightly-lighter fill. */
		border: 1px solid #5e4374;
		border-radius: 12px;
		background: #230741;
		padding: 8px 12px;
	}
	/* Name over description — the right-hand block of a list row (portrait) or the stack under the
	   icon (wide). */
	.guide-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		flex: 1 1 auto;
		min-width: 0;
	}
	.guide-ic,
	.guide-spin {
		flex: 0 0 auto;
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
	/* Redesigned spin icon — a complete icon button, sized to match the .guide-ic circles. */
	.guide-spin {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}
	.guide-name {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 0.85rem;
		letter-spacing: 0.03em;
		/* Fill the cell so fitFont measures the column width (not the shrink-to-content text width)
		   and can scale a too-long single word down to fit its third. */
		display: block;
		width: 100%;
		max-width: 100%;
		/* White guide labels (design update). */
		color: #fff;
	}
	.guide-desc {
		font-family: 'Nunito Sans', sans-serif;
		font-weight: 500;
		font-size: 0.72rem;
		line-height: 1.3;
		color: #fff;
		max-width: 100%;
		/* A long word in a description (fi "automaattikierrosten") breaks instead of spilling. */
		overflow-wrap: break-word;
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
		/* Bigger glyph inside the circle — the arrow SVG carries padding, so 44% read as an almost
		   invisible dot on small landscape. */
		width: 58%;
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
	   orientation. The popup becomes the wide flat box and pages reflow wider.

	   Sizes below are in cqh so every page scales with the box rather than with the root font — the
	   design is a fixed 1200x670 frame, and cqh is what maps its pixel sizes onto any screen. */
	.info-overlay.is-wide {
		.info-card {
			/* Almost the whole screen: the largest 1484:750 box that fits. */
			width: min(97cqw, calc(95cqh * 1.979), 1620px);
			height: auto;
			aspect-ratio: 1484 / 750;
			/* Flat muted-purple frame (same as portrait) — the neon frame image is gone. */
			border: 2px solid #5e4374;
			background: #1d023a;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
			border-radius: 26px;
			overflow: visible; /* let the close-X sit outside the box */
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
			/* Wide layout parks the X outside the frame, so the title reclaims the full width. */
			padding: 0;
		}
		.info-p {
			font-size: 1.9cqh;
			margin-bottom: 1.6cqh;
		}

		/* OVERVIEW → centred intro up top, a four-card feature row pinned to the bottom, the duck art in
		   the bottom-left corner and the game logo top-right (both absolute, over the empty mid-band). */
		.ov {
			position: relative;
			display: flex;
			flex-direction: column;
			align-items: center;
			flex: 1 1 auto;
			min-height: 0;
		}
		.ov-intro {
			/* Copy sits up near the title; the duck art fills the band beneath it, so the page reads full
			   without the copy overlapping the car. */
			flex: 0 0 auto;
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			width: 82%;
			text-align: center;
			margin-top: 1cqh;
		}
		.ov .info-p {
			text-align: center;
			font-size: 2.05cqh;
			margin-bottom: 2cqh;
		}
		.ov-stat {
			justify-content: center;
			font-size: 2.3cqh;
			margin-bottom: 0.8cqh;
		}
		.ov-stat__val {
			font-size: 3.3cqh;
		}
		.ov-stat__pill {
			font-size: 2.1cqh;
			padding: 0.4cqh 1.8cqh;
		}
		.ov-cards {
			display: grid;
			/* minmax(0,1fr) so a long card description can't inflate a track and overflow the row. */
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 1.6%;
			width: 100%;
			box-sizing: border-box;
			flex: 0 0 auto;
			margin-top: auto;
			position: relative;
			z-index: 2;
			/* Lift off the bottom edge so the coaster track shows in a band beneath the cards. */
			margin-bottom: 4.5cqh;
			/* Clear the duck's car, which pokes up in the bottom-left over the track. */
			padding-left: 13%;
		}
		.ov-card {
			padding: min(16px, 2.3cqh);
			min-width: 0;
			/* Taller boxes per the design; capped in px, scaling with cqh so they never overflow the
			   short/small landscape modal (800×450, 400×225). */
			min-height: min(155px, 21.5cqh);
			display: flex;
			flex-direction: column;
			justify-content: center;
		}
		.ov-card__name {
			/* Design spec: Lilita One 400, 18px, line-height 100%, letter-spacing 3% — capped at 18px on
			   desktop, scaling with cqh below the design size so it never clips on small landscape. */
			font-size: min(18px, 2.5cqh);
			line-height: 1;
			letter-spacing: 0.03em;
			margin-bottom: min(10px, 1.4cqh);
		}
		.ov-card__p {
			/* Design spec: Nunito 400, 12px, line-height 100%, letter-spacing 3% (px-capped, cqh-scaled). */
			font-size: min(12px, 1.7cqh);
			line-height: 1;
			letter-spacing: 0.03em;
		}
		.ov-logo {
			display: block;
			position: absolute;
			/* Inset from the frame so the logo doesn't collide with the border / close-X. */
			top: 3%;
			right: 3.5%;
			width: 17%;
			max-width: 270px;
			height: auto;
		}
		/* Wide duck-on-coaster tucked into the bottom-LEFT corner, mirrored (car faces into the page). */
		.ov-duck {
			position: absolute;
			/* Pushed into the very bottom-left corner so the body's overflow:hidden crops its
			   bottom-left a little; the car (right of the mirrored art) reaches up to slightly overlap
			   the first card. */
			left: -10%;
			bottom: -42%;
			width: 32%;
			max-width: 450px;
			height: auto;
			margin-top: 0;
			transform: scaleX(-1);
			z-index: 3;
		}

		/* PAYTABLE → the table fills the box; rows share the height that is left. */
		.pay {
			flex: 1 1 auto;
			min-height: 0;
		}
		.pay-head {
			padding: 1.3cqh 2%;
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

		/* UI GUIDE → five across, as the design lays it out. Wide reverts the portrait list back to a
		   grid of vertical cells (icon on top, name+desc centred below). */
		.guide {
			display: grid;
			flex: 1 1 auto;
			min-height: 0;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 2.7cqh 4%;
			align-content: center;
			/* The last row has two items; grid's default start-packing keeps them under the first
			   columns (left) — that's the design. Items stretch to their track (was `center`, which
			   sized each item to its content and let a long fi name spill past the column); content
			   stays centred via the glyph's flex-centre + text-align. */
			justify-items: stretch;
		}
		.guide-item {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 0.9cqh;
			/* Scale the box padding down on short/small landscape so the 3 guide rows don't overflow
			   (which pushed the title off the top at 400×225). */
			padding: min(8px, 1.6cqh) min(12px, 2cqh);
		}
		.guide-text {
			align-items: center;
			width: 100%;
		}
		.guide-ic {
			width: 7.2cqh;
			height: 7.2cqh;
		}
		.guide-spin {
			width: 7.2cqh;
			height: 7.2cqh;
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

		/* Very short landscape (e.g. 400x225). cqh scales fonts with the viewport, but the flex-shared
		   paytable rows and the fixed-px pill paddings shrink faster than cqh does, so a few things read
		   as cramped/oversized only here. Trim those specifically — desktop and 800x450 are untouched. */
		@container (max-height: 340px) {
			/* Symbols were filling the ~18px rows edge-to-edge; give them breathing room. */
			.pay-img {
				width: 6cqh;
				height: 6cqh;
			}
			.pay-img--royal {
				width: 5cqh;
				height: 5cqh;
			}
			/* Feature-buy price pill: fixed 4px/14px padding was huge relative to the tiny card. */
			.buy-cost {
				padding: 2px 8px;
				border-radius: 5px;
			}
			.feat-card {
				padding: 1.4cqh 3%;
			}
			.feat-logo {
				max-height: 11cqh;
			}
			/* The circle is fine, but the thin line-arrow inside was a barely-visible speck at ~11px.
			   Fill most of the circle so the glyph actually reads at this size. */
			.nav-arrow img {
				width: 80%;
			}
		}
	}
</style>

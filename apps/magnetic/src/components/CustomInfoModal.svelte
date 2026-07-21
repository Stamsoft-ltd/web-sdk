<script lang="ts">
	import { onMount } from 'svelte';

	import { i18nDerived } from '../i18n/i18nDerived';

	// Shorthand: reactive translate + interpolating translate (re-runs on locale change).
	const t = (key: string) => i18nDerived.translate(key);

	// Game description / rules popup — Magnetic Megachain. Multi-page (arrows below). All copy is
	// localized via the i18n keys ('INFO …'); numeric values stay as constants here.
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	const logo = ap('/assets/components/ui/magnetic_logo.png');
	// Finished art (designer exports): overview hero composite, popup frame, reels-grid box element,
	// and the sci-fi value box used behind the small stat cards.
	const heroImg = ap('/assets/components/ui/info_hero.png');
	const panelImg = ap('/assets/components/ui/info_panel.png');
	const boxGrid = ap('/assets/components/ui/info_box_grid.png');
	const icCluster = ap('/assets/components/ui/info_ic_cluster.png');
	const icTrophy = ap('/assets/components/ui/info_ic_trophy.png');
	const icRtp = ap('/assets/components/ui/info_ic_rtp.png');
	const valueBox = ap('/assets/components/navbar/value_box_mobile.png');
	// Real pager arrow buttons (circle + arrow, cyan→blue ring) with disabled variants.
	const arrowLeft = ap('/assets/components/ui/info_arrow_left.png');
	const arrowLeftOff = ap('/assets/components/ui/info_arrow_left_off.png');
	const arrowRight = ap('/assets/components/ui/info_arrow_right.png');
	const arrowRightOff = ap('/assets/components/ui/info_arrow_right_off.png');

	// ── Paytable (page 2) — symbol art in rank order (highest → lowest) with the pay bands from
	// config.ts (H1→L4). Column headers are the connected-cluster sizes. ──
	const sym = (p: string) => ap(`/assets/components/symbols/magnetic/${p}`);
	const PAY_COLS = ['5', '6', '7', '8', '9', '10+', '12+', '15+', '20+', '25+', '30+', '33+'];
	const payRows = [
		{ img: sym('premium/horseshoe.png'), v: ['0.5x', '1x', '2x', '4x', '8x', '15x', '30x', '75x', '200x', '500x', '1000x', '2000x'] },
		{ img: sym('premium/plasma_drill.png'), v: ['0.4x', '0.8x', '1.5x', '3x', '6x', '12x', '25x', '60x', '150x', '350x', '750x', '1500x'] },
		{ img: sym('premium/magnetic_core_cube.png'), v: ['0.3x', '0.6x', '1.2x', '2.5x', '5x', '10x', '20x', '45x', '120x', '275x', '600x', '1200x'] },
		{ img: sym('premium/electromagnetic_device.png'), v: ['0.2x', '0.5x', '1x', '2x', '4x', '8x', '15x', '35x', '90x', '200x', '450x', '900x'] },
		{ img: sym('low/bolt.png'), v: ['0.15x', '0.3x', '0.6x', '1.2x', '2.5x', '5x', '10x', '25x', '60x', '125x', '250x', '500x'] },
		{ img: sym('low/nut.png'), v: ['0.12x', '0.25x', '0.5x', '1x', '2x', '4x', '8x', '20x', '50x', '100x', '200x', '400x'] },
		{ img: sym('low/washer.png'), v: ['0.1x', '0.2x', '0.4x', '0.8x', '1.6x', '3x', '6x', '15x', '40x', '80x', '150x', '300x'] },
		{ img: sym('low/energy_screw.png'), v: ['0.08x', '0.1x', '0.3x', '0.6x', '1.2x', '2.5x', '5x', '12x', '30x', '60x', '120x', '250x'] },
	];
	const wild = sym('special/wild.png');
	const wildX10 = sym('special/wild_x10.png');
	const scatter = sym('special/scatter.png');

	// Cluster-win illustration (page 4): finished WIN / NO WIN grid art (label baked in).
	const winImg = ap('/assets/components/ui/info_win.png');
	const noWinImg = ap('/assets/components/ui/info_nowin.png');
	// General-info icons (page 6).
	const icRotate = ap('/assets/components/ui/info_ic_rotate.png');
	const icLegal = ap('/assets/components/ui/info_ic_legal.png');

	// Game controls (page 7) — the finished round-button icon set (designer export), in file order.
	// name/desc are i18n keys, translated reactively in the template.
	const controls = [
		{ img: ap('/assets/components/ui/ctrl_spin.png'), nameKey: 'INFO CTRL SPIN', descKey: 'INFO CTRL SPIN DESC', big: true },
		{ img: ap('/assets/components/ui/ctrl_auto.png'), nameKey: 'INFO CTRL AUTO', descKey: 'INFO CTRL AUTO DESC' },
		{ img: ap('/assets/components/ui/ctrl_turbo.png'), nameKey: 'INFO CTRL TURBO', descKey: 'INFO CTRL TURBO DESC' },
		{ img: ap('/assets/components/ui/ctrl_plus.png'), nameKey: 'INFO CTRL PLUS', descKey: 'INFO CTRL PLUS DESC' },
		{ img: ap('/assets/components/ui/ctrl_minus.png'), nameKey: 'INFO CTRL MINUS', descKey: 'INFO CTRL MINUS DESC' },
		{ img: ap('/assets/components/ui/ctrl_info.png'), nameKey: 'INFO CTRL INFO', descKey: 'INFO CTRL INFO DESC' },
		{ img: ap('/assets/components/ui/ctrl_sound.png'), nameKey: 'INFO CTRL SOUND', descKey: 'INFO CTRL SOUND DESC' },
		{ img: ap('/assets/components/ui/ctrl_arrow_left.png'), nameKey: 'INFO CTRL PREV', descKey: 'INFO CTRL PREV DESC' },
		{ img: ap('/assets/components/ui/ctrl_arrow_right.png'), nameKey: 'INFO CTRL NEXT', descKey: 'INFO CTRL NEXT DESC' },
		{ img: ap('/assets/components/ui/ctrl_close.png'), nameKey: 'INFO CTRL CLOSE', descKey: 'INFO CTRL CLOSE DESC' },
		{ img: ap('/assets/components/ui/ctrl_menu.png'), nameKey: 'INFO CTRL MENU', descKey: 'INFO CTRL MENU DESC' },
		{ img: ap('/assets/components/ui/ctrl_music.png'), nameKey: 'INFO CTRL MUSIC', descKey: 'INFO CTRL MUSIC DESC' },
	];

	type Props = { onclose: () => void };
	const props: Props = $props();

	const TOTAL = 7;
	let page = $state(1);
	const next = () => (page = Math.min(TOTAL, page + 1));
	const prev = () => (page = Math.max(1, page - 1));

	const RTP = '96.10%';
	const RTP_SHORT = '96.1%';
	const MAX_WIN = '20,000x';
	// "Maximum win: %value% bet." split around the (bold) value so it stays highlighted in any language.
	const maxWinParts = $derived(t('INFO OV MAXWIN').split('%value%'));

	onMount(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') props.onclose();
			else if (e.key === 'ArrowRight') next();
			else if (e.key === 'ArrowLeft') prev();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<button class="info-backdrop" type="button" aria-label="Close" tabindex="-1" onclick={props.onclose}
></button>

<div class="info-overlay" style={`--panel-img:url(${panelImg})`}>
	<div class="info-panel" role="dialog" aria-modal="true">
		<!-- Stage wrapper: transparent (display:contents) at normal sizes; on small landscape it becomes a
		     fixed-size, scaled-to-fit canvas so the whole layout zooms down as one unit. -->
		<div class="info-stage">
		<div class="info-body">
			{#if page === 1}
				<div class="ov">
					<div class="ov-left">
						<h2 class="ov-title">{t('INFO OVERVIEW')}</h2>
						<p class="ov-text">{t('INFO OV TEXT 1')}</p>
						<p class="ov-text">{t('INFO OV TEXT 2')}</p>
						<p class="ov-maxwin">{maxWinParts[0]}<span>{MAX_WIN}</span>{maxWinParts[1] ?? ''}</p>
					</div>

					<div class="ov-right">
						<img class="ov-logo" src={logo} alt="Magnetic Megachain" />
						<div class="ov-hero">
							<div class="ov-hero-glow"></div>
							<img class="ov-hero-img" src={heroImg} alt="" />
						</div>
					</div>
				</div>

				<div class="ov-stats" style={`--box-img:url(${valueBox})`}>
					<div class="stat">
						<span class="stat-ic"><img src={boxGrid} alt="" /></span>
						<span class="stat-txt"><b>7X7</b><i>{t('INFO STAT REELS')}</i></span>
					</div>
					<div class="stat stat--sm">
						<span class="stat-ic"><img src={icCluster} alt="" /></span>
						<span class="stat-txt"><b>{t('INFO STAT CLUSTER')}</b><i>{t('INFO STAT PAYS')}</i></span>
					</div>
					<div class="stat">
						<span class="stat-ic"><img src={icTrophy} alt="" /></span>
						<span class="stat-txt"><b>20,000</b><i>{t('INFO STAT MAXWIN')}</i></span>
					</div>
					<div class="stat">
						<span class="stat-ic"><img src={icRtp} alt="" /></span>
						<span class="stat-txt"><b>{RTP}</b><i>{t('INFO STAT RTP')}</i></span>
					</div>
				</div>
			{:else if page === 2}
				<div class="page pt-page">
					<h2 class="page-title">{t('INFO PAYTABLE')}</h2>
					<div class="pt">
						<div class="pt-table-wrap">
							<table class="pt-table">
								<thead>
									<tr>
										<th class="pt-rank">{t('INFO SYMBOL RANK')}</th>
										{#each PAY_COLS as c}<th>{c}</th>{/each}
									</tr>
								</thead>
								<tbody>
									{#each payRows as row}
										<tr>
											<td class="pt-sym"><img src={row.img} alt="" /></td>
											{#each row.v as val}<td>{val}</td>{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<aside class="pt-side card">
							<h3 class="pt-side-title">{t('INFO WILD VALUES')}</h3>
							<p class="pt-side-h">{t('INFO WILD STANDARD')}</p>
							<p class="pt-side-v">2x, 3x, 4x, 5x, 10x, 25x</p>
							<p class="pt-side-h">{t('INFO WILD RARE')}</p>
							<p class="pt-side-v">50x, 100x</p>
						</aside>
					</div>
				</div>
			{:else if page === 3}
				<div class="page">
					<h2 class="page-title">{t('INFO FEATURES')}</h2>
					<div class="feat-grid">
						<div class="feat-col-small">
							<div class="card feat-card">
								<h3 class="feat-h">{t('INFO FEAT WILD TITLE')}</h3>
								<p class="feat-p">{t('INFO FEAT WILD TEXT')}</p>
								<img class="feat-ic" src={wild} alt="Wild" />
							</div>
							<div class="card feat-card">
								<h3 class="feat-h">{t('INFO FEAT MWILD TITLE')}</h3>
								<p class="feat-p">{t('INFO FEAT MWILD TEXT')}</p>
								<img class="feat-ic" src={wildX10} alt="Multiplier Wild" />
							</div>
						</div>
						<div class="card feat-card feat-tall">
							<h3 class="feat-h">{t('INFO FEAT DROP TITLE')}</h3>
							<p class="feat-p">{t('INFO FEAT DROP TEXT')}</p>
							<div class="feat-trigger"><span class="feat-x">3x</span><img src={scatter} alt="Scatter" /></div>
						</div>
						<div class="card feat-card feat-tall">
							<h3 class="feat-h">{t('INFO FEAT MEGA TITLE')}</h3>
							<p class="feat-p">{t('INFO FEAT MEGA TEXT')}</p>
							<div class="feat-trigger"><span class="feat-x">4x</span><img src={scatter} alt="Scatter" /></div>
						</div>
					</div>
				</div>
			{:else if page === 4}
				<div class="page">
					<h2 class="page-title">{t('INFO CLUSTER WIN')}</h2>
					<div class="cw">
						<div class="cw-text">
							<p>{t('INFO CW 1')}</p>
							<p>{t('INFO CW 2')}</p>
							<p>{t('INFO CW 3')}</p>
							<p>{t('INFO CW 4')}</p>
							<p>{t('INFO CW 5')}</p>
						</div>
						<div class="cw-grids">
							<img class="cw-img" src={winImg} alt="Winning cluster example" />
							<img class="cw-img" src={noWinImg} alt="No-win example" />
						</div>
					</div>
				</div>
			{:else if page === 5}
				<div class="page">
					<h2 class="page-title">{t('INFO FEATURE BUY')}</h2>
					<p class="fb-sub">{t('INFO FB SUB')}</p>
					<div class="fb-grid">
						<div class="card feat-card">
							<h3 class="feat-h">{t('INFO FB EXTRA TITLE')}</h3>
							<p class="feat-p">{t('INFO FB EXTRA TEXT')}</p>
							<img class="feat-ic" src={wild} alt="Wild" />
							<div class="fb-meta"><span class="fb-k">{t('INFO COST')}</span><span class="fb-v">100x {t('BET')}</span></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span></div>
						</div>
						<div class="card feat-card">
							<h3 class="feat-h">{t('INFO FB FEATURE TITLE')}</h3>
							<p class="feat-p">{t('INFO FB FEATURE TEXT')}</p>
							<div class="feat-trigger"><span class="feat-x">3x</span><img src={scatter} alt="Scatter" /></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO COST')}</span><span class="fb-v">100x {t('BET')}</span></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span></div>
						</div>
						<div class="card feat-card">
							<h3 class="feat-h">{t('INFO FB BONUS TITLE')}</h3>
							<p class="feat-p">{t('INFO FB BONUS TEXT')}</p>
							<div class="feat-trigger"><span class="feat-x">4x</span><img src={scatter} alt="Scatter" /></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO COST')}</span><span class="fb-v">100x {t('BET')}</span></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span></div>
						</div>
					</div>
				</div>
			{:else if page === 6}
				<div class="page">
					<h2 class="page-title">{t('INFO GENERAL INFO')}</h2>
					<div class="gi-grid">
						<div class="card gi-card">
							<span class="gi-ic"><img src={icRotate} alt="" /></span>
							<h3 class="feat-h">{t('INFO GI INTERRUPTED TITLE')}</h3>
							<p class="feat-p">{t('INFO GI INTERRUPTED 1')}</p>
							<p class="feat-p">{t('INFO GI INTERRUPTED 2')}</p>
						</div>
						<div class="card gi-card gi-wide">
							<span class="gi-ic gi-ic--legal"><img src={icLegal} alt="" /></span>
							<h3 class="feat-h">{t('INFO GI LEGAL TITLE')}</h3>
							<p class="feat-p">{t('INFO GI LEGAL 1')}</p>
							<p class="feat-p">{t('INFO GI LEGAL 2')}</p>
							<p class="feat-p">{t('INFO GI LEGAL 3')}</p>
						</div>
					</div>
				</div>
			{:else}
				<div class="page">
					<h2 class="page-title">{t('INFO UI GUIDE')}</h2>
					<div class="ctrl-grid">
						{#each controls as c}
							<div class="ctrl">
								<img class="ctrl-ic" class:ctrl-ic--lg={c.big} src={c.img} alt={t(c.nameKey)} />
								<h3 class="ctrl-name">{t(c.nameKey)}</h3>
								<p class="ctrl-desc">{t(c.descKey)}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<div class="info-pager">
			<button class="pg-arrow" type="button" onclick={prev} disabled={page === 1} aria-label="Previous">
				<img class="pg-ic" src={page === 1 ? arrowLeftOff : arrowLeft} alt="" />
			</button>
			<button class="pg-arrow" type="button" onclick={next} disabled={page === TOTAL} aria-label="Next">
				<img class="pg-ic" src={page === TOTAL ? arrowRightOff : arrowRight} alt="" />
			</button>
			<span class="pg-num">{t('INFO PAGE')} {page}/{TOTAL}</span>
		</div>
		</div>
	</div>

	<!-- Close button pinned to the screen's top-right corner (outside the panel). -->
	<button class="info-close" type="button" onclick={props.onclose} aria-label="Close">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
	</button>
</div>

<style>
	.info-backdrop {
		position: absolute;
		inset: 0;
		z-index: 59;
		border: none;
		padding: 0;
		background: rgba(2, 6, 16, 0.72);
		cursor: default;
	}
	.info-overlay {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		pointer-events: none;
		container-type: size;
		font-family: 'Inter', sans-serif;
	}
	.info-panel {
		pointer-events: auto;
		position: relative;
		/* A touch narrower than the viewport so the screen-corner close button clears the panel. */
		width: min(1120px, 87cqw);
		height: min(660px, 90cqh);
		box-sizing: border-box;
		/* Content inset = border-image width + this padding, keeping text/art clear of the frame art. */
		padding: clamp(12px, 2.8cqmin, 38px) clamp(16px, 3.4cqmin, 48px);
		background:
			radial-gradient(120% 90% at 70% 15%, rgba(30, 64, 120, 0.4), transparent 60%),
			linear-gradient(160deg, #0b1830 0%, #081326 60%, #050d1c 100%);
		/* Finished sci-fi frame art (corners + edges from the PNG, centre filled by its own gradient). */
		border-style: solid;
		border-color: transparent;
		border-width: clamp(20px, 4cqmin, 52px);
		border-image-source: var(--panel-img);
		border-image-slice: 96 fill;
		border-image-repeat: stretch;
		filter: drop-shadow(0 0 24px rgba(56, 120, 220, 0.35));
		display: flex;
		flex-direction: column;
	}

	/* Pinned to the screen's top-right corner (positioned against the full-viewport overlay). */
	.info-close {
		position: absolute;
		top: clamp(8px, 2cqmin, 26px);
		right: clamp(8px, 2cqmin, 26px);
		width: clamp(34px, 5.6cqmin, 52px);
		height: clamp(34px, 5.6cqmin, 52px);
		border-radius: 50%;
		border: 1.5px solid rgba(96, 165, 250, 0.8);
		background: radial-gradient(circle at 50% 35%, #143059, #0a1830);
		color: #cfe4ff;
		display: grid;
		place-items: center;
		cursor: pointer;
		pointer-events: auto;
		z-index: 62;
		transition: filter 0.12s ease;
	}
	.info-close:hover {
		filter: brightness(1.2);
	}
	.info-close svg {
		/* Absolute-centred so the square %-sizing is reliable. A grid/flex %-sized SVG collapsed
		   non-square (its width shrank to a few px on the small landscape button), making the X tiny. */
		position: absolute;
		inset: 0;
		margin: auto;
		width: 78%;
		height: 78%;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.4;
		stroke-linecap: round;
	}

	/* Transparent at normal sizes — its children (body + pager) act as the panel's flex items. On small
	   landscape it turns into a fixed-size, transform-scaled canvas (see the small-landscape query). */
	.info-stage {
		display: contents;
	}

	.info-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: clamp(12px, 2.6cqmin, 30px);
	}

	/* ── Overview page ── */
	.ov {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: clamp(16px, 3cqmin, 40px);
		align-items: center;
	}
	.ov-left {
		/* Fill the grid cell and clip: long overview copy (e.g. German/Russian) must never overflow
		   downward onto the stat boxes. Content is top-aligned, so the title/paragraphs stay visible
		   and only the trailing (redundant) max-win line is ever affected. */
		align-self: stretch;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: clamp(8px, 1.7cqmin, 20px);
	}
	.ov-title {
		margin: 0;
		font-family: 'Cinzel', serif;
		font-size: clamp(24px, 5.4cqmin, 52px);
		font-weight: 900;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		overflow-wrap: break-word;
		word-break: break-word;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.ov-text {
		margin: 0;
		font-size: clamp(11px, 1.95cqmin, 18px);
		line-height: 1.42;
		color: #d7e6f7;
	}
	.ov-maxwin {
		margin: clamp(2px, 0.6cqmin, 8px) 0 0;
		font-size: clamp(11px, 2.0cqmin, 18px);
		color: #d7e6f7;
	}
	.ov-maxwin span {
		font-size: clamp(16px, 3.4cqmin, 32px);
		font-weight: 800;
		color: #fff;
		letter-spacing: 0.01em;
	}

	.ov-right {
		position: relative;
		height: 100%;
		min-height: clamp(180px, 40cqmin, 380px);
	}
	.ov-logo {
		position: absolute;
		/* Tucked into the very top-right corner and a touch smaller so it clears the hero art below. */
		top: clamp(-14px, -2cqmin, -4px);
		right: clamp(-8px, -1cqmin, 0px);
		width: clamp(96px, 21cqmin, 190px);
		height: auto;
		z-index: 2;
	}
	.ov-hero {
		position: absolute;
		/* Nudged down and slightly left so the ring sits clear of the top-right logo. */
		left: 47%;
		top: 60%;
		transform: translate(-50%, -50%);
		width: min(104%, clamp(260px, 55cqmin, 540px));
		display: grid;
		place-items: center;
	}
	.ov-hero-glow {
		position: absolute;
		left: 50%;
		top: 52%;
		width: 66%;
		height: 66%;
		transform: translate(-50%, -50%);
		background: radial-gradient(circle, rgba(70, 150, 255, 0.5) 0%, rgba(40, 90, 200, 0.18) 45%, transparent 70%);
		filter: blur(3px);
	}
	.ov-hero-img {
		position: relative;
		width: 100%;
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5));
	}

	/* ── Stat boxes ── */
	.ov-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		/* Tight but always-positive gap → boxes read as one row yet never touch. */
		gap: clamp(2px, 0.6cqmin, 7px);
		/* Break the row out into the panel's side padding (and a touch into the frame) so each box is
		   as long as possible — the panel is now narrower, so reclaim that width. */
		margin-inline: clamp(-36px, -4.4cqmin, -8px);
	}
	.stat {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(4px, 1cqmin, 11px);
		/* Elongated (matches the horizontal value-box art) so the icon + text fit on one line. */
		min-height: clamp(62px, 14.4cqmin, 138px);
		padding: clamp(8px, 1.9cqmin, 20px) clamp(6px, 1.5cqmin, 15px);
		/* Real sci-fi value box art behind each stat (value_box_mobile.png). */
		background-image: var(--box-img);
		background-size: 100% 100%;
		background-repeat: no-repeat;
	}
	.stat-ic {
		flex: 0 0 auto;
		width: clamp(32px, 7.4cqmin, 74px);
		height: clamp(32px, 7.4cqmin, 74px);
		display: grid;
		place-items: center;
		color: #8ec7ff;
	}
	.stat-ic img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.45));
	}
	.stat-txt {
		display: flex;
		flex-direction: column;
		line-height: 1.05;
		min-width: 0;
		white-space: nowrap;
	}
	/* Same treatment as the page titles: Cinzel + cyan→blue gradient. */
	.stat-txt b,
	.stat-txt i {
		font-family: 'Cinzel', serif;
		text-transform: uppercase;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.stat-txt b {
		font-size: clamp(13px, 3.1cqmin, 30px);
		font-weight: 900;
		letter-spacing: 0.01em;
	}
	.stat-txt i {
		font-style: normal;
		font-size: clamp(9px, 1.8cqmin, 16px);
		font-weight: 700;
		letter-spacing: 0.05em;
	}
	/* The CLUSTER box's value word is longer, so keep it clearly smaller than the other boxes. */
	.stat--sm .stat-txt b {
		font-size: clamp(11px, 2.5cqmin, 23px);
	}
	.stat--sm .stat-txt i {
		font-size: clamp(9px, 1.9cqmin, 16px);
	}
	/* The first box ("7X7 / REELS") has the shortest value, so scale it up and track it out
	   so the text fills the box like the longer-labelled ones. */
	.ov-stats .stat:first-child .stat-txt b {
		font-size: clamp(14px, 3.5cqmin, 36px);
		letter-spacing: 0.04em;
	}
	.ov-stats .stat:first-child .stat-txt i {
		font-size: clamp(9px, 2.2cqmin, 18px);
		letter-spacing: 0.16em;
	}

	/* ── Shared page scaffold (pages 2–6) ── */
	.page {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 2.2cqmin, 26px);
	}
	.page-title {
		margin: 0;
		text-align: center;
		font-family: 'Cinzel', serif;
		font-size: clamp(22px, 4.8cqmin, 46px);
		font-weight: 900;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		/* Long single-word titles in other languages (e.g. German "BEDIENUNGSANLEITUNG") must break to a
		   new line instead of clipping past the panel edge. */
		overflow-wrap: break-word;
		word-break: break-word;
		max-width: 100%;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	/* Shared sci-fi card shell + inner text. */
	.card {
		background: linear-gradient(160deg, rgba(20, 46, 92, 0.45), rgba(9, 20, 42, 0.5));
		border: 1.5px solid rgba(96, 165, 250, 0.5);
		border-radius: clamp(8px, 1.6cqmin, 16px);
		box-shadow: inset 0 0 20px rgba(40, 90, 170, 0.18);
	}
	.feat-h {
		margin: 0;
		font-size: clamp(14px, 3cqmin, 28px);
		font-weight: 800;
		line-height: 1.12;
		letter-spacing: 0.01em;
		color: #4ea6f0;
	}
	/* Page 3 (Features) headings use the cyan→blue title gradient. */
	.feat-grid .feat-h {
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.feat-p {
		margin: 0;
		font-size: clamp(11px, 2.1cqmin, 19px);
		line-height: 1.45;
		color: #dfeaf8;
	}

	/* ── Page 2: Paytable ── */
	.pt {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr clamp(150px, 24cqmin, 260px);
		gap: clamp(10px, 2.2cqmin, 26px);
		align-items: stretch;
	}
	.pt-table-wrap {
		min-width: 0;
		display: flex;
	}
	.pt-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: clamp(2px, 0.5cqmin, 5px);
		table-layout: fixed;
		font-size: clamp(7px, 1.55cqmin, 15px);
	}
	.pt-table th,
	.pt-table td {
		text-align: center;
		vertical-align: middle;
		border-radius: clamp(3px, 0.7cqmin, 7px);
		padding: clamp(1px, 0.5cqmin, 5px) 0;
		color: #dfeaf8;
		background: rgba(12, 28, 56, 0.55);
		border: 1px solid rgba(96, 165, 250, 0.28);
	}
	.pt-table thead th {
		color: #7dc0ff;
		font-weight: 700;
		background: rgba(18, 44, 88, 0.7);
	}
	.pt-table th.pt-rank {
		font-size: 0.82em;
		line-height: 1.05;
		color: #9fd0ff;
	}
	.pt-table td.pt-sym {
		padding: clamp(1px, 0.4cqmin, 4px);
	}
	.pt-table td.pt-sym img {
		display: block;
		width: 100%;
		max-height: clamp(20px, 4.6cqmin, 44px);
		object-fit: contain;
		margin: 0 auto;
	}
	.pt-side {
		padding: clamp(10px, 2cqmin, 22px) clamp(10px, 2cqmin, 20px);
		display: flex;
		flex-direction: column;
		gap: clamp(4px, 1cqmin, 10px);
		text-align: center;
	}
	.pt-side-title {
		margin: 0 0 clamp(2px, 0.8cqmin, 8px);
		font-size: clamp(13px, 2.5cqmin, 23px);
		font-weight: 800;
		color: #6fb6f6;
		line-height: 1.12;
	}
	.pt-side-h {
		margin: clamp(2px, 0.8cqmin, 8px) 0 0;
		font-size: clamp(10px, 1.85cqmin, 16px);
		font-weight: 700;
		color: #eaf3ff;
		line-height: 1.25;
	}
	.pt-side-v {
		margin: 0;
		font-size: clamp(10px, 1.85cqmin, 16px);
		color: #c3d6ee;
	}

	/* ── Page 3: Features ── */
	.feat-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: clamp(10px, 2cqmin, 22px);
	}
	.feat-col-small {
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 2cqmin, 22px);
		min-height: 0;
	}
	/* The two stacked cards split the column into two exactly-equal halves (min-height:0 removes the
	   content floor). Their spacing + icon are sized so the content fits inside each half. */
	.feat-grid .feat-col-small .feat-card {
		flex: 1 1 0;
		min-height: 0;
		gap: clamp(3px, 0.9cqmin, 9px);
		padding: clamp(8px, 1.8cqmin, 16px);
	}
	.feat-grid .feat-col-small .feat-ic {
		width: clamp(50px, 13cqmin, 100px);
		margin: 0;
	}
	.feat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: clamp(10px, 2.2cqmin, 24px);
		gap: clamp(6px, 1.4cqmin, 14px);
	}
	.feat-ic {
		width: clamp(52px, 11cqmin, 108px);
		height: auto;
		object-fit: contain;
		margin-top: auto;
	}
	.feat-trigger {
		margin-top: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(5px, 1.3cqmin, 13px);
	}
	.feat-x {
		font-size: clamp(22px, 4.8cqmin, 46px);
		font-weight: 800;
		color: #fff;
	}
	.feat-trigger img {
		width: clamp(44px, 9cqmin, 88px);
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45));
	}
	/* Page 3 (Features): larger symbols than the Feature Buy page. The whole block (heading + body +
	   image) is centred vertically in the card as one group. */
	.feat-grid .feat-card {
		justify-content: center;
		gap: clamp(10px, 2.4cqmin, 26px);
	}
	.feat-grid .feat-ic {
		width: clamp(84px, 17.5cqmin, 176px);
		margin: 0;
	}
	.feat-grid .feat-trigger {
		margin: 0;
	}
	.feat-grid .feat-trigger img {
		width: clamp(72px, 14.5cqmin, 146px);
	}
	.feat-grid .feat-x {
		font-size: clamp(30px, 6.6cqmin, 66px);
	}

	/* ── Page 4: Cluster win ── */
	.cw {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1.15fr;
		gap: clamp(14px, 3cqmin, 40px);
		align-items: center;
	}
	.cw-text {
		display: flex;
		flex-direction: column;
		gap: clamp(8px, 1.8cqmin, 18px);
	}
	.cw-text p {
		margin: 0;
		font-size: clamp(11px, 2cqmin, 18px);
		line-height: 1.4;
		color: #d7e6f7;
	}
	/* Finished WIN / NO WIN grid art (label baked in) — side by side, matched height. */
	.cw-grids {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 2cqmin, 26px);
	}
	.cw-img {
		max-height: clamp(170px, 46cqmin, 330px);
		max-width: 49%;
		height: auto;
		display: block;
		filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.4));
	}

	/* ── Page 5: Feature buy ── */
	.fb-sub {
		margin: 0;
		text-align: center;
		font-size: clamp(10px, 1.7cqmin, 15px);
		line-height: 1.35;
		color: #cddcf0;
	}
	.fb-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: clamp(8px, 1.7cqmin, 20px);
	}
	.fb-grid .feat-card {
		gap: clamp(4px, 1.1cqmin, 11px);
		/* Longer translations must not push the card content past the pager. */
		overflow: hidden;
	}
	/* Page 5 (Feature Buy): a touch larger than the base cards, but compact enough for long languages. */
	.fb-grid .feat-h {
		font-size: clamp(15px, 3cqmin, 28px);
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.fb-grid .feat-p {
		font-size: clamp(11px, 2.1cqmin, 18px);
	}
	.fb-grid .feat-ic {
		width: clamp(54px, 10.5cqmin, 104px);
	}
	.fb-grid .feat-trigger img {
		width: clamp(48px, 9cqmin, 90px);
	}
	.fb-grid .feat-x {
		font-size: clamp(22px, 4.6cqmin, 46px);
	}
	.fb-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.12;
	}
	.fb-meta:first-of-type {
		margin-top: auto;
	}
	.fb-k {
		font-size: clamp(10px, 1.8cqmin, 16px);
		font-weight: 700;
		letter-spacing: 0.08em;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.fb-v {
		font-size: clamp(12px, 2.4cqmin, 21px);
		font-weight: 800;
		color: #eaf3ff;
	}

	/* ── Page 6: General info ── */
	.gi-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1.55fr;
		gap: clamp(12px, 2.6cqmin, 30px);
	}
	.gi-card {
		/* Long legal copy (e.g. Russian, 3 paragraphs) must stay inside the card and never spill onto
		   the pager below — clip as a safety net; sizes below are tuned so it fits without clipping. */
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: clamp(10px, 2cqmin, 22px) clamp(12px, 2.6cqmin, 32px);
		gap: clamp(6px, 1.2cqmin, 12px);
	}
	.gi-ic {
		width: clamp(48px, 9.5cqmin, 96px);
		height: clamp(48px, 9.5cqmin, 96px);
		display: grid;
		place-items: center;
		color: #6fb6f6;
	}
	/* The scales-of-justice art reads better a little larger than the rotate arrow. */
	.gi-ic--legal {
		width: clamp(52px, 10.5cqmin, 106px);
		height: clamp(52px, 10.5cqmin, 106px);
	}
	.gi-ic img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.4));
	}
	/* Page 6 titles use the cyan→blue title gradient. */
	.gi-grid .feat-h {
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.gi-card .feat-p {
		font-size: clamp(9px, 1.6cqmin, 14px);
		line-height: 1.38;
	}

	/* Page 7: Controls — plain icon grid of the game's buttons (no card frame). Centred flex-wrap so it
	   reflows to fewer-per-row as width shrinks and any incomplete last row stays centred. */
	.ctrl-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		/* Always five per row (→ 5 + 4 for the nine controls); cells shrink to fit on smaller screens.
		   Left-aligned by nature — the incomplete last row fills columns from the left. Portrait → two. */
		grid-template-columns: repeat(5, minmax(0, 1fr));
		/* Row gap kept modest so the three rows (twelve controls) fit without crowding the title. */
		gap: clamp(5px, 1.5cqmin, 18px) clamp(4px, 1.2cqmin, 14px);
		align-content: center;
	}
	.ctrl {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: clamp(2px, 0.7cqmin, 8px);
		padding: clamp(2px, 0.7cqmin, 8px);
	}
	.ctrl-ic {
		width: clamp(36px, 7.8cqmin, 70px);
		height: clamp(36px, 7.8cqmin, 70px);
		object-fit: contain;
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45));
	}
	/* The 3D spin button reads a touch smaller than the flat round icons — nudge it up to match. */
	.ctrl-ic--lg {
		width: clamp(42px, 9cqmin, 80px);
		height: clamp(42px, 9cqmin, 80px);
	}
	.ctrl-name {
		/* Extra breathing room between the icon and its title (on top of the cell's base gap). */
		margin: clamp(4px, 1.1cqmin, 12px) 0 0;
		font-family: 'Cinzel', serif;
		font-weight: 900;
		text-transform: uppercase;
		font-size: clamp(11px, 2.3cqmin, 21px);
		letter-spacing: 0.02em;
		line-height: 1.1;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.ctrl-desc {
		margin: 0;
		font-size: clamp(8px, 1.6cqmin, 14px);
		line-height: 1.3;
		color: #dfeaf8;
	}

	/* ── Pager ── */
	.info-pager {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(10px, 2cqmin, 20px);
		padding-top: clamp(8px, 1.6cqmin, 18px);
	}
	/* The whole button is the real arrow-button art (circle + arrow, cyan→blue ring). */
	.pg-arrow {
		width: clamp(38px, 6.6cqmin, 58px);
		height: clamp(38px, 6.6cqmin, 58px);
		border: none;
		background: none;
		padding: 0;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.pg-arrow:hover:not(:disabled) {
		filter: brightness(1.15);
	}
	.pg-arrow:disabled {
		cursor: default;
	}
	.pg-ic {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.pg-num {
		position: absolute;
		right: clamp(0px, 1cqmin, 8px);
		font-size: clamp(11px, 1.9cqmin, 17px);
		color: #cfe0f5;
		letter-spacing: 0.03em;
	}

	/* Small landscape (short viewports, e.g. landscape phones ~490px tall and down): the fluid content
	   hits its px floors and overflows (cards collide with the pager). Instead, lay it out at a fixed
	   design size and uniformly scale it to fit — the whole popup zooms down as one unit, keeping the
	   good large-screen proportions. (Base layout stays clean from ~500px tall up.) */
	@container (aspect-ratio >= 0.95) and (max-height: 490px) {
		.info-panel {
			/* Establish a container so the stage can measure the panel's content box (100cqw/100cqh). */
			container-type: size;
			overflow: hidden;
			/* Thinner frame + tighter inset so the scaled canvas gets as much room as possible. */
			border-width: clamp(8px, 2.6cqmin, 40px);
			padding: clamp(4px, 1.4cqmin, 20px) clamp(6px, 1.8cqmin, 24px);
		}
		/* The close button sits outside the (scaled-down) panel, so shrink it to match the small screen. */
		.info-close {
			width: clamp(22px, 4.4cqmin, 34px);
			height: clamp(22px, 4.4cqmin, 34px);
			top: clamp(6px, 1.6cqmin, 16px);
			right: clamp(6px, 1.6cqmin, 16px);
		}
		.info-stage {
			display: flex;
			flex-direction: column;
			position: absolute;
			left: 50%;
			top: 50%;
			/* Fixed design canvas (aspect ~1.8 ≈ the panel's content box in landscape). Content inside is
			   sized against THIS box (container-type below), so it is pixel-stable regardless of viewport. */
			width: 850px;
			height: 472px;
			container-type: size;
			/* Centre the (oversized) canvas on the panel, then uniformly scale it to fit. Denominators carry
			   px so each ratio is unitless (length / length) for scale(). */
			transform: translate(-50%, -50%) scale(min(100cqw / 850px, 100cqh / 472px));
			transform-origin: center;
		}
	}

	/* Portrait / narrow containers: everything collapses to a single column and the body scrolls when the
	   content is taller than the panel. */
	@container (aspect-ratio < 0.95) {
		.info-panel {
			width: min(540px, 94cqw);
			height: min(880px, 92cqh);
		}
		/* The body is the scroll viewport; the pager stays pinned below it. */
		.info-body {
			overflow-y: auto;
			overflow-x: hidden;
			/* Room so content never sits under the scrollbar. */
			padding-right: clamp(2px, 1cqmin, 8px);
		}
		/* Let each section take its natural height (so it overflows → scrolls) instead of shrinking to fit,
		   and flow top-down (no vertical centring — scrolling handles overflow). */
		.ov,
		.page,
		.pt,
		.feat-grid,
		.feat-col-small,
		.cw,
		.fb-grid,
		.ctrl-grid,
		.gi-grid {
			flex: 0 0 auto;
			min-height: auto;
			align-content: start;
		}

		/* ── Overview ── */
		.ov {
			grid-template-columns: 1fr;
			gap: clamp(8px, 2cqh, 18px);
		}
		.ov-title {
			font-size: clamp(24px, 6.4cqmin, 40px);
		}
		.ov-text {
			font-size: clamp(13px, 3.4cqmin, 18px);
		}
		.ov-maxwin span {
			font-size: clamp(18px, 4.6cqmin, 30px);
		}
		.ov-right {
			min-height: clamp(170px, 38cqh, 340px);
		}
		.ov-logo {
			width: clamp(104px, 34cqmin, 200px);
		}
		/* Stat boxes stack into one column (each a full-width horizontal box). */
		.ov-stats {
			grid-template-columns: 1fr;
			margin-inline: 0;
			gap: clamp(6px, 1.4cqh, 12px);
		}
		.stat {
			flex-direction: row;
			justify-content: center;
			gap: clamp(8px, 2.4cqmin, 18px);
		}
		.stat-txt {
			align-items: flex-start;
		}
		.stat-txt b {
			font-size: clamp(13px, 4.0cqmin, 22px);
		}
		.stat-txt i {
			font-size: clamp(9px, 2.3cqmin, 15px);
		}

		/* ── Pages 2–6: one column each ── */
		.pt {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			gap: clamp(12px, 3cqh, 24px);
		}
		.pt-side {
			order: 2;
			align-self: stretch;
		}
		/* "SYMBOL RANK" is wide for a 1/13 column in portrait — shrink it so it clears the "5" header. */
		.pt-table th.pt-rank {
			font-size: 0.6em;
		}
		.feat-grid {
			grid-template-columns: 1fr;
		}
		/* Stack the two small feature cards vertically (full single column). Cancel the equal-height
		   flex (flex:1 1 0 / min-height:0) that collapses them to nothing in a natural-height column. */
		.feat-col-small {
			flex-direction: column;
		}
		.feat-grid .feat-col-small .feat-card {
			flex: 0 0 auto;
			min-height: auto;
		}
		/* Stack the three buy cards vertically. */
		.fb-grid {
			grid-template-columns: 1fr;
		}
		.cw {
			grid-template-columns: 1fr;
			gap: clamp(14px, 3.5cqh, 34px);
		}
		/* Stack the WIN / NO WIN art too, each large. */
		.cw-grids {
			flex-direction: column;
			gap: clamp(12px, 3cqh, 26px);
		}
		.cw-img {
			max-height: clamp(200px, 42cqh, 320px);
			max-width: 82%;
		}
		/* Controls: two per row in portrait (five is only for wide/landscape screens). */
		.ctrl-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.gi-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

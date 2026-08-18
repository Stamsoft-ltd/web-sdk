<script lang="ts" module>
	// Game description / rules popup — Magnetic Megachain. Multi-page (arrows below). All copy is
	// localized via the i18n keys ('INFO …'); numeric values stay as constants here.
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	// Finished art (designer exports): overview hero composite, popup frame, reels-grid box element,
	// and the sci-fi value box used behind the small stat cards.
	const panelImg = ap('/assets/components/ui/info_panel_v2.webp?v=20260810');
	// Overview hero (Figma 7109:5399, added 2026-08-10): symbol-prop composite, top-right.
	// ?v=20260812: re-exported from Figma 7194:11187 after the L3 and H2 symbols were replaced —
	// the previous composite still showed the purple coil and the chain link, which no longer exist
	// anywhere else in the game.
	const heroImg = ap('/assets/components/ui/info_hero_v2.webp?v=20260812');
	// Version2 card shells, shared with the buy-bonus screen: the near-square steel card and the
	// compact bet plate (behind the overview stats), plus the tall card cut for this carousel.
	const cardV2 = ap('/assets/components/ui/bb_card_panel_v2.webp?v=20260810');
	const cardTallV2 = ap('/assets/components/ui/info_card_tall_v2.webp?v=20260810');
	const boxGrid = ap('/assets/components/ui/info_box_grid.webp');
	const icCluster = ap('/assets/components/ui/info_ic_cluster.webp');
	const icTrophy = ap('/assets/components/ui/info_ic_trophy.webp');
	const icRtp = ap('/assets/components/ui/info_ic_rtp.webp');
	const valueBox = ap('/assets/components/ui/bb_bet_panel_v2.webp?v=20260810');

	// ── Paytable (page 2) — symbol art in rank order (highest → lowest) with the pay bands from
	// config.ts (H1→L4). Column headers are the connected-cluster sizes. ──
	const sym = (p: string) => ap(`/assets/components/symbols/magnetic/${p}`);
	const PAY_COLS = ['5', '6', '7', '8', '9', '10+', '12+', '15+', '20+', '25+', '30+', '33+'];
	// `fit` compensates the TRANSPARENT PADDING baked into each symbol PNG: the art occupies only
	// 38-55% of its 328x264 box, so a plain width:100% render leaves the symbol looking half-size in
	// the paytable cell. Each factor is measured from the art's alpha bounding box (targeting ~100%
	// 90% of the image box on the art's tighter axis), not hand-picked. 90% rather than 100%:
	// the live cell is tighter than the image box, so filling it completely overflowed the rounded
	// rect on the taller symbols. All eight are centred to within 3% of the box, so scaling about the
	// centre does not shift them. Re-measure if the symbol art is re-exported.
	const payRows = [
		{ img: sym('premium/horseshoe.webp'), fit: 1.11, v: ['0.5x', '1x', '2x', '4x', '8x', '15x', '30x', '75x', '200x', '500x', '1000x', '2000x'] },
		// Lightning (H2) carries the most padding in the set — the Version2 export places a 210px
		// badge on the same 328x264 canvas where every other symbol fills ~250px — so its fit is the
		// highest here, matching the SYMBOL_SIZE_OVERRIDE nudge that puts it at parity on the board.
		{ img: sym('premium/lightning.webp'), fit: 1.32, v: ['0.4x', '0.8x', '1.5x', '3x', '6x', '12x', '25x', '60x', '150x', '350x', '750x', '1500x'] },
		{ img: sym('premium/magnetic_core_cube.webp'), fit: 1.1, v: ['0.3x', '0.6x', '1.2x', '2.5x', '5x', '10x', '20x', '45x', '120x', '275x', '600x', '1200x'] },
		{ img: sym('premium/electromagnetic_device.webp'), fit: 1.15, v: ['0.2x', '0.5x', '1x', '2x', '4x', '8x', '15x', '35x', '90x', '200x', '450x', '900x'] },
		{ img: sym('low/bolt.webp'), fit: 1.33, v: ['0.15x', '0.3x', '0.6x', '1.2x', '2.5x', '5x', '10x', '25x', '60x', '125x', '250x', '500x'] },
		{ img: sym('low/nut.webp'), fit: 1.15, v: ['0.12x', '0.25x', '0.5x', '1x', '2x', '4x', '8x', '20x', '50x', '100x', '200x', '400x'] },
		// Coil (L3): like the lightning, the Version2 export sits smaller on the shared canvas (241px
		// wide against the old art's 293), so its fit is raised to keep the row consistent.
		{ img: sym('low/coil.webp'), fit: 1.45, v: ['0.1x', '0.2x', '0.4x', '0.8x', '1.6x', '3x', '6x', '15x', '40x', '80x', '150x', '300x'] },
		{ img: sym('low/energy_screw.webp'), fit: 1.19, v: ['0.08x', '0.1x', '0.3x', '0.6x', '1.2x', '2.5x', '5x', '12x', '30x', '60x', '120x', '250x'] },
	];
	const wild = sym('special/wild.webp');
	const wildX10 = sym('special/wild_x10.webp');
	const scatter = sym('special/scatter.webp');

	// Cluster-win illustration (page 4): finished WIN / NO WIN grid art (label baked in).
	const winImg = ap('/assets/components/ui/info_win.webp');
	const noWinImg = ap('/assets/components/ui/info_nowin.webp');
	// General-info icons (page 6).
	const icRotate = ap('/assets/components/ui/info_ic_charge_arrow.webp');
	const icLegal = ap('/assets/components/ui/info_ic_legal.webp');

	// Game controls (page 7) — the finished round-button icon set (designer export), in file order.
	// name/desc are i18n keys, translated reactively in the template.
	const controls = [
		{ img: ap('/assets/components/navbar/btn_spin.webp'), nameKey: 'INFO CTRL SPIN', descKey: 'INFO CTRL SPIN DESC', big: true },
		{ img: ap('/assets/components/ui/ctrl_auto.svg'), nameKey: 'INFO CTRL AUTO', descKey: 'INFO CTRL AUTO DESC' },
		{ img: ap('/assets/components/navbar/icons/turbo3.webp'), nameKey: 'INFO CTRL TURBO', descKey: 'INFO CTRL TURBO DESC' },
		{ img: ap('/assets/components/ui/ctrl_plus.svg'), nameKey: 'INFO CTRL PLUS', descKey: 'INFO CTRL PLUS DESC' },
		{ img: ap('/assets/components/ui/ctrl_minus.svg'), nameKey: 'INFO CTRL MINUS', descKey: 'INFO CTRL MINUS DESC' },
		{ img: ap('/assets/components/ui/ctrl_info.svg'), nameKey: 'INFO CTRL INFO', descKey: 'INFO CTRL INFO DESC' },
		{ img: ap('/assets/components/ui/ctrl_sound.svg'), nameKey: 'INFO CTRL SOUND', descKey: 'INFO CTRL SOUND DESC' },
		{ img: ap('/assets/components/ui/ctrl_arrow_left.svg'), nameKey: 'INFO CTRL PREV', descKey: 'INFO CTRL PREV DESC' },
		{ img: ap('/assets/components/ui/ctrl_arrow_right.svg'), nameKey: 'INFO CTRL NEXT', descKey: 'INFO CTRL NEXT DESC' },
		{ img: ap('/assets/components/ui/ctrl_close.svg'), nameKey: 'INFO CTRL CLOSE', descKey: 'INFO CTRL CLOSE DESC' },
		{ img: ap('/assets/components/ui/ctrl_menu.svg'), nameKey: 'INFO CTRL MENU', descKey: 'INFO CTRL MENU DESC' },
		{ img: ap('/assets/components/ui/ctrl_music.svg'), nameKey: 'INFO CTRL MUSIC', descKey: 'INFO CTRL MUSIC DESC' },
	];

	// Every image this modal renders, for LoadingController's HTML-image pass. Built from the consts
	// above so a path or ?v= edit can never desync the preload list.
	export const INFO_MODAL_IMAGES = [
		panelImg,
		heroImg,
		cardV2,
		cardTallV2,
		boxGrid,
		icCluster,
		icTrophy,
		icRtp,
		valueBox,
		...payRows.map((r) => r.img),
		wild,
		wildX10,
		scatter,
		winImg,
		noWinImg,
		icRotate,
		icLegal,
		...controls.map((c) => c.img),
	];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateConfig, stateUrlDerived } from 'state-shared';

	import { i18nDerived } from '../i18n/i18nDerived';

	// Shorthand: reactive translate + interpolating translate (re-runs on locale change).
	const t = (key: string) => i18nDerived.translate(key);

	// Feature-buy cost value. Normally "50x BET"; in social the COST label is already "PLAY AMOUNT"
	// and BET translates to "PLAY", which stacked up as "PLAY AMOUNT / 50x PLAY" — so drop the unit
	// there and let the label carry it. Same flag SocialI18nSync switches the message map on.
	const isSocial = $derived(stateConfig.jurisdiction.socialCasino || stateUrlDerived.social());
	const cost = (multiplier: string) => (isSocial ? multiplier : `${multiplier} ${t('BET')}`);

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

<div class="info-overlay" style={`--panel-img:url(${panelImg});--card-img:url(${cardV2});--gi-box-sm:url(${cardTallV2});--gi-box-lg:url(${cardV2})`}>
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
						<img class="ov-hero" src={heroImg} alt="" />
					</div>

				</div>

				<div class="ov-stats" style={`--box-img:url(${valueBox})`}>
					<div class="stat">
						<span class="stat-ic" style="--ic:0.505"><img src={boxGrid} alt="" /></span>
						<span class="stat-txt"><b>7X7</b><i>{t('INFO STAT REELS')}</i></span>
					</div>
					<div class="stat stat--sm">
						<span class="stat-ic" style="--ic:0.626"><img src={icCluster} alt="" /></span>
						<span class="stat-txt"><b>{t('INFO STAT CLUSTER')}</b><i>{t('INFO STAT PAYS')}</i></span>
					</div>
					<div class="stat">
						<span class="stat-ic" style="--ic:0.473"><img src={icTrophy} alt="" /></span>
						<span class="stat-txt"><b>20,000</b><i>{t('INFO STAT MAXWIN')}</i></span>
					</div>
					<div class="stat">
						<span class="stat-ic" style="--ic:0.637"><img src={icRtp} alt="" /></span>
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
											<td class="pt-sym"><img src={row.img} alt="" style="--fit:{row.fit}" /></td>
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
							<div class="fb-meta"><span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('50x')}</span></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span></div>
						</div>
						<div class="card feat-card">
							<h3 class="feat-h">{t('INFO FB FEATURE TITLE')}</h3>
							<p class="feat-p">{t('INFO FB FEATURE TEXT')}</p>
							<div class="feat-trigger"><span class="feat-x">3x</span><img src={scatter} alt="Scatter" /></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('100x')}</span></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span></div>
						</div>
						<div class="card feat-card">
							<h3 class="feat-h">{t('INFO FB BONUS TITLE')}</h3>
							<p class="feat-p">{t('INFO FB BONUS TEXT')}</p>
							<div class="feat-trigger"><span class="feat-x">4x</span><img src={scatter} alt="Scatter" /></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('500x')}</span></div>
							<div class="fb-meta"><span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span></div>
						</div>
					</div>
				</div>
			{:else if page === 6}
				<div class="page">
					<h2 class="page-title">{t('INFO GENERAL INFO')}</h2>
					<div class="gi-grid">
						<div class="card gi-card">
							<div class="gi-head">
								<span class="gi-ic"><img src={icRotate} alt="" /></span>
								<h3 class="feat-h">{t('INFO GI INTERRUPTED TITLE')}</h3>
							</div>
							<div class="gi-body">
								<p class="feat-p">{t('INFO GI INTERRUPTED 1')}</p>
								<p class="feat-p">{t('INFO GI INTERRUPTED 2')}</p>
							</div>
						</div>
						<div class="card gi-card gi-wide">
							<div class="gi-head">
								<span class="gi-ic gi-ic--legal"><img src={icLegal} alt="" /></span>
								<h3 class="feat-h">{t('INFO GI LEGAL TITLE')}</h3>
							</div>
							<div class="gi-body">
								<!-- General Game Disclaimer — shown verbatim (see DISCLAIMER TEXT in the message
								     catalogue). Also conveys that payouts are settled from the Remote Game Server,
								     not from anything shown in the browser. -->
								<p class="feat-p feat-p--legal">{t('DISCLAIMER TEXT')}</p>
							</div>
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
				<span class="pg-glyph pg-glyph--left"></span>
			</button>
			<button class="pg-arrow" type="button" onclick={next} disabled={page === TOTAL} aria-label="Next">
				<span class="pg-glyph"></span>
			</button>
			<span class="pg-num">{t('INFO PAGE')} {page}/{TOTAL}</span>
		</div>
		</div>
	</div>

	<!-- Close button pinned to the screen's top-right corner (outside the panel). -->
	<button class="info-close" type="button" onclick={props.onclose} aria-label="Close">
		<span class="x-glyph"></span>
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
	/* Type: the whole rules carousel is Chakra Petch (Figma 4504:4289 OVERVIEW / 4448:6823 PAYTABLE).
	   It previously mixed four families carried over from the forest theme — Inter, Poppins, the
	   CINZEL serif on stat values and control names, and IBM Plex Sans Condensed.
	   WEIGHTS ARE CONSTRAINED: static/fonts/web self-hosts Chakra Petch 400/600/700 only, so the old
	   500/800/900 declarations were remapped to 600/700/700. Declaring a weight with no face just
	   gets the browser to synthesise one — a faux bold smeared over 700 — which is the same trap the
	   win-amount text hit with IBM Plex 900. Add the real face before reaching for another weight. */
	.info-overlay {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		pointer-events: none;
		container-type: size;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
	.info-panel {
		pointer-events: auto;
		position: relative;
		/* A touch narrower than the viewport so the screen-corner close button clears the panel. */
		width: min(1120px, 87cqw);
		height: min(660px, 90cqh);
		box-sizing: border-box;
		/* Content inset clears the frame's steel edge + the corner/mid-edge brackets. */
		padding: clamp(28px, 6cqmin, 62px) clamp(32px, 6.6cqmin, 72px);
		/* Version2 frame art (info_panel_v2, 977x599 design) stretched over the whole panel. A
		   border-image slice was tried first, but the corner brackets need a ~95px border to render
		   at design scale, which eats the interior — a plain stretch at the panel's near-design
		   aspect keeps them true. Padding (below) insets the content past the steel + brackets. */
		background: var(--panel-img) center / 100% 100% no-repeat;
		border: none;
		filter: drop-shadow(0 10px 26px rgba(0, 0, 0, 0.5));
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
		/* Version2 icon button: #22365B circle, 1px #2391C1, drawn white X. */
		border: 1px solid #2391c1;
		background: #22365b;
		border-radius: 50%;
		font-size: clamp(11px, 1.8cqmin, 17px);
		padding: 0;
		display: grid;
		place-items: center;
		cursor: pointer;
		pointer-events: auto;
		z-index: 62;
		transition: filter 0.12s ease;
	}
	.info-close:hover {
		filter: brightness(1.35);
	}
	/* Drawn glyphs (2.13px white strokes at design size), same pattern as the other modals. */
	.x-glyph {
		position: relative;
		display: block;
		width: 1.155em;
		height: 0.133em;
	}
	.x-glyph::before,
	.x-glyph::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 0.133em;
		background: #fff;
	}
	.x-glyph::before { transform: rotate(45deg); }
	.x-glyph::after { transform: rotate(-45deg); }

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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(24px, 5.1cqmin, 46px);
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		overflow-wrap: break-word;
		word-break: break-word;
		color: #2391c1;
	}
	/* Figma 4504:4325 — Poppins 500 / 13px / 0.39px tracking / #FFF. The body inherited Inter at
	   #d7e6f7 and the max-win number was 800 weight, neither of which matched the design.
	   Sizes stay container-relative rather than pinned to 13px/32px: 1.95cqmin and 4.8cqmin
	   evaluate to exactly those values at the 1200x670 design size and scale from there.
	   Tracking is expressed in em (0.39/13 and 0.96/32 both = 0.03em) so it tracks the size. */
	.ov-text {
		margin: 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		font-size: clamp(11px, 1.95cqmin, 18px);
		letter-spacing: 0.03em;
		line-height: 1.42;
		color: #fff;
	}
	.ov-maxwin {
		margin: clamp(2px, 0.6cqmin, 8px) 0 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		font-size: clamp(11px, 1.95cqmin, 18px);
		letter-spacing: 0.03em;
		color: #fff;
	}
	.ov-maxwin span {
		/* Was 3.4cqmin, which resolved to ~23px at design size against the spec's 32px. */
		font-size: clamp(16px, 4.8cqmin, 32px);
		font-weight: 600;
		color: #fff;
		/* 0.03em, not 0.01: the design spec is 0.96px at a 32px size. */
		letter-spacing: 0.03em;
		/* Breathing room so the big number isn't jammed against the surrounding words. */
		margin: 0 0.16em;
	}

	.ov-right {
		height: 100%;
		min-height: 0;
		display: grid;
		place-items: center;
	}
	.ov-hero {
		width: min(100%, clamp(220px, 56cqmin, 460px));
		height: auto;
		object-fit: contain;
		filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.45));
	}

	/* ── Stat boxes ── */
	.ov-stats {
		/* One source of truth for the box height so the icons can be expressed as a fraction of it
		   (Figma sizes each icon against the 90px-tall plate). Approximates the aspect-derived
		   height of a plate in the 79%-wide row below. */
		--stat-h: clamp(50px, 11.4cqmin, 96px);
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 1.4cqmin, 14px);
		/* Figma 4504:4326: the row is 820 of the 1041 frame (~79%), CENTRED — full-width plates
		   read far bigger than the design. */
		width: 100%;
		max-width: 79%;
		margin-inline: auto;
	}
	.stat {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(4px, 1cqmin, 11px);
		/* The plate art's own proportions (201x90) drive the height. */
		aspect-ratio: 201 / 90;
		min-height: 0;
		padding: clamp(6px, 1.4cqmin, 14px) clamp(6px, 1.5cqmin, 15px);
		background-image: var(--box-img);
		background-size: 100% 100%;
		background-repeat: no-repeat;
	}
	.stat-ic {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		color: #8ec7ff;
	}
	/* Height comes from --ic, each icon's own Figma height as a fraction of the 91px box art
	   (reels 46, cluster 57, max-win 43, RTP 58). The previous shared square forced all four to one
	   size AND letterboxed the non-square ones via object-fit, so cluster and RTP rendered ~20%
	   under spec. Width follows the asset's aspect. */
	.stat-ic img {
		height: calc(var(--stat-h) * var(--ic, 0.55));
		width: auto;
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
	/* Figma 4504:4330/4331 — CINZEL Black: value in flat #2391C1, label in white. */
	.stat-txt b,
	.stat-txt i {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		text-transform: uppercase;
	}
	.stat-txt b {
		font-size: clamp(12px, 2.7cqmin, 25px);
		font-weight: 700;
		letter-spacing: 0.03em;
		color: #2391c1;
	}
	.stat-txt i {
		font-style: normal;
		font-size: clamp(9px, 1.8cqmin, 16px);
		font-weight: 700;
		letter-spacing: 0.03em;
		color: #fff;
	}
	/* The CLUSTER box's value word is longer, so keep it clearly smaller than the other boxes. */
	.stat--sm .stat-txt b {
		font-size: clamp(10px, 2.2cqmin, 20px);
	}
	.stat--sm .stat-txt i {
		font-size: clamp(9px, 1.9cqmin, 16px);
	}
	/* The first box ("7X7 / REELS") has the shortest value, so scale it up and track it out
	   so the text fills the box like the longer-labelled ones. */
	.ov-stats .stat:first-child .stat-txt b {
		font-size: clamp(13px, 3cqmin, 29px);
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(22px, 4.6cqmin, 42px);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		/* Long single-word titles in other languages (e.g. German "BEDIENUNGSANLEITUNG") must break to a
		   new line instead of clipping past the panel edge. */
		overflow-wrap: break-word;
		word-break: break-word;
		max-width: 100%;
		color: #2391c1;
	}
	/* Shared Version2 card shell: the keyed steel panel art. Tall variants (features free-spins
	   cards, feature-buy cards) swap to the tall cut via --gi-box-sm below. */
	.card {
		background: var(--card-img) center / 100% 100% no-repeat;
		border: none;
		border-radius: 0;
		box-shadow: none;
	}
	.feat-grid .feat-card:not(.feat-col-small .feat-card),
	.fb-grid .feat-card {
		background: var(--gi-box-sm) center / 100% 100% no-repeat;
	}
	.feat-h {
		margin: 0;
		/* Match the page titles (.page-title / .ov-title) — without this the card titles inherit the
		   modal root's 'Inter' instead of the Magnetic display font. */
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(14px, 3cqmin, 28px);
		font-weight: 700;
		line-height: 1.12;
		letter-spacing: 0.01em;
		color: #2391c1;
	}
	.feat-p {
		margin: 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		font-size: clamp(11px, 2.1cqmin, 19px);
		letter-spacing: 0.03em;
		line-height: 1.45;
		color: #fff;
	}
	/* The legal-notice copy is one dense block — more line spacing so it reads less cramped than the
	   shorter feature paragraphs. */
	.feat-p--legal {
		line-height: 1.68;
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
		border-spacing: clamp(1px, 0.35cqmin, 3px);
		table-layout: fixed;
		font-size: clamp(7px, 1.55cqmin, 15px);
	}
	.pt-table th,
	.pt-table td {
		text-align: center;
		vertical-align: middle;
		border-radius: clamp(4px, 1.2cqmin, 8px);
		padding: clamp(1px, 0.5cqmin, 5px) 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		color: #fff;
		/* Figma "Symbols pad": navy gradient + #0B365C hairline. */
		background: linear-gradient(151deg, #031235 1.5%, #06234d 100%);
		border: 1px solid #0b365c;
	}
	.pt-table thead th {
		color: #e8f2ff;
		font-weight: 600;
	}
	.pt-table th.pt-rank {
		font-size: 0.82em;
		line-height: 1.05;
		color: #2391c1;
		text-transform: uppercase;
	}
	.pt-table td.pt-sym {
		/* No inset — the PNG's own transparent margin already supplies all the breathing room. */
		padding: 0;
	}
	.pt-table td.pt-sym img {
		display: block;
		width: 100%;
		/* The symbol image is what drives ROW HEIGHT, so this doubles as the table's height budget:
		   at 7cqmin/72px (the first pass at making the symbols legible) 9 rows overflowed the page
		   and ran into the pager arrows. 6.4cqmin/64px keeps them large but gives the arrows room.
		   Raising this again means re-checking that the table still clears the pager. */
		max-height: clamp(24px, 6.4cqmin, 64px);
		object-fit: contain;
		margin: 0 auto;
		/* Layout-neutral, so the row height is unaffected and only the transparent margin spills. */
		transform: scale(var(--fit, 1));
	}
	/* Figma 4570:3598. Colours sampled from the design render: the title is a CYAN GRADIENT
	   (#00E7F4 -> #0099D0), not the flat #6fb6f6 this used; and the heading and value lines are the
	   same light grey (#D7D7D7), where this had the values a dimmer, bluer tone than the headings.
	   The title was also condensed, which the design is not. */
	.pt-side {
		/* Figma 4570:3598 — flat #294E76 rounded box with a #0B365C hairline and an inner cyan
		   glow; overrides the shared .card art shell. */
		background: #294e76;
		border: 1px solid #0b365c;
		border-radius: clamp(6px, 1.4cqmin, 10px);
		box-shadow:
			inset 0 0 10px rgba(0, 140, 255, 0.32),
			0 8px 8px rgba(0, 0, 0, 0.35);
		padding: clamp(10px, 2cqmin, 22px) clamp(10px, 2cqmin, 20px);
		display: flex;
		flex-direction: column;
		justify-content: center; /* centre the copy vertically in the tall card, not stuck at the top */
		/* No gap: the Figma aside stacks its lines tight; spacing comes from each line's own
		   margins, and a flex gap on top of those opened the block up too far. */
		gap: 0;
		text-align: center;
		/* Inter (inherited), NOT Poppins: the design's letterforms have a double-storey 'a', which
		   Poppins does not — its 'a' is a single-storey geometric bowl. */
	}
	.pt-side-title {
		margin: 0;
		font-size: clamp(13px, 2.5cqmin, 23px);
		font-weight: 700;
		color: #2391c1;
		line-height: 1.2;
	}
	/* Block rhythm measured off the design: ~1.45em between a heading and its values, ~2.6em
	   between a value line and the next heading, ~3.7em under the title. Expressed in em so it
	   tracks the font size; the leading already supplies ~0.3em, hence the smaller margins. */
	.pt-side-h {
		margin: 2.3em 0 0;
		font-size: clamp(10px, 1.85cqmin, 16px);
		font-weight: 700;
		color: #d7d7d7;
		line-height: 1.3;
	}
	.pt-side-h:first-of-type {
		margin-top: 3.4em;
	}
	.pt-side-v {
		margin: 1.15em 0 0;
		font-size: clamp(10px, 1.85cqmin, 16px);
		font-weight: 400;
		color: #d7d7d7;
		line-height: 1.3;
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
		overflow: hidden;
		gap: clamp(3px, 0.9cqmin, 9px);
		padding: clamp(12px, 2.4cqmin, 22px) clamp(10px, 2cqmin, 18px) clamp(8px, 1.8cqmin, 16px);
	}
	.feat-grid .feat-col-small .feat-ic {
		width: clamp(44px, 9.5cqmin, 76px);
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
		font-weight: 700;
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		font-size: clamp(11px, 2cqmin, 18px);
		letter-spacing: 0.03em;
		line-height: 1.4;
		color: #fff;
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		font-size: clamp(10px, 1.7cqmin, 15px);
		letter-spacing: 0.03em;
		line-height: 1.35;
		color: #fff;
	}
	.fb-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		/* Figma 4453:7151: three 200px cards + two 34px gaps = 668 of the 965 inner panel, CENTRED.
		   Stretching the row edge to edge made each card ~50% wider than the design, which left the
		   copy floating in an over-wide box. The wider gap is part of the same proportion. */
		gap: clamp(8px, 3cqmin, 30px);
		max-width: 72%;
		margin-inline: auto;
		width: 100%;
	}
	.fb-grid .feat-card {
		/* Centre the whole group with even gaps (the base card spreads it with margin-top:auto, which
		   left a huge void in the middle and pushed the RTP off the bottom). Gaps kept tight so the
		   longest-copy card (Extra-Feature) still fits COST/RTP in longer locales (e.g. German). */
		justify-content: center;
		gap: clamp(3px, 0.8cqmin, 8px);
		overflow: hidden;
	}
	.fb-grid .feat-ic,
	.fb-grid .feat-trigger,
	.fb-grid .fb-meta:first-of-type {
		margin-top: 0;
	}
	/* Page 5 (Feature Buy): a bit larger than before, but the group must still fit (the card height is
	   fixed), so keep it modest and centred. */
	.fb-grid .feat-h {
		font-size: clamp(15px, 3cqmin, 29px);
		color: #2391c1;
	}
	.fb-grid .feat-p {
		/* Slightly smaller so the (now larger) icons fit the tight cards on desktop without clipping.
		   Sized so even the longest-copy locale (Russian Extra-Feature card) keeps COST/RTP inside the
		   card — the description is the only variable-height element here. */
		/* Figma is 14px in a 176px-wide text column; the cards are now that narrow too, so the same
		   size wraps the same way. Was 1.6cqmin (~11px), shrunk back when the cards were full-width. */
		font-size: clamp(9px, 2.05cqmin, 17px);
		line-height: 1.3;
		color: #d7d7d7;
	}
	.fb-grid .feat-ic {
		/* Desktop (base) W icon — the Extra-Feature card has the longest copy, so this is the largest that
		   fits without clipping COST/RTP on the tightest (16:9) desktop panels, even in the wordiest
		   locale (Russian). cqmin scales it. */
		width: clamp(54px, 10.3cqmin, 96px);
	}
	.fb-grid .feat-trigger img {
		/* Scatter cards have shorter copy → the scatter can be a bit bigger. */
		width: clamp(56px, 12.2cqmin, 116px);
	}
	.fb-grid .feat-x {
		font-size: clamp(24px, 5cqmin, 50px);
	}
	.fb-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.2;
	}
	/* Design (Figma 4453:7151) separates the two stat blocks by noticeably more than the label sits
	   from its own value — without it COST/50x BET/RTP/96.1% read as one four-line run. ~0.55em of the
	   stat font size, so it tracks the same cqmin scaling as .fb-k/.fb-v on every breakpoint. */
	.fb-meta + .fb-meta {
		margin-top: clamp(5px, 1.1cqmin, 10px);
	}
	.fb-meta:first-of-type {
		margin-top: auto;
	}
	/* Figma 4526:8950 — CINZEL small caps: label in flat #2391C1, value in white. */
	.fb-k {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(11px, 2cqmin, 18px);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #2391c1;
	}
	.fb-v {
		/* Same size as .fb-k — the design sets label and value in one size (both 16px-tall nodes),
		   with only colour separating them. */
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(11px, 2cqmin, 18px);
		font-weight: 700;
		color: #fff;
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
		/* Centre the whole icon+title+body block (balanced padding top/bottom). The two cards' icons land
		   on the SAME level because their bodies are given an equal min-height (see .gi-body below), so the
		   blocks are the same height and centre identically. */
		justify-content: center;
		text-align: center;
		/* Designer frame box as the card background (narrow one here, wide one for .gi-wide). Replaces
		   the default .card gradient/border; extra inset keeps the content off the frame's edge. */
		background: var(--gi-box-sm) center / 100% 100% no-repeat;
		border: none;
		box-shadow: none;
		border-radius: 0;
		padding: clamp(18px, 3.4cqmin, 40px) clamp(20px, 3.8cqmin, 44px);
		gap: clamp(6px, 1.2cqmin, 12px);
	}
	.gi-wide {
		background: var(--gi-box-lg) center / 100% 100% no-repeat;
	}
	/* The narrow (Interrupted Rounds) card's copy runs close to its frame edges — extra side padding
	   insets it so it has clear spacing like the wider Legal card. */
	.gi-card:not(.gi-wide) {
		padding-left: clamp(34px, 6.4cqmin, 66px);
		padding-right: clamp(34px, 6.4cqmin, 66px);
	}
	/* Icon + title header — a centred column on desktop (icon above title); becomes an inline row on
	   mobile (see the portrait query). */
	.gi-head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(4px, 1cqmin, 10px);
	}
	/* Both icons the SAME size so their centres (and titles) line up across the two cards. */
	.gi-ic {
		width: clamp(50px, 10cqmin, 100px);
		height: clamp(50px, 10cqmin, 100px);
		display: grid;
		place-items: center;
		color: #6fb6f6;
	}
	.gi-ic--legal {
		width: clamp(50px, 10cqmin, 100px);
		height: clamp(50px, 10cqmin, 100px);
	}
	.gi-ic img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.4));
	}
	/* Page 6 titles use the cyan→blue title gradient. */
	/* Figma 4214:3232 sets these card titles in CINZEL (a serif) — the base .feat-h is IBM Plex Sans
	   Condensed, so they were rendering in the wrong typeface entirely. Uppercase, and a cyan ramp
	   that bottoms out at #0088C7 rather than the much darker #0046a9 the other titles use (measured
	   off the design: line 1 #00E6F3, line 2 #0088C7). */
	.gi-grid .feat-h {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: #2391c1;
	}
	/* Body copy is POPPINS here (single-storey 'a' in the design), pure white, ~12px at design size —
	   1.6cqmin resolved to ~11px. Note this differs from the paytable aside, which the design sets
	   in Inter; the two pages genuinely use different faces. */
	/* Figma insets the copy ~60px each side of the card, so it wraps to a narrower measure and runs
	   taller — filling the card rather than sitting as a short wide slab. Percentage of .gi-body
	   (already inset by the card padding), so it stays proportional at every size. */
	.gi-card .feat-p {
		max-width: 80%;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		/* Figma spec: 10px / 0.3px tracking. The container is .info-overlay, so at the design's
		   1200x670 frame cqmin is 6.7px and 1.45cqmin resolves to ~9.8px; tracking is 0.3/10 = 0.03em
		   so it follows the size. line-height stays `normal` per the spec — Poppins' own metrics give
		   the ~15px line pitch the design renders at. */
		font-size: clamp(8px, 1.45cqmin, 13px);
		letter-spacing: 0.03em;
		line-height: normal;
		color: #fff;
	}
	/* Body copy centres itself within an EQUAL min-height across both cards (set in the @container), so the
	   icon+title blocks are the same height and centre to the same level while staying balanced. */
	.gi-body {
		/* Takes the card's remaining height (Figma auto-layout: flex 1 0 0 / align-self stretch) instead
		   of hugging its copy — otherwise the block sits under the title with a large void beneath it.
		   min-height stays as a floor for the portrait/landscape overrides that still set it. */
		flex: 1 0 0;
		align-self: stretch;
		min-height: clamp(84px, 18.3cqmin, 172px);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: clamp(8px, 1.6cqmin, 16px);
		width: 100%;
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
	/* The 3D spin button art (btn_spin.webp) is non-square with an outer metallic frame, so object-fit
	   :contain renders its visible disc smaller than the flat round icons. Keep the SAME layout box as the
	   others (so the row + labels stay aligned) and scale it up VISUALLY only, from its centre. */
	.ctrl-ic--lg {
		transform: scale(1.32);
	}
	.ctrl-name {
		/* Extra breathing room between the icon and its title (on top of the cell's base gap). */
		margin: clamp(4px, 1.1cqmin, 12px) 0 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		text-transform: uppercase;
		font-size: clamp(10px, 2.1cqmin, 19px);
		letter-spacing: 0.03em;
		line-height: 1.1;
		color: #2391c1;
	}
	.ctrl-desc {
		margin: 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 600;
		font-size: clamp(8px, 1.6cqmin, 14px);
		letter-spacing: 0.02em;
		line-height: 1.3;
		color: #fff;
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
	/* Version2 pager (design 4504:4320): dark circle, thin light ring, drawn white arrow. */
	.pg-arrow {
		width: clamp(38px, 6.6cqmin, 52px);
		height: clamp(38px, 6.6cqmin, 52px);
		border: 1.5px solid rgba(220, 235, 255, 0.85);
		border-radius: 50%;
		background: #101c38;
		padding: 0;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.pg-arrow:hover:not(:disabled) {
		filter: brightness(1.35);
	}
	.pg-arrow:disabled {
		cursor: default;
		opacity: 0.4;
	}
	/* Drawn arrow: shaft + chevron head, pointing right (mirrored for prev). */
	.pg-glyph {
		position: relative;
		display: block;
		width: 38%;
		height: 2px;
		border-radius: 2px;
		background: #fff;
	}
	.pg-glyph::after {
		content: '';
		position: absolute;
		right: 0;
		top: 50%;
		width: 34%;
		aspect-ratio: 1;
		border-top: 2px solid #fff;
		border-right: 2px solid #fff;
		border-top-right-radius: 2px;
		transform: translateY(-50%) rotate(45deg);
		transform-origin: center;
	}
	.pg-glyph--left {
		transform: rotate(180deg);
	}
	.pg-num {
		position: absolute;
		right: clamp(0px, 1cqmin, 8px);
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(11px, 1.9cqmin, 16px);
		color: #fff;
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
			/* Rounded cyan-glow border to match the mobile design (not the metallic corner-bracket frame). */
			background: linear-gradient(160deg, #17335c 0%, #12294d 60%, #0d203f 100%);
			border: clamp(2px, 0.6cqmin, 3px) solid rgba(74, 198, 255, 0.9);
			border-radius: clamp(12px, 3cqmin, 22px);
			box-shadow:
				0 0 16px rgba(0, 178, 255, 0.5),
				0 0 3px rgba(120, 220, 255, 0.9),
				inset 0 0 22px rgba(20, 90, 190, 0.22);
			filter: none;
			padding: clamp(8px, 2.2cqmin, 26px) clamp(10px, 2.6cqmin, 30px);
		}
		/* Page 1 stat plates: SHOWN (they were dropped here once, and the user asked for them back
		   on popout L/S) — compact so the page still fits the fixed canvas. */
		.ov-stats {
			--stat-h: 58px;
			max-width: 92%;
			gap: 8px;
		}
		.stat-txt b { font-size: 17px; }
		.stat-txt i { font-size: 10px; }
		.stat--sm .stat-txt b { font-size: 14px; }
		.ov-stats .stat:first-child .stat-txt b { font-size: 19px; }
		.ov-stats .stat:first-child .stat-txt i { font-size: 11px; }
		/* Pages 3 & 5: frame-box image as the card border (matches the design + the portrait cards). */
		.feat-card {
			background: var(--gi-box-lg) center / 100% 100% no-repeat;
			border: none;
			box-shadow: none;
			border-radius: 0;
		}

		/* ── Landscape readability boosts ── the fixed 850×472 canvas leaves the fluid content sitting near
		   its px floors, so enlarge each page's text/art (and rebalance spacing) per the design review. */
		/* Bigger section title on every landscape page (pages 2–7 use .page-title; page 1 uses .ov-title). */
		.page-title { font-size: 28px; }
		/* Page 1 — Overview: larger title, copy and hero ring. */
		.ov-left { gap: 10px; }
		.ov-title { font-size: 32px; }
		.ov-text { font-size: 14px; line-height: 1.45; }
		.ov-maxwin { font-size: 14px; }
		.ov-maxwin span { font-size: 24px; }

		/* Page 2 — Paytable: enlarge the right-hand Multiplier-Wild panel text. Widen the aside and keep the
		   sizes moderate so its content stays shorter than the table (else the grid row grows and clips). */
		.pt { grid-template-columns: 1fr 185px; }
		.pt-side { gap: 0; padding: 16px 14px; }
		.pt-side-title { font-size: 15px; }
		/* Equal sizes — the design does not step the values up over their headings. */
		.pt-side-h { font-size: 11px; }
		.pt-side-v { font-size: 11px; }

		/* Page 3 — Features: slightly larger text/art with roomier gaps. */
		.feat-grid { gap: 16px; }
		.feat-grid .feat-card { gap: 16px; padding: 16px; }
		.feat-grid .feat-col-small .feat-card { gap: 5px; padding: 12px 14px; }
		.feat-grid .feat-h { font-size: 16px; }
		.feat-grid .feat-p { font-size: 12px; }
		/* The Multiplier Wild card (small left column) has the most copy — a touch smaller so it sits easy. */
		.feat-grid .feat-col-small .feat-p { font-size: 11px; }
		.feat-grid .feat-ic { width: 96px; }
		.feat-grid .feat-col-small .feat-ic { width: 70px; }
		.feat-grid .feat-trigger img { width: 86px; }
		.feat-grid .feat-x { font-size: 32px; }

		/* Page 4 — Cluster win: much larger copy; stack the WIN / NO-WIN grids in a column. Extra left inset
		   on the copy; tighter gap between the stacked grids so each image can grow taller. */
		.cw { grid-template-columns: 1.05fr 1fr; }
		.cw-text { gap: 13px; padding-left: 24px; }
		.cw-text p { font-size: 14px; line-height: 1.45; }
		.cw-grids { flex-direction: column; gap: 8px; }
		.cw-img { max-width: 96%; max-height: 182px; }

		/* Page 5 — Feature buy: everything bigger (the cards have spare height). */
		.fb-sub { font-size: 12px; }
		/* Wider than the desktop row's 72%: the landscape canvas is only 850px across, so the same
		   percentage left the cards narrow enough to wrap the Extra-Feature copy an extra line. */
		.fb-grid { gap: 16px; max-width: 84%; }
		/* Spread each card's rows top-to-bottom (title → text → icon → COST → RTP) to fill the card height.
		   Padding/gap kept tight and the Extra-Feature wild icon modest so the longest card's RTP still fits. */
		.fb-grid .feat-card { gap: 8px; padding: 14px; justify-content: space-between; }
		.fb-grid .feat-h { font-size: 17px; }
		/* 1px under the other landscape body copy: at 15px the longest card (Extra Feature) wrapped to
		   five lines and pushed COST/RTP past the frame art's bottom edge in both popout sizes. */
		.fb-grid .feat-p { font-size: 12px; }
		/* Short landscape viewports (this @container fires ≤490px tall, e.g. mobile landscape): the panel is
		   only ~half height, so keep the icons modest or they clip the card's COST/RTP. */
		.fb-grid .feat-ic { width: 84px; }
		.fb-grid .feat-trigger img { width: 88px; }
		.fb-grid .feat-x { font-size: 27px; }
		.fb-k { font-size: 13px; }
		.fb-v { font-size: 13px; }

		/* Page 6 — General info: bigger icons, more card padding, larger gaps between stacked elements. */
		.gi-card { padding: 40px 46px; gap: 16px; }
		/* The narrow (Interrupted Rounds) card's copy sits closer to its frame edges — extra side padding
		   insets it to match the wider Legal card. */
		.gi-card:not(.gi-wide) { padding-left: 64px; padding-right: 64px; }
		.gi-head { gap: 12px; }
		/* Same size for both so the icon centres + titles line up exactly across the two cards. */
		.gi-ic { width: 80px; height: 80px; }
		.gi-ic--legal { width: 80px; height: 80px; }
		.gi-grid .feat-h { font-size: 19px; }
		.gi-card .feat-p { font-size: 12px; line-height: 1.42; }
		/* Equal body height across both cards → the icon+title blocks match, so the icons centre to the
		   same level. Sized (relative, so it scales with the modal) to the taller Legal card's 3-paragraph
		   copy so it never clips. */
		.gi-body { min-height: clamp(126px, 34cqmin, 168px); }

		/* Page 7 — UI guide: larger icons and labels. Anchor the grid to the TOP (start) so the taller
		   title can never overlap the first row; a small padding-top keeps a clean gap below the title. */
		.ctrl-grid { gap: 11px 12px; align-content: start; padding-top: 6px; }
		.ctrl { gap: 4px; padding: 3px; }
		.ctrl-ic { width: 47px; height: 47px; }
		.ctrl-ic--lg { width: 55px; height: 55px; }
		.ctrl-name { font-size: 15px; margin-top: 6px; }
		.ctrl-desc { font-size: 11.5px; }

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
			/* A touch shorter so the screen-corner close button sits ABOVE the panel, not over the cards. */
			height: min(820px, 84cqh);
			/* Mobile design: a clean rounded cyan-glow border instead of the metallic corner-bracket
			   frame (the frame art is a background now, so it must be overridden here too). */
			background: linear-gradient(160deg, #17335c 0%, #12294d 60%, #0d203f 100%);
			border: clamp(2px, 0.55cqmin, 3px) solid rgba(74, 198, 255, 0.9);
			border-radius: clamp(16px, 4cqmin, 26px);
			padding: clamp(18px, 4.4cqmin, 34px) clamp(16px, 4cqmin, 30px) clamp(60px, 12cqmin, 78px);
			box-shadow:
				0 0 18px rgba(0, 178, 255, 0.5),
				0 0 3px rgba(120, 220, 255, 0.9),
				inset 0 0 26px rgba(20, 90, 190, 0.25);
			filter: none;
		}
		/* Pager fixed to the panel bottom (design shows the arrows + page counter pinned, not scrolling
		   with the content). The panel reserves bottom padding above for it. */
		.info-pager {
			position: absolute;
			left: clamp(16px, 4cqmin, 30px);
			right: clamp(16px, 4cqmin, 30px);
			bottom: clamp(16px, 3.6cqmin, 26px);
			padding-top: 0;
			margin: 0;
		}
		.pg-num {
			right: 0;
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
		/* Mobile design: drop the logo and the metallic stat banner boxes for a cleaner page. */
		.ov-stats {
			display: none;
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
		/* Stack the three buy cards vertically — and drop the centred max-width, which only applies
		   to the three-across desktop row. */
		.fb-grid {
			grid-template-columns: 1fr;
			max-width: none;
		}
		.cw {
			grid-template-columns: 1fr;
			gap: clamp(14px, 3.5cqh, 34px);
		}
		/* WIN / NO WIN art side by side in one row. */
		.cw-grids {
			flex-direction: row;
			justify-content: center;
			align-items: flex-start;
			gap: clamp(8px, 2.2cqmin, 18px);
		}
		.cw-img {
			max-height: clamp(150px, 34cqh, 300px);
			max-width: 48%;
		}
		/* Page 7 (UI guide): single-column left-aligned list — icon on the left, name + description on
		   the right. */
		.ctrl-grid {
			grid-template-columns: 1fr;
			gap: clamp(12px, 2.8cqh, 22px);
		}
		.ctrl {
			display: grid;
			grid-template-columns: auto 1fr;
			grid-template-rows: auto auto;
			column-gap: clamp(12px, 3.4cqmin, 20px);
			row-gap: 2px;
			align-items: center;
			text-align: left;
		}
		.ctrl-ic {
			grid-column: 1;
			grid-row: 1 / 3;
			align-self: center;
			width: clamp(50px, 13cqmin, 68px);
		}
		.ctrl-ic--lg {
			width: clamp(54px, 14cqmin, 72px);
		}
		.ctrl-name {
			grid-column: 2;
			grid-row: 1;
			text-align: left;
			font-size: clamp(16px, 4.2cqmin, 25px);
		}
		.ctrl-desc {
			grid-column: 2;
			grid-row: 2;
			text-align: left;
			font-size: clamp(13px, 3.3cqmin, 19px);
		}

		/* Page 6 (general info): inline icon + title headers, no box frames, stacked. */
		.gi-grid {
			grid-template-columns: 1fr;
			gap: clamp(14px, 3.4cqh, 28px);
		}
		.gi-card {
			background: none;
			border: none;
			box-shadow: none;
			border-radius: 0;
			padding: clamp(2px, 1cqmin, 10px) 0;
			gap: clamp(6px, 1.6cqmin, 12px);
		}
		.gi-head {
			flex-direction: row;
			justify-content: center;
			align-items: center;
			gap: clamp(8px, 2.4cqmin, 14px);
		}
		.gi-head .gi-ic,
		.gi-head .gi-ic--legal {
			width: clamp(36px, 9cqmin, 54px);
			height: clamp(36px, 9cqmin, 54px);
		}
		.gi-grid .feat-h {
			font-size: clamp(20px, 5cqmin, 30px);
		}
		.gi-card .feat-p {
			font-size: clamp(14px, 3.4cqmin, 20px);
		}
		/* gi-body is a desktop-only centring wrapper — let its paragraphs flow inline in portrait. */
		.gi-body { display: contents; }

		/* Pages 3 & 5: use the frame-box image as the card border, with bigger icons + text. */
		.feat-card {
			background: var(--gi-box-lg) center / 100% 100% no-repeat;
			border: none;
			box-shadow: none;
			border-radius: 0;
			padding: clamp(16px, 4cqmin, 30px) clamp(18px, 4.4cqmin, 34px);
		}
		.feat-grid .feat-h,
		.fb-grid .feat-h {
			font-size: clamp(19px, 4.7cqmin, 30px);
		}
		.feat-grid .feat-p,
		.fb-grid .feat-p {
			font-size: clamp(14px, 3.5cqmin, 21px);
		}
		.feat-grid .feat-ic,
		.fb-grid .feat-ic {
			width: clamp(84px, 21cqmin, 138px);
		}
		.feat-grid .feat-trigger img,
		.fb-grid .feat-trigger img {
			width: clamp(74px, 18cqmin, 120px);
		}
		.feat-grid .feat-x,
		.fb-grid .feat-x {
			font-size: clamp(34px, 8.4cqmin, 62px);
		}
		.fb-grid .fb-k {
			font-size: clamp(13px, 3.1cqmin, 20px);
		}
		.fb-grid .fb-v {
			font-size: clamp(13px, 3.1cqmin, 20px);
		}
		.fb-sub {
			font-size: clamp(13px, 3.1cqmin, 18px);
		}

		/* Page 2 paytable: bigger table + bigger 'Multiplier Wild Values' card text. Give the value
		   boxes more room — tighten the spacing between cells, narrow the symbol column, and make each
		   cell taller so the value fits comfortably. */
		.pt-table {
			/* Smaller coefficient (was 2.1cqmin) so the font scales DOWN on the narrowest phones (e.g. 320px),
			   where 13 columns leave each value cell too small for 5-char values like "2000x". Wider portraits
			   still get a comfortable size. */
			font-size: clamp(5px, 1.8cqmin, 15px);
			border-spacing: clamp(1px, 0.35cqmin, 3px);
			letter-spacing: -0.02em;
		}
		.pt-table th,
		.pt-table td {
			padding: clamp(4px, 1.3cqmin, 9px) 0;
		}
		.pt-table td.pt-sym,
		.pt-table th.pt-rank {
			width: clamp(17px, 5.2%, 42px);
		}
		.pt-side-title {
			font-size: clamp(17px, 4.4cqmin, 26px);
		}
		.pt-side-h {
			font-size: clamp(13px, 3.3cqmin, 19px);
		}
		.pt-side-v {
			font-size: clamp(14px, 3.7cqmin, 22px);
		}
	}

	/* Buttons do NOT inherit font-family: the UA stylesheet hard-sets `font: 400 13.333px Arial` on
	   form controls, so every <button> here (and the glyph spans inside them) rendered in Arial no
	   matter what the container was set to — measured via getComputedStyle, not assumed.
	   Deliberately NOT scoped to a root element, and set OUTRIGHT rather than to `inherit`: the
	   confirm dialog in CustomBuyBonusModal is a SIBLING of .panel, so a `.panel button` rule misses
	   its buttons, and `inherit` on a top-level sibling like .confirm-close resolves against <body>,
	   not the dialog. Svelte already scopes this to the component. */
	button {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
</style>

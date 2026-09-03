<script lang="ts" module>
	// Game description / rules popup — MAGNETIC 2 MOTHERSHIP. Multi-page (arrows below). All copy is
	// localized via the i18n keys ('INFO …'); numeric values stay as constants here.
	//
	// SURFACES ARE DRAWN, NOT ART. The MOTHERSHIP design (Figma 4504:4289 and its six siblings) builds
	// the whole carousel out of three flat rounded rectangles — the #3A3981 panel, the #343376 card
	// and the #49489B/#21206E paytable pad — so the Version2 steel frame, its two card cuts and the
	// bet plate behind the stat row are all gone. That is ~230KB of art the modal no longer loads,
	// and it now resizes crisply instead of stretching a bitmap.
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	// Overview hero: the game's own logo (Figma 9074:16658 measures 1.6641 against logo_plate's
	// 1.6636 — the same drawing). Reusing the splash's plate rather than exporting a second copy
	// means it is already in the browser cache by the time anyone opens the rules.
	const heroImg = ap('/assets/components/splash/logo_plate.webp');
	// Overview stat icons (Figma 9074:16707 / 16709 / 16711 / 16713), rendered at 3x their design box
	// and kept UNTRIMMED — see scripts/build-ui-art.py for why the box matters.
	const icReels = ap('/assets/components/ui/ov_ic_reels.webp');
	const icCluster = ap('/assets/components/ui/ov_ic_cluster.webp');
	const icTrophy = ap('/assets/components/ui/ov_ic_maxwin.webp');
	const icRtp = ap('/assets/components/ui/ov_ic_rtp.webp');

	// ── Paytable (page 2) — symbol art in rank order (highest → lowest) with the pay bands from
	// config.ts (H1→L4). Column headers are the connected-cluster sizes. ──
	const sym = (p: string) => ap(`/assets/components/symbols/magnetic/${p}`);
	const PAY_COLS = ['5', '6', '7', '8', '9', '10+', '12+', '15+', '20+', '25+', '30+', '33+'];
	// The rows ending in `_full` are FLATTENED composites, not the board's own textures. Six symbols
	// were rebuilt as a base plus loose parts so the board can animate them, and this table is plain
	// HTML -- one <img> per row -- so pointed at a base it drew the symbol with its character
	// missing: an empty lightning badge with no bolt, an EM device with no antennae, a WILD row that
	// was a bare magnet with the word WILD nowhere on it. scripts/build-paytable-symbols.py
	// composites each one at its rest pose, reading the placements out of the components themselves
	// so the two can never drift. Re-run it after touching any symbol component or its art.
	//
	// `fit` compensates the TRANSPARENT PADDING baked into each symbol PNG: on the art that has not
	// been rebuilt it occupies only 38-55% of its 328x264 box, so a plain width:100% render leaves
	// the symbol looking half-size in the cell. One rule, not per-symbol taste: at the row's ~42px
	// image box every value here works out to "make the rendered art about 36px tall", which is
	// fit = 281 / (alpha box height in the 328x264 canvas). The build script prints it. The rebuilt
	// symbols all fill the canvas, which is why they share 1.06 while the old flat art does not.
	const payRows = [
		{
			img: sym('premium/compass_full.webp'),
			fit: 1.06,
			v: ['0.5x', '1x', '2x', '4x', '8x', '15x', '30x', '75x', '200x', '500x', '1000x', '2000x'],
		},
		{
			img: sym('premium/lightning_full.webp'),
			fit: 1.06,
			v: ['0.4x', '0.8x', '1.5x', '3x', '6x', '12x', '25x', '60x', '150x', '350x', '750x', '1500x'],
		},
		{
			img: sym('premium/portal_full.webp'),
			fit: 1.06,
			v: [
				'0.3x',
				'0.6x',
				'1.2x',
				'2.5x',
				'5x',
				'10x',
				'20x',
				'45x',
				'120x',
				'275x',
				'600x',
				'1200x',
			],
		},
		{
			img: sym('premium/electromagnetic_device_full.webp'),
			fit: 1.06,
			v: ['0.2x', '0.5x', '1x', '2x', '4x', '8x', '15x', '35x', '90x', '200x', '450x', '900x'],
		},
		{
			img: sym('low/battery_full.webp'),
			fit: 1.06,
			v: [
				'0.15x',
				'0.3x',
				'0.6x',
				'1.2x',
				'2.5x',
				'5x',
				'10x',
				'25x',
				'60x',
				'125x',
				'250x',
				'500x',
			],
		},
		{
			img: sym('low/magnet_full.webp'),
			fit: 1.06,
			v: ['0.12x', '0.25x', '0.5x', '1x', '2x', '4x', '8x', '20x', '50x', '100x', '200x', '400x'],
		},
		// Astronaut (L3): the assembled composite, helmet + head + both eyes.
		{
			img: sym('low/coil_full.webp'),
			fit: 1.26,
			v: ['0.1x', '0.2x', '0.4x', '0.8x', '1.6x', '3x', '6x', '15x', '40x', '80x', '150x', '300x'],
		},
		// Circuit chip (L4): the assembled composite, board + alien + both slime blobs.
		{
			img: sym('low/energy_screw_full.webp'),
			fit: 1.12,
			v: [
				'0.08x',
				'0.15x',
				'0.3x',
				'0.6x',
				'1.2x',
				'2.5x',
				'5x',
				'12x',
				'30x',
				'60x',
				'120x',
				'250x',
			],
		},
	];
	// Page 5 (Feature Buy) — Extra Chance uses the same chip art as its buy-menu card.
	const chipIcon = sym('low/energy_screw_full.webp');
	const wild = sym('special/wild_full.webp');
	const wildX10 = sym('special/wild_x10_full.webp');
	const scatter = sym('special/scatter_full.webp');

	// Cluster-win illustration (page 4): the MOTHERSHIP boards with their wordmark stacked on top
	// (scripts/build-ui-art.py composes each pair from the design's two separate nodes).
	const winImg = ap('/assets/components/ui/info_win.webp');
	const noWinImg = ap('/assets/components/ui/info_nowin.webp');
	// General-info icons (page 6).
	const icRotate = ap('/assets/components/ui/info_ic_charge_arrow.webp');
	const icLegal = ap('/assets/components/ui/info_ic_legal.webp');

	// Game controls (page 7) — the MOTHERSHIP round-button set (Figma 4725:11860), in design order.
	// Every one is an SVG: a flat #49489B disc under a white glyph, with an #A88EFF hairline — the
	// same --btn / --btn-edge this modal already uses. SPIN is the odd one out, a FILLED #A88EFF disc,
	// which is why it keeps `big`. name/desc are i18n keys, translated reactively in the template.
	const controls = [
		{
			img: ap('/assets/components/ui/ctrl_spin.svg'),
			nameKey: 'INFO CTRL SPIN',
			descKey: 'INFO CTRL SPIN DESC',
			big: true,
		},
		{
			img: ap('/assets/components/ui/ctrl_auto.svg'),
			nameKey: 'INFO CTRL AUTO',
			descKey: 'INFO CTRL AUTO DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_turbo.svg'),
			nameKey: 'INFO CTRL TURBO',
			descKey: 'INFO CTRL TURBO DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_plus.svg'),
			nameKey: 'INFO CTRL PLUS',
			descKey: 'INFO CTRL PLUS DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_minus.svg'),
			nameKey: 'INFO CTRL MINUS',
			descKey: 'INFO CTRL MINUS DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_info.svg'),
			nameKey: 'INFO CTRL INFO',
			descKey: 'INFO CTRL INFO DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_sound.svg'),
			nameKey: 'INFO CTRL SOUND',
			descKey: 'INFO CTRL SOUND DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_arrow_left.svg'),
			nameKey: 'INFO CTRL PREV',
			descKey: 'INFO CTRL PREV DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_arrow_right.svg'),
			nameKey: 'INFO CTRL NEXT',
			descKey: 'INFO CTRL NEXT DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_close.svg'),
			nameKey: 'INFO CTRL CLOSE',
			descKey: 'INFO CTRL CLOSE DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_menu.svg'),
			nameKey: 'INFO CTRL MENU',
			descKey: 'INFO CTRL MENU DESC',
		},
		{
			img: ap('/assets/components/ui/ctrl_music.svg'),
			nameKey: 'INFO CTRL MUSIC',
			descKey: 'INFO CTRL MUSIC DESC',
		},
	];

	// Every image this modal renders, for LoadingController's HTML-image pass. Built from the consts
	// above so a path or ?v= edit can never desync the preload list.
	export const INFO_MODAL_IMAGES = [
		heroImg,
		icReels,
		icCluster,
		icTrophy,
		icRtp,
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

<div class="info-overlay">
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

					<!-- --ic is each icon's own box height as a fraction of the 77px card (45 / 58 / 52 / 57
				     in Figma 4504:4326). The art sits off-centre inside those boxes on purpose, so the
				     box — not the visible ink — is what has to be scaled. -->
					<div class="ov-stats">
						<div class="stat">
							<span class="stat-ic" style="--ic:0.584"><img src={icReels} alt="" /></span>
							<span class="stat-txt"><b>7X7</b><i>{t('INFO STAT REELS')}</i></span>
						</div>
						<div class="stat stat--sm">
							<span class="stat-ic" style="--ic:0.753"><img src={icCluster} alt="" /></span>
							<span class="stat-txt"
								><b>{t('INFO STAT CLUSTER')}</b><i>{t('INFO STAT PAYS')}</i></span
							>
						</div>
						<div class="stat">
							<span class="stat-ic" style="--ic:0.675"><img src={icTrophy} alt="" /></span>
							<span class="stat-txt"><b>20,000</b><i>{t('INFO STAT MAXWIN')}</i></span>
						</div>
						<div class="stat">
							<span class="stat-ic" style="--ic:0.740"><img src={icRtp} alt="" /></span>
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
								<div class="card feat-card feat-card--wild">
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
								<div class="feat-trigger">
									<span class="feat-x">3x</span><img src={scatter} alt="Scatter" />
								</div>
							</div>
							<div class="card feat-card feat-tall">
								<h3 class="feat-h">{t('INFO FEAT MEGA TITLE')}</h3>
								<p class="feat-p">{t('INFO FEAT MEGA TEXT')}</p>
								<div class="feat-trigger">
									<span class="feat-x">4x</span><img src={scatter} alt="Scatter" />
								</div>
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
								<!-- NO WIN first: the design (4453:7579) puts the counter-example on the left. -->
								<img class="cw-img" src={noWinImg} alt="No-win example" />
								<img class="cw-img" src={winImg} alt="Winning cluster example" />
							</div>
						</div>
					</div>
				{:else if page === 5}
					<div class="page">
						<h2 class="page-title">{t('INFO FEATURE BUY')}</h2>
						<p class="fb-sub">{t('INFO FB SUB')}</p>
						<div class="fb-grid">
							<div class="card feat-card">
								<!-- Extra Chance reuses the buy-menu card's own title/description keys (already
							     translated in every locale) so the rules page and the mode card cannot drift. -->
								<h3 class="feat-h">{t('BUY EXTRA CHANCE TITLE')}</h3>
								<p class="feat-p">{t('BUY EXTRA CHANCE DESC')}</p>
								<img class="feat-ic" src={chipIcon} alt="Extra Chance" />
								<div class="fb-meta">
									<span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('2x')}</span>
								</div>
								<div class="fb-meta">
									<span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span>
								</div>
							</div>
							<div class="card feat-card">
								<h3 class="feat-h">{t('INFO FB EXTRA TITLE')}</h3>
								<p class="feat-p">{t('INFO FB EXTRA TEXT')}</p>
								<img class="feat-ic" src={wild} alt="Wild" />
								<div class="fb-meta">
									<span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('50x')}</span>
								</div>
								<div class="fb-meta">
									<span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span>
								</div>
							</div>
							<div class="card feat-card">
								<h3 class="feat-h">{t('INFO FB FEATURE TITLE')}</h3>
								<p class="feat-p">{t('INFO FB FEATURE TEXT')}</p>
								<div class="feat-trigger">
									<span class="feat-x">3x</span><img src={scatter} alt="Scatter" />
								</div>
								<div class="fb-meta">
									<span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('100x')}</span>
								</div>
								<div class="fb-meta">
									<span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span>
								</div>
							</div>
							<div class="card feat-card">
								<h3 class="feat-h">{t('INFO FB BONUS TITLE')}</h3>
								<p class="feat-p">{t('INFO FB BONUS TEXT')}</p>
								<div class="feat-trigger">
									<span class="feat-x">4x</span><img src={scatter} alt="Scatter" />
								</div>
								<div class="fb-meta">
									<span class="fb-k">{t('INFO COST')}</span><span class="fb-v">{cost('500x')}</span>
								</div>
								<div class="fb-meta">
									<span class="fb-k">{t('INFO RTP')}</span><span class="fb-v">{RTP_SHORT}</span>
								</div>
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
				<button
					class="pg-arrow"
					type="button"
					onclick={prev}
					disabled={page === 1}
					aria-label="Previous"
				>
					<span class="pg-glyph pg-glyph--left"></span>
				</button>
				<button
					class="pg-arrow"
					type="button"
					onclick={next}
					disabled={page === TOTAL}
					aria-label="Next"
				>
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
		background: rgba(0, 0, 0, 0.7);
		cursor: default;
	}
	/* ── MOTHERSHIP design tokens (Figma 4504:4289 + its six sibling pages) ──
	   The carousel is built from three flat surfaces and two typefaces, and NOTHING in it is cyan any
	   more — the Version2 palette (#2391C1 headings, #6FB6F6 icons, #D7D7D7 body) is gone and every
	   piece of text on all seven pages is plain white.
	     --panel    the popup itself, one rounded rect
	     --card     the feature / stat / general-info cards, edged in --card-edge
	     --btn      the pager arrows and the close button, edged in --btn-edge (close: white)
	     --pad-head / --pad-cell   the paytable's two cell states
	   TWO FACES, FOUR WEIGHTS, AND NO OTHERS: Audiowide has only 400, Poppins here self-hosts only
	   500 and 700 (static/fonts/web/fonts.css). Asking for anything else gets a browser-synthesised
	   face — the same trap the old Chakra Petch 500/800/900 declarations hit. */
	.info-overlay {
		position: absolute;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		pointer-events: none;
		container-type: size;
		--panel: #3a3981;
		--card: #343376;
		--card-edge: #8284d6;
		--btn: #49489b;
		--btn-edge: #a88eff;
		--pad-head: #21206e;
		--pad-cell: #49489b;
		--display: 'Audiowide', 'Chakra Petch', sans-serif;
		--text: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-family: var(--text);
		font-weight: 500;
	}
	/* Figma 9074:16670 — 954x552 of the 1200x670 frame (79.5% x 82.4%), radius 10, flat #3A3981.
	   No frame art, no brackets: the padding therefore only has to clear the rounded corners, not a
	   steel edge, which is why it is roughly half what the Version2 frame needed. The design's
	   tightest content inset is the paytable's, 42 of the 954 panel width (4.4%). */
	.info-panel {
		pointer-events: auto;
		position: relative;
		/* A touch narrower than the viewport so the screen-corner close button clears the panel. */
		width: min(1120px, 79.5cqw);
		height: min(660px, 82.4cqh);
		box-sizing: border-box;
		padding: clamp(12px, 3.6cqmin, 36px) clamp(16px, 6.3cqmin, 63px);
		background: var(--panel);
		border: none;
		border-radius: clamp(6px, 1.5cqmin, 13px);
		box-shadow: 0 10px 26px rgba(0, 0, 0, 0.5);
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
		/* Figma 4504:4318 — 49px #49489B circle with a 1px WHITE ring (the pager arrows below use the
		   lavender ring instead; the close button is the one that does not). */
		border: 1px solid #fff;
		background: var(--btn);
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
	.x-glyph::before {
		transform: rotate(45deg);
	}
	.x-glyph::after {
		transform: rotate(-45deg);
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

	/* ── Overview page ──
	   Figma 4504:4289 measures the two columns 325 (copy) and 413 (logo) inside a content box the
	   panel's own padding does not reach: page 1 insets its content 77 from the panel edge where the
	   paytable insets only 42, so the extra 39 lives here rather than in .info-panel.
	   The column ratio is what makes the copy wrap the way the design does — at an even 1fr/1fr split
	   the paragraphs run ~30% wider and the whole left column reads as a different design. */
	.ov {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 325fr 413fr;
		gap: clamp(10px, 5.7cqmin, 58px);
		padding-inline: clamp(4px, 5.2cqmin, 52px);
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
	/* Every page heading: Audiowide 400 at 35px on the 1200x670 frame, 0.03em, white. 5.2cqmin
	   resolves to exactly 35px there. Audiowide ships ONE weight — 400 — so do not ask for bold. */
	.ov-title {
		margin: 0;
		font-family: var(--display);
		font-size: clamp(20px, 5.2cqmin, 44px);
		font-weight: 400;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		overflow-wrap: break-word;
		word-break: break-word;
		color: #fff;
	}
	/* Figma 4504:4325 — Poppins 500 / 13px / 0.39px tracking / lh 19.5 / #FFF. Sizes stay
	   container-relative rather than pinned to 13px: 1.95cqmin evaluates to exactly 13 at the
	   1200x670 design frame and scales from there. Tracking is in em (0.39/13 = 0.03em) so it
	   tracks the size. */
	.ov-text {
		margin: 0;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(11px, 1.95cqmin, 18px);
		letter-spacing: 0.03em;
		line-height: 1.5;
		color: #fff;
	}
	.ov-maxwin {
		margin: clamp(2px, 0.6cqmin, 8px) 0 0;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(11px, 1.95cqmin, 18px);
		letter-spacing: 0.03em;
		color: #fff;
	}
	/* The design pulls the amount out at ~32px — still Poppins, just 2.5x the line it sits in. NOT
	   the display face: Audiowide is far wider per glyph and "20,000x" then runs a third longer than
	   the design's, which pushes "bet." off the measure. */
	.ov-maxwin span {
		font-size: clamp(16px, 4.8cqmin, 32px);
		font-weight: 500;
		color: #fff;
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
	/* Figma 9074:16658 — 413 wide on the 1200 frame (34.4%), so 34.4cqw at the design aspect. The
	   drop shadow the Version2 prop composite needed is gone: the logo plate carries its own. */
	.ov-hero {
		width: min(100%, clamp(180px, 34.4cqw, 470px));
		height: auto;
		object-fit: contain;
	}

	/* ── Stat boxes ── */
	.ov-stats {
		/* One source of truth for the card height so each icon can be expressed as a fraction of it
		   (the design sizes every icon against the 77px-tall card). Approximates the aspect-derived
		   height of a card in the 79%-wide row below. */
		--stat-h: clamp(44px, 11.5cqmin, 96px);
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(6px, 1.4cqmin, 14px);
		/* Figma 4504:4326: the row is 820 of the 954 PANEL, centred. Expressed against the panel's
		   CONTENT box (which the panel padding has already narrowed to ~870), so 94.3% — not the
		   86% the raw design numbers suggest. */
		width: 100%;
		max-width: 94.3%;
		margin-inline: auto;
	}
	/* Figma 9074:16650 — 186x77, radius 10, #343376 under a 3px #8284D6 edge. Same card as pages
	   3, 5 and 6; it is the .card rule below with the design's own aspect pinned on. */
	.stat {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(4px, 1cqmin, 11px);
		aspect-ratio: 186 / 77;
		min-height: 0;
		box-sizing: border-box;
		padding: clamp(4px, 1cqmin, 11px) clamp(5px, 1.2cqmin, 13px);
		background: var(--card);
		border: clamp(1.5px, 0.45cqmin, 3px) solid var(--card-edge);
		border-radius: clamp(5px, 1.5cqmin, 10px);
	}
	.stat-ic {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
	}
	/* Height comes from --ic, each icon's own Figma BOX height as a fraction of the 77px card
	   (reels 45, cluster 58, max-win 52, RTP 57). Every icon is square, so width follows. */
	.stat-ic img {
		height: calc(var(--stat-h) * var(--ic, 0.65));
		width: auto;
		object-fit: contain;
		display: block;
	}
	.stat-txt {
		display: flex;
		flex-direction: column;
		line-height: 1.05;
		min-width: 0;
		white-space: nowrap;
	}
	/* Figma 4504:4330/4331 — BOTH lines Audiowide 400 in white: value 20-24px, label 12px. The
	   design does not uppercase them (`reels`, `pays`, `max win` are lowercase in the file) but the
	   labels come from the i18n catalogue already cased, so leave the case alone. */
	.stat-txt b,
	.stat-txt i {
		font-family: var(--display);
		font-weight: 400;
		letter-spacing: 0.03em;
		color: #fff;
	}
	.stat-txt b {
		font-size: clamp(11px, 3cqmin, 26px);
	}
	.stat-txt i {
		font-style: normal;
		font-size: clamp(8px, 1.8cqmin, 15px);
	}
	/* CLUSTER and the RTP percentage are the two long values (the design sets them a step down at
	   20px against the other two at 24px). */
	.stat--sm .stat-txt b {
		font-size: clamp(10px, 2.5cqmin, 22px);
	}
	.ov-stats .stat:last-child .stat-txt b {
		font-size: clamp(10px, 2.5cqmin, 22px);
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
		font-family: var(--display);
		font-size: clamp(20px, 5.2cqmin, 44px);
		font-weight: 400;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		/* Long single-word titles in other languages (e.g. German "BEDIENUNGSANLEITUNG") must break to a
		   new line instead of clipping past the panel edge. */
		overflow-wrap: break-word;
		word-break: break-word;
		max-width: 100%;
		color: #fff;
	}
	/* THE card. One rule for pages 1, 3, 5 and 6: Figma 9074:16676 / 16684 / 17516 / 18460 all draw
	   the same rounded rect — radius 10, #343376, 3-4px #8284D6 — at four different sizes. The
	   Version2 build had three different bitmaps doing this job (bb_card_panel_v2, info_card_tall_v2
	   and the bet plate), each stretched to a box it was not cut for. */
	.card {
		box-sizing: border-box;
		background: var(--card);
		border: clamp(1.5px, 0.5cqmin, 4px) solid var(--card-edge);
		border-radius: clamp(5px, 1.5cqmin, 10px);
		box-shadow: none;
	}
	/* Card titles: Audiowide 400 at 18px on the 1200x670 frame (2.7cqmin), white. */
	.feat-h {
		margin: 0;
		font-family: var(--display);
		font-size: clamp(12px, 2.7cqmin, 25px);
		font-weight: 400;
		line-height: 1.27;
		letter-spacing: 0.03em;
		color: #fff;
	}
	.feat-p {
		margin: 0;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(10px, 1.95cqmin, 17px);
		letter-spacing: 0.03em;
		line-height: 1.5;
		color: #fff;
	}
	/* The legal-notice copy is one dense block — more line spacing so it reads less cramped than the
	   shorter feature paragraphs. */
	.feat-p--legal {
		line-height: 1.68;
	}

	/* ── Page 2: Paytable ──
	   Figma 9076:28194, all measured off the 1200x670 frame. The table and the aside sit in one band
	   42 in from the panel's left edge and 43 from its right:
	     table  165..850  (685)   aside 861..1034 (173)   gap 11
	     header pads y 161..199, then 8 rows on a 42 pitch — cell 38 tall, 4 apart, radius 8
	     symbol column 85 wide, the twelve value columns 46 each on a 50 pitch
	   Every one of those is a fraction here rather than a pixel, but the RATIOS are the design's. */
	.pt {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 685fr 173fr;
		gap: clamp(4px, 1.64cqmin, 15px);
		align-items: stretch;
	}
	.pt-table-wrap {
		min-width: 0;
		display: flex;
	}
	.pt-table {
		width: 100%;
		border-collapse: separate;
		/* 4px between cells at design size (50 pitch on a 46 cell, 42 on a 38). */
		border-spacing: clamp(1px, 0.6cqmin, 5px);
		table-layout: fixed;
		/* Value cells are Poppins 500 / 12; 1.8cqmin resolves to exactly 12 on the design frame. */
		font-size: clamp(7px, 1.8cqmin, 16px);
	}
	.pt-table th,
	.pt-table td {
		text-align: center;
		vertical-align: middle;
		border-radius: clamp(3px, 1.2cqmin, 10px);
		/* The design's cells are a FIXED height, not text-plus-padding: every row is the same size
		   whether it holds a 4-character value or a symbol. The design draws 38 (5.67cqmin); 5.4 is
		   36, which is what actually fits — a `border-separate` table also spaces ABOVE the header
		   and BELOW the last row, so nine 38s plus ten 4s overruns the design's own 374-tall band by
		   8, and that 8 is exactly enough to put the pager arrows on top of the last row. */
		height: clamp(14px, 5.4cqmin, 48px);
		padding: 0;
		font-family: var(--text);
		font-weight: 500;
		color: #fff;
		/* Figma "Symbols pad" 9076:28276 — the VALUE cells are flat #49489B with no edge; the
		   header row and the symbol column are the darker #21206E behind a 1px #49489B. */
		background: var(--pad-cell);
		border: none;
	}
	.pt-table thead th,
	.pt-table td.pt-sym {
		background: var(--pad-head);
		border: 1px solid var(--pad-cell);
	}
	/* Column headers are a step LARGER than the values (16 against 12 in the design). */
	.pt-table thead th {
		font-size: 1.33em;
		color: #fff;
	}
	/* 85 of the table's 685 — the one column the design sizes explicitly; the twelve value columns
	   then share what is left evenly, which is what `table-layout: fixed` does with them unset. */
	.pt-table td.pt-sym,
	.pt-table th.pt-rank {
		width: 12.4%;
	}
	/* Back to the base 12px (this cell sits in thead, which is at 1.33em) and wrapping to two lines. */
	.pt-table th.pt-rank {
		font-size: 0.75em;
		line-height: 1.15;
		color: #fff;
		text-transform: uppercase;
	}
	.pt-table td.pt-sym img {
		display: block;
		/* Sized against the ROW, not the column: the pad is 85 wide and 38 tall, so height is what
		   constrains a roughly square symbol. Capped just under the cell so the art keeps a hairline
		   of pad around it instead of touching the 1px edge. */
		height: 88%;
		width: 100%;
		object-fit: contain;
		margin: 0 auto;
		/* Layout-neutral, so the row height is unaffected and only the transparent margin spills. */
		transform: scale(var(--fit, 1));
	}
	/* Figma 9076:28591 — the Multiplier Wild Values aside is the SAME card as everywhere else
	   (173x374, radius 8, #343376 under a 3px #8284D6), so it inherits .card and only sets its
	   padding and the vertical centring here. */
	.pt-side {
		/* 21 of the aside's 173 each side, 29 above the title. */
		padding: clamp(8px, 4.3cqmin, 38px) clamp(6px, 3.1cqmin, 27px);
		display: flex;
		flex-direction: column;
		justify-content: center; /* centre the copy vertically in the tall card, not stuck at the top */
		/* No gap: the Figma aside stacks its lines tight; spacing comes from each line's own
		   margins, and a flex gap on top of those opened the block up too far. */
		gap: 0;
		text-align: center;
	}
	/* Figma 9076:28592 — Audiowide 400 / 18px, white, wrapping to three lines. */
	.pt-side-title {
		margin: 0;
		font-family: var(--display);
		font-size: clamp(11px, 2.7cqmin, 24px);
		font-weight: 400;
		letter-spacing: 0.03em;
		color: #fff;
		line-height: 1.27;
	}
	/* Block rhythm measured off the design: ~1.45em between a heading and its values, ~2.6em
	   between a value line and the next heading, ~3.7em under the title. Expressed in em so it
	   tracks the font size; the leading already supplies ~0.3em, hence the smaller margins. */
	.pt-side-h {
		margin: 2.3em 0 0;
		font-size: clamp(10px, 1.85cqmin, 16px);
		font-weight: 700;
		color: #fff;
		line-height: 1.4;
	}
	.pt-side-h:first-of-type {
		margin-top: 3.4em;
	}
	.pt-side-v {
		margin: 1.15em 0 0;
		font-size: clamp(10px, 1.85cqmin, 16px);
		font-weight: 500;
		color: #fff;
		line-height: 1.4;
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
	/* The two stacked cards share the column height in proportion to their COPY (flex-basis auto),
	   not as two exactly-equal halves: the Wild explanation is roughly twice the length of the
	   Multiplier Wild one, so an even split pushed the Wild art through the lower frame (measured
	   54px past it at 1600x900) while the other card sat with slack. */
	.feat-grid .feat-col-small .feat-card {
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		gap: clamp(2px, 0.6cqmin, 6px);
		padding: clamp(10px, 2cqmin, 16px) clamp(10px, 2cqmin, 18px) clamp(8px, 1.8cqmin, 14px);
	}
	/* Smaller than the tall cards' art on purpose — these two cards are half-height and carry the
	   longest copy on the page, so the magnet has to give way to the text, not the other way round. */
	.feat-grid .feat-col-small .feat-ic {
		width: clamp(30px, 6.2cqmin, 36px);
		margin: 0;
	}
	/* The approved Magnetic Wild explanation is substantially longer than the other feature copy.
	   Keep it inside the half-height card without pushing the Wild art through the lower frame. */
	.feat-grid .feat-col-small .feat-card--wild .feat-p {
		font-size: clamp(8px, 1.4cqmin, 12px);
		line-height: 1.3;
		letter-spacing: 0.015em;
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
	/* Figma 7022:6377 — Poppins 700 / 24px beside the scatter. */
	.feat-x {
		font-family: var(--text);
		font-size: clamp(16px, 3.6cqmin, 34px);
		font-weight: 700;
		letter-spacing: 0.03em;
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
		/* Figma 4453:7579 — copy 313 and boards 506 with 40 between, in an 859-wide band that the
		   panel's own padding already provides. The columns used to be 1fr / 1.15fr, which gave the
		   copy half the page and left the two boards well short of the size the design draws them. */
		grid-template-columns: 313fr 506fr;
		gap: clamp(10px, 4.6cqmin, 47px);
		align-items: center;
	}
	.cw-text {
		display: flex;
		flex-direction: column;
		gap: clamp(8px, 1.8cqmin, 18px);
	}
	/* Figma 4453:7615 — Poppins 500 / 15px / lh 22.5. The widest body copy in the carousel. */
	.cw-text p {
		margin: 0;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(11px, 2.25cqmin, 20px);
		letter-spacing: 0.03em;
		line-height: 1.5;
		color: #fff;
	}
	/* WIN / NO WIN board art with its wordmark composed in — side by side, matched height. */
	.cw-grids {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(4px, 1.4cqmin, 14px);
	}
	/* 242 x 293 design units each, which the panel's own scale puts at 284 x 344 CSS px — the two
	   caps below bind at roughly the same moment, so neither axis crops the other's proportion. */
	.cw-img {
		max-height: clamp(170px, 48cqmin, 344px);
		max-width: 49%;
		height: auto;
		display: block;
		filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.4));
	}

	/* ── Page 5: Feature buy ── */
	/* Figma 4453:7206 — Poppins / 14px / lh 21, centred under the title. */
	.fb-sub {
		margin: 0;
		text-align: center;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(10px, 2.1cqmin, 18px);
		letter-spacing: 0.03em;
		line-height: 1.5;
		color: #fff;
	}
	.fb-grid {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		/* Figma 4453:7151 sized three 200px cards + two 34px gaps = 668 of the 965 inner panel, CENTRED.
		   The row now carries a fourth card (Extra Chance), so the band widens to 4x200 + 3x34 = 902 of
		   965 — the CARD width is unchanged from the design, only the band it sits in grows. Stretching
		   the row edge to edge would make each card wider than the design and leave the copy floating. */
		gap: clamp(6px, 2.4cqmin, 26px);
		max-width: 94%;
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
		/* Four cards across (Extra Chance joined the row), so each is ~a quarter of the band rather
		   than a third: heading, copy and icons all step down a notch. Measured, not guessed — at the
		   previous sizes cards 2-4 overflowed their fixed-height frame art by 10-21px at 16:9 in
		   English and by up to 33px in Russian (the wordiest locale). These coefficients measure 0px
		   overflow in en/de/ru at 1600x900, 1280x720, 1024x768 and mobile landscape. The MAXIMA matter
		   as much as the coefficients: 16:9 desktop is wide enough that the clamp max is what renders
		   (measured 15px of a 1.7cqmin/15px description there), so raising them re-broke Russian. */
		font-size: clamp(11px, 2.4cqmin, 21px);
	}
	.fb-grid .feat-p {
		/* Slightly smaller so the (now larger) icons fit the tight cards on desktop without clipping.
		   Sized so even the longest-copy locale (Russian Extra-Feature card) keeps COST/RTP inside the
		   card — the description is the only variable-height element here. */
		/* Figma is 14px in a 176px-wide text column; the cards are now that narrow too, so the same
		   size wraps the same way. Was 1.6cqmin (~11px), shrunk back when the cards were full-width. */
		font-size: clamp(9px, 1.8cqmin, 14px);
		line-height: 1.5;
	}
	.fb-grid .feat-ic {
		/* Desktop (base) W icon — the Extra-Feature card has the longest copy, so this is the largest that
		   fits without clipping COST/RTP on the tightest (16:9) desktop panels, even in the wordiest
		   locale (Russian). cqmin scales it. */
		width: clamp(38px, 6.6cqmin, 56px);
	}
	.fb-grid .feat-trigger img {
		/* Scatter cards have shorter copy → the scatter can be a bit bigger. */
		width: clamp(40px, 8cqmin, 66px);
	}
	.fb-grid .feat-x {
		font-size: clamp(17px, 3.4cqmin, 32px);
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
	/* Figma 4526:8948/8951 — label AND value are Poppins 700 / 12px in the SAME white. The design
	   separates them by position (a 22px step between the two lines), not by colour. */
	.fb-k,
	.fb-v {
		font-family: var(--text);
		font-size: clamp(9px, 1.8cqmin, 16px);
		font-weight: 700;
		letter-spacing: 0.03em;
		color: #fff;
	}
	.fb-k {
		text-transform: uppercase;
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
		/* Both cards are the shared .card (Figma 9078:18460 / 18462 — 229x367 and 422x367, same
		   fill and edge, only the width differs), so nothing to set here but the inset. */
		padding: clamp(14px, 3cqmin, 34px) clamp(16px, 3.4cqmin, 38px);
		gap: clamp(6px, 1.2cqmin, 12px);
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
	}
	/* Figma 4214:3264 / 3275 — the only two card titles the design sets in UPPERCASE. */
	.gi-grid .feat-h {
		text-transform: uppercase;
	}
	/* Figma 4214:3265 / 3276 — Poppins 500 / 10px / 0.3px tracking / lh 15. The smallest copy in the
	   carousel, and the only place the design goes under 12. cqmin is 6.7px on the 1200x670 frame,
	   so 1.45cqmin lands on ~9.8; tracking is 0.3/10 = 0.03em so it follows the size.
	   Figma insets the copy ~60px each side of the card, so it wraps to a narrower measure and runs
	   taller — filling the card rather than sitting as a short wide slab. */
	.gi-card .feat-p {
		max-width: 80%;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(8px, 1.45cqmin, 13px);
		letter-spacing: 0.03em;
		line-height: 1.5;
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
		/* Figma 4725:11860 — 767-wide band of five 111.4 cells (52.5 between) in a 954 panel, rows
		   10.7 apart. Everything below is that geometry scaled by the panel's own 1120/954, which is
		   why the maxima look like odd numbers. The set used to run ~25% oversized: three rows then
		   needed 536px of the 452 the page has, and the grid overflowed UP under the title. */
		gap: clamp(5px, 1.57cqmin, 13px) clamp(4px, 7.69cqmin, 62px);
		padding-inline: clamp(0px, 5.87cqmin, 47px);
		align-content: center;
	}
	.ctrl {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		/* The design leaves the same 7.2 between icon and name as between name and description. */
		gap: clamp(3px, 1.06cqmin, 9px);
		padding: 0;
	}
	.ctrl-ic {
		width: clamp(30px, 7.04cqmin, 56px);
		height: clamp(30px, 7.04cqmin, 56px);
		object-fit: contain;
	}
	/* SPIN is the one button the design draws bigger: 52 square against the other twelve's 48
	   (Figma 9078:18586 vs 4725:12175). It used to be a 1.32 visual scale, which was correcting the
	   old 3D art's metallic frame rather than following the design, and would over-size the flat
	   disc that replaced it. */
	.ctrl-ic--lg {
		width: clamp(33px, 7.62cqmin, 61px);
		height: clamp(33px, 7.62cqmin, 61px);
	}
	/* Figma 4725:11940 — Poppins 700 / 14.5px / lh 21.7, white. NOT the display face: page 7 is the
	   one page whose item titles the design leaves in the text family. */
	.ctrl-name {
		margin: 0;
		font-family: var(--text);
		font-weight: 700;
		text-transform: uppercase;
		font-size: clamp(9px, 2.12cqmin, 17px);
		letter-spacing: 0.03em;
		line-height: 1.5;
		color: #fff;
	}
	/* Figma 4725:11941 — Poppins 500 / 10px / lh 15. */
	.ctrl-desc {
		margin: 0;
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(8px, 1.46cqmin, 12px);
		letter-spacing: 0.03em;
		line-height: 1.5;
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
	/* Figma 9078:18562 — 48px #49489B circle with a 1px #A88EFF ring and a drawn white arrow. Both
	   arrows sit CENTRED under the content; the page counter floats to the right of them. */
	.pg-arrow {
		width: clamp(34px, 7.2cqmin, 52px);
		height: clamp(34px, 7.2cqmin, 52px);
		border: 1px solid var(--btn-edge);
		border-radius: 50%;
		background: var(--btn);
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
	/* Figma 4504:4323 — Poppins 500 / 12px, white, on the panel's right edge. */
	.pg-num {
		position: absolute;
		right: clamp(0px, 1cqmin, 8px);
		font-family: var(--text);
		font-weight: 500;
		font-size: clamp(9px, 1.8cqmin, 16px);
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
			/* Same flat plate as the desktop panel, only wider against the short viewport — but not so
			   wide that the screen-corner close button lands on its top-right radius. */
			width: min(1120px, 88cqw);
			height: min(660px, 90cqh);
			border-radius: clamp(8px, 2cqmin, 16px);
			padding: clamp(8px, 2.2cqmin, 26px) clamp(10px, 2.6cqmin, 30px);
		}
		/* Page 1 stat plates: SHOWN (they were dropped here once, and the user asked for them back
		   on popout L/S) — compact so the page still fits the fixed canvas. */
		.ov-stats {
			--stat-h: 58px;
			max-width: 92%;
			gap: 8px;
		}
		.stat-txt b {
			font-size: 17px;
		}
		.stat-txt i {
			font-size: 10px;
		}
		.stat--sm .stat-txt b {
			font-size: 14px;
		}
		.ov-stats .stat:first-child .stat-txt b {
			font-size: 19px;
		}
		.ov-stats .stat:first-child .stat-txt i {
			font-size: 11px;
		}
		/* ── Landscape readability boosts ── the fixed 850×472 canvas leaves the fluid content sitting near
		   its px floors, so enlarge each page's text/art (and rebalance spacing) per the design review. */
		/* Bigger section title on every landscape page (pages 2–7 use .page-title; page 1 uses .ov-title). */
		.page-title {
			font-size: 28px;
		}
		/* Page 1 — Overview: larger title, copy and hero ring. */
		.ov-left {
			gap: 10px;
		}
		.ov-title {
			font-size: 32px;
		}
		.ov-text {
			font-size: 14px;
			line-height: 1.45;
		}
		.ov-maxwin {
			font-size: 14px;
		}
		.ov-maxwin span {
			font-size: 24px;
		}

		/* Page 2 — Paytable: enlarge the right-hand Multiplier-Wild panel text. Widen the aside and keep the
		   sizes moderate so its content stays shorter than the table (else the grid row grows and clips). */
		.pt {
			grid-template-columns: 1fr 185px;
		}
		.pt-side {
			gap: 0;
			padding: 16px 14px;
		}
		.pt-side-title {
			font-size: 15px;
		}
		/* Equal sizes — the design does not step the values up over their headings. */
		.pt-side-h {
			font-size: 11px;
		}
		.pt-side-v {
			font-size: 11px;
		}

		/* Page 3 — Features: slightly larger text/art with roomier gaps. */
		.feat-grid {
			gap: 16px;
		}
		.feat-grid .feat-card {
			gap: 16px;
			padding: 16px;
		}
		.feat-grid .feat-col-small .feat-card {
			gap: 5px;
			padding: 12px 14px;
		}
		.feat-grid .feat-h {
			font-size: 16px;
		}
		.feat-grid .feat-p {
			font-size: 12px;
		}
		/* The Multiplier Wild card (small left column) has the most copy — a touch smaller so it sits easy. */
		.feat-grid .feat-col-small .feat-p {
			font-size: 11px;
		}
		.feat-grid .feat-col-small .feat-card--wild .feat-p {
			font-size: 9px;
			line-height: 1.25;
		}
		.feat-grid .feat-ic {
			width: 96px;
		}
		.feat-grid .feat-col-small .feat-ic {
			width: 70px;
		}
		.feat-grid .feat-col-small .feat-card--wild .feat-ic {
			width: 56px;
		}
		.feat-grid .feat-trigger img {
			width: 86px;
		}
		.feat-grid .feat-x {
			font-size: 32px;
		}

		/* Page 4 — Cluster win: much larger copy; stack the WIN / NO-WIN grids in a column. Extra left inset
		   on the copy; tighter gap between the stacked grids so each image can grow taller. */
		.cw {
			grid-template-columns: 1.05fr 1fr;
		}
		.cw-text {
			gap: 13px;
			padding-left: 24px;
		}
		.cw-text p {
			font-size: 14px;
			line-height: 1.45;
		}
		.cw-grids {
			flex-direction: column;
			gap: 8px;
		}
		.cw-img {
			max-width: 96%;
			max-height: 182px;
		}

		/* Page 5 — Feature buy: everything bigger (the cards have spare height). */
		.fb-sub {
			font-size: 12px;
		}
		/* Wider than the desktop row's band: the landscape canvas is only 850px across, so the same
		   percentage left the cards narrow enough to wrap the Extra-Feature copy an extra line. With
		   four cards the row uses the full width and a tighter gap to keep each card readable. */
		.fb-grid {
			gap: 10px;
			max-width: 100%;
		}
		/* Centre each card's rows as ONE block (title → text → icon → COST → RTP). This was
		   space-between, which spread three cards over a tall card nicely; with four narrower cards
		   in a popout window it left ~40px voids between every row. Measured at 700x460: the block
		   now spans 53-187px of a 241px card instead of 7-234px. */
		.fb-grid .feat-card {
			gap: clamp(4px, 1.5cqmin, 10px);
			padding: 10px;
			justify-content: center;
		}
		.fb-grid .feat-h {
			font-size: 15px;
		}
		/* 1px under the other landscape body copy: at 15px the longest card (Extra Feature) wrapped to
		   five lines and pushed COST/RTP past the frame art's bottom edge in both popout sizes. */
		.fb-grid .feat-p {
			font-size: 11px;
		}
		/* Short landscape viewports (this @container fires ≤490px tall, e.g. mobile landscape): the panel is
		   only ~half height, so keep the icons modest or they clip the card's COST/RTP. */
		.fb-grid .feat-ic {
			width: 68px;
		}
		.fb-grid .feat-trigger img {
			width: 72px;
		}
		.fb-grid .feat-x {
			font-size: 23px;
		}
		.fb-k {
			font-size: 13px;
		}
		.fb-v {
			font-size: 13px;
		}

		/* Page 6 — General info: bigger icons, more card padding, larger gaps between stacked elements. */
		.gi-card {
			padding: 40px 46px;
			gap: 16px;
		}
		/* The narrow (Interrupted Rounds) card's copy sits closer to its frame edges — extra side padding
		   insets it to match the wider Legal card. */
		.gi-card:not(.gi-wide) {
			padding-left: 64px;
			padding-right: 64px;
		}
		.gi-head {
			gap: 12px;
		}
		/* Same size for both so the icon centres + titles line up exactly across the two cards. */
		.gi-ic {
			width: 80px;
			height: 80px;
		}
		.gi-ic--legal {
			width: 80px;
			height: 80px;
		}
		.gi-grid .feat-h {
			font-size: 19px;
		}
		.gi-card .feat-p {
			font-size: 12px;
			line-height: 1.42;
		}
		/* Equal body height across both cards → the icon+title blocks match, so the icons centre to the
		   same level. Sized (relative, so it scales with the modal) to the taller Legal card's 3-paragraph
		   copy so it never clips. */
		.gi-body {
			min-height: clamp(126px, 34cqmin, 168px);
		}

		/* Page 7 — UI guide: larger icons and labels. Anchor the grid to the TOP (start) so the taller
		   title can never overlap the first row; a small padding-top keeps a clean gap below the title. */
		.ctrl-grid {
			gap: 11px 12px;
			align-content: start;
			padding-top: 6px;
		}
		.ctrl {
			gap: 4px;
			padding: 3px;
		}
		.ctrl-ic {
			width: 47px;
			height: 47px;
		}
		.ctrl-ic--lg {
			width: 51px;
			height: 51px;
		}
		.ctrl-name {
			font-size: 15px;
			margin-top: 6px;
		}
		.ctrl-desc {
			font-size: 11.5px;
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
			/* A touch shorter so the screen-corner close button sits ABOVE the panel, not over the cards. */
			height: min(820px, 84cqh);
			border-radius: clamp(10px, 2.6cqmin, 18px);
			padding: clamp(18px, 4.4cqmin, 34px) clamp(16px, 4cqmin, 30px) clamp(60px, 12cqmin, 78px);
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
		/* The desktop width is 34.4cqw because the design gives the logo a third of a LANDSCAPE frame.
		   In a portrait container cqw is the short side, so that same rule renders it at ~140px — the
		   single-column layout has the whole measure to give it instead. */
		.ov-hero {
			width: min(100%, clamp(200px, 62cqw, 430px));
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
			font-size: clamp(13px, 4cqmin, 22px);
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
			/* The frame art's lower rail is 23 of its 551px = 4.2% of the rendered card height, and
			   the base rule's 8-16px bottom padding is thinner than that at portrait sizes — which is
			   why the Wild magnet sat ON the rail. Clear it with room to spare. */
			padding: clamp(16px, 4cqmin, 30px) clamp(18px, 4.4cqmin, 34px) clamp(20px, 5cqmin, 34px);
			gap: clamp(6px, 1.6cqmin, 14px);
		}
		/* The base cap on this art exists only because the two cards share a SHORT column on desktop.
		   Portrait stacks them at natural height, so the magnet can be legible again — still well
		   under the tall cards' scatter, which is the visual hierarchy the page wants. */
		.feat-grid .feat-col-small .feat-ic {
			width: clamp(56px, 13cqmin, 96px);
		}
		/* Stack the four buy cards vertically — and drop the centred max-width, which only applies
		   to the four-across desktop row. */
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
			width: clamp(54px, 14.1cqmin, 74px);
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

		/* Page 6 (general info): inline icon + title headers, no card frames, stacked. */
		.gi-grid {
			grid-template-columns: 1fr;
			gap: clamp(14px, 3.4cqh, 28px);
		}
		.gi-card {
			background: none;
			border: none;
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
		.gi-body {
			display: contents;
		}

		/* Pages 3 & 5: the same card, with bigger icons + text and a roomier inset. */
		.feat-card {
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
		.feat-grid .feat-col-small .feat-card--wild .feat-p {
			font-size: clamp(14px, 3.5cqmin, 21px);
			line-height: 1.45;
			letter-spacing: 0.03em;
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
		/* Overrides the desktop 12.4%: in a 414-wide portrait panel the design's proportion leaves the
		   symbol column ~34px, where the art stops being identifiable. 11% is the widest the twelve
		   value columns will give up without "0.15x" wrapping. */
		.pt-table td.pt-sym,
		.pt-table th.pt-rank {
			width: clamp(24px, 11%, 54px);
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
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { GameInfoPage } from 'state-shared';

	type Props = {
		pages: GameInfoPage[];
		/** Shared chrome artwork reused across every page. */
		assets: {
			navArrowLeft: string;
			navArrowRight: string;
			navButton: string;
			/** Wooden plaque behind each overview stat. */
			statCard: string;
			/** Tall plaque behind each feature card. */
			featureCard: string;
			/** Leaf-decorated card frame behind the paytable WILD/SCATTER cards. */
			specialFrame: string;
			/** Portrait-orientation frame (wood + leaf corners, baked background). Enables the
			    dedicated portrait tutorial layout when present and the viewport is portrait. */
			framePortrait?: string;
		};
		/** When provided, renders a themed circular close button (top-right). */
		onClose?: () => void;
	};

	const props: Props = $props();

	let index = $state(0);

	// Card copy is sized in `cqw`, so it tracks the container's WIDTH but knows nothing about how
	// long the string is. Translations run much longer than the English source (Russian and German
	// especially) and simply grew past the card's bottom border. This shrinks the type on a card
	// until its content fits its own height — English is untouched because it already fits.
	const FIT_FLOOR = 0.62;
	function fitCardText(node: HTMLElement, dep?: unknown) {
		void dep;
		let raf = 0;
		const measure = () => {
			node.style.setProperty('--fit', '1');
			// A definite height is required for the comparison to mean anything; cards are stretched
			// flex items, so clientHeight is the row height and scrollHeight is the content height.
			if (node.clientHeight <= 0 || node.scrollHeight <= node.clientHeight + 1) return;
			let lo = FIT_FLOOR;
			let hi = 1;
			for (let i = 0; i < 7; i++) {
				const mid = (lo + hi) / 2;
				node.style.setProperty('--fit', String(mid));
				if (node.scrollHeight <= node.clientHeight + 1) lo = mid;
				else hi = mid;
			}
			node.style.setProperty('--fit', lo.toFixed(3));
		};
		// Coalesce with a "already queued" flag rather than cancel-and-reschedule. The card sits over
		// a live canvas whose layout ticks every frame, so the ResizeObserver fires every frame — and
		// cancelling the pending callback each time starved `measure`, which then never ran at all.
		let queued = false;
		let timer = 0;
		const run = () => {
			if (!queued) return;
			queued = false;
			measure();
		};
		const schedule = () => {
			if (queued) return;
			queued = true;
			// Belt and braces: rAF alone did not fire for these nodes (the modal mounts over a
			// canvas whose frame loop the browser can throttle), so back it with a timer. Whichever
			// lands first runs the measure; `queued` makes the other a no-op.
			raf = requestAnimationFrame(run);
			clearTimeout(timer);
			timer = setTimeout(run, 60) as unknown as number;
		};
		// Observe the card's box only — the font-size writes change children, not this element's
		// own size, so this cannot feed back into itself.
		const ro = new ResizeObserver(schedule);
		ro.observe(node);
		// Fallback metrics under-measure before the webfont lands, which would leave a card looking
		// fitted and then overflowing a moment later.
		if (typeof document !== 'undefined' && document.fonts?.ready) {
			document.fonts.ready.then(schedule).catch(() => {});
		}
		schedule();
		return {
			update: schedule,
			destroy: () => {
				cancelAnimationFrame(raf);
				clearTimeout(timer);
				ro.disconnect();
			},
		};
	}

	// Portrait tutorial layout: only when the game supplies a portrait frame and the viewport is
	// actually portrait. Desktop/landscape keep the existing wide carousel untouched.
	let isPortraitViewport = $state(false);
	onMount(() => {
		const mq = window.matchMedia('(orientation: portrait)');
		const update = () => (isPortraitViewport = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});
	const portrait = $derived(!!props.assets.framePortrait && isPortraitViewport);

	// Portrait-only: split a multi-card `features` page so the expanding-symbol card (the one with
	// reel images) gets its own screen and the bonus features (Deal It / All In) share the next.
	// Landscape/desktop keep the original single page — this only reshapes the list when portrait.
	const displayPages = $derived.by(() => {
		if (!portrait) return props.pages;
		const out: GameInfoPage[] = [];
		for (const p of props.pages) {
			if (p.kind === 'features' && (p.cards?.length ?? 0) > 1) {
				const withImages = (p.cards ?? []).filter((c) => c.images?.length);
				const rest = (p.cards ?? []).filter((c) => !c.images?.length);
				if (withImages.length) out.push({ ...p, cards: withImages });
				if (rest.length) out.push({ ...p, cards: rest });
			} else {
				out.push(p);
			}
		}
		return out;
	});

	const count = $derived(displayPages.length);
	const page = $derived(displayPages[Math.min(index, displayPages.length - 1)]);

	const go = (dir: number) => {
		index = Math.min(Math.max(index + dir, 0), count - 1);
	};

	/** Split `body` into plain/highlighted runs around every occurrence of `hl`.
	 * Inline `[[...]]` tokens in the text also highlight their content — used where the
	 * plain substring match would only cover part of a word (e.g. "3 Scatters"). */
	const highlightParts = (body: string, hl?: string) => {
		const parts: { text: string; hl: boolean }[] = [];
		const pushPlain = (seg: string) => {
			if (!seg) return;
			if (!hl) {
				parts.push({ text: seg, hl: false });
				return;
			}
			let i = 0;
			let idx = seg.indexOf(hl, i);
			while (idx !== -1) {
				if (idx > i) parts.push({ text: seg.slice(i, idx), hl: false });
				parts.push({ text: hl, hl: true });
				i = idx + hl.length;
				idx = seg.indexOf(hl, i);
			}
			if (i < seg.length) parts.push({ text: seg.slice(i), hl: false });
		};
		let i = 0;
		let open = body.indexOf('[[', i);
		while (open !== -1) {
			const close = body.indexOf(']]', open + 2);
			if (close === -1) break;
			pushPlain(body.slice(i, open));
			parts.push({ text: body.slice(open + 2, close), hl: true });
			i = close + 2;
			open = body.indexOf('[[', i);
		}
		pushPlain(body.slice(i));
		return parts.length ? parts : [{ text: body, hl: false }];
	};
</script>

{#if page && portrait}
	<!-- ===== Portrait tutorial (Figma 2585-4107): tall wood+leaf frame, stacked/centred content ===== -->
	<div class="pinfo-stage" style={`--frame:url('${props.assets.framePortrait}');`}>
		<div class="pinfo-frame"></div>

		{#if props.onClose}
			<button
				class="pinfo-close"
				style={`background-image:url('${props.assets.navButton}');`}
				onclick={props.onClose}
				aria-label="Close"
			>
				<span class="pinfo-close__x gold">✕</span>
			</button>
		{/if}

		<div class="pinfo-content">
			{#if page.kind === 'overview'}
				<h2 class="pinfo-title gold">{page.title}</h2>
				{#if page.body}
					<p class="pinfo-body">{#each highlightParts(page.body, page.highlight) as part}{#if part.hl}<span
								class="pinfo-hl gold">{part.text}</span>{:else}{part.text}{/if}{/each}</p>
				{/if}
				{#if page.image}
					<img class="pinfo-hero" src={page.image} alt="" />
				{/if}
			{:else if page.kind === 'uiguide'}
				<h2 class="pinfo-title gold">{page.title}</h2>
				<div class="uig__grid uig__grid--portrait">
					{#each page.cards ?? [] as item}
						<div class="uig__item">
							{#if item.icon}<img class="uig__icon uig__icon--portrait" src={item.icon} alt="" />{/if}
							<h3 class="uig__name uig__name--portrait gold">{item.title}</h3>
							<p class="uig__desc uig__desc--portrait">{item.text}</p>
						</div>
					{/each}
				</div>
			{:else if page.kind === 'features'}
				<h2 class="pinfo-title gold">{page.title}</h2>
				<div class="pfeat">
					{#each page.cards ?? [] as card, ci}
						{#if card.images?.length}
							<!-- Expanding symbol: gold-bordered box with subtitle + centred copy (Figma p.3/7) -->
							<div class="pfeat-box">
								<h3 class="pfeat-sub gold">{card.title}</h3>
								<p class="pfeat-text">{#each highlightParts(card.text, card.highlight) as p}{#if p.hl}<span
											class="gold">{p.text}</span>{:else}{p.text}{/if}{/each}</p>
							</div>
						{:else}
							<!-- Bonus feature: scatter badges + inline title, copy, divider between (Figma p.4/7) -->
							<section class="pfeat-sec" class:pfeat-sec--divided={ci > 0}>
								<div class="pfeat-headrow">
									{#if card.badge && card.badgeCount}
										<div class="pfeat-badges">
											{#each Array(card.badgeCount) as _}<img src={card.badge} alt="" />{/each}
										</div>
									{/if}
									<h3 class="pfeat-title gold">{card.title}</h3>
								</div>
								<p class="pfeat-text">{#each highlightParts(card.text, card.highlight) as p}{#if p.hl}<span
											class="gold">{p.text}</span>{:else}{p.text}{/if}{/each}</p>
							</section>
						{/if}
					{/each}
				</div>
			{:else if page.kind === 'cards'}
				{@const buyCards = (page.cards ?? []).some((c) => c.metric || c.footer)}
				<h2 class="pinfo-title gold">{page.title}</h2>
				{#if page.subtitle}<p class="pinfo-subtitle">{page.subtitle}</p>{/if}
				{#if buyCards}
					<!-- Feature buy: 2×2 grid of gold-bordered cards, icon/badges on the top border (Figma 6/7) -->
					<div class="pbuy-grid">
						{#each page.cards ?? [] as card}
							<article class="pbuy">
								{#if card.icon}<img class="pbuy__icon" src={card.icon} alt="" />{/if}
								<h3
									class="pbuy__title"
									class:gold={!card.theme || card.theme === 'gold'}
									class:buy__title--green={card.theme === 'green'}
									class:buy__title--purple={card.theme === 'purple'}
								>{card.title}</h3>
								<p class="pbuy__text">{card.text}</p>
								{#if card.metric}
									<div class="pbuy__cell">
										<span
											class="pbuy__label"
											class:gold={!card.theme || card.theme === 'gold'}
											class:buy__label--green={card.theme === 'green'}
											class:buy__label--purple={card.theme === 'purple'}
										>{card.metric.label}</span>
										<span class="pbuy__value">{card.metric.value}</span>
									</div>
								{/if}
								{#if card.footer?.length}
									<div class="pbuy__footer">
										{#each card.footer as f}
											<div class="pbuy__cell">
												<span
													class="pbuy__label"
													class:gold={!card.theme || card.theme === 'gold'}
													class:buy__label--green={card.theme === 'green'}
													class:buy__label--purple={card.theme === 'purple'}
												>{f.label}</span>
												<span class="pbuy__value">{f.value}</span>
											</div>
										{/each}
									</div>
								{/if}
							</article>
						{/each}
					</div>
				{:else}
					<!-- General info: icon + inline title sections with centred copy, divided (Figma 7/7) -->
					<div class="pfeat pfeat--info">
						{#each page.cards ?? [] as card, ci}
							<section class="pfeat-sec" class:pfeat-sec--divided={ci > 0}>
								<div class="pfeat-headrow">
									{#if card.icon}<img class="pfeat-icon" src={card.icon} alt="" />{/if}
									<h3 class="pfeat-title gold">{card.title}</h3>
								</div>
								<p class="pfeat-text">{#each highlightParts(card.text, card.highlight) as p}{#if p.hl}<span
											class="gold">{p.text}</span>{:else}{p.text}{/if}{/each}</p>
							</section>
						{/each}
					</div>
				{/if}
			{:else if page.kind === 'paytable'}
				<h2 class="pinfo-title gold">{page.title}</h2>
				<div class="ptable">
					<div class="ptable__row ptable__row--head">
						<span class="gold ptable__symhead">{page.payoutHead?.symbol ?? ''}</span>
						<span class="gold">{page.payoutHead?.cols?.[0] ?? '3'}</span>
						<span class="gold">{page.payoutHead?.cols?.[1] ?? '4'}</span>
						<span class="gold">{page.payoutHead?.cols?.[2] ?? '5'}</span>
					</div>
					{#each page.payouts ?? [] as row}
						<div class="ptable__row">
							<span class="ptable__sym">
								<img class:ptable__icon--round={row.premium} src={row.icon} alt={row.name} />
								{#if row.premium}<span class="ptable__name">{row.name}</span>{/if}
							</span>
							<span>{row.x3}</span>
							<span>{row.x4}</span>
							<span>{row.x5}</span>
						</div>
					{/each}
				</div>
				<div class="pinfo-specials">
					{#each page.cards ?? [] as card}
						<article class="pspecial" style={`background-image:url('${props.assets.specialFrame}');`}>
							{#if card.icon}<img class="pspecial__icon" src={card.icon} alt="" />{/if}
							<h3 class="pspecial__title gold">{card.title}</h3>
							<p class="pspecial__text">{card.text}</p>
						</article>
					{/each}
				</div>
			{:else if page.kind === 'paylines'}
				<h2 class="pinfo-title gold">{page.title}</h2>
				{#if page.note}<p class="pinfo-note">{page.note}</p>{/if}
				{#if page.image}<div class="pinfo-img"><img src={page.image} alt={page.title} /></div>{/if}
			{:else}
				<h2 class="pinfo-title gold">{page.title}</h2>
				<p class="pinfo-body">{page.body ?? ''}</p>
			{/if}
		</div>

		<nav class="pinfo-nav">
			<button
				class="pnav-btn pnav-btn--prev"
				style={`background-image:url('${props.assets.navButton}');`}
				disabled={index === 0}
				onclick={() => go(-1)}
				aria-label="Previous page"
			>
				<img src={props.assets.navArrowLeft} alt="" />
			</button>
			<span class="pinfo-nav__page gold">{index + 1}/{count}</span>
			<button
				class="pnav-btn"
				style={`background-image:url('${props.assets.navButton}');`}
				disabled={index === count - 1}
				onclick={() => go(1)}
				aria-label="Next page"
			>
				<img src={props.assets.navArrowRight} alt="" />
			</button>
		</nav>
	</div>
{:else if page}
	<div class="info-stage" style={`--frame:url('${page.frame}');`}>
		{#if page.background}
			<div class="info-bg" style={`background-image:url('${page.background}');`}></div>
		{/if}
		<div class="info-frame"></div>

		{#if props.onClose}
			<button
				class="info-close"
				style={`background-image:url('${props.assets.navButton}');`}
				onclick={props.onClose}
				aria-label="Close"
			>
				<span class="info-close__x gold">✕</span>
			</button>
		{/if}

		<div class="info-content">
			{#if page.kind === 'overview'}
				<div class="overview">
					<div class="overview__copy">
						<h2 class="info-title gold">{page.title}</h2>
						{#if page.body}
							<p class="overview__body">{#each highlightParts(page.body, page.highlight) as part}{#if part.hl}<span
										class="overview__hl gold">{part.text}</span>{:else}{part.text}{/if}{/each}</p>
						{/if}
					</div>

					{#if page.stats?.length}
						<div class="stats">
							{#each page.stats as stat}
								<div class="stat" style={`background-image:url('${props.assets.statCard}');`}>
									<img class="stat__icon" src={stat.icon} alt="" />
									<div class="stat__text">
										<span class="stat__value gold">{stat.value}</span>
										<span class="stat__label gold">{stat.label}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if page.kind === 'uiguide'}
				<div class="uig">
					<h2 class="info-title info-title--center gold">{page.title}</h2>
					<div class="uig__grid" use:fitCardText={page.cards}>
						{#each page.cards ?? [] as item}
							<div class="uig__item">
								{#if item.icon}<img class="uig__icon" src={item.icon} alt="" />{/if}
								<h3 class="uig__name gold">{item.title}</h3>
								<p class="uig__desc">{item.text}</p>
							</div>
						{/each}
					</div>
				</div>
			{:else if page.kind === 'features' || page.kind === 'cards'}
				<div class="features">
					<h2 class="info-title info-title--center gold">{page.title}</h2>
					{#if page.subtitle}<p class="info-subtitle">{page.subtitle}</p>{/if}
					<div class="cards" class:cards--center={page.kind === 'cards'}>
						{#each page.cards ?? [] as card}
							<article class="card" class:card--split={card.images?.length} class:card--buy={card.metric || card.footer} use:fitCardText={card.text}>
								{#if card.images?.length}
									<div class="card__main">
										<h3 class="card__title card__title--left gold">{card.title}</h3>
										<p class="card__text card__text--left">{#each highlightParts(card.text, card.highlight) as p}{#if p.hl}<span
													class="gold">{p.text}</span>{:else}{p.text}{/if}{/each}</p>
									</div>
									<div class="card__reels">
										{#each card.images as img}
											<img class="card__reel" src={img} alt="" />
										{/each}
									</div>
								{:else if card.metric || card.footer}
									<h3
										class="card__title buy__title"
										class:gold={!card.theme || card.theme === 'gold'}
										class:buy__title--green={card.theme === 'green'}
										class:buy__title--purple={card.theme === 'purple'}
									>{card.title}</h3>
									<p class="card__text card__text--center buy__desc">{card.text}</p>
									<div class="buy__art">
										{#if card.icon}<img src={card.icon} alt="" />{/if}
									</div>
									{#if card.metric}
										<div class="buy__metric">
											<span
												class="buy__label"
												class:gold={!card.theme || card.theme === 'gold'}
												class:buy__label--green={card.theme === 'green'}
												class:buy__label--purple={card.theme === 'purple'}
											>{card.metric.label}</span>
											<span class="buy__value">{card.metric.value}</span>
										</div>
									{/if}
									{#if card.footer?.length}
										<div class="buy__footer">
											{#each card.footer as f}
												<div class="buy__fcell">
													<span
														class="buy__label"
														class:gold={!card.theme || card.theme === 'gold'}
														class:buy__label--green={card.theme === 'green'}
														class:buy__label--purple={card.theme === 'purple'}
													>{f.label}</span>
													<span class="buy__value buy__value--sm">{f.value}</span>
												</div>
											{/each}
										</div>
									{/if}
								{:else}
									<header class="card__head">
										{#if card.icon}
											<img class="card__icon" src={card.icon} alt="" />
										{/if}
										<h3 class="card__title gold">{card.title}</h3>
										{#if card.badge && card.badgeCount}
											<div class="card__badges">
												{#each Array(card.badgeCount) as _}
													<img class="card__badge" src={card.badge} alt="" />
												{/each}
											</div>
										{/if}
										{#if card.price}
											<span class="card__price gold">{card.price}</span>
										{/if}
									</header>
									<p class="card__text card__text--center">{#each highlightParts(card.text, card.highlight) as p}{#if p.hl}<span
												class="gold">{p.text}</span>{:else}{p.text}{/if}{/each}</p>
								{/if}
							</article>
						{/each}
					</div>
				</div>
			{:else if page.kind === 'paytable'}
				<div class="paytable">
					<h2 class="info-title info-title--center gold">{page.title}</h2>
					<div class="paytable__grid">
						<div class="paytable__table">
							<div class="pay-row pay-row--head">
								<span class="gold pay-row__symhead">{page.payoutHead?.symbol ?? ''}</span>
								<span class="gold">{page.payoutHead?.cols?.[0] ?? '3'}</span>
								<span class="gold">{page.payoutHead?.cols?.[1] ?? '4'}</span>
								<span class="gold">{page.payoutHead?.cols?.[2] ?? '5'}</span>
							</div>
							{#each page.payouts ?? [] as row}
								<div class="pay-row">
									<span class="pay-row__sym">
										<img class:pay-row__icon--round={row.premium} src={row.icon} alt={row.name} />
										{#if row.premium}<span class="pay-row__name">{row.name}</span>{/if}
									</span>
									<span>{row.x3}</span>
									<span>{row.x4}</span>
									<span>{row.x5}</span>
								</div>
							{/each}
						</div>
						<div class="paytable__specials">
							{#each page.cards ?? [] as card}
								<article class="special" style={`background-image:url('${props.assets.specialFrame}');`}>
									{#if card.icon}
										<img class="special__icon" src={card.icon} alt="" />
									{/if}
									<h3 class="special__title gold">{card.title}</h3>
									<p class="special__text">{card.text}</p>
								</article>
							{/each}
						</div>
					</div>
				</div>
			{:else if page.kind === 'paylines'}
				<div class="paylines">
					<h2 class="info-title info-title--center gold">{page.title}</h2>
					{#if page.note}
						<p class="paylines__note">{page.note}</p>
					{/if}
					{#if page.image}
						<div class="paylines__img"><img src={page.image} alt={page.title} /></div>
					{/if}
				</div>
			{:else}
				<div class="placeholder">
					<h2 class="info-title info-title--center gold">{page.title}</h2>
					<p class="placeholder__hint">{page.body ?? 'Coming soon'}</p>
				</div>
			{/if}
		</div>

		<nav class="info-nav">
			<div class="info-nav__buttons">
				<button
					class="nav-btn nav-btn--prev"
					style={`background-image:url('${props.assets.navButton}');`}
					disabled={index === 0}
					onclick={() => go(-1)}
					aria-label="Previous page"
				>
					<img src={props.assets.navArrowLeft} alt="" />
				</button>
				<button
					class="nav-btn"
					style={`background-image:url('${props.assets.navButton}');`}
					disabled={index === count - 1}
					onclick={() => go(1)}
					aria-label="Next page"
				>
					<img src={props.assets.navArrowRight} alt="" />
				</button>
			</div>
			<span class="info-nav__page gold">Page {index + 1}/{count}</span>
		</nav>
	</div>
{/if}

<style lang="scss">
	/* Aspect matches the frame artwork (1400x934 ≈ 3:2) so the wooden border isn't stretched wide,
	   the background isn't cropped under the branches, and the nav fits inside the frame. */
	.info-stage {
		position: relative;
		width: min(97vw, calc((100dvh - 1.5rem) * 1.5));
		aspect-ratio: 1400 / 934;
		container-type: inline-size;
		font-family: 'Cinzel', 'EB Garamond', serif;
	}

	/* Background fills the frame OPENING (inset to where the wooden rails sit, so it stays inside
	   the frame and doesn't spill over the border). The opening is slightly wider-aspect than the
	   art, so `cover` overflows vertically — anchored to the top, it crops the lower foliage rather
	   than the animals' heads, keeping the gang fully visible inside the frame. */
	.info-bg {
		position: absolute;
		inset: 8% 6% 13% 6%;
		border-radius: 1cqw;
		background-size: cover;
		background-position: center top;
	}

	.info-frame {
		position: absolute;
		inset: 0;
		background-image: var(--frame);
		background-size: 100% 100%;
		background-repeat: no-repeat;
		pointer-events: none;
	}

	.info-close {
		position: absolute;
		top: 1.4%;
		right: -1.2%;
		width: 5cqw;
		height: 5cqw;
		border: none;
		padding: 0;
		background-color: transparent;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		transition: transform 0.12s ease;
	}

	.info-close:hover {
		transform: scale(1.06);
	}

	.info-close__x {
		font-family: 'Cinzel', serif;
		font-weight: 900;
		font-size: 2.2cqw;
		line-height: 1;
	}

	.info-content {
		position: absolute;
		inset: 13% 9% 24% 11%;
		display: flex;
		min-height: 0;
	}

	/* ---- shared text ---- */
	.gold {
		background-image: linear-gradient(180deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.info-title {
		margin: 0;
		font-weight: 900;
		letter-spacing: 0.03em;
		font-size: 3.3cqw;
		line-height: 1.1;
		text-transform: uppercase;
	}

	.info-title--center {
		text-align: center;
		width: 100%;
	}

	.info-subtitle {
		margin: 0.4cqw 0 0;
		width: 100%;
		text-align: center;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: 1.5cqw;
		letter-spacing: 0.03em;
	}

	/* ---- overview ---- */
	.overview {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		width: 100%;
		gap: 2cqw;
	}

	.overview__copy {
		max-width: 46%;
		display: flex;
		flex-direction: column;
		gap: 1.4cqw;
	}

	.overview__body {
		margin: 0;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-size: 1.25cqw;
		font-weight: 500;
		line-height: 1.5;
		white-space: pre-line;
	}

	.overview__hl {
		font-family: 'Cinzel', serif;
		font-weight: 700;
		font-size: 1.9cqw;
	}

	.stats {
		display: flex;
		gap: 1.2cqw;
		width: 100%;
		justify-content: space-between;
	}

	.stat {
		position: relative;
		flex: 0 0 15cqw;
		aspect-ratio: 196 / 122;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.9cqw;
		padding: 0 1cqw;
		background-size: 100% 100%;
		background-repeat: no-repeat;
	}

	.stat__icon {
		width: 4cqw;
		height: 4cqw;
		object-fit: contain;
		flex: none;
	}

	.stat__text {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	.stat__value {
		font-weight: 900;
		font-size: 1.7cqw;
		white-space: nowrap;
	}

	.stat__label {
		font-weight: 700;
		font-size: 0.95cqw;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	/* ---- features ---- */
	.features {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 1.6cqw;
	}

	.cards {
		display: flex;
		gap: 1.8cqw;
		justify-content: center;
		flex: 1;
		min-height: 0;
	}

	.card {
		position: relative;
		flex: 1 1 0;
		max-width: 27cqw;
		display: flex;
		flex-direction: column;
		gap: 1cqw;
		padding: 2cqw 1.8cqw;
		border: 0.16cqw solid rgba(214, 167, 74, 0.55);
		border-radius: 0.7cqw;
		box-shadow: inset 0 0 3cqw rgba(0, 0, 0, 0.3);
	}

	.cards--center .card {
		justify-content: center;
	}

	.card__head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8cqw;
	}

	.card__title {
		margin: 0;
		font-weight: 700;
		/* var(--fit) is driven by fitCardText: 1 for English, lower when a translation would
		   otherwise push the card's content past its bottom border. */
		font-size: calc(1.7cqw * var(--fit, 1));
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.card__badges {
		display: flex;
		gap: 0.4cqw;
	}

	.card__badge {
		width: 2.4cqw;
		height: 2.4cqw;
		object-fit: contain;
	}

	.card__text {
		margin: 0;
		color: #f3e4c4;
		font-family: 'Poppins', sans-serif;
		font-size: calc(1.15cqw * var(--fit, 1));
		line-height: 1.35;
		white-space: pre-line;
	}

	.card__icon {
		width: 4cqw;
		height: 4cqw;
		object-fit: contain;
	}

	/* Card 1: split layout — title + text on the left, reel images stacked on the right. */
	.card--split {
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 1.4cqw;
	}

	.card__main {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: 1cqw;
		min-width: 0;
	}

	.card__reels {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1cqw;
	}

	.card__reel {
		width: 4.5cqw;
		height: auto;
		object-fit: contain;
	}

	.card__title--left {
		text-align: left;
	}

	.card__text--center {
		text-align: center;
	}

	.card__text--left {
		text-align: left;
	}

	.card__price {
		font-weight: 900;
		font-size: calc(1.9cqw * var(--fit, 1));
		line-height: 1;
	}

	/* ---- feature buy cards ---- */
	.card--buy,
	.cards--center .card--buy {
		justify-content: flex-start;
		align-items: center;
		gap: 0.9cqw;
		padding: 2cqw 1.2cqw 1.6cqw;
		text-align: center;
	}

	.buy__title {
		font-size: calc(1.45cqw * var(--fit, 1));
		min-height: calc(3.4cqw * var(--fit, 1));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.buy__title--green,
	.buy__label--green {
		background-image: linear-gradient(180deg, #cdee82 10%, #8fbd45 90%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.buy__title--purple,
	.buy__label--purple {
		background-image: linear-gradient(180deg, #cdaef2 10%, #9166cf 90%);
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	/* Fixed-height title + description zones so the icon, metric and footer rows line up
	   horizontally across all four cards regardless of how many lines each description wraps to. */
	.buy__desc {
		font-size: calc(1cqw * var(--fit, 1));
		line-height: 1.35;
		min-height: calc(4.3cqw * var(--fit, 1));
	}

	.buy__art {
		height: 7cqw;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
	}

	.buy__art img {
		max-width: 100%;
		max-height: 6.5cqw;
		object-fit: contain;
	}

	.buy__metric {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2cqw;
	}

	.buy__label {
		font-weight: 700;
		font-size: 1cqw;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.buy__value {
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		color: #f6ecd4;
		font-size: 1.2cqw;
		line-height: 1;
	}

	.buy__value--sm {
		font-size: 1.05cqw;
	}

	.buy__footer {
		margin-top: auto;
		display: flex;
		gap: 1.6cqw;
		justify-content: center;
		width: 100%;
	}

	.buy__fcell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2cqw;
	}

	/* ---- paytable ---- */
	.paytable {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 1.4cqw;
	}

	.paytable__grid {
		display: grid;
		grid-template-columns: 1.4fr 0.92fr;
		gap: 2.5cqw;
		flex: 1;
		min-height: 0;
		padding-right: 1.5cqw;
	}

	.paytable__table {
		display: flex;
		flex-direction: column;
		font-family: 'Poppins', sans-serif;
		border: 0.16cqw solid rgba(214, 167, 74, 0.5);
		border-radius: 0.7cqw;
		overflow: hidden;
	}

	/* Figma: body cells are Poppins 500 16px (1.33cqw), #FFD89C, 0.03em tracking, centered. */
	.pay-row {
		display: grid;
		grid-template-columns: 1.7fr 1fr 1fr 1fr;
		align-items: center;
		flex: 1 1 0;
		min-height: 0;
		color: #ffd89c;
		font-size: 1.33cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		border-bottom: 1px solid rgba(255, 216, 156, 0.16);
	}

	.pay-row:last-child {
		border-bottom: none;
	}

	.pay-row > span {
		padding: 0.28cqw 0.7cqw;
		text-align: center;
		border-left: 1px solid rgba(255, 216, 156, 0.16);
	}

	.pay-row__sym,
	.pay-row__symhead {
		border-left: none !important;
		text-align: left !important;
	}

	/* Figma: Cinzel 700 16px (1.33cqw of the 1200px frame), 0.03em tracking, centered, golden
	   gradient (via .gold on the spans). */
	.pay-row--head {
		font-family: 'Cinzel', serif;
		font-weight: 700;
		font-size: 1.33cqw;
		letter-spacing: 0.03em;
		border-bottom: 1px solid rgba(255, 216, 156, 0.35);
	}
	.pay-row--head .pay-row__symhead {
		text-align: center !important;
	}
	.pay-row--head > span {
		white-space: nowrap;
		padding-inline: 0.2cqw;
	}

	/* The cell stretches to the full row (align-self overrides the row's centring) and the
	   icon is absolutely positioned inside it: absolute children resolve % heights against the
	   USED row height, so icons scale with the row and can never overlap neighbouring rows. */
	.pay-row__sym {
		display: flex;
		align-items: center;
		gap: 0.8cqw;
		position: relative;
		align-self: stretch;
	}

	.pay-row__sym img {
		position: absolute;
		left: 0.7cqw;
		top: 50%;
		transform: translateY(-50%);
		height: 65%;
		width: auto;
		max-width: 3.95cqw;
		object-fit: contain;
	}

	/* Premium rows use the landscape framed card art (324x248, colored frame baked in) as a
	   wide thumbnail — per the Figma paytable. Class name kept for template compatibility. */
	.pay-row__sym img.pay-row__icon--round {
		height: 87%;
		width: auto;
		max-width: 7.85cqw;
		border-radius: 0.3cqw;
	}

	/* Clear the widest (premium) icon so names line up in a column. */
	.pay-row__name {
		margin-left: 8.6cqw;
	}

	/* Figma: symbol names are Cinzel 700 12px (1cqw of the 1200px frame), #FFD89C, 0.03em. */
	.pay-row__name {
		font-family: 'Cinzel', serif;
		font-weight: 700;
		font-size: 1cqw;
		letter-spacing: 0.03em;
		color: #ffd89c;
	}

	.paytable__specials {
		display: flex;
		flex-direction: column;
		gap: 2.5cqw;
		min-height: 0;
	}

	.special {
		position: relative;
		flex: 1 1 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 0.7cqw;
		padding: 5.5cqw 3cqw 2cqw;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		text-align: center;
	}

	/* Coin straddles the top border of the card, like the design. */
	.special__icon {
		position: absolute;
		top: -2.6cqw;
		left: 50%;
		transform: translateX(-50%);
		width: 6.5cqw;
		height: 6.5cqw;
		object-fit: contain;
	}

	.special__title {
		margin: 0;
		font-weight: 700;
		font-size: 1.5cqw;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.special__text {
		margin: 0;
		color: #f3e4c4;
		font-family: 'Poppins', sans-serif;
		font-size: 1.05cqw;
		line-height: 1.3;
	}

	/* ---- paylines ---- */
	.paylines {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		gap: 1cqw;
		min-height: 0;
	}

	.paylines__note {
		margin: 0;
		max-width: 80%;
		text-align: center;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-size: 1.2cqw;
		line-height: 1.35;
	}

	.paylines__img {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.paylines__img img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	/* ---- uiguide (HUD button reference grid) ---- */
	.uig {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2.4cqw;
		width: 100%;
	}
	.uig__grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		/* Gaps shrink with the type: in Finnish the labels wrap to more lines and the grid grew
		   past the frame even after the font came down. */
		gap: calc(3.2cqw * var(--fit, 1)) 2cqw;
		width: 88%;
		/* Bound the grid so fitCardText has a definite height to fit into. */
		min-height: 0;
		flex: 1 1 auto;
	}
	.uig__item {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: calc(0.9cqw * var(--fit, 1));
	}
	.uig__icon {
		width: 6.4cqw;
		height: 6.4cqw;
		object-fit: contain;
		filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
	}
	.uig__name {
		font-family: 'Cinzel', serif;
		font-weight: 700;
		font-size: calc(1.7cqw * var(--fit, 1));
		letter-spacing: 0.06em;
		margin: 0;
	}
	.uig__desc {
		font-family: 'Poppins', sans-serif;
		font-size: calc(1.35cqw * var(--fit, 1));
		font-weight: 500;
		font-style: normal;
		line-height: normal;
		letter-spacing: 0.03em;
		text-align: center;
		color: #ffd89c;
		margin: 0;
	}
	/* Portrait tutorial layout: 2-column grid with larger touch-friendly items. */
	.uig__grid--portrait {
		grid-template-columns: repeat(2, 1fr);
		gap: 4cqw 3cqw;
		width: 92%;
		margin-inline: auto;
	}
	.uig__icon--portrait { width: 12cqw; height: 12cqw; }
	.uig__name--portrait { font-size: 3.2cqw; }
	.uig__desc--portrait { font-size: 2.6cqw; }

	/* ---- placeholder ---- */
	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.4cqw;
		width: 100%;
	}

	.placeholder__hint {
		margin: 0;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-size: 1.5cqw;
		opacity: 0.8;
	}

	/* ---- nav ---- */
	.info-nav {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 14.5%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.info-nav__buttons {
		display: flex;
		gap: 0.5cqw;
	}

	.info-nav__page {
		position: absolute;
		right: 9%;
		font-weight: 700;
		font-size: 1.25cqw;
		letter-spacing: 0.05em;
		text-align: center;
	}

	.nav-btn {
		width: 5.5cqw;
		height: 5.5cqw;
		border: none;
		background-color: transparent;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: transform 0.12s ease, opacity 0.12s ease;
	}

	.nav-btn img {
		width: 42%;
		height: 42%;
		object-fit: contain;
	}

	.nav-btn--prev img {
		transform: scaleX(-1);
	}

	.nav-btn:not(:disabled):hover {
		transform: scale(1.06);
	}

	.nav-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	/* ===================== Portrait tutorial (Figma 2585-4107) ===================== */
	/* Tall wood+leaf frame (baked background) sized to the portrait viewport; content is stacked
	   and centred inside the wooden interior. All sizes use cqw so they scale with the frame. */
	.pinfo-stage {
		position: relative;
		/* Frame art is 1024×1536 (2:3). Fit height first, cap by width. */
		width: min(94vw, calc((100dvh - 1rem) * 0.6667));
		aspect-ratio: 1024 / 1536;
		container-type: inline-size;
		font-family: 'Cinzel', 'EB Garamond', serif;
	}

	.pinfo-frame {
		position: absolute;
		inset: 0;
		background-image: var(--frame);
		background-size: 100% 100%;
		background-repeat: no-repeat;
		pointer-events: none;
	}

	.pinfo-close {
		position: absolute;
		top: -3%;
		right: -3%;
		width: 11cqw;
		height: 11cqw;
		border: none;
		padding: 0;
		background-color: transparent;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3;
		transition: transform 0.12s ease;
	}
	.pinfo-close:hover { transform: scale(1.06); }
	.pinfo-close__x { font-family: 'Cinzel', serif; font-weight: 900; font-size: 4.6cqw; line-height: 1; }

	/* Content lives inside the wooden opening, clear of the leaf corners and the bottom nav. */
	.pinfo-content {
		position: absolute;
		inset: 10% 11% 15.5% 11%;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 3cqw;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.pinfo-title {
		margin: 0;
		flex-shrink: 0;
		font-weight: 900;
		font-size: 6.2cqw;
		letter-spacing: 0.03em;
		line-height: 1.1;
		text-transform: uppercase;
	}

	.pinfo-subtitle {
		margin: 0.6cqw 0 0;
		flex-shrink: 0;
		text-align: center;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: 2.4cqw;
		letter-spacing: 0.03em;
	}

	.pinfo-body {
		margin: 0;
		max-width: 86%;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-size: 2.2cqw;
		font-weight: 500;
		line-height: 1.65;
		white-space: pre-line;
	}
	.pinfo-hl { font-family: 'Cinzel', serif; font-weight: 700; font-size: 4.3cqw; }

	/* Character group art fills the empty lower wood on the overview page (pushed to the bottom). */
	.pinfo-hero { width: 60cqw; max-width: 70%; height: auto; object-fit: contain; margin-top: auto; }

	/* ---- portrait feature / cards ---- */
	.pinfo-cards { display: flex; flex-direction: column; gap: 3cqw; width: 100%; }
	.pcard {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.6cqw;
		padding: 3cqw;
		border: 0.4cqw solid rgba(214, 167, 74, 0.5);
		border-radius: 2cqw;
		box-shadow: inset 0 0 4cqw rgba(0, 0, 0, 0.3);
	}
	.pcard__head { display: flex; flex-direction: column; align-items: center; gap: 1.4cqw; }
	.pcard__icon { width: 10cqw; height: 10cqw; object-fit: contain; }
	.pcard__title { margin: 0; font-weight: 700; font-size: 4cqw; text-transform: uppercase; letter-spacing: 0.04em; }
	.pcard__badges { display: flex; gap: 1cqw; }
	.pcard__badge { width: 6cqw; height: 6cqw; object-fit: contain; }
	.pcard__price { font-weight: 900; font-size: 4.4cqw; }
	.pcard__reels { display: flex; gap: 2cqw; justify-content: center; }
	.pcard__reel { width: 12cqw; height: auto; object-fit: contain; }
	.pcard__text {
		margin: 0;
		color: #f3e4c4;
		font-family: 'Poppins', sans-serif;
		font-size: 2.7cqw;
		line-height: 1.4;
		white-space: pre-line;
	}
	.pcard__metric { display: flex; flex-direction: column; align-items: center; gap: 0.5cqw; }
	.pcard__mlabel { font-weight: 700; font-size: 2.6cqw; letter-spacing: 0.05em; text-transform: uppercase; }
	.pcard__mvalue { font-family: 'Poppins', sans-serif; font-weight: 700; color: #f6ecd4; font-size: 3cqw; line-height: 1; }
	.pcard__mvalue--sm { font-size: 2.6cqw; }
	.pcard__footer { display: flex; gap: 5cqw; justify-content: center; }
	.pcard__fcell { display: flex; flex-direction: column; align-items: center; gap: 0.4cqw; }

	/* ---- portrait features (Figma 3/7 & 4/7) ---- */
	.pfeat { display: flex; flex-direction: column; gap: 4cqw; width: 100%; flex: 1 1 auto; min-height: 0; padding: 0 2cqw 4cqw; box-sizing: border-box; }
	/* Expanding-symbol card: tall gold-outlined wooden box (fills the frame) with the copy at the top.
	   Its own side margin keeps the box clear of the rails without narrowing the plain section text. */
	.pfeat-box {
		flex: 1 1 auto;
		margin: 0 4.5cqw;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 4cqw;
		padding: 6cqw 5cqw;
		border: 0.4cqw solid rgba(214, 167, 74, 0.7);
		border-radius: 2cqw;
		box-shadow: inset 0 0 4cqw rgba(0, 0, 0, 0.3);
	}
	.pfeat-icon { width: 5.5cqw; height: 5.5cqw; object-fit: contain; }
	.pfeat-sub { margin: 0; font-weight: 700; font-size: 3.6cqw; text-transform: uppercase; letter-spacing: 0.05em; }
	/* Bonus feature sections stacked with a divider between them. */
	.pfeat-sec { display: flex; flex-direction: column; align-items: center; gap: 2cqw; width: 100%; }
	.pfeat-sec--divided { border-top: 1px solid rgba(255, 216, 156, 0.25); padding-top: 4cqw; }
	.pfeat-headrow { display: flex; align-items: center; justify-content: center; gap: 2cqw; }
	.pfeat-badges { display: flex; gap: 0.6cqw; }
	.pfeat-badges img { width: 5cqw; height: 5cqw; object-fit: contain; }
	.pfeat-title { margin: 0; font-weight: 700; font-size: 3.4cqw; text-transform: uppercase; letter-spacing: 0.04em; }
	.pfeat-text {
		margin: 0;
		color: #ffd89c;
		font-family: 'Poppins', sans-serif;
		font-size: 2.5cqw;
		font-weight: 500;
		line-height: 1.7;
		white-space: pre-line;
		text-align: center;
	}
	/* GENERAL INFO page carries the most copy (interrupted rounds + legal notice + copyright) —
	   tighter type/spacing so the full text stays visible on small phones instead of half-clipping
	   at the scroll edge. */
	.pfeat--info { gap: 2cqw; padding-bottom: 1cqw; }
	.pfeat--info .pfeat-sec { gap: 1.2cqw; }
	.pfeat--info .pfeat-sec--divided { padding-top: 2cqw; }
	.pfeat--info .pfeat-headrow { gap: 1.4cqw; }
	.pfeat--info .pfeat-icon { width: 4.4cqw; height: 4.4cqw; }
	.pfeat--info .pfeat-title { font-size: 3cqw; }
	.pfeat--info .pfeat-text { font-size: 2.2cqw; line-height: 1.45; }

	/* ---- portrait feature buy: 2×2 grid of bordered cards, icon on the top border (Figma 6/7) ---- */
	.pbuy-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-auto-rows: 1fr;
		gap: 6cqw 3.5cqw;
		width: 100%;
		margin-top: 5cqw;
		padding: 0 4.5cqw 4cqw;
		box-sizing: border-box;
		flex: 1 1 auto;
		min-height: 0;
	}
	.pbuy {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.6cqw;
		padding: 8cqw 2.5cqw 3cqw;
		border: 0.35cqw solid rgba(214, 167, 74, 0.7);
		border-radius: 2cqw;
		box-shadow: inset 0 0 3cqw rgba(0, 0, 0, 0.3);
		text-align: center;
	}
	.pbuy__icon { position: absolute; top: -5.5cqw; left: 50%; transform: translateX(-50%); height: 10cqw; width: auto; max-width: 75%; object-fit: contain; }
	.pbuy__title { margin: 0; font-weight: 700; font-size: 2.9cqw; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.12; }
	.pbuy__text { margin: 0; color: #f3e4c4; font-family: 'Poppins', sans-serif; font-size: 2cqw; line-height: 1.35; }
	.pbuy__cell { display: flex; flex-direction: column; align-items: center; gap: 0.3cqw; }
	.pbuy__label { font-weight: 700; font-size: 2.2cqw; letter-spacing: 0.05em; text-transform: uppercase; }
	.pbuy__value { font-family: 'Poppins', sans-serif; font-weight: 700; color: #f6ecd4; font-size: 2.3cqw; line-height: 1; }
	.pbuy__footer { display: flex; gap: 3.5cqw; justify-content: center; margin-top: auto; padding-top: 1cqw; }

	/* ---- portrait paytable ---- */
	/* flex-shrink:0 so the whole 10-row table renders — otherwise, as a shrinkable flex item in an
	   overflowing column, its overflow:hidden border clips every row after the first. */
	.ptable {
		width: 94%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		font-family: 'Poppins', sans-serif;
		border: 0.35cqw solid rgba(214, 167, 74, 0.5);
		border-radius: 1.6cqw;
		overflow: hidden;
	}
	.ptable__row {
		display: grid;
		grid-template-columns: 1.7fr 1fr 1fr 1fr;
		align-items: center;
		color: #ffd89c;
		font-size: 2.2cqw;
		font-weight: 500;
		letter-spacing: 0.03em;
		border-bottom: 1px solid rgba(255, 216, 156, 0.16);
	}
	.ptable__row:last-child { border-bottom: none; }
	.ptable__row > span { padding: 0.3cqw 1cqw; text-align: center; border-left: 1px solid rgba(255, 216, 156, 0.16); }
	.ptable__sym, .ptable__symhead { border-left: none !important; text-align: left !important; }
	.ptable__row--head { font-family: 'Cinzel', serif; font-weight: 700; font-size: 2.1cqw; letter-spacing: 0.03em; border-bottom: 1px solid rgba(255, 216, 156, 0.35); }
	.ptable__row--head .ptable__symhead { text-align: center !important; }
	.ptable__row--head span { white-space: nowrap; }
	.ptable__sym { display: flex; align-items: center; gap: 1.6cqw; }
	.ptable__sym img { width: 4cqw; height: 4cqw; object-fit: contain; flex: none; }
	/* Premium rows: landscape framed card art as a wide thumbnail (see .pay-row__icon--round). */
	.ptable__sym img.ptable__icon--round { width: 7cqw; height: 5.4cqw; object-fit: contain; border-radius: 0.6cqw; }
	.ptable__name { font-family: 'Cinzel', serif; font-weight: 700; font-size: 1.7cqw; letter-spacing: 0.03em; color: #ffd89c; }

	/* Two special cards side by side (WILD | SCATTER), each on the leaf-decorated frame. */
	.pinfo-specials { display: flex; flex-direction: row; gap: 3.5cqw; width: 100%; margin-top: 3cqw; flex-shrink: 0; }
	.pspecial {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2cqw;
		padding: 8cqw 4cqw 4cqw;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		text-align: center;
	}
	.pspecial__icon { position: absolute; top: -5cqw; left: 50%; transform: translateX(-50%); width: 11cqw; height: 11cqw; object-fit: contain; }
	.pspecial__title { margin: 0; font-weight: 700; font-size: 3cqw; text-transform: uppercase; letter-spacing: 0.03em; }
	.pspecial__text { margin: 0; color: #f3e4c4; font-family: 'Poppins', sans-serif; font-size: 2cqw; line-height: 1.32; }

	/* ---- portrait paylines / placeholder ---- */
	.pinfo-note { margin: 0; max-width: 80%; color: #ffd89c; font-family: 'Poppins', sans-serif; font-size: 2.8cqw; line-height: 1.4; }
	/* Side/bottom padding keeps the payline grid clear of the wooden rails and bottom leaves. */
	.pinfo-img { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; width: 100%; padding: 2cqw 5cqw 5cqw; box-sizing: border-box; }
	.pinfo-img img { max-width: 100%; max-height: 100%; object-fit: contain; }

	/* ---- portrait nav ---- */
	/* Sits on the clear central wood, above/inside the corner leaf clusters — buttons pulled inward
	   and raised so the prev arrow isn't tucked behind the bottom-left leaves. */
	.pinfo-nav {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 7%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5cqw;
		z-index: 3;
	}
	.pinfo-nav__page { font-weight: 700; font-size: 3.4cqw; letter-spacing: 0.05em; text-align: center; }
	.pnav-btn {
		width: 12cqw;
		height: 12cqw;
		border: none;
		background-color: transparent;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		transition: transform 0.12s ease, opacity 0.12s ease;
	}
	.pnav-btn img { width: 42%; height: 42%; object-fit: contain; }
	.pnav-btn--prev img { transform: scaleX(-1); }
	.pnav-btn:not(:disabled):hover { transform: scale(1.06); }
	.pnav-btn:disabled { opacity: 0.35; cursor: default; }
</style>

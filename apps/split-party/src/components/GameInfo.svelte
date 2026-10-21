<script lang="ts">
	// Seven-page game info, laid out from Figma 4504:4289 (Overview), 9076:28194 (Paytable),
	// 9185:16973 (Features), 4453:7579 (Ways to Win), 4453:7151 (Feature Buy), 4214:3232
	// (General Info) and 9185:16585 (UI Guide). The design's copy is Magnetic's placeholder
	// (wilds, Polarity Shifter, Drop-O-Magnet), so every page keeps the layout and takes its
	// content from Blob Split's math: paytable.json, MODES and the RULE/BONUSRULE copy.
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Blob from './Blob.svelte';
	import paytable from '../lib/paytable.json';
	import { MODES, type Mode } from '../lib/model';

	let {
		tr,
		start = 0,
		portrait: tall = false,
		stage,
		fit,
		view,
		onclose,
	}: {
		tr: (key: string) => string;
		start?: number;
		portrait?: boolean;
		stage: { w: number; h: number };
		fit: number;
		view: { w: number; h: number };
		onclose: () => void;
	} = $props();

	// Theoretical RTP per bet mode, from the math's per-mode stats (every mode 96.00%, max
	// 20,000x); Stake asks for each buyable/activatable mode's RTP in the rules.
	const RTP_BY_MODE: Record<Mode, string> = {
		base: '96.00%',
		extra_chance: '96.00%',
		feature: '96.00%',
		normal: '96.00%',
		super: '96.00%',
		mystery: '96.00%',
	};
	const RTP = RTP_BY_MODE.base;
	// Landscape page 5: a language that wraps long (ja, zh, …) can grow the cards past the
	// pager; the row then scales down to the room left above it, top-anchored.
	const PAGER_ROOM = 62;
	let buys = $state<HTMLElement>();
	let buysK = $state(1);
	$effect(() => {
		if (!buys || portrait) return void (buysK = 1);
		const page = buys.closest('.info-page') as HTMLElement | null;
		if (!page) return;
		const room = page.clientHeight - PAGER_ROOM - buys.offsetTop;
		buysK = Math.min(1, room / buys.offsetHeight);
	});
	const MAX_WIN = '20,000';
	const PAGES = 7;
	const BUYS: Mode[] = ['extra_chance', 'feature', 'normal', 'super', 'mystery'];
	// The Extra feature card's copy keys (its bet mode is extra_chance).
	const KEY: Partial<Record<Mode, string>> = { extra_chance: 'EXTRA' };
	const key = (mode: Mode) => KEY[mode] ?? mode.toUpperCase();
	const BONUSES = [
		['NORMAL', 3],
		['SUPER', 4],
		['HIDDEN', 5],
	] as const;
	const BASKETS = [
		['3', '2'],
		['4', '10'],
		['5+', '50'],
	];
	// Portrait is Figma 11096:43029's phone frames, drawn in the design's own units: a 360-wide
	// stage whose 577px game area grows with tall phones (--ex), the panel growing with it.
	// Short landscapes (phones on their side, popouts) would shrink the 950px landscape panel's
	// copy to 4-6px, so they take the phone layout too, cut to a 430px-high stage beside empty
	// sides: about 0.9x of the phone design on a landscape phone. Any landscape that would draw
	// the desktop panel under 0.8x (Popout-L 760×520 drew it at 0.63x: 5-7px copy, R-13) takes
	// it as well; 1200×670 and a 1024×768 tablet keep the desktop panel.
	const DESKTOP_MIN_FIT = 0.8;
	let compact = $derived(!tall && (view.h <= 500 || fit < DESKTOP_MIN_FIT));
	let portrait = $derived(tall || compact);
	// A popout (225px high) cuts the stage to 300 instead, so the copy still reads at 9px.
	let phone = $derived({
		w: 360,
		h: compact ? (view.h <= 340 ? 300 : 430) : Math.max(577, (360 * view.h) / view.w),
	});
	let box = $derived(portrait ? phone : stage);
	let scale = $derived(portrait ? Math.min(view.w / phone.w, view.h / phone.h) : fit);
	let ex = $derived(compact ? 0 : portrait ? phone.h - 577 : stage.h - 940);
	// The phone paytable keeps the design's narrow table: four bands beside each symbol.
	const BAND_SETS = [0, 4, 8].map((from) => [from, from + 4] as const);
	let page = $state(start);
	let dir = $state(1);
	const go = (d: number) => {
		dir = d;
		page = (page + d + PAGES) % PAGES;
	};
	function keys(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') go(1);
		else if (event.key === 'ArrowLeft') go(-1);
	}
	const odds = (v: number) => `${v}×`;
	// Ways to Win example: three neighbouring KIWI tiles holding 1 + 2 + 2 = 5 units win, and each
	// winning tile then splits one level (2 + 3 + 3). The hit cells are the cluster.
	const DEMO = ['LEMON', 'KIWI', 'GRAPES', 'KIWI', 'KIWI', 'PLUM', 'CHERRIES', 'ORANGE', 'BLUEBERRY'];
	const DEMO_UNITS: Record<number, [number, number]> = { 1: [2, 3], 3: [1, 2], 4: [2, 3] };
	const GUIDE: { key: string; icon: string; desc: string }[] = [
		{ key: 'INFO CTRL SPIN', icon: 'spin', desc: 'INFO UI SPIN' },
		{ key: 'AUTOPLAY', icon: 'auto', desc: 'INFO UI AUTO' },
		{ key: 'TURBO', icon: 'turbo', desc: 'INFO UI TURBO' },
		{ key: 'INFO UI BET PLUS', icon: 'plus', desc: 'INFO CTRL PLUS' },
		{ key: 'INFO UI BET MINUS', icon: 'minus', desc: 'INFO CTRL MINUS' },
		{ key: 'INFO CTRL MENU', icon: 'menu', desc: 'INFO UI MENU' },
		{ key: 'SOUND', icon: 'sound', desc: 'INFO UI SOUND' },
		{ key: 'MUSIC', icon: 'music', desc: 'INFO UI MUSIC' },
		{ key: 'INFO', icon: 'info', desc: 'INFO UI INFO' },
		{ key: 'BONUS', icon: 'bonus', desc: 'INFO UI BONUS' },
		{ key: 'INFO UI PREV', icon: 'prev', desc: 'INFO UI PREV DESC' },
		{ key: 'INFO UI NEXT', icon: 'next', desc: 'INFO UI NEXT DESC' },
		{ key: 'INFO CTRL CLOSE', icon: 'close', desc: 'INFO UI CLOSE' },
	];
</script>

<svelte:window onkeydown={keys} />

<div
	class="info-stage"
	class:portrait
	class:compact
	class:tight={compact && view.h <= 340}
	style={`width:${box.w}px;height:${box.h}px;--ex:${ex}px;transform:translate(-50%,-50%) scale(${scale})`}
>
	<section class="info-panel" aria-roledescription="carousel">
		{#key page}
			<div
				class={`info-page p${page}`}
				role="group"
				aria-roledescription="slide"
				aria-label={`${page + 1} / ${PAGES}`}
				in:fly={{ x: 60 * dir, duration: 320, easing: cubicOut }}
			>
				{#if page === 0}
					<img class="peeker teal" src="./info/peeker-teal.webp" alt="" />
					<img class="peeker pink" src="./info/peeker-pink.webp" alt="" />
					<img class="info-logo" src="./info/logo.webp" alt="Blob Split" />
					<h2 id="modal-title">{tr('INFO OVERVIEW')}</h2>
					<div class="lead">
						<p>{tr('INFO OVERVIEW TEXT')}</p>
						<p>{tr('INFO OVERVIEW TEXT 2')}</p>
					</div>
					<dl class="facts">
						<dt>{tr('INFO MAX WIN')}</dt>
						<dd class="max">{MAX_WIN}× {tr('BET').toLowerCase()}</dd>
						<dt>{tr('INFO RTP')}</dt>
						<dd class="rtp">{RTP}</dd>
					</dl>
					{#if portrait}<span class="hero-blob"><Blob symbol="STRAWBERRY" uid="info-hero" /></span>{/if}
					<ul class="tiles">
						{#each [['grid', '7x7', 'INFO TILE REELS'], ['cluster', tr('INFO TILE CLUSTER'), 'INFO TILE WINS'], ['trophy', MAX_WIN, 'INFO TILE MAX'], ['rtp', RTP, 'RTP']] as [icon, big, small], i}
							<li class="card" style={`--i:${i}`}>
								<img src={`./info/tile-${icon}.webp`} alt="" /><span
									><b>{big}</b><small>{tr(small)}</small></span
								>
							</li>
						{/each}
					</ul>
				{:else if page === 1}
					<h2 id="modal-title">{tr('PAYTABLE')}</h2>
					{#if portrait}
						{#each BAND_SETS as [from, to], t}
							<table class="pay-list" style={`--i:${t}`}>
								{#if t === 0}<caption>{tr('INFO UNITS')}</caption>{/if}
								<thead
									><tr
										><th>{tr('INFO SYMBOL')}</th>{#each paytable.bands.slice(from, to) as band}<th>{band}</th>{/each}</tr
									></thead
								>
								<tbody
									>{#each Object.entries(paytable.symbols) as [symbol, awards]}<tr
											><th aria-label={symbol}
												><span class="pay-blob"><Blob {symbol} uid={`info-${t}-${symbol}`} /></span></th
											>{#each awards.slice(from, to) as value}<td>{odds(value)}</td>{/each}</tr
										>{/each}</tbody
								>
							</table>
						{/each}
					{:else}
					<div class="table-wrap">
						<table class="pay-grid">
							<thead
								><tr
									><th class="pad head pt-sym">{tr('INFO UNITS')}</th>{#each paytable.bands as band}<th
											class="pad head">{band}</th
										>{/each}</tr
								></thead
							>
							<tbody
								>{#each Object.entries(paytable.symbols) as [symbol, awards], r}<tr style={`--i:${r}`}
										><th class="pad head pt-sym" aria-label={symbol}
											><span class="pay-blob"><Blob {symbol} uid={`info-${symbol}`} /></span></th
										>{#each awards as value}<td class="pad">{odds(value)}</td>{/each}</tr
									>{/each}</tbody
							>
						</table>
					</div>
					{/if}
					<aside class="side">
						<div class="card">
							<h3>{tr('INFO BASKETS')}</h3>
							<span class="basket-blob"><Blob symbol="BASKET" uid="info-basket" /></span>
							<ul class="basket-pays">
								{#each BASKETS as [n, x]}<li><b>{n}</b> {odds(Number(x))}</li>{/each}
							</ul>
						</div>
						<div class="card">
							<h3>{tr('INFO SPLITS')}</h3>
							<p>{tr('INFO SPLITS TEXT')}</p>
						</div>
					</aside>
				{:else if page === 2}
					<h2 id="modal-title">{tr('INFO FEATURES')}</h2>
					<div class="features">
						<div class="feature-stack">
							<article class="card small" style="--i:0">
								<h3>{tr('INFO SPLITS')}</h3>
								<p>{tr('INFO SPLIT TEXT')}</p>
								<span class="feature-art"><Blob symbol="KIWI" units={4} uid="info-split" /></span>
							</article>
							<article class="card small" style="--i:1">
								<h3>{tr('INFO TUMBLE')}</h3>
								<p>{tr('INFO TUMBLE TEXT')}</p>
								<span class="feature-art"><Blob symbol="STRAWBERRY" uid="info-tumble" /></span>
							</article>
						</div>
						{#each BONUSES as [tier, n], i}
							<article class="card bonus" style={`--i:${i + 2}`}>
								<h3>{tr(tier)}</h3>
								<p>{tr(`INFO ${tier} TEXT`)}</p>
								<span class="egg-row"
									><b>{n}x</b><img src="./splash/egg.webp" alt="" /></span
								>
							</article>
						{/each}
					</div>
				{:else if page === 3}
					<h2 id="modal-title">{tr('INFO WAYS')}</h2>
					<div class="ways-row">
					<figure class="ways-demo" aria-hidden="true">
						{#each [0, 1] as after}
							{#if after}<span class="demo-arrow">→</span>{/if}
							<div class="demo-side">
								<div class="demo-grid">
									{#each DEMO as symbol, c}{@const hit = DEMO_UNITS[c]}<span class="demo-pad" class:hit
											><Blob {symbol} units={hit ? hit[after] : 1} uid={`info-demo-${after}-${c}`} /></span
										>{/each}
								</div>
								<span class="demo-sum">{after ? '2 + 3 + 3' : '1 + 2 + 2 = 5'}</span>
							</div>
						{/each}
					</figure>
					<div class="ways">
						{#each [1, 2, 3, 4, 5, 6] as n}<p>{tr(`INFO WAYS ${n}`)}</p>{/each}
					</div>
					</div>
				{:else if page === 4}
					<h2 id="modal-title">{tr('BUY BONUS')}</h2>
					<p class="buy-intro">{tr('INFO BUY INTRO')}</p>
					<div class="buys" bind:this={buys} style={buysK < 1 ? `scale:${buysK.toFixed(3)}` : ''}>
						{#each BUYS as mode, i}
							<article class="card" class:spin-mode={i < 2} style={`--i:${i}`}>
								<h3>{tr(key(mode))}</h3>
								<span class="fb-art">
									{#if mode === 'extra_chance'}
										<span class="feature-art"><Blob symbol="STRAWBERRY" uid="info-buy-extra" /></span>
									{:else if mode === 'feature'}
										<span class="feature-art"><Blob symbol="KIWI" units={3} uid="info-buy-feature" /></span>
									{:else if mode === 'mystery'}
										<img class="mystery" src="./ui/mystery.webp" alt="" />
									{:else}
										<span class="egg-row"
											><b>{mode === 'normal' ? 3 : 4}x</b><img src="./splash/egg.webp" alt="" /></span
										>
									{/if}
								</span>
								<p>{tr(`${key(mode)} DESC`)}</p>
								<b class="label">{tr('INFO PRICE')}</b>
								<b class="value">{MODES[mode]}x {tr('BET')}</b>
								<span class="mode-rtp">{tr('RTP')} {RTP_BY_MODE[mode]}</span>
							</article>
						{/each}
					</div>
				{:else if page === 5}
					<h2 id="modal-title">{tr('INFO GENERAL')}</h2>
					<div class="general">
						<article class="card" style="--i:0">
							<img class="gen-icon" src="./base/spin-arrow.svg" alt="" />
							<h3>{tr('INFO INTERRUPTED')}</h3>
							<p>{tr('INFO INTERRUPTED TEXT')}</p>
						</article>
						<article class="card wide" style="--i:1">
							<img class="gen-icon legal" src="./info/legal.webp" alt="" />
							<h3>{tr('INFO LEGAL')}</h3>
							<!-- Engine's General Game Disclaimer, verbatim. -->
							{#each [1, 2, 3] as n}<p>{tr(`INFO LEGAL BODY ${n}`)}</p>{/each}
							<p>{tr('INFO LEGAL COPYRIGHT')}</p>
						</article>
					</div>
				{:else}
					<h2 id="modal-title">{tr('INFO UI')}</h2>
					<ul class="guide">
						{#each GUIDE as g, i}
							<li style={`--i:${i}`}>
								<span class={`guide-icon gi-${g.icon}`} aria-hidden="true">
									{#if g.icon === 'spin'}<img src="./info/spin.svg" alt="" />
									{:else if g.icon === 'auto'}<img src="./base/auto.svg" alt="" /><small>{tr('AUTO')}</small>
									{:else if g.icon === 'turbo'}{#each ['normal', 'turbo', 'super'] as speed}<img src={`./base/speed-${speed}.webp`} alt="" />{/each}
									{:else if g.icon === 'plus' || g.icon === 'minus' || g.icon === 'menu'}<img
											src={`./base/${g.icon}.svg`}
											alt=""
										/>
									{:else if g.icon === 'sound'}<img src="./info/sound.svg" alt="" />
									{:else if g.icon === 'music'}<img src="./menu/music.svg" alt="" />
									{:else if g.icon === 'info'}<img src="./menu/info.svg" alt="" />
									{:else if g.icon === 'bonus'}<span class="bonus-pill">{tr('BONUS')}</span>
									{:else if g.icon === 'close'}<img src="./ui/close.svg" alt="" />
									{:else}<img src="./info/arrow.svg" alt="" />{/if}
								</span>
								<b>{tr(g.key)}</b>
								<span class="guide-desc">{tr(g.desc)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/key}
		<nav class="pager">
			<button class="round" aria-label={tr('INFO UI PREV')} onclick={() => go(-1)}
				disabled={portrait && page === 0}><img src="./info/arrow.svg" alt="" /></button
			><button class="round" aria-label={tr('INFO UI NEXT')} onclick={() => go(1)}
				><img class="next" src="./info/arrow.svg" alt="" /></button
			>
		</nav>
		<span class="page-count">{tr('INFO PAGE')} {page + 1}/{PAGES}</span>
	</section>
	<button class="screen-close" aria-label={tr('INFO CTRL CLOSE')} onclick={onclose}
		><img src="./ui/close.svg" alt="" /></button
	>
</div>

<style>
	.info-stage {
		position: absolute;
		left: 50%;
		top: 50%;
		transform-origin: 50% 50%;
	}
	.info-stage .screen-close {
		position: absolute;
		left: 1118px;
		top: 29px;
		right: auto;
		border-color: #a5a7ee;
	}
	.info-panel {
		position: absolute;
		left: 123px;
		top: 59px;
		width: 950px;
		height: 552px;
		box-sizing: border-box;
		overflow: hidden;
		border: 3px solid #522fa2;
		border-radius: 13px;
		background: #4b3981;
		color: #fff;
		font-family: 'Poppins', sans-serif;
		font-weight: 400;
		text-align: center;
		box-shadow: 0 24px 80px rgb(10 6 40 / 0.55);
		animation: panel-in 0.52s cubic-bezier(0.3, 1.45, 0.5, 1) both;
	}
	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(24px) scale(1.18, 0.7);
		}
		40% {
			opacity: 1;
		}
	}
	.info-page {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.pager,
	.page-count {
		z-index: 1;
	}
	h2 {
		margin: 30px 0 0;
		font: 400 35px/41px 'Coiny', sans-serif;
		letter-spacing: 1.05px;
		text-transform: uppercase;
	}
	h3 {
		margin: 0;
		font: 400 18px/1.15 'Coiny', sans-serif;
	}
	p {
		margin: 0;
	}
	ul,
	dl {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.card {
		box-sizing: border-box;
		border: 1px solid #7f7fd6;
		border-radius: 12px;
		background: #2f1b6c;
		animation: card-in 0.62s cubic-bezier(0.3, 1.45, 0.5, 1) calc(0.08s + var(--i, 0) * 0.07s) both;
	}
	.card p {
		font-size: 12px;
		line-height: 18px;
		white-space: pre-line;
		color: #d7d7d7;
	}

	/* Pager: Figma's 48px round buttons, 12px apart, under the content. */
	.pager {
		position: absolute;
		left: 50%;
		bottom: 19px;
		display: flex;
		gap: 12px;
		transform: translateX(-50%);
	}
	.round {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: 1px solid #a5a7ee;
		border-radius: 9999px;
		background: #3a3981;
		transition: transform 0.15s;
	}
	.round:hover {
		transform: scale(1.08);
	}
	.round:active {
		transform: scale(0.92, 0.86);
	}
	.round img {
		width: 18px;
		height: 14.73px;
	}
	.next {
		scale: -1 1;
	}
	.page-count {
		position: absolute;
		right: 23px;
		bottom: 22px;
		font-size: 12px;
		letter-spacing: 0.36px;
	}

	/* 1 · Overview */
	.peeker {
		position: absolute;
		pointer-events: none;
	}
	.peeker.teal {
		left: 30px;
		top: -40px;
		width: 147px;
		/* Hangs head-down from the panel's top edge, like the design. `transform` keeps the
		   flip separate from the sway, which animates the individual translate/rotate. */
		transform: rotate(180deg);
		animation: peek-down 3.6s ease-in-out infinite;
	}
	.peeker.pink {
		left: -40px;
		top: 400px;
		width: 187px;
		transform-origin: 30% 100%;
		animation: peek-up 4.2s ease-in-out -1.3s infinite;
	}
	@keyframes peek-down {
		50% {
			translate: 0 6px;
			rotate: -3deg;
		}
	}
	@keyframes peek-up {
		50% {
			translate: 4px -6px;
			rotate: 4deg;
		}
	}
	.info-logo {
		position: absolute;
		left: 775px;
		top: 4px;
		width: 190px;
		height: 95px;
	}
	.lead {
		display: grid;
		gap: 20px;
		max-width: 700px;
		margin: 47px auto 0;
		font-size: 15px;
		line-height: 20px;
	}
	.facts {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: center;
		align-items: center;
		gap: 12px 28px;
		margin-top: 36px;
		font-size: 14px;
	}
	.facts dt {
		text-align: right;
	}
	.facts dd {
		margin: 0;
		text-align: left;
	}
	.facts .max {
		font: 400 18px 'Coiny', sans-serif;
		color: #a5a7ee;
	}
	.facts .rtp {
		padding: 8px 32px;
		border: 1px solid #7f7fd6;
		border-radius: 8px;
		background: #2f1b6c;
		font-weight: 700;
		font-size: 13px;
	}
	.tiles {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		margin-top: 40px;
	}
	.tiles li {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 186px;
		height: 77px;
		padding: 0 14px 0 20px;
	}
	.tiles img {
		width: 44px;
		height: 44px;
	}
	.tiles span {
		display: grid;
		flex: 1;
	}
	.tiles b {
		font: 400 20px/1.1 'Coiny', sans-serif;
	}
	.tiles small {
		font-weight: 700;
		font-size: 12px;
	}

	/* 2 · Paytable: Figma's 46×38 pads, squeezed to 30px rows so ten symbols fit. */
	.table-wrap {
		position: absolute;
		left: 30px;
		top: 89px;
	}
	.pay-grid {
		border-spacing: 4px;
		font-size: 11px;
	}
	.pad {
		width: 46px;
		height: 29px;
		padding: 0;
		border-radius: 7px;
		background: #734ebb;
		font-weight: 400;
		white-space: nowrap;
	}
	.pad.head {
		border: 1px solid #734ebb;
		background: #462690;
		font-size: 12px;
	}
	thead .pad {
		height: 34px;
	}
	.pad.pt-sym {
		width: 85px;
		font-size: 11px;
		line-height: 1.2;
		text-transform: uppercase;
	}
	tbody tr {
		animation: row-in 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) calc(0.05s + var(--i) * 0.035s) both;
	}
	@keyframes row-in {
		from {
			opacity: 0;
			translate: -14px 0;
		}
	}
	.pay-blob {
		display: inline-block;
		width: 27px;
		height: 27px;
		vertical-align: middle;
	}
	.side {
		position: absolute;
		left: 735px;
		top: 56px;
		display: grid;
		gap: 6px;
		width: 192px;
	}
	.side .card {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 14px 12px;
	}
	.basket-blob {
		width: 54px;
		height: 54px;
	}
	.basket-pays {
		display: grid;
		gap: 4px;
		width: 100%;
		font-size: 13px;
		color: #b9f45f;
	}
	.basket-pays li {
		display: flex;
		justify-content: space-between;
		padding: 3px 14px;
		border-radius: 7px;
		background: #462690;
	}
	.basket-pays b {
		color: #fff;
	}

	/* 3 · Features */
	.features {
		display: flex;
		justify-content: center;
		gap: 9px;
		margin-top: 43px;
	}
	.feature-stack {
		display: grid;
		gap: 9px;
	}
	.features .card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 18px 14px 14px;
		gap: 10px;
	}
	.features .small {
		width: 191px;
		height: 163px;
		padding-top: 14px;
		gap: 6px;
	}
	.features .bonus {
		width: 208px;
		height: 335px;
		padding: 34px 20px 30px;
		gap: 22px;
	}
	.features .bonus p {
		flex: 1;
	}
	.feature-art {
		display: block;
		width: 52px;
		height: 52px;
	}
	/* The fixed-height cards: the art gives way when the copy runs a line longer (the split
	   card's scatter note). */
	.features .small .feature-art {
		flex: 0 1 52px;
		min-height: 34px;
		width: auto;
		aspect-ratio: 1;
	}
	.egg-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font: 700 24px 'Poppins', sans-serif;
	}
	.egg-row img {
		width: 58px;
		height: 58px;
		animation: egg-wobble 2.8s ease-in-out infinite;
	}
	@keyframes egg-wobble {
		0%,
		60%,
		100% {
			rotate: 0deg;
		}
		70% {
			rotate: -8deg;
		}
		80% {
			rotate: 7deg;
		}
		90% {
			rotate: -3deg;
		}
	}

	/* 4 · Ways to win: the cluster example (board pads + symbol art), then the rules. */
	/* Desktop: the example stacked on the left (before, arrow, after), the rules beside it. */
	.ways-row {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 40px;
		margin-top: 22px;
		padding: 0 40px;
	}
	.ways-demo {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 4px;
		margin: 0;
		direction: ltr;
	}
	.demo-side {
		display: grid;
		justify-items: center;
		gap: 6px;
	}
	.demo-grid {
		display: grid;
		grid-template-columns: repeat(3, 38px);
		gap: 3px;
		padding: 4px;
		border-radius: 8px;
		background: #202149;
	}
	.demo-pad {
		display: block;
		box-sizing: border-box;
		height: 32px;
		padding: 2px 5px;
		border: 1.5px solid transparent;
		border-radius: 5px;
		background: #3a3981;
		opacity: 0.45;
	}
	.demo-pad.hit {
		border-color: #b9f45f;
		background: #4f4aa8;
		opacity: 1;
	}
	.demo-sum {
		font: 400 15px/1.1 'Coiny', sans-serif;
		color: #b9f45f;
	}
	.demo-arrow {
		font: 400 26px/1 'Coiny', sans-serif;
		color: #fff;
		rotate: 90deg;
	}
	.ways {
		display: grid;
		gap: 12px;
		max-width: 560px;
		font-size: 14px;
		line-height: 20px;
		text-align: left;
	}

	/* 5 · Feature buy */
	.buy-intro {
		max-width: 600px;
		margin: 14px auto 0;
		font-size: 15px;
		line-height: 20px;
	}
	.buys {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 14px;
	}
	.buys .card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 176px;
		/* Grows with the copy (the Mystery odds run to ~10 lines); the row stretches every card
		   to the tallest one. */
		min-height: 307px;
		padding: 12px 14px 10px;
	}
	/* Art right under the name, the same height in every card, so the copy runs below it and
	   the cost line can never collide with it (the Mystery orb sat on COST at 1200×670). */
	.buys p {
		margin-bottom: 8px;
		font-size: 12px;
		line-height: 15px;
	}
	.fb-art {
		display: grid;
		place-items: center;
		height: 52px;
		margin: 4px 0 6px;
	}
	.fb-art .mystery {
		width: 58px;
	}
	.buys .label,
	.buys .value {
		font-weight: 700;
		font-size: 12px;
		line-height: 18px;
		text-transform: uppercase;
	}
	.buys .label {
		margin-top: auto;
	}
	.buys .value {
		margin: 4px 0 0;
	}
	.buys {
		transform-origin: 50% 0;
	}
	/* One-word translated names ("Überraschungsbonus") hyphenate instead of leaving the card. */
	.buys h3 {
		max-width: 100%;
		hyphens: auto;
		overflow-wrap: break-word;
	}
	.buys .mode-rtp {
		margin-top: 6px;
		font-size: 12px;
		line-height: 14px;
		letter-spacing: 0.33px;
		opacity: 0.85;
	}

	/* 6 · General info: two full-width rows, icon left, title over copy. (It was a near-empty
	   narrow card beside a crammed wide one.) */
	.general {
		display: grid;
		justify-items: center;
		gap: 14px;
		margin-top: 28px;
	}
	.general .card {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		align-content: start;
		column-gap: 22px;
		row-gap: 8px;
		width: 840px;
		padding: 20px 28px;
		border-width: 2px;
		border-radius: 10px;
		text-align: left;
	}
	.info-stage:not(.portrait) .general .card > :not(.gen-icon) {
		grid-column: 2;
	}
	.general h3 {
		font-size: 17px;
		letter-spacing: 1px;
		text-transform: uppercase;
	}
	.general p {
		font-size: 12px;
		line-height: 18px;
	}
	.gen-icon {
		width: 52px;
		height: 52px;
	}
	.info-stage:not(.portrait) .gen-icon {
		grid-row: 1 / span 5;
		align-self: center;
		justify-self: center;
	}
	.gen-icon.legal {
		width: 64px;
		height: 64px;
	}

	/* 7 · UI guide */
	.guide {
		display: grid;
		/* 13 controls: two rows of seven (six columns ran a third row into the pager). */
		grid-template-columns: repeat(7, 116px);
		justify-content: center;
		gap: 22px 12px;
		margin-top: 40px;
	}
	.guide li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		animation: card-in 0.5s cubic-bezier(0.3, 1.45, 0.5, 1) calc(0.05s + var(--i) * 0.04s) both;
	}
	.guide b {
		margin-top: 6px;
		font-weight: 700;
		font-size: 14.5px;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.guide-desc {
		font-size: 12px;
		line-height: 16px;
	}
	.guide-icon {
		display: grid;
		place-items: center;
		align-content: center;
		width: 48px;
		height: 48px;
		box-sizing: border-box;
		border: 1px solid #a5a7ee;
		border-radius: 9999px;
		background: #3a3981;
	}
	.guide-icon.gi-spin {
		border: 0;
		background: none;
	}
	.guide-icon.gi-spin img {
		width: 48px;
	}
	.guide-icon.gi-auto {
		gap: 2px;
	}
	.guide-icon.gi-auto img {
		width: 11.23px;
		height: 10.5px;
	}
	.guide-icon small {
		font: 700 10px/12px 'Inter', sans-serif;
		letter-spacing: -0.2px;
	}
	.guide-icon.gi-menu img {
		width: 17.5px;
		height: 15px;
	}
	.guide-icon.gi-plus img {
		width: 13.85px;
		height: 13.85px;
	}
	.guide-icon.gi-minus img {
		width: 13.85px;
		height: 2.13px;
	}
	/* The speed button's three states, side by side in a pill. */
	.guide-icon.gi-turbo {
		display: flex;
		gap: 2px;
		width: auto;
		padding: 0 8px;
	}
	.guide-icon.gi-turbo img {
		width: 22px;
		height: 22px;
	}
	.guide-icon.gi-music img {
		width: 22px;
		height: 22px;
	}
	.guide-icon.gi-sound img {
		width: 22.5px;
		height: 16.09px;
	}
	.guide-icon.gi-info img {
		width: 20px;
		height: 20px;
	}
	.guide-icon.gi-close img {
		width: 16px;
		height: 16px;
		rotate: 46.11deg;
	}
	.guide-icon.gi-prev img,
	.guide-icon.gi-next img {
		width: 18px;
		height: 14.73px;
	}
	.guide-icon.gi-next img {
		scale: -1 1;
	}
	.guide-icon.gi-bonus {
		width: auto;
		border: 0;
		background: none;
	}
	.bonus-pill {
		padding: 13px 18px;
		border-radius: 24px;
		background: #2bc4b4;
		font: 400 15px/20px 'Coiny', sans-serif;
		/* As on the HUD's own button. */
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	/* Portrait: Figma 11096:43029's 360×800 phone frames in the design's units. The game area
	   (frame y 93..670) is the stage; the 329×521 panel sits at (16, 47) and grows with --ex.
	   Each page is a scroll area under a sticky title, above the pager strip. */
	.portrait .info-panel {
		left: 16px;
		top: calc(47px + var(--ex) * 0.25);
		width: 329px;
		height: calc(521px + var(--ex) * 0.5);
		box-shadow: none;
		font: 500 12px/normal 'Nunito', sans-serif;
		letter-spacing: 0.36px;
	}
	.info-stage.portrait .screen-close {
		left: 310px;
		top: calc(7px + var(--ex) * 0.25);
		width: 36px;
		height: 36px;
	}
	.compact .info-panel {
		top: 44px;
		height: calc(100% - 50px);
	}
	/* Popouts (the 300px stage, ×0.75): the 11px card copy and the 8px AUTO guide label would
	   read at 8 and 6px, so they step up to 12px (AUTO drops its icon for the room). */
	.tight :is(.buys p, .buys .mode-rtp, .general p) {
		font-size: 12px;
		line-height: 15px;
	}
	.tight .page-count {
		font-size: 13px;
	}
	.tight .guide-icon.gi-auto img {
		display: none;
	}
	.tight .guide-icon small {
		font-size: 12px;
		letter-spacing: -0.4px;
	}
	.info-stage.compact .screen-close {
		top: 4px;
	}
	.portrait .screen-close img {
		width: 13.66px;
		height: 13.66px;
	}
	.portrait .info-page {
		bottom: 52px;
		overflow: hidden auto;
		padding: 0 8px 10px;
		scrollbar-width: none;
	}
	.portrait h2 {
		position: sticky;
		top: 0;
		z-index: 1;
		margin: 0 -8px;
		padding: 9px 0;
		background: #4b3981;
		font: 400 24px/26px 'Coiny', sans-serif;
		letter-spacing: 0.72px;
	}
	/* "User interface guide" is the one title wider than the panel at 24px. */
	.portrait .p6 h2 {
		font-size: 19px;
	}
	.portrait h3 {
		font: 400 16px/18px 'Coiny', sans-serif;
		letter-spacing: 0.48px;
		color: #f7f1ff;
	}
	.portrait .card {
		border-color: #888ae2;
	}
	.portrait .card p {
		font: 400 12px/normal 'Nunito', sans-serif;
		letter-spacing: 0.36px;
	}
	.portrait .pager {
		bottom: 5px;
		gap: 8.556px;
	}
	.portrait .round {
		width: 34px;
		height: 34px;
	}
	.portrait .round img {
		width: 12.83px;
		height: 10.5px;
	}
	.round:disabled {
		opacity: 0.4;
		pointer-events: none;
	}
	.portrait .page-count {
		right: 10px;
		bottom: 14px;
		line-height: 16px;
	}

	/* 1 · Overview: copy, the two facts as label + pill, the hero blob. */
	.portrait .peeker,
	.portrait .info-logo,
	.portrait .tiles {
		display: none;
	}
	.portrait .lead {
		gap: 16px;
		max-width: 286px;
		margin: 0 auto;
		font-size: 12px;
		line-height: normal;
	}
	.portrait .facts {
		gap: 6px 12.6px;
		margin-top: 38px;
		font-size: 12px;
	}
	.portrait .facts .max,
	.portrait .facts .rtp {
		display: grid;
		place-items: center;
		box-sizing: border-box;
		min-width: 90px;
		height: 37px;
		padding: 0 10px;
		border: 0;
		border-radius: 7px;
		background: #7f7fd6;
		font: 400 15px 'Coiny', sans-serif;
		color: #fff;
	}
	.hero-blob {
		display: block;
		width: 127px;
		height: 127px;
		margin: 37px auto 0;
		animation: card-in 0.62s cubic-bezier(0.3, 1.45, 0.5, 1) 0.2s both;
	}

	/* 2 · Paytable: the design's Symbol + value-column table, one per four unit bands. */
	.pay-list {
		width: 299px;
		margin: 6px auto 0;
		border-spacing: 0;
		table-layout: fixed;
		animation: card-in 0.5s cubic-bezier(0.3, 1.45, 0.5, 1) calc(0.05s + var(--i) * 0.07s) both;
	}
	.pay-list + .pay-list {
		margin-top: 16px;
	}
	.pay-list caption {
		padding-bottom: 6px;
		font-size: 12px;
		text-align: right;
		color: #d7d7d7;
	}
	.pay-list thead th {
		height: 29px;
		padding: 0 2px;
		background: #7f7fd6;
		font: 400 12px 'Coiny', sans-serif;
		white-space: nowrap;
	}
	.pay-list thead th + th {
		border-left: 1px solid #4b3981;
	}
	.pay-list thead th:first-child {
		border-top-left-radius: 4px;
	}
	.pay-list thead th:last-child {
		border-top-right-radius: 4px;
	}
	.pay-list tbody th,
	.pay-list td {
		height: 36px;
		padding: 0;
		/* The design's separators are SVG lines with no exposed colour; picked by eye. */
		border-bottom: 1px solid rgb(165 167 238 / 0.3);
		font: 400 12px 'Nunito', sans-serif;
		white-space: nowrap;
	}
	.pay-list .pay-blob {
		width: 33px;
		height: 33px;
	}
	.portrait .side {
		position: static;
		gap: 8px;
		width: auto;
		margin-top: 16px;
	}
	.portrait .side .card {
		gap: 7px;
		padding: 12px 30px;
		border-radius: 13px;
	}

	/* 3 · Features: one column of 301-wide cards. */
	.portrait .features {
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
	}
	.portrait .feature-stack {
		gap: 8px;
	}
	.portrait .features .card,
	.portrait .features .small,
	.portrait .features .bonus {
		width: 301px;
		height: auto;
		border-radius: 13px;
	}
	.portrait .features .small {
		gap: 5px;
		padding: 8px 30px 12px;
	}
	.portrait .features .small .feature-art {
		display: none;
	}
	.portrait .features .bonus {
		gap: 12px;
		margin-top: 4px;
		padding: 16px 20px;
	}
	.portrait .egg-row img {
		width: 44px;
		height: 44px;
	}

	/* 4 · Ways to win: the example as one row (before → after) over the rules. */
	.portrait .ways-row {
		flex-direction: column;
		gap: 12px;
		margin-top: 8px;
		padding: 0;
	}
	.portrait .ways-demo {
		flex-direction: row;
		align-items: flex-start;
		gap: 10px;
	}
	.portrait .demo-arrow {
		margin-top: 42px;
		rotate: none;
	}
	.portrait .ways {
		gap: 16px;
		max-width: 302px;
		margin: 0 auto;
		font-size: 12px;
		line-height: normal;
		text-align: center;
	}

	/* 5 · Feature buy: spin modes, then the bonus buys in their darker cards. */
	.portrait .buy-intro {
		margin: 6px auto 0;
		font-size: 12px;
		line-height: normal;
	}
	.portrait .buys {
		flex-direction: column;
		gap: 8px;
		margin-top: 8px;
	}
	.portrait .buys .card {
		width: auto;
		min-height: 0;
		gap: 4px;
		padding: 12px 8px;
		background: #270544;
	}
	.portrait .buys .card.spin-mode {
		gap: 7px;
		background: #2f1b6c;
	}
	.portrait .buys .card + .card:not(.spin-mode) {
		margin-top: 4px;
	}
	.portrait .buys p {
		max-width: 273px;
		margin: 0;
		font-size: 11px;
		letter-spacing: 0.33px;
	}
	.portrait .buys .spin-mode p {
		color: #e6e3e9;
	}
	.portrait .buys .spin-mode .fb-art,
	.portrait .buys .label {
		display: none;
	}
	.portrait .fb-art {
		height: 56px;
		margin: 2px 0;
	}
	.portrait .buys .value {
		margin: 2px 0 0;
		padding: 10px;
		border-radius: 7px;
		background: #341451;
		font: 400 12px/17px 'Coiny', sans-serif;
	}
	.portrait .buys .spin-mode .value {
		background: rgb(136 138 226 / 0.9);
	}

	/* 6 · General info: icon + title on one line, copy under it. */
	.portrait .general {
		flex-direction: column;
		gap: 8px;
		margin-top: 6px;
	}
	.portrait .general .card,
	.portrait .general .wide {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: center;
		align-items: center;
		gap: 7px;
		width: auto;
		height: auto;
		padding: 12px;
		border-width: 1px;
		border-color: #7f7fd6;
		border-radius: 12px;
	}
	.portrait .general h3 {
		max-width: none;
		font-size: 16px;
		letter-spacing: 0.48px;
		color: #fff;
	}
	.portrait .general p {
		grid-column: 1 / -1;
		justify-self: center;
		max-width: 273px;
		font: 500 11px/normal 'Nunito', sans-serif;
		letter-spacing: 0.33px;
		color: #fff;
	}
	.portrait .gen-icon {
		width: 24px;
		height: 24px;
		margin: 0;
	}
	.portrait .gen-icon.legal {
		width: 27px;
		height: 27px;
	}

	/* 7 · UI guide: one row per control, icon circle then title over description. */
	.portrait .guide {
		grid-template-columns: 1fr;
		gap: 8px;
		margin-top: 9px;
	}
	.portrait .guide li {
		display: grid;
		grid-template-columns: minmax(39px, auto) 1fr;
		align-items: center;
		gap: 8px;
		box-sizing: border-box;
		min-height: 65px;
		padding: 12px;
		border: 1px solid #7f7fd6;
		border-radius: 7px;
		background: #2f1b6c;
		text-align: left;
	}
	.portrait .guide-icon {
		grid-row: 1 / 3;
		width: 39px;
		height: 39px;
	}
	.portrait .guide-icon.gi-spin img {
		width: 39px;
	}
	.portrait .guide-icon.gi-bonus {
		width: auto;
	}
	.portrait .bonus-pill {
		padding: 8px 10px;
		font-size: 12px;
		line-height: 16px;
	}
	.portrait .guide b {
		align-self: end;
		margin: 0;
		font: 400 14.49px/17px 'Blob Display', sans-serif;
		letter-spacing: 0.43px;
		white-space: normal;
	}
	.portrait .guide-desc {
		align-self: start;
		font-size: 12px;
		line-height: 16px;
	}

	@media (prefers-reduced-motion: reduce) {
		.info-panel,
		.card,
		.guide li,
		tbody tr,
		.peeker,
		.egg-row img,
		.hero-blob,
		.pay-list {
			animation: none;
		}
	}
</style>

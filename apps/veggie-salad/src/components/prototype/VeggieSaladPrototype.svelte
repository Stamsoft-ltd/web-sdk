<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import {
		stateBet,
		stateBetDerived,
		stateConfig,
		stateMeta,
		stateModal,
		stateUi,
	} from 'state-shared';

	import { eventEmitter } from '../../game/eventEmitter';
	import { CLUSTER_LOG_SIZE, stateGame, stateGameDerived } from '../../game/stateGame.svelte';
	import { stateXstateDerived } from '../../game/stateXstate';
	import { VEGGIE_SYMBOL_ASSETS } from '../../game/veggieAssets';
	import type { Position, RawSymbol } from '../../game/types';

	// Every paid mode lives in the BONUS FEATURES menu — nothing but EXTRA CHANCE sits on the HUD
	// bar. `kind: 'toggle'` is FEATURE SPIN: activating it arms every following spin at 20× instead
	// of buying one round, so it needs no `bet` broadcast on confirm.
	const modeCards = [
		{
			key: 'FEATURE',
			title: 'FEATURE SPIN',
			cost: 20,
			tag: 'GUARANTEED CLUSTER',
			icon: 'broccoli',
			kind: 'toggle',
		},
		{
			key: 'BONUS',
			title: 'NORMAL BONUS',
			cost: 100,
			tag: '8×8 · 10 FREE SPINS',
			icon: 'tomato',
			kind: 'buy',
		},
		{
			key: 'MYSTERY',
			title: 'MYSTERY BONUS',
			cost: 300,
			tag: 'NORMAL · SUPER · HIDDEN',
			icon: 'onion',
			kind: 'buy',
		},
		{
			key: 'SUPER',
			title: 'SUPER BONUS',
			cost: 400,
			tag: '9×9 · 10 FREE SPINS',
			icon: 'corn',
			kind: 'buy',
		},
	] as const;

	let showBuyMenu = $state(false);
	let pendingMode = $state<(typeof modeCards)[number] | null>(null);
	let showAutoMenu = $state(false);
	let pendingAutoSpins = $state<number>(100);
	let showMenu = $state(false);
	let replayStarted = $state(false);

	const isReplay = $derived(stateUi.config.mode === 'replay');
	const isIdle = $derived(stateXstateDerived.isIdle());
	const canInteract = $derived(isIdle && !isReplay);
	const activeMode = $derived(stateBet.activeBetModeKey.toUpperCase());
	const chanceActive = $derived(activeMode === 'CHANCE');
	const featureActive = $derived(activeMode === 'FEATURE');
	const betOptions = $derived(stateConfig.betAmountOptions);
	const betIndex = $derived(Math.max(0, betOptions.indexOf(stateBet.betAmount)));
	const totalBet = $derived(stateBetDerived.betCost());
	const featureRibbon = $derived(
		stateGame.featureLabel || (featureActive ? 'FEATURE SPIN ARMED' : ''),
	);
	const hasAuto = $derived(stateBetDerived.hasAutoBetCounter());
	const autoCounterText = $derived(
		stateBet.autoSpinsCounter === Infinity ? '∞' : stateBet.autoSpinsCounter || 'A',
	);
	const controlsBlocked = $derived(
		showBuyMenu ||
			showAutoMenu ||
			showMenu ||
			stateModal.modal !== null ||
			(isReplay && !replayStarted),
	);
	const winningKeys = $derived(
		new Set(stateGame.winningPositions.map((position) => stateGameDerived.positionKey(position))),
	);
	const scatterKeys = $derived(
		new Set(stateGame.scatterPositions.map((position) => stateGameDerived.positionKey(position))),
	);
	// On a bonus-entry spin the scatter COUNT is the announcement of which bonus was won, so it
	// gets its own read-out under the board.
	const scatterCount = $derived(stateGame.scatterPositions.length);
	const theme = $derived(
		stateGame.gameType === 'hidden'
			? 'rainbow'
			: stateGame.gameType === 'super'
				? 'night'
				: stateGame.gameType === 'normal'
					? 'sunset'
					: 'day',
	);

	// The active motion profile — normal, or the fast one under turbo/skip. Because this is
	// $derived, a skip press rewrites these custom properties on cells that are mid-fall, and the
	// browser re-scales the running animation instead of dropping it: a fast-forward, not a cut.
	const motion = $derived(stateGameDerived.motion());
	const ms = (value: number) => `${Math.round(value)}ms`;

	// Per-cell drop timing. The spin reveal and the tumble refill share one gravity model — only
	// the column stagger differs. Bottom rows start first, so a column piles up from the floor and
	// a falling symbol can never pass through one that has already landed.
	const cellMotion = (reel: number, row: number) => {
		const distance = stateGame.fallDistances[reel]?.[row] ?? 0;
		const jitter = stateGame.fallJitter[reel]?.[row] ?? 0;
		const fall = stateGameDerived.fallDurationMs(distance);
		const stagger =
			stateGame.phase === 'spinning' ? motion.spinRowStaggerMs : motion.tumbleRowStaggerMs;
		const delay =
			(stateGame.gridSize - 1 - row) * stagger +
			reel * motion.reelDelayMs +
			jitter * motion.jitterMs;

		// A skip press rewrites these so every cell still in the air lands together.
		const drop = stateGameDerived.skipAdjust({ delayMs: delay, durationMs: fall });
		const exit = stateGameDerived.skipAdjust({
			delayMs:
				(stateGame.gridSize - 1 - row) * motion.exitRowStaggerMs +
				reel * motion.exitReelDelayMs +
				jitter * motion.exitJitterMs,
			durationMs: stateGameDerived.fallDurationMs(stateGameDerived.exitDistance(row)),
		});

		return [
			`--fall-offset:${-105 * distance}%`,
			`--fall-duration:${ms(drop.durationMs)}`,
			`--fall-delay:${ms(drop.delayMs)}`,
			// The landing squash starts exactly where the fall ends.
			`--impact-delay:${ms(drop.delayMs + drop.durationMs)}`,
			// Trap-door exit: the same fall, downwards and out. Distance-derived duration + a
			// bottom-row-first stagger, so the old board tumbles out instead of sliding off as one
			// sheet (which is what the single shared duration used to look like).
			`--exit-offset:${105 * stateGameDerived.exitDistance(row)}%`,
			`--exit-duration:${ms(exit.durationMs)}`,
			`--exit-delay:${ms(exit.delayMs)}`,
			`--harvest-delay:${ms(jitter * motion.removeJitterMs)}`,
		].join(';');
	};

	const formatCurrency = (amount: number) => {
		const precision = amount !== 0 && Math.abs(amount) < 0.01 ? 6 : 2;
		try {
			return new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: stateBet.currency || 'USD',
				minimumFractionDigits: precision,
				maximumFractionDigits: precision,
			}).format(amount);
		} catch {
			return `${stateBet.currency || '$'} ${amount.toFixed(precision)}`;
		}
	};

	const bookWinToCurrency = (amount: number) =>
		formatCurrency((amount / 100) * stateBet.wageredBetAmount);

	const getCell = (reel: number, row: number): RawSymbol | null =>
		stateGame.board[reel]?.[row] ?? null;
	const keyOf = (reel: number, row: number) => `${reel}:${row}`;
	// Newest first, already capped by the handler. Rendered into a fixed number of slots, so the
	// panel is the same size empty or full and a new win always lands in the top slot.
	const clusterRows = $derived(stateGame.spinClusterWins.slice(0, CLUSTER_LOG_SIZE));

	// One label per live cluster, parked on the cluster's centre of mass rather than on its first
	// cell, so the amount reads as belonging to the whole shape.
	const clusterLabels = $derived(
		stateGame.winningClusters.map((cluster) => {
			const reels = cluster.positions.map((position) => position.reel);
			const rows = cluster.positions.map((position) => position.row);
			const centre = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
			// Keep the label inside the frame: the board clips its own overflow (it has to, for the
			// falls), so a cluster hugging an edge would otherwise have half its amount cut off.
			const pitch = 100 / stateGame.gridSize;
			const inset = (value: number) => Math.min(100 - pitch * 1.8, Math.max(pitch * 1.8, value));
			return {
				id: cluster.clusterId,
				left: inset(((centre(reels) + 0.5) / stateGame.gridSize) * 100),
				top: inset(((centre(rows) + 0.5) / stateGame.gridSize) * 100),
				text: `${bookWinToCurrency(cluster.amount)}${
					cluster.appliedMultiplier > 1 ? ` X${cluster.appliedMultiplier}` : ''
				}`,
			};
		}),
	);

	const spinOrSkip = () => {
		if (controlsBlocked) return;
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		if (!isIdle) {
			stateGameDerived.requestSkip();
			eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}
		if (isReplay) return;
		eventEmitter.broadcast({ type: 'bet' });
	};

	const stepBet = (direction: -1 | 1) => {
		if (!canInteract || betOptions.length === 0) return;
		const nextIndex = Math.max(0, Math.min(betOptions.length - 1, betIndex + direction));
		const next = betOptions[nextIndex];
		if (typeof next === 'number') stateBetDerived.setBetAmount(next);
	};

	const toggleChance = () => {
		if (!canInteract) return;
		stateBet.activeBetModeKey = chanceActive ? 'BASE' : 'CHANCE';
	};

	const canAffordMode = (mode: (typeof modeCards)[number]) =>
		stateBet.betAmount * mode.cost <= stateBet.balanceAmount;

	const requestBuyMode = (mode: (typeof modeCards)[number]) => {
		if (!canInteract) return;
		// Turning a toggle OFF spends nothing, so it skips the confirmation.
		if (mode.kind === 'toggle' && activeMode === mode.key) {
			stateBet.activeBetModeKey = 'BASE';
			return;
		}
		if (!canAffordMode(mode)) {
			stateModal.modal = {
				name: 'error',
				error: new Error(
					'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.',
				),
			};
			return;
		}
		pendingMode = mode;
	};

	const confirmBuyMode = () => {
		if (!pendingMode || !canInteract || !canAffordMode(pendingMode)) return;
		const mode = pendingMode;
		pendingMode = null;
		showBuyMenu = false;
		stateBet.activeBetModeKey = mode.key;
		// A buy spins immediately; a toggle just arms and hands the spin back to the player.
		if (mode.kind === 'buy') eventEmitter.broadcast({ type: 'bet' });
	};

	const toggleTurbo = () => {
		if (stateConfig.jurisdiction?.disabledTurbo) return;
		if (!stateBet.isTurbo && !stateBet.isSuperTurbo) {
			stateBet.isTurbo = true;
			return;
		}
		if (stateBet.isTurbo && !stateConfig.jurisdiction?.disabledSuperTurbo) {
			stateBet.isSuperTurbo = true;
			return;
		}
		stateBet.isTurbo = false;
		stateBet.isSuperTurbo = false;
	};

	const toggleAuto = () => {
		if (stateConfig.jurisdiction?.disabledAutoplay || isReplay) return;
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		if (!canInteract) return;
		showAutoMenu = true;
	};

	const startAuto = () => {
		if (!canInteract || !stateBetDerived.isBetCostAvailable()) return;
		// CHANCE and FEATURE are toggles and keep running through autoplay; the buys are one-shot.
		if (['BONUS', 'MYSTERY', 'SUPER'].includes(activeMode)) {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateBet.autoSpinsCounter = pendingAutoSpins;
		showAutoMenu = false;
		eventEmitter.broadcast({ type: 'autoBet' });
	};

	const startReplay = () => {
		if (!stateBet.betToResume || replayStarted) return;
		replayStarted = true;
		if (stateBet.betToResume.mode) stateBet.activeBetModeKey = stateBet.betToResume.mode;
		eventEmitter.broadcast({ type: 'resumeBet' });
	};

	const openRules = () => {
		showMenu = false;
		stateModal.modal = { name: 'gameRules' };
	};

	const openPaytable = () => {
		showMenu = false;
		stateModal.modal = { name: 'payTable' };
	};

	const closeTopPanel = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		if (pendingMode) pendingMode = null;
		else if (showAutoMenu) showAutoMenu = false;
		else if (showBuyMenu) showBuyMenu = false;
		else if (showMenu) showMenu = false;
	};
</script>

<svelte:head>
	<title>Veggie Salad</title>
	<meta name="description" content="Veggie Salad cluster slot" />
</svelte:head>

<OnHotkey
	hotkey="Space"
	disabled={Boolean(stateConfig.jurisdiction?.disabledSpacebar) || controlsBlocked}
	onpress={spinOrSkip}
/>
<svelte:window onkeydown={closeTopPanel} />

<main class="scene theme-{theme}" onclick={() => !isIdle && stateGameDerived.requestSkip()}>
	<div class="sun-moon" aria-hidden="true"></div>
	<div class="rainbow" aria-hidden="true"></div>
	<div class="cloud cloud-a" aria-hidden="true"></div>
	<div class="cloud cloud-b" aria-hidden="true"></div>
	<div class="tree-line tree-back" aria-hidden="true"></div>
	<div class="tree-line tree-front" aria-hidden="true"></div>
	<div class="meadow" aria-hidden="true"></div>
	<div class="corner-foliage" aria-hidden="true"></div>

	<header class="brand" aria-label="Veggie Salad">
		<span class="brand-leaf">❧</span>
		<div><small>FRESH FROM THE GARDEN</small><strong>VEGGIE SALAD</strong></div>
		<span class="brand-leaf mirror">❧</span>
	</header>

	{#if stateGame.freeSpinTotal > 0 && stateGame.bonusTier}
		<div class="bonus-status">
			<span>{stateGame.bonusTier.toUpperCase()} BONUS</span>
			<strong>{stateGame.freeSpinCurrent} / {stateGame.freeSpinTotal}</strong>
			<small>FREE SPINS</small>
		</div>
	{/if}

	<section class="game-stage" aria-label="Veggie Salad game board">
		<aside class="cluster-panel" style={`--slots:${CLUSTER_LOG_SIZE}`} aria-label="Cluster payouts">
			<header class="panel-head">CLUSTER PAYS</header>
			<div class="panel-rows">
				<!-- Slots, not rows: keyed by position so a repeat win in the same cascade cannot
				     collide with an identical clusterId from an earlier tumble (which is what stopped
				     the panel updating), and so the box keeps its height while it fills. -->
				{#each Array(CLUSTER_LOG_SIZE) as _, slot (slot)}
					{@const row = clusterRows[slot]}
					<div class="panel-row" class:vacant={!row}>
						{#if row}
							<span>{row.size}x</span>
							<img src={`.${VEGGIE_SYMBOL_ASSETS[row.symbol]}`} alt="" />
							<span>x{row.appliedMultiplier}</span>
							<strong>{bookWinToCurrency(row.amount)}</strong>
						{/if}
					</div>
				{/each}
			</div>
		</aside>
		<div class="board-wrap">
			<div class="board-shadow"></div>
			<div
				class="board-frame"
				class:is-spinning={stateGame.phase === 'spinning' || stateGame.phase === 'spinning-out'}
			>
				{#key stateGame.gridSize}
					<div
						class="board phase-{stateGame.phase}"
						style={`--grid-size:${stateGame.gridSize};--reveal:${stateGame.revealId};--impact-duration:${ms(motion.impactMs)};--remove-duration:${ms(motion.removeMs)}`}
						aria-label={`${stateGame.gridSize} by ${stateGame.gridSize} symbol grid`}
					>
						{#each Array(stateGame.gridSize) as _, row}
							{#each Array(stateGame.gridSize) as _, reel}
								{@const cell = getCell(reel, row)}
								{@const hit = winningKeys.has(keyOf(reel, row))}
								{@const scatterHit = scatterKeys.has(keyOf(reel, row))}
								<div
									class="cell"
									class:cluster-hit={hit}
									class:scatter-hit={scatterHit}
									class:empty={!cell}
									class:falling={(stateGame.fallDistances[reel]?.[row] ?? 0) > 0}
									style={cellMotion(reel, row)}
								>
									{#if cell}
										<div class="symbol-layer">
											{#if cell.name === 'SCATTER'}
												<img
													class="backplate"
													src="./assets/veggie-salad/symbols/backplate.png"
													alt=""
												/>
											{/if}
											<img
												class="symbol"
												src={`.${VEGGIE_SYMBOL_ASSETS[cell.name]}`}
												alt={cell.name.toLowerCase()}
												draggable="false"
											/>
											{#if cell.multiplier}
												<span class="multiplier">{cell.multiplier}×</span>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						{/each}

						<!-- Keyed by position, not clusterId: the math is free to reuse an id between
						     cascades, and a duplicate key in a keyed each is a runtime error. -->
						{#each clusterLabels as label, index (index)}
							<span class="win-label" style={`left:${label.left}%;top:${label.top}%`}>
								{label.text}
							</span>
						{/each}
					</div>
				{/key}
				<div class="frame-highlight" aria-hidden="true"></div>
			</div>

			{#if scatterCount > 0}
				<div class="scatter-tally">
					{scatterCount} SCATTER{scatterCount === 1 ? '' : 'S'}
				</div>
			{/if}

			{#if featureRibbon}
				<div class="feature-ribbon">{featureRibbon}</div>
			{/if}
		</div>
	</section>

	{#if stateGame.overlay}
		<div class="event-overlay">
			<div class="event-card kind-{stateGame.overlay.kind}">
				<span class="sprout">✦</span>
				<h2>{stateGame.overlay.title}</h2>
				<p>{stateGame.overlay.detail}</p>
				{#if stateGame.overlay.kind === 'win'}
					<strong>{bookWinToCurrency(stateGame.roundWin)}</strong>
				{/if}
			</div>
		</div>
	{/if}

	{#if isReplay && !replayStarted}
		<div class="event-overlay replay-overlay">
			<div class="event-card">
				<small>VEGGIE SALAD REPLAY</small>
				<h2>{stateBet.activeBetModeKey}</h2>
				<p>BET {formatCurrency(stateBet.betAmount)}</p>
				<button
					onclick={(event) => {
						event.stopPropagation();
						startReplay();
					}}>START REPLAY</button
				>
			</div>
		</div>
	{/if}

	{#if showBuyMenu}
		<div
			class="modal-layer"
			onclick={(event) => {
				event.stopPropagation();
				pendingMode = null;
				showBuyMenu = false;
			}}
		>
			<section class="buy-panel" onclick={(event) => event.stopPropagation()}>
				<button class="close" aria-label="Close" onclick={() => (showBuyMenu = false)}>×</button>
				<header>
					<small>CHOOSE YOUR HARVEST</small>
					<h2>BONUS FEATURES</h2>
				</header>
				<div class="buy-grid">
					{#each modeCards as mode}
						{@const isArmed = mode.kind === 'toggle' && activeMode === mode.key}
						<button
							class="buy-card mode-{mode.key.toLowerCase()}"
							class:armed={isArmed}
							aria-pressed={mode.kind === 'toggle' ? isArmed : undefined}
							disabled={!canAffordMode(mode) && !isArmed}
							onclick={() => requestBuyMode(mode)}
						>
							<img src={`./assets/veggie-salad/symbols/${mode.icon}.png`} alt="" />
							<span>{mode.title}</span>
							<small>{mode.tag}</small>
							<strong>{mode.cost}× BET{mode.kind === 'toggle' ? ' / SPIN' : ''}</strong>
							<em>{formatCurrency(stateBet.betAmount * mode.cost)}</em>
							{#if mode.kind === 'toggle'}
								<b class="card-state">{isArmed ? 'ARMED · TAP TO STOP' : 'TOGGLE'}</b>
							{/if}
						</button>
					{/each}
				</div>
			</section>
		</div>
	{/if}

	{#if pendingMode}
		<div
			class="modal-layer confirm-layer"
			onclick={(event) => {
				event.stopPropagation();
				pendingMode = null;
			}}
		>
			<section
				class="confirm-panel"
				role="dialog"
				aria-modal="true"
				onclick={(event) => event.stopPropagation()}
			>
				<button class="close" aria-label="Close" onclick={() => (pendingMode = null)}>×</button>
				<small>{pendingMode.kind === 'toggle' ? 'CONFIRM ACTIVATION' : 'CONFIRM PURCHASE'}</small>
				<img src={`./assets/veggie-salad/symbols/${pendingMode.icon}.png`} alt="" />
				<h2>{pendingMode.title}</h2>
				<p>{pendingMode.tag}</p>
				<strong>{formatCurrency(stateBet.betAmount * pendingMode.cost)}</strong>
				{#if pendingMode.kind === 'toggle'}
					<p class="confirm-note">Charged on every spin until you switch it off.</p>
				{/if}
				<div class="confirm-actions">
					<button class="cancel" onclick={() => (pendingMode = null)}>CANCEL</button>
					<button class="accept" onclick={confirmBuyMode}>
						{pendingMode.kind === 'toggle' ? 'ACTIVATE' : 'CONFIRM'}
					</button>
				</div>
			</section>
		</div>
	{/if}

	{#if showAutoMenu}
		<div
			class="modal-layer"
			onclick={(event) => {
				event.stopPropagation();
				showAutoMenu = false;
			}}
		>
			<section
				class="auto-panel"
				role="dialog"
				aria-modal="true"
				onclick={(event) => event.stopPropagation()}
			>
				<button class="close" aria-label="Close" onclick={() => (showAutoMenu = false)}>×</button>
				<small>AUTOPLAY</small>
				<h2>NUMBER OF SPINS</h2>
				<div class="auto-options">
					{#each [10, 25, 50, 100, 250, 500, Infinity] as count}
						<button
							class:active={pendingAutoSpins === count}
							onclick={() => (pendingAutoSpins = count)}
						>
							{count === Infinity ? '∞' : count}
						</button>
					{/each}
				</div>
				<p>Autoplay stops on insufficient funds, error, or manual stop.</p>
				<button
					class="auto-start"
					disabled={!stateBetDerived.isBetCostAvailable()}
					onclick={startAuto}
				>
					START AUTOPLAY
				</button>
			</section>
		</div>
	{/if}

	{#if showMenu}
		<div class="quick-menu" onclick={(event) => event.stopPropagation()}>
			<button onclick={openRules}>GAME RULES</button>
			<button onclick={openPaytable}>FEATURES</button>
			<button onclick={() => (showMenu = false)}>CLOSE</button>
		</div>
	{/if}

	{#if !isReplay}
		<footer class="hud" onclick={(event) => event.stopPropagation()}>
			<div class="hud-left">
				<button class="round utility" aria-label="Menu" onclick={() => (showMenu = !showMenu)}
					>☰</button
				>
				{#if !stateConfig.jurisdiction?.disabledBuyFeature}
					<button class="bonus-button" disabled={!canInteract} onclick={() => (showBuyMenu = true)}>
						<span>BONUS</span><small>FEATURES</small>
					</button>
				{/if}
				<button
					class="chance"
					class:active={chanceActive}
					disabled={!canInteract}
					onclick={toggleChance}
				>
					<span>EXTRA</span><small>CHANCE</small>
				</button>
			</div>

			<div class="metrics">
				<div class="metric">
					<span>BALANCE</span><strong>{formatCurrency(stateBet.balanceAmount)}</strong>
				</div>
				<div class="metric win">
					<span>WIN</span><strong>{bookWinToCurrency(stateGame.roundWin)}</strong>
				</div>
				<div class="metric bet">
					<span>TOTAL BET</span><strong>{formatCurrency(totalBet)}</strong>
				</div>
			</div>

			<div class="hud-right">
				<div class="bet-stepper">
					<button
						aria-label="Decrease bet"
						disabled={!canInteract || betIndex <= 0}
						onclick={() => stepBet(-1)}>−</button
					>
					<button
						aria-label="Increase bet"
						disabled={!canInteract || betIndex >= betOptions.length - 1}
						onclick={() => stepBet(1)}>+</button
					>
				</div>
				<button class="spin" aria-label={isIdle ? 'Spin' : 'Skip'} onclick={spinOrSkip}>
					<span class:stop={!isIdle}>{isIdle ? '↻' : '■'}</span>
				</button>
				<button class="round utility turbo" aria-label="Turbo" onclick={toggleTurbo}>
					<span>ϟ</span><small
						>{stateBet.isSuperTurbo ? 'MAX' : stateBet.isTurbo ? 'FAST' : ''}</small
					>
				</button>
				{#if !stateConfig.jurisdiction?.disabledAutoplay}
					<button class="round utility auto" aria-label="Auto spin" onclick={toggleAuto}>
						<span>{autoCounterText}</span><small>AUTO</small>
					</button>
				{/if}
			</div>
		</footer>
	{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
	}
	:global(button) {
		font: inherit;
	}
	.scene {
		position: fixed;
		inset: 0;
		isolation: isolate;
		overflow: hidden;
		font-family: 'Trebuchet MS', 'Arial Rounded MT Bold', system-ui, sans-serif;
		color: #fff;
		background: linear-gradient(#48bff0 0 48%, #86c944 70%, #327c2b 100%);
		transition: background 700ms ease;
	}
	.scene::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: radial-gradient(
			ellipse at 50% 42%,
			transparent 25%,
			rgb(10 62 22 / 14%) 75%,
			rgb(6 31 13 / 40%)
		);
	}
	.theme-sunset {
		background: linear-gradient(#f36a51 0, #ffae55 44%, #719644 70%, #315e2c 100%);
	}
	.theme-night {
		background: linear-gradient(#071544 0, #174986 50%, #245a68 70%, #123b35 100%);
	}
	.theme-rainbow {
		background: linear-gradient(#d9edf6 0, #eaf4f4 48%, #8bce62 72%, #39863b 100%);
	}
	.sun-moon {
		position: absolute;
		top: 11%;
		right: 15%;
		width: min(8vw, 90px);
		aspect-ratio: 1;
		border-radius: 50%;
		background: #fff1a0;
		box-shadow: 0 0 40px 18px rgb(255 228 105 / 38%);
		opacity: 0.82;
	}
	.theme-night .sun-moon {
		right: auto;
		left: 17%;
		background: transparent;
		box-shadow: 18px 0 0 0 #fffbd0;
	}
	.theme-rainbow .sun-moon {
		opacity: 0;
	}
	.rainbow {
		position: absolute;
		left: 50%;
		top: 39%;
		width: 84vw;
		height: 53vw;
		transform: translate(-50%, -50%);
		border-radius: 50% 50% 0 0;
		border: clamp(16px, 2.8vw, 50px) solid transparent;
		background:
			linear-gradient(#dceef4, #dceef4) padding-box,
			linear-gradient(90deg, #f36b6b, #ffd55f, #72d57f, #69aeef, #a27ae7) border-box;
		opacity: 0;
		filter: saturate(0.75);
	}
	.theme-rainbow .rainbow {
		opacity: 0.88;
	}
	.cloud {
		position: absolute;
		width: 150px;
		height: 35px;
		border-radius: 60px;
		background: rgb(255 255 255 / 68%);
		filter: blur(0.3px);
	}
	.cloud::before,
	.cloud::after {
		content: '';
		position: absolute;
		border-radius: 50%;
		background: inherit;
	}
	.cloud::before {
		width: 65px;
		height: 65px;
		left: 25px;
		bottom: 0;
	}
	.cloud::after {
		width: 82px;
		height: 82px;
		right: 18px;
		bottom: 0;
	}
	.cloud-a {
		top: 14%;
		left: 8%;
		transform: scale(0.72);
	}
	.cloud-b {
		top: 24%;
		right: 7%;
		transform: scale(0.48);
	}
	.theme-night .cloud {
		opacity: 0.14;
	}
	.tree-line {
		position: absolute;
		left: -5%;
		right: -5%;
		bottom: 10%;
		height: 48%;
		background:
			radial-gradient(circle at 5% 62%, #286c2c 0 10%, transparent 10.5%),
			radial-gradient(circle at 18% 55%, #347c35 0 14%, transparent 14.5%),
			radial-gradient(circle at 33% 63%, #21642a 0 13%, transparent 13.5%),
			radial-gradient(circle at 50% 53%, #3b853b 0 16%, transparent 16.5%),
			radial-gradient(circle at 68% 62%, #276c2d 0 14%, transparent 14.5%),
			radial-gradient(circle at 84% 53%, #337936 0 16%, transparent 16.5%),
			radial-gradient(circle at 98% 61%, #205f29 0 13%, transparent 13.5%);
	}
	.tree-back {
		bottom: 24%;
		opacity: 0.75;
		transform: scale(1.18);
		filter: brightness(1.08);
	}
	.tree-front {
		background-color: #255e28;
		filter: drop-shadow(0 -10px 16px rgb(0 53 22 / 22%));
	}
	.theme-sunset .tree-line {
		filter: sepia(0.22) brightness(0.72);
	}
	.theme-night .tree-line {
		filter: brightness(0.38) saturate(0.7) hue-rotate(45deg);
	}
	.meadow {
		position: absolute;
		inset: auto 0 0;
		height: 32%;
		background: linear-gradient(transparent, #4ca33b 28%, #27722f);
	}
	.corner-foliage {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background:
			radial-gradient(ellipse at -3% -2%, #0d4522 0 13%, transparent 13.5%),
			radial-gradient(ellipse at 103% -2%, #134c25 0 14%, transparent 14.5%),
			radial-gradient(ellipse at -3% 103%, #0b4823 0 16%, transparent 16.5%),
			radial-gradient(ellipse at 103% 103%, #0b4020 0 17%, transparent 17.5%);
	}
	.brand {
		position: absolute;
		top: max(8px, 1.2vh);
		left: 50%;
		z-index: 12;
		display: flex;
		align-items: center;
		gap: 10px;
		transform: translateX(-50%) rotate(-1deg);
		padding: 5px 25px 7px;
		border: 4px solid #694012;
		border-radius: 50% 50% 34% 34%;
		background: linear-gradient(#f9e65f, #e49a17);
		box-shadow:
			inset 0 0 0 3px #fff184,
			0 5px 0 #3e671b,
			0 9px 18px rgb(0 0 0 / 32%);
		color: #315f16;
		text-align: center;
		white-space: nowrap;
	}
	.brand div {
		display: grid;
	}
	.brand small {
		font-size: clamp(6px, 0.55vw, 9px);
		letter-spacing: 0.18em;
		font-weight: 900;
	}
	.brand strong {
		font-size: clamp(18px, 2vw, 34px);
		line-height: 0.9;
		font-weight: 1000;
		letter-spacing: -0.06em;
		-webkit-text-stroke: 1px #173c0f;
		text-shadow: 0 2px #fff47d;
	}
	.brand-leaf {
		color: #4a8b1c;
		font-size: 25px;
	}
	.brand-leaf.mirror {
		transform: scaleX(-1);
	}
	/* The stage is the free space between the brand plate and the HUD; the board is the largest
	   square that fits INSIDE it. `container-type: size` is what makes that expressible in CSS:
	   min(100cqw, 100cqh) reads both axes of this box, so the board can never overflow one axis
	   the way `aspect-ratio` + `max-width` did (that combination broke the square and let the
	   bottom rows slide under the HUD on short screens and clip on narrow ones).
	   The bottom inset is a max() against the HUD's own height for the same reason. */
	.game-stage {
		position: absolute;
		z-index: 5;
		top: 8.5%;
		bottom: max(12%, 122px);
		left: 0;
		right: 0;
		padding: 0 clamp(4px, 1.5vw, 28px);
		container-type: size;
		display: grid;
		place-items: center;
	}
	.board-wrap {
		position: relative;
		/* Fallback first for engines without container query units: a square bounded by the
		   narrower axis of the stage. */
		width: 100%;
		height: 100%;
		aspect-ratio: 1;
		width: min(100cqw, 100cqh);
		height: min(100cqw, 100cqh);
	}
	.board-shadow {
		position: absolute;
		inset: 3%;
		border-radius: 18px;
		background: rgb(15 47 7 / 55%);
		filter: blur(20px);
		transform: translateY(16px);
	}
	.board-frame {
		position: relative;
		width: 100%;
		height: 100%;
		padding: clamp(8px, 1vw, 14px);
		border: clamp(8px, 1vw, 14px) solid #744313;
		border-radius: 16px;
		background: linear-gradient(90deg, #a46a25, #4b2808 10%, #754515 50%, #4b2808 90%, #a46a25);
		box-shadow:
			inset 0 0 0 3px #d59b3f,
			inset 0 0 20px #2b1605,
			0 15px 34px rgb(0 0 0 / 40%);
		overflow: hidden;
	}
	.board-frame::before,
	.board-frame::after {
		content: '';
		position: absolute;
		z-index: 5;
		pointer-events: none;
	}
	.board-frame::before {
		inset: 3px;
		border: 2px solid rgb(255 222 116 / 58%);
		border-radius: 8px;
	}
	.board-frame::after {
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0 2%,
			rgb(255 207 86 / 15%) 4%,
			transparent 8% 92%,
			rgb(255 207 86 / 15%) 96%,
			transparent 98%
		);
	}
	.board {
		/* Runs once per mount, and {#key stateGame.gridSize} remounts the grid whenever the bonus
		   changes board size — so 7×7 → 9×9 reads as a re-deal instead of the cells jumping to a
		   new pitch under the old symbols. */
		animation: grid-swap 380ms cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
		display: grid;
		grid-template-columns: repeat(var(--grid-size), minmax(0, 1fr));
		grid-template-rows: repeat(var(--grid-size), minmax(0, 1fr));
		gap: clamp(1px, 0.18vw, 3px);
		width: 100%;
		height: 100%;
		padding: 3px;
		overflow: hidden;
		background: #a96e27;
		border: 2px solid #2c1b08;
	}
	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		overflow: visible;
		transform-origin: center bottom;
	}
	.cell::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		background:
			radial-gradient(circle at 45% 34%, rgb(118 150 50 / 74%), transparent 62%),
			linear-gradient(145deg, #496c20, #203d14);
		box-shadow:
			inset 0 0 0 1px rgb(255 234 144 / 18%),
			inset 0 -6px 12px rgb(9 31 8 / 20%);
	}
	.symbol-layer {
		/* quadIn — slow off the ledge, fast into the floor. Paired with the sqrt(distance)
		   duration this gives every symbol an identical trajectory, so short and long falls look
		   like the same board of vegetables under the same gravity. */
		--gravity-ease: cubic-bezier(0.11, 0, 0.5, 0);
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-items: center;
		transform-origin: center bottom;
		will-change: transform, opacity, filter;
	}
	.symbol,
	.backplate {
		position: absolute;
		width: 88%;
		height: 88%;
		object-fit: contain;
		user-select: none;
		filter: drop-shadow(0 3px 2px rgb(0 0 0 / 42%));
	}
	.backplate {
		width: 96%;
		height: 96%;
		filter: drop-shadow(0 0 7px #ffe36a);
	}
	.multiplier {
		position: absolute;
		right: 2%;
		bottom: 1%;
		z-index: 3;
		display: grid;
		place-items: center;
		min-width: 31%;
		aspect-ratio: 1;
		padding: 1px;
		border: clamp(1px, 0.15vw, 2px) solid #fff4a4;
		border-radius: 50%;
		background: linear-gradient(#ff813d, #c92322);
		box-shadow: 0 2px 5px #310900;
		font-size: clamp(7px, 1vw, 15px);
		font-weight: 1000;
		text-shadow: 0 2px 2px #510700;
	}
	/* Trap-door exit: the old board free-falls out the bottom under the same gravity as the drop,
	   loosened by a per-reel delay and the per-cell jitter instead of a rigid left-to-right sweep. */
	.phase-spinning-out .symbol-layer {
		animation: trapdoor-exit var(--exit-duration) var(--gravity-ease) var(--exit-delay) both;
	}
	/* Spin reveal and tumble refill are the SAME motion: an accelerating fall whose duration is
	   proportional to sqrt(distance) (constant gravity — see FALL_MOTION), then a separate
	   landing animation that squashes the symbol against the floor and bounces it out.
	   `land-impact` is `forwards`, not `both`: with `both` its 0% frame would fill backwards over
	   the whole fall and freeze the symbol in place. */
	.phase-spinning .symbol-layer,
	.phase-dropping .cell.falling .symbol-layer {
		animation:
			gravity-fall var(--fall-duration) var(--gravity-ease) var(--fall-delay) both,
			land-impact var(--impact-duration) linear var(--impact-delay) forwards;
	}
	.cell.cluster-hit {
		z-index: 4;
	}
	.cell.cluster-hit::before {
		background: radial-gradient(circle, #faff7c 0 10%, #8fca34 56%, #31511b);
		box-shadow:
			inset 0 0 0 2px #fff36a,
			0 0 12px rgb(229 255 69 / 70%);
	}
	.cell.cluster-hit .symbol-layer {
		animation: cluster-pulse 720ms ease-in-out infinite alternate;
	}
	.phase-removing .cell.cluster-hit .symbol-layer {
		animation: harvest var(--remove-duration) cubic-bezier(0.3, 0, 0.4, 1) var(--harvest-delay)
			forwards;
	}
	/* Bonus-entry scatters: gold cell and a slow throb, so counting them takes no effort. Kept
	   distinct from the lime cluster highlight — a scatter is not a pay. */
	.cell.scatter-hit {
		z-index: 4;
	}
	.cell.scatter-hit::before {
		background: radial-gradient(circle, #fff5b0 0 12%, #ffbe33 58%, #7a4409);
		box-shadow:
			inset 0 0 0 2px #fff3b0,
			0 0 14px rgb(255 199 62 / 75%);
	}
	.cell.scatter-hit .symbol-layer {
		animation: scatter-throb 620ms ease-in-out infinite alternate;
	}
	.cell.empty::before {
		background: linear-gradient(145deg, #354e1b, #18320f);
	}
	/* Cluster win read-out: heavy white type stroked in dark green, parked on the cluster's centre
	   of mass. Sized off the cell pitch (board square / grid size) so it stays proportional from a
	   7×7 base grid to a 10×10 bonus grid. */
	.win-label {
		position: absolute;
		z-index: 8;
		width: max-content;
		transform: translate(-50%, -50%);
		color: #fff;
		font-size: calc(min(100cqw, 100cqh) / var(--grid-size) * 0.4);
		font-weight: 1000;
		letter-spacing: -0.02em;
		white-space: nowrap;
		-webkit-text-stroke: 0.09em #1d3c0c;
		paint-order: stroke fill;
		text-shadow:
			0 0.06em 0.02em #16300a,
			0 0.1em 0.22em rgb(9 26 5 / 65%);
		pointer-events: none;
		animation: win-label-in 260ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
	}
	@keyframes win-label-in {
		from {
			transform: translate(-50%, -50%) scale(0.55);
			opacity: 0;
		}
		to {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
	}
	/* Side payout box. Same furniture as the board frame and the free-spins plaque: brown wood,
	   gold inner rule, green plates. Fixed height — CLUSTER_LOG_SIZE slots are always reserved, so
	   it does not grow or shrink as a cascade fills it. Only shown where there is real gutter next
	   to the board; a square board on a portrait screen leaves none. */
	.cluster-panel {
		position: absolute;
		left: clamp(4px, 1.5cqw, 26px);
		top: 50%;
		z-index: 7;
		display: none;
		width: clamp(128px, 25cqh, 196px);
		padding: clamp(5px, 0.9cqh, 9px);
		border: clamp(3px, 0.6cqh, 6px) solid #744313;
		border-radius: 14px;
		background: linear-gradient(#7c4a16, #452507);
		box-shadow:
			inset 0 0 0 2px #d59b3f,
			inset 0 0 16px #2b1605,
			0 10px 22px rgb(0 0 0 / 38%);
		transform: translateY(-50%);
	}
	@container (min-aspect-ratio: 1.55) {
		.cluster-panel {
			display: block;
		}
	}
	.panel-head {
		padding-bottom: clamp(3px, 0.6cqh, 6px);
		margin-bottom: clamp(4px, 0.7cqh, 7px);
		border-bottom: 2px solid rgb(213 155 63 / 55%);
		color: #ffe07a;
		font-size: clamp(8px, 1.4cqh, 11px);
		font-weight: 1000;
		letter-spacing: 0.14em;
		text-align: center;
		text-shadow: 0 2px 2px #2a1403;
	}
	.panel-rows {
		display: grid;
		grid-template-rows: repeat(var(--slots, 5), 1fr);
		gap: clamp(3px, 0.6cqh, 6px);
	}
	.panel-row {
		display: grid;
		grid-template-columns: auto 1.5em auto 1fr;
		align-items: center;
		gap: 4px;
		min-height: clamp(19px, 3.4cqh, 28px);
		padding: 2px 6px;
		border: 2px solid #9ec652;
		border-radius: 999px;
		background: linear-gradient(#568c22, #23480f);
		box-shadow: inset 0 2px 0 rgb(255 244 164 / 22%);
		color: #f4ffdf;
		font-size: clamp(8px, 1.5cqh, 12px);
		font-weight: 1000;
	}
	.panel-row.vacant {
		border-color: rgb(158 198 82 / 26%);
		background: rgb(24 48 16 / 45%);
		box-shadow: none;
	}
	.panel-row img {
		width: 1.5em;
		height: 1.5em;
		object-fit: contain;
		filter: drop-shadow(0 1px 1px rgb(0 0 0 / 45%));
	}
	.panel-row strong {
		color: #ffe964;
		text-align: right;
		text-shadow: 0 2px 2px #2a1403;
	}
	.frame-highlight {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: inset 0 0 24px rgb(255 207 74 / 22%);
	}
	.scatter-tally {
		position: absolute;
		z-index: 9;
		left: 50%;
		/* Inside the frame, over the bottom row: below the board it collided with the HUD bar. */
		bottom: clamp(6px, 2.5cqh, 22px);
		transform: translateX(-50%);
		padding: clamp(3px, 0.7cqh, 7px) clamp(9px, 1.8cqh, 18px);
		border: 2px solid #ffdd65;
		border-radius: 999px;
		background: linear-gradient(#c98a22, #5e360a);
		box-shadow:
			inset 0 0 0 2px rgb(255 244 164 / 35%),
			0 6px 14px rgb(0 0 0 / 40%);
		color: #fff6cf;
		font-size: clamp(9px, 1.8cqh, 15px);
		font-weight: 1000;
		letter-spacing: 0.12em;
		white-space: nowrap;
		animation: card-in 220ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
	}
	.feature-ribbon {
		position: absolute;
		z-index: 9;
		top: 3%;
		left: 0;
		transform: translateX(-4%);
		padding: 6px 14px;
		border: 2px solid #ffdd65;
		border-radius: 0 10px 10px 0;
		background: #4f761a;
		box-shadow: 0 5px 12px #1d3c0c;
		font-size: 11px;
		font-weight: 1000;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}
	.bonus-status {
		position: absolute;
		top: 16%;
		right: 2.2%;
		z-index: 8;
		display: grid;
		width: min(150px, 13vw);
		padding: 12px 10px;
		border: 3px solid #754314;
		border-radius: 16px;
		background: linear-gradient(#426f20, #1e4215);
		box-shadow:
			inset 0 0 0 2px #d9ad3f,
			0 8px 20px rgb(0 0 0 / 28%);
		text-align: center;
	}
	.bonus-status span,
	.bonus-status small {
		color: #ffe15b;
		font-size: 9px;
		font-weight: 1000;
		letter-spacing: 0.09em;
	}
	.bonus-status strong {
		font-size: 23px;
	}
	.hud {
		position: absolute;
		z-index: 15;
		left: 50%;
		bottom: max(7px, 1vh);
		transform: translateX(-50%);
		display: grid;
		grid-template-columns: auto minmax(300px, 1fr) auto;
		align-items: center;
		gap: clamp(8px, 1.1vw, 18px);
		width: min(96vw, 1450px);
		min-height: 76px;
		padding: 8px 12px;
		border: 4px solid #774410;
		border-radius: 22px;
		background: linear-gradient(#593407, #2a1904);
		box-shadow:
			inset 0 0 0 2px #bc8124,
			0 8px 22px rgb(0 0 0 / 42%);
	}
	.hud-left,
	.hud-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hud button {
		border: 0;
		color: white;
		font-weight: 1000;
		cursor: pointer;
	}
	.hud button:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	.round {
		display: grid;
		place-items: center;
		width: 46px;
		aspect-ratio: 1;
		border: 2px solid #c08b31 !important;
		border-radius: 50%;
		background: radial-gradient(circle at 40% 30%, #674310, #281704 70%);
		box-shadow: inset 0 0 0 2px #3d2607;
	}
	.round span {
		font-size: 20px;
		line-height: 1;
	}
	.round small {
		font-size: 6px;
		color: #ffe064;
	}
	.bonus-button,
	.chance {
		display: grid;
		min-width: 91px;
		min-height: 44px;
		place-content: center;
		padding: 4px 13px;
		border: 2px solid #ffc957 !important;
		border-radius: 12px;
		background: linear-gradient(#ffbd2e, #e17608);
		box-shadow: inset 0 2px #ffe88a;
	}
	.chance {
		min-width: 65px;
		background: linear-gradient(#688f28, #315c18);
		border-color: #bfe453 !important;
	}
	.chance.active {
		background: linear-gradient(#b7ec42, #568919);
		color: #173009;
		box-shadow: 0 0 13px #baff41;
	}
	.bonus-button span,
	.chance span {
		font-size: 12px;
	}
	.bonus-button small,
	.chance small {
		font-size: 7px;
		letter-spacing: 0.08em;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(10px, 2vw, 34px);
		min-width: 0;
	}
	.metric {
		display: grid;
		gap: 2px;
		min-width: 0;
		text-align: center;
	}
	.metric span {
		color: #e8b73e;
		font-size: 9px;
		font-weight: 1000;
		letter-spacing: 0.14em;
	}
	.metric strong {
		overflow: hidden;
		color: #fff;
		font-size: clamp(15px, 1.55vw, 25px);
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 2px #1a0c00;
	}
	.metric.win strong {
		color: #fff09b;
	}
	.bet-stepper {
		display: flex;
		gap: 4px;
	}
	.bet-stepper button {
		width: 34px;
		height: 34px;
		border: 2px solid #a97423 !important;
		border-radius: 50%;
		background: #342006;
		font-size: 20px;
	}
	.spin {
		position: relative;
		display: grid;
		place-items: center;
		width: 78px;
		aspect-ratio: 1;
		border: 5px solid #ffebad !important;
		border-radius: 50%;
		background: radial-gradient(circle, #ffc63d 0 35%, #ef8b0c 38% 65%, #7f4504 67%);
		box-shadow:
			inset 0 0 0 4px #ff9c12,
			0 4px 10px rgb(0 0 0 / 42%);
	}
	.spin span {
		font-size: 51px;
		line-height: 0.8;
		transform: translateY(-2px);
	}
	.spin span.stop {
		font-size: 22px;
		transform: none;
	}
	.event-overlay,
	.modal-layer {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		padding: 20px;
		background: rgb(14 32 5 / 57%);
		backdrop-filter: blur(5px);
	}
	.event-card {
		position: relative;
		width: min(520px, 88vw);
		padding: 32px;
		border: 6px solid #7a4510;
		border-radius: 30px;
		background: radial-gradient(circle at 50% 0, #759731, #294b16 65%, #19340f);
		box-shadow:
			inset 0 0 0 3px #f0c94b,
			0 20px 60px #122000;
		text-align: center;
		animation: card-in 0.46s cubic-bezier(0.17, 0.89, 0.32, 1.35);
	}
	.event-card::before {
		content: '';
		position: absolute;
		inset: 8px;
		border: 1px solid rgb(255 239 140 / 46%);
		border-radius: 20px;
		pointer-events: none;
	}
	.event-card h2 {
		margin: 4px 0;
		color: #fff073;
		font-size: clamp(27px, 4vw, 52px);
		line-height: 0.95;
		-webkit-text-stroke: 1px #482200;
		text-shadow: 0 4px #4c2606;
	}
	.event-card p {
		margin: 10px 0;
		font-weight: 1000;
		letter-spacing: 0.1em;
	}
	.event-card > strong {
		display: block;
		margin-top: 10px;
		font-size: clamp(30px, 5vw, 58px);
		color: #fff;
	}
	.event-card button {
		position: relative;
		z-index: 2;
		margin-top: 14px;
		padding: 12px 28px;
		border: 2px solid #ffe88a;
		border-radius: 999px;
		background: linear-gradient(#ffc53d, #eb800c);
		color: #2f1600;
		font-weight: 1000;
		cursor: pointer;
	}
	.sprout {
		color: #fff067;
		font-size: 27px;
	}
	.buy-panel {
		position: relative;
		width: min(920px, 94vw);
		padding: 25px;
		border: 6px solid #71410d;
		border-radius: 28px;
		background: linear-gradient(#416b20, #18360f);
		box-shadow:
			inset 0 0 0 3px #d5a63c,
			0 25px 70px #102008;
	}
	.buy-panel header {
		text-align: center;
	}
	.buy-panel header small {
		color: #d9ff78;
		font-weight: 900;
		letter-spacing: 0.2em;
	}
	.buy-panel h2 {
		margin: 2px 0 18px;
		color: #ffe45d;
		font-size: 34px;
		text-shadow: 0 3px #4c2500;
	}
	.close {
		position: absolute;
		z-index: 2;
		top: 10px;
		right: 12px;
		width: 38px;
		aspect-ratio: 1;
		border: 2px solid #d8ac3c;
		border-radius: 50%;
		background: #402409;
		color: #fff;
		font-size: 26px;
		cursor: pointer;
	}
	.buy-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}
	.buy-card {
		display: grid;
		grid-template-rows: 80px auto auto auto auto;
		justify-items: center;
		gap: 5px;
		min-width: 0;
		padding: 14px 8px;
		border: 2px solid #9ec652;
		border-radius: 18px;
		background: linear-gradient(#527d2a, #244615);
		color: #fff;
		cursor: pointer;
		box-shadow: inset 0 0 18px rgb(255 245 132 / 9%);
	}
	.buy-card:hover:not(:disabled) {
		transform: translateY(-3px);
		border-color: #ffe065;
	}
	.buy-card:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}
	.buy-card img {
		width: 80px;
		height: 80px;
		object-fit: contain;
		filter: drop-shadow(0 4px 3px #142407);
	}
	.buy-card span {
		color: #ffe769;
		font-weight: 1000;
		text-align: center;
	}
	.buy-card small {
		min-height: 24px;
		color: #dcf5b6;
		font-size: 8px;
		text-align: center;
	}
	.buy-card strong {
		font-size: 20px;
	}
	.buy-card em {
		color: #ffd05a;
		font-size: 11px;
		font-style: normal;
	}
	.buy-card .card-state {
		font-size: 10px;
		letter-spacing: 0.08em;
		color: #cfeaa0;
	}
	.buy-card.armed {
		border-color: #ffd166;
		background: linear-gradient(#c98a22, #6d3f0b);
		box-shadow:
			inset 0 0 18px rgb(255 226 132 / 22%),
			0 0 14px rgb(255 202 74 / 55%);
	}
	.buy-card.armed .card-state {
		color: #fff0bd;
	}
	.confirm-note {
		margin: 0;
		max-width: 260px;
		color: #ffd9a0;
		font-size: 11px;
	}
	.confirm-layer {
		z-index: 45;
		background: rgb(7 17 2 / 76%);
	}
	.confirm-panel,
	.auto-panel {
		position: relative;
		display: grid;
		justify-items: center;
		width: min(470px, 92vw);
		padding: 30px;
		border: 6px solid #71410d;
		border-radius: 28px;
		background: radial-gradient(circle at 50% 0, #648d2a, #18360f 70%);
		box-shadow:
			inset 0 0 0 3px #d5a63c,
			0 25px 70px #102008;
		text-align: center;
	}
	.confirm-panel > small,
	.auto-panel > small {
		color: #d9ff78;
		font-weight: 1000;
		letter-spacing: 0.18em;
	}
	.confirm-panel > img {
		width: 105px;
		height: 105px;
		object-fit: contain;
		filter: drop-shadow(0 5px 4px #102008);
	}
	.confirm-panel h2,
	.auto-panel h2 {
		margin: 2px 0 8px;
		color: #ffe45d;
		font-size: clamp(24px, 4vw, 38px);
		text-shadow: 0 3px #4c2500;
	}
	.confirm-panel p,
	.auto-panel p {
		margin: 4px 0 14px;
		color: #e3f6be;
		font-size: 12px;
	}
	.confirm-panel > strong {
		margin-bottom: 18px;
		color: #fff;
		font-size: 29px;
	}
	.confirm-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		width: 100%;
	}
	.confirm-actions button,
	.auto-start {
		min-height: 45px;
		border: 2px solid #dcad43;
		border-radius: 12px;
		color: #fff;
		font-weight: 1000;
		cursor: pointer;
	}
	.confirm-actions .cancel {
		background: #51330d;
	}
	.confirm-actions .accept,
	.auto-start {
		background: linear-gradient(#83bc36, #3f761b);
		box-shadow: inset 0 2px #bdec66;
	}
	.auto-panel {
		width: min(560px, 92vw);
	}
	.auto-options {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 7px;
		width: 100%;
		margin: 18px 0;
	}
	.auto-options button {
		min-width: 0;
		padding: 10px 3px;
		border: 2px solid #80601c;
		border-radius: 9px;
		background: #2d2008;
		color: #fff;
		font-weight: 1000;
		cursor: pointer;
	}
	.auto-options button.active {
		border-color: #efff83;
		background: #639429;
		box-shadow: 0 0 12px #b9f94b88;
	}
	.auto-start {
		width: 100%;
	}
	.auto-start:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.quick-menu {
		position: fixed;
		left: 2%;
		bottom: 100px;
		z-index: 40;
		display: grid;
		gap: 7px;
		width: 170px;
		padding: 10px;
		border: 2px solid #b8832b;
		border-radius: 14px;
		background: #2c1b07ee;
		box-shadow: 0 10px 30px #0008;
	}
	.quick-menu button {
		padding: 10px;
		border: 1px solid #7d5b1d;
		border-radius: 8px;
		background: #4a3010;
		color: #ffe270;
		font-weight: 900;
		cursor: pointer;
	}
	@keyframes trapdoor-exit {
		from {
			transform: none;
		}
		to {
			transform: translateY(var(--exit-offset)) scale(0.96, 1.08);
		}
	}
	/* Pure travel — no fade, no blur: the board clips its own overflow, so a symbol simply is not
	   there yet. A stretch along the fall axis carries the speed instead. */
	@keyframes gravity-fall {
		from {
			transform: translateY(var(--fall-offset)) scale(0.97, 1.06);
		}
		to {
			transform: translateY(0) scale(1, 1);
		}
	}
	/* Stone-hit: wide and short against the floor, springs back through a small bounce. Timings
	   mirror magnetic's squash (~190ms) / thump (45ms) / bounce (35ms) / settle (40ms) split. */
	@keyframes land-impact {
		0% {
			transform: none;
		}
		18% {
			transform: translateY(0) scale(1.13, 0.86);
		}
		38% {
			transform: translateY(-7%) scale(0.97, 1.05);
		}
		60% {
			transform: translateY(0) scale(1.03, 0.98);
		}
		80% {
			transform: translateY(-2%) scale(0.99, 1.01);
		}
		100% {
			transform: none;
		}
	}
	@keyframes scatter-throb {
		from {
			transform: scale(1);
			filter: brightness(1);
		}
		to {
			transform: scale(1.12);
			filter: brightness(1.28) drop-shadow(0 0 8px rgb(255 226 128 / 85%));
		}
	}
	@keyframes cluster-pulse {
		from {
			transform: scale(1);
			filter: brightness(1);
		}
		to {
			transform: scale(1.08);
			filter: brightness(1.24);
		}
	}
	@keyframes harvest {
		0% {
			transform: none;
			filter: brightness(1.2);
		}
		26% {
			transform: scale(1.18, 0.88);
			filter: brightness(1.9);
		}
		48% {
			transform: scale(0.94, 1.14) translateY(-8%);
			filter: brightness(2.2);
		}
		100% {
			transform: scale(0.06) rotate(14deg) translateY(6%);
			opacity: 0;
			filter: brightness(2.4);
		}
	}
	@keyframes grid-swap {
		from {
			transform: scale(0.9);
			opacity: 0;
			filter: brightness(1.5);
		}
		to {
			transform: scale(1);
			opacity: 1;
			filter: none;
		}
	}
	@keyframes card-in {
		from {
			transform: scale(0.72);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	@media (max-width: 980px) {
		.game-stage {
			top: 8%;
			bottom: max(14%, 100px);
			padding: 0 6px;
		}
		.bonus-status {
			top: 10px;
			right: 10px;
			width: 115px;
		}
		.hud {
			grid-template-columns: auto 1fr auto;
			gap: 6px;
			min-height: 65px;
			padding: 5px 7px;
		}
		.chance {
			display: none;
		}
		.bonus-button {
			min-width: 72px;
			padding: 4px 8px;
		}
		.round {
			width: 38px;
		}
		.spin {
			width: 62px;
		}
		.spin span {
			font-size: 40px;
		}
		.bet-stepper {
			display: none;
		}
		.metrics {
			gap: 7px;
		}
		.metric strong {
			font-size: 15px;
		}
	}
	@media (max-width: 680px) {
		.brand {
			top: 5px;
			padding: 4px 15px 6px;
		}
		.brand small,
		.brand-leaf {
			display: none;
		}
		.game-stage {
			top: 7%;
			bottom: max(16%, 96px);
			padding: 0 4px;
		}
		.board-frame {
			padding: 7px;
			border-width: 7px;
			border-radius: 10px;
		}
		.hud {
			width: 99vw;
			bottom: 3px;
			grid-template-columns: auto 1fr auto;
			border-width: 3px;
			border-radius: 14px;
		}
		.hud-left .utility,
		.auto {
			display: none;
		}
		.bonus-button {
			min-width: 64px;
		}
		.metric.balance {
			display: none;
		}
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.buy-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.buy-panel {
			padding: 18px 12px;
		}
		.buy-panel h2 {
			font-size: 25px;
		}
	}
	@media (max-height: 650px) and (orientation: landscape) {
		.brand {
			top: 2px;
			transform: translateX(-50%) scale(0.76);
			transform-origin: top center;
		}
		.game-stage {
			/* Only the top moves here — the bottom inset stays with the width breakpoints, which are
			   the ones that actually change the HUD's height. */
			top: 5%;
		}
		.hud {
			min-height: 58px;
		}
		.bonus-status {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 1ms !important;
			transition-duration: 1ms !important;
		}
	}
</style>

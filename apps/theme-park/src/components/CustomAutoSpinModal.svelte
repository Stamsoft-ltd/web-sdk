<script lang="ts">
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	type Props = { onclose: () => void };
	const props: Props = $props();
	const context = getContext();
	const t = (key: string) => i18nDerived.translate(key);

	const OPTIONS = [5, 10, 25, 50, 100, 200, 500];
	let selected = $state(25);
	let stopOnBonus = $state(context.stateGame.stopAutoOnBonus);
	const isTurbo = $derived(stateBet.isTurbo && !stateBet.isSuperTurbo);
	const isSuperTurbo = $derived(stateBet.isSuperTurbo);

	const toggleTurbo = () => {
		if (isTurbo) stateBet.isTurbo = false;
		else {
			stateBet.isTurbo = true;
			stateBet.isSuperTurbo = false;
		}
	};
	const toggleSuperTurbo = () => {
		if (isSuperTurbo) stateBet.isSuperTurbo = false;
		else {
			stateBet.isSuperTurbo = true;
			stateBet.isTurbo = false;
		}
	};

	const start = (count: number | typeof Infinity) => {
		context.stateGame.stopAutoOnBonus = stopOnBonus;
		if (stateBet.activeBetModeKey === 'DUCK' || stateBet.activeBetModeKey === 'ROLLER' || stateBet.activeBetModeKey === 'COASTER') {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateBet.autoSpinsCounter = count;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'autoBet' });
	};
</script>

<button class="backdrop" type="button" aria-label={t('CLOSE AUTOPLAY')} onclick={props.onclose}></button>
<div class="panel" role="dialog" aria-modal="true">
	<div class="panel__header">
		<span class="panel__title">{t('AUTOPLAY')}</span>
		<button class="panel__close" type="button" onclick={props.onclose} aria-label={t('CLOSE')}>✕</button>
	</div>

	<div class="panel__body">
		<p class="panel__label">{t('NUMBER OF SPINS')}</p>
		<div class="options-grid">
			{#each OPTIONS as n (n)}
				<button
					class="option-btn"
					class:option-btn--selected={selected === n}
					type="button"
					onclick={() => (selected = n)}
				>{n}</button>
			{/each}
		</div>

		<div class="auto-toggle-list">
			<div class="stop-on-bonus" class:sob--active={isTurbo}>
				<span class="sob__label">{t('TURBO SPIN')}</span>
				<button
					class="sob__switch"
					class:sob__switch--on={isTurbo}
					type="button"
					onclick={toggleTurbo}
					aria-pressed={isTurbo}
					aria-label={t('TURBO SPIN')}
				><span class="sob__track"><span class="sob__thumb"></span></span></button>
			</div>
			<div class="stop-on-bonus" class:sob--active={isSuperTurbo}>
				<span class="sob__label">{t('SUPER TURBO SPIN')}</span>
				<button
					class="sob__switch"
					class:sob__switch--on={isSuperTurbo}
					type="button"
					onclick={toggleSuperTurbo}
					aria-pressed={isSuperTurbo}
					aria-label={t('SUPER TURBO SPIN')}
				><span class="sob__track"><span class="sob__thumb"></span></span></button>
			</div>
			<div class="stop-on-bonus" class:sob--active={stopOnBonus}>
				<span class="sob__label">{t('STOP ON BONUS')}</span>
				<button
					class="sob__switch"
					class:sob__switch--on={stopOnBonus}
					type="button"
					onclick={() => (stopOnBonus = !stopOnBonus)}
					aria-pressed={stopOnBonus}
					aria-label={t('STOP ON BONUS')}
				>
					<span class="sob__track"><span class="sob__thumb"></span></span>
				</button>
			</div>
		</div>

			<div class="actions">
			<button class="start-btn" type="button" onclick={() => start(selected)}>
				{t('START')} {selected} {t('SPINS')}
			</button>
			<button class="infinite-btn" type="button" onclick={() => start(Infinity)}>
				∞ {t('UNLIMITED')}
			</button>
		</div>
	</div>
</div>



<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		border: 0;
		padding: 0;
	}

	.panel {
		position: fixed;
		bottom: 110px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 59;
		width: min(360px, 90vw);
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(28, 32, 18, 0.98), rgba(10, 12, 8, 0.99));
		border: 1px solid rgba(231, 196, 112, 0.35);
		box-shadow: 0 20px 44px rgba(0, 0, 0, 0.65);
		overflow: hidden;
	}

	.panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 12px;
		border-bottom: 1px solid rgba(231, 196, 112, 0.18);
	}

	.panel__title {
		font-family: 'Cinzel', serif;
		font-size: 1rem;
		font-weight: 900;
		color: #ffd84a;
		letter-spacing: 0.1em;
	}

	.panel__close {
		border: none;
		background: none;
		color: rgba(255, 255, 255, 0.4);
		font-size: 1rem;
		cursor: pointer;
		padding: 2px 6px;
	}

	.panel__body {
		padding: 16px 18px 18px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.panel__label {
		font-family: 'Cinzel', serif;
		font-size: 0.65rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.45);
		letter-spacing: 0.08em;
		margin: 0;
	}

	.options-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.option-btn {
		border: 1px solid rgba(188, 141, 39, 0.35);
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.03);
		color: rgba(255, 255, 255, 0.65);
		font-family: 'Cinzel', serif;
		font-size: 0.9rem;
		font-weight: 700;
		padding: 10px 6px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.option-btn:hover,
	.option-btn--selected {
		border-color: #ffd84a;
		background: rgba(255, 216, 74, 0.1);
		color: #ffd84a;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.start-btn {
		width: 100%;
		padding: 14px;
		border: none;
		border-radius: 14px;
		background: linear-gradient(180deg, #f0d068 0%, #c09224 100%);
		color: #17200f;
		font-family: 'Cinzel', serif;
		font-size: 0.9rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.start-btn:hover { opacity: 0.9; }

	.infinite-btn {
		width: 100%;
		padding: 11px;
		border: 1px solid rgba(188, 141, 39, 0.4);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.03);
		color: rgba(255, 255, 255, 0.55);
		font-family: 'Cinzel', serif;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		cursor: pointer;
		transition: all 0.15s;
	}

	.infinite-btn:hover {
		border-color: #ffd84a;
		color: #ffd84a;
	}

	.stop-on-bonus {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border: 1px solid rgba(188, 141, 39, 0.25);
		border-radius: 12px;
		background: rgba(255,255,255,0.03);
		transition: border-color 0.2s;
	}
	.auto-toggle-list {
		display: grid;
		gap: 8px;
	}
	.sob--active { border-color: rgba(255, 216, 74, 0.5); }

	.sob__label {
		font-family: 'Cinzel', serif;
		font-size: 0.72rem;
		font-weight: 700;
		color: rgba(255,255,255,0.6);
		letter-spacing: 0.06em;
	}
	.sob--active .sob__label { color: #ffd84a; }

	.sob__switch { border: none; background: none; padding: 0; cursor: pointer; }
	.sob__track {
		display: block; position: relative;
		width: 38px; height: 20px; border-radius: 20px;
		background: rgba(80,80,80,0.8); transition: background 0.25s;
	}
	.sob__switch--on .sob__track { background: #ffd84a; }
	.sob__thumb {
		display: block; position: absolute;
		top: 3px; left: 3px;
		width: 14px; height: 14px; border-radius: 50%;
		background: #fff; transition: transform 0.25s;
		box-shadow: 0 1px 4px rgba(0,0,0,0.4);
	}
	.sob__switch--on .sob__thumb { transform: translateX(18px); }
</style>

<script lang="ts">
	import { stateI18nDerived } from 'state-shared';

	type Props = { onstart: () => void };
	const props: Props = $props();
	const t = (key: string) => stateI18nDerived.translate(key);
	let started = false;
	const start = () => {
		if (started) return;
		started = true;
		props.onstart();
	};
	const handleKey = (event: KeyboardEvent) => {
		if (event.key !== 'Enter' && event.code !== 'Space') return;
		event.preventDefault();
		start();
	};
</script>

<svelte:window onkeydown={handleKey} />

<div
	class="splash-screen"
	role="button"
	tabindex="0"
	aria-label={t('CLICK ANYWHERE TO CONTINUE')}
	style="--splash-background:url('./assets/veggie-salad/pixel/background.png')"
	onclick={start}
	onkeydown={handleKey}
>
	<img
		class="studio-logo"
		src="./assets/veggie-salad/pixel/loading/press_play_logo.webp"
		alt="Press Play"
	/>
	<img class="game-logo" src="./assets/veggie-salad/pixel/logo.png" alt="Veggie Salad" />
	<div class="splash-panels">
		<div>
			<strong>{t('WELCOME TO')}<br />{t('THE GARDEN')}</strong>
			<span>{t('SPLASH GARDEN COPY')}</span>
		</div>
		<div>
			<strong>{t('3 UNIQUE')}<br />{t('BONUSES')}</strong>
			<span>{t('SPLASH BONUS COPY')}</span>
		</div>
		<div>
			<strong>{t('MAX WIN')}<br />25,000×</strong>
			<span>{t('SPLASH MAX COPY')}</span>
		</div>
	</div>
	<p class="continue-label">{t('CLICK ANYWHERE TO CONTINUE')}</p>
</div>

<style>
	.splash-screen {
		position: fixed;
		inset: 0;
		z-index: 110;
		display: grid;
		grid-template-rows: auto auto auto auto;
		place-content: center;
		justify-items: center;
		gap: clamp(8px, 1.6vh, 20px);
		padding: 16px;
		/* The source garden has transparent sky/edge pixels. Green under the lower half prevents the
		   sky colour leaking through beneath the foreground grass on narrow crops. */
		background:
			var(--splash-background) center / cover no-repeat,
			linear-gradient(#1598e2 0 58%, #559f2a 58% 100%);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		image-rendering: pixelated;
		cursor: pointer;
		outline: none;
	}
	.studio-logo {
		width: min(170px, 24vw);
		height: auto;
		filter: drop-shadow(2px 3px 0 rgb(0 45 83 / 45%));
	}
	.game-logo {
		width: min(760px, 72vw);
		height: auto;
		image-rendering: pixelated;
	}
	.splash-panels {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		width: min(900px, 88vw);
		border: 7px solid #6d390d;
		background: #213813;
		box-shadow:
			inset 0 0 0 3px #c98220,
			7px 8px 0 #351a07;
	}
	.splash-panels div {
		display: grid;
		align-content: center;
		gap: 14px;
		min-height: clamp(130px, 22vh, 190px);
		padding: 20px;
		border-left: 4px solid #75400e;
		text-align: center;
	}
	.splash-panels div:first-child {
		border-left: 0;
	}
	.splash-panels strong {
		color: #efae3c;
		font-size: clamp(17px, 2vw, 30px);
		line-height: 1.45;
	}
	.splash-panels div:nth-child(2) strong {
		color: #8fc33c;
	}
	.splash-panels div:nth-child(3) strong {
		color: #8dbfff;
	}
	.splash-panels span {
		color: #fff;
		font-size: clamp(10px, 1vw, 15px);
		line-height: 1.45;
	}
	.continue-label {
		margin: 4px 0 0;
		color: #fff1a8;
		font-size: clamp(11px, 1.45vw, 20px);
		font-weight: 900;
		letter-spacing: 0.1em;
		text-shadow: 3px 3px 0 #351a07;
		animation: continue-blink 1.2s steps(2, end) infinite;
	}
	@keyframes continue-blink {
		50% {
			opacity: 0.45;
		}
	}
	@media (max-width: 680px) {
		.splash-screen {
			gap: 10px;
			padding: 10px;
		}
		.studio-logo {
			width: min(140px, 38vw);
		}
		.game-logo {
			width: 94vw;
		}
		.splash-panels {
			width: 94vw;
			border-width: 4px;
		}
		.splash-panels div {
			min-height: clamp(86px, 20vh, 124px);
			padding: 8px 5px;
			border-left-width: 2px;
		}
		.splash-panels strong {
			font-size: clamp(10px, 3.2vw, 16px);
		}
		.splash-panels span {
			font-size: 8px;
		}
	}

	@media (max-width: 520px) and (max-height: 300px) and (orientation: landscape) {
		.splash-screen {
			grid-template-rows: auto auto auto auto;
			gap: 2px;
			padding: 3px;
			place-content: center;
		}
		.studio-logo {
			width: 52px;
		}
		.game-logo {
			width: min(220px, 56vw);
		}
		.splash-panels {
			width: min(390px, calc(100vw - 8px));
			border-width: 3px;
			box-shadow:
				inset 0 0 0 1px #c98220,
				3px 3px 0 #351a07;
		}
		.splash-panels div {
			gap: 2px;
			min-height: 76px;
			padding: 3px 4px;
			border-left-width: 2px;
		}
		.splash-panels strong {
			font-size: 8px;
			line-height: 1.15;
		}
		.splash-panels span {
			font-size: 5px;
			line-height: 1.1;
		}
		.continue-label {
			margin: 1px 0 0;
			font-size: 6px;
			line-height: 1;
			text-shadow: 1px 1px 0 #351a07;
		}
	}
</style>

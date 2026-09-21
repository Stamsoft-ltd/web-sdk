<script lang="ts" module>
	import { sound, type MusicName, type SoundEffectName, type SoundName } from '../game/sound';

	export type EmitterEventSound =
		| { type: 'soundMusic'; name: MusicName }
		| { type: 'soundOnce'; name: SoundEffectName; forcePlay?: boolean }
		| { type: 'soundLoop'; name: SoundEffectName }
		| { type: 'soundStop'; name: SoundName }
		| { type: 'soundFade'; name: SoundName; from: number; to: number; duration: number };
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	/* The ten delivered sounds (audio-src/README.txt), tied to the game the way the reference
	   games tie theirs (forest-gang's Sound.svelte): the music follows the game type, the jingles
	   follow the bonus placards, the win loops follow the win presentation, and the reel and
	   button sounds follow the board's phase and the pointer. Everything is read off stateGame,
	   which every book handler already drives, so no handler had to learn about audio. */
	const context = getContext();
	const { stateGame } = context;

	const MUSIC: MusicName[] = ['bgm_base', 'bgm_bonus', 'bgm_bigwin'];

	/* The music player pauses every other track when one starts, and resumes a paused one where
	   it left off — so base and bonus swap without either restarting from the top. */
	const playMusic = (name: MusicName) => sound.players.music.play({ name });
	const stopMusic = (...names: MusicName[]) => names.forEach((name) => sound.stop({ name }));

	const inBonus = () => ['normal', 'super', 'hidden'].includes(stateGame.gameType);
	const currentMusic = (): MusicName => (inBonus() ? 'bgm_bonus' : 'bgm_base');

	context.eventEmitter.subscribeOnMount({
		soundPressGeneral: () => sound.players.once.play({ name: 'sfx_button', forcePlay: true }),
		soundPressBet: () => sound.players.once.play({ name: 'sfx_button', forcePlay: true }),
		soundMusic: ({ name }) => playMusic(name),
		soundLoop: ({ name }) => sound.players.loop.play({ name }),
		soundOnce: ({ name, forcePlay }) => sound.players.once.play({ name, forcePlay }),
		soundStop: ({ name }) => sound.stop({ name }),
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
	});

	/* Background music: the base loop in the base game and feature spins, the bonus loop through
	   a bonus. Held off while a placard is up, because the placards carry their own music — and
	   after the bonus's final total, held until the game type has actually returned to the base
	   game, or the bonus loop would come back for the beat between the sign and finalWin. */
	let afterOutro = false;
	$effect(() => {
		const overlay = stateGame.overlay;
		const music = currentMusic();
		if (overlay) return;
		if (afterOutro && music === 'bgm_bonus') return;
		afterOutro = false;
		playMusic(music);
	});

	/* Placards. The bonus entry sign plays the entering jingle once over silence; the bonus's
	   final total sign plays the ending music; a win sign loops the small-win bed for a plain WIN
	   over the music ducked to a tenth ("reduce the background sound to 10% and after it hides
	   resume it", user 2026-09-21), and the big-win bed for every titled tier over the music
	   ducked to a quarter. The duck remembers its level so the resume fades from where it left. */
	let ducked: { name: MusicName; level: number } | null = null;
	const duck = (level: number) => {
		ducked = { name: currentMusic(), level };
		void sound.fade({ name: ducked.name, from: 1, to: level, duration: 250 });
	};
	$effect(() => {
		const overlay = stateGame.overlay;
		if (!overlay) {
			sound.stop({ name: 'sfx_win_loop' });
			stopMusic('bgm_bigwin');
			if (ducked) {
				void sound.fade({ name: ducked.name, from: ducked.level, to: 1, duration: 400 });
				ducked = null;
			}
			return;
		}
		if (overlay.kind === 'bonus') {
			stopMusic(...MUSIC);
			sound.players.once.play({ name: 'jng_bonus_intro', forcePlay: true });
		} else if (overlay.kind === 'win' && overlay.bonusPresentation === 'end') {
			stopMusic(...MUSIC);
			afterOutro = true;
			sound.players.once.play({ name: 'jng_bonus_outro', forcePlay: true });
		} else if (overlay.kind === 'win') {
			if (overlay.title === 'WIN') {
				duck(0.1);
				sound.players.loop.play({ name: 'sfx_win_loop' });
			} else {
				duck(0.25);
				sound.players.music.play({ name: 'bgm_bigwin' });
			}
		}
		return () => {
			sound.stop({ name: 'jng_bonus_intro' });
			sound.stop({ name: 'jng_bonus_outro' });
		};
	});

	/* Reels. The fall plays as a spin or a tumble starts dropping symbols and is cut when the
	   drop settles (`phase` back to idle). `forcePlay` because tumbles come faster than the clips
	   end. */
	let lastPhase = stateGame.phase;
	$effect(() => {
		const phase = stateGame.phase;
		const previous = lastPhase;
		lastPhase = phase;
		if (phase === 'spinning' || phase === 'dropping') {
			sound.players.once.play({ name: 'sfx_reels_fall', forcePlay: true });
		} else if (phase === 'idle' && (previous === 'spinning' || previous === 'dropping')) {
			sound.stop({ name: 'sfx_reels_fall' });
		}
	});

	/* The landing thud follows the symbols, not the phase: every cell that drops runs the board's
	   `land-impact` animation the moment it touches down (bottom row first, a column stagger and
	   a per-cell jitter on top), and each of those starts is a thud — throttled, because a row's
	   cells land within a few ms of each other and would otherwise stack eight copies of the
	   clip. A scatter chimes as its own cell lands. Svelte hashes the keyframe name, hence the
	   suffix match. */
	const LAND_GAP_MS = 70;
	onMount(() => {
		let lastLand = 0;
		const onLand = (event: AnimationEvent) => {
			if (!event.animationName.endsWith('land-impact')) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const cell = target.closest('.cell');
			if (!cell) return;
			const now = performance.now();
			if (now - lastLand >= LAND_GAP_MS) {
				lastLand = now;
				sound.players.once.play({ name: 'sfx_reels_land', forcePlay: true });
			}
			if (cell.querySelector('.symbol-scatter')) {
				sound.players.once.play({ name: 'sfx_scatter_land', forcePlay: true });
			}
		};
		window.addEventListener('animationstart', onLand, true);
		return () => window.removeEventListener('animationstart', onLand, true);
	});

	/* A cluster chimes as it lights (`clusterWin` → 'winning', once per tumble step, since the
	   harvest and refill take the phase away in between). The multiplier chime whenever any
	   cluster of the step pays through a multiplier — the same `appliedMultiplier > 1` test the
	   board's "× N" tag uses — the plain one otherwise. */
	$effect(() => {
		if (stateGame.phase !== 'winning') return;
		const multiplied = stateGame.winningClusters.some((cluster) => cluster.appliedMultiplier > 1);
		sound.players.once.play({
			name: multiplied ? 'sfx_cluster_multi' : 'sfx_cluster',
			forcePlay: true,
		});
	});

	/* The scatter hold (a trigger, a retrigger, a mystery pick) chimes again as the count lights. */
	$effect(() => {
		if (stateGame.scatterPositions.length) {
			sound.players.once.play({ name: 'sfx_scatter_land', forcePlay: true });
		}
	});

	/* Every button in the game clicks: the HUD, the quick menu, the bonus and autoplay panels, the
	   info pages. Delegated, so the prototype's dozens of buttons need no wiring of their own. */
	onMount(() => {
		const onClick = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const button = target.closest('button');
			if (!button || button.disabled || button.classList.contains('continue-gate')) return;
			sound.players.once.play({ name: 'sfx_button', forcePlay: true });
		};
		window.addEventListener('click', onClick, true);
		return () => window.removeEventListener('click', onClick, true);
	});
</script>

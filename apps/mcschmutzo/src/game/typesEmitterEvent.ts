import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventBoardFrame } from '../components/BoardFrame.svelte';
import type { EmitterEventFreeSpinIntro } from '../components/FreeSpinIntro.svelte';
import type { EmitterEventFreeSpinCounter } from '../components/FreeSpinCounter.svelte';
import type { EmitterEventFreeSpinOutro } from '../components/FreeSpinOutroHtml.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventBoardWinPop } from '../components/BoardWinPop.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventTransition } from '../components/Transition.svelte';
import type { EmitterEventSauceWipe } from '../components/SauceWipeHtml.svelte';
import type { EmitterEventFinalSpin } from '../components/FinalSpinHtml.svelte';
import type { EmitterEventBonusEnding } from '../components/BonusEndingHtml.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventBoardFrame
	| EmitterEventWin
	| EmitterEventBoardWinPop
	| EmitterEventFreeSpinIntro
	| EmitterEventFreeSpinCounter
	| EmitterEventFreeSpinOutro
	| EmitterEventSound
	| EmitterEventTransition
	| EmitterEventSauceWipe
	| EmitterEventFinalSpin
	| EmitterEventBonusEnding;

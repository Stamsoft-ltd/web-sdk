import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventBonusSymbolPanel } from '../components/BonusSymbolPanel.svelte';
import type { EmitterEventFreeSpinIntro } from '../components/FreeSpinIntro.svelte';
import type { EmitterEventFreeSpinCounter } from '../components/FreeSpinCounter.svelte';
import type { EmitterEventFreeSpinOutro } from '../components/FreeSpinOutro.svelte';
import type { EmitterEventExpandedSymbolPresenter } from '../components/ExpandedSymbolPresenter.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventSound } from '../components/Sound.svelte';
import type { EmitterEventTransition } from '../components/Transition.svelte';
import type { EmitterEventDealItMultiplier } from '../components/DealItMultiplierPanel.svelte';
import type { EmitterEventGlobalMultiplier } from '../components/GlobalMultiplier.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventBonusSymbolPanel
	| EmitterEventWin
	| EmitterEventFreeSpinIntro
	| EmitterEventFreeSpinCounter
	| EmitterEventFreeSpinOutro
	| EmitterEventExpandedSymbolPresenter
	| EmitterEventSound
	| EmitterEventTransition
	| EmitterEventDealItMultiplier
	| EmitterEventGlobalMultiplier;

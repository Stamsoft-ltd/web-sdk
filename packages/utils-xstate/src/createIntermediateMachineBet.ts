import { setup, fromPromise, assign } from 'xstate';

import { stateBet } from 'state-shared';

import { context, type Context } from './machineContext';
import type { PrimaryMachines } from './types';
import { resetOneShotBetMode } from './resetOneShotBetMode';

const checkSpaceHold = fromPromise(async () => {
	// The buy-mode reset used to sit inside the space-hold branch only, so an ordinary buy left
	// activeBetModeKey on the bonus mode after the round (see resetOneShotBetMode).
	resetOneShotBetMode();

	if (stateBet.isSpaceHold) return;
	throw Error('end bet');
});

export const createIntermediateMachineBet = ({
	newGame,
	playGame,
	endGame,
}: {
	newGame: PrimaryMachines['newGame'];
	playGame: PrimaryMachines['playGame'];
	endGame: PrimaryMachines['endGame'];
}) => {
	const machine =
		/** @xstate-layout N4IgpgJg5mDOIC5QCMwBcB0BLCAbMAxAEICiAKoqAA4D2sWaWNAdpSAB6ICMATAGwYADMMFcA7Dy4BWQQBZZgsQBoQAT24BmMRlkBOfQA4+fXWNl8pu2QF9rK1JgBm6AMYALLMygEILMNmYANxoAa38AWwBXNABDRhYidDZaenjWJA5EKQ0BWS0pHlMNGTE+FXUELlEMGRENXV4pKtFbe3QMZzR3T28wACc+mj6MKlw4xyHwjCjYtMS0ZLoGJnTQTgRs3PzCsWLFMrVEHjFBHX1TWXEzDQ0DGzsQBxGx1R8-AOCw55iK6iW0tjrKxcDAGRo8MEnRQ8crcHinc76QpSMxg3R8WwPZg0CBwNhPHD4RapFaAxCyGGHSoaEGI0oFPT1XStR7tTrdLzE5YsMkIeEGDC6O71LQGYSyMXKKlVXKIvhGc5cUwsp6jH5cgEZdYSXQYDQQrjmBrCKQHCq6U4iYQ0jQiMUaFXtMDMCAa0la7iKbSSAxiX2m4ToykVXgaQXnE5+iwNIyOhYZFLc1aZSoGWGpoRWrNWsSY6xAA */
		setup({
			types: {} as {
				context: Context;
			},
			actors: {
				newGame,
				playGame,
				endGame,
				checkSpaceHold,
			},
		}).createMachine({
			context,
			id: 'bet',
			initial: 'fetching',
			states: {
				fetching: {
					invoke: {
						id: 'newGame',
						src: 'newGame',
						onDone: [
							{
								actions: assign(({ context: _, event }) => event.output),
								target: 'play',
							},
						],
						// output: ,
						onError: [
							{
								target: 'end',
							},
						],
					},
				},
				play: {
					invoke: {
						id: 'playGame',
						src: 'playGame',
						input: ({ context }) => ({
							bet: context.bet,
						}),
						onDone: [
							{
								target: 'ending',
							},
						],
						// A throwing book-event handler must not strand the machine in 'play'
						// (dead spin button, round left open on the RGS). Still run 'ending' so
						// the round is settled server-side and the balance updates.
						onError: [
							{
								actions: ({ event }) => {
									console.error('playGame failed', event.error);
									stateBet.autoSpinsCounter = 0;
								},
								target: 'ending',
							},
						],
					},
				},
				ending: {
					invoke: {
						id: 'endGame',
						src: 'endGame',
						input: ({ context }) => ({
							bet: context.bet,
							rawBet: context.rawBet,
						}),
						onDone: [
							{
								target: 'checkSpaceHold',
							},
						],
						onError: [
							{
								actions: ({ event }) => console.error('endGame failed', event.error),
								target: 'end',
							},
						],
					},
				},
				checkSpaceHold: {
					invoke: {
						id: 'checkSpaceHold',
						src: 'checkSpaceHold',
						onDone: 'fetching',
						onError: 'end',
					},
				},
				end: {
					// Also reached straight from a failed newGame / endGame, which skip checkSpaceHold.
					entry: () => resetOneShotBetMode(),
					type: 'final',
				},
			},
		});

	return machine;
};

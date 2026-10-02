import { setup, assign } from 'xstate';

import { context, type Context } from './machineContext';
import type { PrimaryMachines } from './types';
import { resetOneShotBetMode } from './resetOneShotBetMode';

export const createIntermediateMachineResumeBet = (actors: {
	resumeGame: PrimaryMachines['resumeGame'];
	playGame: PrimaryMachines['playGame'];
	endGame: PrimaryMachines['endGame'];
}) => {
	const machine =
		/** @xstate-layout N4IgpgJg5mDOIC5QCMwBcB0BLCAbMAxAEICiAKoqAA4D2sWaWNAdpSAB6ICMATAGwYADMMFcA7Dy4BWQQBZZgsQBoQAT24BmMRlkBOfQA4+fXWNl8pu2QF9rK1JgBm6AMYALLMygEILMNmYANxoAa38AWwBXNABDRhYidDZaenjWJA5EKQ0BWS0pHlMNGTE+FXUELlEMGRENXV4pKtFbe3QMZzR3T28wACc+mj6MKlw4xyHwjCjYtMS0ZLoGJnTQTgRs3PzCsWLFMrVEHjFBHX1TWXEzDQ0DGzsQBxGx1R8-AOCw55iK6iW0tjrKxcDAGRo8MEnRQ8crcHinc76QpSMxg3R8WwPZg0CBwNhPHD4RapFaAxCyGGHSoaEGI0oFPT1XStR7tTrdLzE5YsMkIeEGDC6O71LQGYSyMXKKlVXKIvhGc5cUwsp6jH5cgEZdYSXQYDQQrjmBrCKQHCq6U4iYQ0jQiMUaFXtMDMCAa0la7iKbSSAxiX2m4ToykVXgaQXnE5+iwNIyOhYZFLc1aZSoGWGpoRWrNWsSY6xAA */
		setup({
			types: {} as {
				context: Context;
			},
			actors,
		}).createMachine({
			context,
			id: 'resumeBet',
			initial: 'resumeGame',
			states: {
				resumeGame: {
					invoke: {
						id: 'resumeGame',
						src: 'resumeGame',
						onDone: [
							{
								actions: assign(({ context: _, event }) => event.output),
								target: 'play',
							},
						],
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
						// A throwing handler on the resume path is unrecoverable without this:
						// betToResume is already nulled, so strand-in-'play' forces a reload.
						// Still run 'ending' so the resumed round settles server-side.
						onError: [
							{
								actions: ({ event }) => console.error('playGame failed on resume', event.error),
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
								target: 'end',
							},
						],
						onError: [
							{
								actions: ({ event }) => console.error('endGame failed on resume', event.error),
								target: 'end',
							},
						],
					},
				},
				end: {
					// A resumed bonus round restores the bought mode (Authenticate sets it from the
					// round); clear it once the round settles so the next spin is not priced as a buy.
					entry: () => resetOneShotBetMode(),
					type: 'final',
				},
			},
		});

	return machine;
};

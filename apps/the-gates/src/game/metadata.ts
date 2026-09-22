import { stateMeta } from 'state-shared';
import { COSTS, type Mode } from './contract';
export function initMetadata() {
	stateMeta.betModeMeta = Object.fromEntries(
		Object.entries(COSTS).map(([mode, cost]) => [
			mode,
			{
				mode,
				costMultiplier: cost,
				type:
					mode === 'BASE' ? 'default' : ['CHANCE', 'FEATURE'].includes(mode) ? 'activate' : 'buy',
				parent: '',
				children: '',
				maxWin: 25000,
				assets: { icon: '', volatility: '', button: '', dialogImage: '', dialogVolatility: '' },
				text: {
					title: mode,
					dialog: mode,
					button: 'PLAY',
					tickerIdle: 'THE GATES',
					tickerSpin: 'THE GATES',
				},
			},
		]),
	);
}
export const modeKeys = Object.keys(COSTS) as Mode[];

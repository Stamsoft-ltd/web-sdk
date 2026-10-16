import { stateMeta } from 'state-shared';
import { COSTS, type Mode } from './contract';
export function initMetadata(translate: (key: string) => string = (key) => key) {
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
					title: translate(mode),
					dialog: translate(`${mode} DESC`),
					button: translate(
						mode === 'BASE' ? 'PLAY' : ['CHANCE', 'FEATURE'].includes(mode) ? 'ACTIVATE' : 'BUY',
					),
					tickerIdle: 'THE GATES',
					tickerSpin: 'THE GATES',
				},
			},
		]),
	);
}
export const modeKeys = Object.keys(COSTS) as Mode[];

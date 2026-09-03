import source from './magneticCommon/es';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BONO',
	bonuses: 'BONOS',
	earned: 'ACUMULADO',
	garden: 'EL JARDÍN',
	welcome: 'BIENVENIDO A',
	gameBoard: 'Tablero de Veggie Salad',
	clusterPayouts: 'PAGOS POR GRUPOS',
	vegetables: ['BRÓCOLI', 'MAÍZ', 'TOMATE', 'BERENJENA', 'ZANAHORIA', 'COLIFLOR', 'RÁBANO'],
	normalBonus: 'BONO NORMAL',
	superBonus: 'SÚPER BONO',
	hiddenBonus: 'BONO OCULTO',
	mysteryBonus: 'BONO MISTERIOSO',
	featureSpin: 'GIRO ESPECIAL',
	guaranteedCluster: 'GRUPO GANADOR GARANTIZADO',
	bonusChance: 'PROBABILIDAD DE BONO',
	active: 'ACTIVO',
	harvest: 'ELIGE TU COSECHA',
	skip: 'SALTAR',
	toggle: 'ALTERNAR',
	tumbleTitle: 'CASCADAS',
	tumbleText:
		'Los símbolos ganadores se eliminan y caen símbolos nuevos hasta que no se forme otro grupo.',
	multiplierTitle: 'MULTIPLICADORES',
	multiplierText:
		'Todos los multiplicadores de un grupo ganador se multiplican entre sí y se aplican al premio.',
	bonusRule:
		'3 scatters activan el Bono Normal, 4 el Súper Bono y el Bono Oculto usa una cuadrícula 10×10.',
	controls: 'CONTROLES',
	splashGarden: 'Forma grupos, haz caer verduras y descubre sorpresas del jardín.',
});

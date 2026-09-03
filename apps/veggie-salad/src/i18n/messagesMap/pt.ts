import source from './magneticCommon/pt';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BÔNUS',
	bonuses: 'BÔNUS',
	earned: 'ACUMULADO',
	garden: 'O JARDIM',
	welcome: 'BEM-VINDO AO',
	gameBoard: 'Tabuleiro Veggie Salad',
	clusterPayouts: 'PRÊMIOS DE GRUPOS',
	vegetables: ['BRÓCOLIS', 'MILHO', 'TOMATE', 'BERINJELA', 'CENOURA', 'COUVE-FLOR', 'RABANETE'],
	normalBonus: 'BÔNUS NORMAL',
	superBonus: 'SUPER BÔNUS',
	hiddenBonus: 'BÔNUS OCULTO',
	mysteryBonus: 'BÔNUS MISTÉRIO',
	featureSpin: 'GIRO ESPECIAL',
	guaranteedCluster: 'GRUPO VENCEDOR GARANTIDO',
	bonusChance: 'CHANCE DE BÔNUS',
	active: 'ATIVO',
	harvest: 'ESCOLHA SUA COLHEITA',
	skip: 'PULAR',
	toggle: 'ALTERNAR',
	tumbleTitle: 'CASCATAS',
	tumbleText: 'Os símbolos vencedores são removidos e novos caem até não surgir outro grupo.',
	multiplierTitle: 'MULTIPLICADORES',
	multiplierText:
		'Todos os multiplicadores de um grupo vencedor são multiplicados e aplicados ao prêmio.',
	bonusRule:
		'3 scatters ativam o Bônus Normal, 4 o Super Bônus; o Bônus Oculto usa uma grade 10×10.',
	controls: 'CONTROLES',
	splashGarden: 'Forme grupos, derrube vegetais e descubra surpresas do jardim.',
});

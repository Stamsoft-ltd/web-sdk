import source from './magneticCommon/da';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BONUS',
	bonuses: 'BONUSSER',
	earned: 'OPTJENT',
	garden: 'HAVEN',
	welcome: 'VELKOMMEN TIL',
	gameBoard: 'Veggie Salad-spilleplade',
	clusterPayouts: 'KLYNGEGEVINSTER',
	vegetables: ['BROCCOLI', 'MAJS', 'TOMAT', 'AUBERGINE', 'GULEROD', 'BLOMKÅL', 'RADISE'],
	normalBonus: 'NORMAL BONUS',
	superBonus: 'SUPER BONUS',
	hiddenBonus: 'SKJULT BONUS',
	mysteryBonus: 'MYSTERIEBONUS',
	featureSpin: 'FEATURE-SPIN',
	guaranteedCluster: 'GARANTERET VINDERKLYNGE',
	bonusChance: 'BONUSCHANCE',
	active: 'AKTIV',
	harvest: 'VÆLG DIN HØST',
	skip: 'SPRING OVER',
	toggle: 'SKIFT',
	tumbleTitle: 'TUMBLES',
	tumbleText: 'Vindende symboler fjernes, og nye falder ned, indtil der ikke dannes en ny klynge.',
	multiplierTitle: 'MULTIPLIKATORER',
	multiplierText:
		'Alle multiplikatorer i en vindende klynge ganges sammen og anvendes på gevinsten.',
	bonusRule:
		'3 scattere udløser Normal Bonus, 4 udløser Super Bonus, og Skjult Bonus bruger et 10×10-felt.',
	controls: 'BETJENING',
	splashGarden: 'Skab klynger, lad grøntsager falde, og opdag havens overraskelser.',
});

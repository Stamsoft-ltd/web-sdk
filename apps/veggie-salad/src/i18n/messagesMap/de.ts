import source from './magneticCommon/de';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BONUS',
	bonuses: 'BONI',
	earned: 'ERSPIELT',
	garden: 'DER GARTEN',
	welcome: 'WILLKOMMEN IM',
	gameBoard: 'Veggie-Salad-Spielfeld',
	clusterPayouts: 'CLUSTER-GEWINNE',
	vegetables: ['BROKKOLI', 'MAIS', 'TOMATE', 'AUBERGINE', 'KAROTTE', 'BLUMENKOHL', 'RADIESCHEN'],
	normalBonus: 'NORMALER BONUS',
	superBonus: 'SUPER-BONUS',
	hiddenBonus: 'VERSTECKTER BONUS',
	mysteryBonus: 'MYSTERY-BONUS',
	featureSpin: 'FEATURE-SPIN',
	guaranteedCluster: 'GARANTIERTES GEWINN-CLUSTER',
	bonusChance: 'BONUSCHANCE',
	active: 'AKTIV',
	harvest: 'WÄHLE DEINE ERNTE',
	skip: 'ÜBERSPRINGEN',
	toggle: 'UMSCHALTEN',
	tumbleTitle: 'KASKADEN',
	tumbleText:
		'Gewinnsymbole werden entfernt. Neue Symbole fallen nach, bis kein neues Cluster entsteht.',
	multiplierTitle: 'MULTIPLIKATOREN',
	multiplierText:
		'Alle Multiplikatoren in einem Gewinn-Cluster werden miteinander multipliziert und auf den Gewinn angewendet.',
	bonusRule:
		'3 Scatter lösen den normalen Bonus aus, 4 den Super-Bonus; der versteckte Bonus nutzt ein 10×10-Feld.',
	controls: 'STEUERUNG',
	splashGarden: 'Bilde Cluster, lass Gemüse fallen und entdecke Überraschungen im Garten.',
});

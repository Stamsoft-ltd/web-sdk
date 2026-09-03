import source from './magneticCommon/fr';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BONUS',
	bonuses: 'BONUS',
	earned: 'CUMULÉ',
	garden: 'LE JARDIN',
	welcome: 'BIENVENUE DANS',
	gameBoard: 'Grille de Veggie Salad',
	clusterPayouts: 'GAINS DE GROUPES',
	vegetables: ['BROCOLI', 'MAÏS', 'TOMATE', 'AUBERGINE', 'CAROTTE', 'CHOU-FLEUR', 'RADIS'],
	normalBonus: 'BONUS NORMAL',
	superBonus: 'SUPER BONUS',
	hiddenBonus: 'BONUS CACHÉ',
	mysteryBonus: 'BONUS MYSTÈRE',
	featureSpin: 'TOUR SPÉCIAL',
	guaranteedCluster: 'GROUPE GAGNANT GARANTI',
	bonusChance: 'CHANCE DE BONUS',
	active: 'ACTIF',
	harvest: 'CHOISISSEZ VOTRE RÉCOLTE',
	skip: 'PASSER',
	toggle: 'BASCULER',
	tumbleTitle: 'CASCADES',
	tumbleText:
		'Les symboles gagnants sont retirés et de nouveaux tombent jusqu’à ce qu’aucun nouveau groupe ne se forme.',
	multiplierTitle: 'MULTIPLICATEURS',
	multiplierText:
		'Tous les multiplicateurs d’un groupe gagnant sont multipliés et appliqués au gain.',
	bonusRule:
		'3 scatters déclenchent le Bonus Normal, 4 le Super Bonus ; le Bonus Caché utilise une grille 10×10.',
	controls: 'COMMANDES',
	splashGarden:
		'Formez des groupes, faites tomber les légumes et découvrez les surprises du jardin.',
});

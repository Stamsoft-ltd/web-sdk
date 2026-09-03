import source from './magneticCommon/ru';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'БОНУС',
	bonuses: 'БОНУСЫ',
	earned: 'НАКОПЛЕНО',
	garden: 'САД',
	welcome: 'ДОБРО ПОЖАЛОВАТЬ В',
	gameBoard: 'Игровое поле Veggie Salad',
	clusterPayouts: 'КЛАСТЕРНЫЕ ВЫИГРЫШИ',
	vegetables: [
		'БРОККОЛИ',
		'КУКУРУЗА',
		'ПОМИДОР',
		'БАКЛАЖАН',
		'МОРКОВЬ',
		'ЦВЕТНАЯ КАПУСТА',
		'РЕДИС',
	],
	normalBonus: 'ОБЫЧНЫЙ БОНУС',
	superBonus: 'СУПЕРБОНУС',
	hiddenBonus: 'СКРЫТЫЙ БОНУС',
	mysteryBonus: 'ТАЙНЫЙ БОНУС',
	featureSpin: 'ОСОБЫЙ СПИН',
	guaranteedCluster: 'ГАРАНТИРОВАННЫЙ ВЫИГРЫШНЫЙ КЛАСТЕР',
	bonusChance: 'ШАНС БОНУСА',
	active: 'АКТИВНО',
	harvest: 'ВЫБЕРИТЕ УРОЖАЙ',
	skip: 'ПРОПУСТИТЬ',
	toggle: 'ПЕРЕКЛЮЧИТЬ',
	tumbleTitle: 'КАСКАДЫ',
	tumbleText:
		'Выигрышные символы удаляются, а новые падают, пока не перестанут появляться кластеры.',
	multiplierTitle: 'МНОЖИТЕЛИ',
	multiplierText: 'Все множители в выигрышном кластере перемножаются и применяются к выигрышу.',
	bonusRule:
		'3 скаттера запускают обычный бонус, 4 — супербонус; скрытый бонус проходит на поле 10×10.',
	controls: 'УПРАВЛЕНИЕ',
	splashGarden: 'Создавайте кластеры, обрушивайте овощи и находите сюрпризы сада.',
});

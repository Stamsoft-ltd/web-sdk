import source from './magneticCommon/id';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BONUS',
	bonuses: 'BONUS',
	earned: 'TERKUMPUL',
	garden: 'KEBUN',
	welcome: 'SELAMAT DATANG DI',
	gameBoard: 'Papan permainan Veggie Salad',
	clusterPayouts: 'BAYARAN KLASTER',
	vegetables: ['BROKOLI', 'JAGUNG', 'TOMAT', 'TERONG', 'WORTEL', 'KEMBANG KOL', 'LOBAK'],
	normalBonus: 'BONUS NORMAL',
	superBonus: 'BONUS SUPER',
	hiddenBonus: 'BONUS TERSEMBUNYI',
	mysteryBonus: 'BONUS MISTERI',
	featureSpin: 'PUTARAN FITUR',
	guaranteedCluster: 'KLASTER MENANG DIJAMIN',
	bonusChance: 'PELUANG BONUS',
	active: 'AKTIF',
	harvest: 'PILIH PANENMU',
	skip: 'LEWATI',
	toggle: 'ALIH',
	tumbleTitle: 'TUMBLE',
	tumbleText: 'Simbol pemenang dihapus dan simbol baru jatuh hingga tidak ada klaster baru.',
	multiplierTitle: 'PENGALI',
	multiplierText: 'Semua pengali dalam klaster pemenang dikalikan dan diterapkan pada kemenangan.',
	bonusRule:
		'3 scatter memicu Bonus Normal, 4 memicu Bonus Super; Bonus Tersembunyi memakai kisi 10×10.',
	controls: 'KONTROL',
	splashGarden: 'Bentuk klaster, jatuhkan sayuran, dan temukan kejutan kebun.',
});

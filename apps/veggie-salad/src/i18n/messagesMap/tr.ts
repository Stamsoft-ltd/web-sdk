import source from './magneticCommon/tr';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'BONUS',
	bonuses: 'BONUSLAR',
	earned: 'BİRİKEN',
	garden: 'BAHÇE',
	welcome: 'HOŞ GELDİN',
	gameBoard: 'Veggie Salad oyun alanı',
	clusterPayouts: 'KÜME KAZANÇLARI',
	vegetables: ['BROKOLİ', 'MISIR', 'DOMATES', 'PATLICAN', 'HAVUÇ', 'KARNABAHAR', 'TURP'],
	normalBonus: 'NORMAL BONUS',
	superBonus: 'SÜPER BONUS',
	hiddenBonus: 'GİZLİ BONUS',
	mysteryBonus: 'GİZEMLİ BONUS',
	featureSpin: 'ÖZELLİK DÖNÜŞÜ',
	guaranteedCluster: 'GARANTİ KAZANAN KÜME',
	bonusChance: 'BONUS ŞANSI',
	active: 'AKTİF',
	harvest: 'HASADINI SEÇ',
	skip: 'ATLA',
	toggle: 'DEĞİŞTİR',
	tumbleTitle: 'DÜŞÜŞLER',
	tumbleText: 'Kazanan semboller kaldırılır ve yeni bir küme oluşmayana kadar yenileri düşer.',
	multiplierTitle: 'ÇARPANLAR',
	multiplierText: 'Kazanan kümedeki tüm çarpanlar birbiriyle çarpılır ve kazanca uygulanır.',
	bonusRule:
		'3 scatter Normal Bonusu, 4 scatter Süper Bonusu başlatır; Gizli Bonus 10×10 alan kullanır.',
	controls: 'KONTROLLER',
	splashGarden: 'Kümeler oluştur, sebzeleri düşür ve bahçe sürprizlerini keşfet.',
});

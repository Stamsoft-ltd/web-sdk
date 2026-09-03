import source from './magneticCommon/hi';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'बोनस',
	bonuses: 'बोनस',
	earned: 'कुल जीत',
	garden: 'बगीचा',
	welcome: 'आपका स्वागत है',
	gameBoard: 'Veggie Salad गेम बोर्ड',
	clusterPayouts: 'क्लस्टर भुगतान',
	vegetables: ['ब्रोकली', 'मक्का', 'टमाटर', 'बैंगन', 'गाजर', 'फूलगोभी', 'मूली'],
	normalBonus: 'सामान्य बोनस',
	superBonus: 'सुपर बोनस',
	hiddenBonus: 'छिपा बोनस',
	mysteryBonus: 'मिस्ट्री बोनस',
	featureSpin: 'फ़ीचर स्पिन',
	guaranteedCluster: 'गारंटीड विजेता क्लस्टर',
	bonusChance: 'बोनस मौका',
	active: 'सक्रिय',
	harvest: 'अपनी फसल चुनें',
	skip: 'छोड़ें',
	toggle: 'बदलें',
	tumbleTitle: 'टम्बल',
	tumbleText:
		'जीतने वाले प्रतीक हटते हैं और नए प्रतीक तब तक गिरते हैं जब तक नया क्लस्टर नहीं बनता।',
	multiplierTitle: 'गुणक',
	multiplierText: 'जीतने वाले क्लस्टर के सभी गुणक आपस में गुणा होकर उस जीत पर लागू होते हैं।',
	bonusRule:
		'3 स्कैटर सामान्य बोनस, 4 सुपर बोनस शुरू करते हैं; छिपा बोनस 10×10 ग्रिड उपयोग करता है।',
	controls: 'नियंत्रण',
	splashGarden: 'क्लस्टर बनाएँ, सब्ज़ियाँ गिराएँ और बगीचे के सरप्राइज़ खोजें।',
});

import source from './magneticCommon/ko';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: '보너스',
	bonuses: '보너스',
	earned: '누적 당첨',
	garden: '정원',
	welcome: '환영합니다',
	gameBoard: 'Veggie Salad 게임 보드',
	clusterPayouts: '클러스터 당첨',
	vegetables: ['브로콜리', '옥수수', '토마토', '가지', '당근', '콜리플라워', '무'],
	normalBonus: '일반 보너스',
	superBonus: '슈퍼 보너스',
	hiddenBonus: '숨겨진 보너스',
	mysteryBonus: '미스터리 보너스',
	featureSpin: '기능 스핀',
	guaranteedCluster: '당첨 클러스터 보장',
	bonusChance: '보너스 확률',
	active: '활성',
	harvest: '수확 선택',
	skip: '건너뛰기',
	toggle: '전환',
	tumbleTitle: '텀블',
	tumbleText: '당첨 심볼이 제거되고 새 클러스터가 없을 때까지 새 심볼이 떨어집니다.',
	multiplierTitle: '배수',
	multiplierText: '당첨 클러스터 안의 모든 배수를 곱해 해당 당첨에 적용합니다.',
	bonusRule:
		'스캐터 3개는 일반, 4개는 슈퍼 보너스를 발동하며 숨겨진 보너스는 10×10 보드를 사용합니다.',
	controls: '조작',
	splashGarden: '클러스터를 만들고 채소를 떨어뜨려 정원의 놀라움을 찾아보세요.',
});

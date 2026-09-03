import source from './magneticCommon/vi';
import { createLocale } from './createLocale';

export default createLocale(source, {
	bonus: 'THƯỞNG',
	bonuses: 'CÁC VÒNG THƯỞNG',
	earned: 'TỔNG THẮNG',
	garden: 'KHU VƯỜN',
	welcome: 'CHÀO MỪNG ĐẾN',
	gameBoard: 'Bảng chơi Veggie Salad',
	clusterPayouts: 'THƯỞNG CỤM',
	vegetables: ['BÔNG CẢI XANH', 'NGÔ', 'CÀ CHUA', 'CÀ TÍM', 'CÀ RỐT', 'SÚP LƠ TRẮNG', 'CỦ CẢI'],
	normalBonus: 'THƯỞNG THƯỜNG',
	superBonus: 'SIÊU THƯỞNG',
	hiddenBonus: 'THƯỞNG ẨN',
	mysteryBonus: 'THƯỞNG BÍ ẨN',
	featureSpin: 'LƯỢT TÍNH NĂNG',
	guaranteedCluster: 'ĐẢM BẢO CỤM THẮNG',
	bonusChance: 'CƠ HỘI THƯỞNG',
	active: 'ĐANG BẬT',
	harvest: 'CHỌN VỤ THU HOẠCH',
	skip: 'BỎ QUA',
	toggle: 'CHUYỂN',
	tumbleTitle: 'RƠI TIẾP',
	tumbleText:
		'Biểu tượng thắng bị loại bỏ và biểu tượng mới rơi xuống cho đến khi không còn cụm mới.',
	multiplierTitle: 'HỆ SỐ NHÂN',
	multiplierText: 'Mọi hệ số trong cụm thắng được nhân với nhau và áp dụng cho phần thắng.',
	bonusRule:
		'3 scatter kích hoạt Thưởng Thường, 4 kích hoạt Siêu Thưởng; Thưởng Ẩn dùng bảng 10×10.',
	controls: 'ĐIỀU KHIỂN',
	splashGarden: 'Tạo cụm, thả rau củ và khám phá bất ngờ trong khu vườn.',
});

/** Native UI terminology for social play. Rule/legal translations need native review;
 * wagering-related long copy uses the canonical English social fallback meanwhile.
 */
export const socialUi: Record<string, { table: string; anywhere: string }> = {
	ar: { table: 'جدول الفوز', anywhere: 'فوز في أي موضع' },
	bg: { table: 'Печалби и правила', anywhere: 'Печалби навсякъде' },
	de: { table: 'Gewinntabelle & Regeln', anywhere: 'Gewinne überall' },
	es: { table: 'Tabla de ganancias y reglas', anywhere: 'Gana en cualquier posición' },
	fi: { table: 'Voittotaulukko ja säännöt', anywhere: 'Voitot mistä tahansa' },
	fr: { table: 'Table des gains et règles', anywhere: 'Gains partout' },
	hi: { table: 'जीत तालिका और नियम', anywhere: 'कहीं भी जीतें' },
	id: { table: 'Tabel kemenangan & aturan', anywhere: 'Menang di mana saja' },
	ja: { table: '獲得表とルール', anywhere: 'どこでも獲得' },
	ko: { table: '당첨표 및 규칙', anywhere: '어디서나 당첨' },
	pl: { table: 'Tabela wygranych i zasady', anywhere: 'Wygrane w dowolnym miejscu' },
	pt: { table: 'Tabela de ganhos e regras', anywhere: 'Ganhos em qualquer posição' },
	ru: { table: 'Таблица выигрышей и правила', anywhere: 'Выигрыши в любом месте' },
	tr: { table: 'Kazanç tablosu ve kurallar', anywhere: 'Her yerde kazanç' },
	vi: { table: 'Bảng thắng và luật', anywhere: 'Thắng ở mọi vị trí' },
	zh: { table: '赢取表与规则', anywhere: '任意位置赢取' },
};
export function nativeSocialLabel(
	key: string,
	catalog: Record<string, string> | undefined,
	lang: string,
) {
	if (!catalog) return undefined;
	if (['BET', 'BET LABEL', 'BUY', 'COST', 'TOTAL COST'].includes(key)) return catalog.PLAY;
	if (key === 'BET PLUS') return `${catalog.PLAY} +`;
	if (key === 'BET MINUS') return `${catalog.PLAY} −`;
	if (key === 'FEATURE BUY') return catalog['FEATURES PAGE'];
	if (key === 'PAYTABLE' || key === 'PAYOUT TABLE') return socialUi[lang]?.table;
	if (key === 'PAY ANYWHERE') return socialUi[lang]?.anywhere;
	return undefined;
}
export function needsSocialFallback(english: string) {
	return /\b(bets?|betting|paid|pay(?:s|ing)?|payouts?|buy(?:ing)?|bought|purchases?|wagers?|money|funds?|credits?|currency|stakes?|withdraw|deposit|cash|gamble)\b/i.test(
		english,
	);
}

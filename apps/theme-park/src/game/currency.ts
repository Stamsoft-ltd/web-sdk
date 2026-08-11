/** Keep localized currency placement, but hide an empty two-digit decimal suffix. */
export const stripEmptyCurrencyDecimals = (value: string) => value.replace(/([.,])00(?=\D*$)/, '');

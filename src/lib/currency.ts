export type CurrencyCode = 'CHF' | 'EUR' | 'USD' | 'GBP';

export type Currency = {
  code: CurrencyCode;
  name: string;
  /** Units of this currency per 1 CHF. Demo rates; replace with a live FX feed. */
  perChf: number;
};

/** All amounts are held in CHF and converted for display. */
export const CURRENCIES: readonly Currency[] = [
  { code: 'CHF', name: 'Swiss franc', perChf: 1 },
  { code: 'EUR', name: 'Euro', perChf: 1.06 },
  { code: 'USD', name: 'US dollar', perChf: 1.13 },
  { code: 'GBP', name: 'British pound', perChf: 0.89 },
];

export function getCurrency(code: CurrencyCode): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;
}

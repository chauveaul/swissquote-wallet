import { formatChf, formatNumber, formatPercentChange, priceDecimals, truncateAddress } from '@/lib/format';

describe('format', () => {
  it('uses Swiss grouping', () => {
    expect(formatNumber(12480.55)).toBe('12’480.55');
    expect(formatChf(1453.7)).toBe('CHF 1’453.70');
    expect(formatNumber(1950, 2)).toBe('1’950.00');
  });

  it('formats signed percentages with typographic minus', () => {
    expect(formatPercentChange(3.1)).toBe('+ 3.10%');
    expect(formatPercentChange(-0.85)).toBe('− 0.85%');
    expect(formatPercentChange(0)).toBe('0.00%');
  });

  it('uses 4 decimals for sub-franc prices', () => {
    expect(priceDecimals(0.8831)).toBe(4);
    expect(priceDecimals(2907.3)).toBe(2);
  });

  it('truncates addresses like the design', () => {
    expect(truncateAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe('0x71C7…976F');
  });
});

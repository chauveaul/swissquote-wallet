import { useMemo } from 'react';

import { useWallet } from '@/features/wallet/store';
import { getCurrency } from '@/lib/currency';
import { formatNumber, priceDecimals } from '@/lib/format';

/**
 * Formats CHF amounts in the user's display currency (Settings → Display currency).
 * Every amount in the app is kept in CHF and only converted here.
 */
export function useFiat() {
  const code = useWallet((s) => s.meta?.currency ?? 'CHF');
  return useMemo(() => {
    const { perChf } = getCurrency(code);
    const convert = (chf: number) => chf * perChf;
    return {
      code,
      convert,
      /** `EUR 1’541.92` */
      format: (chf: number, decimals = 2) => `${code} ${formatNumber(convert(chf), decimals)}`,
      /** Number only, for layouts that render the code separately. */
      number: (chf: number, decimals = 2) => formatNumber(convert(chf), decimals),
      /** Unit price: 4 decimals below 1 (e.g. stablecoins in some currencies), else 2. */
      price: (chf: number) => {
        const v = convert(chf);
        return `${code} ${formatNumber(v, priceDecimals(v))}`;
      },
    };
  }, [code]);
}

import { useMemo } from 'react';

import { useQuotes } from '@/features/market/queries';
import { useWallet } from '@/features/wallet/store';
import { formatNumber, priceDecimals } from '@/lib/format';

/**
 * Formats CHF amounts in the user's display currency (Settings → Display currency).
 * Every amount in the app is kept in CHF and only converted here, at the price
 * source's live FX rate. Without a rate for the chosen currency, values are
 * shown in CHF (correct, just not converted) rather than at a stale rate.
 */
export function useFiat() {
  const chosen = useWallet((s) => s.meta?.currency ?? 'CHF');
  const rate = useQuotes().fxPerChf?.[chosen];
  const code = rate ? chosen : 'CHF';
  const perChf = rate ?? 1;
  return useMemo(() => {
    const convert = (chf: number) => chf * perChf;
    return {
      code,
      /** True when the chosen currency had no live rate and CHF is shown instead. */
      fallbackToChf: code !== chosen,
      convert,
      /** `EUR 1’541.92`; "—" when the value is unknown (no price). */
      format: (chf: number | null, decimals = 2) =>
        chf === null ? '—' : `${code} ${formatNumber(convert(chf), decimals)}`,
      /** Number only, for layouts that render the code separately. */
      number: (chf: number, decimals = 2) => formatNumber(convert(chf), decimals),
      /** Unit price: 4 decimals below 1 (e.g. stablecoins in some currencies), else 2. "—" when unknown. */
      price: (chf: number | null) => {
        if (chf === null) return '—';
        const v = convert(chf);
        return `${code} ${formatNumber(v, priceDecimals(v))}`;
      },
    };
  }, [code, chosen, perChf]);
}

import { useQuery } from '@tanstack/react-query';

import { useWallet } from '@/features/wallet/store';
import type { NetworkId } from '@/lib/networks';
import { checkSponsorship, gaslessConfigured, type Sponsorship } from '@/services/gasless';

const UNAVAILABLE: Sponsorship = { sponsored: false, reason: 'Gasless sends are not configured.' };

/**
 * Whether the paymaster would cover gas for a send from this account on this
 * network. `enabled: false` skips the check (e.g. Swissquote deposits, which
 * the custodian verifies as plain top-level transfers).
 */
export function useSponsorship(networkId: NetworkId, accountIndex: number, address: string, enabled = true) {
  const getSigner = useWallet((s) => s.getSigner);
  const active = enabled && gaslessConfigured();
  const q = useQuery({
    queryKey: ['sponsorship', networkId, address],
    queryFn: () => checkSponsorship(getSigner(accountIndex), networkId),
    enabled: active,
    staleTime: 60_000,
    retry: false,
  });
  return { sponsorship: active ? (q.data ?? null) : UNAVAILABLE, loading: active && q.isPending };
}

import { useLocalActivity } from '@/features/market/queries';
import { useSendDraft } from '@/features/send/draft';
import { queryClient } from '@/lib/queryClient';

import { useWallet } from './store';

/**
 * Removes the wallet from this device and clears everything cached for it, so
 * the next wallet (created or imported) starts clean.
 */
export async function signOut() {
  await useWallet.getState().removeWallet();
  queryClient.clear();
  useLocalActivity.setState({ items: [] });
  useSendDraft.getState().reset();
}

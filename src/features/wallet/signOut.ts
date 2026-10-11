import { useLocalActivity } from '@/features/market/queries';
import { useSendDraft } from '@/features/send/draft';
import { queryClient } from '@/lib/queryClient';

import { useWallet } from './store';

/**
 * Removes every account from this device and clears everything cached for
 * them, so the next wallet (created or imported) starts clean.
 */
export async function signOut() {
  await useWallet.getState().removeWallet();
  queryClient.clear();
  useLocalActivity.setState({ items: [] });
  useSendDraft.getState().reset();
}

/**
 * Removes one account (its recovery phrase and cached data) and keeps the
 * others. Signing out of the last account is the same as `signOut`.
 */
export async function signOutAccount(index: number, password: string) {
  const meta = useWallet.getState().meta;
  if (meta && meta.accounts.length <= 1) {
    await useWallet.getState().verifyPassword(password);
    await signOut();
    return;
  }
  await useWallet.getState().removeAccount(index, password);
  queryClient.removeQueries({ queryKey: ['portfolio', index] });
  useLocalActivity.setState((s) => ({ items: s.items.filter((i) => i.accountIndex !== index) }));
  useSendDraft.getState().reset();
}

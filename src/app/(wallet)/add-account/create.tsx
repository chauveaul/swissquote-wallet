import { useState } from 'react';
import { Redirect } from 'expo-router';

import { useWallet } from '@/features/wallet/store';
import { RecoveryPhraseScreen } from '@/screens/RecoveryPhraseScreen';

export default function AddAccountCreate() {
  // Checked on arrival only: adding the account clears the draft while this
  // screen is still mounted, and that must not bounce back to step 1.
  const [hasDraft] = useState(() => useWallet.getState().draftMnemonic !== null);
  if (!hasDraft) return <Redirect href="/add-account" />;
  return <RecoveryPhraseScreen mode="add" />;
}

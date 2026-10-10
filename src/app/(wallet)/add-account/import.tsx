import { router } from 'expo-router';

import { useWallet } from '@/features/wallet/store';
import { RestoreScreen } from '@/screens/RestoreScreen';

export default function AddAccountImport() {
  const beginRestore = useWallet((s) => s.beginRestore);
  const addAccount = useWallet((s) => s.addAccount);
  const clearDraft = useWallet((s) => s.clearDraft);

  return (
    <RestoreScreen
      flow="add"
      onPhrase={async (phrase) => {
        beginRestore(phrase);
        try {
          await addAccount();
        } catch (e) {
          clearDraft();
          throw e;
        }
        router.dismissTo('/');
      }}
    />
  );
}

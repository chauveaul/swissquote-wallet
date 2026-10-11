import { router } from 'expo-router';

import { useWallet } from '@/features/wallet/store';
import { RestoreScreen } from '@/screens/RestoreScreen';

export default function Restore() {
  const beginRestore = useWallet((s) => s.beginRestore);
  return (
    <RestoreScreen
      flow="restore"
      onPhrase={(phrase) => {
        beginRestore(phrase);
        router.push({ pathname: '/set-password', params: { flow: 'restore' } });
      }}
    />
  );
}

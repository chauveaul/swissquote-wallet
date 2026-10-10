import { router } from 'expo-router';

import { SignOutScreen } from '@/screens/SignOutScreen';

export default function SignOut() {
  return <SignOutScreen onCancel={() => router.back()} />;
}

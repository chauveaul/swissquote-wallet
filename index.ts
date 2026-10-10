// Must run before anything touches `crypto.getRandomValues` (viem, @noble, bip39).
// Provides a CSPRNG backed by the platform's secure random source.
import 'react-native-get-random-values';

import 'expo-router/entry';

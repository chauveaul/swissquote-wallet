import { KeyboardController } from 'react-native-keyboard-controller';

/** Longest we wait for the keyboard to finish hiding before moving on anyway. */
const MAX_WAIT_MS = 350;

/**
 * Closes the keyboard and resolves once it's hidden (or after a short cap).
 *
 * Call it before anything that replaces the screen holding the focused input:
 * if that input unmounts first, Android hides the keys without a hide event,
 * and the keyboard toolbar stays stuck mid-screen until another input focuses.
 */
export function closeKeyboard(): Promise<void> {
  return Promise.race([
    KeyboardController.dismiss(),
    new Promise<void>((resolve) => setTimeout(resolve, MAX_WAIT_MS)),
  ]);
}
